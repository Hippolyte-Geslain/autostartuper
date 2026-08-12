/**
 * Which reminders are due today, and what each one says.
 *
 * The part of notifications worth testing: the transport (email, web push) is a
 * thin adapter with credentials, but *when* to notify and *whether this one was
 * already sent* is where the damage happens. Two reminders for the same
 * deadline is how a user learns to ignore the app; a missed J-1 is how they
 * learn it cannot be trusted.
 *
 * Pure, and deliberately so: same actions, same date, same log → same output.
 * The scheduled job supplies `today` and the log; it does not need to reason.
 */
import type { ActionInstance } from '../rules/engine';
import type { PreparedPayload } from '../prepare/preparer';
import { actionKey } from '../prepare/preparer';
import { daysUntil } from '../dashboard/view';
import type { ISODate } from '../rules/dates';

/**
 * Days before the due date at which to remind.
 *
 * A month out is when you can still book an accountant, a week out is when you
 * can still gather figures, the day before is when you actually do it. Users
 * can narrow this; they cannot invent windows that were never scheduled.
 */
export const DEFAULT_WINDOWS = [30, 7, 1] as const;

export interface ReminderConfig {
  windows?: readonly number[];
  /** Actions the user has already marked done, by rule id. */
  completedStepIds?: readonly string[];
}

export interface Reminder {
  /** Stable identity of the reminder — what the log stores to avoid a repeat. */
  key: string;
  action: ActionInstance;
  /** Which window fired: 30, 7, 1… */
  window: number;
  dueDate: ISODate;
  subject: string;
  /** Plain-text body, built from the prepared payload. */
  body: string;
}

/**
 * The identity of one reminder: this action, this due date, this window.
 *
 * The window is part of it because J-30 and J-7 for the same declaration are
 * two legitimate messages; the due date is part of it because a monthly
 * declarer has twelve of the same obligation a year.
 */
export function reminderKey(action: ActionInstance, window: number): string {
  return `${actionKey(action)}#J-${window}`;
}

function formatDateFr(iso: ISODate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/**
 * Writes the message.
 *
 * Carries the prepared payload rather than announcing a deadline, because the
 * spec's core principle applies to notifications first: a bare "CFE due in 7
 * days" makes the user open the app to find out what to do, which is the work
 * the app exists to remove.
 */
export function renderReminder(
  action: ActionInstance,
  window: number,
  payload: PreparedPayload | undefined,
  dueDate: ISODate
): { subject: string; body: string } {
  const when =
    window === 0 ? "aujourd'hui" : window === 1 ? 'demain' : `dans ${window} jours`;

  const lines = [
    `${action.title} — à faire ${when} (${formatDateFr(dueDate)}).`,
  ];

  if (payload) {
    lines.push('', payload.summary);
    for (const field of payload.fields) {
      lines.push(`${field.label} : ${field.value}`);
    }
    if (payload.caveats.length > 0) {
      lines.push('', 'À vérifier :');
      for (const caveat of payload.caveats) lines.push(`- ${caveat}`);
    }
  }

  lines.push('', `Tout est prêt dans l'app : ouvrez l'action pour la finir.`);

  return {
    subject: `${when === "aujourd'hui" ? 'Aujourd’hui' : `J-${window}`} : ${action.title}`,
    body: lines.join('\n'),
  };
}

/**
 * The reminders to send today.
 *
 * A reminder fires when an action's due date is **exactly** `window` days away.
 * Exactly, not "within", because a window that matches a range re-sends the
 * same message every day until the deadline — and `alreadySent` would hide the
 * bug rather than prevent it, since the first send would suppress the rest and
 * the J-7 message would never arrive.
 *
 * That makes a missed run a missed reminder, which is the right trade: a job
 * that did not run yesterday should not send yesterday's mail today, when the
 * numbers in it have moved on.
 *
 * Only obligations carry dates, so only obligations are reminded. Steps have no
 * deadline; threshold alerts are a state, not an event, and pestering someone
 * about a ceiling they are still under is noise.
 */
export function dueReminders(
  actions: readonly ActionInstance[],
  payloads: Readonly<Record<string, PreparedPayload>>,
  today: ISODate,
  alreadySent: readonly string[] = [],
  config: ReminderConfig = {}
): Reminder[] {
  const windows = config.windows ?? DEFAULT_WINDOWS;
  const completed = new Set(config.completedStepIds ?? []);
  const sent = new Set(alreadySent);
  const reminders: Reminder[] = [];

  for (const action of actions) {
    if (action.type !== 'obligation') continue;
    if (completed.has(action.id)) continue;

    const days = daysUntil(action.dueDate, today);
    if (!windows.includes(days)) continue;

    const key = reminderKey(action, days);
    if (sent.has(key)) continue;

    const { subject, body } = renderReminder(
      action,
      days,
      payloads[actionKey(action)],
      action.dueDate
    );
    reminders.push({ key, action, window: days, dueDate: action.dueDate, subject, body });
  }

  // Soonest first: if a send quota runs out, the most urgent went out.
  return reminders.sort((a, b) =>
    a.dueDate === b.dueDate ? a.action.id.localeCompare(b.action.id) : a.dueDate < b.dueDate ? -1 : 1
  );
}
