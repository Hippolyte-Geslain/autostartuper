/**
 * Answers "does this rule concern this user, today?".
 *
 * Two independent questions, kept apart because they fail for different
 * reasons: `appliesTo` is about who the user is, `activeOn` is about when the
 * rule holds. The engine asks both and shows a rule only when both say yes.
 */
import type { ISODate } from './dates';
import type { AppliesTo, BusinessProfile, Millesime } from './types';

/**
 * Whether a rule's `applies_to` block covers this profile.
 *
 * Every condition present must hold — they are ANDed, not ORed. A condition
 * left out of the YAML is not an empty filter that matches nothing, it is the
 * absence of a constraint: a rule with no `legal_forms` concerns every legal
 * form. That is what lets a rule stay short and say only what narrows it.
 *
 * Within one condition the values are ORed: `legal_forms: [micro, ei]` means
 * either. `options_all` is the exception — the user must hold all of them —
 * and `options_none` inverts, excluding anyone holding any of them.
 */
export function appliesTo(a: AppliesTo, p: BusinessProfile): boolean {
  if (a.legal_forms && !a.legal_forms.includes(p.legalForm)) return false;
  if (a.activity_categories && !a.activity_categories.includes(p.activityCategory)) return false;
  if (a.lifecycle_phases && !a.lifecycle_phases.includes(p.lifecyclePhase)) return false;
  if (a.options_all && !a.options_all.every((o) => p.options.includes(o))) return false;
  if (a.options_none && a.options_none.some((o) => p.options.includes(o))) return false;
  return true;
}

/**
 * Whether a rule is in force on `date`.
 *
 * Rules carry a millésime — the year their figures come from. Successive years
 * are separate rules with distinct ids and non-overlapping windows. This
 * predicate answers only whether one rule's window covers the day — it does not
 * disambiguate. If two millésimes overlap, both pass and the engine surfaces
 * both; keeping the windows disjoint is the rule author's job.
 *
 * Both bounds are inclusive: a rule is live on its `valid_from` and still live
 * on its `valid_until`, since that end date is the last day the rule applies,
 * not the first day it stops. An absent `valid_until` means still in force.
 *
 * Compares the dates as plain strings, which is exact for the fixed-width
 * `YYYY-MM-DD` the schema guarantees.
 */
export function activeOn(r: Millesime, date: ISODate): boolean {
  if (date < r.valid_from) return false;
  if (r.valid_until && date > r.valid_until) return false;
  return true;
}
