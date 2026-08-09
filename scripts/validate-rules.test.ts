import { describe, it, expect } from 'vitest';
import { minimumFrom, UsageError } from './validate-rules';

describe('minimumFrom', () => {
  it('defaults to no minimum', () => {
    expect(minimumFrom([])).toBe(0);
  });

  it('reads a value given as a separate argument', () => {
    expect(minimumFrom(['--min', '9'])).toBe(9);
  });

  it('reads a value given with an equals sign', () => {
    expect(minimumFrom(['--min=9'])).toBe(9);
  });

  it('accepts an explicit zero', () => {
    expect(minimumFrom(['--min=0'])).toBe(0);
  });

  it('reports help before anything else', () => {
    expect(minimumFrom(['--help'])).toBe('help');
    expect(minimumFrom(['-h'])).toBe('help');
    expect(minimumFrom(['--min', '9', '--help'])).toBe('help');
  });

  it('refuses an unknown argument instead of ignoring it', () => {
    // The typo that matters: --mim would leave the gate disarmed.
    expect(() => minimumFrom(['--mim', '9'])).toThrow(UsageError);
    expect(() => minimumFrom(['--mim', '9'])).toThrow("unknown argument '--mim'");
  });

  it('refuses a missing value', () => {
    expect(() => minimumFrom(['--min'])).toThrow(UsageError);
  });

  it('refuses an empty value', () => {
    // Number('') is 0, which would silently disable the check.
    expect(() => minimumFrom(['--min', ''])).toThrow(UsageError);
    expect(() => minimumFrom(['--min='])).toThrow(UsageError);
  });

  it('refuses a value that is not a whole count', () => {
    expect(() => minimumFrom(['--min', 'abc'])).toThrow("--min expects a whole number, got 'abc'");
    expect(() => minimumFrom(['--min', '1.5'])).toThrow(UsageError);
    expect(() => minimumFrom(['--min', '-1'])).toThrow(UsageError);
  });

  it('does not mistake a negative value for another argument', () => {
    expect(() => minimumFrom(['--min', '-1'])).toThrow("got '-1'");
  });
});
