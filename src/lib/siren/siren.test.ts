import { describe, it, expect, vi } from 'vitest';
import { isValidSiren, normalizeSiren } from './validate';
import { mapCompany, legalFormCandidates } from './map';
import { lookupBySiren, searchByName } from './client';

/** A real payload, trimmed to the fields the mapper reads. */
const MULTI = {
  siren: '830141321',
  nom_complet: 'MULTI',
  nom_raison_sociale: 'MULTI',
  date_creation: '2017-06-01',
  date_fermeture: null,
  activite_principale: '62.09Z',
  nature_juridique: '5710',
  etat_administratif: 'A',
};

function respondWith(body: unknown, init: { status?: number } = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  );
}

describe('normalizeSiren', () => {
  it('keeps only digits, so a pasted number with spaces works', () => {
    expect(normalizeSiren(' 830 141 321 ')).toBe('830141321');
    expect(normalizeSiren('830-141-321')).toBe('830141321');
  });
});

describe('isValidSiren', () => {
  it('accepts a real SIREN', () => {
    expect(isValidSiren('830141321')).toBe(true);
  });

  it('rejects a single-digit typo that keeps the length', () => {
    expect(isValidSiren('830141322')).toBe(false);
  });

  it.each(['', '83014132', '8301413211', '83014132a'])('rejects %o', (bad) => {
    expect(isValidSiren(bad)).toBe(false);
  });

  it('accepts La Poste, the documented SIREN that fails Luhn', () => {
    expect(isValidSiren('356000000')).toBe(true);
  });
});

describe('legalFormCandidates', () => {
  it('leaves micro vs EI open — the register cannot see a tax regime', () => {
    expect(legalFormCandidates('1000')).toEqual(['micro', 'ei']);
  });

  it('settles a SASU', () => {
    expect(legalFormCandidates('5720')).toEqual(['sasu']);
  });

  it('offers eurl for the SARL family, which cannot be told apart in the register', () => {
    expect(legalFormCandidates('5498')).toEqual(['eurl']);
    expect(legalFormCandidates('5410')).toEqual(['eurl']);
  });

  it('offers nothing for forms v1 does not cover', () => {
    expect(legalFormCandidates('5710')).toEqual([]); // SAS, several associates
    expect(legalFormCandidates('9220')).toEqual([]); // association
    expect(legalFormCandidates(undefined)).toEqual([]);
  });
});

describe('mapCompany', () => {
  it('keeps what the registry knows', () => {
    expect(mapCompany(MULTI)).toEqual({
      siren: '830141321',
      name: 'MULTI',
      registeredOn: '2017-06-01',
      apeCode: '62.09Z',
      natureJuridique: '5710',
      active: true,
      closedOn: undefined,
      legalFormCandidates: [],
    });
  });

  it('treats anything but "A" as not active, including a missing state', () => {
    expect(mapCompany({ ...MULTI, etat_administratif: 'C' })?.active).toBe(false);
    expect(mapCompany({ ...MULTI, etat_administratif: undefined })?.active).toBe(false);
  });

  it('falls back through the name fields, then to the SIREN', () => {
    expect(mapCompany({ ...MULTI, nom_complet: null })?.name).toBe('MULTI');
    expect(mapCompany({ siren: '830141321' })?.name).toBe('830141321');
  });

  it('drops a record with no SIREN', () => {
    expect(mapCompany({ nom_complet: 'X' })).toBeNull();
  });
});

describe('lookupBySiren', () => {
  it('returns the exact match', async () => {
    const fetchImpl = respondWith({ results: [MULTI] });
    const r = await lookupBySiren('830 141 321', { fetchImpl });
    expect(r.ok && r.value.siren).toBe('830141321');
  });

  it('rejects a typo without calling the API at all', async () => {
    const fetchImpl = respondWith({ results: [] });
    const r = await lookupBySiren('830141322', { fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'invalid-siren', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not accept a near miss the search engine returned instead', async () => {
    const fetchImpl = respondWith({ results: [{ ...MULTI, siren: '999999999' }] });
    const r = await lookupBySiren('830141321', { fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'not-found', retryable: false });
  });

  it.each([
    [429, 'rate-limited', true],
    [500, 'unavailable', true],
    [404, 'unavailable', true],
  ])('maps HTTP %i to %s', async (status, reason, retryable) => {
    const fetchImpl = respondWith({}, { status });
    const r = await lookupBySiren('830141321', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe(reason);
    expect(r.ok === false && r.retryable).toBe(retryable);
  });

  it('maps a thrown fetch to a retryable network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const r = await lookupBySiren('830141321', { fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'network', retryable: true });
  });

  it('treats an unparseable body as unavailable rather than empty', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }));
    const r = await lookupBySiren('830141321', { fetchImpl });
    expect(r.ok === false && r.reason).toBe('unavailable');
  });

  it('treats a body without a results array as unavailable', async () => {
    const fetchImpl = respondWith({ message: 'nope' });
    const r = await lookupBySiren('830141321', { fetchImpl });
    expect(r.ok === false && r.reason).toBe('unavailable');
  });

  it('gives up on a hung request instead of hanging the screen', async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    ) as unknown as typeof fetch;
    const r = await lookupBySiren('830141321', { fetchImpl, timeoutMs: 10 });
    expect(r).toEqual({ ok: false, reason: 'network', retryable: true });
  });
});

describe('searchByName', () => {
  it('returns the matches', async () => {
    const fetchImpl = respondWith({ results: [MULTI, { ...MULTI, siren: '830141322' }] });
    const r = await searchByName('multi', { fetchImpl });
    expect(r.ok && r.value).toHaveLength(2);
  });

  it('answers an empty query locally', async () => {
    const fetchImpl = respondWith({ results: [MULTI] });
    const r = await searchByName('   ', { fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'not-found', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports no matches as not-found, not as an empty success', async () => {
    const fetchImpl = respondWith({ results: [] });
    const r = await searchByName('zzzzzz', { fetchImpl });
    expect(r).toEqual({ ok: false, reason: 'not-found', retryable: false });
  });

  it('skips records with no SIREN but keeps the rest', async () => {
    const fetchImpl = respondWith({ results: [{ nom_complet: 'broken' }, MULTI] });
    const r = await searchByName('multi', { fetchImpl });
    expect(r.ok && r.value.map((c) => c.siren)).toEqual(['830141321']);
  });
});
