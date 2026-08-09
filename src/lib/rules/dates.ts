/**
 * Calendar arithmetic on plain `YYYY-MM-DD` strings.
 *
 * Every function counts in UTC, so a daylight-saving change can never move a
 * result by a day, and nothing here depends on the machine's time zone.
 */

/** A calendar day written as `YYYY-MM-DD`. */
export type ISODate = string;

/** Splits an ISO day into its numeric parts. `m` is 1-12, not 0-11. */
export function parseISO(d: ISODate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}

/** Builds an ISO day from numeric parts, padding month and day to two digits. */
export function toISO(y: number, m: number, day: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * How many days month `m` of year `y` has. `m` is 1-12.
 *
 * Day 0 of the next month is the last day of this one, which gets leap years
 * right without spelling out the rule.
 */
export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The ISO day `n` days after `d`. A negative `n` counts backwards. */
export function addDays(d: ISODate, n: number): ISODate {
  const { y, m, day } = parseISO(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * Orders two ISO days: -1 if `a` is earlier, 1 if later, 0 if the same day.
 *
 * Fixed-width ISO dates sort correctly as plain strings, so no parsing is needed.
 */
export function cmp(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
