# Setup — the things only you can do

Every item below is blocked on an account, a key or a judgement call that is yours to
make. Each one is self-contained: do them in any order, or just the one you need.

**None of them are needed to run the app.** `npm run dev` works today with no account and
no keys — see the [README](README.md). These unlock the milestones that come next.

| # | Task | Time | Unlocks |
|---|---|---|---|
| [1](#1-push-to-github) | Push to GitHub | 5 min | CI, the weekly truth watchdog |
| [2](#2-verify-the-legal-form-digest) | Verify the legal-form digest | 30–45 min | The pre-creation recommendation |
| [3](#3-supabase--accounts-and-persistence) | Supabase | 20 min | M2.5 — accounts, real persistence |
| [4](#4-vercel--deployment) | Vercel | 10 min | A public URL, PWA install |
| [5](#5-brevo--reminder-emails) | Brevo | 15 min | M4 — reminder emails |
| [6](#6-vapid--web-push) | VAPID keys | 5 min | M4 — web push |
| [7](#7-mistral--the-ai-edges) | Mistral | 10 min | M5 — document parsing, grounded Q&A |

## Before you start: how to hand me a secret

**Don't.** Never paste an API key or a password into this chat, into a commit, or into a
file that is not ignored by git.

The flow that works:

1. You create the key in the provider's dashboard.
2. You put it in `.env.local` at the repo root — already covered by `.gitignore` (`.env*`).
3. You tell me *"Supabase is set up"*.

I write code against the variable **name**, never the value. If I ever need to confirm a
key exists I will check that the variable is set, not print it.

A template of every variable this project uses lives in [`.env.example`](.env.example) —
that file is committed on purpose and must never hold a real value.

---

## 1. Push to GitHub

**Unlocks:** CI on every push, and the weekly truth watchdog that re-reads the official
pages behind the rules. Both workflows are already written and waiting.

The repo is a local git repository with no remote. Nothing here is published yet.

### Steps

1. Create an empty repository on GitHub — **no** README, `.gitignore` or licence, since
   this repo already has its own history. Private is fine; the watchdog works either way.

2. From the repo root, point at it and push. Replace the URL with yours:

```bash
git remote add origin https://github.com/<you>/autostartuper.git
```

```bash
git push -u origin master
```

3. Create the label the watchdog uses when it opens an issue. Without it, the workflow
   step fails at the last line:

```bash
gh label create truth --description "A source page moved under a rule" --color B60205
```

4. Check that CI ran: **Actions** tab → the *CI* workflow should be green (rule gate, lint,
   tests, build, typecheck).

5. Trigger the watchdog once by hand rather than waiting for Monday: **Actions** →
   *Truth watchdog* → **Run workflow**. Expect a green run and no issue, since every
   archived page currently matches.

### Verify

```bash
npx tsx scripts/check-sources.ts
```

Locally this should end with `20 fiches checked, 0 changed, 12/14 rules watched.` The
Actions run should say the same.

### Notes

- The default branch here is `master`, and both workflows are configured for it. If GitHub
  renames it to `main` on creation, tell me and I'll update the `on: push: branches` lists.
- Scheduled workflows on GitHub only run from the **default branch**.
- A private repo gets 2 000 free Actions minutes a month; this uses a couple per week.

---

## 2. Verify the legal-form digest

**Unlocks:** the pre-creation branch's recommendation — the one thing the assessment
promises and does not yet deliver.

**No account needed.** This is reading, and a decision.

I gathered and archived 18 official fiches, then summarised the four solo forms in
[README § Choosing a legal form](README.md#choosing-a-legal-form--what-the-sources-say).
I will not turn any of it into a rule the app states until a human has checked it, because
the whole product rests on the claim that its facts are verified.

### What to check

Open the digest side by side with the archived sources. For each row, confirm the claim
matches the fiche:

| Claim to check | Against |
|---|---|
| Micro / EI / EURL / SASU comparison table | [F23844](docs/sources/F23844-creation-d-entreprise-choisir-la-forme-juridique-de-votre-en.md), [F37396](docs/sources/F37396-entrepreneur-individuel-ei-ce-qu-il-faut-savoir.md), [F37411](docs/sources/F37411-societe-a-responsabilite-limitee-sarl-ce-qu-il-faut-savoir.md), [F37383](docs/sources/F37383-societe-par-actions-simplifiee-unipersonnelle-sasu-ce-qu-il-.md) |
| EI patrimony separated automatically | [F36354](docs/sources/F36354-separation-des-patrimoines-professionnel-et-personnel-de-l-e.md) |
| TNS vs assimilé salarié, and who is which | [F38152](docs/sources/F38152-protection-sociale-du-dirigeant-de-societe.md) |
| Cotisation rates 12,3 / 21,2 / 25,6 / 23,2 / 6 % | [F37353](docs/sources/F37353-regime-micro-social.md) |
| Abatements 71 / 50 / 34 %, floor 305 € | [F23267](docs/sources/F23267-regime-fiscal-de-la-micro-entreprise.md) |
| IS at 25 %, 15 % up to 42 500 € | [F37411](docs/sources/F37411-societe-a-responsabilite-limitee-sarl-ce-qu-il-faut-savoir.md) |

The rates in the third row are **already live** in `rules/rates/` and feed the amounts the
app shows. Everything else is inert text.

### Then decide three things

1. **Shape.** A scored comparison ("here is how each form fits your answers, with why") or
   a decision tree ("you said X, so Y")? A comparison is honest about trade-offs; a tree is
   easier to act on and easier to be wrong with.
2. **How firm.** *"Recommended for you"* or *"here is how they compare"*? This decides
   whether the app is giving advice, which changes the disclaimer it must carry.
3. **The three open items** I refused to assert without a source: unemployment coverage per
   status, ACRE rates and eligibility, and whether the Cipav distinction should become a
   profile question.

### Tell me

*"Digest checked — corrections: … Go with a scored comparison / decision tree."*

I will then author the criteria as sourced rules (archiving any fiche I still need), build
the recommendation, and pin it with golden personas.

---

## 3. Supabase — accounts and persistence

**Unlocks:** M2.5. Today the profile lives in `localStorage`: clear your browser and it is
gone, and it cannot follow you to your phone. This makes it real, and is the prerequisite
for reminders having somebody to remind.

### Steps

1. Sign up at [supabase.com](https://supabase.com) and create a project.

2. **Region: EU.** Choose *Paris (eu-west-3)* or *Frankfurt (eu-central-1)*. Turnover
   figures and uploaded documents are personal data, and the spec commits to EU residency.
   The region **cannot be changed later** — a wrong choice here means recreating the
   project.

3. Save the database password somewhere safe when it is generated. You will not see it
   again, and you need it for direct SQL access.

4. Copy the project credentials: **Project settings → API** (some dashboards call this
   *API keys*). You need three values:

   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon** / **publishable** key — safe in the browser
   - the **service_role** / **secret** key — **server only**, never in a
     `NEXT_PUBLIC_` variable, never in client code

5. Create `.env.local` at the repo root:

```bash
cp .env.example .env.local
```

Then fill in the three Supabase lines. Nothing else in that file is needed yet.

6. Tell me it's ready. I will write the schema migration, the row-level-security policies
   and the auth flow (email magic link, per the spec — no passwords to manage).

### What I'll build on top

Five tables from the design spec: `business_profiles`, `revenue_entries`, `action_states`,
`documents`, `notifications_log` — every one with RLS so a row is readable only by the user
it belongs to, plus self-service export and account deletion (RGPD, spec §14).

I'll write the SQL as a checked-in migration rather than clicking through the dashboard, so
the schema lives in git like everything else.

### Note on the free tier

A free Supabase project **pauses after a week of inactivity**. The spec already plans a
keep-alive ping; I'll add it to the watchdog workflow, which runs weekly anyway.

---

## 4. Vercel — deployment

**Unlocks:** a real URL, and the PWA install prompt. Best done *after* Supabase, so the
deployed app has somewhere to store data — but it deploys fine before that, local-only.

### Steps

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account and **Import** the
   repository. Requires [step 1](#1-push-to-github).

2. Accept the detected settings. Next.js needs no configuration here; the build command is
   `npm run build` and the output is handled for you.

3. Add environment variables — **Project settings → Environment variables** — the same
   names as in `.env.local`. Add them to *Production* and *Preview*.

4. Deploy, then open the URL and run through the assessment with a real SIREN. The company
   lookup calls a public API from our own server, so it works with no extra configuration.

### Verify

- The assessment completes and the dashboard shows dated actions.
- `/api/actions` returns JSON rather than an error — if the rules failed to load, the app
  says so explicitly instead of showing an empty list.

### Note

`rules/*.yaml` and `docs/sources/` are read from the filesystem at runtime. They are part
of the repository, so they ship with the deployment — no extra step. Adding a rule requires
a redeploy, which is the intended behaviour: truth changes through a commit.

---

## 5. Brevo — reminder emails

**Unlocks:** half of M4. The scheduling logic is built and tested
([`src/lib/notify/`](src/lib/notify/)); this is the transport under it.

### Steps

1. Create an account at [brevo.com](https://www.brevo.com). The free tier allows 300
   emails a day, which is far beyond an invite-only tester group.

2. **Validate a sender.** Under *Senders & domains*, add the address reminders will come
   from and confirm it by email. Skipping this is the usual reason the first send fails.

3. Create an API key: **SMTP & API → API keys → Generate a new API key**. Copy it once —
   it is not shown again.

4. Put it in `.env.local` as `BREVO_API_KEY`, and set `REMINDER_FROM_EMAIL` to the sender
   you validated.

5. Tell me. I'll wire the transport, a daily cron that calls `dueReminders()`, and the
   `notifications_log` write that makes a duplicate send impossible.

### Worth knowing before you commit to it

- Sending to an unvalidated sender fails silently in some setups. My adapter will surface
  the failure rather than swallow it.
- A reminder that goes out twice teaches people to ignore the app. The dedupe key is
  already built and tested — action + due date + window.
- Deliverability improves a lot with your own domain; a free-provider sender address will
  land in spam more often.

---

## 6. VAPID — web push

**Unlocks:** the other half of M4. **No account, no cost** — VAPID keys are generated
locally, and browser push needs no vendor.

### Steps

1. Generate a key pair:

```bash
npx web-push generate-vapid-keys
```

2. It prints a public and a private key. Put them in `.env.local`:

   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the public one; it ships to the browser, which is why
     it carries the `NEXT_PUBLIC_` prefix
   - `VAPID_PRIVATE_KEY` — server only
   - `VAPID_SUBJECT` — `mailto:` plus your contact address, required by the spec

3. Keep them. Rotating the key pair invalidates every existing subscription, and every user
   would have to re-enable notifications without being told why.

4. Tell me, and I'll add the service worker, the subscription flow and the push sender.

### Note

Web push needs HTTPS, so it works on the Vercel deployment and on `localhost`, but not over
plain HTTP on a LAN address. iOS only delivers push to a PWA the user has **added to the
home screen** — worth knowing before concluding it is broken.

---

## 7. Mistral — the AI edges

**Unlocks:** M5. Two features, both deliberately at the edges: reading a document you
upload (which you then confirm field by field), and answering questions with citations.
Neither ever decides what you owe.

### Steps

1. Create an account at [console.mistral.ai](https://console.mistral.ai) — a French
   provider, which keeps the data residency story consistent.

2. Create an API key and put it in `.env.local` as `MISTRAL_API_KEY`.

3. Check whether the free experimental tier is still open on your account, and whether you
   are willing to add a paid plan. Ballpark: parsing a KBIS is a fraction of a cent; the
   Q&A corpus needs a one-off embedding run over the service-public fiches.

4. Tell me, and I'll build it in the order the spec sets out: document parsing with
   per-field confidence and a human validation screen first, then the grounded Q&A.

### What I'll hold to

- **Every answer cites its fiche, or says it found nothing.** No good match means *"je ne
  trouve pas de source officielle, voici où chercher"* — never an improvised answer.
- **Extraction is a suggestion, not a fact.** Low-confidence fields are marked *à vérifier*
  and the user confirms before anything reaches the profile.
- **A [Réessayer] button on every failure**, as everywhere else in the app.

---

## Where things stand without any of this

The app runs, the engine is correct, the rules are sourced and archived, and the preparer
fills in real figures. What you cannot do yet: keep a profile beyond one browser, get
reminded, or ask a question.

Nothing in this file changes what the app *claims* — only who can use it and how far it
reaches. The verification task in [step 2](#2-verify-the-legal-form-digest) is the only one
that touches the truth layer, which is why it is the only one I refuse to do alone.
