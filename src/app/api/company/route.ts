/**
 * Company lookup, proxied through our own origin.
 *
 * The registry API is public and keyless, so the browser could call it
 * directly. It goes through here anyway for two reasons: the browser never
 * depends on a third party's CORS headers, and the rate limit that matters
 * becomes ours to see and to handle in one place.
 */
import { lookupBySiren, searchByName } from '@/lib/siren/client';

/** Registry answers change rarely, but never cache a lookup: it is per-user. */
export const dynamic = 'force-dynamic';

/** Failure reason → HTTP status. Retryable reasons keep their 5xx/429 meaning. */
const STATUS: Record<string, number> = {
  'invalid-siren': 400,
  'not-found': 404,
  'rate-limited': 429,
  unavailable: 502,
  network: 504,
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siren = params.get('siren');
  const query = params.get('q');

  if (!siren && !query) {
    return Response.json(
      { ok: false, reason: 'bad-request', retryable: false, message: 'siren ou q est requis' },
      { status: 400 }
    );
  }

  const result = siren ? await lookupBySiren(siren) : await searchByName(query!);

  if (!result.ok) {
    return Response.json(result, { status: STATUS[result.reason] ?? 502 });
  }

  // Always a list, whichever way the user searched: one shape for the client to
  // render, and a SIREN hit is simply a list of one.
  const companies = Array.isArray(result.value) ? result.value : [result.value];
  return Response.json({ ok: true, companies });
}
