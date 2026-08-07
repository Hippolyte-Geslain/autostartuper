import { describe, it, expect } from 'vitest';
import { RuleSchema } from './types';

const base = {
  id: 'test-rule',
  title: 'Test',
  source_url: 'https://entreprendre.service-public.fr/vosdroits/F00000',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: { legal_forms: ['micro'] },
};

describe('RuleSchema', () => {
  it('parses an obligation with periodic schedule', () => {
    const r = RuleSchema.parse({ ...base, type: 'obligation', schedule: { kind: 'periodic' } });
    expect(r.type).toBe('obligation');
  });
  it('defaults threshold warn_ratio to 0.8', () => {
    const r = RuleSchema.parse({ ...base, type: 'threshold', value: 77700 });
    if (r.type === 'threshold') expect(r.warn_ratio).toBe(0.8);
  });
  it('parses a roadmap step with empty prerequisites by default', () => {
    const r = RuleSchema.parse({ ...base, type: 'roadmap_step', phase: 'lancement' });
    if (r.type === 'roadmap_step') expect(r.prerequisites).toEqual([]);
  });
  it('rejects non-official source_url', () => {
    expect(() =>
      RuleSchema.parse({ ...base, type: 'threshold', value: 1, source_url: 'https://example.com/x' })
    ).toThrow();
  });
  it('rejects bad date format', () => {
    expect(() =>
      RuleSchema.parse({ ...base, type: 'threshold', value: 1, verified_on: '07/08/2026' })
    ).toThrow();
  });
});
