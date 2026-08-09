import { describe, it, expect } from 'vitest';
import { expandPeriodic, expandAnnual } from './scheduler';

describe('expandPeriodic', () => {
  it('monthly: due = last day of month following each period', () => {
    expect(expandPeriodic('monthly', '2026-08-07', '2026-11-05')).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
    ]);
  });
  it('quarterly: only quarter-end periods produce dues', () => {
    expect(expandPeriodic('quarterly', '2026-08-07', '2026-11-05')).toEqual(['2026-10-31']);
  });
  it('window boundaries are inclusive', () => {
    expect(expandPeriodic('monthly', '2026-08-31', '2026-08-31')).toEqual(['2026-08-31']);
  });
  it('monthly: crosses a year boundary', () => {
    expect(expandPeriodic('monthly', '2026-11-01', '2027-02-15')).toEqual([
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
    ]);
    // Stretching `to` past 28 February pulls in the due that 15 February cut off.
    expect(expandPeriodic('monthly', '2026-11-01', '2027-02-28')).toEqual([
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ]);
  });
  it('monthly: a window opening mid-January still catches the December period', () => {
    expect(expandPeriodic('monthly', '2026-01-15', '2026-03-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });
  it('quarterly: crosses a year boundary', () => {
    expect(expandPeriodic('quarterly', '2026-11-01', '2027-03-31')).toEqual(['2027-01-31']);
  });
  it('refuses a malformed window instead of looping forever', () => {
    expect(() => expandPeriodic('monthly', '2026', '2027-01-01')).toThrow(TypeError);
    expect(() => expandPeriodic('monthly', '', '2027-01-01')).toThrow(TypeError);
    expect(() => expandPeriodic('monthly', '2026-01-01', 'later')).toThrow(TypeError);
  });
});

describe('expandAnnual', () => {
  it('includes the annual date inside the window', () => {
    expect(expandAnnual({ month: 12, day: 15 }, '2026-10-01', '2027-01-15')).toEqual(['2026-12-15']);
  });
  it('excludes it outside the window', () => {
    expect(expandAnnual({ month: 12, day: 15 }, '2026-08-07', '2026-11-05')).toEqual([]);
  });
  it('spans multiple years', () => {
    expect(expandAnnual({ month: 12, day: 15 }, '2026-01-01', '2028-12-31')).toEqual([
      '2026-12-15',
      '2027-12-15',
      '2028-12-15',
    ]);
  });
  it('clamps Feb 29 to Feb 28 in non-leap years', () => {
    expect(expandAnnual({ month: 2, day: 29 }, '2026-01-01', '2026-12-31')).toEqual(['2026-02-28']);
    expect(expandAnnual({ month: 2, day: 29 }, '2024-01-01', '2024-12-31')).toEqual(['2024-02-29']);
  });
  it('counts a due landing on either end of the window', () => {
    expect(expandAnnual({ month: 12, day: 15 }, '2026-12-15', '2027-06-01')).toEqual(['2026-12-15']);
    expect(expandAnnual({ month: 12, day: 15 }, '2026-01-01', '2026-12-15')).toEqual(['2026-12-15']);
  });
  it('refuses an impossible month rather than inventing a date', () => {
    // What a swapped month/day pair used to look like: day 15 read as a month.
    expect(() => expandAnnual({ month: 15, day: 12 }, '2026-01-01', '2026-12-31')).toThrow(
      RangeError
    );
    expect(() => expandAnnual({ month: 0, day: 12 }, '2026-01-01', '2026-12-31')).toThrow(
      RangeError
    );
    expect(() => expandAnnual({ month: 12, day: 0 }, '2026-01-01', '2026-12-31')).toThrow(
      RangeError
    );
  });
});
