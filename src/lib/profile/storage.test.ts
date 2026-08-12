import { describe, it, expect } from 'vitest';
import {
  loadProfile,
  saveProfile,
  clearProfile,
  loadCompletedSteps,
  saveCompletedSteps,
  PROFILE_KEY,
  COMPLETED_STEPS_KEY,
  type StorageLike,
} from './storage';
import { BusinessProfileSchema } from './schema';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const profile = BusinessProfileSchema.parse({
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  revenueEntries: [{ month: '2026-01', amount: 1000 }],
});

describe('profile storage', () => {
  it('round-trips a profile', () => {
    const s = fakeStorage();
    saveProfile(profile, s);
    expect(loadProfile(s)).toEqual(profile);
  });

  it('returns null when nothing is stored', () => {
    expect(loadProfile(fakeStorage())).toBeNull();
  });

  it('drops stored data that no longer parses instead of half-loading it', () => {
    const s = fakeStorage({ [PROFILE_KEY]: JSON.stringify({ legalForm: 'sarl' }) });
    expect(loadProfile(s)).toBeNull();
  });

  it('drops data that is not even JSON', () => {
    expect(loadProfile(fakeStorage({ [PROFILE_KEY]: '{oops' }))).toBeNull();
  });

  it('works with no storage at all, as during server rendering', () => {
    expect(loadProfile(undefined)).toBeNull();
    expect(() => saveProfile(profile, undefined)).not.toThrow();
    expect(loadCompletedSteps(undefined)).toEqual([]);
  });

  it('clears the completed steps along with the profile', () => {
    const s = fakeStorage();
    saveProfile(profile, s);
    saveCompletedSteps(['a'], s);
    clearProfile(s);
    expect(loadProfile(s)).toBeNull();
    expect(loadCompletedSteps(s)).toEqual([]);
  });
});

describe('completed steps storage', () => {
  it('round-trips ids', () => {
    const s = fakeStorage();
    saveCompletedSteps(['assurance-rc-pro', 'compte-bancaire-dedie'], s);
    expect(loadCompletedSteps(s)).toEqual(['assurance-rc-pro', 'compte-bancaire-dedie']);
  });

  it('deduplicates on the way in', () => {
    const s = fakeStorage();
    saveCompletedSteps(['a', 'a', 'b'], s);
    expect(loadCompletedSteps(s)).toEqual(['a', 'b']);
  });

  it('keeps only strings from a tampered list', () => {
    const s = fakeStorage({ [COMPLETED_STEPS_KEY]: JSON.stringify(['a', 3, null]) });
    expect(loadCompletedSteps(s)).toEqual(['a']);
  });

  it('survives a value that is not an array', () => {
    expect(loadCompletedSteps(fakeStorage({ [COMPLETED_STEPS_KEY]: '"nope"' }))).toEqual([]);
  });
});
