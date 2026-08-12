import { describe, it, expect } from 'vitest';
import { RevenueEntrySchema, BusinessProfileSchema, IsoMonthSchema } from './schema';

const validProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: ['acre'],
  urssafFrequency: 'monthly',
  revenueEntries: [{ month: '2026-01', amount: 1200.5 }],
};

describe('IsoMonthSchema', () => {
  it('accepts a real month', () => {
    expect(IsoMonthSchema.parse('2026-01')).toBe('2026-01');
  });

  it.each(['2026-1', '2026-13', '2026-00', '202601', '2026-01-01', ''])(
    'rejects %o',
    (bad) => {
      expect(IsoMonthSchema.safeParse(bad).success).toBe(false);
    }
  );
});

describe('RevenueEntrySchema', () => {
  it('accepts a month and a euro amount', () => {
    expect(RevenueEntrySchema.parse({ month: '2026-03', amount: 0 })).toEqual({
      month: '2026-03',
      amount: 0,
    });
  });

  it('rejects a negative amount', () => {
    // A refund is not negative turnover; correcting the month's figure is.
    expect(RevenueEntrySchema.safeParse({ month: '2026-03', amount: -1 }).success).toBe(false);
  });

  it('rejects a non-finite amount', () => {
    expect(RevenueEntrySchema.safeParse({ month: '2026-03', amount: Infinity }).success).toBe(
      false
    );
  });

  it('rejects sub-cent precision rather than silently rounding it', () => {
    expect(RevenueEntrySchema.safeParse({ month: '2026-03', amount: 10.005 }).success).toBe(false);
    expect(RevenueEntrySchema.safeParse({ month: '2026-03', amount: 10.01 }).success).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(
      RevenueEntrySchema.safeParse({ month: '2026-03', amount: 1, note: 'x' }).success
    ).toBe(false);
  });
});

describe('BusinessProfileSchema', () => {
  it('accepts a complete profile', () => {
    expect(BusinessProfileSchema.parse(validProfile)).toEqual(validProfile);
  });

  it('defaults the collections so a fresh profile needs no boilerplate', () => {
    const p = BusinessProfileSchema.parse({
      legalForm: 'micro',
      activityCategory: 'service-bnc',
      lifecyclePhase: 'idee',
    });
    expect(p.options).toEqual([]);
    expect(p.revenueEntries).toEqual([]);
    expect(p.urssafFrequency).toBeUndefined();
  });

  it('rejects an unknown legal form instead of matching nothing later', () => {
    expect(
      BusinessProfileSchema.safeParse({ ...validProfile, legalForm: 'sarl' }).success
    ).toBe(false);
  });

  it('rejects duplicate months, which would double-count revenue', () => {
    const r = BusinessProfileSchema.safeParse({
      ...validProfile,
      revenueEntries: [
        { month: '2026-01', amount: 10 },
        { month: '2026-01', amount: 20 },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error.issues[0].message).toMatch(/2026-01/);
  });

  it('rejects a duplicate option', () => {
    expect(
      BusinessProfileSchema.safeParse({ ...validProfile, options: ['acre', 'acre'] }).success
    ).toBe(false);
  });

  it('accepts an optional siren of nine digits and rejects anything else', () => {
    expect(BusinessProfileSchema.parse({ ...validProfile, siren: '830141321' }).siren).toBe(
      '830141321'
    );
    expect(BusinessProfileSchema.safeParse({ ...validProfile, siren: '83014132' }).success).toBe(
      false
    );
  });

  it('rejects a registration date that is not a real calendar date', () => {
    expect(
      BusinessProfileSchema.safeParse({ ...validProfile, registeredOn: '2026-02-30' }).success
    ).toBe(false);
  });

  it('produces a profile the engine accepts', async () => {
    const { computeActions } = await import('../rules/engine');
    const { loadRules } = await import('../rules/loader');
    const profile = BusinessProfileSchema.parse(validProfile);
    expect(() => computeActions(loadRules('rules'), profile, { today: '2026-08-07' })).not.toThrow();
  });
});
