/**
 * Golden personas — the profiles the engine's end-to-end tests are written
 * against. They are deliberately few and very different from each other: each
 * one exists to exercise a branch the others cannot reach.
 *
 * They run against the REAL `rules/` directory, not a synthetic fixture set, so
 * a change to a seeded rule shows up here as a failing expectation rather than
 * as a surprise in the UI.
 */
import type { BusinessProfile } from '../types';

/** Nora — micro service provider, quarterly URSSAF, just launched, low revenue. */
export const personaNora: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'lancement',
  options: ['acre'],
  urssafFrequency: 'quarterly',
  revenueEntries: [{ month: '2026-07', amount: 4200 }],
};

/**
 * Karim — micro seller, monthly URSSAF, established, high revenue.
 *
 * 7 x 24 000 = 168 000 € YTD, which sits in both alert bands at once: past the
 * 85 000 € TVA franchise (exceeded) and inside the warning band of the 203 100 €
 * plafond (0.827, over the 0.8 warn ratio) without having crossed it. That pair
 * is the point of the persona — it is what proves the two levels are ordered
 * correctly. Raising or lowering the amount collapses one of them.
 */
export const personaKarim: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: [
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
  ].map((month) => ({ month, amount: 24000 })),
};

/** Sofia — EURL manager: every v1 rule is micro-scoped, so nothing applies. */
export const personaSofia: BusinessProfile = {
  legalForm: 'eurl',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'routine',
  options: [],
  revenueEntries: [],
};

/**
 * Théo — still only an idea, but with numbers filled in.
 *
 * The revenue is deliberately absurd for someone who has registered nothing: it
 * would trip both vente thresholds if the engine let it. Théo exists to pin the
 * `idee` gate — see `computeActions`.
 */
export const personaTheo: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'idee',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: [{ month: '2026-06', amount: 250000 }],
};
