# M1 — Foundation + Rules Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the AutoStartUper app and build its deterministic core: rules-as-data (YAML, validated, sourced) + a pure roadmap engine turning (rules, profile, today) into dated action instances, proven by golden persona tests and CI.

**Architecture:** Next.js app (Vercel-ready) with a self-contained pure-TypeScript rules engine under `src/lib/rules/`. Truth lives in `rules/*.yaml` at the repo root — every record carries `source_url` (official domains only), `verified_on`, and a millésime. No database in M1; profiles are in-memory fixtures. Spec: `docs/superpowers/specs/2026-08-07-autostartuper-design.md`.

**Tech Stack:** Next.js 16 (App Router, TS, Tailwind), zod 4, yaml, vitest 4, tsx, GitHub Actions. (Versions as installed by Task 1 — plan snippets are zod-4 compatible; prefer `z.strictObject({...})` over the deprecated `z.object({...}).strict()`.)

**Milestone context:** M1 of 6. M2 auth+assessment, M3 dashboards+preparer, M4 notifications, M5 AI edges, M6 truth watchdog. Later milestones consume `computeActions()` and the rule schemas defined here.

**Branch note:** Greenfield solo repo — work directly on `master`, commit per task step.

**Amendments during execution (Task 2 review):** the schema contract in `src/lib/rules/types.ts` is stricter than the snippets below — source URLs must be **https** on official domains (`OFFICIAL_SUFFIXES` exported); dates are calendar-validated (`IsoDateSchema` exported; `Millesime` type exported for Task 6); `valid_until >= valid_from` enforced; rule `id` must match `/^[a-z0-9-]+$/`; `options_all`/`options_none` use the closed `KnownOptionSchema` enum (`acre`, `versement-liberatoire`); all rule/schedule objects are strictObject (unknown keys reject); `warn_ratio` is exclusive (0,1). Deferred hardening: prerequisite referential integrity → Task 3 loader; `verified_on` not-in-future + staleness warning → Task 4 script. All plan YAML/fixtures already conform.

**Amendments (Task 9):** the open `idee` question is settled **in the engine, not in the rules**: `computeActions` drops all obligations and threshold alerts for a profile in the `idee` phase (`isRegistered`), because an unregistered founder has no SIREN, no Urssaf account and no turnover — a fact about the phase rather than about any one rule, and one a future rule author cannot forget to write. Rules needing a finer distinction still use `applies_to.lifecycle_phases`; roadmap steps are untouched (steps are exactly what an `idee` profile should see). Persona **Théo** pins the gate, and persona **Sofia** is now asserted empty at a `today` where the CFE date *is* inside the horizon, so her empty list can no longer pass by coincidence. `ActionInstance`'s `threshold-alert` variant carries `ytd` and `limit` (euro-exact, for the M2 gauge caption) and derives `level` from `ThresholdAlert['level']`. `computeActions` guards `ctx.today` via `parseISO` — an empty action list is a legitimate answer, so a malformed date must not be able to produce one. Synthetic fixtures using `77700` (now a *stale real* figure) were changed to an obviously fake `100000`.

**Amendments (Task 8 review):** the plan's micro plafonds were the **stale 2023-2025 vintage**. The seeded rules carry the current millésime: **203 100 € (vente)** and **83 600 € (services)**, `valid_from: 2026-01-01`, `valid_until: 2028-12-31` (service-public F32353 + actualité A18813 state 2026, 2027 and 2028 explicitly; `impots.gouv.fr`'s micro FAQ still serves the old figures — do not "correct" back). TVA franchise 85 000 / 37 500 confirmed unchanged (the single 25 000 € threshold was repealed by law 2025-1044 of 2025-11-03). **Source URL corrections:** F36239 (an EURL page) → **F35991** for the dedicated bank account; `urssaf.fr` is unreachable from this environment → **F23257** for declaration timing; canonical host is `entreprendre.service-public.gouv.fr`. **v1 scoping:** every seeded rule is scoped `legal_forms: [micro]`, including `cfe-paiement` (which the CFE law does not limit to micro) — the marker comment `# v1: rule scoped to micro; other forms in M2+` distinguishes scope from fact. **Task 9 consequence:** persona Karim was 7 × 23 000 = 161 000 €, which against the new 203 100 € plafond is ratio 0.7927 — below `warn_ratio` 0.8, so no alert fires and the persona stops exercising the warning band. Karim is now 7 × 24 000 = **168 000 €** (plafond 168000/203100 = 0.8272 → warning; TVA 168000/85000 = 1.9765 → exceeded).

**Amendments (Task 7 review):** `ThresholdAlert` carries `ytd` (euros) and no `thresholdId` (engine maps `r.id`); sums are cent-exact; `evaluateThreshold` guards `today` via `parseISO`; the prerequisite check in `pendingSteps` is deliberately SHALLOW (completing a step implies its preconditions). **Guards for later tasks:** Task 8 seed rules must declare NO prerequisites until the loader gains a per-profile satisfiability check (a prereq whose `applies_to` excludes a user blocks its dependents forever, silently); Task 9 derives the alert level union from `ThresholdAlert['level']`; M2 adds `RevenueEntrySchema` before revenue comes from user input.

**Amendments (Task 6 review):** `AppliesTo` arrays require `.min(1)` (empty `legal_forms: []` used to load and silently match nobody; omit the field for "no constraint"). **Open decision deferred to M2+ (before any second millésime is authored):** the non-overlap invariant between successive millésimes of the same rule is currently maintained by hand — the schema has no lineage field (`supersedes`/family key), so `validateRuleGraph` cannot detect two overlapping vintages of one rule. Decide lineage + loader overlap check when the first year-change lands (watchdog era). Do not bolt it onto the matcher; `activeOn` is deliberately a per-rule predicate.

**Amendments (Task 5 review):** `parseISO` throws `TypeError` on non-`YYYY-MM-DD` input (kills a confirmed infinite-loop on malformed dates; the `ISO_DATE` regex lives in `dates.ts`, consumed by `types.ts`); invalid-input contract for date helpers is THROW, never silent NaN (branded ISODate type deliberately not adopted for M1); `expandAnnual` takes the schedule object (`expandAnnual(r.schedule, from, to)`) and throws on out-of-range month; `expandPeriodic` freq is `UrssafFrequency`; year-boundary dues (December period → Jan 31) are pinned by tests. Task 9's engine snippet below already reflects the new signature.

**Amendments (Task 4 review):** `validate-rules` grew beyond the two-line plan version: `--min <n>` count guard (space and equals forms, unknown args rejected, `--help`), future-`verified_on` errors and 183-day staleness warnings (pure logic in `src/lib/rules/freshness.ts`, tested; "stale after 183 days" — exactly 183 does not warn), file-named errors via `loadRulesWithFiles`, stale warnings printed even alongside hard failures, `::warning::` annotations under GitHub Actions, local-date `today`, cwd-independent rules path. CI (Task 10) must call `npm run validate:rules -- --min 9`.

**Amendments (Task 3 review):** loader collects ALL problems in one throw (schema, malformed YAML per-file with path, duplicates naming both files, dangling prerequisites, prerequisite cycles via DFS); prerequisites must reference **roadmap_step ids only** (a prereq naming a threshold/obligation id is an error — non-step prereqs could never complete and would silently hide steps); graph checks live in exported `validateRuleGraph()`; `walk` does not follow symlinks/junctions. Task 4 note: `validate-rules` should assert a minimum rule count once Task 8 seeds real rules (empty-dir green is only acceptable while `rules/` is empty) and add `verified_on` not-in-future + staleness warnings.

---

## File Structure

```
rules/                                # THE TRUTH — YAML, one rule per file
  obligations/urssaf-declaration-micro.yaml
  obligations/cfe-paiement.yaml
  thresholds/plafond-micro-vente.yaml
  thresholds/plafond-micro-services.yaml
  thresholds/tva-franchise-vente.yaml
  thresholds/tva-franchise-services.yaml
  steps/assurance-rc-pro.yaml
  steps/compte-bancaire-dedie.yaml
  steps/declaration-initiale-cfe.yaml
scripts/validate-rules.ts             # CLI: load + validate all rules, exit 1 on error
src/lib/rules/
  types.ts        # zod schemas + inferred types + BusinessProfile
  sources.ts      # isOfficialSource()
  dates.ts        # ISO date helpers (pure, no lib)
  loader.ts       # walk rules/, parse YAML, validate, dedupe ids
  matcher.ts      # appliesTo(), activeOn()
  scheduler.ts    # expandPeriodic(), expandAnnual()
  thresholds.ts   # evaluateThreshold()
  steps.ts        # pendingSteps()
  engine.ts       # computeActions() — the only public entry point
  __fixtures__/personas.ts
  __fixtures__/rules-valid/ok-obligation.yaml
  __fixtures__/rules-invalid/bad-source.yaml
  __fixtures__/rules-invalid/dup-a.yaml
  __fixtures__/rules-invalid/dup-b.yaml
  *.test.ts       # co-located vitest tests
.github/workflows/ci.yml
```

Each module has one responsibility; `engine.ts` is the only file later milestones import.

---

### Task 1: Scaffold Next.js + test tooling

**Files:**
- Create: Next.js scaffold (via CLI), `vitest.config.ts`
- Modify: `package.json` (scripts), `.gitignore` (verify)

- [ ] **Step 1: Scaffold (move `.superpowers` aside — create-next-app rejects unknown dirs)**

```bash
mv .superpowers ../AutoStartUper-superpowers-backup
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
mv ../AutoStartUper-superpowers-backup .superpowers
```

Expected: scaffold completes; `src/app/` exists.

- [ ] **Step 2: Verify `.gitignore` still contains our entries** (create-next-app may have replaced it)

Required lines — re-add any that are missing:

```
.superpowers/
node_modules/
.env
.env.*
.vercel/
```

- [ ] **Step 3: Install engine dependencies**

```bash
npm i zod yaml
npm i -D vitest tsx
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
```

- [ ] **Step 5: Add npm scripts** — in `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"validate:rules": "tsx scripts/validate-rules.ts"
```

- [ ] **Step 6: Smoke check**

Run: `npm test`
Expected: exits 0 ("no test files found" is OK — `passWithNoTests`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest tooling"
```

---

### Task 2: Official-source check + rule schemas

**Files:**
- Create: `src/lib/rules/sources.ts`, `src/lib/rules/types.ts`
- Test: `src/lib/rules/sources.test.ts`, `src/lib/rules/types.test.ts`

- [ ] **Step 1: Write failing tests for `isOfficialSource`** — `src/lib/rules/sources.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isOfficialSource } from './sources';

describe('isOfficialSource', () => {
  it('accepts official domains', () => {
    expect(isOfficialSource('https://entreprendre.service-public.fr/vosdroits/F32353')).toBe(true);
    expect(isOfficialSource('https://www.impots.gouv.fr/professionnel/x')).toBe(true);
    expect(isOfficialSource('https://www.autoentrepreneur.urssaf.fr/')).toBe(true);
    expect(isOfficialSource('https://www.inpi.fr/')).toBe(true);
  });
  it('rejects non-official or malformed', () => {
    expect(isOfficialSource('https://example.com/gouv.fr')).toBe(false);
    expect(isOfficialSource('https://evilgouv.fr/')).toBe(false); // no dot boundary
    expect(isOfficialSource('not a url')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/rules/sources.test.ts`
Expected: FAIL — cannot resolve `./sources`.

- [ ] **Step 3: Implement `src/lib/rules/sources.ts`**

```ts
const OFFICIAL_SUFFIXES = ['gouv.fr', 'service-public.fr', 'urssaf.fr', 'inpi.fr', 'insee.fr'];

export function isOfficialSource(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OFFICIAL_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/rules/sources.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing tests for schemas** — `src/lib/rules/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RuleSchema } from './types';

const base = {
  id: 'test-rule',
  title: 'Test',
  source_url: 'https://entreprendre.service-public.fr/vosdroits/F00000',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: { legal_forms: ['micro'] },
};

describe('RuleSchema', () => {
  it('parses an obligation with periodic schedule', () => {
    const r = RuleSchema.parse({ ...base, type: 'obligation', schedule: { kind: 'periodic' } });
    expect(r.type).toBe('obligation');
  });
  it('defaults threshold warn_ratio to 0.8', () => {
    const r = RuleSchema.parse({ ...base, type: 'threshold', value: 77700 });
    if (r.type === 'threshold') expect(r.warn_ratio).toBe(0.8);
  });
  it('parses a roadmap step with empty prerequisites by default', () => {
    const r = RuleSchema.parse({ ...base, type: 'roadmap_step', phase: 'lancement' });
    if (r.type === 'roadmap_step') expect(r.prerequisites).toEqual([]);
  });
  it('rejects non-official source_url', () => {
    expect(() =>
      RuleSchema.parse({ ...base, type: 'threshold', value: 1, source_url: 'https://example.com/x' })
    ).toThrow();
  });
  it('rejects bad date format', () => {
    expect(() =>
      RuleSchema.parse({ ...base, type: 'threshold', value: 1, verified_on: '07/08/2026' })
    ).toThrow();
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/lib/rules/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 7: Implement `src/lib/rules/types.ts`**

```ts
import { z } from 'zod';
import { isOfficialSource } from './sources';

export const LegalFormSchema = z.enum(['micro', 'ei', 'eurl', 'sasu']);
export const ActivityCategorySchema = z.enum(['vente', 'service-bic', 'service-bnc']);
export const LifecyclePhaseSchema = z.enum(['idee', 'immatriculation', 'lancement', 'routine', 'croissance']);

export type LegalForm = z.infer<typeof LegalFormSchema>;
export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;
export type LifecyclePhase = z.infer<typeof LifecyclePhaseSchema>;

export const AppliesToSchema = z.strictObject({
  legal_forms: z.array(LegalFormSchema).optional(),
  activity_categories: z.array(ActivityCategorySchema).optional(),
  lifecycle_phases: z.array(LifecyclePhaseSchema).optional(),
  options_all: z.array(z.string()).optional(),
  options_none: z.array(z.string()).optional(),
});
export type AppliesTo = z.infer<typeof AppliesToSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const ruleBase = {
  id: z.string().min(1),
  title: z.string().min(1),
  source_url: z.string().refine(isOfficialSource, 'must be an official source (gouv.fr, service-public.fr, urssaf.fr, inpi.fr, insee.fr)'),
  verified_on: isoDate,
  valid_from: isoDate,
  valid_until: isoDate.optional(),
  applies_to: AppliesToSchema,
};

export const ScheduleSchema = z.discriminatedUnion('kind', [
  // periodic: frequency omitted -> engine reads profile.urssafFrequency
  z.object({ kind: z.literal('periodic'), frequency: z.enum(['monthly', 'quarterly']).optional() }),
  z.object({ kind: z.literal('annual'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
]);
export type Schedule = z.infer<typeof ScheduleSchema>;

export const ObligationSchema = z.object({ ...ruleBase, type: z.literal('obligation'), schedule: ScheduleSchema });
export const ThresholdSchema = z.object({
  ...ruleBase,
  type: z.literal('threshold'),
  value: z.number().positive(),
  warn_ratio: z.number().min(0).max(1).default(0.8),
});
export const RoadmapStepSchema = z.object({
  ...ruleBase,
  type: z.literal('roadmap_step'),
  phase: LifecyclePhaseSchema,
  prerequisites: z.array(z.string()).default([]),
});

export const RuleSchema = z.discriminatedUnion('type', [ObligationSchema, ThresholdSchema, RoadmapStepSchema]);

export type ObligationRule = z.infer<typeof ObligationSchema>;
export type ThresholdRule = z.infer<typeof ThresholdSchema>;
export type RoadmapStepRule = z.infer<typeof RoadmapStepSchema>;
export type Rule = z.infer<typeof RuleSchema>;

export type UrssafFrequency = 'monthly' | 'quarterly';
export interface RevenueEntry {
  month: string; // YYYY-MM
  amount: number; // euros
}
export interface BusinessProfile {
  legalForm: LegalForm;
  activityCategory: ActivityCategory;
  lifecyclePhase: LifecyclePhase;
  options: string[]; // e.g. 'acre', 'versement-liberatoire'
  urssafFrequency?: UrssafFrequency;
  revenueEntries: RevenueEntry[];
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run src/lib/rules`
Expected: PASS (all tests in both files).

- [ ] **Step 9: Commit**

```bash
git add src/lib/rules
git commit -m "feat: rule schemas with official-source and date validation"
```

---

### Task 3: Rules loader

**Files:**
- Create: `src/lib/rules/loader.ts`, fixtures under `src/lib/rules/__fixtures__/`
- Test: `src/lib/rules/loader.test.ts`

- [ ] **Step 1: Create fixture YAML files**

`src/lib/rules/__fixtures__/rules-valid/ok-obligation.yaml`:

```yaml
id: ok-obligation
type: obligation
title: Obligation de test
applies_to:
  legal_forms: [micro]
schedule:
  kind: periodic
source_url: https://www.autoentrepreneur.urssaf.fr/
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`src/lib/rules/__fixtures__/rules-invalid/bad-source.yaml`:

```yaml
id: bad-source
type: threshold
title: Mauvaise source
applies_to: {}
value: 100
source_url: https://example.com/not-official
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`src/lib/rules/__fixtures__/rules-invalid/dup-a.yaml` and `dup-b.yaml` (identical content except filename):

```yaml
id: duplicated-id
type: threshold
title: Doublon
applies_to: {}
value: 100
source_url: https://www.impots.gouv.fr/accueil
verified_on: 2026-08-07
valid_from: 2025-01-01
```

- [ ] **Step 2: Write failing tests** — `src/lib/rules/loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadRules } from './loader';

const FIX = join(__dirname, '__fixtures__');

describe('loadRules', () => {
  it('loads and validates a directory of YAML rules', () => {
    const rules = loadRules(join(FIX, 'rules-valid'));
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('ok-obligation');
  });
  it('throws with the offending file path on invalid rule', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/bad-source\.yaml/);
  });
  it('throws on duplicate ids', () => {
    expect(() => loadRules(join(FIX, 'rules-invalid'))).toThrow(/duplicated-id/);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/rules/loader.test.ts`
Expected: FAIL — cannot resolve `./loader`.

- [ ] **Step 4: Implement `src/lib/rules/loader.ts`**

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { Rule, RuleSchema } from './types';

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

export function loadRules(dir: string): Rule[] {
  const files = walk(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const rules: Rule[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const res = RuleSchema.safeParse(parse(readFileSync(file, 'utf8')));
    if (res.success) rules.push(res.data);
    else errors.push(`${file}: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }

  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) errors.push(`duplicate rule id: ${r.id}`);
    seen.add(r.id);
  }

  if (errors.length) throw new Error(`Invalid rules:\n${errors.join('\n')}`);
  return rules;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/rules/loader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rules
git commit -m "feat: YAML rules loader with validation and duplicate detection"
```

---

### Task 4: validate-rules script

**Files:**
- Create: `scripts/validate-rules.ts`, `rules/.gitkeep`

- [ ] **Step 1: Create empty rules dir**

```bash
mkdir -p rules && touch rules/.gitkeep
```

- [ ] **Step 2: Implement `scripts/validate-rules.ts`**

```ts
import { loadRules } from '../src/lib/rules/loader';

const rules = loadRules('rules');
console.log(`OK — ${rules.length} rules valid.`);
```

(`tsx` exits non-zero when `loadRules` throws — that is the failure mode CI relies on.)

- [ ] **Step 3: Run**

Run: `npm run validate:rules`
Expected: `OK — 0 rules valid.` exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts rules
git commit -m "feat: validate-rules CLI script"
```

---

### Task 5: Date helpers + schedulers

**Files:**
- Create: `src/lib/rules/dates.ts`, `src/lib/rules/scheduler.ts`
- Test: `src/lib/rules/dates.test.ts`, `src/lib/rules/scheduler.test.ts`

- [ ] **Step 1: Write failing tests** — `src/lib/rules/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, addDays, cmp } from './dates';

describe('dates', () => {
  it('lastDayOfMonth handles leap years', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-30', 5)).toBe('2026-09-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('cmp orders ISO dates', () => {
    expect(cmp('2026-01-02', '2026-01-10')).toBe(-1);
    expect(cmp('2026-01-10', '2026-01-02')).toBe(1);
    expect(cmp('2026-01-02', '2026-01-02')).toBe(0);
  });
});
```

`src/lib/rules/scheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { expandPeriodic, expandAnnual } from './scheduler';

describe('expandPeriodic', () => {
  it('monthly: due = last day of month following each period', () => {
    expect(expandPeriodic('monthly', '2026-08-07', '2026-11-05')).toEqual(['2026-08-31', '2026-09-30', '2026-10-31']);
  });
  it('quarterly: only quarter-end periods produce dues', () => {
    expect(expandPeriodic('quarterly', '2026-08-07', '2026-11-05')).toEqual(['2026-10-31']);
  });
});

describe('expandAnnual', () => {
  it('includes the annual date inside the window', () => {
    expect(expandAnnual(12, 15, '2026-10-01', '2027-01-15')).toEqual(['2026-12-15']);
  });
  it('excludes it outside the window', () => {
    expect(expandAnnual(12, 15, '2026-08-07', '2026-11-05')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/rules/dates.test.ts src/lib/rules/scheduler.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/rules/dates.ts`**

```ts
export type ISODate = string; // YYYY-MM-DD

export function parseISO(d: ISODate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}

export function toISO(y: number, m: number, day: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(d: ISODate, n: number): ISODate {
  const { y, m, day } = parseISO(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function cmp(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

- [ ] **Step 4: Implement `src/lib/rules/scheduler.ts`**

```ts
import { ISODate, parseISO, toISO, lastDayOfMonth, cmp } from './dates';

function* monthsBetween(fromY: number, fromM: number, toY: number, toM: number) {
  let y = fromY;
  let m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    yield { y, m };
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

/** Dues for periodic obligations: last day of the month following each period end. */
export function expandPeriodic(freq: 'monthly' | 'quarterly', from: ISODate, to: ISODate): ISODate[] {
  const f = parseISO(from);
  const t = parseISO(to);
  // look back 2 months so dues shortly after `from` are not missed
  let startY = f.y;
  let startM = f.m - 2;
  while (startM < 1) {
    startM += 12;
    startY--;
  }
  const out: ISODate[] = [];
  for (const { y, m } of monthsBetween(startY, startM, t.y, t.m)) {
    if (freq === 'quarterly' && m % 3 !== 0) continue;
    let dy = y;
    let dm = m + 1;
    if (dm > 12) {
      dm = 1;
      dy++;
    }
    const due = toISO(dy, dm, lastDayOfMonth(dy, dm));
    if (cmp(due, from) >= 0 && cmp(due, to) <= 0) out.push(due);
  }
  return out;
}

export function expandAnnual(month: number, day: number, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let y = parseISO(from).y; y <= parseISO(to).y; y++) {
    const d = toISO(y, month, Math.min(day, lastDayOfMonth(y, month)));
    if (cmp(d, from) >= 0 && cmp(d, to) <= 0) out.push(d);
  }
  return out;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/rules/dates.test.ts src/lib/rules/scheduler.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rules
git commit -m "feat: date helpers and obligation schedulers"
```

---

### Task 6: Matcher (applies_to + millésime)

**Files:**
- Create: `src/lib/rules/matcher.ts`
- Test: `src/lib/rules/matcher.test.ts`

- [ ] **Step 1: Write failing tests** — `src/lib/rules/matcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { appliesTo, activeOn } from './matcher';
import { BusinessProfile } from './types';

const profile: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'lancement',
  options: ['acre'],
  revenueEntries: [],
};

describe('appliesTo', () => {
  it('empty conditions match everyone', () => {
    expect(appliesTo({}, profile)).toBe(true);
  });
  it('filters by legal form', () => {
    expect(appliesTo({ legal_forms: ['micro'] }, profile)).toBe(true);
    expect(appliesTo({ legal_forms: ['eurl', 'sasu'] }, profile)).toBe(false);
  });
  it('options_all requires every option', () => {
    expect(appliesTo({ options_all: ['acre'] }, profile)).toBe(true);
    expect(appliesTo({ options_all: ['acre', 'versement-liberatoire'] }, profile)).toBe(false);
  });
  it('options_none excludes holders of the option', () => {
    expect(appliesTo({ options_none: ['acre'] }, profile)).toBe(false);
    expect(appliesTo({ options_none: ['versement-liberatoire'] }, profile)).toBe(true);
  });
});

describe('activeOn (millésime)', () => {
  const base = { valid_from: '2025-01-01' } as { valid_from: string; valid_until?: string };
  it('active from valid_from, no end', () => {
    expect(activeOn(base, '2026-08-07')).toBe(true);
    expect(activeOn(base, '2024-12-31')).toBe(false);
  });
  it('inactive after valid_until', () => {
    expect(activeOn({ ...base, valid_until: '2025-12-31' }, '2026-08-07')).toBe(false);
    expect(activeOn({ ...base, valid_until: '2026-12-31' }, '2026-08-07')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/rules/matcher.test.ts`
Expected: FAIL — cannot resolve `./matcher`.

- [ ] **Step 3: Implement `src/lib/rules/matcher.ts`**

```ts
import { AppliesTo, BusinessProfile } from './types';
import { ISODate } from './dates';

export function appliesTo(a: AppliesTo, p: BusinessProfile): boolean {
  if (a.legal_forms && !a.legal_forms.includes(p.legalForm)) return false;
  if (a.activity_categories && !a.activity_categories.includes(p.activityCategory)) return false;
  if (a.lifecycle_phases && !a.lifecycle_phases.includes(p.lifecyclePhase)) return false;
  if (a.options_all && !a.options_all.every((o) => p.options.includes(o))) return false;
  if (a.options_none && a.options_none.some((o) => p.options.includes(o))) return false;
  return true;
}

export function activeOn(r: { valid_from: string; valid_until?: string }, date: ISODate): boolean {
  if (date < r.valid_from) return false;
  if (r.valid_until && date > r.valid_until) return false;
  return true;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/rules/matcher.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules
git commit -m "feat: applies_to matcher and millesime activity check"
```

---

### Task 7: Threshold evaluator + pending steps

**Files:**
- Create: `src/lib/rules/thresholds.ts`, `src/lib/rules/steps.ts`
- Test: `src/lib/rules/thresholds.test.ts`, `src/lib/rules/steps.test.ts`

- [ ] **Step 1: Write failing tests** — `src/lib/rules/thresholds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateThreshold } from './thresholds';
import { ThresholdRule, BusinessProfile } from './types';

const rule: ThresholdRule = {
  id: 'plafond-test',
  type: 'threshold',
  title: 'Plafond test',
  value: 100_000,
  warn_ratio: 0.8,
  source_url: 'https://www.impots.gouv.fr/accueil',
  verified_on: '2026-08-07',
  valid_from: '2025-01-01',
  applies_to: {},
};

function profileWith(entries: { month: string; amount: number }[]): BusinessProfile {
  return { legalForm: 'micro', activityCategory: 'vente', lifecyclePhase: 'routine', options: [], revenueEntries: entries };
}

describe('evaluateThreshold', () => {
  it('null below warn ratio', () => {
    expect(evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 10_000 }]), '2026-08-07')).toBeNull();
  });
  it('warning at or above warn ratio', () => {
    const a = evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 80_000 }]), '2026-08-07');
    expect(a).toMatchObject({ level: 'warning' });
    expect(a!.ratio).toBeCloseTo(0.8, 5);
  });
  it('exceeded at or above 1', () => {
    const a = evaluateThreshold(rule, profileWith([{ month: '2026-01', amount: 120_000 }]), '2026-08-07');
    expect(a).toMatchObject({ level: 'exceeded' });
  });
  it('only counts current calendar year', () => {
    const a = evaluateThreshold(
      rule,
      profileWith([
        { month: '2025-12', amount: 90_000 },
        { month: '2026-01', amount: 10_000 },
      ]),
      '2026-08-07'
    );
    expect(a).toBeNull();
  });
});
```

`src/lib/rules/steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pendingSteps } from './steps';
import { RoadmapStepRule, BusinessProfile } from './types';

function step(id: string, phase: RoadmapStepRule['phase'], prerequisites: string[] = []): RoadmapStepRule {
  return {
    id,
    type: 'roadmap_step',
    title: id,
    phase,
    prerequisites,
    source_url: 'https://www.impots.gouv.fr/accueil',
    verified_on: '2026-08-07',
    valid_from: '2025-01-01',
    applies_to: {},
  };
}

const profile: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'lancement',
  options: [],
  revenueEntries: [],
};

describe('pendingSteps', () => {
  it('keeps only current-phase steps', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'routine')], profile, []);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  it('excludes completed steps', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement')], profile, ['a']);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });
  it('holds back steps with unmet prerequisites', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement', ['a'])], profile, []);
    expect(out.map((s) => s.id)).toEqual(['a']);
  });
  it('releases steps once prerequisites are done', () => {
    const out = pendingSteps([step('a', 'lancement'), step('b', 'lancement', ['a'])], profile, ['a']);
    expect(out.map((s) => s.id)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/rules/thresholds.test.ts src/lib/rules/steps.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/rules/thresholds.ts`**

```ts
import { ThresholdRule, BusinessProfile } from './types';
import { ISODate } from './dates';

export interface ThresholdAlert {
  thresholdId: string;
  ratio: number;
  level: 'warning' | 'exceeded';
}

export function evaluateThreshold(t: ThresholdRule, profile: BusinessProfile, today: ISODate): ThresholdAlert | null {
  const year = today.slice(0, 4);
  const ytd = profile.revenueEntries.filter((e) => e.month.startsWith(year)).reduce((s, e) => s + e.amount, 0);
  const ratio = ytd / t.value;
  if (ratio >= 1) return { thresholdId: t.id, ratio, level: 'exceeded' };
  if (ratio >= t.warn_ratio) return { thresholdId: t.id, ratio, level: 'warning' };
  return null;
}
```

- [ ] **Step 4: Implement `src/lib/rules/steps.ts`**

```ts
import { RoadmapStepRule, BusinessProfile } from './types';

/** Steps for the profile's current phase, not done, with prerequisites met.
 *  applies_to filtering happens in the engine before this is called. */
export function pendingSteps(steps: RoadmapStepRule[], profile: BusinessProfile, completedIds: string[]): RoadmapStepRule[] {
  return steps
    .filter((s) => s.phase === profile.lifecyclePhase)
    .filter((s) => !completedIds.includes(s.id))
    .filter((s) => s.prerequisites.every((p) => completedIds.includes(p)));
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/rules/thresholds.test.ts src/lib/rules/steps.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rules
git commit -m "feat: threshold evaluator and pending-steps filter"
```

---

### Task 8: Seed real rules v1 (verify every value against its source)

**Files:**
- Create: 9 YAML files under `rules/` (listed in File Structure)

> **Truth protocol for this task:** the values below are best-known at plan-writing time (2026-08-07). For EACH file: open `source_url` (WebFetch or browser), confirm the value/date/deadline is current, fix if needed, set `verified_on` to the actual verification date, and only then commit. If a URL is dead, find the equivalent page on the same official domain.

- [ ] **Step 1: Create obligation rules**

`rules/obligations/urssaf-declaration-micro.yaml`:

```yaml
id: urssaf-declaration-micro
type: obligation
title: Déclarer votre chiffre d'affaires à l'Urssaf
applies_to:
  legal_forms: [micro]
schedule:
  kind: periodic # frequency read from profile (monthly/quarterly)
source_url: https://www.autoentrepreneur.urssaf.fr/
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`rules/obligations/cfe-paiement.yaml`:

```yaml
id: cfe-paiement
type: obligation
title: Payer la cotisation foncière des entreprises (CFE)
applies_to: {}
schedule:
  kind: annual
  month: 12
  day: 15
source_url: https://www.impots.gouv.fr/professionnels/questions/comment-payer-ma-cotisation-fonciere-des-entreprises-cfe
verified_on: 2026-08-07
valid_from: 2025-01-01
```

- [ ] **Step 2: Create threshold rules**

`rules/thresholds/plafond-micro-vente.yaml`:

```yaml
id: plafond-micro-vente
type: threshold
title: Plafond de chiffre d'affaires micro-entreprise (vente)
applies_to:
  legal_forms: [micro]
  activity_categories: [vente]
value: 188700
source_url: https://entreprendre.service-public.fr/vosdroits/F32353
verified_on: 2026-08-07
valid_from: 2023-01-01
```

`rules/thresholds/plafond-micro-services.yaml`:

```yaml
id: plafond-micro-services
type: threshold
title: Plafond de chiffre d'affaires micro-entreprise (services)
applies_to:
  legal_forms: [micro]
  activity_categories: [service-bic, service-bnc]
value: 77700
source_url: https://entreprendre.service-public.fr/vosdroits/F32353
verified_on: 2026-08-07
valid_from: 2023-01-01
```

`rules/thresholds/tva-franchise-vente.yaml`:

```yaml
id: tva-franchise-vente
type: threshold
title: Franchise en base de TVA (vente)
applies_to:
  legal_forms: [micro] # v1: rule scoped to micro; other forms in M2+
  activity_categories: [vente]
value: 85000
source_url: https://entreprendre.service-public.fr/vosdroits/F21746
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`rules/thresholds/tva-franchise-services.yaml`:

```yaml
id: tva-franchise-services
type: threshold
title: Franchise en base de TVA (services)
applies_to:
  legal_forms: [micro]
  activity_categories: [service-bic, service-bnc]
value: 37500
source_url: https://entreprendre.service-public.fr/vosdroits/F21746
verified_on: 2026-08-07
valid_from: 2025-01-01
```

- [ ] **Step 3: Create roadmap step rules**

`rules/steps/assurance-rc-pro.yaml`:

```yaml
id: assurance-rc-pro
type: roadmap_step
title: Vérifier vos obligations d'assurance professionnelle (RC pro)
phase: lancement
applies_to:
  legal_forms: [micro]
source_url: https://entreprendre.service-public.fr/vosdroits/F23668
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`rules/steps/compte-bancaire-dedie.yaml`:

```yaml
id: compte-bancaire-dedie
type: roadmap_step
title: Ouvrir un compte bancaire dédié à votre activité
phase: lancement
applies_to:
  legal_forms: [micro]
source_url: https://entreprendre.service-public.fr/vosdroits/F36239
verified_on: 2026-08-07
valid_from: 2025-01-01
```

`rules/steps/declaration-initiale-cfe.yaml`:

```yaml
id: declaration-initiale-cfe
type: roadmap_step
title: Déposer la déclaration initiale de CFE (formulaire 1447-C)
phase: lancement
applies_to:
  legal_forms: [micro]
source_url: https://www.impots.gouv.fr/professionnels/questions/quest-ce-que-la-declaration-1447-c-et-qui-doit-la-deposer
verified_on: 2026-08-07
valid_from: 2025-01-01
```

- [ ] **Step 4: VERIFY each value/URL against its source** (truth protocol above), update `verified_on` dates, delete `rules/.gitkeep`.

- [ ] **Step 5: Validate**

Run: `npm run validate:rules`
Expected: `OK — 9 rules valid.`

- [ ] **Step 6: Commit**

```bash
git add rules
git commit -m "feat: seed v1 rules (micro obligations, thresholds, lancement steps)"
```

---

### Task 9: Engine + golden personas

**Files:**
- Create: `src/lib/rules/engine.ts`, `src/lib/rules/__fixtures__/personas.ts`
- Test: `src/lib/rules/engine.test.ts`

- [ ] **Step 1: Create `src/lib/rules/__fixtures__/personas.ts`**

```ts
import { BusinessProfile } from '../types';

/** Nora — micro BNC consultant, quarterly URSSAF, just launched, ACRE. */
export const personaNora: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'lancement',
  options: ['acre'],
  urssafFrequency: 'quarterly',
  revenueEntries: [{ month: '2026-07', amount: 4200 }],
};

/** Karim — micro seller, monthly URSSAF, established, high revenue (168 000 € YTD). */
export const personaKarim: BusinessProfile = {
  legalForm: 'micro',
  activityCategory: 'vente',
  lifecyclePhase: 'routine',
  options: [],
  urssafFrequency: 'monthly',
  revenueEntries: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map((month) => ({
    month,
    amount: 24000,
  })),
};

/** Sofia — EURL manager: none of the v1 micro rules apply, CFE outside horizon. */
export const personaSofia: BusinessProfile = {
  legalForm: 'eurl',
  activityCategory: 'service-bnc',
  lifecyclePhase: 'routine',
  options: [],
  revenueEntries: [],
};
```

- [ ] **Step 2: Write failing golden tests** — `src/lib/rules/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeActions, ActionInstance } from './engine';
import { loadRules } from './loader';
import { personaNora, personaKarim, personaSofia } from './__fixtures__/personas';

const rules = loadRules('rules');
const TODAY = '2026-08-07'; // frozen — engine is a pure function of its inputs

function shape(a: ActionInstance): [string, string, string] {
  return [a.type, a.id, 'dueDate' in a ? a.dueDate : ''];
}

describe('golden personas', () => {
  it('Nora: one quarterly URSSAF due + the three lancement steps', () => {
    const actions = computeActions(rules, personaNora, { today: TODAY });
    expect(actions.map(shape)).toEqual([
      ['obligation', 'urssaf-declaration-micro', '2026-10-31'],
      ['step', 'assurance-rc-pro', ''],
      ['step', 'compte-bancaire-dedie', ''],
      ['step', 'declaration-initiale-cfe', ''],
    ]);
  });

  it('Karim: TVA exceeded + plafond warning + three monthly URSSAF dues', () => {
    const actions = computeActions(rules, personaKarim, { today: TODAY });
    expect(actions.map(shape)).toEqual([
      ['threshold-alert', 'tva-franchise-vente', ''],
      ['threshold-alert', 'plafond-micro-vente', ''],
      ['obligation', 'urssaf-declaration-micro', '2026-08-31'],
      ['obligation', 'urssaf-declaration-micro', '2026-09-30'],
      ['obligation', 'urssaf-declaration-micro', '2026-10-31'],
    ]);
    const [tva, plafond] = actions as Extract<ActionInstance, { type: 'threshold-alert' }>[];
    expect(tva.level).toBe('exceeded');
    expect(tva.ratio).toBeCloseTo(1.9765, 4); // 168000 / 85000 = 1.976470588…
    expect(plafond.level).toBe('warning');
    expect(plafond.ratio).toBeCloseTo(0.8272, 4); // 168000 / 203100 = 0.827178729…
  });

  it('Sofia: nothing applies (rule filtering works)', () => {
    expect(computeActions(rules, personaSofia, { today: TODAY })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/rules/engine.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 4: Implement `src/lib/rules/engine.ts`**

```ts
import { Rule, RoadmapStepRule, BusinessProfile } from './types';
import { appliesTo, activeOn } from './matcher';
import { expandPeriodic, expandAnnual } from './scheduler';
import { evaluateThreshold } from './thresholds';
import { pendingSteps } from './steps';
import { addDays, ISODate } from './dates';

export interface EngineContext {
  today: ISODate;
  horizonDays?: number; // default 90
  completedStepIds?: string[];
}

export type ActionInstance =
  | { type: 'threshold-alert'; id: string; title: string; level: 'warning' | 'exceeded'; ratio: number; sourceUrl: string }
  | { type: 'obligation'; id: string; title: string; dueDate: ISODate; sourceUrl: string }
  | { type: 'step'; id: string; title: string; sourceUrl: string };

type AlertAction = Extract<ActionInstance, { type: 'threshold-alert' }>;
type ObligationAction = Extract<ActionInstance, { type: 'obligation' }>;
type StepAction = Extract<ActionInstance, { type: 'step' }>;

/** The public entry point: (rules, profile, context) -> ordered action list.
 *  Order: alerts (exceeded first, then id), obligations (due date, then id), steps (id). */
export function computeActions(rules: Rule[], profile: BusinessProfile, ctx: EngineContext): ActionInstance[] {
  const to = addDays(ctx.today, ctx.horizonDays ?? 90);
  const active = rules.filter((r) => activeOn(r, ctx.today) && appliesTo(r.applies_to, profile));

  const alerts: AlertAction[] = [];
  for (const r of active) {
    if (r.type !== 'threshold') continue;
    const a = evaluateThreshold(r, profile, ctx.today);
    if (a) alerts.push({ type: 'threshold-alert', id: r.id, title: r.title, level: a.level, ratio: a.ratio, sourceUrl: r.source_url });
  }
  alerts.sort((a, b) => (a.level === b.level ? a.id.localeCompare(b.id) : a.level === 'exceeded' ? -1 : 1));

  const obligations: ObligationAction[] = [];
  for (const r of active) {
    if (r.type !== 'obligation') continue;
    let dues: ISODate[] = [];
    if (r.schedule.kind === 'annual') {
      dues = expandAnnual(r.schedule, ctx.today, to);
    } else {
      const freq = r.schedule.frequency ?? profile.urssafFrequency;
      if (freq) dues = expandPeriodic(freq, ctx.today, to);
    }
    for (const dueDate of dues) obligations.push({ type: 'obligation', id: r.id, title: r.title, dueDate, sourceUrl: r.source_url });
  }
  obligations.sort((a, b) => (a.dueDate === b.dueDate ? a.id.localeCompare(b.id) : a.dueDate < b.dueDate ? -1 : 1));

  const stepRules = active.filter((r): r is RoadmapStepRule => r.type === 'roadmap_step');
  const steps: StepAction[] = pendingSteps(stepRules, profile, ctx.completedStepIds ?? [])
    .map((s): StepAction => ({ type: 'step', id: s.id, title: s.title, sourceUrl: s.source_url }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return [...alerts, ...obligations, ...steps];
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/rules/engine.test.ts`
Expected: PASS (3 tests). If a golden expectation differs because Task 8 verification changed a value, update the expected ratios accordingly — the STRUCTURE (order, ids, dates) must match.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS — all files, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rules
git commit -m "feat: roadmap engine with golden persona tests"
```

---

### Task 10: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run validate:rules -- --min 9
      - run: npm test
```

- [ ] **Step 2: Verify locally that both CI commands pass**

Run: `npm run validate:rules && npm test`
Expected: `OK — 9 rules valid.` then full test suite PASS.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: validate rules and run tests on push"
```

(If/when a GitHub remote is added, the workflow activates automatically — nothing else to do.)

---

## Definition of Done — M1

- `npm run validate:rules` → 9 rules valid, every one with an official source, `verified_on`, millésime.
- `npm test` → all green: unit tests for every module + 3 golden personas asserting exact ordered action lists.
- A later milestone can `import { computeActions } from '@/lib/rules/engine'` and get correct dated actions for any profile.
