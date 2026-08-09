import { describe, it, expect } from 'vitest';
import { OFFICIAL_SUFFIXES } from './sources';
import {
  IsoDateSchema,
  ObligationSchema,
  RoadmapStepSchema,
  RuleSchema,
  ThresholdSchema,
} from './types';

const base = {
  id: 'test-rule',
  title: 'Test',
  source_url: 'https://entreprendre.service-public.fr/vosdroits/F00000',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: { legal_forms: ['micro'] },
};

const threshold = (overrides: Record<string, unknown> = {}) => ({
  ...base,
  type: 'threshold',
  value: 1,
  ...overrides,
});

const obligation = (overrides: Record<string, unknown> = {}) => ({
  ...base,
  type: 'obligation',
  schedule: { kind: 'periodic' },
  ...overrides,
});

/** Parses and asserts failure, returning the first issue so tests can check path/message. */
function firstIssue(input: unknown) {
  const result = RuleSchema.safeParse(input);
  if (result.success) throw new Error('expected parse to fail, but it succeeded');
  return result.error.issues[0];
}

describe('RuleSchema', () => {
  it('parses an obligation with periodic schedule', () => {
    const r = RuleSchema.parse(obligation());
    expect(r.type).toBe('obligation');
  });

  it('parses an obligation with an annual schedule', () => {
    const r = ObligationSchema.parse(obligation({ schedule: { kind: 'annual', month: 5, day: 20 } }));
    expect(r.schedule).toEqual({ kind: 'annual', month: 5, day: 20 });
  });

  it('keeps an explicit periodic frequency', () => {
    const r = ObligationSchema.parse(obligation({ schedule: { kind: 'periodic', frequency: 'quarterly' } }));
    expect(r.schedule).toEqual({ kind: 'periodic', frequency: 'quarterly' });
  });

  const invalidSchedules: Array<[unknown, string]> = [
    [{ kind: 'annual', month: 13, day: 1 }, 'month above 12'],
    [{ kind: 'annual', month: 0, day: 1 }, 'month below 1'],
    [{ kind: 'annual', month: 6, day: 0 }, 'day below 1'],
    [{ kind: 'annual', month: 6, day: 32 }, 'day above 31'],
    [{ kind: 'annual', month: 6.5, day: 1 }, 'non-integer month'],
    [{ kind: 'annual', month: 6 }, 'missing day'],
    [{ kind: 'periodic', frequency: 'daily' }, 'unknown frequency'],
    [{ kind: 'periodic', frequencyy: 'monthly' }, 'typo key in periodic schedule'],
    [{ kind: 'annual', month: 5, day: 20, dya: 1 }, 'typo key in annual schedule'],
    [{ kind: 'weekly' }, 'unknown schedule kind'],
    [{ kind: 'annual', month: 2, day: 31 }, 'February never has 31 days'],
    [{ kind: 'annual', month: 2, day: 30 }, 'February never has 30 days'],
    [{ kind: 'annual', month: 4, day: 31 }, 'April has 30 days'],
    [{ kind: 'annual', month: 9, day: 31 }, 'September has 30 days'],
  ];

  it.each(invalidSchedules)('rejects schedule %j (%s)', (schedule) => {
    expect(() => RuleSchema.parse(obligation({ schedule }))).toThrow();
  });

  it.each([
    [{ kind: 'annual', month: 2, day: 29 }, 'February 29 stays legal (leap years exist)'],
    [{ kind: 'annual', month: 1, day: 31 }, 'January has 31 days'],
    [{ kind: 'annual', month: 4, day: 30 }, 'April has 30 days'],
  ])('accepts schedule %j (%s)', (schedule) => {
    expect(() => RuleSchema.parse(obligation({ schedule }))).not.toThrow();
  });

  it('reports an impossible month/day pair on the day path', () => {
    const issue = firstIssue(obligation({ schedule: { kind: 'annual', month: 2, day: 31 } }));
    expect(issue.path).toEqual(['schedule', 'day']);
    expect(issue.message).toMatch(/no such day/);
  });

  it('defaults threshold warn_ratio to 0.8', () => {
    const r = ThresholdSchema.parse(threshold({ value: 77700 }));
    expect(r.warn_ratio).toBe(0.8);
  });

  it('keeps an explicit warn_ratio', () => {
    const r = ThresholdSchema.parse(threshold({ value: 77700, warn_ratio: 0.5 }));
    expect(r.warn_ratio).toBe(0.5);
  });

  it.each([
    [0, 'zero is degenerate'],
    [1, 'one is degenerate'],
    [-0.1, 'below range'],
    [1.5, 'above range'],
  ])('rejects warn_ratio %s (%s)', (warn_ratio) => {
    expect(() => RuleSchema.parse(threshold({ warn_ratio }))).toThrow();
  });

  it.each([
    [0, 'zero'],
    [-1, 'negative'],
  ])('rejects threshold value %s (%s)', (value) => {
    expect(() => RuleSchema.parse(threshold({ value }))).toThrow();
  });

  it('parses a roadmap step with empty prerequisites by default', () => {
    const r = RoadmapStepSchema.parse({ ...base, type: 'roadmap_step', phase: 'lancement' });
    expect(r.prerequisites).toEqual([]);
  });

  it('keeps explicit prerequisites', () => {
    const r = RoadmapStepSchema.parse({
      ...base,
      type: 'roadmap_step',
      phase: 'lancement',
      prerequisites: ['immatriculation-siret'],
    });
    expect(r.prerequisites).toEqual(['immatriculation-siret']);
  });

  it.each([
    [['Bad Id'], 'space and uppercase'],
    [[''], 'empty id'],
    [['ok-id', 'BAD_ID'], 'one bad entry among good ones'],
  ])('rejects prerequisites %j (%s)', (prerequisites) => {
    expect(() =>
      RuleSchema.parse({ ...base, type: 'roadmap_step', phase: 'lancement', prerequisites })
    ).toThrow(/lowercase letters, digits and hyphens only/);
  });

  it('rejects an unknown lifecycle phase', () => {
    expect(() => RuleSchema.parse({ ...base, type: 'roadmap_step', phase: 'scaling' })).toThrow();
  });

  it('rejects an unknown rule type', () => {
    expect(() => RuleSchema.parse({ ...base, type: 'reminder' })).toThrow();
  });
});

describe('RuleSchema source_url', () => {
  it('rejects non-official source_url with an explanatory message', () => {
    expect(() => RuleSchema.parse(threshold({ source_url: 'https://example.com/x' }))).toThrow(/official/);
  });

  it('rejects an http source_url', () => {
    expect(() => RuleSchema.parse(threshold({ source_url: 'http://www.impots.gouv.fr/x' }))).toThrow(/official/);
  });

  it('reports the failure on the source_url path', () => {
    const issue = firstIssue(threshold({ source_url: 'https://example.com/x' }));
    expect(issue.path).toEqual(['source_url']);
    expect(issue.message).toMatch(/official/);
  });

  it.each([...OFFICIAL_SUFFIXES])('accepts a source_url on %s', (suffix) => {
    expect(() => RuleSchema.parse(threshold({ source_url: `https://www.${suffix}/x` }))).not.toThrow();
  });
});

describe('RuleSchema dates', () => {
  it('exports IsoDateSchema', () => {
    expect(IsoDateSchema.parse('2026-08-07')).toBe('2026-08-07');
    expect(IsoDateSchema.safeParse('2026-02-30').success).toBe(false);
  });

  it.each([
    ['07/08/2026', 'wrong separator and order'],
    ['2026-8-7', 'unpadded month and day'],
    ['26-08-07', 'two-digit year'],
    ['2026-08-07T00:00:00Z', 'datetime, not a date'],
    ['', 'empty'],
  ])('rejects verified_on %s (%s)', (verified_on) => {
    expect(() => RuleSchema.parse(threshold({ verified_on }))).toThrow();
  });

  it.each([
    ['2025-13-45', 'month 13 and day 45'],
    ['2026-02-30', 'February 30 does not exist'],
    ['2025-02-29', '2025 is not a leap year'],
    ['2025-04-31', 'April has 30 days'],
    ['2025-00-10', 'month zero'],
    ['2025-01-00', 'day zero'],
  ])('rejects calendar-invalid date %s (%s)', (verified_on) => {
    expect(() => RuleSchema.parse(threshold({ verified_on }))).toThrow();
  });

  it('accepts a real leap day', () => {
    expect(() => RuleSchema.parse(threshold({ verified_on: '2024-02-29' }))).not.toThrow();
  });

  it('reports a bad verified_on on its own path', () => {
    const issue = firstIssue(threshold({ verified_on: '07/08/2026' }));
    expect(issue.path).toEqual(['verified_on']);
  });

  it('reports exactly one issue for a malformed date, not format plus calendar', () => {
    const result = RuleSchema.safeParse(threshold({ verified_on: '07/08/2026' }));
    if (result.success) throw new Error('expected parse to fail, but it succeeded');
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].message).toMatch(/YYYY-MM-DD/);
  });

  it('reports the calendar issue when the format is fine', () => {
    const issue = firstIssue(threshold({ verified_on: '2026-02-30' }));
    expect(issue.message).toMatch(/calendar/);
  });

  it('rejects a bad valid_from', () => {
    const issue = firstIssue(threshold({ valid_from: '01/01/2025' }));
    expect(issue.path).toEqual(['valid_from']);
  });

  it('rejects a bad valid_until', () => {
    const issue = firstIssue(threshold({ valid_until: '2025-99-99' }));
    expect(issue.path).toEqual(['valid_until']);
  });

  it('accepts a well-ordered millesime', () => {
    expect(() =>
      RuleSchema.parse(threshold({ valid_from: '2025-01-01', valid_until: '2025-12-31' }))
    ).not.toThrow();
  });

  it('accepts valid_until equal to valid_from', () => {
    expect(() =>
      RuleSchema.parse(threshold({ valid_from: '2025-01-01', valid_until: '2025-01-01' }))
    ).not.toThrow();
  });

  it('rejects an inverted millesime on the valid_until path', () => {
    const issue = firstIssue(threshold({ valid_from: '2025-01-01', valid_until: '2024-12-31' }));
    expect(issue.path).toEqual(['valid_until']);
    expect(issue.message).toMatch(/valid_from/);
  });
});

describe('RuleSchema id', () => {
  it.each([
    ['test-rule', 'lowercase with hyphen'],
    ['rule2', 'digits'],
    ['micro-ca-threshold-2025', 'long slug'],
  ])('accepts id %s (%s)', (id) => {
    expect(() => RuleSchema.parse(threshold({ id }))).not.toThrow();
  });

  it.each([
    ['test rule', 'space'],
    ['TEST-RULE', 'uppercase'],
    ['test_rule', 'underscore'],
    ['test.rule', 'dot'],
    ['', 'empty'],
  ])('rejects id %s (%s)', (id) => {
    expect(() => RuleSchema.parse(threshold({ id }))).toThrow();
  });
});

describe('RuleSchema title', () => {
  it('trims surrounding whitespace', () => {
    const r = ThresholdSchema.parse(threshold({ title: '  Test  ' }));
    expect(r.title).toBe('Test');
  });

  it.each([
    ['', 'empty'],
    ['   ', 'spaces only'],
    ['\t\n', 'tabs and newlines only'],
  ])('rejects title %j (%s)', (title) => {
    expect(() => RuleSchema.parse(threshold({ title }))).toThrow();
  });
});

describe('RuleSchema strictness', () => {
  it('rejects an unknown top-level key on a threshold', () => {
    expect(() => RuleSchema.parse(threshold({ warn_ratioo: 0.9 }))).toThrow();
  });

  it('rejects an unknown top-level key on an obligation', () => {
    expect(() => RuleSchema.parse(obligation({ scheduleee: { kind: 'periodic' } }))).toThrow();
  });

  it('rejects an unknown top-level key on a roadmap step', () => {
    expect(() =>
      RuleSchema.parse({
        ...base,
        type: 'roadmap_step',
        phase: 'lancement',
        prerequisitess: [],
      })
    ).toThrow();
  });

  it('rejects an unknown applies_to key', () => {
    expect(() => RuleSchema.parse(threshold({ applies_to: { legal_form: ['micro'] } }))).toThrow();
  });

  it('rejects an unknown legal form', () => {
    expect(() => RuleSchema.parse(threshold({ applies_to: { legal_forms: ['sarl'] } }))).toThrow();
  });

  it('rejects an unknown activity category', () => {
    expect(() =>
      RuleSchema.parse(threshold({ applies_to: { activity_categories: ['vente-bic'] } }))
    ).toThrow();
  });

  // `[]` is never what an author means: an empty membership list matches
  // nobody, an empty options list constrains nothing. Both fail silently, so
  // the schema rejects them and points at the fix.
  const emptyLists: Array<[string, string]> = [
    ['legal_forms', 'membership list'],
    ['activity_categories', 'membership list'],
    ['lifecycle_phases', 'membership list'],
    ['options_all', 'options list'],
    ['options_none', 'options list'],
  ];

  it.each(emptyLists)('rejects the empty array in %s (%s)', (field) => {
    const issue = firstIssue(threshold({ applies_to: { [field]: [] } }));
    expect(issue.path).toEqual(['applies_to', field]);
    expect(issue.message).toMatch(/omit the field entirely/);
  });

  it('accepts applies_to with no conditions at all', () => {
    expect(() => RuleSchema.parse(threshold({ applies_to: {} }))).not.toThrow();
  });
});

describe('AppliesTo options vocabulary', () => {
  it('accepts known options', () => {
    expect(() =>
      RuleSchema.parse(
        threshold({ applies_to: { options_all: ['acre'], options_none: ['versement-liberatoire'] } })
      )
    ).not.toThrow();
  });

  const invalidOptions: Array<[unknown, string]> = [
    [{ options_all: ['acr'] }, 'typo in options_all'],
    [{ options_none: ['acre-2025'] }, 'unknown option in options_none'],
    [{ options_all: ['ACRE'] }, 'wrong case'],
  ];

  it.each(invalidOptions)('rejects %j (%s)', (applies_to) => {
    expect(() => RuleSchema.parse(threshold({ applies_to }))).toThrow();
  });
});
