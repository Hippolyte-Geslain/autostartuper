/**
 * Calendar arithmetic on plain `YYYY-MM-DD` strings.
 *
 * Every function counts in UTC, so a daylight-saving change can never move a
 * result by a day, and nothing here depends on the machine's time zone.
 *
 * **Invalid input is a programming error, so it throws.** Everything reaching
 * these functions has already been through `IsoDateSchema` at parse time, or is
 * a date this code built itself. A malformed string therefore means a bug
 * upstream, not bad data from a user — and the one thing it must never do is
 * quietly become `NaN`, which propagates into dates like `2026-NaN-NaN` and
 * loops that never end. Failing loudly at the boundary keeps that bug where it
 * happened instead of surfacing three modules away.
 *
 * A branded `ISODate` type would let the compiler prove callers validated their
 * input, but it forces a cast at every boundary and buys little while the only
 * producers are the schema and this module. For M1 that is a deliberate no: the
 * runtime guard covers the hazard. Revisit if dates start arriving from more
 * places.
 */

/**
 * The shape of a calendar day. Shared with `types.ts` so the schema and this
 * module can never disagree on what a date looks like.
 *
 * Deliberately unflagged: a `g` flag would make `.test()` stateful and skip
 * every other call.
 */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day written as `YYYY-MM-DD`. */
export type ISODate = string;

/**
 * Splits an ISO day into its numeric parts. `m` is 1-12, not 0-11.
 *
 * @throws {TypeError} if `d` is not `YYYY-MM-DD`.
 */
export function parseISO(d: ISODate): { y: number; m: number; day: number } {
  if (!ISO_DATE.test(d)) throw new TypeError(`expected a YYYY-MM-DD date, got ${JSON.stringify(d)}`);
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

/**
 * The ISO day `n` days after `d`. A negative `n` counts backwards.
 *
 * @throws {TypeError} if `d` is not `YYYY-MM-DD`.
 */
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
