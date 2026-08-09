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
    expect(a).toMatchObject({ level: 'warning' });
    expect(a!.ratio).toBeCloseTo(0.8, 5);
  });
  it('exceeded at exactly the threshold and above', () => {
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 100_000 }]), '2026-08-07')).toMatchObject({ level: 'exceeded' });
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 120_000 }]), '2026-08-07')).toMatchObject({ level: 'exceeded' });
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
    expect(a).toMatchObject({ level: 'warning' });
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
});
