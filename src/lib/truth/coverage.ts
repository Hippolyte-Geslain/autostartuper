/**
 * Which rules the watchdog can actually watch.
 *
 * A rule whose source is not archived is a rule nobody will notice going stale:
 * the weekly check re-fetches archived pages and diffs them, so an unarchived
 * source is a blind spot rather than a missing nicety.
 *
 * Not every official page can be archived today — the fetcher understands
 * service-public fiches, and several rules point at `impots.gouv.fr` pages that
 * have no fiche id. Saying so plainly is the point of this module: a known,
 * listed blind spot is manageable; an unknown one is not.
 */
import type { Rule } from '../rules/types';
import { ficheIdOf } from './fiche';

export interface Coverage {
  /** Rules whose source is archived and therefore watched. */
  watched: { ruleId: string; fiche: string }[];
  /** Rules pointing at a fiche that has never been archived. */
  missing: { ruleId: string; fiche: string; url: string }[];
  /** Rules whose source the fetcher cannot archive at all. */
  unsupported: { ruleId: string; url: string }[];
}

/**
 * Sorts every rule into watched, missing or unsupported.
 *
 * `archivedFiches` is what `docs/sources/` currently holds.
 */
export function coverageOf(rules: Rule[], archivedFiches: string[]): Coverage {
  const archived = new Set(archivedFiches);
  const coverage: Coverage = { watched: [], missing: [], unsupported: [] };

  for (const rule of rules) {
    const fiche = ficheIdOf(rule.source_url);
    if (!fiche) {
      coverage.unsupported.push({ ruleId: rule.id, url: rule.source_url });
    } else if (archived.has(fiche)) {
      coverage.watched.push({ ruleId: rule.id, fiche });
    } else {
      coverage.missing.push({ ruleId: rule.id, fiche, url: rule.source_url });
    }
  }

  return coverage;
}

/** Rules that cite this fiche — what a change to it puts in doubt. */
export function rulesCiting(rules: Rule[], fiche: string): string[] {
  return rules.filter((r) => ficheIdOf(r.source_url) === fiche).map((r) => r.id);
}
