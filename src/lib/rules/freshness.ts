import { addDays, type ISODate } from './dates';
import type { LoadedRule } from './loader';

/**
 * How long a verification is trusted for, in days — roughly six months.
 *
 * A rule goes stale strictly *after* this many days, so one verified exactly
 * 183 days ago is still fresh and the warning starts on day 184.
 */
export const STALE_AFTER_DAYS = 183;

/**
 * Rules claiming to have been verified after `today`.
 *
 * Nobody can have checked a source in the future, so this is a false claim
 * rather than a rule that has merely aged, and callers treat it as an error.
 */
export function futureVerifications(rules: readonly LoadedRule[], today: ISODate): LoadedRule[] {
  return rules.filter(({ rule }) => rule.verified_on > today);
}

/**
 * Rules whose verification has aged past `STALE_AFTER_DAYS`.
 *
 * Being stale is not being wrong: the rule may well still hold. It means
 * nobody has re-read the official source lately, so callers warn instead of
 * failing. A future verification is never stale.
 */
export function staleVerifications(rules: readonly LoadedRule[], today: ISODate): LoadedRule[] {
  const cutoff = addDays(today, -STALE_AFTER_DAYS);
  return rules.filter(({ rule }) => rule.verified_on < cutoff);
}
