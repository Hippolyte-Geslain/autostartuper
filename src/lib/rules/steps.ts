/**
 * Picks the roadmap steps a user can act on right now.
 *
 * This is the "what's next" list, so it is deliberately narrow: a step the user
 * cannot start yet is noise, and a long list of everything the roadmap will
 * ever hold is worse than no list at all.
 */
import type { RoadmapStepRule, BusinessProfile } from './types';

/**
 * The steps of the profile's current phase that are not done and whose
 * prerequisites are all done.
 *
 * Three filters, each dropping a different kind of step:
 *
 * - wrong phase — a `routine` step means nothing to someone still in
 *   `lancement`; the roadmap advances one phase at a time.
 * - already completed — nothing left to do.
 * - unmet prerequisites — the step exists but is blocked. `prerequisites` hold
 *   the ids of other roadmap steps, and the loader has already checked they all
 *   resolve and form no cycle, so an id that is not in `completedIds` simply
 *   means that step is still outstanding.
 *
 * A completed step whose prerequisites are unmet stays out: the completion
 * filter runs first, and "done" wins regardless of how it got there. Order the
 * user worked in is not this function's business.
 *
 * `applies_to` filtering happens in the engine before this is called, so every
 * step arriving here already concerns this profile.
 *
 * Input order is preserved, which is what the YAML author wrote — steps read in
 * the sequence they were listed.
 */
export function pendingSteps(
  steps: RoadmapStepRule[],
  profile: BusinessProfile,
  completedIds: string[]
): RoadmapStepRule[] {
  return steps
    .filter((s) => s.phase === profile.lifecyclePhase)
    .filter((s) => !completedIds.includes(s.id))
    .filter((s) => s.prerequisites.every((p) => completedIds.includes(p)));
}
