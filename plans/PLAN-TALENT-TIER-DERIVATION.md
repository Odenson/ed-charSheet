# Plan: Talent tiers become derived — band of the learned Circle

> **Status: implemented (2026-08-21).** Migration left lazy per owner — existing
> files keep loading and convert on their next save/export.

The character sheet stores a `tier` string on every talent (`{ name, rank, tier,
circle }`). The rules already determine that tier — it is the Circle band of the
discipline placement the talent was learned at — so the stored copy is a
duplicate of rule data, and it has drifted: kolon's hand-imported tiers disagree
with both the catalog and his own stored circles. This plan removes `tier` from
character inputs and derives it, exactly like every other value a rule can
recompute ("store only inputs", ARCHITECTURE.md §4.1).

## The rule (verified against the Player's Guide extract)

- **p.85, Discipline Talents vs Talent Options:** Discipline Talents are
  "always available at the indicated Circle". Talent Options come from pools
  keyed to status (Novice / Journeyman / Warden / Master), but "**the cost of
  advancing the talent is based on the Circle at which it was learned**" — a
  slot may be filled from a *lower* pool.
- **p.457–458, multiple Disciplines (Mica example):** bands are universal by
  circle ("Circle 1–4 talents … bought as if they were Circle 5–8"), and an
  option known through two disciplines is priced "based on its Circle — **even
  if it is available as a Talent Option at a lower tier for a new
  Discipline**". A talent-intrinsic tier therefore does not exist.
- **Versatility:** "+1 tier over normal" — a modifier on top of the
  placement-derived tier (same shape as the homebrew additional-tier-shift
  rule; not modeled today either way).

Truth chain: **rules/disciplines.json** says which circles offer a talent →
**the character** records which circle-slot it actually fills (`circle`, an
input) → **tier = the band of that circle** (1–4 Novice, 5–8 Journeyman,
9–12 Warden, 13–15 Master). The band ladder is already rule data:
`rules/legend.json` `costs.tiers`. The stored `tier` string short-circuits this
chain — removing it is pure duplication cleanup.

## Decisions locked (owner, 2026-08-21)

| Q | Decision |
|---|---|
| Source of truth for tier | **The discipline placement**, expressed as the learned Circle — derived via `costs.tiers`, never stored on talents |
| Per-talent `circle` field | **Stays on the character** — an input (options can be learned at the current Circle from lower pools; PG p.85) |
| kolon's divergent saved tiers | **Accept the corrected numbers** — his audit reprices when derivation lands (import artifacts) |
| Schema tag | **Bump to `ed-character/2`**; readers accept `/1` and `/2`; branch files convert on next save/export |
| Skills | **Keep stored skill `tier`** — no circle exists to derive from (documented exception, matches the REVIEW-FINDINGS quirk note) |
| `rules/talents.json` authored tiers | **Stay** — canonical-placement display metadata only; no pricing consumer after this change |

## Where tier lives across the solution (after)

| # | Location | Role |
|---|---|---|
| 1 | `rules/legend.json` → `costs.tiers[]` | The **only rule definition** of tier (circle bands → labels). Already exists; unchanged. |
| 2 | `engine/legend-spent.js` → new `tierForCircle(circle, costs)` | The **only place tier is computed**: first matching band's label; missing/out-of-band circle → `null` (flagged, never fabricated). |
| 3 | `store.js` model build → talent `detail.tier` | A **computed display copy** for the Disciplines info-modal chip, re-derived on every `deriveModel`; never persisted. |
| 4 | Audit lines / UI strings (`Novice · Rank 4`) | Rendered output only, fed by #2/#3. |
| 5 | Character files (`ed-character/2`) | **Absent on talents** — stripped on edit-merge (`applyEdits`) and on save/export. Skills keep `{ name, rank, tier }`. |
| 6 | `rules/talents.json` → per-talent `tier` | Catalog display metadata (canonical placement); **no engine pricing consumer** after this change. |
| 7 | `rules/thread-items.json` → item `tier` | Different concept (item power tier driving thread-rank cost progression); unchanged, still catalog-read. |

Before: tier lived in **three** places that could disagree (character input,
talent catalog, legend ladder). After: one rule definition (#1), one derivation
(#2), everything else downstream or display-only.

## Changes

### P1 — Engine (`engine/legend-spent.js`)
- New pure `tierForCircle(circle, costs)`: find `b` in `costs.tiers` with
  `circle >= b.minCircle && circle <= b.maxCircle`; return `b.label` else `null`.
- Swap the four `t.tier` reads:
  - `talentRankStepCost` (:243): first-Discipline column =
    `tierForCircle(t.circle, costs)`; additional-Discipline shift path feeds the
    same derived value into `shiftedTier` (missing circle keeps the documented
    Novice default there, then shifts). Only production callers are
    store.js:1114–1115, which forward the raw input object unchanged — the
    change is engine-internal; no store-side edit accompanies this swap.
  - First-Discipline audit line (:318): price + detail string use the derived
    tier; unbanded circle renders `— · Rank N` and prices null (existing
    unpriceable contract).
  - Additional-Discipline line (:320–325): `opts.tier` becomes the derived
    tier; `tierNote` (`Novice → Journeyman`) logic unchanged.
- Skills (:267, :345) untouched.

### P2 — Store (`store.js`)
- Import: add `tierForCircle` to the existing `./engine/legend-spent.js`
  import (:12).
- Model build (:623): `detail.tier` = `tierForCircle(t.circle,
  legendFile?.costs)` (catalog fallback removed — the chip shows what pricing
  actually uses; `null` when costs are absent or the circle is unbanded).
- Strip on edit-merge: in `applyEdits`, where `edits.advancements` is applied
  wholesale (:478–479), delete `tier` from each entry of
  `edits.advancements.disciplines` before merging — same pattern and rationale
  as the `knockedDown` strip (:456–460): overlays written by older builds
  replace arrays wholesale, so a removed field must not leak back into the
  character through a stale overlay. (Skills pass through untouched.)
- No load-strip: after P1 nothing reads talent `tier`, so residue on a
  never-edited session is inert; every persistence path funnels through
  `forSave` below. Fewer touch points than normalizing at read.
- New pure `forSave(character)`: sets `schema: 'ed-character/2'` and strips
  talent `tier` — the serializer-side guarantee for files that predate the
  bump and are saved without ever passing through an advancement edit.
  Wired at the two serialization points:
  `ui/ed-app.js:1234` (`saveServer`) and `:1289` (`exportCharacter`).
  Import: add `forSave` to `ui/ed-app.js`'s existing `'../store.js'`
  import (:3).

### P3 — Validators (`tools/worker/worker.js`, `tools/dev-server.mjs`)
- Accept `schema === 'ed-character/1' || 'ed-character/2'` (:373 / :123) so
  pre-bump branch files keep saving until each is rewritten.

### P4 — Docs, tests, changelog
- ARCHITECTURE.md §4.1: talent example becomes `{ name, rank, circle }` + a
  sentence on the derivation.
- Schema-tag sweep ("writes `/2`, accepts `/1`+`/2`") — every doc that states
  the `/1`-only contract: ARCHITECTURE.md :350, :434, :573; CLAUDE.md :37;
  docs/GITHUB-SERVERLESS-SAVE.md :94 (worker-validation contract);
  docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md :29, :68 and the curl examples
  (:171–178).
- plans/PLAN-RANK-EDITING.md:50–54: reverse the "no catalog fallback" decision
  with a dated row (superseded: tier is now derived, not stored *or* catalog-
  looked-up).
- Tests (per-module `*.test.js`, at root or beside the module):
  - engine/legend-spent.test.js (exists; :222–336 already cover
    `talentRankStepCost`): add `tierForCircle` band tests (1/4/5/8/9/12/13/
    15, 0, 16+, missing). Existing fixtures already carry `circle`; the
    noTier→null unpriceable case (:334) flips to noCircle→null
    (`{ name, rank, tier }` with no circle).
  - store-advancement.test.js: talent fixtures already carry `circle`
    (:51, :66, :139, :193) — drop the now-inert `tier`; missing-tier case
    (:150) becomes missing-circle→null; add edit-merge strip test (stale
    overlay with `tier` merges clean) and `forSave` tag+strip test.
  - store-homebrew.test.js (:163–183): tierShift fixtures already carry
    `circle` — dropping `tier` is fixture hygiene; behavior unchanged.
  - store-notes.test.js: one talent-tier fixture (:52) — **inert**: its
    assertions cover notes/history/legend round-trips, and the pricing assert
    (:169–173) reads `circle` (present ⇒ same 1300). Drop for hygiene;
    no failure if skipped.
  - store-ranks.test.js: **no change** — its only `tier` hit (:112) is a skill
    fixture (skills keep stored tier); its talent fixtures (:43–47, :142–146,
    :157) carry neither tier nor circle and feed grant-fold/step tests with
    no pricing assertions — unpriced before and after.
  - store-thread-item.test.js: **untouched** — item `tier` is the thread-item
    power-tier concept (table row #7), not talent tier.
  - tools/dev-server.test.js (+ worker equivalent): dual-tag acceptance.
- `data/changelog.json` unreleased entries per WORKFLOW.md.

## Verification

1. Full suite green (`npm test`).
2. Headless before/after `auditLegendSpent` diff for the three local
   characters (`data/characters/`: chakka.json, chakka-test.json, kolon.json):
   **chakka must be byte-identical** (every talent circle ≤ 4 ⇒ Novice); kolon's
   repricing reported explicitly to the owner before push.
3. Save round-trip: load → edit rank → save produces `ed-character/2` JSON with
   no talent `tier`; reload applies cleanly.

## Out of scope

- Skill `tier` storage and the numeric-vs-label quirk in `rules/skills.json`
  (pre-existing, deliberately deferred — docs/REVIEW-FINDINGS.md).
- Versatility +1-tier pricing (not modeled today; derivation composes with it
  if ever added).
- Any change to thread-item or spell pricing (already catalog-driven).

## Log

| Date | Change |
|---|---|
| 2026-08-21 | Plan created; owner decisions locked; rulebook verification (PG pp. 85, 124, 457–458). |
| 2026-08-21 | Review pass: strip site corrected to `applyEdits` (:478–479, knockedDown precedent :456–460), load-strip dropped; `tierForCircle` import + `legendFile?.costs` scope fixed; `forSave` import into ed-app.js added; :1110 bullet rewritten (no code change — pricer reads raw.circle); P4 schema-tag doc sweep enumerated; test homes named; verification characters listed. |
| 2026-08-21 | Second pass: :1110 bullet removed from P2 entirely — the rank-step call sites (store.js:1114–1115) forward raw inputs unchanged; the change is engine-internal (noted in P1). Corrected self-review error: engine/legend-spent.test.js exists (earlier root-level glob missed it); band tests redirected there; its noTier→null case (:334) flips to noCircle→null. |
| 2026-08-21 | Third pass: per-file test dispositions made explicit — store-notes.test.js talent-tier fixture (:52) inert (hygiene only), store-ranks.test.js needs nothing (skill-tier hit; unpriced fold fixtures), store-thread-item.test.js untouched (item power-tier). |
