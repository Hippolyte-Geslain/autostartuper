import { describe, it, expect } from 'vitest';
import {
  pendingQuestions,
  buildProfile,
  startFromCompany,
  startFromScratch,
  type AssessmentState,
} from './flow';
import type { RegistryCompany } from '../siren/map';

const TODAY = '2026-08-12';

const microCompany: RegistryCompany = {
  siren: '103356960',
  name: 'CHER PLOMBIER PAS',
  registeredOn: '2026-04-03',
  apeCode: '43.22A',
  natureJuridique: '1000',
  active: true,
  legalFormCandidates: ['micro', 'ei'],
};

const sasu: RegistryCompany = { ...microCompany, natureJuridique: '5720', legalFormCandidates: ['sasu'] };

function answered(state: AssessmentState, answers: AssessmentState['answers']): AssessmentState {
  return { ...state, answers: { ...state.answers, ...answers } };
}

describe('pendingQuestions', () => {
  it('asks a registered user only what the registry could not answer', () => {
    const ids = pendingQuestions(startFromCompany(sasu)).map((q) => q.id);
    expect(ids).toContain('activityCategory');
    expect(ids).not.toContain('legalForm'); // the registry settled it
    expect(ids).not.toContain('registrationSubmitted'); // it is registered
  });

  it('asks micro-or-EI when the registry cannot see the tax regime', () => {
    const q = pendingQuestions(startFromCompany(microCompany)).find((q) => q.id === 'legalForm');
    expect(q?.options.map((o) => o.value)).toEqual(['micro', 'ei']);
  });

  it('offers every v1 form when the registry offers none', () => {
    const unknown = { ...microCompany, natureJuridique: '9220', legalFormCandidates: [] };
    const q = pendingQuestions(startFromCompany(unknown)).find((q) => q.id === 'legalForm');
    expect(q?.options.map((o) => o.value)).toEqual(['micro', 'ei', 'eurl', 'sasu']);
  });

  it('asks the URSSAF frequency of a micro user and nobody else', () => {
    const micro = answered(startFromCompany(microCompany), { legalForm: 'micro' });
    expect(pendingQuestions(micro).map((q) => q.id)).toContain('urssafFrequency');

    const ei = answered(startFromCompany(microCompany), { legalForm: 'ei' });
    expect(pendingQuestions(ei).map((q) => q.id)).not.toContain('urssafFrequency');
  });

  it('asks a pre-creation user whether they have filed, and never for a SIREN', () => {
    const ids = pendingQuestions(startFromScratch()).map((q) => q.id);
    expect(ids).toContain('registrationSubmitted');
    expect(ids).toContain('legalForm');
    expect(ids).toContain('activityCategory');
    expect(ids).not.toContain('revenueYtd'); // nothing earned before there is a business
  });

  it('shrinks as answers come in', () => {
    const before = pendingQuestions(startFromCompany(sasu)).length;
    const after = pendingQuestions(
      answered(startFromCompany(sasu), { activityCategory: 'service-bic' })
    ).length;
    expect(after).toBe(before - 1);
  });

  it('runs out of questions once everything needed is answered', () => {
    const complete = answered(startFromCompany(sasu), {
      activityCategory: 'service-bic',
      options: [],
      revenueYtd: 0,
      setupStepsComplete: false,
    });
    expect(pendingQuestions(complete)).toEqual([]);
  });
});

describe('buildProfile', () => {
  const completeMicro = answered(startFromCompany(microCompany), {
    legalForm: 'micro',
    activityCategory: 'vente',
    urssafFrequency: 'quarterly',
    options: ['acre'],
    revenueYtd: 12000,
    setupStepsComplete: false,
  });

  it('builds a profile the engine accepts', () => {
    const r = buildProfile(completeMicro, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile).toMatchObject({
      legalForm: 'micro',
      activityCategory: 'vente',
      urssafFrequency: 'quarterly',
      options: ['acre'],
      siren: '103356960',
      registeredOn: '2026-04-03',
    });
  });

  it('derives the phase from the registration date, not from a question', () => {
    // Registered four months ago, checklist unfinished.
    expect(buildProfile(completeMicro, TODAY)).toMatchObject({
      profile: { lifecyclePhase: 'lancement' },
    });
  });

  it('records the declared turnover as one entry in the current month', () => {
    const r = buildProfile(completeMicro, TODAY);
    expect(r.ok && r.profile.revenueEntries).toEqual([{ month: '2026-08', amount: 12000 }]);
  });

  it('leaves a pre-creation user in idee with no revenue', () => {
    const state = answered(startFromScratch(), {
      legalForm: 'micro',
      activityCategory: 'service-bnc',
      urssafFrequency: 'monthly',
      registrationSubmitted: false,
      options: [],
    });
    const r = buildProfile(state, TODAY);
    expect(r.ok && r.profile.lifecyclePhase).toBe('idee');
    expect(r.ok && r.profile.revenueEntries).toEqual([]);
  });

  it('puts a user who has filed but is not registered in immatriculation', () => {
    const state = answered(startFromScratch(), {
      legalForm: 'micro',
      activityCategory: 'service-bnc',
      urssafFrequency: 'monthly',
      registrationSubmitted: true,
      options: [],
    });
    expect(buildProfile(state, TODAY)).toMatchObject({
      profile: { lifecyclePhase: 'immatriculation' },
    });
  });

  it('refuses to build while a question is unanswered, and says which', () => {
    const r = buildProfile(startFromCompany(microCompany), TODAY);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.missing).toContain('activityCategory');
  });

  it('rejects an answer the schema refuses instead of storing it', () => {
    const bad = answered(completeMicro, { revenueYtd: -5 });
    const r = buildProfile(bad, TODAY);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.missing).toContain('revenueYtd');
  });

  it('does not carry a closed company forward as a running business', () => {
    const closed = { ...microCompany, active: false, closedOn: '2026-06-30' };
    const state = answered(startFromCompany(closed), {
      legalForm: 'micro',
      activityCategory: 'vente',
      urssafFrequency: 'monthly',
      options: [],
      revenueYtd: 0,
      setupStepsComplete: false,
    });
    const r = buildProfile(state, TODAY);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.missing).toContain('company-closed');
  });
});
