/**
 * Turns a rule's schedule into the concrete days it falls due inside a window.
 *
 * The window is one closed range: a due landing on `from` or on `to` counts.
 * Malformed input throws rather than returning something plausible — see the
 * contract at the top of `./dates`.
 */
import { type ISODate, parseISO, toISO, lastDayOfMonth, cmp } from './dates';
import type { UrssafFrequency } from './types';

/**
 * Every `{ y, m }` from one month to another, inclusive of both.
 *
 * Yields nothing if a bound is not a whole number. `m` is what advances the
 * loop, so a `NaN` bound would leave `y` frozen and spin forever; callers are
 * already guarded by `parseISO`, and this makes that impossible to regress.
 */
function* monthsBetween(
  fromY: number,
  fromM: number,
  toY: number,
  toM: number
): Generator<{ y: number; m: number }> {
  if (![fromY, fromM, toY, toM].every(Number.isInteger)) return;
  let y = fromY;
  let m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    yield { y, m };
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

/**
 * Dues for periodic obligations: the last day of the month following each
 * period end. A monthly period ending in August is due 30 September; a
 * quarterly one ending in September is due 31 October.
 *
 * Only quarter-end months (March, June, September, December) close a quarterly
 * period, so a quarterly schedule yields at most one due per quarter.
 *
 * @returns the dues inside `[from, to]`, ascending, without duplicates. Both
 * ends of the window are inclusive.
 * @throws {TypeError} if `from` or `to` is not `YYYY-MM-DD`.
 */
export function expandPeriodic(
  freq: UrssafFrequency,
  from: ISODate,
  to: ISODate
): ISODate[] {
  const f = parseISO(from);
  const t = parseISO(to);
  // A period in month m is due in month m+1, so the earliest period that can
  // land in the window is from.m - 1. We start one month earlier still, as
  // margin: the extra month can only produce a due before `from`, which the
  // window filter below drops.
  let startY = f.y;
  let startM = f.m - 2;
  while (startM < 1) {
    startM += 12;
    startY--;
  }
  const out: ISODate[] = [];
  for (const { y, m } of monthsBetween(startY, startM, t.y, t.m)) {
    if (freq === 'quarterly' && m % 3 !== 0) continue;
    let dy = y;
    let dm = m + 1;
    if (dm > 12) {
      dm = 1;
      dy++;
    }
    const due = toISO(dy, dm, lastDayOfMonth(dy, dm));
    if (cmp(due, from) >= 0 && cmp(due, to) <= 0) out.push(due);
  }
  return out;
}

/**
 * Dues for a yearly obligation, such as the CFE on 15 December.
 *
 * Takes the schedule whole rather than as two loose numbers, so a caller cannot
 * silently swap the month and the day. `day` is clamped to the length of the
 * month, which only ever matters for a 29 February schedule in a non-leap year:
 * it falls due on 28 February.
 *
 * @returns the dues inside `[from, to]`, ascending, without duplicates. Both
 * ends of the window are inclusive.
 * @throws {RangeError} if the schedule is not a real month and day.
 * @throws {TypeError} if `from` or `to` is not `YYYY-MM-DD`.
 */
export function expandAnnual(
  schedule: { month: number; day: number },
  from: ISODate,
  to: ISODate
): ISODate[] {
  const { month, day } = schedule;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`schedule month must be 1-12, got ${month}`);
  }
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError(`schedule day must be 1 or more, got ${day}`);
  }
  const out: ISODate[] = [];
  for (let y = parseISO(from).y; y <= parseISO(to).y; y++) {
    const d = toISO(y, month, Math.min(day, lastDayOfMonth(y, month)));
    if (cmp(d, from) >= 0 && cmp(d, to) <= 0) out.push(d);
  }
  return out;
}
