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
 */
import type { ThresholdRule, BusinessProfile } from './types';
import type { ISODate } from './dates';

/**
 * Where a profile stands against one plafond. Reported as a ratio rather than a
 * remaining amount so the UI can drive a gauge without redoing the division.
 */
export interface ThresholdAlert {
  thresholdId: string;
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
 * Dividing by `t.value` is safe — the schema requires it positive.
 */
export function evaluateThreshold(
  t: ThresholdRule,
  profile: BusinessProfile,
  today: ISODate
): ThresholdAlert | null {
  const year = today.slice(0, 4);
  const ytd = profile.revenueEntries
    .filter((e) => e.month.startsWith(year))
    .reduce((s, e) => s + e.amount, 0);
  const ratio = ytd / t.value;
  if (ratio >= 1) return { thresholdId: t.id, ratio, level: 'exceeded' };
  if (ratio >= t.warn_ratio) return { thresholdId: t.id, ratio, level: 'warning' };
  return null;
}
