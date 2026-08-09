import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  it('refuses a repeated --min rather than picking a winner', () => {
    expect(() => minimumFrom(['--min', '9', '--min', '3'])).toThrow('--min given more than once');
    expect(() => minimumFrom(['--min=9', '--min=3'])).toThrow(UsageError);
    expect(() => minimumFrom(['--min', '9', '--min=9'])).toThrow(UsageError);
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

describe('the script as CI runs it', () => {
  const SCRIPT = fileURLToPath(new URL('./validate-rules.ts', import.meta.url));

  // Every other test here imports the module, which deliberately does nothing
  // on import. Only spawning it proves the entry point still fires at all: if
  // the guard around it ever stops matching the runtime, this is what notices.
  it('fails the build and says why', { timeout: 120_000 }, () => {
    // One command string rather than an args array: with `shell` the two are
    // equivalent, but the array form is deprecated (DEP0190) and would print a
    // warning on every CI run.
    const result = spawnSync(`npx tsx "${SCRIPT}" --min 999999`, {
      shell: true,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('too few rules');
  });
});
