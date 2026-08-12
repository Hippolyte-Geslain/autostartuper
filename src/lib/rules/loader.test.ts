import { describe, it, expect, onTestFinished } from 'vitest';
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRules, loadRulesWithFiles, validateRuleGraph } from './loader';
import type { LoadedRule } from './loader';

const FIX = join(__dirname, '__fixtures__');
const INVALID = join(FIX, 'rules-invalid');

/** The message `loadRules` threw, or a failure if it wrongly succeeded. */
function loadError(dir: string): string {
  try {
    loadRules(dir);
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error(`expected loadRules('${dir}') to throw`);
}

/** The bulleted problems in an error message, ignoring continuation lines. */
const problems = (message: string): string[] =>
  message.split('\n').filter((line) => line.startsWith('- '));

const shared = {
  title: 'Titre',
  source_url: 'https://www.impots.gouv.fr/accueil',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: {},
};

const step = (id: string, prerequisites: string[] = []): LoadedRule => ({
  file: `${id}.yaml`,
  rule: { ...shared, id, type: 'roadmap_step', phase: 'lancement', prerequisites },
});

const threshold = (id: string): LoadedRule => ({
  file: `${id}.yaml`,
  rule: { ...shared, id, type: 'threshold', value: 100, warn_ratio: 0.8 },
});

describe('loadRules', () => {
  it('loads and validates a directory of YAML rules', () => {
    const rules = loadRules(join(FIX, 'rules-valid'));
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('ok-obligation');
  });

  it('descends subdirectories, accepts .yml, and skips non-YAML files', () => {
    const rules = loadRules(join(FIX, 'rules-valid-nested'));
    expect(rules.map((r) => r.id)).toEqual(['nested-a', 'nested-b', 'nested-c']);
  });

  it('returns an empty array for a directory holding no rules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rules-empty-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    expect(loadRules(dir)).toEqual([]);
  });

  it('pairs each rule with the file it came from', () => {
    expect(loadRulesWithFiles(join(FIX, 'rules-valid'))).toEqual([
      {
        file: join(FIX, 'rules-valid', 'ok-obligation.yaml'),
        rule: expect.objectContaining({ id: 'ok-obligation' }),
      },
    ]);
  });

  it('does not descend into a directory link pointing back up the tree', (ctx) => {
    const parent = mkdtempSync(join(tmpdir(), 'rules-link-'));
    onTestFinished(() => rmSync(parent, { recursive: true, force: true }));
    const dir = join(parent, 'rules');
    cpSync(join(FIX, 'rules-valid'), join(dir, 'sub'), { recursive: true });
    try {
      symlinkSync(parent, join(dir, 'loop'), 'junction');
    } catch {
      return ctx.skip('this machine does not allow creating directory links');
    }
    // No ELOOP, no runaway recursion, and the link itself is not read as a rule.
    expect(loadRules(dir).map((rule) => rule.id)).toEqual(['ok-obligation']);
  });
});

describe('loadRules, one failure mode at a time', () => {
  it('reports a rule whose source is not official, naming the file', () => {
    const message = loadError(join(INVALID, 'invalid-schema'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('bad-source.yaml');
    expect(message).toMatch(/source_url: must be an official https source/);
  });

  it('reports malformed YAML, naming the file', () => {
    const message = loadError(join(INVALID, 'invalid-malformed'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('malformed.yaml');
  });

  it('reports an empty file plainly', () => {
    const message = loadError(join(INVALID, 'invalid-empty'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('empty.yaml: file is empty');
  });

  it('reports a duplicate id, naming both files', () => {
    const message = loadError(join(INVALID, 'invalid-dup'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain("duplicate rule id 'duplicated-id'");
    expect(message).toContain('dup-a.yaml');
    expect(message).toContain('dup-b.yaml');
  });

  it('reports a prerequisite naming no known rule, with its file', () => {
    const message = loadError(join(INVALID, 'invalid-dangling'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('bad-prereq.yaml');
    expect(message).toContain("bad-prereq: unknown prerequisite 'ghost-step'");
  });

  it('reports a prerequisite that names a rule which is not a step', () => {
    const message = loadError(join(INVALID, 'invalid-nonstep-prereq'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('step.yaml');
    expect(message).toContain("nonstep-step: prerequisite 'nonstep-seuil' is not a roadmap_step");
  });

  it('reports a prerequisite its dependent’s users can never satisfy', () => {
    const message = loadError(join(INVALID, 'invalid-unreachable-prereq'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('blocked forever');
  });

  it('reports a prerequisite cycle, naming the rules involved', () => {
    const message = loadError(join(INVALID, 'invalid-cycle'));
    expect(problems(message)).toHaveLength(1);
    expect(message).toContain('prerequisite cycle: cycle-a -> cycle-b -> cycle-a');
  });
});

describe('loadRules aggregation', () => {
  it('reports every kind of problem in a single throw', () => {
    const message = loadError(INVALID);
    expect(problems(message)).toHaveLength(8);
    expect(message).toMatch(/source_url: must be an official https source/);
    expect(message).toContain('malformed.yaml');
    expect(message).toContain('file is empty');
    expect(message).toContain("duplicate rule id 'duplicated-id'");
    expect(message).toContain("unknown prerequisite 'ghost-step'");
    expect(message).toContain("prerequisite 'nonstep-seuil' is not a roadmap_step");
    expect(message).toContain('prerequisite cycle: cycle-a -> cycle-b -> cycle-a');
  });
});

describe('validateRuleGraph', () => {
  it('accepts a sound graph, including a diamond of prerequisites', () => {
    expect(
      validateRuleGraph([step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])])
    ).toEqual([]);
  });

  it('reports a step that requires itself', () => {
    expect(validateRuleGraph([step('solo', ['solo'])])).toEqual([
      'prerequisite cycle: solo -> solo',
    ]);
  });

  it('reports two disjoint cycles separately', () => {
    const errors = validateRuleGraph([
      step('a', ['b']),
      step('b', ['a']),
      step('x', ['y']),
      step('y', ['x']),
    ]);
    expect(errors).toHaveLength(2);
    expect(errors).toContain('prerequisite cycle: a -> b -> a');
    expect(errors).toContain('prerequisite cycle: x -> y -> x');
  });

  it('rejects a prerequisite that names a rule which is not a step', () => {
    expect(validateRuleGraph([threshold('seuil'), step('etape', ['seuil'])])).toEqual([
      "etape.yaml: etape: prerequisite 'seuil' is not a roadmap_step",
    ]);
  });

  it('names the file of a prerequisite that matches no rule', () => {
    expect(validateRuleGraph([step('etape', ['fantome'])])).toEqual([
      "etape.yaml: etape: unknown prerequisite 'fantome'",
    ]);
  });

  it('names both files of a duplicate id', () => {
    expect(
      validateRuleGraph([
        { ...step('meme'), file: 'first.yaml' },
        { ...step('meme'), file: 'second.yaml' },
      ])
    ).toEqual(["duplicate rule id 'meme': first.yaml and second.yaml"]);
  });
});
