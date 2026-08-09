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
 * Three independent conditions, ANDed — a step is returned only if it passes
 * all of them, and they are written as separate passes for readability, not
 * because one takes priority. Each drops a different kind of step:
 *
 * - wrong phase — a `routine` step means nothing to someone still in
 *   `lancement`; the roadmap advances one phase at a time.
 * - already completed — nothing left to do.
 * - unmet prerequisites — the step exists but is blocked. `prerequisites` hold
 *   the ids of other roadmap steps, and the loader has already checked they all
 *   resolve to real steps and form no cycle, so an id that is not in
 *   `completedIds` simply means that step is still outstanding.
 *
 * A step that is both completed and blocked is excluded either way, so the two
 * conditions never actually compete.
 *
 * **The prerequisite check is shallow.** It looks only at a step's direct
 * prerequisites, not at their prerequisites in turn. In a chain a <- b <- c,
 * marking only `b` done releases `c` even though `a` is still outstanding. That
 * is deliberate: a user saying they completed `b` is asserting the state `b`
 * leaves them in, and second-guessing that by re-deriving the whole ancestry
 * would strand them behind a step they have already dealt with off-app — which
 * happens often with French admin, where a formality is frequently bundled into
 * another one. The loader's cycle check is what makes a shallow walk safe.
 *
 * `applies_to` and `activeOn` filtering both happen in the engine before this
 * is called, so every step arriving here already concerns this profile and is
 * in force today.
 *
 * Input order is preserved. That order comes from the loader's alphabetical
 * directory walk — rules are one per file — which is an artefact of file naming
 * rather than anything meaningful, and the engine sorts by id regardless. This
 * function simply does not impose an order of its own.
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
