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
 * Read every YAML rule under `dir` and validate it.
 *
 * Nothing is returned unless the whole directory is sound. Problems are
 * collected and reported in a single error so a rule author fixes them all in
 * one pass instead of rerunning after each fix. Three kinds are caught:
 * unreadable or schema-invalid files, ids used twice, and roadmap steps whose
 * prerequisites name a rule that does not exist.
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
      // Malformed YAML: the parser's own message has no file path, so add it.
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
  for (const r of rules) {
    if (r.type !== 'roadmap_step') continue;
    for (const p of r.prerequisites) {
      if (!ids.has(p)) errors.push(`${r.id}: unknown prerequisite '${p}'`);
    }
  }

  if (errors.length) throw new Error(`Invalid rules:\n${errors.join('\n')}`);
  return rules;
}
