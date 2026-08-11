# AutoStartUper M1 (Foundation + Rules Engine) — Session Handoff

**Date paused:** 2026-08-11
**Branch:** `master` (greenfield solo repo, no remote yet — plan says commit directly on master)
**HEAD:** `36b69d1`, working tree clean, 199 tests passing
**Plan:** [`docs/superpowers/plans/2026-08-07-m1-foundation-rules-engine.md`](../plans/2026-08-07-m1-foundation-rules-engine.md)
**Spec:** [`docs/superpowers/specs/2026-08-07-autostartuper-design.md`](../specs/2026-08-07-autostartuper-design.md)
**Workflow skill:** `superpowers:subagent-driven-development` (fresh Opus subagent per task → spec review → code-quality review → next task)

**Status: Tasks 1–8 of 10 implemented. Task 8 has an open fix batch (4 items) that must land before Task 9.**

---

## What's been done

| Commit | What |
|---|---|
| `74780cf` | docs: design spec |
| `4737a83` | docs: M1 implementation plan |
| `88770ac` | chore: scaffold Next.js app with vitest tooling |
| `6e2ce22` | chore: fix vitest config (mts + alias) and scaffold polish |
| `1c74ae3` | docs: sync plan with installed versions (Next 16, zod 4) |
| `dfabd91` | feat: rule schemas with official-source and date validation |
| `91410d7` | feat: harden rule schemas (https-only sources, strict objects, calendar dates) |
| `eae66d6` | refactor: close minor schema review findings (annual pairs, id reuse, title trim) |
| `585128d` | docs: record Task 2 schema-hardening amendments |
| `86f4b26` | feat: YAML rules loader with validation, duplicate and prerequisite checks |
| `d8729a6` | feat: loader catches malformed YAML per-file and prerequisite cycles |
| `532da9c` | refactor: extract rule graph validation, file-path errors, step-only prerequisites |
| `b32b565` | docs: record Task 3 loader amendments |
| `822ae4e` | feat: validate-rules CLI with min-count, future-date and staleness checks |
| `9ba2cdd` | fix: harden validate-rules gate (arg parsing, freshness extraction, file-named errors) |
| `4d3fb3d` | test: smoke-test validate-rules as a subprocess, reject repeated --min |
| `9f244e1` | docs: record Task 4 amendments, CI uses `--min 9` |
| `8df4299` | feat: date helpers and obligation schedulers |
| `91b46db` | fix: guard date parsing, year-boundary tests, safer expandAnnual signature |
| `dd50725` | docs: record Task 5 date-guard amendments |
| `77347f7` | docs: align expandAnnual @throws with clamping behavior |
| `6fe1c62` | feat: applies_to matcher and millesime activity check |
| `2d1d7ed` | test: pin options_none semantics, reject empty applies_to arrays, honest millesime docs |
| `3f4d506` | docs: record Task 6 amendments, defer millesime-overlap decision |
| `ffea410` | feat: threshold evaluator and pending-steps filter |
| `cc82fde` | fix: cent-exact thresholds with ytd, guarded today, honest steps docs |
| `0c91ba8` | docs: record Task 7 amendments and prerequisite-satisfiability guard |
| `36b69d1` | feat: seed v1 rules (micro obligations, thresholds, lancement steps) |

### Task 1 ✅ Scaffold
- Next.js 16 + React 19 + Tailwind, App Router, `src/`, `@/*` alias; vitest 4, tsx, zod 4, yaml.
- Config is `vitest.config.mts` (**not** `.ts`) with an explicit `@` → `./src` alias — Vite does not read tsconfig paths.
- Package renamed `autostartuper` (npm rejects capitals in the directory name).
- Scripts: `test`, `test:watch`, `typecheck`, `validate:rules`.

### Task 2 ✅ Schemas (`src/lib/rules/types.ts`, `sources.ts`)
Hardened well past the plan's snippets: **https-only** official sources (`OFFICIAL_SUFFIXES` exported), calendar-validated dates (`IsoDateSchema`, single issue per malformed date), `valid_until >= valid_from`, `RuleIdSchema` `/^[a-z0-9-]+$/` reused for `prerequisites`, `KnownOptionSchema` enum (`acre`, `versement-liberatoire`), `strictObject` on every rule **and** schedule variant, `warn_ratio` exclusive (0,1), `title` trimmed non-empty, `AppliesTo` arrays `.min(1)`, annual month/day pair validity (leap-safe).

### Task 3 ✅ Loader (`src/lib/rules/loader.ts`)
Recursive sorted walk (no symlink/junction descent), per-file try/catch, **all problems in one throw**: schema errors (file-named), malformed YAML, empty file, duplicate ids (both file paths), dangling prerequisites, **non-step prerequisites**, prerequisite cycles (3-colour DFS, no diamond false positives). Graph checks live in exported `validateRuleGraph()`; `loadRulesWithFiles()` returns `{file, rule}` pairs, `loadRules()` maps over it.

### Task 4 ✅ validate-rules CLI (`scripts/validate-rules.ts`, `src/lib/rules/freshness.ts`)
`--min <n>` / `--min=<n>` (rejects unknown args, empty values, repeats; `--help`), future `verified_on` = error, 183-day staleness = stderr warning + exit 0, `::warning::` under GitHub Actions, `process.exitCode`, cwd-independent rules dir displayed relative. Subprocess smoke test proves the gate actually executes.

### Task 5 ✅ Dates + schedulers (`dates.ts`, `scheduler.ts`)
`parseISO` **throws** on non-`YYYY-MM-DD` (fixed a real OOM/infinite loop). `expandPeriodic(freq, from, to)` — due = last day of month following each period, 2-month lookback, inclusive window. `expandAnnual(schedule, from, to)` — **object form**, throws on bad month/day<1, clamps Feb 29 → Feb 28.

### Task 6 ✅ Matcher (`matcher.ts`)
`appliesTo` (present conditions ANDed, absent = unconstrained) + `activeOn(millesime, date)` (inclusive both ends). Deliberately a per-rule predicate — it does not disambiguate overlapping millésimes.

### Task 7 ✅ Thresholds + steps (`thresholds.ts`, `steps.ts`)
`evaluateThreshold` — guards `today` via `parseISO`, **cent-exact** sums, `ThresholdAlert = { ytd, ratio, level }` (no `thresholdId`), calendar-year YTD only. `pendingSteps` — current phase, not completed, direct prerequisites met (**shallow by design**, documented + pinned).

### Task 8 ⚠️ Rules seeded, fix batch open (`rules/`, 9 YAML files)
Facts independently re-verified against live .gouv sources by two agents. **Two plan values were stale and were corrected from source:**
- **Micro CA plafonds: 188 700 → 203 100 € (vente), 77 700 → 83 600 € (services)**, vintage `2026-01-01`…`2028-12-31` (service-public F32353 + actualité A18813 state "2026, 2027 and 2028" explicitly).
- TVA franchise **85 000 / 37 500 confirmed unchanged** (the 25 000 € unified threshold was repealed by law 2025-1044 of 2025-11-03).
- Source URLs corrected: F36239 was an EURL page → **F35991**; urssaf.fr unreachable → **F23257**; canonical host is now `entreprendre.service-public.gouv.fr`.

Spec review ✅. **Quality review returned "With fixes" — items 1–4 below are unresolved.**

---

## What's left

| # | Task | Touches | Blocker |
|---|---|---|---|
| 8-fix | Task 8 fix batch (4 items) | `rules/*.yaml`, plan doc | none — do this first |
| 9 | Engine + golden personas | `src/lib/rules/engine.ts`, `__fixtures__/personas.ts`, `engine.test.ts` | needs 8-fix (Karim's numbers) |
| 10 | CI workflow + final review | `.github/workflows/ci.yml` | needs 9 |

Task list tool: items #15 (in_progress), #16, #17.

---

## Resume here — Task 8 fix batch

Four mechanical fixes from the quality review, then Task 8 closes. **Do this before Task 9** — item 1 changes numbers Task 9's tests depend on.

Implementer prompt to use (fresh `general-purpose` subagent, model `opus`):

```
You are closing the Task 8 fix batch for AutoStartUper (repo: C:\Users\Hippolyte_Geslain\Documents\Perso\AutoStartUper, Windows, branch master, HEAD 36b69d1, tree clean, 199 tests green).

Context: Task 8 seeded 9 YAML truth rules under `rules/`. Facts are verified and settled — do NOT re-fetch sources or change any value except where stated below. A code-quality review returned "With fixes"; these are those fixes. The 9 rule files are the de-facto authoring guide for every rule that follows, so consistency matters as much as correctness.

Apply all four, one commit:

1. AMEND THE PLAN (docs/superpowers/plans/2026-08-07-m1-foundation-rules-engine.md). Add an "Amendments (Task 8)" paragraph next to the existing amendment blocks near the top, recording: micro plafonds are now 203 100 € (vente) / 83 600 € (services) for the 2026-2028 vintage (was 188 700 / 77 700 — the plan's figures were the stale 2023-2025 vintage); source URL corrections (F36239 → F35991 for the bank account fiche, urssaf.fr → F23257 for declaration timing, canonical host entreprendre.service-public.gouv.fr); and the Task 9 persona consequence below.
   ALSO fix Task 9's golden persona IN THE PLAN: persona Karim currently earns 7 x 23 000 = 161 000 €, which against the NEW 203 100 € plafond is ratio 0.7927 — BELOW warn_ratio 0.8, so no alert fires at all and the persona stops exercising the warning band. Change Karim to 7 x 24 000 = 168 000 € (ratio 0.8272 → warning; TVA ratio 1.976 → exceeded). Update the plan's expected `toBeCloseTo` values and the `// 161000 / 188700` comment accordingly. Recompute the exact ratios yourself and put the real arithmetic in the comment.

2. RESTORE THE SCOPE MARKERS. Four rules carry `legal_forms: [micro]` as a v1 SCOPING decision rather than a fact, and the plan's original marker comment was dropped. Add `# v1: rule scoped to micro; other forms in M2+` to: tva-franchise-vente, tva-franchise-services, assurance-rc-pro, declaration-initiale-cfe. Leave the genuinely micro-specific four unmarked (plafond-micro-vente, plafond-micro-services, urssaf-declaration-micro, compte-bancaire-dedie).
   Also reconcile the contradiction the reviewer found: `cfe-paiement` is `applies_to: {}` (every legal form) while `declaration-initiale-cfe` — the filing that creates that very liability — is `[micro]`. Pick one and make it deliberate: either scope both to micro for v1 (with the marker comment) or open both. State your reasoning in the report and in a YAML comment.

3. COMPLETE TWO COMMENTS THAT CURRENTLY ASSERT INCOMPLETE RULES.
   - rules/steps/compte-bancaire-dedie.yaml says "Mandatory once turnover passes 10 000 € two years running; recommended before that." That is FALSE for a commerçant: fiche F35991 requires a dedicated account for a commercial activity regardless of the 10k/2yr test. Extend the comment so it is complete (M2 UI copy will be written from this line — "recommended" vs "required" is a different button).
   - rules/obligations/cfe-paiement.yaml omits the création-year exonération (a new business is exonerated from CFE for its creation year; the minimum base is halved in year two). The app's core user is in their first year, so "pay this on 15 December" is the wrong action for them. Add it to the comment.
   Comments only — no data/schema changes, no new fields.

4. FIELD ORDER CONSISTENCY. 7 of 9 files order keys as `<type-specific>, applies_to` (thresholds: value then applies_to; steps: phase then applies_to). Both obligation files invert it. Move `schedule` above `applies_to` in rules/obligations/urssaf-declaration-micro.yaml and rules/obligations/cfe-paiement.yaml.

Gates (must all pass before commit):
- `npm run validate:rules -- --min 9` → `OK — 9 rules valid.` exit 0
- `npm test` → 199 passed (no test changes in this batch; the plan edit is docs-only)
- `npm run typecheck` and `npm run lint` → clean

Commit message: `fix: complete Task 8 rule comments, restore scope markers, align field order`
IMPORTANT (Windows): use the Bash tool with a heredoc for multi-line commit messages, or a single -m. Do NOT use PowerShell here-string syntax (@'...'@) inside the Bash tool — two earlier agents mangled commit messages that way (one produced a commit whose entire subject was `@`).

Report: what you changed per item, your reasoning on the CFE scoping decision, gate outputs, files changed.
```

After it reports: dispatch a spec review (verify the four items landed, no value drift, gates green), then mark Task 8 complete and move to Task 9.

---

## Task 9 — carry-forward requirements (read before planning it)

The plan's Task 9 snippet is **stale in four ways**. Whoever executes it must apply these:

1. **Karim's numbers** — 24 000/month (see fix batch item 1). Against 203 100 € the old 161 000 € produces no alert at all.
2. **`ThresholdAlert` shape is `{ ytd, ratio, level }`** — `thresholdId` was removed. The engine pairs each alert with the rule it passed in (`id: r.id`), which the plan already does. Consider widening `ActionInstance`'s `threshold-alert` variant with `ytd` and `limit: r.value` — otherwise `ytd` becomes dead weight one layer up, exactly the problem dropping `thresholdId` solved. `ytd` is euro-exact; the M2 gauge must read it rather than recompute `ratio * value`.
3. **`expandAnnual(r.schedule, ctx.today, to)`** — object form (already corrected in the plan snippet).
4. **Derive the level union** from `ThresholdAlert['level']` instead of re-declaring `'warning' | 'exceeded'` in `ActionInstance`, so the two cannot drift.

**Open design decision to settle during Task 9** (raised by the Task 8 quality review): obligations and thresholds have no `lifecycle_phases` gate, so an `idee` profile — someone who has registered nothing — matches CFE and all four thresholds. The Sofia persona only returns `[]` because CFE's 15 December falls outside the 90-day horizon from the frozen `2026-08-07`; move `today` to October and Sofia gets a CFE action. Either add `lifecycle_phases` to those rules or gate `idee` centrally in the engine — but decide it deliberately rather than letting the golden test bake in the coincidence.

---

## Notes / gotchas

**Environment**
- Windows 11, PowerShell + Git Bash both available. `npm run <script> -- --flag` is how args reach the script.
- **Never use PowerShell here-strings (`@'...'@`) in the Bash tool.** Two agents mangled commit messages this way; one shipped a commit whose subject was literally `@` and had to amend (that is why spec review found `60a5a55` amended into `36b69d1` — identical trees, different sha).
- `git` prints LF→CRLF warnings on nearly every commit. Harmless, ignore.
- `npx tsc --noEmit` fails on a *fresh clone before the first build* (`Cannot find name 'LayoutProps'` — Next 16 generates that type into `.next/types`). Build once first; don't add a CI typecheck step that runs before a build.
- `.superpowers/` (brainstorm mockups) is git-ignored and must survive — `create-next-app` refuses to scaffold next to it, which is why Task 1 moved it aside.

**Process that worked**
- Per task: implementer → **spec** review → **quality** review → fix round → re-review → close. Reviewers were told to mutation-test rather than read; that caught the real bugs (a surviving `every`/`some` mutant, a silently-disarmed `--min=9`, an OOM on malformed dates).
- Every deviation from the plan gets a `docs:` commit amending the plan header. Keep that habit — Task 8 skipped it and that is fix-batch item 1.
- Reviewers are not always right: one relayed a wrong expected date value, one mis-transcribed its own probe output. The implementer caught both. Verify contested arithmetic before relaying it.

**Truth-layer specifics**
- `urssaf.fr` / `autoentrepreneur.urssaf.fr` are **unreachable from this environment** (ECONNRESET, 4 attempts). Use service-public fiches instead, or note the URL as unverified.
- `service-public.fr` → `service-public.gouv.fr` → `entreprendre.service-public.gouv.fr`. Use the final canonical host (still inside the allowlist).
- `impots.gouv.fr`'s micro FAQ still serves the **stale** 188 700 / 77 700 figures labelled 2023-2025. service-public, URSSAF actualités and A18813 all agree on 203 100 / 83 600. Don't "correct" the new values back.
- `assurance-rc-pro`'s fiche F23668 was last updated 2023-09-22 — the oldest source in the set and the first likely to drift.

**Deferred, recorded in the plan header**
- Loader per-profile prerequisite satisfiability check — **must land before any rule uses `prerequisites`** (a prereq whose `applies_to` excludes a user blocks its dependents forever, silently). This is why the 9 seed rules declare none.
- Millésime overlap invariant (needs a lineage/family field in the schema) — decide before a second vintage is authored.
- `RevenueEntrySchema` — before revenue arrives from user input in M2.
- `short_title` in the schema — titles run ~72 chars and M2 cards will truncate.
- `rules/README.md` authoring guide (field order, id grammar, millésime naming, `legal_forms` fact-vs-scope, what `valid_from` means, the comment contract).
- Synthetic fixtures in `matcher.test.ts:72` / `types.test.ts:93,98` use `value: 77700`, now a *stale real* number — swap to an obviously fake 100000.

---

## Quick resume checklist

1. `git status` → expect clean tree on `master` at `36b69d1`.
2. `npm test` → expect **199 passed**, 10 files. `npm run validate:rules -- --min 9` → `OK — 9 rules valid.`
3. Check the task list → #8–#14 completed, #15 in_progress (Task 8), #16–#17 pending.
4. Dispatch the **Task 8 fix batch** prompt above (fresh `general-purpose` subagent, model `opus`, `run_in_background: false`).
5. Spec-review its result, then mark task #15 completed.
6. Task 9: read the plan's Task 9 section **plus** the four carry-forward corrections above, settle the `lifecycle_phases` decision, then run the normal loop (implementer → spec review → quality review).
7. Task 10: CI workflow (`npm run validate:rules -- --min 9` is already in the plan's CI step), then the final whole-implementation review, then `superpowers:finishing-a-development-branch`.
