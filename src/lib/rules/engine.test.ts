import { describe, it, expect } from 'vitest';
import { computeActions, type ActionInstance } from './engine';
import { loadRules } from './loader';
import { personaNora, personaKarim, personaSofia, personaTheo } from './__fixtures__/personas';

const rules = loadRules('rules');
const TODAY = '2026-08-07'; // frozen — the engine is a pure function of its inputs

function shape(a: ActionInstance): [string, string, string] {
  return [a.type, a.id, a.type === 'obligation' ? a.dueDate : ''];
}

type AlertAction = Extract<ActionInstance, { type: 'threshold-alert' }>;

describe('golden personas', () => {
  it('Nora: one quarterly URSSAF due + the three lancement steps', () => {
    const actions = computeActions(rules, personaNora, { today: TODAY });
    expect(actions.map(shape)).toEqual([
      ['obligation', 'urssaf-declaration-micro', '2026-10-31'],
      ['step', 'assurance-rc-pro', ''],
      ['step', 'compte-bancaire-dedie', ''],
      ['step', 'declaration-initiale-cfe', ''],
    ]);
  });

  it('Karim: TVA exceeded + plafond warning + three monthly URSSAF dues', () => {
    const actions = computeActions(rules, personaKarim, { today: TODAY });
    expect(actions.map(shape)).toEqual([
      ['threshold-alert', 'tva-franchise-vente', ''],
      ['threshold-alert', 'plafond-micro-vente', ''],
      ['obligation', 'urssaf-declaration-micro', '2026-08-31'],
      ['obligation', 'urssaf-declaration-micro', '2026-09-30'],
      ['obligation', 'urssaf-declaration-micro', '2026-10-31'],
    ]);
    const [tva, plafond] = actions as AlertAction[];
    expect(tva.level).toBe('exceeded');
    expect(tva.ratio).toBeCloseTo(1.9765, 4); // 168000 / 85000 = 1.976470588…
    expect(tva.ytd).toBe(168000);
    expect(tva.limit).toBe(85000);
    expect(plafond.level).toBe('warning');
    expect(plafond.ratio).toBeCloseTo(0.8272, 4); // 168000 / 203100 = 0.827178729…
    expect(plafond.ytd).toBe(168000);
    expect(plafond.limit).toBe(203100);
  });

  it('Sofia: nothing applies (rule filtering works)', () => {
    expect(computeActions(rules, personaSofia, { today: TODAY })).toEqual([]);
  });

  it('Sofia stays empty in December, when the CFE date is inside the horizon', () => {
    // Guards the test above against passing for the wrong reason: an empty list
    // on 7 August could simply mean 15 December is out of range.
    expect(computeActions(rules, personaSofia, { today: '2026-11-20' })).toEqual([]);
  });

  it('Théo (idee) gets no obligations or alerts despite tripping revenue', () => {
    expect(computeActions(rules, personaTheo, { today: TODAY })).toEqual([]);
    // …and the gate is what does it, not the absence of matching rules: the
    // same profile one phase further along is buried in them.
    const registered = computeActions(
      rules,
      { ...personaTheo, lifecyclePhase: 'routine' },
      { today: TODAY }
    );
    expect(registered.filter((a) => a.type === 'threshold-alert')).toHaveLength(2);
    expect(registered.some((a) => a.type === 'obligation')).toBe(true);
  });
});

describe('computeActions', () => {
  it('honours the horizon: a longer window reaches the 15 December CFE', () => {
    const within = computeActions(rules, personaNora, { today: TODAY, horizonDays: 365 });
    expect(within.some((a) => a.id === 'cfe-paiement')).toBe(true);
    const outside = computeActions(rules, personaNora, { today: TODAY });
    expect(outside.some((a) => a.id === 'cfe-paiement')).toBe(false);
  });

  it('drops a completed step and keeps the rest', () => {
    const actions = computeActions(rules, personaNora, {
      today: TODAY,
      completedStepIds: ['compte-bancaire-dedie'],
    });
    expect(actions.filter((a) => a.type === 'step').map((a) => a.id)).toEqual([
      'assurance-rc-pro',
      'declaration-initiale-cfe',
    ]);
  });

  it('skips a periodic obligation when neither rule nor profile names a frequency', () => {
    const noFrequency = { ...personaNora, urssafFrequency: undefined };
    const actions = computeActions(rules, noFrequency, { today: TODAY });
    expect(actions.some((a) => a.type === 'obligation')).toBe(false);
    expect(actions.filter((a) => a.type === 'step')).toHaveLength(3);
  });

  it('orders alerts before obligations before steps', () => {
    const actions = computeActions(rules, personaKarim, { today: TODAY, horizonDays: 365 });
    const types = actions.map((a) => a.type);
    expect([...types].sort(byGroup)).toEqual(types);
  });

  it('ignores rules whose millésime has not opened yet', () => {
    // The micro plafonds run 2026-01-01…2028-12-31; in 2025 they are not in
    // force, so the same revenue a year earlier trips only the TVA threshold.
    // (The revenue is moved to 2025 too — YTD counts the current year only.)
    const karim2025 = {
      ...personaKarim,
      revenueEntries: personaKarim.revenueEntries.map((e) => ({
        ...e,
        month: e.month.replace('2026', '2025'),
      })),
    };
    const actions = computeActions(rules, karim2025, { today: '2025-08-07' });
    expect(actions.filter((a) => a.type === 'threshold-alert').map((a) => a.id)).toEqual([
      'tva-franchise-vente',
    ]);
  });

  it('rejects a malformed today rather than silently returning nothing', () => {
    expect(() => computeActions(rules, personaKarim, { today: '07/08/2026' })).toThrow(TypeError);
  });
});

const ORDER = { 'threshold-alert': 0, obligation: 1, step: 2 } as const;
function byGroup(a: ActionInstance['type'], b: ActionInstance['type']): number {
  return ORDER[a] - ORDER[b];
}
