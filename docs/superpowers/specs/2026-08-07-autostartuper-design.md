# AutoStartUper — Design Spec

**Date:** 2026-08-07
**Status:** Validated in brainstorming, pending final user review

## 1. Vision

An administrative assistant for French entrepreneurs. It tells the user where they are on their business journey, what to do next, and **prepares each action for them** so the remaining work is minimal. All facts come from official French government sources (.gouv), each one traceable.

One-liner: *"L'app qui prépare vos démarches à votre place — il ne reste qu'à valider."*

## 2. Scope — v1

### In

| Area | Content |
|---|---|
| Business forms | Pre-creation guidance + micro-entrepreneur, EI, EURL, SASU (solo founders) |
| Assessment | SIREN lookup + document parsing + short wizard |
| Roadmap dashboard | Adaptive views: Parcours (setup) / Pilotage (daily) / Focus (action) |
| Deadline calendar + reminders | URSSAF, TVA, CFE, impôts — computed from the profile; email + web push |
| Plain-language guides | Simple-words explanation per action, linked to its .gouv source |
| Document templates | Pre-filled from profile by code (no AI generation) |
| Business health snapshot | CA vs plafonds (micro ceilings, TVA franchise), alerts before crossing |
| Grounded Q&A chat | Answers only from service-public.fr open data, always cited |

### Out (explicit)

- **Invoicing** — free tools exist. The 2026–2027 e-invoicing reform IS covered as a roadmap action; we do not build the invoicing tool.
- **Accounting** — we only track CA totals for threshold alerts.
- **Bank sync** — aggregation APIs cost money; CA is entered manually in v1.
- **Auto-submitting declarations** — the app prepares everything; the user validates on the official site. Legal liability stays with official channels.

## 3. Core principle — prepared actions

Never a bare alert. Every notification/action card includes:

1. Exact description of what is coming and why it applies to this user.
2. The prepared payload: pre-filled document, pre-computed amounts, or a step-by-step checklist with the user's own values.
3. Minimum-input follow-through: one click to see the prepared material, one link to the official site to execute.

Template filling is done by **code** (merge fields from profile), never by AI generation. This keeps the truth guarantee.

## 4. Audience

Built as a public product (real auth, multi-user), but invite-only (me + testers) until content accuracy is validated. Going public is a config switch, not a rework.

## 5. Assessment flow

Entry question: **"Avez-vous déjà créé votre entreprise ?"**

### Existing business (SIREN-first)

1. User types SIREN (or company name → search). App calls INSEE Sirene / annuaire-entreprises.data.gouv.fr (free, official): legal form, APE code, creation date, address.
2. Prefilled profile shown → user confirms or corrects.
3. 3–5 questions the API cannot answer: versement libératoire? ACRE? CA already earned this year? URSSAF declaration frequency?
4. Optional: upload KBIS / attestations → Mistral extracts fields with per-field confidence → **human validation screen** → profile enriched.
5. Lifecycle phase computed from registration date + a mini-checklist ("avez-vous déjà… ouvert un compte dédié / choisi le versement libératoire / …").

### Pre-creation

1. Wizard, ~8 questions: activity type, solo or associates, expected revenue, patrimony protection needs, employed in parallel, aid eligibility (ACRE, ARE).
2. Output: legal-form recommendation — a micro/EI/EURL/SASU comparison applied to their answers, every criterion carrying its .gouv source.
3. Roadmap starts at phase "Idée & projet"; first prepared action: registration checklist on the INPI guichet unique.

### Fallback rule (never block, always retry)

- SIREN not found / API down → guided manual entry.
- Low-confidence extraction → fields marked "à vérifier", user completes.
- Unreadable upload → continue without it.
- **Every fallback screen keeps a [Réessayer] button** that re-calls the API or re-parses the document. Manual entry is never a dead end.

## 6. Dashboard UX — adaptive views

Profile carries a `lifecycle_phase`: Idée → Immatriculation → Lancement → Routine → Croissance.

| View | When | Content |
|---|---|---|
| **A — Parcours** (roadmap-first) | Default home during Idée / Immatriculation / Lancement | Vertical timeline of phases, "vous êtes ici" marker, current-step actions on the right |
| **B — Poste de pilotage** (status-first) | Default home from Routine onward | KPI row (next deadline countdown, CA vs plafond gauge, prepared-action count), action list, deadline calendar |
| **C — Focus** (one action) | Whenever any action is opened, from anywhere | One large card: description, prepared payload, buttons [Voir le document pré-rempli] [Marquer fait] [Reporter] [Ouvrir le site officiel] |

A→B switch is automatic (immatriculation confirmed + first recurring obligation active) with a manual toggle in settings. Both views stay accessible; only the default changes.

## 7. Architecture

All free tier. Platform: **web app + PWA** (installable, push-capable).

| Piece | Choice | Why |
|---|---|---|
| App | Next.js on Vercel (free) | PWA, API routes, standard |
| Data | Supabase free tier, **EU region** | Postgres + Auth + Storage + pgvector; RGPD residency |
| Truth | **Rules-as-data in git** (YAML in repo) | Versioned, reviewed by commit, deploys with app |
| Jobs | GitHub Actions cron (free) | Freshness watchdog, veille RSS, daily reminders, keep-alive ping |
| Email | Brevo free tier (300/day) | Reminder emails |
| Push | Web-push / VAPID | Free, no vendor |
| AI | Mistral API free tier | Doc parsing + embeddings + grounded Q&A; French provider |

Deterministic core, AI at the edges: the roadmap engine and the action preparer are pure code reading YAML rules. AI only touches document parsing (input, human-validated) and the Q&A chat (output, always cited).

## 8. Data model

### Rules (YAML in git) — the truth

- `roadmap_steps` — phase, title, applies_to conditions (legal form, situation), prerequisites, linked guide + template.
- `obligations` — recurring deadlines (URSSAF declaration, CFE, TVA…): calendar rule (monthly/quarterly/annual), computation formula (e.g. cotisation rates).
- `thresholds` — micro ceilings, TVA franchise…: value + millésime (`valid_from` / `valid_until`) so successive years coexist.
- `templates` — documents with merge fields filled from the profile.
- `guides` — plain-words explanations.

**Every record carries `source_url` (.gouv), `verified_on`, and a millésime.** CI fails any rule missing them.

### User data (Supabase Postgres)

- `business_profiles` — SIREN, legal form, tax/social regime, activity (BIC/BNC, vente/service), start date, options (ACRE, versement libératoire), lifecycle_phase.
- `revenue_entries` — month, amount, category → feeds threshold gauges.
- `action_states` — action × user: todo / prepared / done / snoozed / skipped, due date, **prepared payload**.
- `documents` — uploaded files + extracted fields (user-validated).
- `notifications_log` — what was sent, when, which channel (dedupe).

## 9. Roadmap engine & preparer

- **Engine** = pure function `(rules, profile, today) → dated action instances`. Filters steps by `applies_to`, expands obligations into calendar occurrences, evaluates thresholds against revenue entries.
- **Preparer** merges profile into the action's template → prepared payload (document, pre-computed recap, checklist). Pure code.
- Deterministic ⇒ testable with golden personas: fixed profile in, exact same action list out, always.

## 10. AI components

### Document parsing
Upload → private Supabase bucket → Mistral extraction with per-field confidence → validation screen (low confidence = "à vérifier") → [Réessayer] always available.

### Grounded Q&A
- Corpus: service-public.fr professional fiches (open data dump from data.gouv.fr), chunked, embedded (Mistral embeddings) into pgvector.
- Question → retrieve top chunks → Mistral answers **only from them**, citing fiche + link.
- No good match → "je ne trouve pas de source officielle, voici où chercher" — never improvises.
- Standing disclaimer: information, not legal or tax advice.

## 11. Truth pipeline

1. **Source diff (weekly, GitHub Actions):** re-download the service-public open data dump; diff every fiche referenced by a rule; check API-checkable values. Any change → GitHub issue + email to admin; rule flagged "à re-vérifier" internally (users see nothing until confirmed).
2. **Staleness:** any rule unverified for 6+ months is flagged automatically.
3. **Veille réglementaire (advisory only):** the cron also polls official RSS/news feeds (service-public actualités pro, URSSAF actus, BOFiP news), keyword-matches items against rule topics, and forwards hits to the admin labeled "veille". **Never a source, never touches rules** — only a monitoring signal. Truth changes only via a human-reviewed commit.

## 12. Notifications

Daily cron finds `action_states` with due dates entering reminder windows (J-30 / J-7 / J-1, user-configurable) → Brevo email + web push. `notifications_log` prevents duplicates. Every notification links to the Focus view of the prepared action (core principle §3).

## 13. Error handling

- **Retry rule (global):** every external-dependency failure (SIREN API, doc parsing, Q&A) surfaces a [Réessayer] button plus a manual path.
- Mistral rate limits → graceful "réessayez dans un instant", queue where possible.
- Supabase free-tier auto-pause → scheduled keep-alive ping.
- Vercel/Brevo/Actions quotas monitored; app degrades (e.g., email-only reminders) rather than breaks.

## 14. Security & RGPD

- Data in EU region (Supabase). Uploaded docs in a private bucket, per-user access rules.
- Self-service data export and account deletion.
- CA amounts and documents = personal data: minimal collection, no third-party analytics in v1.
- Auth via Supabase (email magic link to start; no passwords to manage).

## 15. Testing

- **Golden personas:** ≥5 fixture profiles (micro BNC with ACRE, EURL à l'IS, pre-creation…) → expected action lists asserted exactly.
- **Rule schema CI:** every rule must have `source_url`, `verified_on`, millésime; build fails otherwise.
- **E2E (Playwright):** assessment → dashboard happy paths, both branches (SIREN and pre-creation).
- **RAG eval:** small fixed question set with expected source fiches; run on corpus updates.

## 16. Leads for later (not v1)

- **E-invoicing reform 2026–2027** — already a roadmap action in v1; a dedicated module (receive/emit via a PDP) could be a v2 feature with real pull.
- **Bank sync** (Bridge/Powens) — auto-fill `revenue_entries` when budget allows.
- **KBIS/attestation vault with expiry tracking** — attestation de vigilance URSSAF expires every 6 months; auto-remind + re-download link.
- **Multi-associate forms** (SARL, SAS) — unlocks the rest of the market; rules model already supports `applies_to` conditions.
- **Accountant share link** — read-only view of profile + calendar for the user's expert-comptable.
- **Aides finder** — match profile against aides-entreprises.fr open data (regional grants, ACRE-like schemes).
