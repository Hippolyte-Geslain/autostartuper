import { describe, it, expect } from 'vitest';
import { derivePhase, LAUNCH_WINDOW_MONTHS, type LifecycleFacts } from './lifecycle';

const TODAY = '2026-08-12';
const nothing: LifecycleFacts = { registrationSubmitted: false, setupStepsComplete: false };

describe('derivePhase', () => {
  it('idee: nothing started', () => {
    expect(derivePhase(nothing, TODAY)).toBe('idee');
  });

  it('immatriculation: filed but no registration date back yet', () => {
    expect(derivePhase({ ...nothing, registrationSubmitted: true }, TODAY)).toBe('immatriculation');
  });

  it('immatriculation: registered on a date that has not arrived', () => {
    // The guichet unique can return a future effective date; the business does
    // not legally exist until then, so it is still being registered.
    expect(derivePhase({ ...nothing, registeredOn: '2026-09-01' }, TODAY)).toBe('immatriculation');
  });

  it('lancement: registered today, setup unfinished', () => {
    expect(derivePhase({ ...nothing, registeredOn: TODAY }, TODAY)).toBe('lancement');
  });

  it('lancement: inside the launch window even a day before it closes', () => {
    expect(derivePhase({ ...nothing, registeredOn: '2025-08-13' }, TODAY)).toBe('lancement');
  });

  it('routine: the launch window has closed, setup or not', () => {
    expect(derivePhase({ ...nothing, registeredOn: '2025-08-12' }, TODAY)).toBe('routine');
  });

  it('routine: setup finished early ends lancement without waiting a year', () => {
    expect(
      derivePhase({ registeredOn: '2026-07-01', registrationSubmitted: true, setupStepsComplete: true }, TODAY)
    ).toBe('routine');
  });

  it('croissance: routine plus a plafond in sight', () => {
    expect(
      derivePhase({ ...nothing, registeredOn: '2024-01-10', nearingPlafond: true }, TODAY)
    ).toBe('croissance');
  });

  it('does not promote a business still launching to croissance', () => {
    // Setup steps are still the useful advice; a ceiling can wait until they
    // are done. Otherwise a fast first quarter would hide the roadmap.
    expect(derivePhase({ ...nothing, registeredOn: TODAY, nearingPlafond: true }, TODAY)).toBe(
      'lancement'
    );
  });

  it('ignores a registration date once it is set, if submission was never flagged', () => {
    // The registry is the stronger evidence: a date means it happened.
    expect(derivePhase({ registeredOn: '2020-01-01', registrationSubmitted: false, setupStepsComplete: false }, TODAY)).toBe(
      'routine'
    );
  });

  it('rejects a malformed date rather than guessing a phase', () => {
    expect(() => derivePhase({ ...nothing, registeredOn: '12/08/2026' }, TODAY)).toThrow(TypeError);
    expect(() => derivePhase(nothing, '2026/08/12')).toThrow(TypeError);
  });

  it('states the launch window in months, so the tests above cannot drift from it', () => {
    expect(LAUNCH_WINDOW_MONTHS).toBe(12);
  });
});
