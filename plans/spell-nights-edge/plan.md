---
status: implemented
shipped: v1.28.0
---
# Delivery Plan: Night's Edge (spell-nights-edge)

## Context & learnings
Night's Edge (Nethermancer, Circle 2) in `rules/spells.json` is a stub: no success level, no extra threads, a truncated summary, and a gmDiscretion note instead of a real effect. Its main effect is a D4 Bonus Die added to a weapon's Damage test, which the taxonomy cannot express (no dice-valued effects, no way to say "a chosen weapon").

Owner decisions (qa-log.md):
- The weapon is picked in the Spells cast flow and stored on the active-spell record (session-only).
- Only equipped/wielded weapons qualify, any type (R3).
- The D4 applies to every Damage test with that weapon while the spell lasts (R2).
- Taxonomy gets a separate optional `object` field, not a new `target.domain`. Dice are `measure: "dice"` with a string value ("D4", "2D6", "D4+D6").
- No equipped weapon at cast (owner, qa-log last entry): the cast modal shows "No equipped weapon" with an explicit action, "Cast on nothing", that wastes the woven threads and the spell like a completed cast, with no cast roll, no active effect and a "wasted" log row. Escape cancels with nothing spent.
- Weapon unequipped mid-spell: the record stays and counts down; the D4 shows only while it is equipped.
- Cast on another target: text under Target effects, no picker.
- Cast on This character, the flow is (owner, qa-log last entry): 1) weave, 2) pressing Cast opens a weapon-selection step (standard modal), 3) an editable target-number field in the same step, prefilled with the chosen weapon's Mystic Defense (R6; the item's `mysticDefense` if present, else 2), 4) confirming rolls the cast with the chosen weapon and the edited number and dispatches `ed-spell-activate` with `object: {name, index}`. The old persistent "vs"-box prefill is removed for this case. Cast on Other keeps today's behaviour.
- Out of scope: Night's Blade knack (-4); using `character`/`item`/`melee-weapon`/`missile-weapon` kinds in data; modelling the target's -2 Mystic Defense (gmDiscretion note); R7 (a willing target may lower its Mystic Defense to 2) is recorded for classification only and is NOT applied, so the prefill never drops to 2 for that reason.

## Discoveries
- Taxonomy doc: `docs/EFFECT-TAXONOMY.md` (header `# Effect Taxonomy — v5`, matched by `tools/rules-conformance.test.js:19`). `measure` table at section 5 (~line 267) already lists `dice` ("explicit dice, +1D6") with no value grammar. Section 10 has the worked examples.
- v5 is hardcoded in: `tools/rules-conformance.test.js:125-129` (asserts v5 literally, so it must change), `tools/worker/worker.js:287`, `tools/dev-server.mjs:70`, plus tests and docs (`tools/worker/worker.test.js`, `tools/dev-server.test.js`, `tools/fold-custom-items.test.js`, `store-custom-items.test.js`, `ARCHITECTURE.md`, `docs/GUARDRAILS.md`, `docs/HOMEBREW-RULES.md`, `docs/THREAD-ITEMS.md`). Rules files carrying `effectTaxonomy`: combat, homebrew, races, talents, disciplines, custom-items, items, thread-items, skills, knacks, spells. `scripts/sync-local-data.sh` also mentions it. Grep for the exact strings during implementation.
- The conformance test validates only `type/operation/measure/stacking/duration/source` and the action-modifier shape. It needs `object` and dice-string checks.
- Active-spell flow: `ui/ed-spells.js` (~line 440) dispatches `ed-spell-activate` with `{name, extraPicks, successLevels}` on a successful self-cast. `ui/ed-app.js:701 _activateSpell` calls `engine/spells.js buildActiveSpell`, which keeps the record in `_activeSpells` (session-only). `activeSpellEffects` tags the effects `origin: {kind:'spell'}` and the store folds them (`store.js:972`).
- `buildActiveSpell` boosts only the first numeric sustained effect. The D4 is a string, so the base effect is not boosted. The extra-thread "+2 Damage Step" must therefore be a standalone sustained option effect (`isStandaloneOptionEffect`, groups by type/target/measure). Arrow of Night's option is `duration:"test"`, so that route is new for a Damage step. The option effect also has to carry the same `object`.
- Combat fold: `engine/combat.js` `foldPool` handles only `measure` `result` and `step`, so a dice value is silently ignored today. `activeSpellBundlesFor(activeEffects, weaponCategory)` pre-screens spell bundles and is called from `ui/ed-combat.js:_activeSpellBundles` using `_selWeapon()?.category`. `damagePool` returns `{step, resultMods}`. `auditPool` itemises the step audit.
- Rolls carry a step plus result mods. The roll modal (`ui/ed-roll-modal.js`) rolls one step row plus a Karma die, and `engine/dice.js` has `rollStep` / `rollKarmaDice` (flattened groups). There is no extra-dice channel, so rolling the D4 needs new plumbing (see I4). The `ed-roll` event and the Roll Log reader are also affected.
- Equipped weapons come from `store.js:1378 equippedWeapons`: `{name, category, damageStep, effects, combatOptions, ...}` with no id. Owned items are identified by `name`. Owner decision (qa-log, last entry): the chosen weapon is stored as `chosen: {name, index}`, `index` being the 0-based occurrence among equipped items of that name. No saved-data change, no ids. Item ids would be a separate Tier-1 feature.
- Target effects: `engine/spells.js otherCastOutcome` builds the text and `ui/ed-spells.js:~491-517` renders it. `effectReadout` classifies the effect (step/static/none). A dice-valued effect must be handled there so the D4 and the penalty note render.
- Weapon Mystic Defense source: owned items carry `mysticDefense` only inside the item's `thread` block (`store.js:872`, so it is `it.thread.mysticDefense`, from the thread-items.json entry; THREAD-ITEMS.md lines ~64 and ~113, called "display-only"). There is no top-level `it.mysticDefense`. `equippedWeapons` (`store.js:1378`) does not currently copy it, so I6 adds it as a data-down field read from `it.thread?.mysticDefense`. THREAD-ITEMS.md needs a small doc update (see I6/I8).
- Existing precedent: `plans/PLAN-ARROW-OF-NIGHT.md` and the `Arrow of Night` entry (`rules/spells.json:1695`) are the model for the sustained attack-modifier plus gmDiscretion note.

## Guardrail classification
- I1: Tier 2 (taxonomy vocabulary). All three steps ship together: doc bump, migration of every `rules/*.json` ref and stamping code, conformance. No owner sign-off is needed for Tier 2.
- I2: Tier 3 data (uses I1 vocabulary).
- I3 to I7 (including I5a/I5b): Tier 3. Engine stays pure and DOM-free, data down / dispatch up, nothing new persisted (store only inputs). The chosen weapon lives in the session-only active record.
- I8: Tier 3.
- No Tier 1 items. `tickets.md` records that no Tier-1 sign-off is needed. The picker must honor UI-GUIDELINES and `docs/MODALS.md` (theme-aware, shared `ui/modal-controller.js` for Escape/Enter/focus if it is a modal).

## Rules dependencies
- R1 (ANSWERED): stat block and effects, used by I2.
- R2 (house ruling, owner 2026-10-04): D4 on every Damage test, used by I2 and I4.
- R3 (house ruling, owner 2026-10-04): equipped/wielded weapons only, any type, used by I3 and I5.
- R4 (ANSWERED): -2 Mystic Defense on any target damaged, until the end of the next round. It is a gmDiscretion note (I2).
- R6 (house ruling, owner 2026-10-04; RULES-FAQ Q021): Night's Edge cast on This character targets the weapon, so the target number is the weapon's Mystic Defense: the item's `mysticDefense` if present, else 2. Prefilled in the cast modal, editable. Used by I6.
- R7 (house ruling, classification only): a willing target may lower Mystic Defense to 2. NOT applied by this feature (non-goal); no item uses it.
- R5 (ANSWERED, inference, moderate confidence; RULES-FAQ Q020): the D4 Bonus Die explodes (max roll earns another die of the same type, repeating) and is a separate die added to the Damage test alongside the step dice and the Karma die. Used by I4 and I5. The owner may confirm; the books do not reconcile the explosion rule with the spell-added Bonus Die.
- No open NEEDS_RULES.

## Implementation items
### I1 — Taxonomy v6: dice values and `object` field
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 2
- **What:** Bump `docs/EFFECT-TAXONOMY.md` to v6. Specify the dice-notation grammar for `measure: "dice"` values. Add the optional `object` field `{kind: weapon|melee-weapon|missile-weapon|character|item, require?: "equipped"}` to section 1, with semantics (selected at activation, session-only, `require` gates when the effect folds). Add a worked example (Night's Edge). Add a changelog line to the doc's version history, if it has one.
- **Where:** `docs/EFFECT-TAXONOMY.md`. Every `rules/*.json` with `effectTaxonomy`. `tools/worker/worker.js:287`, `tools/dev-server.mjs:70`. `tools/rules-conformance.test.js` (including the v5 literal at ~125-129, which becomes a v6 check or a generic one). Version mentions in ARCHITECTURE.md, GUARDRAILS.md, HOMEBREW-RULES.md, THREAD-ITEMS.md and the tests listed in Discoveries. Check whether any `schema` tags embed the taxonomy version (conformance asserts only the shape `ed-name/N`).
- **Approach:**
  - Grammar: `^\d*D(4|6|8|10|12|20)(\+\d*D(4|6|8|10|12|20))*$`, matching `engine/dice.js` sizes. Decide whether a leading count is optional (`D4`, `2D6`).
  - Conformance: `measure:"dice"` requires a string matching the grammar. `object` requires a valid `kind` and `require` of `equipped` or absent. A dice string with any other measure, or a dice measure with a numeric value, fails.
  - Run the conformance test with a deliberately malformed fixture (or unit-test the validator function) to prove rejection.
  - Reader audit: grep every reader of `e.value` / `.measure` / `Number(e.value)` across `store.js` (including `activeSpellEffects` and the fold at ~960-972), `engine/`, `ui/` (Active effects and effect-source displays, pills) and homebrew validation in `tools/`. List each and either guard it for string values or confirm it is measure-gated. Add a test that a `measure:"dice"` string-valued effect never yields NaN or a "NaN" pill/total in the general effect fold, Active effects list and effect-source display.
- **Dependencies:** none
- **Acceptance criteria:** Doc says v6. All `rules/*.json` refs are `(v6)`. Stamping code in the save worker and dev server writes v6. `npm test` passes. A malformed `object` kind or dice string is rejected by the conformance test. The reader audit is recorded and the string-valued-effect no-NaN test passes.
- **Risks / unknowns:** Missing a stamped v5 literal (grep for `v5` and `(v5)` across `tools`, `docs`, `rules`, `*.test.js`). Changing `.md` references to v5 in historical plan docs is not needed.

### I2 — Night's Edge data aligned to the book
- **Covers tickets:** T2
- **Rules:** R1, R2, R3, R4
- **Tier:** 3
- **What:** Edit the `Night’s Edge` entry (`rules/spells.json:1344`; note the curly apostrophe in the key).
  - Keep threads 0, weaving 6/11, Touch, "Rank+5 rounds", casting target "Target's Mystic Defense" (already present).
  - Add `successes` with "Increase Duration (+2 rounds)", copied from Arrow of Night's shape.
  - Add `extraThreads`: "Increase Effect (+2 Damage Step)" (attack-modifier `{attack, Damage}` add 2, measure step, `duration: "sustained"`, with the same `object`), "Increase Range (+10 yards)" (note), "Additional Target (+Rank)" (note).
  - Replace the top-level effects with two. First, a sustained `attack-modifier` `{attack, Damage}`, add, `measure: "dice"`, `value: "D4"`, `source: "spell"`, `object: {kind: "weapon", require: "equipped"}` and a summary. Second, a gmDiscretion note: -2 Mystic Defense on a target damaged by the weapon until the end of the next round.
  - Fix `summary` and keep `description` truthful.
- **Where:** `rules/spells.json`.
- **Approach:** Mirror Arrow of Night's structure. Confirm how the existing "Additional Target" / "Increase Range" notes are written there and copy that.
- **Dependencies:** I1
- **Acceptance criteria:** Entry matches R1/R4. Conformance passes. Existing spells tests still pass. Target effects text for another-target casts shows the D4 and the penalty (verified in I6).
- **Risks / unknowns:**
  - The base effect must not be `gmDiscretion` or `sustainedEffectsOf` drops it. The note effect must be `gmDiscretion` so it never folds onto the caster.
  - Does `spells-options.test.js` or another test assert counts of options on Night's Edge?

### I3 — Engine (spells): active record stores chosen weapon; extra thread folds as a step
- **Covers tickets:** T3 (record and boost half)
- **Rules:** R2, R3 (weapon is identified by `{name, index}`, not id; T3's wording "weapon id" is superseded by this because owned items have no ids)
- **Tier:** 3
- **What:** In `engine/spells.js`:
  - Add a pure helper `spellObjectRequirement(spell)` that returns the `object` of the sustained effects, or null. It tells the UI whether a picker is needed.
  - Extend `buildActiveSpell(spell, rank, ctx)` to accept `ctx.object` (the chosen weapon `{name, index}`). The record stores it as `chosen: {name, index}` (single concrete shape; no `object` on the record). Standalone option effects (the +2 step) keep their data-level `object` so they fold onto the same weapon.
  - `activeSpellEffects` copies, for each effect that has a data-level `object`, exactly: `object` (unchanged `{kind, require}`) and a stamped `chosen: {name, index}` taken from the record. Effects without `object` get no `chosen`. The Combat tab matches on these two fields.
  - Decision on `scope`: for effects with an `object`, `object.kind` replaces `scope` for matching (Night's Edge effects carry no `scope`). Effects without `object` keep the existing `scope`/category filtering in `activeSpellBundlesFor`, so Arrow of Night is unchanged. Document this precedence in I1's doc text and in the I4 tests.
  - Keep the countdown (`tickActiveSpells`) untouched.
- **Where:** `engine/spells.js`, `engine/spells.test.js`.
- **Approach:** Effects keep their data-level `object` field (kind, require). The record and each object-bearing effect carry `chosen: {name, index}` (see What), and the combat fold matches `chosen.name` and `chosen.index` against the selected weapon's name and its occurrence index among equipped items of that name. A pure helper `weaponOccurrence(equippedWeapons, weapon)` (engine, shared by the picker and the fold) returns that index. `isStandaloneOptionEffect` already treats the step option as standalone because the base value is a string, not numeric.
  - Label rule (fixes the `stat` pitfall): `buildActiveSpell` currently picks `stat = effects.find(typeof value === 'number')`, which with the +2 step pick would select the step and hide the D4. New rule: when the record has a `measure: 'dice'` effect, `effectLabel` is built from it ("+D4 Damage"), with any standalone step option appended ("+D4 Damage, +2 Damage Step"). Only when there is no dice effect does the existing numeric `stat` logic apply. Without any pick the label is "+D4 Damage" (not the `summary` fallback).
- **Dependencies:** I1, I2
- **Acceptance criteria:** Unit tests:
  - `buildActiveSpell(Night's Edge, rank, {object})` yields a record with the chosen weapon and a dice attack-modifier effect.
  - The +2 Damage Step pick produces a standalone step effect with the same `object`.
  - Rounds countdown is unchanged (Rank+5, +2 per extra success or pick).
  - No `object` in ctx leaves other spells unchanged (regression on Arrow of Night).
  - `activeSpellEffects` stamps `chosen: {name, index}` on object-bearing effects only, and copies `object` unchanged.
  - `weaponOccurrence` gives 0-based indices per name (e.g. [Spear, Sword, Spear] gives 0, 0, 1).
  - `effectLabel` is "+D4 Damage" without the pick and "+D4 Damage, +2 Damage Step" with it; a numeric-only spell's label is unchanged.
- **Risks / unknowns:** Re-casting refreshes by name (`ed-app.js:709`), which replaces the previous weapon. This is acceptable and should be stated in the tests.

### I4 — Engine (combat): fold the D4 into the chosen weapon's Damage pool
- **Covers tickets:** T3 (fold half), T5 (pool half)
- **Rules:** R2, R3, R5
- **Tier:** 3
- **What:** In `engine/combat.js`:
  - `foldPool`: handle `measure: 'dice'`, collecting `bonusDice` (parsed dice strings, labelled like the step mods) and returning them, with no effect on `step`.
  - `damagePool` returns `bonusDice` alongside `step` and `resultMods`.
  - `auditPool` itemises dice parts (new `kind: 'dice'`).
  - `activeSpellBundlesFor(activeEffects, weaponCategory, weapon)`: when an effect has an `object`, admit it only if `object.kind` matches the weapon (`weapon` = any, `melee-weapon`/`missile-weapon` by category) AND the record's `chosen.name` equals the selected weapon's name AND `chosen.index` equals the weapon's occurrence index among the equipped list (via `weaponOccurrence`). `require: 'equipped'` is satisfied because the view supplies only `equippedWeapons`. An unequipped weapon is never a selectable pick, so the D4 is absent and returns on re-equip.
  - Add a pure dice-string parser (`parseDice`) in `engine/dice.js` (or `engine/combat.js`), shared with I1's grammar where practical. Add a `rollDiceList` roller in `engine/dice.js` for a bonus-dice list. Per R5, each Bonus Die explodes (a max roll earns another die of the same type, repeating) using the same exploding mechanism as `rollDie`, and is rolled and totalled as a separate group from the step dice and the Karma die.
- **Where:** `engine/combat.js`, `engine/dice.js`, `engine/combat.test.js`, `engine/dice.test.js`.
- **Approach:** The active effects reach the view through `model.activeEffects`. The chosen name must survive `activeSpellEffects` tagging (I3). The view passes the selected weapon, so the engine stays pure.
- **Dependencies:** I3
- **Acceptance criteria:** Unit tests:
  - D4 present for the chosen equipped weapon only, absent for others.
  - Duplicate-name case: with two equipped "Spear" and chosen `{name:'Spear', index:1}`, the D4 is on the second Spear only, not the first. If the first Spear is unequipped, the remaining Spear becomes index 0 and no longer matches (D4 absent until the original arrangement returns); document this consequence.
  - Absent when the chosen weapon is not in the equipped list, present again when it is.
  - The +2 Damage Step folds as a step on the same weapon only.
  - Attack pool is unaffected.
  - Arrow of Night behaviour is unchanged.
  - Dice parser handles "D4", "2D6", "D4+D6" and rejects junk.
  - `rollDiceList` (seeded/injected RNG): a D4 rolling 4 explodes and adds another D4, repeating; a non-max roll does not explode; the result is a separate group whose total is not merged into the step dice.
  - Matching uses `object.kind` (not `scope`) when `object` is present, and `scope` unchanged otherwise.
- **Risks / unknowns:** The index is positional among equipped same-name items, so equipping or unequipping a same-name duplicate can shift which weapon matches. Accepted by the owner (no ids; ids would be a separate Tier-1 feature).

### I5 — Roll path: roll and log the bonus die (split into I5a data/log shape, I5b modal rendering)
- **Covers tickets:** T5
- **Rules:** R2, R5
- **Tier:** 3
- **What:**
  - **I5a — pure data and log shape (with tests).** Define the bonus-dice result shape (a separate group, e.g. `bonusResult: {dice:[...], total}`, each die exploded per R5). `ui/ed-combat.js _rollDamage` passes `dp.bonusDice` through `_roll` options; `ed-app` rolls them with `rollDiceList` and adds the total to `_grandTotal` via a pure helper. `store-rolllog.js` and the Roll Log reader (`karmaResult.step/dice/total` precedent) record and read the extra group, tolerating its absence in old entries. `ui/combat-log-rows.js` formats it. All of this is unit-tested without the DOM.
  - **I5b — modal rendering.** `ui/ed-roll-modal.js` shows the bonus dice as their own group in the die chain, handles Karma flow and re-roll with the group present, and renders the total.
- **Where:** I5a: `ed-combat.js`, `ed-app.js` (roll handling), `store-rolllog.js`, `ui/combat-log-rows.js` and their tests. I5b: `ui/ed-roll-modal.js`.
- **Approach:** Follow the Karma-dice precedent (`rollKarmaDice` result flattened into the same shape). Keep it display-additive. Do not change behaviour for rolls with no bonus dice. Do I5a first and commit it separately from I5b.
- **Dependencies:** I4 (I5b depends on I5a)
- **Acceptance criteria:** I5a: unit tests show a Damage roll with bonus dice produces the group, the grand total includes it, the log entry round-trips, and old entries without the group still read. I5b: the modal shows the group and total (manual owner verification, see below). Other rolls are byte-identical to before.
- **Risks / unknowns:** Still the largest unknown. The roll modal's Karma flow, re-roll handling and the Roll Log reader must tolerate the new group. Read `ed-roll-modal.js` and `store-rolllog.js` carefully before implementing. If the plumbing proves invasive, flag it to the owner rather than silently reshaping the modal.

### I6 — Spells cast flow: weapon + target-number modal, no-weapon state, Target effects text
- **Covers tickets:** T4
- **Rules:** R3, R6
- **Tier:** 3
- **What:**
  - **Flow (This character, spell has an `object` effect, i.e. `spellObjectRequirement(spell)` non-null):** 1) weave as today; 2) pressing Cast does not roll but opens a weapon-selection modal listing the equipped/wielded weapons (`model.combat.equippedWeapons`, any category); 3) the same modal holds an editable target-number field prefilled with the chosen weapon's Mystic Defense; 4) confirming rolls the cast with the chosen weapon and the edited number, then on success dispatches `ed-spell-activate` with `object: {name, index}`. Duplicates are labelled "Spear", "Spear (2nd)", "Spear (3rd)" only when two or more equipped weapons share a name.
  - **Modal pattern:** `ui/modal-controller.js` per `docs/MODALS.md`. Escape (and backdrop/close) cancels: no roll, no state change beyond closing, focus returns to the Cast button. Enter confirms: the primary control (Confirm/Cast) gets initial focus, and Enter inside the number field also confirms. Tab is trapped. Theme tokens and `--fs-*` type tokens only.
  - **No equipped weapon (owner, qa-log last entry):** pressing Cast still opens the same standard modal. With no equipped weapon matching `object.kind` it shows "No equipped weapon" in place of the weapon list and number field, with an explicit primary action "Cast on nothing" (and a Close button). "Cast on nothing" spends the woven threads and the spell exactly as an ordinary completed cast does, with no cast roll, no target number, no `ed-spell-activate` (so no active effect), and a Roll Log row saying the spell was wasted. Escape, backdrop and Close cancel with nothing spent (threads stay woven, spell not cast), focus returns to Cast. Enter activates the primary action ("Cast on nothing"), consistent with the modal contract. The weave rolls are earlier steps and are not undone by cancel.
  - **Existing consumption path to reuse (checked in code):** thread and spell consumption on this tab is purely view-local, not in the store. Woven threads live in `_prog` (`_blankProg()`, `ui/ed-spells.js:250`); a matrix holds no threads (`ed-spells.js` castType hint, ~1134), so nothing is stored per matrix. After an ordinary cast whose effect is not a step, `_onRoll` (`ed-spells.js:453-461`) resets `_prog` to `{...this._blankProg(), cast, effect}` and un-greys Weave and Cast for the next cast; a step effect resets at 467 after the Effect roll. "Cast on nothing" reuses exactly that reset: a new view method `_castOnNothing(plan)` sets `this._prog = {...this._blankProg(), cast: {total: null, levels: 0, outcome: {word: 'Wasted', ok: false}}, effect: {total: null, outcome: {word: 'Wasted', ok: false}}}` (marker shape defined here; during the build verify `_rollRes`, the success banner, `ed-spells.js:455` and the persisted-state snapshot `~320-355` tolerate a null `total`), mirroring lines 455-460, and bumps `_castSeq` like `_rollCast` (`:1087`). It does not call `_rollCast`, `_dispatchRoll` or dispatch `ed-spell-activate`. Night's Edge has no step effect (its only effects are a dice attack modifier and a gmDiscretion note), so the 453-461 branch is the right mirror.
  - **Wasted log row (dispatch up):** the Roll Log is written only by the `ed-roll-logged` handler in `ui/ed-app.js:277-305`, which needs a roll. So `ed-spells` dispatches a new event `ed-spell-wasted` with `{ name }`; `ed-app` handles it by calling the existing `saveRollLog` (`store-rolllog.js:50`) with an entry built by a pure helper `wastedCastLogEntry({spellName, rollId, at})` in `engine/spells.js` (label "Cast — <spell> (wasted: no equipped weapon)", `total: null`, `step: null`, `dice: []`, `outcome: {word: 'Wasted', ok: false}`, unique `rollId`). The view then calls `_loadRolls()` (as `_onRollLogged` does, `:275`). No new storage; same device-local log.
  - **Log reader tolerance:** `ui/combat-log-rows.js` already renders null step/total as a dash, so it needs no formatter change; add a `combat-log-rows` test for a wasted entry. The Spells Log view and Notes Roll Log need a change only if they do arithmetic on `total` or `dice`; record in the build which readers were checked. The `ed-roll-logged` total math (`ed-app.js:~290`) is not involved and stays so. Find every reader of Roll Log entries (`_loadRolls` consumers in `ui/ed-spells.js` Log view, the Notes tab Roll Log, `ui/combat-log-rows.js`) and make them render an entry with `step`/`dice`/`total` null as label plus outcome word, with no NaN or crash. Unit-tested where the formatter is pure.
  - **Target number (R6):** the modal's field defaults to `weaponMysticDefense(chosenWeapon)`: the weapon's `mysticDefense` when a number, else 2; null (empty field) when no weapon is chosen. Any default can be changed by the user. Touched-state rule: the view keeps a local `numberTouched` flag, set when the user edits the field. Changing the weapon re-prefills only while `numberTouched` is false; once the user has typed, a later weapon change keeps their value. A pure helper `nextCastNumber({current, touched, weapon})` in `engine/spells.js` implements this so it is unit-testable. Initial weapon selection: the first choice is preselected (so the field is prefilled on open). The number must be a valid positive integer to confirm; invalid or empty disables Confirm.
  - **Hand-off to the roll modal (F2):** Confirm closes the cast modal WITHOUT restoring focus to Cast (the roll modal opens via `_dispatchRoll` and follows its own MODALS.md contract, including focus return on its close). The roll modal's Karma re-roll uses the `_castPicks` snapshot only and never reopens the cast modal. Cancel paths (Escape, backdrop, Close) still restore focus to Cast.
  - **Anticipate Spell with "Cast on nothing" (F3):** an armed Spellcasting bonus (`ctx.castingArmed`) is applied only inside the cast roll. Armed talents are never consumed by use; they only tick down per Initiative (`tickArmedTalents`, `ed-app.js:678`). "Cast on nothing" makes no Spellcasting roll, so the armed bonus is left armed and untouched, consistent with that behaviour.
  - **Existing "vs" box on This character:** for a spell with an `object` effect the persistent "vs" box (`ui/ed-spells.js:~1209-1212`, `~991-994`) is not used. Treatment: hidden; the TMD label is replaced by a short static hint ("Target number set when you cast") so the row is not empty, and the roll summary line (`~1236`) reads the number from the modal's confirmed value. The modal owns the number. Spells without an `object` effect, and all Cast on Other casts, keep the "vs" box exactly as today.
  - `store.js equippedWeapons` adds `mysticDefense: it.thread?.mysticDefense ?? null` (the value lives in the item's `thread` block, not top level) so it reaches the view (data down). A store-level test is required: a built model with an equipped thread weapon carrying `mysticDefense: 10` yields `equippedWeapons[i].mysticDefense === 10`, and a plain weapon yields null. The `weaponMysticDefense` unit tests alone do not prove R6.
  - Gating helper: a pure `castWeaponChoices(ctx)` returns `{choices: [{name, index, label}], empty, reason}`, `empty: true` and `reason: 'No equipped weapon'` when the spell needs an `object` and `equippedWeapons` is empty or none matches `object.kind`. The view consults it on Cast press to decide which modal body to show (weapon list plus number, or the "No equipped weapon" body with "Cast on nothing"). Nothing blocks; the Cast button is never disabled for this reason.
  - Casting on another target shows no modal and no picker; `otherCastOutcome` / `effectReadout` render the D4 and the -2 Mystic Defense note under Target effects.
  - `ed-app._activateSpell` forwards `object` to `buildActiveSpell`. The Active effects list names the chosen weapon (e.g. "Night's Edge — Broadsword").
  - Doc update: `docs/THREAD-ITEMS.md` marks `mysticDefense` display-only (field table ~line 64, `thread` block note ~line 113). Reword: display-only except that it is also read as the cast modal's default target number for an object-bearing spell (R6). Part of I8's doc sweep.
- **Where:** `ui/ed-spells.js` (modal, `_castOnNothing`), `ui/ed-app.js` (`_activateSpell`, new `ed-spell-wasted` handler), `store.js equippedWeapons`, `engine/spells.js` (`castWeaponChoices`, `weaponMysticDefense`, `nextCastNumber`, `wastedCastLogEntry`, `effectReadout`, `otherCastOutcome`), `engine/spells.test.js`, plus the Roll Log readers named above.
- **Approach:**
  - Dispatch up only. The modal's pick, number and touched flag are transient local UI state in the view (like `_prog.pendingPick`), not persisted. On confirm, snapshot weapon and number with `_castPicks` so a Karma re-roll of the cast keeps them without reopening the modal.
  - Reuse the `_castSelf` path (`ui/ed-spells.js:~1084`): Cast press for an object-bearing spell opens the modal instead of rolling; Confirm calls the existing roll code with the chosen number as the target. Make small changes; extract logic to the engine.
  - Verify `effectReadout` for a spell whose only numeric effect is dice: it should yield "No Effect roll" plus appended effect text, and no Effect-roll button for Night's Edge.
- **Dependencies:** I2, I3
- **Acceptance criteria:**
  - Self-cast: Cast opens the modal with the weapon list and a prefilled number field; Confirm rolls and the active record carries `{name, index}` (duplicate-name case picks the right occurrence).
  - Escape cancels with no roll and no active effect; Enter confirms; focus returns to Cast.
  - No equipped weapon: Cast opens the modal showing "No equipped weapon" and "Cast on nothing". Choosing it clears the woven threads and spell state exactly as a completed non-step cast does (`_prog` blank, Weave and Cast un-greyed), rolls nothing, dispatches no `ed-spell-activate` (no active effect), and adds one Roll Log row marked wasted. Escape, backdrop and Close cancel with threads still woven and nothing logged.
  - The edited number, not the default, is the target of the roll; after a manual edit, changing weapon keeps the edit; with an untouched number, changing weapon re-prefills.
  - The "vs" box is absent for object-bearing self-casts and unchanged for other spells and for Cast on Other.
  - Other-target cast shows no modal, and Target effects text includes the D4 and the penalty.
  - Active effects row names the weapon.
  - Unit tests: `castWeaponChoices` (duplicate labels "Spear"/"Spear (2nd)" with indices 0/1, plain when unique); `castWeaponChoices` empty case (empty list or no kind match gives `empty: true` with the reason; a spell with no `object` is never empty); `wastedCastLogEntry` (null step/dice/total, outcome word 'Wasted', label names the spell and the reason, distinct rollIds give distinct entries, `saveRollLog` round-trips it); Roll Log formatter tolerates a null-step wasted entry (no NaN); `weaponMysticDefense` (thread weapon with 10 returns 10; ordinary weapon returns 2; no weapon returns null); `nextCastNumber` (untouched + weapon change re-prefills; touched + weapon change keeps the current value; no weapon and untouched gives null).
  - Existing spells tests green.
- **Risks / unknowns:** The cast flow is a long state machine (`_prog`, `_castSelf`, `_castOnOther`). Opening a modal between Cast press and the roll must not break Karma re-roll or the weave state; "Cast on nothing" must reset exactly the state an ordinary non-step cast resets, no more (`_castSeq` bump, `_prog` blank, Karma-reroll snapshot `_castPicks` left unused), and must never leave `_pendingStep` set. The armed Anticipate Spell bonus stays armed through a wasted cast (no roll happened). The `_rollRes`/banner/snapshot tolerance of the null-`total` wasted marker must be verified. The wasted log row needs a roll-less entry; confirm the Roll Log readers tolerate it. No clean-path blocker found, so no NEEDS_HUMAN.

### I7 — Combat tab: display the D4 in the Damage pool
- **Covers tickets:** T5
- **Rules:** R2
- **Tier:** 3
- **What:** `ui/ed-combat.js` `_activeSpellBundles` passes the selected weapon (name and category) to `activeSpellBundlesFor`. The Damage pool display shows the D4 pill next to the step (e.g. "Step 9 + D4"), the step-audit modal lists "Night's Edge: +D4", and roll-log rows record it (`ui/combat-log-rows.js`). Use the same labelling as Arrow of Night's bonus (the spell name).
- **Where:** `ui/ed-combat.js`, `ui/combat-log-rows.js`, `ui/combat-log-rows.test.js`, `ui/combat-mods-state.js` if relevant.
- **Approach:** Presentational only. All values come from the engine (I4). Use `--fs-*` type tokens and existing theme tokens (no raw rem or colours).
- **Dependencies:** I4, I5a
- **Acceptance criteria:** Selecting the chosen weapon shows the added die and audit label. Other weapons do not. Un-equipping the chosen weapon removes it from the pool, and re-equipping restores it. Log rows record the die.
- **Risks / unknowns:** The user verifies UI themselves, so no preview is needed for sign-off. Include unit coverage for log-row formatting.

### I8 — Docs, changelog, tests
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3
- **What:** Update `docs/THREAD-ITEMS.md` so `mysticDefense` is no longer purely display-only (also read as the cast modal's default target number, R6). Update `ARCHITECTURE.md` (spell cast flow, taxonomy version, roll bonus dice), `docs/UI-GUIDELINES.md` and `docs/MODALS.md` (list the new cast modal) if it adds a pattern, and the `docs/HOMEBREW-RULES.md` / `docs/THREAD-ITEMS.md` references to the taxonomy version. Add the `data/changelog.json` entry (check the format used by `ui/ed-changelog.js` and the release tool). Make sure each item's tests are in place and run `npm test`.
- **Where:** docs above, `data/changelog.json`, tests.
- **Approach:** Do this last so docs describe shipped behaviour. Leave `docs/RULES-FAQ.md` alone unless a rules entry changes.
- **Dependencies:** I1 to I7
- **Acceptance criteria:** Docs match shipped behaviour. `npm test` is green.
- **Risks / unknowns:** None beyond the version-string sweep.

## Owner manual verification (UI-only checks)
The owner verifies these by hand; unit tests cover the pure logic only:
- The cast modal on a self-cast: weave, press Cast, weapon list appears; Escape cancels with no roll; Enter confirms; with no equipped weapon the modal shows "No equipped weapon" and "Cast on nothing"; choosing it clears the woven threads and spell state (Weave and Cast un-greyed), rolls nothing, creates no active effect and logs a wasted row; Escape in that state cancels with threads still woven; focus returns to Cast.
- Hand-off: Confirm on the cast modal opens the roll modal with focus handled by the roll modal; a Karma re-roll does not reopen the cast modal. Cast on nothing: the Cast row renders "Wasted" with no NaN or crash, the success banner is sane, and a reload/persisted state is fine. An armed Anticipate Spell bonus remains armed after a wasted cast.
- The Active effects row naming the chosen weapon and its label ("+D4 Damage").
- The Combat tab Damage pool pill ("Step N + D4") and the step-audit modal line, present for the chosen weapon only, gone on unequip and back on re-equip.
- The roll modal bonus-die group (explosion shown, included in the total, Karma and re-roll still correct).
- The Roll Log row recording the bonus die, the wasted-cast row (renders as label plus "Wasted", no numbers), and old entries still rendering.
- The modal's target number: prefilled with the weapon's Mystic Defense (thread item value or 2), editable; changing weapon re-prefills only while untouched, and a manual edit survives a weapon change; the roll uses the edited number. The "vs" box is gone for this spell on This character; Cast on Other and other spells unchanged.
- Target effects text for an other-target cast (D4 and the -2 Mystic Defense note).

## Sequencing
1. I1: vocabulary first; everything else validates against it, and Tier 2 must land whole.
2. I2: data using the new vocabulary, gated by conformance.
3. I3: record shape in the spells engine.
4. I4: combat fold and dice parser/roller, which depend on the record shape.
5. I5a then I5b: roll plumbing (pure data/log shape first, modal second), which depends on the pool returning bonus dice. It is the riskiest item, so surface it early in the build.
6. I6: cast-flow UI and Target effects (needs I2 and I3; can proceed in parallel with I4/I5).
7. I7: Combat display (needs I4 and I5a).
8. I8: docs, changelog, final test pass.

## Open questions
- Dice grammar details (optional leading count, `+` joins only) are settled in I1 within the owner-approved examples ("D4", "2D6", "D4+D6").
- Resolved (owner, qa-log last entry): the chosen weapon is `chosen: {name, index}` (0-based occurrence among equipped items of that name); no saved-data change, no ids; the picker labels duplicates "Spear (2nd)" only when duplicates exist. Note: item ids would be a separate Tier-1 feature.
- The Roll Log and roll-modal approach for bonus dice (I5) may need a design decision once the code is read in detail. If the existing `mods` or Karma-group mechanisms do not fit, raise it as NEEDS_HUMAN at build time.

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- F1 (blocker, bonus-die explosion has no rules entry): fixed. `rules.md` R5 (RULES-FAQ Q020) now covers it; cited in Rules dependencies, I4, I5. I4 `rollDiceList` is specified from R5 and tested (explodes on max, separate group). Residual note: R5 is an inference at moderate confidence; the owner may confirm.
- F2 (record shape inconsistent): fixed. One shape: data-level `object {kind, require}` on effects; record and object-bearing effects carry `chosen: {name, index}` (updated per owner decision) stamped by `activeSpellEffects`. `object.kind` replaces `scope` for matching when present; `scope` unchanged otherwise. "Weapon id" in T3 is replaced by `{name, index}` (noted in I3).
- F3 (`stat`/`effectLabel` wrong with +2 step pick): fixed. Label is built from the dice effect when present, step option appended; tests for with and without the pick (I3).
- F4 (other consumers of numeric `value`): fixed. Reader audit and string-value no-NaN test added to I1.
- F5 (self-cast target and no-weapon blocking): fixed. I6 states the `_castSelf` path, the TMD handling, the pure `castWeaponChoices` gate and the empty-choices test.
- F6 (I5 scope, manual verification): fixed. I5 split into I5a (pure shape, log, tests) and I5b (modal); an "Owner manual verification" list added.
- Round 4 (owner-directed revision, no new review): the no-equipped-weapon case is now an escape, not a block. The cast modal shows "No equipped weapon" with "Cast on nothing", which consumes threads and spell by reusing the existing post-cast `_prog` reset (`ed-spells.js:453-461`, `_blankProg`), makes no roll and no active effect, and records a wasted Roll Log row through a new `ed-spell-wasted` event handled in `ed-app` with the existing `saveRollLog`. Escape cancels with nothing spent. The "blocked before any roll, build-time choice" wording is removed. `castWeaponChoices` returns `empty` instead of `blocked`. I6, acceptance, unit tests and manual verification updated.
- Round 3 (owner-directed revision, no new review): the self-cast flow for an `object` spell is now weave, Cast opens a standard modal (weapon list plus editable target number prefilled from `weaponMysticDefense`), Confirm rolls with the chosen weapon and edited number and dispatches `ed-spell-activate` with `{name, index}`; Escape cancels with no roll, Enter confirms. The persistent "vs"-box prefill is removed for this case (box hidden, modal owns the number). A manual edit survives a later weapon change (`nextCastNumber`, `numberTouched`). Cast on Other unchanged. I6, tests and manual verification updated.
- Round 2 (owner-directed revision, no new review): the old I6 "existing TMD handling / confirm at build time" item is replaced by the R6 prefill (weapon's `mysticDefense` else 2, editable, follows the weapon choice, self-cast only), with `weaponMysticDefense` tests. R7 is a non-goal, not applied.

## Review 2 responses
- F1 (major, `equippedWeapons` copies a non-existent field): fixed. I6 now copies `it.thread?.mysticDefense ?? null`; Discoveries corrected; a store-level test (thread weapon with 10 yields 10, plain weapon yields null) is required in I6.
- F2 (minor, cast-to-roll modal hand-off): fixed. I6 states Confirm closes the cast modal without focus return to Cast, and Karma re-roll uses the `_castPicks` snapshot only; added to manual verification.
- F3 (minor, armed Anticipate Spell on "Cast on nothing"): fixed with a default derived from the code. Armed talents are not consumed by use, only counted down per Initiative, and "Cast on nothing" makes no roll, so the bonus stays armed. Recorded in I6 and its Risks. No NEEDS_HUMAN; the owner can override.
- F4 (minor, undefined `cast` marker): fixed. Shape `{total: null, levels: 0, outcome: {word: 'Wasted', ok: false}}` defined in I6; build must verify `_rollRes`, banner, `ed-spells.js:455` and the persisted snapshot tolerate null `total`; added to manual verification.
- F5 (minor, reader tolerance): fixed. I6 notes `combat-log-rows` already dashes null values, requires a `combat-log-rows` wasted-entry test, limits Spells/Notes reader changes to arithmetic on `total`/`dice`, and asks the build to record which readers were checked.
