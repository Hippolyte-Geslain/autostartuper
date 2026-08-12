/**
 * The one public entry point of the rules layer: rules + profile + a date in,
 * an ordered list of actions out.
 *
 * Everything it does is delegated — matching, scheduling, threshold arithmetic
 * and step filtering each live in their own module. What this file owns is the
 * assembly: which rules survive, what shape they take as actions, and the order
 * the user reads them in. It holds no facts about French law and no clock, so
 * the same inputs always produce the same list.
 */
import type { Rule, RoadmapStepRule, BusinessProfile } from './types';
import { appliesTo, activeOn } from './matcher';
import { expandPeriodic, expandAnnual } from './scheduler';
import { evaluateThreshold, type ThresholdAlert } from './thresholds';
import { pendingSteps } from './steps';
import { addDays, parseISO, type ISODate } from './dates';

export interface EngineContext {
  today: ISODate;
  /** How far ahead to look for dues. 90 days ≈ one URSSAF quarter plus slack. */
  horizonDays?: number;
  completedStepIds?: string[];
}

const DEFAULT_HORIZON_DAYS = 90;

/**
 * One thing to show the user. A discriminated union rather than one wide
 * optional-heavy type, so the UI cannot read a due date off an alert.
 *
 * The alert variant carries `ytd` and `limit` alongside `ratio` because the
 * sentence under a gauge ("168 000 € of 203 100 €") needs euros, and
 * recomputing them as `ratio * limit` would put back the float error the
 * cent arithmetic in `thresholds.ts` exists to remove.
 *
 * `level` is derived from `ThresholdAlert` instead of re-declared, so adding a
 * third level there cannot leave this union quietly behind.
 */
export type ActionInstance =
  | {
      type: 'threshold-alert';
      id: string;
      title: string;
      level: ThresholdAlert['level'];
      ratio: number;
      /** Revenue counted for the current calendar year, in euros. */
      ytd: number;
      /** The threshold being measured against, in euros. */
      limit: number;
      sourceUrl: string;
    }
  | { type: 'obligation'; id: string; title: string; dueDate: ISODate; sourceUrl: string }
  | { type: 'step'; id: string; title: string; sourceUrl: string };

type AlertAction = Extract<ActionInstance, { type: 'threshold-alert' }>;
type ObligationAction = Extract<ActionInstance, { type: 'obligation' }>;
type StepAction = Extract<ActionInstance, { type: 'step' }>;

/**
 * Whether a profile has a business yet.
 *
 * Someone in the `idee` phase has registered nothing: no SIREN, no Urssaf
 * account, no turnover. Declarations, the CFE and the turnover ceilings all
 * presuppose a registered business, so none of them can be owed — telling an
 * aspiring founder they must declare revenue to the Urssaf is simply wrong, and
 * it is wrong for every such rule at once.
 *
 * That is why the gate lives here rather than as a `lifecycle_phases` list on
 * each rule. It states a fact about the phase, not about any one rule, and a
 * rule author cannot forget to write it. Rules that need a finer phase
 * distinction still say so themselves through `applies_to.lifecycle_phases`;
 * roadmap steps are unaffected, since steps are exactly what an `idee` profile
 * should be shown.
 */
function isRegistered(profile: BusinessProfile): boolean {
  return profile.lifecyclePhase !== 'idee';
}

/**
 * The actions a profile should see today, grouped and ordered for reading:
 * threshold alerts first (exceeded before warning, then by id), then
 * obligations by due date, then roadmap steps by id.
 *
 * Alerts lead because they are the only group that can already be too late.
 * Within the obligations, two dues of the same rule on different dates are two
 * separate actions — a monthly declarer sees each month.
 *
 * A rule is included only if it is in force today (`activeOn`) and concerns
 * this profile (`appliesTo`). Both are asked once, up front, so no downstream
 * step can accidentally work on a rule that does not apply.
 *
 * @throws {TypeError} if `ctx.today` is not `YYYY-MM-DD`. An empty list is a
 * legitimate answer here — "nothing to do" — so a malformed date must not be
 * able to produce one.
 */
export function computeActions(
  rules: Rule[],
  profile: BusinessProfile,
  ctx: EngineContext
): ActionInstance[] {
  parseISO(ctx.today);
  const to = addDays(ctx.today, ctx.horizonDays ?? DEFAULT_HORIZON_DAYS);
  const active = rules.filter((r) => activeOn(r, ctx.today) && appliesTo(r.applies_to, profile));
  const registered = isRegistered(profile);

  const alerts: AlertAction[] = [];
  if (registered) {
    for (const r of active) {
      if (r.type !== 'threshold') continue;
      const a = evaluateThreshold(r, profile, ctx.today);
      if (!a) continue;
      alerts.push({
        type: 'threshold-alert',
        id: r.id,
        title: r.title,
        level: a.level,
        ratio: a.ratio,
        ytd: a.ytd,
        limit: r.value,
        sourceUrl: r.source_url,
      });
    }
    alerts.sort((a, b) =>
      a.level === b.level ? a.id.localeCompare(b.id) : a.level === 'exceeded' ? -1 : 1
    );
  }

  const obligations: ObligationAction[] = [];
  if (registered) {
    for (const r of active) {
      if (r.type !== 'obligation') continue;
      let dues: ISODate[] = [];
      if (r.schedule.kind === 'annual') {
        dues = expandAnnual(r.schedule, ctx.today, to);
      } else {
        // A periodic rule leaves the frequency to the profile, because the
        // micro-entrepreneur picks monthly or quarterly at registration. With
        // neither set there is no schedule to expand, so the obligation is
        // skipped rather than guessed at — a wrong due date is worse than none.
        const freq = r.schedule.frequency ?? profile.urssafFrequency;
        if (freq) dues = expandPeriodic(freq, ctx.today, to);
      }
      for (const dueDate of dues) {
        obligations.push({
          type: 'obligation',
          id: r.id,
          title: r.title,
          dueDate,
          sourceUrl: r.source_url,
        });
      }
    }
    obligations.sort((a, b) =>
      a.dueDate === b.dueDate ? a.id.localeCompare(b.id) : a.dueDate < b.dueDate ? -1 : 1
    );
  }

  const stepRules = active.filter((r): r is RoadmapStepRule => r.type === 'roadmap_step');
  const steps: StepAction[] = pendingSteps(stepRules, profile, ctx.completedStepIds ?? [])
    .map((s): StepAction => ({
      type: 'step',
      id: s.id,
      title: s.title,
      sourceUrl: s.source_url,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return [...alerts, ...obligations, ...steps];
}
