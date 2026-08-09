import type { LoadedRule } from './loader';

/**
 * How long a verification is trusted for, in days — roughly six months.
 *
 * A rule goes stale strictly *after* this many days, so one verified exactly
 * 183 days ago is still fresh and the warning starts on day 184.
 */
export const STALE_AFTER_DAYS = 183;

const MS_PER_DAY = 86_400_000;

/**
 * The ISO day `days` before `day`.
 *
 * Counts in UTC so a daylight-saving change cannot move the result by a day.
 * Task 5's `dates.ts` will own this; until it exists, freshness keeps its own.
 */
function daysBefore(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Rules claiming to have been verified after `today`.
 *
 * Nobody can have checked a source in the future, so this is a false claim
 * rather than a rule that has merely aged, and callers treat it as an error.
 */
export function futureVerifications(rules: readonly LoadedRule[], today: string): LoadedRule[] {
  return rules.filter(({ rule }) => rule.verified_on > today);
}

/**
 * Rules whose verification has aged past `STALE_AFTER_DAYS`.
 *
 * Being stale is not being wrong: the rule may well still hold. It means
 * nobody has re-read the official source lately, so callers warn instead of
 * failing. A future verification is never stale.
 */
export function staleVerifications(rules: readonly LoadedRule[], today: string): LoadedRule[] {
  const cutoff = daysBefore(today, STALE_AFTER_DAYS);
  return rules.filter(({ rule }) => rule.verified_on < cutoff);
}
