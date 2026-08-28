# PLAN — Anticipate Spell as a knack-sourced armed combat option

_Status: draft, for owner review. Follow-on to PLAN-TALENT-COMBAT-OPTIONS.md (Anticipate
Blow, Mystic Aim, True Shot)._

## 1. Goal

Make **Anticipate Spell** a working armed combat option, on the same arming mechanism as
Anticipate Blow, but sourced from the **owned knack** rather than an owned talent.

On a Simple action, the adept (who must out-initiative the target) makes an Anticipate
Spell test **vs the target's Mystic Defense**. On a hit:

- **+2 per success to Mystic Defense** against that target until end of round.
- **+2 per success to the first Attack _or_ Spellcasting test** made against that target.

The Spellcasting half must reach **both** the Combat tab and the **Spells-tab cast roll**.
Usable up to Anticipate Blow rank times per round; while used, "Anticipate Blow or any
associated knacks may not be used for other purposes this round" — surfaced as a **note on
the chips** (no enforcement in v1).

Source of truth (rulebook): Companion p.80 — it is a **knack of Anticipate Blow**,
`requiredRank: 5`, Strain 2, Step = Rank + PER.

## 2. Why this is not just "author another talent"

Anticipate Spell is **not** a standalone talent and **no discipline grants it as one**. The
repo originally held it two ways:

- `rules/talents.json` — a bare stub `{ name, action: "Simple" }`, no mechanics.
  **Already removed in-session** (the dedup, §5 Phase 1 / §9).
- `rules/knacks.json:133` — the full knack (parents: Anticipate Blow, requiredRank 5,
  strain 2, step "Rank+PER", the summary text). **Retained and enriched** by this plan.

The existing armed combat-option machinery sources **owned talents only**
(`combat.talentOptions` scans `disciplines[].talents[]`; the arms descriptor is derived on
each talent at `store.js:668`). A character owns Anticipate Spell as a **knack** (nested
under Anticipate Blow), never as a discipline talent — so the current path cannot surface
it. Per the owner decision, we **extend the source to owned knacks** rather than fake it as
a talent.

## 3. Answered design decisions (owner)

1. **Source** — extend the armed combat-option source to include **owned knacks** that
   declare `combatOptions`/`arms`, gated on the parent talent's rank (Anticipate Blow ≥ 5).
2. **Reach** — the Spellcasting half must also fold into the **Spells-tab cast roll**, not
   just the Combat tab.
3. **Exclusivity** — the same-round lockout between Anticipate Blow and its knacks is shown
   as a **note on the chips**; no disarm/greying logic in v1.
4. **File home** — knacks stay in a **dedicated `rules/knacks.json`** (already exists), not
   folded into `talents.json`. A knack's distinct shape (`parents`, `requiredRank`,
   parent-rank-gated usage, book `source`) does not belong on every talent entry. Listing a
   knack "talent-style" (nested under its parent) is a UI/derivation concern, already served
   by the `parents` link — it does not require co-locating the data with talents.
5. **No double entry** — a knack that is **not** also a real discipline talent must exist in
   `knacks.json` **only**. Its duplicate stub in `talents.json` is removed (see §5 Phase 1,
   §9).
6. **Provenance** — each knack entry carries a `source` field naming the book (e.g.
   `"Companion p.80"`), since knacks span multiple rulebooks.

## 4. Guardrail classification (ed-change-guardrail)

- **Tier 3** overall. No Tier-1 surface touched: no UI-GUIDELINES rule, no schema *shape*
  change, data-down/dispatch-up intact, engine stays pure/DOM-free, "store only inputs"
  intact (all new values derived).
- **No Tier-2**: the `effects` reuse the **existing** taxonomy — `test-modifier` /
  `defense-modifier`, `condition: on-success`, `perSuccess: true`, `measure: step|rating`.
  No new field names or controlled-vocab terms, so **no taxonomy version bump**.
- **One item to confirm (near the line):** Phase 1 adds new *optional* fields
  (`attribute`, `versus`, `arms`, `effects`, `combatOptions`) to a `rules/knacks.json`
  entry. Additive, no rename, and readers degrade (resolveKnack already tolerates missing
  fields) — read as **Tier 3 "adding data within the shape"**, but it extends what a knack
  entry may carry. **Owner: confirm this is acceptable, not a knacks-schema *shape* change.**

## 5. Implementation phases

### Phase 1 — Data: enrich the knack entry (`rules/knacks.json:133`)

Fill the `Anticipate Spell` knack out to mirror Anticipate Blow's talent shape
(`rules/talents.json:87`), keeping the existing `parents`, `requiredRank: 5`,
`action`, `strain`, `step`, `skillUse`, `restrictions`, `summary`:

- `attribute: "Perception"` — the **structured** source for the numeric roll step. The
  existing `step: "Rank+PER"` string stays as display/provenance only and is **never
  parsed** (architecture golden rule, ARCHITECTURE.md §5.5); Phase 2 derives the numeric
  step from `attribute` + Anticipate Blow rank.
- `versus: "target's Mystic Defense (requires higher Initiative than the target)"`
- `arms: { roll: { vs: "Mystic" }, rounds: 1 }`
- `effects[]`:
  - `defense-modifier` → `{domain: defense, name: "Mystic"}`, `+2`, `measure: rating`,
    `condition: on-success`, `perSuccess: true`, `duration: rounds`, `rounds: 1`,
    scope "vs the target's attacks".
  - `test-modifier` → `{domain: test, name: "Attack"}`, `+2`, `measure: step`,
    `on-success`, `perSuccess: true`, scope "first Attack test vs the target".
  - `test-modifier` → `{domain: test, name: "Spellcasting"}`, `+2`, `measure: step`,
    `on-success`, `perSuccess: true`, scope "first Spellcasting test vs the target".
    (Two test effects express the "Attack _or_ Spellcasting" clause; the "first / only
    one" qualifier is a display nuance we accept, consistent with the other arms options.)
- `combatOptions: [{ note: "Anticipate Blow & its knacks locked to this use this round" }]`
  — un-scoped (always available regardless of selected weapon/pick), plus a **passive**
  `note` string for the chip. **Do not use `excludes`** — that existing flag auto-clears the
  excluded option (ui/ed-combat.js:917-922), which is the enforcement deferred to §8.
- `presentation.shortEffect: "+Mystic Def & Spellcast"` (or similar) for column display.
- `source: "Companion p.80"` — provenance (decision 6).

**Dedup (already applied in-session):** the duplicate `Anticipate Spell` stub in
`rules/talents.json` (a bare `{name, action}`) has been **removed**. Confirmed safe — not in
any discipline's talent list, no `.js`/`.html` reference, and the one owning character
(`chakka.json`) holds it as a **knack**, resolved via `knacks.json`. `Anticipate Blow` in
`talents.json` is unaffected (still at :87).

### Phase 2 — Store: pass knack mechanics through + source armed options from knacks

- **`resolveKnack` (`store.js:80`)**: pass through the new catalog fields — `attribute`,
  `versus`, `effects`, `arms`, `combatOptions` — plus resolve the **parent talent's live
  rank** (needed for both the `requiredRank` gate and the arms roll Step). Today it returns
  only `{name, parent, requiredRank, action, brief, detail…}`.
- **Arms surfacing (`store.js:668`) + `talentOptions` builder (`store.js:1372`)**: add a
  **parallel knack pass** that iterates owned, known knacks whose catalog declares
  `combatOptions`/`arms`, gated on **parent-talent rank ≥ `requiredRank`**. Derive the arms
  roll Step from the knack's attribute + the **Anticipate Blow rank** (not a talent rank),
  reusing the existing `talentStep`/`diceForStep` helpers. Merge the result into the same
  `combat.talentOptions` array the Combat tab already renders, with `grantedBy` naming the
  knack. Dedupe alongside talent-sourced options.

### Phase 3 — Cross-surface Spellcasting fold (reach the Spells-tab cast)

**Two dead ends ruled out (verified against code):**

1. _Inject the armed effect into `activeEffects` so `abilityTestMods` picks it up_ — **does
   not work.** `abilityTestMods` (store.js:1446-1454) admits only
   `autoApplies(e) || (blood-charm activated)`, and `autoApplies` (engine/characteristics.js:53-57)
   returns `false` for any `condition !== 'always'`. The payload is `on-success`, so it is
   filtered out. `castingStep` reads `sc.step` (engine/spells.js:502), which only moves via
   `applyTestMods` → `abilityTestMods`, so the cast never sees it.
2. _Add the bonus onto the shared Spellcasting talent `.step`/`.dice`_ — **double-counts.**
   The Combat `_attackPool` (ui/ed-combat.js:645) reads the **same** shared `t.step` **and**
   folds the armed `{test, Spellcasting}` payload via `attackEffects`. With weapon **"None"**
   the Combat picker is unfiltered (`attackTalentNamesFor(null) → null`, ui/ed-combat.js:588),
   so a **Spellcasting Combat pick is reachable** and would count the bonus twice.

**Chosen wiring — fold into the spells slice's armed bonus at the STORE boundary, never the
shared talent step and never inside the engine.**

Purity boundary: `buildSpellsContext(character, spellsFile, derived)` (engine/spells.js:476)
is **session-free/pure** — it has no `session` and must not reach for one (golden rule: the
engine reads no session state). It returns the **base** `castingStep = sc.step` unchanged.
The store already attaches session-derived bits to the slice *after* the pure build
(`spellsCtx.active = session?.activeSpells`, store.js:1487) — that is the seam we use.

So at the store boundary (store.js, right where `spellsCtx.active` is set, ~:1487), derive
from `session.armedTalents` (already in scope, store.js:1584) — for each armed
`{test, Spellcasting}`, `on-success`, `perSuccess`, `measure: step` effect, `value ×
successes` — and attach:

- `castingStep` — the **base** Spellcasting step (from the pure builder, unchanged).
- `spellsCtx.castingArmed = { step, source, successes }` — the session-derived armed bonus,
  itemised so nothing folds invisibly. Absent when nothing is armed.

Then `_rollCast` (ed-spells.js) dispatches `plan.castingStep + (castingArmed?.step ?? 0)` and
renders an `armedchip`. This **mirrors existing code**: the learn-TW teacher bonus is already
added to the dispatched step the same way (`_rollLearn`, ed-spells.js:592-596 — "added to the
STEP the same way the Combat…") and shown via `armedchip` (:720-721). The engine stays pure;
the session read lives only at the store boundary that already owns it.

**Result:** the Combat path is untouched (shared `.step` + armed-effect fold stays
single-count); the Spells-tab cast gets the bonus through the existing dispatched-step path;
no `abilityTestMods` change, no new mods plumbing, no shared-`.step` mutation. The plan's
earlier "extend `_rollCast` to carry step-measure mods" uncertainty is **resolved** — it
follows the learn-TW precedent already in the file.

### Phase 4 — Display generalization (`ui/ed-combat.js`)

The hardcode lives in the **armed badge block** (ui/ed-combat.js:948-965), _not_
`_chipTitle` (:887, already generic). Fix these three:

- `armedPart('defense-modifier', 'Physical')` (:958) — detect the **actual** defence name
  (Physical | Mystic) instead of hardcoding Physical.
- badge `title` `+N Physical Defence` and the `+N Def` label (:965) — name the actual
  defence.
- `armedPart('test-modifier', 'Attack')` (:957) — also read a **Spellcasting** test target
  in the aim summary/hint alongside Attack/Effect.

Render the same-round **exclusivity note** on the armed chip (from the `combatOptions[0].note`
field authored in Phase 1).

### Phase 5 — Tests

Extend `store-combat.test.js` and `engine/combat.test.js`:

- The knack-sourced option appears **only** when Anticipate Blow rank ≥ 5; absent below.
- Armed fold applies **+2/success Mystic Defense** and **+2/success Attack**.
- **Spellcasting fold reaches the cast roll** (the Phase-3 assertion — the key new
  coverage).
- Badge/aim text names **Mystic** and **Spellcasting** correctly.
- Exclusivity note present on the chip.

## 6. Defaults taken unless owner objects

1. **Cast fold measure**: the Spellcasting bonus is a **step** bonus (consistent with
   Anticipate Blow's Attack step), folded into the spells-slice `castingStep` via a new
   `castingArmed` field and added to the dispatched step in `_rollCast` — mirroring the
   existing learn-TW armed-step pattern (Phase 3). No shared talent `.step` mutation.

## 7. Files touched

| File | Phase | Change |
|---|---|---|
| `rules/knacks.json` | 1 | Enrich Anticipate Spell entry (data) + `source` |
| `rules/talents.json` | 1 | **Remove** the duplicate Anticipate Spell stub (dedup) |
| `store.js` | 2, 3 | `resolveKnack` passthrough; knack-sourced arms/options; Spellcasting fold |
| `ui/ed-spells.js` | 3 | `_rollCast` carries the armed Spellcasting mod |
| `ui/ed-combat.js` | 4 | Generalize badge/aim text; chip exclusivity note |
| `store-combat.test.js`, `engine/combat.test.js` | 5 | Coverage |

## 8. Out of scope (v1)

- Enforced mutual exclusion / auto-disarm between Anticipate Blow and its knacks (note only).
- The "first / only one target" qualifier as a hard runtime constraint (display nuance).
- Any taxonomy or schema-shape change.
- The **systemic** talent/knack stub overlap cleanup (see §9) — separate task.

## 9. Finding — systemic knack/talent double-entry (needs its own decision)

`rules/talents.json` carries **~135 stub entries** (`name` + `action` only) whose names also
exist in `rules/knacks.json`. Anticipate Spell is one; this plan removes **only** that one.

The rest are **not** uniformly safe to strip: some overlaps (e.g. Deflect Blow, Streetwise,
Riding) are legitimate discipline talents that *also* exist as knacks under other parents —
those must stay in `talents.json`. A correct cleanup is: **remove a `talents.json` stub only
when the name is (a) present in `knacks.json` AND (b) absent from every discipline's talent
list AND (c) unreferenced by code/characters as a talent.**

Recommendation: handle as a **separate, scripted audit** (classify each of the ~135, remove
only the pure-knack duplicates), not bundled into this feature. Flagged for owner scheduling.

## 10. Design rationale (why these decisions)

Captured so a future reader (or a re-derived AI session) does not silently re-decide these.

### 10.1 Knacks stay in `rules/knacks.json`, not folded into `talents.json`
A knack carries fields a talent never does — `parents` (governing talent/skill),
`requiredRank`, usage gated on the **parent's** rank, and book `source`. Folding these in
would push knack-only optional fields onto every talent entry, weaken the schema, and turn
"list the core talents" into a filter job. The dedicated file already has its own schema tag,
its own resolver (`resolveKnack`), and a CLAUDE.md authority row. "List it talent-style" is a
UI/derivation concern already served by the `parents` link — it does not require co-locating
the data with talents.

### 10.2 Source armed options from owned **knacks**, not by faking a talent
Anticipate Spell is a knack of Anticipate Blow (Companion p.80) and **no discipline grants it
as a talent**. A character owns it as a knack (nested under Anticipate Blow). Authoring it as
a standalone talent would mean it only surfaces if the character owned a talent the rules
never give — so the option would never appear through the natural (knack) ownership. Sourcing
the combat option from owned knacks matches how the character actually holds the ability.

### 10.3 Derive the numeric step from `attribute` + parent rank — never parse `"Rank+PER"`
The `step: "Rank+PER"` string is display/provenance. Parsing it to compute a roll step would
violate the Tier-1 architecture golden rule (the engine reads structured taxonomy, never
regex-parses display strings; ARCHITECTURE.md §5.5, with `spells.js` the grandfathered
exception, not a precedent). Structured `attribute: "Perception"` + the live Anticipate Blow
rank is the machine-readable source, so the numeric step is derived, not scraped.

### 10.4 Spellcasting bonus folds into `castingStep`, not the shared talent `.step`
The Spellcasting talent object is read by **two** surfaces: the spells slice
(`castingStep = sc.step`, engine/spells.js:502) and the Combat `_attackPool`
(`talentStep: t.step`, ui/ed-combat.js:645), which **also** folds the armed payload via
`attackEffects`. With weapon "None" the Combat picker is unfiltered, so a Spellcasting Combat
pick is reachable. Writing the bonus onto the shared `.step` would therefore **double-count**
on that path (inflated step + folded effect). Attaching a separate `castingArmed` bonus to
the spells slice leaves the Combat single-count path untouched.
Injecting into `activeEffects` was also rejected: `abilityTestMods` gates on `autoApplies`,
which returns false for any `condition !== 'always'`, so an `on-success` payload never lands
there. The chosen path mirrors the existing learn-TW armed-step precedent (ed-spells.js:592-596),
so no new mods plumbing is invented.

**Purity:** the session read (`session.armedTalents`) that produces `castingArmed` lives at
the **store boundary** (store.js ~:1487, beside `spellsCtx.active`), **not** inside
`buildSpellsContext`, which stays session-free and returns only the base `castingStep`
(golden rule: the engine reads no session state).

### 10.5 Exclusivity is a passive `note`, not the `excludes` flag
The rulebook's "Anticipate Blow or any associated knacks may not be used for other purposes
this round" is a same-round usage lockout the GM adjudicates, not an arming constraint. The
existing `excludes` flag **auto-clears** the excluded option on select (ui/ed-combat.js:917-922);
wiring it would silently disarm Anticipate Blow — enforcement we deliberately defer (§8). A
passive `note` string surfaces the rule without acting on it, and is additive option-metadata
(same class as `karmaDice`/`appliesTo`), so no taxonomy bump.

### 10.6 Dedup Anticipate Spell now, defer the systemic cleanup
Leaving the `talents.json` stub alongside the enriched knack would be a live double-entry of
the same ability — a maintenance trap (which one wins?). Removing it now is safe and scoped
(§5 Phase 1). The broader ~135-name overlap (§9) is **not** uniformly safe and needs a
classified audit, so it is deliberately out of scope here rather than rushed.
