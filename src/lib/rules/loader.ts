import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { RuleSchema } from './types';
import type { Rule } from './types';

/** Every file under `dir`, recursively, in a stable alphabetical order. */
function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

/**
 * Every prerequisite cycle among roadmap steps, each as a readable path
 * ("a -> b -> a"). A step naming itself is reported the same way.
 *
 * Only edges pointing at loaded steps are followed. Prerequisites that name a
 * missing rule, or a rule that is not a step, cannot take part in a cycle and
 * are reported by the dangling check instead, so skipping them here keeps this
 * walk from tripping over problems that are already covered.
 */
function findPrerequisiteCycles(steps: Map<string, readonly string[]>): string[] {
  const cycles: string[] = [];
  const settled = new Set<string>(); // fully explored, no cycle reachable from here
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
 * Read every YAML rule under `dir` and validate it.
 *
 * Nothing is returned unless the whole directory is sound. Problems are
 * collected and reported in a single error so a rule author fixes them all in
 * one pass instead of rerunning after each fix. Four kinds are caught:
 * unparseable or schema-invalid files, ids used twice, roadmap steps whose
 * prerequisites name a rule that does not exist, and prerequisite cycles.
 */
export function loadRules(dir: string): Rule[] {
  const files = walk(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const rules: Rule[] = [];
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
    const res = RuleSchema.safeParse(data);
    if (res.success) {
      rules.push(res.data);
      continue;
    }
    const detail = res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    errors.push(`${file}: ${detail}`);
  }

  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) errors.push(`duplicate rule id: ${r.id}`);
    seen.add(r.id);
  }

  // Referential integrity: every prerequisite must name a loaded rule id.
  const ids = new Set(rules.map((r) => r.id));
  const steps = new Map<string, readonly string[]>();
  for (const r of rules) {
    if (r.type !== 'roadmap_step') continue;
    steps.set(r.id, r.prerequisites);
    for (const p of r.prerequisites) {
      if (!ids.has(p)) errors.push(`${r.id}: unknown prerequisite '${p}'`);
    }
  }
  errors.push(...findPrerequisiteCycles(steps));

  if (errors.length) throw new Error(`Invalid rules:\n${errors.join('\n')}`);
  return rules;
}
