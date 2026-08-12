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

/**
 * Two vintages of the same rule whose windows overlap.
 *
 * `activeOn` is a per-rule predicate by design: it answers "is this rule live
 * today", not "which vintage wins". So if `plafond-micro-vente-2025` and
 * `plafond-micro-vente-2026` are both live on 3 January, both match, and the
 * user gets two alerts about one ceiling — with different numbers.
 *
 * Rules are grouped by `family`, falling back to their own id. Two rules only
 * collide when an author has explicitly said they are the same thing across
 * time, which is why the field exists.
 *
 * An open-ended window (no `valid_until`) overlaps anything starting after it:
 * that is the common authoring mistake — adding next year's vintage without
 * closing this year's.
 */
export function findMillesimeOverlaps(rules: Rule[]): string[] {
  const families = new Map<string, Rule[]>();
  for (const rule of rules) {
    const family = rule.family ?? rule.id;
    const members = families.get(family);
    if (members) members.push(rule);
    else families.set(family, [rule]);
  }

  const problems: string[] = [];
  for (const [family, members] of families) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
    for (let i = 1; i < sorted.length; i++) {
      const earlier = sorted[i - 1];
      const later = sorted[i];
      // Same id twice is a duplicate, which the loader already reports. Saying
      // it again in millésime language would describe one mistake as two.
      if (earlier.id === later.id) continue;
      // Both bounds are inclusive, so "ends the day the next begins" overlaps.
      if (!earlier.valid_until || earlier.valid_until >= later.valid_from) {
        problems.push(
          `family '${family}': '${earlier.id}' (${earlier.valid_from}…${earlier.valid_until ?? 'open'}) ` +
            `overlaps '${later.id}' (from ${later.valid_from}) — both would match the same day`
        );
      }
    }
  }
  return problems;
}
