# Writing rules

Every file in this directory is one rule, and every rule is a claim about French
law that the app will repeat to a user as an instruction. Treat it that way: a
wrong value here becomes a wrong action on someone's dashboard, and they have no
way to tell.

The gate is `npm run validate:rules -- --min 14`. It runs in CI and it checks the
schema, not the truth. The truth is on you.

## Layout

```
rules/
  obligations/   recurring things with a date  (type: obligation)
  thresholds/    money limits                  (type: threshold)
  steps/         one-off things to do          (type: roadmap_step)
```

One rule per file, named after its `id`. The loader walks the tree recursively
in sorted order, so subdirectories are free if a category grows.

## Field order

Keep it identical across files — a reader comparing two rules should not have to
hunt:

```
id
type
title
<type-specific>     schedule | value, warn_ratio | phase, prerequisites
applies_to
source_url
verified_on
valid_from
valid_until         (optional)
```

## The comment block

Every rule opens with a comment, and it is not decoration. It carries what the
schema cannot: the conditions and exceptions behind the value, and the parts of
the fiche the single `title` line cannot hold. **M2 writes UI copy from these
comments**, so an incomplete one becomes a misleading button — "recommended" and
"required" are different screens.

Say the exception even when it does not fit the model yet. `cfe-paiement` cannot
express the creation-year exonération in v1, so the comment states it and names
what M2 must do about it.

## `applies_to` — fact or scope?

Two different reasons produce the same YAML, and only a comment tells them apart:

- **Fact** — the rule genuinely concerns only these profiles. The micro plafonds
  are micro-only because that is what the law says. No marker.
- **Scope** — the rule is broader in law, but v1 only ships the micro path. Mark
  it: `# v1: rule scoped to micro; other forms in M2+`.

Without the marker, someone opening the file in six months cannot tell whether
widening it is a bug fix or a lie.

An **omitted** condition means "no constraint". An empty list (`legal_forms: []`)
matches nobody and is always a mistake — the schema rejects it.

Life-cycle phases: do **not** add `lifecycle_phases` just to keep obligations
away from an `idee` profile. The engine already drops all obligations and
thresholds for unregistered users (`isRegistered` in `engine.ts`). Use the field
only for a distinction that is genuinely about this one rule.

## Millésime — `valid_from` / `valid_until`

`valid_from` is the first day the rule's **figures** are in force, not the day
you wrote it. A revalued threshold is a **new rule with a new id**, not an edit:
the old one keeps its window and gets a `valid_until`, so a date in the past
still resolves to what was true then.

Both bounds are inclusive. Windows for successive vintages of one rule must not
overlap — the loader cannot check that yet (there is no lineage field), so it is
maintained by hand.

## `source_url` and `verified_on`

- Official https sources only; the schema enforces the domain list.
- Link the fiche that states the figure, not a summary of it.
- `entreprendre.service-public.gouv.fr` is the canonical host today.
- `urssaf.fr` is unreachable from this environment — use a service-public fiche.
- `impots.gouv.fr`'s micro FAQ still serves the **old** 2023-2025 plafonds. Do
  not "correct" the current figures back to it.
- `verified_on` is the day a human last opened that page and read the value.
  Never copy it forward from another file. Past 183 days the gate warns.

## `id`

Lowercase letters, digits and hyphens. Descriptive and stable — ids appear in
`prerequisites`, in `completedStepIds` saved per user, and in test expectations.
Renaming one breaks saved user state.

## `prerequisites` (steps only)

Now safe to use. The loader rejects a prerequisite that some of its dependent's
users could never satisfy — the silent trap where a step is shown to a micro
user, its prerequisite is not, and the step stays blocked forever with nothing
to explain why.

Two rules follow from that check:

- the prerequisite's `applies_to` must be **at least as broad** as its
  dependent's. Narrower is a hard error.
- the prerequisite must sit in the **same phase or an earlier** one. The roadmap
  does not go backwards, so a `routine` prerequisite can never be completed by
  someone still in `lancement`.

The dependency graph is also checked for dangling ids, non-step targets and
cycles. Note that `pendingSteps` looks only at *direct* prerequisites: ticking a
step off asserts the state it leaves you in.

## Before you commit

```bash
npm run validate:rules -- --min 14
```

and bump `--min` when you add a rule, in this file's sibling
`.github/workflows/ci.yml` too.
