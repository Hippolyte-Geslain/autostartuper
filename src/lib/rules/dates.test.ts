import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, addDays, cmp } from './dates';

describe('dates', () => {
  it('lastDayOfMonth handles leap years', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('addDays handles negative offsets', () => {
    expect(addDays('2026-08-09', -183)).toBe('2026-02-07');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('cmp orders ISO dates', () => {
    expect(cmp('2026-01-02', '2026-01-10')).toBe(-1);
    expect(cmp('2026-01-10', '2026-01-02')).toBe(1);
    expect(cmp('2026-01-02', '2026-01-02')).toBe(0);
  });
});
