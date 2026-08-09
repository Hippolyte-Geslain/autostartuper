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
});

describe('expandAnnual', () => {
  it('includes the annual date inside the window', () => {
    expect(expandAnnual(12, 15, '2026-10-01', '2027-01-15')).toEqual(['2026-12-15']);
  });
  it('excludes it outside the window', () => {
    expect(expandAnnual(12, 15, '2026-08-07', '2026-11-05')).toEqual([]);
  });
  it('spans multiple years', () => {
    expect(expandAnnual(12, 15, '2026-01-01', '2028-12-31')).toEqual([
      '2026-12-15',
      '2027-12-15',
      '2028-12-15',
    ]);
  });
  it('clamps Feb 29 to Feb 28 in non-leap years', () => {
    expect(expandAnnual(2, 29, '2026-01-01', '2026-12-31')).toEqual(['2026-02-28']);
    expect(expandAnnual(2, 29, '2024-01-01', '2024-12-31')).toEqual(['2024-02-29']);
  });
});
