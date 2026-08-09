/**
 * Turns a rule's schedule into the concrete days it falls due inside a window.
 *
 * Both windows are inclusive on each end, and every returned day is in order.
 */
import { type ISODate, parseISO, toISO, lastDayOfMonth, cmp } from './dates';

/** Every `{ y, m }` from one month to another, inclusive of both. */
function* monthsBetween(fromY: number, fromM: number, toY: number, toM: number) {
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
 * Only quarter-end months (March, June, September, December) start a quarterly
 * period's countdown, so a quarterly schedule yields at most one due per quarter.
 */
export function expandPeriodic(
  freq: 'monthly' | 'quarterly',
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const f = parseISO(from);
  const t = parseISO(to);
  // Look back 2 months so dues falling shortly after `from` are not missed:
  // a due on `from` itself belongs to the period one month earlier.
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
 * `day` is clamped to the length of the month, which only ever matters for a
 * 29 February schedule in a non-leap year: it falls due on 28 February.
 */
export function expandAnnual(
  month: number,
  day: number,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const out: ISODate[] = [];
  for (let y = parseISO(from).y; y <= parseISO(to).y; y++) {
    const d = toISO(y, month, Math.min(day, lastDayOfMonth(y, month)));
    if (cmp(d, from) >= 0 && cmp(d, to) <= 0) out.push(d);
  }
  return out;
}
