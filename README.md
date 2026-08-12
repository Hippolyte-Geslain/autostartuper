# AutoStartUper

**L'app qui prépare vos démarches à votre place — il ne reste qu'à valider.**

A French entrepreneur misses a deadline not because they are careless, but because nobody
told them it existed. The URSSAF declaration, the CFE that falls due on 15 December, the
turnover ceiling that quietly changes your VAT status mid-year — the rules are public, and
working out which of them apply to *you*, this month, is a research project.

AutoStartUper does that research once, from official sources, and turns it into a short
list: what to do, when, and a link to the government page that says so.

> **Status:** working end to end, local-only. The rules engine (M1), the assessment and
> dashboards (M2), and the preparer that fills in your figures (M3) are done and tested —
> 338 tests. No account, no database, no API keys: your profile lives in your browser.
> See [Roadmap](#roadmap).

---

## The one design rule

**Every fact the app states comes from an official French government source, and links back
to it.**

Not "trust us". Not a language model's recollection of tax law. A YAML file with a
`source_url`, a `verified_on` date and a millésime, reviewed in a commit like any other
change — and CI that fails when a rule lacks any of them.

That constraint is what makes the rest of the design fall out:

- **The engine is a pure function.** `(rules, profile, today) → actions`. Same inputs, same
  list, always. No clock, no network, no randomness.
- **AI stays at the edges.** It may read a document you upload (which you then confirm) or
  answer a question with citations. It never decides what you owe.
- **Nothing is submitted for you.** The app prepares; you validate on the official site.
  Legal liability stays where it belongs.
- **Never a bare alert.** "URSSAF declaration due 31 October" is not help. The period it
  covers, the turnover to declare, the rate, the amount, and what the app could *not* work
  out — that is help.

## Try it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Answer four or five questions — with a real SIREN if you
have one, since the lookup hits the public
[recherche-entreprises](https://recherche-entreprises.api.gouv.fr) API — and you get a
dated action list.

Other commands:

```bash
npm test
```

```bash
npm run validate:rules -- --min 14
```

The second one is the truth gate, and it is what CI runs first: it is the only check that
can fail without anybody touching the code, when a source goes stale.

## How it works

```
rules/*.yaml  ──►  loader ──►  engine  ──►  actions  ──►  dashboard
(the truth)        (schema)    (pure)       (dated)       (3 views)
                                  ▲
                            your profile
                     (assessment → localStorage)
```

| Layer | Where | What it does |
|---|---|---|
| Truth | [`rules/`](rules/) | One YAML file per rule: obligations, thresholds, roadmap steps, rates |
| Engine | [`src/lib/rules/`](src/lib/rules/) | Matching, scheduling, threshold arithmetic, ordering |
| Profile | [`src/lib/profile/`](src/lib/profile/) | Runtime schemas, lifecycle phase, persistence |
| Assessment | [`src/lib/assessment/`](src/lib/assessment/) | The questions, as data rather than as screens |
| Preparer | [`src/lib/prepare/`](src/lib/prepare/) | Turns an action into figures, a checklist and caveats |
| App | [`src/app/`](src/app/), [`src/components/`](src/components/) | Next.js; three views: Parcours, Pilotage, Focus |

Two rules of thumb hold the whole thing together:

- **Never ask what is already known; never assume what is not.** The registry knows your
  legal category and creation date. It cannot know whether you chose the micro regime — so
  that stays a question, and the app never guesses it.
- **A malformed input fails loudly.** An empty action list is a legitimate answer ("nothing
  due"), which is exactly why a bad date must never be able to produce one.

Writing or changing a rule? Read the [rules authoring guide](rules/README.md) first — field
order, millésimes, and the difference between "this rule is micro-only" and "we only
shipped micro so far".

## The source archive

Every official page a rule depends on is archived in [`docs/sources/`](docs/sources/) as
Markdown, with the date the government last verified it and the date we fetched it.

Why keep copies of public web pages? Because `source_url` proves *where* a figure came
from, not *what the page said the day someone read it*. When a threshold moves, the useful
question is what changed — and `git diff` answers it.

```bash
npx tsx scripts/fetch-source.ts F23844
```

```bash
npx tsx scripts/fetch-source.ts --all
```

<details>
<summary><strong>18 archived fiches</strong> — click to expand</summary>

| Fiche | Subject | Government verified on |
|---|---|---|
| [F21746](docs/sources/F21746-franchise-en-base-de-tva.md) | Franchise en base de TVA | 01 janvier 2026 |
| [F23257](docs/sources/F23257-micro-entrepreneur-quand-declarer-son-chiffre-d-affaires.md) | Micro-entrepreneur : quand déclarer son chiffre d'affaires ? | 01 janvier 2026 |
| [F23266](docs/sources/F23266-obligations-comptables-du-micro-entrepreneur.md) | Obligations comptables du micro-entrepreneur | 01 janvier 2026 |
| [F23267](docs/sources/F23267-regime-fiscal-de-la-micro-entreprise.md) | Régime fiscal de la micro-entreprise | 13 mai 2026 |
| [F23844](docs/sources/F23844-creation-d-entreprise-choisir-la-forme-juridique-de-votre-en.md) | Création d'entreprise : choisir la forme juridique | 10 avril 2026 |
| [F31233](docs/sources/F31233-protection-sociale-du-professionnel-liberal.md) | Protection sociale du professionnel libéral | 23 juin 2026 |
| [F32353](docs/sources/F32353-quelles-consequences-pour-un-micro-entrepreneur-qui-depasse-.md) | Conséquences d'un dépassement des seuils de CA | 21 février 2026 |
| [F32887](docs/sources/F32887-creation-d-entreprise-determiner-la-nature-de-l-activite-d-u.md) | Déterminer la nature de l'activité | 01 septembre 2024 |
| [F36354](docs/sources/F36354-separation-des-patrimoines-professionnel-et-personnel-de-l-e.md) | Séparation des patrimoines professionnel et personnel | 20 janvier 2026 |
| [F36380](docs/sources/F36380-entrepreneur-individuel-passer-de-l-impot-sur-le-revenu-ir-a.md) | Entrepreneur individuel : passer de l'IR à l'IS | 21 février 2026 |
| [F36746](docs/sources/F36746-creation-d-entreprise-formalites-d-immatriculation-d-une-mic.md) | Formalités d'immatriculation d'une micro-entreprise | 18 mars 2026 |
| [F37353](docs/sources/F37353-regime-micro-social.md) | Régime micro-social | 21 février 2026 |
| [F37366](docs/sources/F37366-societe-par-actions-simplifiee-sas-ce-qu-il-faut-savoir.md) | SAS : ce qu'il faut savoir | 06 février 2026 |
| [F37383](docs/sources/F37383-societe-par-actions-simplifiee-unipersonnelle-sasu-ce-qu-il-.md) | SASU : ce qu'il faut savoir | 06 février 2026 |
| [F37396](docs/sources/F37396-entrepreneur-individuel-ei-ce-qu-il-faut-savoir.md) | Entrepreneur individuel (EI) : ce qu'il faut savoir | 21 février 2026 |
| [F37398](docs/sources/F37398-micro-entrepreneur-ce-qu-il-faut-savoir.md) | Micro-entrepreneur : ce qu'il faut savoir | 21 février 2026 |
| [F37411](docs/sources/F37411-societe-a-responsabilite-limitee-sarl-ce-qu-il-faut-savoir.md) | SARL / EURL : ce qu'il faut savoir | 06 février 2026 |
| [F38152](docs/sources/F38152-protection-sociale-du-dirigeant-de-societe.md) | Protection sociale du dirigeant de société | 25 juin 2026 |

</details>

## Choosing a legal form — what the sources say

> ⚠️ **Digest awaiting human verification.** This summarises the archived fiches so a human
> can check it *before* any of it becomes something the app tells a user. None of it is
> wired into the product yet. Figures are 2026.

The four forms a solo founder actually chooses between, and the axes that separate them:

| | **Micro-entreprise** | **EI** (au réel) | **EURL** | **SASU** |
|---|---|---|---|---|
| What it is | a simplified *regime* on top of an EI | entreprise individuelle | company, one associate | company, one associate |
| Associates | none | none | 1 | 1 |
| Head | the entrepreneur | the entrepreneur | gérant | président |
| Share capital | none | none | free | free, from 1 € |
| Default tax | IR, flat abatement | IR (option IS) | IR (option IS) | **IS** (option IR) |
| Social status | TNS | TNS | TNS, gérant associé | **assimilé salarié** |
| Accounting | livre de recettes | full accounts | full accounts + annual filing | full accounts + annual filing |
| Turnover ceiling | **203 100 € / 83 600 €** | none | none | none |

Sources: [F23844](docs/sources/F23844-creation-d-entreprise-choisir-la-forme-juridique-de-votre-en.md),
[F37396](docs/sources/F37396-entrepreneur-individuel-ei-ce-qu-il-faut-savoir.md),
[F37411](docs/sources/F37411-societe-a-responsabilite-limitee-sarl-ce-qu-il-faut-savoir.md),
[F37383](docs/sources/F37383-societe-par-actions-simplifiee-unipersonnelle-sasu-ce-qu-il-.md).

**Four things that decide it in practice**

1. **Personal patrimony is already protected in an EI.** Since the statut unique, an
   entrepreneur individuel's professional and personal patrimonies are separated
   *automatically* — no company required. That removes the most common reason people are
   told to incorporate.
   ([F36354](docs/sources/F36354-separation-des-patrimoines-professionnel-et-personnel-de-l-e.md))

2. **TNS vs assimilé salarié is the real fork.** Gérant majoritaire de SARL, gérant associé
   d'EURL and associé de SNC are TNS; every other head — a SASU president included — is
   assimilé salarié, on the régime général with protection close to an employee's, and
   correspondingly higher contributions.
   ([F38152](docs/sources/F38152-protection-sociale-du-dirigeant-de-societe.md))

3. **Micro is cheap and blunt.** Contributions are a flat percentage of turnover with no
   deduction of real costs: **12,3 %** vente, **21,2 %** services BIC, **25,6 %** libéral
   non réglementé hors Cipav, **23,2 %** Cipav, **6 %** meublés de tourisme classés. Income
   tax applies a flat abatement instead of real expenses — **71 %** vente, **50 %** services
   BIC, **34 %** BNC, never less than 305 €. Excellent with thin costs, punishing with
   heavy ones. ([F37353](docs/sources/F37353-regime-micro-social.md),
   [F23267](docs/sources/F23267-regime-fiscal-de-la-micro-entreprise.md))

4. **IS is 25 %, or 15 % on the first 42 500 €** for companies under 10 M€ turnover with at
   least 75 % of their capital held by individuals. Which means "at what profit does a
   company beat the micro regime" is arithmetic, not opinion.
   ([F37411](docs/sources/F37411-societe-a-responsabilite-limitee-sarl-ce-qu-il-faut-savoir.md))

**Open before this becomes a rule:** unemployment coverage per status (not stated in the
fiches archived so far), ACRE rates and eligibility, and whether the recommendation should
be a scored comparison or a decision tree.

## Roadmap

| | Milestone | State |
|---|---|---|
| M1 | Rules engine, schemas, loader, CI | done |
| M2 | Assessment (SIREN + wizard), dashboards, local profile | done, except auth |
| M2.5 | Auth + persistence (Supabase, EU region) | blocked — needs credentials |
| M3 | The preparer: computed amounts, checklists, caveats | done for URSSAF, CFE, thresholds |
| M4 | Notifications: J-30 / J-7 / J-1, email and web push | next |
| M5 | AI edges: document parsing, grounded Q&A over service-public data | planned |
| M6 | Truth watchdog: weekly source diff, staleness alerts | planned |

The engine already computes correct dated actions for any profile, so each later milestone
consumes `computeActions()` rather than reinventing it.

## Documentation map

| Document | Read it when |
|---|---|
| [Design spec](docs/superpowers/specs/2026-08-07-autostartuper-design.md) | You want the whole product in one sitting |
| [M1 plan — rules engine](docs/superpowers/plans/2026-08-07-m1-foundation-rules-engine.md) | You are touching the engine or the schemas |
| [M2 plan — assessment](docs/superpowers/plans/2026-08-12-m2-assessment.md) | You are touching the wizard or the profile |
| [Rules authoring guide](rules/README.md) | You are writing or changing a rule |
| [`docs/sources/`](docs/sources/) | You want to check what an official page actually says |
| [AGENTS.md](AGENTS.md) | You are an AI agent working in this repo |

Each plan carries an **Amendments** block at the top recording where execution deviated
from the plan, and why. That is the honest history — read it before trusting a code snippet
further down the same file.

## Disclaimer

AutoStartUper provides information drawn from official sources. It is not legal, tax or
accounting advice. Deadlines and amounts must be confirmed on the official site before you
act on them.
