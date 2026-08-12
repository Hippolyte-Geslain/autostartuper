import { describe, it, expect } from 'vitest';
import { prepare, declaredPeriod } from './preparer';
import { loadRules } from '../rules/loader';
import { computeActions, type ActionInstance } from '../rules/engine';
import type { BusinessProfile } from '../rules/types';

const rules = loadRules('rules');
const TODAY = '2026-08-07';

const micro: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: [
    { month: '2026-06', amount: 5000 },
    { month: '2026-07', amount: 4000 },
  ],
};

function actionsFor(profile: BusinessProfile): ActionInstance[] {
  return computeActions(rules, profile, { today: TODAY });
}

function urssafDue(profile: BusinessProfile, dueDate: string): ActionInstance {
  const found = actionsFor(profile).find(
    (a) => a.type === 'obligation' && a.id === 'urssaf-declaration-micro' && a.dueDate === dueDate
  );
  if (!found) throw new Error(`no URSSAF action due ${dueDate}`);
  return found;
}

describe('declaredPeriod', () => {
  it('a monthly declaration covers the previous month', () => {
    expect(declaredPeriod('2026-10-31', 'monthly')).toEqual(['2026-09']);
  });

  it('a quarterly declaration covers the previous three months', () => {
    expect(declaredPeriod('2026-10-31', 'quarterly')).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('crosses the year boundary', () => {
    expect(declaredPeriod('2027-01-31', 'quarterly')).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(declaredPeriod('2027-01-31', 'monthly')).toEqual(['2026-12']);
  });

  it('rejects a malformed due date', () => {
    expect(() => declaredPeriod('31/10/2026', 'monthly')).toThrow(TypeError);
  });
});

describe('prepare — URSSAF declaration', () => {
  it('fills the period, the turnover and the estimated contributions', () => {
    // Due 31 August covers July: 4 000 € at the vente rate of 12,3 %.
    const payload = prepare(urssafDue(micro, '2026-08-31'), micro, rules, TODAY);
    const values = Object.fromEntries(payload.fields.map((f) => [f.label, f.value]));
    expect(values['Période déclarée']).toBe('juillet 2026');
    expect(values['Chiffre d’affaires à déclarer']).toContain('4');
    expect(values['Taux de cotisations']).toBe('12,3 %');
    // 4000 × 12,3 % = 492 €
    expect(values['Cotisations estimées']).toContain('492');
  });

  it('sums the three months of a quarterly period', () => {
    const quarterly = { ...micro, urssafFrequency: 'quarterly' as const };
    const payload = prepare(urssafDue(quarterly, '2026-10-31'), quarterly, rules, TODAY);
    const values = Object.fromEntries(payload.fields.map((f) => [f.label, f.value]));
    expect(values['Période déclarée']).toBe('juillet 2026 → septembre 2026');
    // Only July has revenue in the July-September window: 4 000 €.
    expect(values['Chiffre d’affaires à déclarer']).toContain('4');
  });

  it('warns that an ACRE holder will pay less than the estimate', () => {
    const withAcre = { ...micro, options: ['acre' as const] };
    const payload = prepare(urssafDue(withAcre, '2026-08-31'), withAcre, rules, TODAY);
    expect(payload.caveats.join(' ')).toMatch(/ACRE/);
  });

  it('names the Cipav rate rather than silently applying the wrong one', () => {
    const liberal = { ...micro, activityCategory: 'service-bnc' as const };
    const payload = prepare(urssafDue(liberal, '2026-08-31'), liberal, rules, TODAY);
    const values = Object.fromEntries(payload.fields.map((f) => [f.label, f.value]));
    expect(values['Taux de cotisations']).toBe('25,6 %');
    expect(payload.caveats.join(' ')).toMatch(/Cipav/);
  });

  it('says a nil period must still be declared', () => {
    const noRevenue = { ...micro, revenueEntries: [] };
    const payload = prepare(urssafDue(noRevenue, '2026-08-31'), noRevenue, rules, TODAY);
    expect(payload.caveats.join(' ')).toMatch(/0 €/);
  });

  it('refuses to invent a rate when the truth layer has none', () => {
    const action = urssafDue(micro, '2026-08-31');
    const withoutRates = rules.filter((r) => r.type !== 'rate');
    const payload = prepare(action, micro, withoutRates, TODAY);
    expect(payload.fields.map((f) => f.label)).not.toContain('Cotisations estimées');
    expect(payload.caveats.join(' ')).toMatch(/ne peut pas estimer/);
  });

  it('puts the user’s own figure in the checklist', () => {
    const payload = prepare(urssafDue(micro, '2026-08-31'), micro, rules, TODAY);
    expect(payload.checklist.join(' ')).toMatch(/4\s?000/);
  });
});

describe('prepare — threshold alert', () => {
  const big: BusinessProfile = {
    ...micro,
    revenueEntries: [{ month: '2026-03', amount: 90000 }],
  };

  it('says how far past the threshold the user is', () => {
    const alert = actionsFor(big).find((a) => a.id === 'tva-franchise-vente')!;
    const payload = prepare(alert, big, rules, TODAY);
    expect(payload.summary).toMatch(/dépassé/);
    // 90 000 − 85 000 = 5 000 €
    expect(payload.summary).toContain('5');
  });

  it('says how much room is left when only approaching it', () => {
    const approaching: BusinessProfile = {
      ...micro,
      revenueEntries: [{ month: '2026-03', amount: 170000 }],
    };
    const alert = actionsFor(approaching).find((a) => a.id === 'plafond-micro-vente')!;
    const payload = prepare(alert, approaching, rules, TODAY);
    expect(payload.summary).toMatch(/reste/);
  });
});

describe('prepare — fallbacks', () => {
  it('gives the CFE its own checklist and the creation-year caveat', () => {
    const action = computeActions(rules, micro, { today: TODAY, horizonDays: 365 }).find(
      (a) => a.id === 'cfe-paiement'
    )!;
    const payload = prepare(action, micro, rules, TODAY);
    expect(payload.caveats.join(' ')).toMatch(/exonéré/);
  });

  it('falls back to an honest checklist for a step, never to a number', () => {
    const lancement = { ...micro, lifecyclePhase: 'lancement' as const };
    const step = actionsFor(lancement).find((a) => a.type === 'step')!;
    const payload = prepare(step, lancement, rules, TODAY);
    expect(payload.fields).toEqual([]);
    expect(payload.checklist.length).toBeGreaterThan(0);
  });
});
