/**
 * Checks every rule in `rules/` and exits non-zero on any problem, so CI can
 * gate on it.
 *
 * The loader does the per-file and cross-file work. This adds the two checks
 * that only make sense against today's date: a `verified_on` in the future is
 * a claim nobody could have made yet, and a rule verified long ago is flagged
 * as stale so someone re-reads the source, without blocking the build.
 *
 *   npm run validate:rules            # any number of rules is fine
 *   npm run validate:rules -- --min 9 # fail if fewer than 9 rules load
 */
import { loadRules } from '../src/lib/rules/loader';
import type { Rule } from '../src/lib/rules/types';

/** Relative to the repo root, which is where `npm run` starts. */
const RULES_DIR = 'rules';
/** Six months. Past that, the official source has probably moved on. */
const STALE_AFTER_DAYS = 183;
const MS_PER_DAY = 86_400_000;

/** The ISO day `daysAgo` days before now. Compares directly with `verified_on`. */
function isoDay(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString().slice(0, 10);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function minimumFrom(args: string[]): number {
  const at = args.indexOf('--min');
  if (at === -1) return 0;
  const value = Number(args[at + 1]);
  // A typo'd threshold must not quietly pass; this script is a gate.
  if (!Number.isInteger(value) || value < 0) {
    fail(`--min expects a whole number, got '${args[at + 1] ?? ''}'`);
  }
  return value;
}

function load(dir: string): Rule[] {
  try {
    return loadRules(dir);
  } catch (err) {
    // The loader already lists every problem in a form a rule author can act
    // on, so print that and nothing else — no stack trace.
    fail(err instanceof Error ? err.message : String(err));
  }
}

const minimum = minimumFrom(process.argv.slice(2));
const rules = load(RULES_DIR);
const today = isoDay();

const problems = rules
  .filter((rule) => rule.verified_on > today)
  .map((rule) => `${rule.id}: verified_on ${rule.verified_on} is in the future`);
if (rules.length < minimum) {
  problems.push(`too few rules: loaded ${rules.length}, expected at least ${minimum}`);
}
if (problems.length) {
  fail(['Rules check failed:', ...problems.map((problem) => `- ${problem}`)].join('\n'));
}

const staleBefore = isoDay(STALE_AFTER_DAYS);
for (const rule of rules) {
  if (rule.verified_on < staleBefore) {
    console.warn(
      `STALE: ${rule.id} verified on ${rule.verified_on} — re-verify against ${rule.source_url}`
    );
  }
}

console.log(`OK — ${rules.length} rules valid.`);
