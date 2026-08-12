/**
 * Works out where a user stands on the journey.
 *
 * The phase decides what the app shows — which roadmap steps are current, and
 * whether the home screen is the timeline or the cockpit — so it is derived
 * from facts rather than asked. Someone who has just registered should not have
 * to self-identify as "en lancement" to be given the right checklist.
 *
 * Pure and rule-free on purpose: it takes plain facts and a date, never the
 * rules or the engine. Whether a plafond is in sight is one such fact, passed
 * in by the caller from the engine's alerts, so this module does not need to
 * know what a threshold is.
 */
import { type ISODate, parseISO, cmp, toISO } from '../rules/dates';
import type { LifecyclePhase } from '../rules/types';

/**
 * How long "just launched" lasts when the setup checklist is never finished.
 *
 * A year is the natural span: it is when the first CFE, the first income-tax
 * return and the first full URSSAF cycle have all been through once. Finishing
 * the checklist ends the phase sooner; this is only the backstop for the user
 * who never ticks anything off.
 */
export const LAUNCH_WINDOW_MONTHS = 12;

export interface LifecycleFacts {
  /** The registration date from the registry, once there is one. */
  registeredOn?: ISODate;
  /** The user says they have filed, but no registration date is known yet. */
  registrationSubmitted: boolean;
  /** Every roadmap step of the lancement phase is done. */
  setupStepsComplete: boolean;
  /** Turnover is at or past a threshold's warning band. Supplied by the caller. */
  nearingPlafond?: boolean;
}

/** The same day-of-month `n` months later, clamped when that day does not exist. */
function addMonths(date: ISODate, n: number): ISODate {
  const { y, m, day } = parseISO(date);
  const total = m - 1 + n;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return toISO(ny, nm, Math.min(day, lastDay));
}

/**
 * The phase this user is in today.
 *
 * Read top to bottom; the first answer wins:
 *
 * 1. **idee** — nothing filed, no registration. There is no business yet.
 * 2. **immatriculation** — filed but not registered, *or* registered with a
 *    date still in the future. Until that date the business does not legally
 *    exist, so no obligation has started running.
 * 3. **lancement** — registered, and either the setup checklist is unfinished
 *    or the first year is not over.
 * 4. **croissance** — running, with a plafond in the warning band. Reached only
 *    from routine: while the setup checklist is still live it is the more
 *    useful advice, and a strong first quarter should not hide it.
 * 5. **routine** — everything else.
 *
 * @throws {TypeError} if either date is not `YYYY-MM-DD`. A phase decides what
 * the whole app displays, so a malformed date must fail loudly rather than
 * quietly resolve to `idee`.
 */
export function derivePhase(facts: LifecycleFacts, today: ISODate): LifecyclePhase {
  parseISO(today);

  if (!facts.registeredOn) {
    return facts.registrationSubmitted ? 'immatriculation' : 'idee';
  }

  parseISO(facts.registeredOn);
  if (cmp(facts.registeredOn, today) > 0) return 'immatriculation';

  const launchEndsOn = addMonths(facts.registeredOn, LAUNCH_WINDOW_MONTHS);
  const stillLaunching = !facts.setupStepsComplete && cmp(today, launchEndsOn) < 0;
  if (stillLaunching) return 'lancement';

  return facts.nearingPlafond ? 'croissance' : 'routine';
}
