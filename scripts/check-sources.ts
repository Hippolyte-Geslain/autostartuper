/**
 * The truth watchdog: has an official page moved under our rules?
 *
 * Re-fetches every archived fiche, compares it with the copy in git, and
 * reports what changed and which rules that puts in doubt. Run weekly by
 * `.github/workflows/truth-watchdog.yml`.
 *
 * What it deliberately does NOT do: touch a rule. A changed page is a signal
 * that a human must read the page and decide. Truth changes only through a
 * reviewed commit — an app that quietly rewrites its own tax figures because a
 * web page moved is exactly what this project refuses to be.
 *
 * Usage:
 *   npx tsx scripts/check-sources.ts            report only, exit 1 on change
 *   npx tsx scripts/check-sources.ts --update    also rewrite the archive
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFiche, diffFiche, type Fiche } from '../src/lib/truth/fiche';
import { coverageOf, rulesCiting } from '../src/lib/truth/coverage';
import { loadRules } from '../src/lib/rules/loader';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES_DIR = join(ROOT, 'docs', 'sources');
const BASE = 'https://entreprendre.service-public.gouv.fr/vosdroits';
const RULES_DIR = join(ROOT, 'rules');

interface Archived {
  fiche: string;
  file: string;
  parsed: Fiche;
}

/** Reads an archived file back into the same shape a fresh fetch produces. */
function readArchived(file: string): Archived | undefined {
  const fiche = /^(F\d+)/.exec(file)?.[1];
  if (!fiche) return undefined;
  const raw = readFileSync(join(SOURCES_DIR, file), 'utf8');
  const afterFront = raw.slice(raw.indexOf('---', 3) + 3);
  const body = afterFront.replace(/^\s*>.*$/gm, '').trim();
  const title = /title: "(.*)"/.exec(raw)?.[1] ?? '';
  const verifiedOn = /verified_on_source: "(.*)"/.exec(raw)?.[1] ?? 'inconnu';
  return { fiche, file, parsed: { title, verifiedOn, body } };
}

function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

/** GitHub renders these as annotations; elsewhere they are just readable lines. */
function annotate(level: 'warning' | 'error', message: string): void {
  const flat = message.replace(/\n/g, ' ');
  console.log(isGitHubActions() ? `::${level}::${flat}` : `[${level}] ${flat}`);
}

async function main(): Promise<void> {
  const update = process.argv.includes('--update');
  const rules = loadRules(RULES_DIR);

  const archived = readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readArchived)
    .filter((a): a is Archived => Boolean(a));

  const coverage = coverageOf(rules, archived.map((a) => a.fiche));

  // Blind spots first: they are the failure this whole script exists to avoid,
  // and they are true whether or not anything changed this week.
  for (const { ruleId, fiche, url } of coverage.missing) {
    annotate('error', `${ruleId}: source ${fiche} is not archived — the watchdog cannot see it (${url})`);
    process.exitCode = 1;
  }
  for (const { ruleId, url } of coverage.unsupported) {
    annotate('warning', `${ruleId}: ${url} cannot be archived automatically — check it by hand`);
  }

  const changes: string[] = [];

  for (const entry of archived) {
    let response: Response;
    try {
      response = await fetch(`${BASE}/${entry.fiche}`, { signal: AbortSignal.timeout(20_000) });
    } catch {
      annotate('warning', `${entry.fiche}: unreachable — not a change, but nothing was verified`);
      continue;
    }
    if (!response.ok) {
      annotate('warning', `${entry.fiche}: HTTP ${response.status} — nothing was verified`);
      continue;
    }

    const fresh = extractFiche(await response.text());
    const diff = diffFiche(entry.parsed, fresh);
    if (!diff.changed && !diff.verifiedOnChanged) {
      console.log(`${entry.fiche}: unchanged`);
      continue;
    }

    const affected = rulesCiting(rules, entry.fiche);
    const lines = [`${entry.fiche} — ${fresh.title}`];
    if (diff.verifiedOnChanged) {
      lines.push(
        `  re-verified: ${diff.verifiedOnChanged.from} → ${diff.verifiedOnChanged.to}`
      );
    }
    if (diff.figuresRemoved.length > 0) lines.push(`  figures gone: ${diff.figuresRemoved.join(', ')}`);
    if (diff.figuresAdded.length > 0) lines.push(`  figures new:  ${diff.figuresAdded.join(', ')}`);
    if (diff.changed && diff.figuresAdded.length === 0 && diff.figuresRemoved.length === 0) {
      lines.push('  wording changed, no figure moved');
    }
    lines.push(`  rules citing it: ${affected.length > 0 ? affected.join(', ') : 'none'}`);
    changes.push(lines.join('\n'));

    // A moved figure on a page a rule depends on is the loudest thing this
    // script can say, so it says it as an error rather than a warning.
    const level = diff.figuresRemoved.length > 0 && affected.length > 0 ? 'error' : 'warning';
    annotate(level, lines.join(' | '));

    if (update) {
      const file = join(SOURCES_DIR, entry.file);
      const raw = readFileSync(file, 'utf8');
      const head = raw.slice(0, raw.indexOf('---', 3) + 3);
      const newHead = head
        .replace(/verified_on_source: ".*"/, `verified_on_source: ${JSON.stringify(fresh.verifiedOn)}`)
        .replace(/fetched_on: .*/, `fetched_on: ${new Date().toISOString().slice(0, 10)}`);
      writeFileSync(
        file,
        `${newHead}\n\n> Archived copy of an official page. The source of truth is the URL above;\n> this file exists so a change to it is visible in \`git diff\`.\n\n${fresh.body}\n`,
        'utf8'
      );
    }
  }

  console.log(
    `\n${archived.length} fiches checked, ${changes.length} changed, ` +
      `${coverage.watched.length}/${rules.length} rules watched.`
  );

  if (changes.length > 0) {
    console.log(`\n${changes.join('\n\n')}`);
    // Non-zero so the workflow can open an issue. A change is not a failure of
    // the code; it is a request for a human to read a page.
    process.exitCode = 1;
  }
}

void main();
