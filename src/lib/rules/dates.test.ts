import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, addDays, cmp, parseISO, toISO } from './dates';

describe('dates', () => {
  it('lastDayOfMonth handles leap years', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
  it('parseISO and toISO round-trip, padding month and day to two digits', () => {
    expect(parseISO('2026-08-09')).toEqual({ y: 2026, m: 8, day: 9 });
    expect(toISO(2026, 1, 2)).toBe('2026-01-02');
    for (const d of ['2026-01-02', '2026-08-09', '2026-12-31', '2024-02-29']) {
      const { y, m, day } = parseISO(d);
      expect(toISO(y, m, day)).toBe(d);
    }
  });
  it('parseISO throws on malformed input instead of yielding NaN', () => {
    expect(() => parseISO('')).toThrow(TypeError);
    expect(() => parseISO('2026')).toThrow(TypeError);
    expect(() => parseISO('2026-8-9')).toThrow(TypeError);
    expect(() => parseISO('09/08/2026')).toThrow(TypeError);
    expect(() => parseISO('2026-08-09T00:00:00Z')).toThrow(TypeError);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('addDays walks back a freshness cutoff (negative offsets)', () => {
    expect(addDays('2026-08-09', -183)).toBe('2026-02-07');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('cmp orders ISO dates', () => {
    expect(cmp('2026-01-02', '2026-01-10')).toBe(-1);
    expect(cmp('2026-01-10', '2026-01-02')).toBe(1);
    expect(cmp('2026-01-02', '2026-01-02')).toBe(0);
  });
});
