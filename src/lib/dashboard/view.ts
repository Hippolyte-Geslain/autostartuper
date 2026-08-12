/**
 * What the dashboard shows, decided in one place.
 *
 * Which of the spec's two home views is the default, how actions are grouped,
 * and how far off a deadline is. All pure: the components render this, they do
 * not decide it, which keeps the rules that matter out of JSX.
 */
import type { ActionInstance } from '../rules/engine';
import type { ActivityCategory, LegalForm, LifecyclePhase } from '../rules/types';
import { type ISODate, parseISO, cmp } from '../rules/dates';

/**
 * `parcours` is the roadmap timeline, `pilotage` the cockpit.
 *
 * The switch follows the journey: while a business is being set up, the useful
 * screen is "what is left to do"; once it runs, it is "what falls due and how
 * close am I to a ceiling". Both stay reachable — this is only the default.
 */
export type DashboardView = 'parcours' | 'pilotage';

const PARCOURS_PHASES: LifecyclePhase[] = ['idee', 'immatriculation', 'lancement'];

export function defaultView(phase: LifecyclePhase): DashboardView {
  return PARCOURS_PHASES.includes(phase) ? 'parcours' : 'pilotage';
}

/** The journey, in order. The timeline draws this and marks "vous êtes ici". */
export const PHASE_ORDER: LifecyclePhase[] = [
  'idee',
  'immatriculation',
  'lancement',
  'routine',
  'croissance',
];

/**
 * The French wording for every enum the user can see.
 *
 * Kept beside the phase labels so no screen invents its own: `service-bic` is a
 * value in our code, never something to show somebody.
 */
export const LEGAL_FORM_LABELS: Record<LegalForm, string> = {
  micro: 'Micro-entreprise',
  ei: 'Entreprise individuelle',
  eurl: 'EURL',
  sasu: 'SASU',
};

export const ACTIVITY_LABELS: Record<ActivityCategory, string> = {
  vente: 'Vente de marchandises',
  'service-bic': 'Prestations de services (BIC)',
  'service-bnc': 'Prestations de services (BNC)',
};

export const PHASE_LABELS: Record<LifecyclePhase, string> = {
  idee: 'Idée & projet',
  immatriculation: 'Immatriculation',
  lancement: 'Lancement',
  routine: 'Routine',
  croissance: 'Croissance',
};

/**
 * Whole days from `today` to `date`; negative when the date has passed.
 *
 * Counted from the calendar dates themselves, never from a clock, so a user in
 * Nouméa and a server in Paris agree on "J-7".
 */
export function daysUntil(date: ISODate, today: ISODate): number {
  const a = parseISO(today);
  const b = parseISO(date);
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / MS_PER_DAY
  );
}

/** "dans 7 jours", "demain", "aujourd'hui", "en retard de 3 jours". */
export function formatCountdown(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days > 1) return `dans ${days} jours`;
  if (days === -1) return 'en retard d’un jour';
  return `en retard de ${Math.abs(days)} jours`;
}

export interface DashboardModel {
  view: DashboardView;
  alerts: Extract<ActionInstance, { type: 'threshold-alert' }>[];
  obligations: Extract<ActionInstance, { type: 'obligation' }>[];
  steps: Extract<ActionInstance, { type: 'step' }>[];
  /** The soonest obligation, which is the headline KPI of the cockpit. */
  nextDeadline?: { action: Extract<ActionInstance, { type: 'obligation' }>; days: number };
  /** True when any threshold is in its warning band or past it. */
  nearingPlafond: boolean;
}

/**
 * Groups one action list into what the screens need.
 *
 * The engine already ordered everything; this only splits by kind and picks the
 * headline. Deliberately no re-sorting — two orderings of the same list is how
 * the calendar and the cards start disagreeing.
 */
export function buildDashboard(
  actions: ActionInstance[],
  phase: LifecyclePhase,
  today: ISODate
): DashboardModel {
  const alerts = actions.filter((a) => a.type === 'threshold-alert');
  const obligations = actions.filter((a) => a.type === 'obligation');
  const steps = actions.filter((a) => a.type === 'step');

  const soonest = obligations.reduce<Extract<ActionInstance, { type: 'obligation' }> | undefined>(
    (best, o) => (!best || cmp(o.dueDate, best.dueDate) < 0 ? o : best),
    undefined
  );

  return {
    view: defaultView(phase),
    alerts,
    obligations,
    steps,
    nextDeadline: soonest ? { action: soonest, days: daysUntil(soonest.dueDate, today) } : undefined,
    nearingPlafond: alerts.length > 0,
  };
}
