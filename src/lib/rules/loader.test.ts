import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadRules } from './loader';

const FIX = join(__dirname, '__fixtures__');

describe('loadRules', () => {
  it('loads and validates a directory of YAML rules', () => {
    const rules = loadRules(join(FIX, 'rules-valid'));
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('ok-obligation');
  });
  it('throws with the offending file path on invalid rule', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/bad-source\.yaml/);
  });
  it('throws on duplicate ids', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/duplicated-id/);
  });
  it('throws on prerequisites referencing unknown rule ids', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/ghost-step/);
  });
  it('throws with the offending file path on malformed YAML', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/malformed\.yaml/);
  });
  it('throws on prerequisite cycles, naming the rules involved', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/cycle/);
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/cycle-a -> cycle-b -> cycle-a/);
  });
});
