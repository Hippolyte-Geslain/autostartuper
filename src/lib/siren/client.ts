/**
 * The one call the app makes to an outside service during assessment.
 *
 * `recherche-entreprises.api.gouv.fr` is the public, keyless search over the
 * INSEE Sirene and RNE data. No account, no token, rate-limited per IP.
 *
 * Every failure is **returned, not thrown**, and every returned failure says
 * whether retrying could help. That is what lets the UI honour the spec's
 * global retry rule: a [Réessayer] button next to a manual-entry path, on every
 * error screen, without the screen having to know what went wrong.
 */
import { isValidSiren, normalizeSiren } from './validate';
import { mapCompany, type RegistryCompany, type RegistryPayload } from './map';

const ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';
const DEFAULT_TIMEOUT_MS = 8000;

export type LookupFailure =
  /** The number is not a SIREN — a typo, caught before any request. */
  | { ok: false; reason: 'invalid-siren'; retryable: false }
  /** The registry has no such business, or the search matched nothing. */
  | { ok: false; reason: 'not-found'; retryable: false }
  /** Too many calls from this IP. Retrying later works. */
  | { ok: false; reason: 'rate-limited'; retryable: true }
  /** The service answered with an error, or answered nonsense. */
  | { ok: false; reason: 'unavailable'; retryable: true; status?: number }
  /** No answer: offline, DNS, timeout. */
  | { ok: false; reason: 'network'; retryable: true };

export type LookupResult<T> = { ok: true; value: T } | LookupFailure;

export interface LookupOptions {
  /** Injected in tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Shared plumbing: one GET, one JSON body, every failure mapped to a reason. */
async function getResults(
  params: URLSearchParams,
  options: LookupOptions
): Promise<LookupResult<RegistryCompany[]>> {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // A hung request is a hung screen. The timeout turns it into an ordinary
  // retryable failure, which the UI already knows how to show.
  const timer = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timer]) : timer;

  let response: Response;
  try {
    response = await doFetch(`${ENDPOINT}?${params}`, { signal });
  } catch {
    return { ok: false, reason: 'network', retryable: true };
  }

  if (response.status === 429) return { ok: false, reason: 'rate-limited', retryable: true };
  if (!response.ok) {
    return { ok: false, reason: 'unavailable', retryable: true, status: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'unavailable', retryable: true, status: response.status };
  }

  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) {
    return { ok: false, reason: 'unavailable', retryable: true, status: response.status };
  }

  // A record without a SIREN is unusable rather than fatal — drop it and keep
  // the rest, so one odd row cannot empty a search.
  const companies = results
    .map((r) => mapCompany(r as RegistryPayload))
    .filter((c): c is RegistryCompany => c !== null);

  return { ok: true, value: companies };
}

/**
 * One business by its SIREN.
 *
 * The number is checked locally first, so a typo never costs a round trip.
 * A search that matches something *else* (the API is a search engine, not a
 * key-value store) is treated as not-found: only an exact SIREN match is the
 * business the user asked for.
 */
export async function lookupBySiren(
  input: string,
  options: LookupOptions = {}
): Promise<LookupResult<RegistryCompany>> {
  const siren = normalizeSiren(input);
  if (!isValidSiren(siren)) return { ok: false, reason: 'invalid-siren', retryable: false };

  const result = await getResults(new URLSearchParams({ q: siren, per_page: '1' }), options);
  if (!result.ok) return result;

  const exact = result.value.find((c) => c.siren === siren);
  if (!exact) return { ok: false, reason: 'not-found', retryable: false };
  return { ok: true, value: exact };
}

/**
 * Businesses matching a name, most relevant first.
 *
 * For the user who does not have their SIREN to hand — which is most people
 * early on. An empty query is answered locally: the API would return an
 * arbitrary page of businesses, and offering those as "your company" would be
 * worse than saying nothing was found.
 */
export async function searchByName(
  query: string,
  options: LookupOptions & { limit?: number } = {}
): Promise<LookupResult<RegistryCompany[]>> {
  const q = query.trim();
  if (q.length === 0) return { ok: false, reason: 'not-found', retryable: false };

  const result = await getResults(
    new URLSearchParams({ q, per_page: String(options.limit ?? 10) }),
    options
  );
  if (!result.ok) return result;
  if (result.value.length === 0) return { ok: false, reason: 'not-found', retryable: false };
  return result;
}
