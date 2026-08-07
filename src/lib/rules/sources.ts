/**
 * Domains we accept as the source of truth for a rule.
 * A rule is only trustworthy if it points back to an official French
 * government page, so every `source_url` must live under one of these.
 */
const OFFICIAL_SUFFIXES = ['gouv.fr', 'service-public.fr', 'urssaf.fr', 'inpi.fr', 'insee.fr'];

/**
 * True when `url` is a valid URL whose host is one of the official domains
 * or a subdomain of one. The dot boundary matters: `evilgouv.fr` is rejected,
 * `impots.gouv.fr` is accepted.
 */
export function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OFFICIAL_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}
