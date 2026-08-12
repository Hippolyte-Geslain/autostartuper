/**
 * Archives an official fiche as Markdown under `docs/sources/`.
 *
 * Why keep a copy at all: a rule's `source_url` proves where a figure came
 * from, but not what the page said on the day someone read it. When a
 * threshold changes, the useful question is "what changed" — and that needs the
 * previous text, in git, next to the rule it justified.
 *
 * This is also the first half of the M6 truth watchdog: re-run it, and `git
 * diff` is the change report.
 *
 * Usage:
 *   npx tsx scripts/fetch-source.ts F23844 F37398 …
 *   npx tsx scripts/fetch-source.ts --all      (refresh everything archived)
 */
import { writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Shared with the watchdog on purpose: if the two parsed pages differently,
// every fiche would look changed on the next check.
import { extractFiche } from '../src/lib/truth/fiche';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'sources');
const BASE = 'https://entreprendre.service-public.gouv.fr/vosdroits';

function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function archive(fiche: string): Promise<void> {
  const url = `${BASE}/${fiche}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    console.error(`${fiche}: HTTP ${response.status} — skipped`);
    process.exitCode = 1;
    return;
  }

  const { title, verifiedOn, body } = extractFiche(await response.text());
  if (body.length < 500) {
    // A page that short is a redirect or an error page dressed as a 200.
    console.error(`${fiche}: content too short (${body.length} chars) — skipped`);
    process.exitCode = 1;
    return;
  }

  const file = join(OUT_DIR, `${fiche}-${slugify(title)}.md`);
  const front = [
    '---',
    `fiche: ${fiche}`,
    `title: ${JSON.stringify(title)}`,
    `url: ${url}`,
    `verified_on_source: ${JSON.stringify(verifiedOn)}`,
    `fetched_on: ${new Date().toISOString().slice(0, 10)}`,
    '---',
    '',
    `> Archived copy of an official page. The source of truth is the URL above;`,
    `> this file exists so a change to it is visible in \`git diff\`.`,
    '',
  ].join('\n');

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(file, `${front}\n${body}\n`, 'utf8');
  console.log(`${fiche}: ${title} (vérifié le ${verifiedOn}) → ${file.replace(ROOT, '.')}`);
}

function archivedFiches(): string[] {
  try {
    return readdirSync(OUT_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => /^(F\d+)/.exec(f)?.[1])
      .filter((f): f is string => Boolean(f));
  } catch {
    return [];
  }
}

// Wrapped rather than top-level `await`: tsx compiles this to CommonJS, where
// top-level await is a hard error.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: tsx scripts/fetch-source.ts <F-number…> | --all');
    process.exit(2);
  }

  const fiches = args[0] === '--all' ? archivedFiches() : args;
  for (const fiche of fiches) {
    if (!/^F\d+$/.test(fiche)) {
      console.error(`${fiche}: not a fiche id — skipped`);
      process.exitCode = 1;
      continue;
    }
    // Sequential on purpose: this hits a public service, and a burst of
    // parallel requests is how a keyless API starts rate-limiting us.
    await archive(fiche);
  }
}

void main();
