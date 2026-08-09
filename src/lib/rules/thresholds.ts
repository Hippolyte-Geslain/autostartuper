/**
 * Measures a profile's turnover so far this year against a rule's plafond.
 *
 * The French micro thresholds are counted per calendar year and reset on
 * 1 January, so only entries whose month falls in the current year count. Last
 * year's revenue is not carried over — a business that ended December at the
 * limit starts January back at zero.
 *
 * Only the *current* year is measurable here, which is why `today` is passed in
 * rather than read from the clock: the same profile must produce the same
 * answer in a test, on a server, and in a browser in another time zone.
 *
 * Money is summed in integer cents. Euro amounts are decimal, and a plain
 * float sum drifts: a user standing exactly on the plafond can land a hair
 * under it and be told `warning` when they have in fact `exceeded` it. Cents
 * are whole numbers, so the comparison at the boundary is exact.
 */
import type { ThresholdRule, BusinessProfile } from './types';
import { type ISODate, parseISO } from './dates';

/**
 * Where a profile stands against one plafond.
 *
 * Carries `ytd` as well as `ratio` because the two answer different questions
 * and only one is recoverable from the other. A gauge needs the ratio; the
 * sentence beside it ("161 000 € of 188 700 €") needs the euro figure, and
 * rebuilding it as `ratio * value` would reintroduce exactly the float error
 * the cent arithmetic exists to avoid.
 *
 * No rule id: the caller already holds the rule it passed in and can name it
 * itself, so carrying one here would be a copy to keep in step for nothing.
 */
export interface ThresholdAlert {
  /** Revenue counted for the current calendar year, in euros. */
  ytd: number;
  ratio: number;
  level: 'warning' | 'exceeded';
}

/**
 * Year-to-date revenue against `t.value`, or `null` when there is nothing worth
 * telling the user.
 *
 * Two levels, and both boundaries are inclusive on purpose:
 *
 * - `warning` at `ratio >= warn_ratio` — a heads-up *before* the plafond is
 *   crossed, while the user can still act (invoice next month, change regime).
 *   At exactly 80% the heads-up is already due.
 * - `exceeded` at `ratio >= 1` — the plafond has been passed for this calendar
 *   year. At exactly 100% the user *has* reached it, so this is not "about to";
 *   it has happened.
 *
 * Below the warn ratio there is no alert at all: a gauge at 20% is normal
 * business, not news.
 *
 * Dividing is safe — the schema requires `value` positive, so the denominator
 * is at least one cent.
 *
 * @throws {TypeError} if `today` is not `YYYY-MM-DD`. Silently returning `null`
 * on a malformed date would withhold a plafond alert from someone who has
 * crossed it, which is the most expensive thing this module can get wrong — see
 * the contract at the top of `./dates`.
 */
export function evaluateThreshold(
  t: ThresholdRule,
  profile: BusinessProfile,
  today: ISODate
): ThresholdAlert | null {
  parseISO(today);
  const year = today.slice(0, 4);
  // The trailing hyphen matters: `startsWith('2026')` would also swallow a
  // malformed '20261-01'. `RevenueEntry.month` is a plain string with no schema
  // behind it, so this filter is the only thing standing between a typo and a
  // wrong total.
  const ytdCents = profile.revenueEntries
    .filter((e) => e.month.startsWith(`${year}-`))
    .reduce((sum, e) => sum + Math.round(e.amount * 100), 0);
  const valueCents = Math.round(t.value * 100);
  const ratio = ytdCents / valueCents;
  const ytd = ytdCents / 100;
  if (ratio >= 1) return { ytd, ratio, level: 'exceeded' };
  if (ratio >= t.warn_ratio) return { ytd, ratio, level: 'warning' };
  return null;
}
