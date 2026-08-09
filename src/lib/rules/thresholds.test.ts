import { describe, it, expect } from 'vitest';
import { evaluateThreshold } from './thresholds';
import type { ThresholdRule, BusinessProfile } from './types';

const rule: ThresholdRule = {
  id: 'plafond-test',
  type: 'threshold',
  title: 'Plafond test',
  value: 100_000,
  warn_ratio: 0.8,
  source_url: 'https://www.impots.gouv.fr/accueil',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: {},
};

function profileWith(entries: { month: string; amount: number }[]): BusinessProfile {
  return { legalForm: 'micro', activityCategory: 'vente', lifecyclePhase: 'routine', options: [], revenueEntries: entries };
}

describe('evaluateThreshold', () => {
  it('null below warn ratio', () => {
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 10_000 }]), '2026-08-07')).toBeNull();
  });
  it('warning at exactly the warn ratio', () => {
    const a = evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 80_000 }]), '2026-08-07');
    expect(a).toMatchObject({ level: 'warning', ytd: 80_000 });
    expect(a!.ratio).toBeCloseTo(0.8, 5);
  });
  it('exceeded at exactly the threshold and above', () => {
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 100_000 }]), '2026-08-07')).toMatchObject({ level: 'exceeded', ytd: 100_000 });
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 120_000 }]), '2026-08-07')).toMatchObject({ level: 'exceeded', ytd: 120_000 });
  });
  it('sums multiple entries within the year', () => {
    const a = evaluateThreshold(
      rule,
      profileWith([
        { month: '2026-01', amount: 40_000 },
        { month: '2026-05', amount: 45_000 },
      ]),
      '2026-08-07'
    );
    expect(a).toMatchObject({ level: 'warning', ytd: 85_000 });
    expect(a!.ratio).toBeCloseTo(0.85, 5);
  });
  it('only counts the current calendar year', () => {
    const a = evaluateThreshold(
      rule,
      profileWith([
        { month: '2025-12', amount: 90_000 },
        { month: '2026-01', amount: 10_000 },
      ]),
      '2026-08-07'
    );
    expect(a).toBeNull();
  });
  it('no revenue entries means no alert', () => {
    expect(evaluateThreshold(rule, profileWith([]), '2026-08-07')).toBeNull();
  });

  it('ignores entries from a future year', () => {
    expect(
      evaluateThreshold(rule, profileWith([{ month: '2027-01', amount: 90_000 }]), '2026-08-07')
    ).toBeNull();
  });

  it('ignores a month that only looks like the current year', () => {
    expect(
      evaluateThreshold(rule, profileWith([{ month: '20261-01', amount: 90_000 }]), '2026-08-07')
    ).toBeNull();
  });

  it('reads warn_ratio from the rule instead of assuming 0.8', () => {
    const entries = [{ month: '2026-01', amount: 60_000 }];
    expect(evaluateThreshold({ ...rule, warn_ratio: 0.5 }, profileWith(entries), '2026-08-07')).toMatchObject({
      level: 'warning',
    });
    expect(evaluateThreshold(rule, profileWith(entries), '2026-08-07')).toBeNull();
  });

  // Twelve monthly invoices adding up to exactly the plafond. Summed as floats
  // they come to 188699.99999999997, which reads as 'warning' — telling someone
  // who has reached the limit that they are merely close to it. Cents are exact.
  it('counts money in cents, so landing exactly on the plafond reads as exceeded', () => {
    const months = [
      14396.44, 29337.66, 16922.21, 17340.6, 7800.17, 1056.35, 21135.7, 14996.34, 4660.68, 35772.96,
      15640.15, 9640.74,
    ];
    expect(months.reduce((s, a) => s + a, 0)).toBeLessThan(188_700); // the float trap
    const a = evaluateThreshold(
      { ...rule, value: 188_700 },
      profileWith(months.map((amount, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, amount }))),
      '2026-08-07'
    );
    expect(a).toMatchObject({ level: 'exceeded', ytd: 188_700, ratio: 1 });
  });

  it('throws on a malformed today rather than silently withholding an alert', () => {
    expect(() =>
      evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 150_000 }]), 'garbage')
    ).toThrow(TypeError);
  });
});
