/**
 * Reading an official fiche: HTML in, archivable text out.
 *
 * Extracted from the fetch script so the watchdog can use the exact same
 * parsing. If the two ever diverged, every page would look changed on the next
 * check — a watchdog that cries wolf gets muted, and then a real change to a
 * threshold goes unnoticed.
 */

/** Everything before the verification line is site chrome, not content. */
const CONTENT_START = /Vérifié le/;
/** …and the feedback widget is where the content ends. */
const CONTENT_END = /Cette page vous a-t-elle été utile/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  ecirc: 'ê',
  ocirc: 'ô',
  ucirc: 'û',
  icirc: 'î',
  euro: '€',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  mdash: '—',
  ndash: '–',
  deg: '°',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole);
}

/** HTML → readable plain text. Crude by design: this is an archive, not a renderer. */
export function toText(html: string): string {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withBreaks = withoutCode
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<br\s*\/?>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

export interface Fiche {
  title: string;
  /** The site's own freshness stamp, e.g. "10 avril 2026", or "inconnu". */
  verifiedOn: string;
  body: string;
}

export function extractFiche(html: string): Fiche {
  const rawTitle = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  const title = decodeEntities(rawTitle).replace(/\s*\|\s*Service Public.*$/i, '').trim();

  const text = toText(html);
  const start = text.search(CONTENT_START);
  const end = text.search(CONTENT_END);
  const body = text.slice(start === -1 ? 0 : start, end === -1 ? undefined : end).trim();
  const verifiedOn = /Vérifié le ([^-\n]+)/.exec(body)?.[1]?.trim() ?? 'inconnu';

  return { title, verifiedOn, body };
}

/**
 * Every amount and percentage in a text, as written.
 *
 * The watchdog reports any change, but a changed *number* is the one that can
 * silently make a rule wrong, so those are pulled out and compared separately.
 * Matching is on the French forms the fiches use: "203 100 €", "21,2 %".
 */
export function extractFigures(text: string): string[] {
  const matches = text.match(/\d[\d  ]*(?:,\d+)?\s?(?:€|%)/g) ?? [];
  return matches.map((m) => m.replace(/\s+/g, ' ').trim());
}

/** What changed between an archived body and a freshly fetched one. */
export interface FicheDiff {
  changed: boolean;
  /** Figures present before and gone now — the dangerous direction. */
  figuresRemoved: string[];
  /** Figures that are new. */
  figuresAdded: string[];
  verifiedOnChanged?: { from: string; to: string };
}

/**
 * Compares an archived fiche against a fresh one.
 *
 * Whitespace is normalised on both sides first: the site re-flows its markup
 * often enough that a raw comparison would report a change every week and
 * teach whoever reads the report to ignore it.
 */
export function diffFiche(archived: Fiche, fresh: Fiche): FicheDiff {
  const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();
  const before = extractFigures(archived.body);
  const after = extractFigures(fresh.body);

  return {
    changed: normalise(archived.body) !== normalise(fresh.body),
    figuresRemoved: before.filter((f) => !after.includes(f)),
    figuresAdded: after.filter((f) => !before.includes(f)),
    verifiedOnChanged:
      archived.verifiedOn === fresh.verifiedOn
        ? undefined
        : { from: archived.verifiedOn, to: fresh.verifiedOn },
  };
}

/** The fiche id inside an official URL, when there is one (`…/vosdroits/F23844`). */
export function ficheIdOf(url: string): string | undefined {
  return /\/(F\d+)(?:[/?#]|$)/.exec(url)?.[1];
}
