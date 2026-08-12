# M2 — Assessment (+ the profile the whole app hangs off)

**Date:** 2026-08-12
**Milestone:** M2 of 6. M1 (rules engine) is done: `computeActions(rules, profile, ctx)` works.
**Spec:** [`../specs/2026-08-07-autostartuper-design.md`](../specs/2026-08-07-autostartuper-design.md) §5 (assessment flow), §8 (data model), §13 (error handling).

## What M2 delivers

The path from "a stranger opens the app" to "the engine has a profile it can compute
actions from", plus the screens that make that visible. Everything deterministic and
local: no account, no database, no API keys.

**Scope split — read this before starting.** The spec's M2 is "auth + assessment".
Auth and persistence need a Supabase project that only the repo owner can create
(EU region, keys, RLS policies). That is **task 6, and it is a hard stop**: it needs
credentials, not code. Tasks 1–5 have no external dependency and are built first, so
the app is fully usable against in-memory state before any account exists.

The one external service used here — `recherche-entreprises.api.gouv.fr` — is public,
keyless and rate-limited per IP. Verified reachable from this environment 2026-08-12.

**Amendments (execution):** tasks 1–5 are done (commits `cffc5d2`, `e7fc526`, `f9b0bbe`, `ec678ca`).
Deviations worth recording:

- **A lone registry candidate is settled, not asked.** `nature_juridique 5720` means SASU
  and nothing else; the recap screen is where the user confirms it.
- **Two `idee` rules were authored** (`choix-forme-juridique` from fiche F23844,
  `immatriculation-micro` from F36746, both verified 2026-08-12). Without them the whole
  pre-creation branch ended at "rien à faire", which contradicts spec §5. The rule count
  gate is now `--min 11`; the golden persona Théo asserts the two steps and no obligations.
- **Alerts render in both home views.** Found by driving the real app: a lancement-phase
  user past the TVA franchise saw no alert at all, because only the cockpit drew them.
- **Persistence is an external store** (`useSyncExternalStore`), not an effect — the React
  Compiler lint rejects `setState` in an effect body, and it was right to.
- **Rules are cached per server process.** Adding a YAML file needs a dev-server restart.
- The legal-form recommendation stays out of scope, as planned below.

## Tasks

- **1. Profile schemas** — `src/lib/profile/schema.ts`. Zod for `BusinessProfile` and
  `RevenueEntry` (the M1 deferred item: revenue is about to arrive from user input, so
  `month` must stop being an unvalidated string). Parse at the boundary, trust inside.
- **2. Lifecycle derivation** — `src/lib/profile/lifecycle.ts`. Registration date +
  a short checklist → `LifecyclePhase`. Pure, tested at the boundaries.
- **3. SIREN lookup** — `src/lib/siren/`. Search by SIREN or by name against
  recherche-entreprises; map the response to a *partial* profile; typed failures
  (`not-found`, `network`, `rate-limited`, `malformed`) so every one of them can offer
  [Réessayer] plus a manual path (spec §13). **What the registry cannot answer must
  not be guessed**: micro vs EI is a tax regime and is invisible there, and an APE code
  does not determine vente/service-BIC/BNC. Those stay questions.
- **4. Assessment flow** — `src/lib/assessment/`. The question set for both branches
  (existing business, pre-creation), answers → complete profile. Pure state machine, no
  React, so it is testable without a DOM.
- **5. UI** — the three views of spec §6 (Parcours / Pilotage / Focus) plus the
  assessment screens, reading `computeActions`. Profile in React state + `localStorage`.
- **6. Auth + persistence — BLOCKED.** Needs a Supabase project, its EU-region keys and
  RLS policies. Stop here and ask.

## Out of scope for M2

Legal-form recommendation for the pre-creation branch (spec §5) needs a sourced
comparison of micro/EI/EURL/SASU across ~8 criteria — that is truth-layer content with
its own verification burden, and it belongs with the rules, not with the wizard. The
pre-creation branch ends at "phase = idée, here are your steps" until then.

Document parsing (Mistral), notifications, and the truth watchdog are M4–M6.
