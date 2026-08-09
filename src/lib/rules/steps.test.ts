import { describe, it, expect } from 'vitest';
import { pendingSteps } from './steps';
import type { RoadmapStepRule, BusinessProfile } from './types';

function step(id: string, phase: RoadmapStepRule['phase'], prerequisites: string[] = []): RoadmapStepRule {
  return {
    id,
    type: 'roadmap_step',
    title: id,
    phase,
    prerequisites,
    source_url: 'https://www.impots.gouv.fr/accueil',
    verified_on: '2026-08-07',
    valid_from: '2025-01-01',
    applies_to: {},
  };
}

const profile: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'lancement',
  options: [],
  revenueEntries: [],
};

describe('pendingSteps', () => {
  it('keeps only current-phase steps', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'routine')], profile, []);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  it('excludes completed steps', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement')], profile, ['a']);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });
  it('holds back steps with unmet prerequisites', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement', ['a'])], profile, []);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  it('releases steps once prerequisites are done', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement', ['a'])], profile, ['a']);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });
  it('a completed step with unmet prerequisites stays excluded', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement', ['a'])], profile, ['b']);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  // Shallow on purpose: completing b is the user asserting the state b leaves
  // them in, so c is released even though a is still outstanding.
  it('checks direct prerequisites only, so a chain releases from the middle', () => {
    const chain = [
      step('a', 'lancement'),
      step('b', 'lancement', ['a']),
      step('c', 'lancement', ['b']),
    ];
    expect(pendingSteps(chain, profile, ['b']).map((s) => s.id)).toEqual(['a', 'c']);
  });
});
