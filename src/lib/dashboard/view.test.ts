import { describe, it, expect } from 'vitest';
import { buildDashboard, defaultView, daysUntil, formatCountdown, PHASE_ORDER } from './view';
import { computeActions } from '../rules/engine';
import { loadRules } from '../rules/loader';
import { personaNora, personaKarim } from '../rules/__fixtures__/personas';

const TODAY = '2026-08-07';
const rules = loadRules('rules');

describe('defaultView', () => {
  it('shows the roadmap while the business is being set up', () => {
    expect(defaultView('idee')).toBe('parcours');
    expect(defaultView('immatriculation')).toBe('parcours');
    expect(defaultView('lancement')).toBe('parcours');
  });

  it('shows the cockpit once it runs', () => {
    expect(defaultView('routine')).toBe('pilotage');
    expect(defaultView('croissance')).toBe('pilotage');
  });

  it('covers every phase, so a new one cannot be forgotten', () => {
    for (const phase of PHASE_ORDER) {
      expect(['parcours', 'pilotage']).toContain(defaultView(phase));
    }
  });
});

describe('daysUntil', () => {
  it('counts whole days forward and back', () => {
    expect(daysUntil('2026-08-14', TODAY)).toBe(7);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil('2026-08-04', TODAY)).toBe(-3);
  });

  it('crosses a month and a leap day without drifting', () => {
    expect(daysUntil('2026-09-01', '2026-08-31')).toBe(1);
    expect(daysUntil('2024-03-01', '2024-02-28')).toBe(2);
  });

  it('rejects a malformed date', () => {
    expect(() => daysUntil('14/08/2026', TODAY)).toThrow(TypeError);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, "aujourd'hui"],
    [1, 'demain'],
    [7, 'dans 7 jours'],
    [-1, 'en retard d’un jour'],
    [-3, 'en retard de 3 jours'],
  ])('%i → %s', (days, expected) => {
    expect(formatCountdown(days)).toBe(expected);
  });
});

describe('buildDashboard', () => {
  it('splits Nora into steps with no alerts', () => {
    const model = buildDashboard(
      computeActions(rules, personaNora, { today: TODAY }),
      personaNora.lifecyclePhase,
      TODAY
    );
    expect(model.view).toBe('parcours');
    expect(model.alerts).toHaveLength(0);
    expect(model.steps.map((s) => s.id)).toEqual([
      'assurance-rc-pro',
      'compte-bancaire-dedie',
      'declaration-initiale-cfe',
    ]);
    expect(model.nextDeadline?.action.dueDate).toBe('2026-10-31');
    expect(model.nextDeadline?.days).toBe(85);
    expect(model.nearingPlafond).toBe(false);
  });

  it('gives Karim the cockpit, both alerts and the soonest deadline', () => {
    const model = buildDashboard(
      computeActions(rules, personaKarim, { today: TODAY }),
      personaKarim.lifecyclePhase,
      TODAY
    );
    expect(model.view).toBe('pilotage');
    expect(model.alerts.map((a) => a.id)).toEqual(['tva-franchise-vente', 'plafond-micro-vente']);
    expect(model.nextDeadline?.action.dueDate).toBe('2026-08-31');
    expect(model.nearingPlafond).toBe(true);
    expect(model.steps).toHaveLength(0);
  });

  it('has no deadline to show when nothing falls due', () => {
    const model = buildDashboard([], 'routine', TODAY);
    expect(model.nextDeadline).toBeUndefined();
  });

  it('keeps the engine order rather than sorting again', () => {
    const actions = computeActions(rules, personaKarim, { today: TODAY });
    const model = buildDashboard(actions, 'routine', TODAY);
    expect([...model.alerts, ...model.obligations, ...model.steps]).toEqual(actions);
  });
});
