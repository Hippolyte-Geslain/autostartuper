import { describe, it, expect } from 'vitest';
import { impliesAppliesTo, findUnsatisfiablePrerequisites } from './satisfiability';
import { RuleSchema, type Rule, type AppliesTo } from './types';
import { loadRules } from './loader';

function step(overrides: Partial<Record<string, unknown>> = {}): Rule {
  return RuleSchema.parse({
    id: 'a-step',
    type: 'roadmap_step',
    title: 'Une démarche',
    phase: 'lancement',
    applies_to: {},
    source_url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F00001',
    verified_on: '2026-01-01',
    valid_from: '2025-01-01',
    ...overrides,
  });
}

const OPEN: AppliesTo = {};

describe('impliesAppliesTo', () => {
  it('an unconstrained prerequisite accepts everyone', () => {
    expect(impliesAppliesTo({ legal_forms: ['micro'] }, OPEN)).toBe(true);
  });

  it('identical conditions imply each other', () => {
    expect(impliesAppliesTo({ legal_forms: ['micro'] }, { legal_forms: ['micro'] })).toBe(true);
  });

  it('a narrower dependent is fine inside a broader prerequisite', () => {
    expect(
      impliesAppliesTo({ legal_forms: ['micro'] }, { legal_forms: ['micro', 'ei'] })
    ).toBe(true);
  });

  it('rejects a prerequisite narrower than its dependent', () => {
    // Shown to micro and EI, but the prerequisite only ever reaches micro.
    expect(
      impliesAppliesTo({ legal_forms: ['micro', 'ei'] }, { legal_forms: ['micro'] })
    ).toBe(false);
  });

  it('rejects an unconstrained dependent under a constrained prerequisite', () => {
    expect(impliesAppliesTo(OPEN, { legal_forms: ['micro'] })).toBe(false);
  });

  it('rejects disjoint conditions', () => {
    expect(impliesAppliesTo({ legal_forms: ['micro'] }, { legal_forms: ['sasu'] })).toBe(false);
  });

  it('checks every membership field, not just the first', () => {
    expect(
      impliesAppliesTo(
        { legal_forms: ['micro'], activity_categories: ['vente', 'service-bic'] },
        { legal_forms: ['micro'], activity_categories: ['vente'] }
      )
    ).toBe(false);
    expect(
      impliesAppliesTo({ lifecycle_phases: ['routine'] }, { lifecycle_phases: ['idee'] })
    ).toBe(false);
  });

  it('requires the dependent to demand every option the prerequisite demands', () => {
    expect(impliesAppliesTo({ options_all: ['acre'] }, { options_all: ['acre'] })).toBe(true);
    // Anyone without ACRE sees the step but never its prerequisite.
    expect(impliesAppliesTo(OPEN, { options_all: ['acre'] })).toBe(false);
  });

  it('requires the dependent to exclude every option the prerequisite excludes', () => {
    expect(impliesAppliesTo({ options_none: ['acre'] }, { options_none: ['acre'] })).toBe(true);
    expect(impliesAppliesTo(OPEN, { options_none: ['acre'] })).toBe(false);
  });
});

describe('findUnsatisfiablePrerequisites', () => {
  it('accepts a prerequisite that reaches everyone its dependent reaches', () => {
    const rules = [
      step({ id: 'first', applies_to: {} }),
      step({ id: 'second', applies_to: { legal_forms: ['micro'] }, prerequisites: ['first'] }),
    ];
    expect(findUnsatisfiablePrerequisites(rules)).toEqual([]);
  });

  it('catches a prerequisite that excludes some of its dependent’s users', () => {
    const rules = [
      step({ id: 'first', applies_to: { legal_forms: ['sasu'] } }),
      step({ id: 'second', applies_to: { legal_forms: ['micro'] }, prerequisites: ['first'] }),
    ];
    const problems = findUnsatisfiablePrerequisites(rules);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/blocked forever/);
  });

  it('catches a prerequisite sitting in a later phase', () => {
    const rules = [
      step({ id: 'later', phase: 'routine' }),
      step({ id: 'earlier', phase: 'lancement', prerequisites: ['later'] }),
    ];
    expect(findUnsatisfiablePrerequisites(rules).join(' ')).toMatch(/later phase/);
  });

  it('allows a prerequisite in an earlier phase', () => {
    const rules = [
      step({ id: 'early', phase: 'idee' }),
      step({ id: 'late', phase: 'lancement', prerequisites: ['early'] }),
    ];
    expect(findUnsatisfiablePrerequisites(rules)).toEqual([]);
  });

  it('stays quiet about prerequisites the loader already rejects', () => {
    const rules = [step({ id: 'orphan', prerequisites: ['does-not-exist'] })];
    expect(findUnsatisfiablePrerequisites(rules)).toEqual([]);
  });
});

describe('the shipped rules', () => {
  it('declare no unsatisfiable prerequisite', () => {
    expect(findUnsatisfiablePrerequisites(loadRules('rules'))).toEqual([]);
  });
});
