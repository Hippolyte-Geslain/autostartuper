/**
 * Domains we accept as the source of truth for a rule.
 * A rule is only trustworthy if it points back to an official French
 * government page, so every `source_url` must live under one of these.
 */
export const OFFICIAL_SUFFIXES = [
  'gouv.fr',
  'service-public.fr',
  'urssaf.fr',
  'inpi.fr',
  'insee.fr',
] as const;

/**
 * True when `url` is an https URL whose host is one of the official domains
 * or a subdomain of one.
 *
 * Two things are deliberately strict:
 * - https only, so a typo'd scheme or an http downgrade never counts as official.
 * - the dot boundary, so `evilgouv.fr` and `x.gouv.fr.evil.com` are rejected
 *   while `impots.gouv.fr` and the bare `gouv.fr` are accepted.
 */
export function isOfficialSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    return OFFICIAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
