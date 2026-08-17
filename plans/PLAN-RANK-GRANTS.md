# Plan: fold rank grants into the derived talent/skill step

Thread items and other sources can **grant ranks** in a talent or skill via the
`grant-ability` effect (`docs/EFFECT-TAXONOMY.md` §2: `measure: "rank"`). Today
the effect is **listed**, never **applied**: `Dark Archer Armour` woven to
thread rank 2 grants +1 to Avoid Blow, but the Disciplines tab still shows the
talent's unmodified rank and step — a fighter whose step should be 13 still
rolls 12. This plan folds the *derived rank grant* into the character's model:
`add`/`subtract` grants bump the **step** of the talent/skill that possesses the
ability, and `set` grants establish **possession** of an otherwise un-learned
ability — so every consumer (Disciplines tab, Combat tab, dice,
karma-eligibility) benefits from the same engine-derived number.

This was the plan for owner review — **implemented 2026-08-17.** It is a
data-in-shape change: it adds new **derived** values (folded step + granted
possession) inside the existing taxonomy vocabulary (`grant-ability`,
`measure: rank`, `operation: set/add/subtract`, `condition: always`, `stacking`).
No schema shape changes, no taxonomy bump, no new data field that a rule could
recompute — Tier 3.

- **Owner:** repo owner. **Created:** 2026-08-17. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `d2fa0a1` + the uncommitted Talent-Combat-Options work
  (same working tree as [PLAN-TALENT-COMBAT-OPTIONS.md](PLAN-TALENT-COMBAT-OPTIONS.md)).
  Suite **443** (trade-items baseline).
- **Reference:** [EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md) §2 (grant-ability),
  §5 (`measure: rank`), §6 (`condition` / auto-apply), §7 (`stacking`);
  `engine/characteristics.js` (`autoApplies` / `collapseStacking` /
  `applyModifiers`); `store.js` talent (≈562) and skill (≈933) maps.
  This plan follows the taxonomy's auto-apply rule exactly: only effects with
  `condition: "always"` and not `gmDiscretion` are auto-folded into values.

---

## The rule (owner table) — **final (D1–D5 agreed)**

Granting an ability to a character model means the `grant-ability` effect
(`measure: rank`, auto-applying under the taxonomy rule) contributes to the
model in **two ways, decided by `operation`**:

- **`set` → *possession*.** `set: 0` grants the ability at rank 0 — available,
  unranked access (races' Versatility & Windling Astral Sight, the Astral Sight
  gift in `rules/items.json`). `set: N>0` grants it at rank N (future-proof; no
  such data yet). On an ability the character already learns, `set` leaves the
  learned rank and step untouched — a `set` is not an adder.
- **`add` / `subtract` → *rank bonus*** on a **possessed** ability (learned, or
  `set`-granted): `effectiveRank = possessedRank + bonus` and
  `step = talentStep(attrStep, effectiveRank)`; dice follow. Stored rank stays
  untouched.

The fold is engine-side, pure, and surfaced as a real derived value — so the
Disciplines tab, Combat tab, dice, and karma eligibility all read the folded
step, while the Legend audit keeps pricing the *learned* rank. No grant can
fabricate a number: no rank/possession → no fold; an attribute-less owned
ability cannot gain a step.

### What changes (rule ON)

1. **Owned, attribute-bearing talents & skills** — `add`/`subtract` bonuses
   fold into `step`/`dice` via `effectiveRank`. `set` leaves them as-is.
2. **Attribute-less owned talents** (e.g. True Shot) — no step column exists;
   rank bonuses cannot produce one. Listed, not folded.
3. **`set`-granted, un-learned abilities** (e.g. Astral Sight via gift or Windling
   race) — possessed at rank 0: the model gains a derived **granted-ability row**
   (own group on the Disciplines tab, D5), no step until ranked. `set: N>0` would
   materialize it ranked *with* a step. The race/learned copy stays untouched.
4. **`add` on an un-possessed ability** — no row to fold into (a bonus is not
   possession). The grant stays visible in Active Effects; only a `set` grant
   establishes it.
5. **Situational / `on-success` / `gmDiscretion` grants** (e.g. Espagra Boots'
   +3 Great Leap "for one test, for 1 Strain") **surface, never fold** — matching
   the engine's auto-apply contract (`autoApplies`, characteristics.js:52).

## Owner decisions — **all signed off (2026-08-17)**

| # | Decision | Agreed |
|---|---|---|
| D1 | Fold targets | **Both talents and skills** |
| D2 | `operation` handling | **Manage both `set` (possession) and `add`/`subtract` (rank bonus)** per the rule above |
| D3 | Cross-source stacking | **Stacking allowed** — respect declared `stacking` via `collapseStacking`; each thread item is its own progression, so two items each granting +1 stack unless `unique` |
| D4 | Where the fold runs | **Path A** — post-`activeEffects` fold over the completed talent/skill rows (small, safe diff; Path B reorder not taken) |
| D5 | Surface in the UI | **UI renders the effect** — chip on folded rows (source-named), a "Granted abilities" group for `set`-possessed rows, modal line; base learned rank still shown; never changes stored `rank` |

---

## Tier classification

| Tier | Change | Status |
|---|---|---|
| 1 | UI/UX contract (placeholder pills, tabs, modals, theme) | **Not touched.** Folded steps still render as real engine numbers; off-table stays a dashed pill. |
| 1 | Architecture golden rule (data-down / dispatch-up; pure DOM-free engine) | **Held.** New fold is a pure engine helper; store derives it; UI does not compute. |
| 1 | "Store only inputs" / schema shapes | **Held.** No new fields in `character.json` or `rules/*.json`; fold is derived. |
| 2 | Effect taxonomy | **Not touched.** Uses existing `grant-ability` + `measure: rank` + `condition: always` vocabulary. No version bump. |
| 3 | New derived value + engine helper + Disciplines-tab annotation | **This change.** |

---

## Scope

- **In:** a pure engine `foldAbilityGrants(effects)` returning per-ability
  **possession** (`set`) + **bonus** (`add`/`subtract`). Both feed off the same
  matched set (`type: "grant-ability"`, `measure: "rank"`,
  `condition: "always"`, not `gmDiscretion`) and are collapsed **per ability** —
  one collapse per fold target, never across abilities — grouping by exact
  target and collapsing each group with every effect's **own origin intact**
  (so `replace` collapses per source and two *different* sources on one ability
  both apply); `store.js` wiring into talent & skill rows **plus** a
  `model.grantedAbilities` list; Disciplines-tab chip + "Granted abilities"
  group (D5); tests.
  This is a safety rule: a `replace`/`highest` progression on one ability must
  not drop grants on a different ability, and the fold must never collapse the
  whole mixed effect list into a single survivor.
- **Out:** Durability-rank folding (health ratings are served by
  `adeptHealthEffects` off the Discipline's `durabilityRank` — no current data
  grants Durability ranks, noted for future); granting an un-learned ability a
  step through `set: N>0` beyond the plain materialized row (future-proofed, not
  exercised); anything writing back to `character.json`.

## File changes

| File | Change |
|---|---|
| `engine/characteristics.js` | `collapseStacking` reused as-is; export the 3-line `autoApplies` predicate (currently module-private, `:52`) so `ability-ranks.js` shares the single auto-apply guard |
| `engine/ability-ranks.js` *(new)* | Pure `foldAbilityGrants(effects)` → `{ possessed: {name: {setValue, sources}}, bonuses: {name: {bonus, sources}} }`; matched on `grant-ability` + `measure:'rank'`; `set` feeds possession, `add`/`subtract` feed bonuses; collapsed **per ability** by grouping on the exact target and collapsing each group via `collapseStacking` with each effect's own `origin` intact — a same-progression run that grants several abilities keeps every ability, and two different sources on one ability both apply (D3). (`collapseByTarget` is NOT reused: it re-keys every member onto one fabricated progression for a single weave's currently-in-force list, which would cancel cross-source stacking and drop all but the last of a mixed-target `replace` run — e.g. Espagra Boots' rank3 Avoid Blow.) |
| `engine/ability-ranks.test.js` *(new)* | Unit tests (below) |
| `store.js` | After `activeEffects` (≈755): build the fold; post-pass talent rows and skill rows to set `rankBonus`/`grantSources` and recompute `step`/`dice`; append `model.grantedAbilities` for `set`-possessed, un-learned abilities |
| `ui/ed-app.js` (Disciplines tab) | D5: folded rows show a source-named chip (model `rankBonus`/`grantSources`); a read-only "Granted abilities" group lists `set`-possessed rows; info modal shows the grant source line — all from the model, no computation in UI |
| `plans/PLAN-RANK-GRANTS.md` | This plan |

No changes to `rules/*.json`, `data/character.json`, `docs/EFFECT-TAXONOMY.md`.

## Implementation notes

- **Ordering fact (D4 = Path A).** Talent rows are built at `store.js:~562`,
  *before* `activeEffects` is resolved (`~755`); skill rows (`~933`) come after
  it. Path A keeps the build order and folds at the end over the completed rows,
  where `activeEffects` is already in hand. Any possessed/learned row with a
  `rank`, an `attribute`, and a bonus folds its step once. The reorder (Path B)
  is dropped.
- **Auto-apply guard shared, not duplicated.** `autoApplies` is module-private
  in `engine/characteristics.js:52` (3 lines: `condition === 'always'` and not
  `gmDiscretion`). The plan exports it rather than re-implementing it, so the
  fold and every existing characteristic fold agree on what "always" means.
- **Legend invariant (verified).** The Legend audit prices instructions from
  raw input — `engine/legend-spent.js:300`/`327` read `t.rank` straight off
  `character` — not from the model. A folded +1 step, or a `set`-possessed
  granted row, **cannot** inflate Legend costs. Test locks this.
- **Possession vs. learned.** `set` grants never touch a learned rank or step;
  they only produce the derived granted-ability row when the character has not
  learned the ability. A possession map keyed by ability name guarantees one
  row even with two sources (the Windling race's Astral Sight `set:0` and the
  gift's both assert the same possession — no double row); see the
  set-order rule below for value conflicts.
- **Collapse per fold target, not per origin.** Grants to *different* abilities
  must never collapse against each other. `collapseStacking` groups a
  `replace`/`highest` progression by `origin` only (characteristics.js:83-92)
  and keeps a single survivor per progression — so a thread item that weaves
  `replace` grants into several abilities (Espagra Boots: Avoid Blow and
  Stealthy Stride) would drop all but the last. The fold therefore groups by
  exact `grant-ability` target (ability name) and collapses **each group** with
  each effect's own `origin` intact: one survivor per ability per its declared
  stacking mode, all abilities kept, and two *different* sources on one ability
  still both apply (D3). `collapseByTarget` (characteristics.js:116) was
  deliberately NOT reused — it re-keys every member onto one fabricated
  `thread:collapse#…` progression, which is exactly right for a single weave's
  currently-in-force survivors but would silently merge Dark Archer's +1 with
  Espagra's +2 into one `replace` survivor. This is a model safety rule, not a
  new taxonomy concept; it prevents mixed-target stacks from being flattened into
  a single, incorrect outcome.
- **`set` possession order.** Dedupe is by ability name (the possession map), so
  two `set: 0` grants can never double a row. If stronger `set` values ever
  disagree, mirror `applyModifiers` pass-1: a later `set` overrides an earlier
  one (moot today — every `set` grant in the data is `0`).
- **The derived-value contract.** A folded step is a real engine number, so
  rendering it is not fabrication; an off-the-step-table result still renders
  as a muted dashed pill.
- **Taxonomy alignment.** The fold applies only to effects that satisfy the
  taxonomy contract in [docs/EFFECT-TAXONOMY.md](docs/EFFECT-TAXONOMY.md):
  `type: "grant-ability"`, `measure: "rank"`, `condition: "always"`, and not
  `gmDiscretion`. Effects that are situational, triggered, or GM-discretionary
  remain surfaced for the player/GM but are not silently auto-folded into a
  static rank or step.

## Test intent

- **Pure fold (possession):** `set: 0` on an un-learned ability → possessed at
  rank 0, no step; `set` on a learned ability → no change to rank/step;
  duplicate `set` sources collapse to one possession; `set: 2` materializes a
  ranked row for an **attribute-bearing** ability with a real `talentStep` step
  (an attribute-less granted ability still has no step).
- **Pure fold (collapse per target):** a `replace` progression that grants
  several abilities keeps **every** ability — Espagra Boots rank1 Avoid Blow +1,
  rank2 Stealthy Stride +1, rank3 Avoid Blow +2, rank4 Stealthy Stride +2 →
  Avoid Blow +2 **and** Stealthy Stride +2, never only the last. Raw
  `collapseStacking` over the mixed list is the bug this test pins; `collapseByTarget` must be the collapse path.
- **Pure fold (bonus):** multi-source `add` sums; `replace` within one thread
  progression keeps the last rank's grant (Crimson Bracers rank3's +2 supersedes
  rank1's +1, not +3); `highest`; `unique` collapses across sources; `subtract`
  folds down; `add` on an un-possessed ability produces no row and no fold;
  `situational` (Espagra rank5 Great Leap) and `gmDiscretion` grants are skipped.
- **Store integration:** Dark Archer worn at thread rank ≥1 folds +1 into Avoid
  Blow step **and dice**; thread rank 0 does not; unequipping returns the base
  step; a skill with a grant folds the same; the Astral Sight `set:0` gift on a
  non-Windling appears in `model.grantedAbilities` (rank 0, no step) and does not
  disturb a learned Astral Sight.
- **Invariants:** Legend-spent total is byte-identical before/after an item
  equip that folds and before/after granting through `set`; `character.json` is
  never written to; the Disciplines tab shows the folded step and the source
  chip, with base rank still shown (D5).