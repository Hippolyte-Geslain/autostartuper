import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { RuleSchema } from './types';
import type { Rule } from './types';

/** A parsed rule paired with the file it came from, so errors can point at it. */
export interface LoadedRule {
  file: string;
  rule: Rule;
}

/**
 * Opening line of the error thrown for unsound rules.
 *
 * Exported so callers can tell a rule-authoring problem, which deserves a
 * plain message, from a bug in the loader itself, which deserves a stack.
 */
export const INVALID_RULES_PREFIX = 'Invalid rules:';

/**
 * Every file under `dir`, recursively, in a stable alphabetical order.
 *
 * Symlinked directories and Windows junctions are read as plain files rather
 * than descended into, because `Dirent.isDirectory()` is false for a link.
 * A link pointing back up the tree therefore cannot send this into a loop.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
}

/**
 * Prerequisite cycles among roadmap steps, each as a readable path
 * ("a -> b -> a"). A step naming itself is reported the same way.
 *
 * One error is reported per back edge, not per tangle: a knot of mutually
 * reachable steps may yield a single line even though several orderings are
 * broken. Fix what is reported and rerun to see the rest.
 *
 * Only edges pointing at loaded steps are followed. A prerequisite naming a
 * missing rule, or one that is not a step, cannot take part in a cycle and is
 * reported by `validateRuleGraph`, so skipping it here keeps this walk from
 * tripping over a problem that is already covered.
 */
function findPrerequisiteCycles(steps: Map<string, readonly string[]>): string[] {
  const cycles: string[] = [];
  const settled = new Set<string>(); // fully explored, nothing broken below it
  const path: string[] = []; // the chain of steps currently being explored
  const onPath = new Set<string>();

  function visit(id: string): void {
    if (settled.has(id)) return;
    if (onPath.has(id)) {
      cycles.push(`prerequisite cycle: ${[...path.slice(path.indexOf(id)), id].join(' -> ')}`);
      return;
    }
    path.push(id);
    onPath.add(id);
    for (const prerequisite of steps.get(id) ?? []) {
      if (steps.has(prerequisite)) visit(prerequisite);
    }
    path.pop();
    onPath.delete(id);
    settled.add(id);
  }

  for (const id of steps.keys()) visit(id);
  return cycles;
}

/**
 * Check a set of already-parsed rules as a whole and return every problem
 * found. An empty array means the set is sound.
 *
 * These are the checks no single file can make on its own: ids used twice,
 * prerequisites naming something that cannot satisfy them, and cycles.
 */
export function validateRuleGraph(rules: LoadedRule[]): string[] {
  const errors: string[] = [];

  // One index answers both "was this id already used?" and "does this id
  // exist?", so there is no second lookup table to keep in step with it.
  const fileById = new Map<string, string>();
  // Known and deliberate: on a duplicate id, `fileById` keeps the first file
  // while `steps` keeps the last rule's prerequisites. Harmless, because a
  // duplicate is itself an error, so the graph is never trusted on its own.
  const steps = new Map<string, readonly string[]>();
  for (const { file, rule } of rules) {
    const firstFile = fileById.get(rule.id);
    if (firstFile) errors.push(`duplicate rule id '${rule.id}': ${firstFile} and ${file}`);
    else fileById.set(rule.id, file);
    if (rule.type === 'roadmap_step') steps.set(rule.id, rule.prerequisites);
  }

  // A prerequisite must name a roadmap step. Only steps can be completed, so a
  // prerequisite pointing at a threshold or an obligation is never satisfied
  // and would silently hold its step back forever.
  for (const { file, rule } of rules) {
    if (rule.type !== 'roadmap_step') continue;
    for (const prerequisite of rule.prerequisites) {
      if (!fileById.has(prerequisite)) {
        errors.push(`${file}: ${rule.id}: unknown prerequisite '${prerequisite}'`);
      } else if (!steps.has(prerequisite)) {
        errors.push(`${file}: ${rule.id}: prerequisite '${prerequisite}' is not a roadmap_step`);
      }
    }
  }

  errors.push(...findPrerequisiteCycles(steps));
  return errors;
}

/**
 * Read every YAML rule under `dir` and validate it, keeping each rule paired
 * with the file it came from.
 *
 * Nothing is returned unless the whole directory is sound. Problems are
 * collected and reported in a single error so a rule author fixes them all in
 * one pass instead of rerunning after each fix. Files are read, parsed and
 * schema-checked here; everything that depends on the other rules is left to
 * `validateRuleGraph`.
 *
 * Use this when a later message needs to name the offending file; use
 * `loadRules` when only the rules matter.
 */
export function loadRulesWithFiles(dir: string): LoadedRule[] {
  const files = walk(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const loaded: LoadedRule[] = [];
  const errors: string[] = [];

  for (const file of files) {
    let data: unknown;
    try {
      data = parse(readFileSync(file, 'utf8'));
    } catch (err) {
      // Unreadable file or malformed YAML. The underlying message has no file
      // path, so add it and keep going: one bad file must not hide the rest.
      errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    // A blank or comment-only file parses to null. Say so plainly instead of
    // letting the schema complain that it expected an object and got nothing.
    if (data === null || data === undefined) {
      errors.push(`${file}: file is empty`);
      continue;
    }
    const res = RuleSchema.safeParse(data);
    if (res.success) {
      loaded.push({ file, rule: res.data });
      continue;
    }
    const detail = res.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    errors.push(`${file}: ${detail}`);
  }

  errors.push(...validateRuleGraph(loaded));

  if (errors.length) {
    // Bullet each problem and indent its continuation lines, so a multi-line
    // YAML parser complaint stays visibly part of one entry.
    const entries = errors.map((e) => `- ${e.replace(/\n/g, '\n  ')}`);
    throw new Error(`${INVALID_RULES_PREFIX}\n${entries.join('\n')}`);
  }
  return loaded;
}

/** As `loadRulesWithFiles`, without the file each rule came from. */
export function loadRules(dir: string): Rule[] {
  return loadRulesWithFiles(dir).map((l) => l.rule);
}
