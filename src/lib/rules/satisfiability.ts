/**
 * Can a user who sees a step ever complete what it depends on?
 *
 * The trap this closes, deferred since M1 and required before any rule declares
 * `prerequisites`: a step is shown to a profile, its prerequisite is **not**
 * shown to that same profile because the prerequisite's `applies_to` excludes
 * them, and the step stays blocked forever. Nothing errors, nothing logs. The
 * user simply has an item on their roadmap that can never be ticked off, and no
 * way to find out why.
 *
 * The check is structural, not per-user: rather than enumerate profiles, it
 * asks whether the prerequisite's conditions are *implied* by the dependent's.
 * If a step is shown to micro users and its prerequisite only to SASU users,
 * the two can never meet — that is provable from the YAML alone.
 */
import { LifecyclePhaseSchema, type AppliesTo, type Rule } from './types';

/** The roadmap's order, taken from the schema so the two cannot drift. */
const PHASE_ORDER = LifecyclePhaseSchema.options;

/**
 * Whether every profile matching `dependent` also matches `prerequisite`.
 *
 * Read condition by condition. The prerequisite is satisfiable when, for each
 * condition it sets, the dependent is at least as narrow:
 *
 * - the prerequisite leaves a field unconstrained → fine, it accepts everyone.
 * - the dependent leaves it unconstrained while the prerequisite narrows it →
 *   **not** fine: the dependent reaches users the prerequisite never will.
 * - both narrow it → the dependent's values must all be inside the
 *   prerequisite's.
 *
 * `options_all` and `options_none` invert each other, so they are compared the
 * other way round: the prerequisite may require no more options than the
 * dependent already requires, and exclude no more than the dependent excludes.
 */
export function impliesAppliesTo(dependent: AppliesTo, prerequisite: AppliesTo): boolean {
  const membership = ['legal_forms', 'activity_categories', 'lifecycle_phases'] as const;
  for (const field of membership) {
    const required = prerequisite[field];
    if (!required) continue;
    const offered = dependent[field];
    if (!offered) return false;
    if (!offered.every((value) => (required as readonly string[]).includes(value))) return false;
  }

  // The prerequisite demands an option: the dependent must demand it too, or a
  // user without that option gets the step and never the thing it needs.
  for (const option of prerequisite.options_all ?? []) {
    if (!(dependent.options_all ?? []).includes(option)) return false;
  }
  // The prerequisite excludes an option: the dependent must exclude it as well.
  for (const option of prerequisite.options_none ?? []) {
    if (!(dependent.options_none ?? []).includes(option)) return false;
  }

  return true;
}

/**
 * Every unreachable prerequisite in a rule set, as readable problems.
 *
 * Phases are checked separately from `applies_to`: a step in `lancement` whose
 * prerequisite lives in `routine` is just as stuck, because `pendingSteps` only
 * ever offers the current phase's steps and the roadmap does not go backwards.
 */
export function findUnsatisfiablePrerequisites(rules: Rule[]): string[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const problems: string[] = [];

  for (const rule of rules) {
    if (rule.type !== 'roadmap_step') continue;
    for (const id of rule.prerequisites) {
      const prerequisite = byId.get(id);
      // Missing or non-step prerequisites are already the loader's business;
      // this check only speaks about the ones that resolve.
      if (!prerequisite || prerequisite.type !== 'roadmap_step') continue;

      if (!impliesAppliesTo(rule.applies_to, prerequisite.applies_to)) {
        problems.push(
          `${rule.id}: prerequisite '${id}' does not apply to everyone '${rule.id}' applies to — ` +
            `those users would be blocked forever`
        );
      }

      if (PHASE_ORDER.indexOf(prerequisite.phase) > PHASE_ORDER.indexOf(rule.phase)) {
        problems.push(
          `${rule.id}: prerequisite '${id}' is in a later phase (${prerequisite.phase} after ${rule.phase}) — ` +
            `it can never be completed first`
        );
      }
    }
  }

  return problems;
}
