import { describe, it, expect } from 'vitest';
import { dueReminders, reminderKey, renderReminder, DEFAULT_WINDOWS } from './reminders';
import { computeActions, type ActionInstance } from '../rules/engine';
import { loadRules } from '../rules/loader';
import { prepare, actionKey } from '../prepare/preparer';
import type { BusinessProfile } from '../rules/types';
import type { PreparedPayload } from '../prepare/preparer';

const rules = loadRules('rules');

const micro: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: [{ month: '2026-07', amount: 4000 }],
};

/** The world as the scheduled job would see it on `today`. */
function world(today: string, profile: BusinessProfile = micro) {
  const actions = computeActions(rules, profile, { today });
  const payloads: Record<string, PreparedPayload> = {};
  for (const a of actions) payloads[actionKey(a)] = prepare(a, profile, rules, today);
  return { actions, payloads };
}

describe('reminderKey', () => {
  it('separates the same obligation on different dates and windows', () => {
    const august: ActionInstance = {
      type: 'obligation',
      id: 'urssaf-declaration-micro',
      title: 'x',
      dueDate: '2026-08-31',
      sourceUrl: 'https://x.gouv.fr',
    };
    const september = { ...august, dueDate: '2026-09-30' };
    expect(reminderKey(august, 7)).not.toBe(reminderKey(september, 7));
    expect(reminderKey(august, 7)).not.toBe(reminderKey(august, 1));
  });
});

describe('dueReminders', () => {
  it('fires exactly 30, 7 and 1 days before the due date', () => {
    // The 31 August declaration.
    for (const [today, window] of [
      ['2026-08-01', 30],
      ['2026-08-24', 7],
      ['2026-08-30', 1],
    ] as const) {
      const { actions, payloads } = world(today);
      const fired = dueReminders(actions, payloads, today).filter(
        (r) => r.dueDate === '2026-08-31'
      );
      expect(fired.map((r) => r.window)).toEqual([window]);
    }
  });

  it('stays silent on a day that is not a window', () => {
    const today = '2026-08-20'; // J-11
    const { actions, payloads } = world(today);
    expect(dueReminders(actions, payloads, today).filter((r) => r.dueDate === '2026-08-31')).toEqual(
      []
    );
  });

  it('does not resend one that is already in the log', () => {
    const today = '2026-08-24';
    const { actions, payloads } = world(today);
    const first = dueReminders(actions, payloads, today);
    expect(first.length).toBeGreaterThan(0);
    const second = dueReminders(
      actions,
      payloads,
      today,
      first.map((r) => r.key)
    );
    expect(second).toEqual([]);
  });

  it('honours a narrowed window list', () => {
    const today = '2026-08-01'; // J-30
    const { actions, payloads } = world(today);
    expect(dueReminders(actions, payloads, today, [], { windows: [7, 1] })).toEqual([]);
    expect(dueReminders(actions, payloads, today, [], { windows: [30] }).length).toBe(1);
  });

  it('never reminds about steps or threshold alerts', () => {
    const wealthy = { ...micro, lifecyclePhase: 'lancement' as const, revenueEntries: [{ month: '2026-01', amount: 190000 }] };
    const today = '2026-08-24';
    const { actions, payloads } = world(today, wealthy);
    expect(actions.some((a) => a.type === 'threshold-alert')).toBe(true);
    expect(actions.some((a) => a.type === 'step')).toBe(true);
    expect(dueReminders(actions, payloads, today).every((r) => r.action.type === 'obligation')).toBe(
      true
    );
  });

  it('skips an obligation the user marked done', () => {
    const today = '2026-08-24';
    const { actions, payloads } = world(today);
    const reminders = dueReminders(actions, payloads, today, [], {
      completedStepIds: ['urssaf-declaration-micro'],
    });
    expect(reminders).toEqual([]);
  });

  it('sorts the most urgent first, so a send quota spends itself well', () => {
    // 15 December CFE at J-30 and a 30 November-ish declaration in the same run.
    const today = '2026-11-15';
    const { actions, payloads } = world(today);
    const reminders = dueReminders(actions, payloads, today, [], { windows: [30, 15, 7, 1] });
    const dates = reminders.map((r) => r.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it('does not fire for a date that has already passed', () => {
    const today = '2026-09-05';
    const { actions, payloads } = world(today);
    expect(dueReminders(actions, payloads, today).some((r) => r.dueDate < today)).toBe(false);
  });

  it('exposes its default windows rather than hiding them in the logic', () => {
    expect([...DEFAULT_WINDOWS]).toEqual([30, 7, 1]);
  });
});

describe('renderReminder', () => {
  const today = '2026-08-24';

  it('carries the prepared figures, not just the deadline', () => {
    const { actions, payloads } = world(today);
    const reminder = dueReminders(actions, payloads, today)[0];
    expect(reminder.subject).toContain('J-7');
    expect(reminder.body).toContain('Chiffre d’affaires à déclarer');
    expect(reminder.body).toContain('Taux de cotisations');
    expect(reminder.body).toContain('31 août 2026');
  });

  it('passes the caveats through — they are the part that prevents a mistake', () => {
    const liberal = { ...micro, activityCategory: 'service-bnc' as const, options: ['acre' as const] };
    const { actions, payloads } = world(today, liberal);
    const reminder = dueReminders(actions, payloads, today)[0];
    expect(reminder.body).toMatch(/Cipav/);
    expect(reminder.body).toMatch(/ACRE/);
  });

  it('says "demain" and "aujourd’hui" instead of J-1 and J-0', () => {
    const action: ActionInstance = {
      type: 'obligation',
      id: 'x',
      title: 'Déclarer',
      dueDate: '2026-08-31',
      sourceUrl: 'https://x.gouv.fr',
    };
    expect(renderReminder(action, 1, undefined, '2026-08-31').body).toContain('demain');
    expect(renderReminder(action, 0, undefined, '2026-08-31').subject).toContain('Aujourd’hui');
  });

  it('still writes a usable message when nothing was prepared', () => {
    const action: ActionInstance = {
      type: 'obligation',
      id: 'x',
      title: 'Payer la CFE',
      dueDate: '2026-12-15',
      sourceUrl: 'https://x.gouv.fr',
    };
    const { body } = renderReminder(action, 7, undefined, '2026-12-15');
    expect(body).toContain('Payer la CFE');
    expect(body).toContain('15 décembre 2026');
  });
});
