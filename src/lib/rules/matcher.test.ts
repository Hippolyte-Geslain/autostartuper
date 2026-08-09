import { describe, it, expect } from 'vitest';
import { appliesTo, activeOn } from './matcher';
import { ThresholdSchema, type BusinessProfile, type Millesime } from './types';

const profile: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'lancement',
  options: ['acre'],
  revenueEntries: [],
};

describe('appliesTo', () => {
  it('empty conditions match everyone', () => {
    expect(appliesTo({}, profile)).toBe(true);
  });
  it('filters by legal form', () => {
    expect(appliesTo({ legal_forms: ['micro'] }, profile)).toBe(true);
    expect(appliesTo({ legal_forms: ['eurl', 'sasu'] }, profile)).toBe(false);
  });
  it('filters by activity category', () => {
    expect(appliesTo({ activity_categories: ['service-bnc'] }, profile)).toBe(true);
    expect(appliesTo({ activity_categories: ['vente'] }, profile)).toBe(false);
  });
  it('filters by lifecycle phase', () => {
    expect(appliesTo({ lifecycle_phases: ['lancement'] }, profile)).toBe(true);
    expect(appliesTo({ lifecycle_phases: ['routine'] }, profile)).toBe(false);
  });
  it('options_all requires every option', () => {
    expect(appliesTo({ options_all: ['acre'] }, profile)).toBe(true);
    expect(appliesTo({ options_all: ['acre', 'versement-liberatoire'] }, profile)).toBe(false);
  });
  it('options_none excludes holders of the option', () => {
    expect(appliesTo({ options_none: ['acre'] }, profile)).toBe(false);
    expect(appliesTo({ options_none: ['versement-liberatoire'] }, profile)).toBe(true);
    // Holding ANY listed option excludes, not all of them: options_none is a
    // some(), and this profile holds only the first of the two.
    expect(appliesTo({ options_none: ['acre', 'versement-liberatoire'] }, profile)).toBe(false);
  });
  it('all present conditions must hold together', () => {
    expect(appliesTo({ legal_forms: ['micro'], options_none: ['acre'] }, profile)).toBe(false);
    expect(appliesTo({ legal_forms: ['micro'], options_all: ['acre'] }, profile)).toBe(true);
  });
});

describe('activeOn (millésime)', () => {
  const base: Millesime = { valid_from: '2025-01-01' };
  it('active from valid_from, no end', () => {
    expect(activeOn(base, '2026-08-07')).toBe(true);
    expect(activeOn(base, '2025-01-01')).toBe(true);
    expect(activeOn(base, '2024-12-31')).toBe(false);
  });
  it('inactive after valid_until, inclusive on the end date', () => {
    expect(activeOn({ ...base, valid_until: '2025-12-31' }, '2026-08-07')).toBe(false);
    expect(activeOn({ ...base, valid_until: '2026-12-31' }, '2026-08-07')).toBe(true);
    expect(activeOn({ ...base, valid_until: '2026-08-07' }, '2026-08-07')).toBe(true);
  });

  // The engine calls activeOn(rule, today) on whole parsed rules, never on a
  // hand-built {valid_from, valid_until}. Pinned here so a future change to
  // where rules carry their millésime breaks this test, not the engine.
  it('accepts a whole parsed rule', () => {
    const rule = ThresholdSchema.parse({
      id: 'micro-bnc-threshold-2025',
      title: 'Plafond micro-BNC',
      source_url: 'https://entreprendre.service-public.fr/vosdroits/F00000',
      verified_on: '2026-08-07',
      valid_from: '2025-01-01',
      valid_until: '2025-12-31',
      applies_to: { legal_forms: ['micro'] },
      type: 'threshold',
      value: 77700,
    });
    expect(activeOn(rule, '2025-06-15')).toBe(true);
    expect(activeOn(rule, '2026-08-07')).toBe(false);
  });
});
