import { describe, it, expect } from 'vitest';
import { STALE_AFTER_DAYS, futureVerifications, staleVerifications } from './freshness';
import type { LoadedRule } from './loader';

/** A minimal loaded rule that differs only by the date it was verified on. */
const verified = (id: string, verified_on: string): LoadedRule => ({
  file: `${id}.yaml`,
  rule: {
    id,
    type: 'threshold',
    title: 'Seuil',
    source_url: 'https://www.impots.gouv.fr/accueil',
    verified_on,
    valid_from: '2025-01-01',
    applies_to: {},
    value: 100,
    warn_ratio: 0.8,
  },
});

const ids = (rules: LoadedRule[]): string[] => rules.map((r) => r.rule.id);

// 2026-08-09 minus 182 / 183 / 184 days. Spans a non-leap February, so the
// boundary cannot be reproduced by a naive "six months back" shortcut.
const TODAY = '2026-08-09';
const DAYS_182 = '2026-02-08';
const DAYS_183 = '2026-02-07';
const DAYS_184 = '2026-02-06';

describe('STALE_AFTER_DAYS', () => {
  it('is six months', () => {
    expect(STALE_AFTER_DAYS).toBe(183);
  });
});

describe('staleVerifications', () => {
  it('flags a rule verified more than 183 days ago', () => {
    expect(ids(staleVerifications([verified('vieux', DAYS_184)], TODAY))).toEqual(['vieux']);
  });

  it('leaves a rule verified exactly 183 days ago alone', () => {
    expect(staleVerifications([verified('pile', DAYS_183)], TODAY)).toEqual([]);
  });

  it('leaves a rule verified 182 days ago alone', () => {
    expect(staleVerifications([verified('frais', DAYS_182)], TODAY)).toEqual([]);
  });

  it('leaves today and future verifications alone', () => {
    const rules = [verified('aujourdhui', TODAY), verified('demain', '2026-08-10')];
    expect(staleVerifications(rules, TODAY)).toEqual([]);
  });

  it('keeps the boundary exact across a daylight-saving change', () => {
    // 2026-03-30 is the day after the European clocks go forward. Counting in
    // local time would slip the cutoff by a day; counting in UTC does not.
    expect(staleVerifications([verified('pile', '2025-09-28')], '2026-03-30')).toEqual([]);
    expect(ids(staleVerifications([verified('vieux', '2025-09-27')], '2026-03-30'))).toEqual([
      'vieux',
    ]);
  });

  it('returns every stale rule, in the order given', () => {
    const rules = [verified('a', DAYS_184), verified('b', DAYS_182), verified('c', '2024-01-01')];
    expect(ids(staleVerifications(rules, TODAY))).toEqual(['a', 'c']);
  });

  it('accepts an empty set', () => {
    expect(staleVerifications([], TODAY)).toEqual([]);
  });
});

describe('futureVerifications', () => {
  it('flags a rule verified after today', () => {
    expect(ids(futureVerifications([verified('demain', '2026-08-10')], TODAY))).toEqual(['demain']);
  });

  it('accepts a rule verified today', () => {
    expect(futureVerifications([verified('aujourdhui', TODAY)], TODAY)).toEqual([]);
  });

  it('accepts a rule verified in the past', () => {
    expect(futureVerifications([verified('hier', '2026-08-08')], TODAY)).toEqual([]);
  });

  it('accepts an empty set', () => {
    expect(futureVerifications([], TODAY)).toEqual([]);
  });
});
