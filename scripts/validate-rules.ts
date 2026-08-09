/**
 * Checks every rule in `rules/` and exits non-zero on any problem, so CI can
 * gate on it.
 *
 * The loader does the per-file and cross-file work; `freshness` does the date
 * work. This wires them to a command line and decides what fails the build: a
 * `verified_on` in the future is a claim nobody could have made yet and fails,
 * while a rule nobody has re-read in months only warns.
 */
import { join, relative } from 'node:path';
import { INVALID_RULES_PREFIX, loadRulesWithFiles } from '../src/lib/rules/loader';
import type { LoadedRule } from '../src/lib/rules/loader';
import { futureVerifications, staleVerifications } from '../src/lib/rules/freshness';

const USAGE = [
  'Usage: npm run validate:rules -- [options]',
  '',
  '  --min <n>, --min=<n>  fail unless at least n rules load (default 0)',
  '  --help, -h            show this message',
].join('\n');

/** A command line that cannot be honoured. Reported plainly, without a stack. */
export class UsageError extends Error {}

/**
 * What the command line asked for: `'help'`, or the minimum number of rules
 * that must load.
 *
 * Unknown arguments are refused rather than ignored. A typo such as `--mim 9`
 * would otherwise disarm the gate silently, which is the one failure this
 * script exists to prevent.
 */
export function minimumFrom(args: string[]): number | 'help' {
  if (args.includes('--help') || args.includes('-h')) return 'help';

  let minimum: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    let raw: string | undefined;
    if (arg.startsWith('--min=')) {
      raw = arg.slice('--min='.length);
    } else if (arg === '--min') {
      index += 1; // the value is the next argument
      raw = args[index];
    } else {
      throw new UsageError(`unknown argument '${arg}'`);
    }
    // Two --min values are two different intentions. Letting one quietly win
    // is the same guess this parser refuses to make everywhere else.
    if (minimum !== undefined) throw new UsageError('--min given more than once');
    // Number('') is 0 and Number(undefined) is NaN. Neither is a number anyone
    // typed, so both have to be caught before the range check.
    const value = Number(raw);
    if (raw === undefined || raw.trim() === '' || !Number.isInteger(value) || value < 0) {
      throw new UsageError(`--min expects a whole number, got '${raw ?? ''}'`);
    }
    minimum = value;
  }
  return minimum ?? 0;
}

/** Names a rule the way an author can find it again. */
const label = ({ file, rule }: LoadedRule): string => `${rule.id} (${file})`;

function run(argv: string[], dir: string): void {
  const minimum = minimumFrom(argv);
  if (minimum === 'help') {
    console.log(USAGE);
    return;
  }

  const rules = loadRulesWithFiles(dir);
  // Authors write dates in their own calendar, so "today" is local, not UTC.
  const today = new Date().toLocaleDateString('sv-SE');

  // Warnings come first and are printed even when the checks below fail, so a
  // single run shows everything there is to fix. GitHub folds an annotated
  // line into the run summary; locally the prefix would just be noise.
  const prefix = process.env.GITHUB_ACTIONS ? '::warning::' : '';
  for (const stale of staleVerifications(rules, today)) {
    console.warn(
      `${prefix}STALE: ${label(stale)} verified on ${stale.rule.verified_on}` +
        ` — re-verify against ${stale.rule.source_url}`
    );
  }

  const problems = futureVerifications(rules, today).map(
    (future) => `${label(future)}: verified_on ${future.rule.verified_on} is in the future`
  );
  if (rules.length < minimum) {
    problems.push(`too few rules: loaded ${rules.length}, expected at least ${minimum}`);
  }
  if (problems.length) {
    fail(['Rules check failed:', ...problems.map((problem) => `- ${problem}`)].join('\n'));
    return;
  }

  console.log(`OK — ${rules.length} rules valid.`);
}

/**
 * Report a failure and mark the run failed.
 *
 * Sets `exitCode` instead of calling `process.exit`, which on Windows can cut
 * off output that has not drained yet — losing the very message CI needs.
 */
function fail(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

/**
 * True when tsx ran this file directly. Guards the side effects below so a
 * test can import `minimumFrom` without the whole check running.
 *
 * `require` is undefined once a bundler loads this as a module, hence `typeof`.
 */
const runDirectly = typeof require !== 'undefined' && require.main === module;

if (runDirectly) {
  // Found from this file, so the directory does not depend on where the script
  // was started, then spelled relative to the caller so every path the loader
  // prints stays short. Same directory either way.
  const rulesDir = join(__dirname, '..', 'rules');
  try {
    run(process.argv.slice(2), relative(process.cwd(), rulesDir) || '.');
  } catch (err) {
    if (err instanceof UsageError) {
      fail(`${err.message}\n${USAGE}`);
    } else if (err instanceof Error && err.message.startsWith(INVALID_RULES_PREFIX)) {
      // The loader already lists every problem in a form a rule author can act
      // on, so print that and nothing else — a stack would only bury it.
      fail(err.message);
    } else {
      throw err; // not a rule problem: keep the stack, it points at a bug
    }
  }
}
