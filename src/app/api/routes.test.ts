import { describe, it, expect, vi } from 'vitest';
import { POST as actionsPOST } from './actions/route';
import { GET as companyGET } from './company/route';

const profile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: [{ month: '2026-01', amount: 168000 }],
};

function post(body: unknown): Request {
  return new Request('http://localhost/api/actions', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/actions', () => {
  it('returns the engine result and a dashboard model', async () => {
    const res = await actionsPOST(post({ profile, today: '2026-08-07' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBe('2026-08-07');
    expect(body.actions.map((a: { id: string }) => a.id)).toContain('tva-franchise-vente');
    expect(body.dashboard.view).toBe('pilotage');
    expect(body.dashboard.nearingPlafond).toBe(true);
  });

  it('honours completed steps', async () => {
    const lancement = { ...profile, lifecyclePhase: 'lancement' };
    const res = await actionsPOST(
      post({ profile: lancement, today: '2026-08-07', completedStepIds: ['assurance-rc-pro'] })
    );
    const body = await res.json();
    expect(body.dashboard.steps.map((s: { id: string }) => s.id)).not.toContain('assurance-rc-pro');
  });

  it('rejects a tampered profile instead of matching nothing', async () => {
    const res = await actionsPOST(post({ profile: { ...profile, legalForm: 'sarl' } }));
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe('invalid-profile');
  });

  it('rejects a body that is not JSON', async () => {
    const res = await actionsPOST(post('not json'));
    expect(res.status).toBe(400);
  });

  it('falls back to the current date when today is malformed', async () => {
    const res = await actionsPOST(post({ profile, today: '07/08/2026' }));
    expect(res.status).toBe(200);
    expect((await res.json()).today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores non-string entries in completedStepIds', async () => {
    const res = await actionsPOST(
      post({ profile, today: '2026-08-07', completedStepIds: [1, null, 'assurance-rc-pro'] })
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /api/company', () => {
  const original = globalThis.fetch;

  function withFetch(body: unknown, status = 200) {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    ) as unknown as typeof fetch;
  }

  const record = {
    siren: '830141321',
    nom_complet: 'MULTI',
    date_creation: '2017-06-01',
    nature_juridique: '5720',
    etat_administratif: 'A',
  };

  it('requires a search term', async () => {
    const res = await companyGET(new Request('http://localhost/api/company'));
    expect(res.status).toBe(400);
    globalThis.fetch = original;
  });

  it('returns a single SIREN hit as a list of one', async () => {
    withFetch({ results: [record] });
    const res = await companyGET(new Request('http://localhost/api/company?siren=830141321'));
    const body = await res.json();
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].legalFormCandidates).toEqual(['sasu']);
    globalThis.fetch = original;
  });

  it('maps a typo to 400 without calling out', async () => {
    withFetch({ results: [] });
    const res = await companyGET(new Request('http://localhost/api/company?siren=830141322'));
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    globalThis.fetch = original;
  });

  it('maps a rate limit to 429 so the client can offer a retry', async () => {
    withFetch({}, 429);
    const res = await companyGET(new Request('http://localhost/api/company?q=multi'));
    expect(res.status).toBe(429);
    expect((await res.json()).retryable).toBe(true);
    globalThis.fetch = original;
  });

  it('maps no match to 404', async () => {
    withFetch({ results: [] });
    const res = await companyGET(new Request('http://localhost/api/company?q=zzzz'));
    expect(res.status).toBe(404);
    globalThis.fetch = original;
  });
});
