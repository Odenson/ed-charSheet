---
status: implemented
shipped: v1.30.0
---
# Delivery Plan: Custom item builder: unarmed weapons (custom-item-builder)

## Context & learnings
The owner wants to build an equippable unarmed weapon (a +1 Gauntlet) in the custom-item builder UI and have it work in Combat. Decisions from qa-log.md:
- Scope is the full set: `unarmed` category, Damage Step field as the single source for weapon damage, hide range for unarmed, seed old weapons on open, store 0, tests/docs/changelog.
- The Damage Step field is the single input. The builder generates the matching `attack-modifier` effect; it is shown read-only ("from Damage Step"). A hand-added duplicate `attack/Damage add step` effect blocks save.
- On open, an existing weapon with an empty field but an `attack/Damage add step` effect seeds the field from it. On save the field is authoritative.
- Range fields are hidden for `unarmed`, and any stored range is cleared when the category becomes `unarmed`.
- R3 (owner house rule): an unarmed weapon's Damage Step is additive to Strength, like other weapons. R4 (owner): Damage Step 0 is valid and stored.
- No seed data, no engine/schema/taxonomy changes. The owner builds the Gauntlet in the UI.

## Discoveries
- `ui/ed-custom-item.js:38` — weapon `category` options `['melee','missile','throwing']`; `REF_FIELDS.weapon` (l.36-46) holds `damageStep`, `shortRange`, `longRange`. Number fields are written via `_setRef` (l.454; empty -> `undefined`).
- `ui/ed-custom-item.js:59` — `QUICK_TEMPLATES.weapon` holds the "＋ Damage Step" template to remove. `_formView` (l.408) renders the quick-template strip only when `templates.length`, so an empty array hides it cleanly. `ammunition: []` is already the precedent.
- `ui/ed-custom-item.js:194` `_editItem` deep-copies the stored item into `_form`; this is the seed-on-open hook. `_formErrors`/`_cleanForm` (l.218-228) call `cleanItemForm` on every render, so validation errors added in `cleanItemForm` show inline and disable Save.
- `ui/ed-custom-item.js:434` — kind change resets `ref: {}`; a kind switch away from weapon must not leave a generated effect.
- `ui/custom-item-builder.js` `cleanItemForm` (l.95-113) drops `0` for every non-cost ref key (`v !== 0`, l.104), which is the Damage Step 0 bug. `cleanEffects` never drops effects. `summaryFor` already yields "Adds +N Damage step" for the generated effect (test at `custom-item-builder.test.js:27`).
- `store.js:1395` reads `it.ref?.damageStep` for plain weapons; `engine/combat.js:58-65` already has the `unarmed` category and talent map, and the Unarmed pseudo-weapon uses `damageStep: 0`. `ui/ed-combat.js:1446` renders `dmg ${damageStep}` for any non-null step, so 0 shows "dmg 0" with no Combat change.
- `engine/validate-item.js` does not enumerate weapon categories (l.173 is only a string-field check), so `unarmed` passes `validateItem` without engine edits. The shared gate stays untouched.
- Tests: `/Users/garyfebbrarino/Work/workspace/EDCharSheet/custom-item-builder.test.js` (root-level) and `ui/custom-item-state.test.js`. Test at l.75-78 pins "cost 0 kept, empties dropped".
- Docs listing categories or the Damage template: `plans/PLAN-CUSTOM-ITEMS.md` l.291, 306, 433-436 (and the §6.2 note); `docs/THREAD-ITEMS.md:177` already lists `unarmed` (no change needed); `docs/UI-GUIDELINES.md` had no hit for weapon categories (re-check at build).
- `data/changelog.json` `unreleased.changes` is empty; entries are `{type, text}` objects.
- Design choice (planner): the generated effect is never held in the form's `item.effects`. It is derived from `ref.damageStep`, rendered as a separate read-only row, and appended by `cleanItemForm`. After this, any `attack/Damage add step` effect still in the form's `effects` is by definition hand-added, which makes the duplicate guard unambiguous and avoids marker fields in stored data (schema-neutral).

## Guardrail classification
All items Tier 3 (builder UI behaviour, an existing field, an existing category tag, a bug fix). No schema shape, taxonomy vocabulary or version tag, engine, or `rules/*.json` change. The builder keeps the dispatch-up pattern; it writes only item input (the generated effect is a deterministic restatement of the input, validated by the shared gate). No Tier-1 sign-off needed. The Tier-1 UI rules to re-check at the end: theme-aware styling via existing tokens (no hardcoded colours), Escape/Enter on the modal unchanged, no fabricated derived numbers.

## Rules dependencies
- R1 (FAQ-HIT, Q025): unarmed damage = Strength step, weapons add Damage Step to Strength. Used by I2 and the roll acceptance criterion.
- R2 (FAQ-HIT, Q025): unarmed is close combat with no range increments. Used by I4.
- R3 (NOT-COVERED, owner house decision 2026-10-05): additive Strength step + Damage Step for unarmed weapons. Used by I1/I2; builder help text states it.
- R4 (NOT-COVERED, owner house decision 2026-10-05): Damage Step 0 valid and stored. Used by I3.
No open NEEDS_RULES.

## Implementation items
### I1 — Add `unarmed` category and help text
- **Covers tickets:** T1
- **Rules:** R1, R3
- **Tier:** 3
- **What:** offer `unarmed` in the weapon Category dropdown; add short help text near the Damage Step field saying the Damage Step is added to Strength step (also true of unarmed weapons).
- **Where:** `ui/ed-custom-item.js` (REF_FIELDS.weapon options l.38; a `.hint` span in the ref grid, using the existing `.fld .hint` style).
- **Approach:** append `'unarmed'` to the options list (order melee, missile, throwing, unarmed). Add a `hint` property on the `damageStep` field def and render it under the input for number fields. No engine or validator change.
- **Dependencies:** none.
- **Acceptance criteria:** dropdown offers the four categories; an item with `category: 'unarmed'` passes `validateItem`; once equipped it appears in the Combat Weapon picker after None and Unarmed, filters talents to Unarmed Combat and rolls Strength step + Damage Step (verified manually / via existing store-combat tests; add a store-level test only if none already covers a plain unarmed-category weapon).
- **Risks / unknowns:** confirm during build that `ed-combat.js` `_weapons()` ordering puts it after None/Unarmed with no change (expected, since the engine already supports `unarmed`).

### I2 — Damage Step field as single input with generated read-only effect
- **Covers tickets:** T2
- **Rules:** R1, R3
- **Tier:** 3
- **What:** for kind `weapon`, `cleanItemForm` appends a generated effect `{type:'attack-modifier', target:{domain:'attack',name:'Damage'}, operation:'add', value:<damageStep>, measure:'step', condition:'always', source:'item', summary}` derived from `ref.damageStep`. The form shows it read-only, labelled "from Damage Step", in the effects list and updates live as the field changes. Remove the "＋ Damage Step" quick template. Empty field = no generated effect.
- **Where:** `ui/custom-item-builder.js` (new exported pure helper `damageStepEffect(step)` returning the effect via `finishEffect`/`summaryFor`, or null for undefined/empty; `cleanItemForm` calls it for weapons); `ui/ed-custom-item.js` (`QUICK_TEMPLATES.weapon = []`; `_formView` renders a read-only generated row above the editable rows when the weapon has a Damage Step; the empty-state text for weapons still reads sensibly).
- **Approach:** the generated effect is not stored in `form.item.effects` (see Discoveries), so there can be no duplicates and no index/summary-override bookkeeping for it. The read-only row is rendered from `damageStepEffect(item.ref?.damageStep)` and styled as a muted `.erow` with a "from Damage Step" tag (existing tokens only). In `cleanItemForm` the generated effect is placed first in `effects`. If the kind is not weapon, nothing is generated. Value is `Number(step)`. Decision (fixed): Damage Step must be a whole number >= 0. `cleanItemForm` pushes the error "Damage Step must be a whole number of 0 or more" when `ref.damageStep` is defined and is not a finite integer >= 0 (rejects negatives, decimals, NaN); no effect is generated while the value is invalid. `min="0"` and `step="1"` on the input are UI hints only; the clean-step check is the enforcement, since the shared validator does not check `ref.damageStep`. The input uses `@input` so the read-only row updates per keystroke.
- **Dependencies:** none (I3 builds on it).
- **Acceptance criteria:** typing in the field updates the read-only effect's value and summary live (per keystroke, `@input`); a negative, decimal or non-numeric Damage Step shows the inline error, disables Save and stores nothing; saved item contains exactly one generated Damage effect; saved item passes `validateItem`; the Combat damage pool step equals Strength step + field value (store reads `ref.damageStep`, unchanged).
- **Risks / unknowns:** the Equipment tile/list renders `effects[0].summary` in the custom-items list (`ed-custom-item.js:389`); the generated effect first means the list sub-line shows "Adds +1 Damage step", matching the old template behaviour. Negative/non-integer steps are rejected (decided above).
- **Landing constraint:** I2 and I3 must land in the same change/commit (I2 alone leaves old template-created weapons showing a duplicate editable Damage row because `_editItem` does not yet seed). Do not commit or release I2 on its own.

### I3 — Store Damage Step 0, duplicate guard, seed on open
- **Covers tickets:** T3
- **Rules:** R4
- **Tier:** 3
- **What:** (a) `cleanItemForm` keeps `damageStep: 0` and generates a `+0` effect (summary "Adds +0 Damage step"); (b) save-time error on a weapon whose `effects` still contain an `attack/Damage add step` effect: "use the Damage Step field"; (c) opening an existing weapon seeds the form from it.
- **Where:** `ui/custom-item-builder.js` (ref loop: keep `0` only for key `damageStep`; other numeric fields keep current behaviour — `strMin`/`size` of 0 stay dropped, since 0 is not clearly valid there and the owner scoped only Damage Step; guard added before `validateItem` as an `errors` entry, so it lives in the builder's form-error path and never touches `engine/validate-item.js`); new pure exported helper `seedDamageStep(item)` in the same file; `ui/ed-custom-item.js` `_editItem` calls it.
- **Approach:** the guard matches `type==='attack-modifier' && target.domain==='attack' && target.name==='Damage' && operation==='add' && measure==='step'` among form effects (weapon kind only). `seedDamageStep(item)` for a weapon: find the first matching effect in the stored item and remove it from the form copy (it is the generated effect or the old template effect, both now represented by the field); if `ref.damageStep` is undefined/empty, set it from that effect's value. If the field is already set, the field wins and the stored effect is just dropped from the form copy (it is regenerated on save). Any further matching effects remain visible as editable rows and trigger the guard message, so old duplicates surface instead of being silently deleted. Seeding runs only on open (`_editItem`), so a user clearing the field in the form is respected (empty field = no generated effect, no re-seed). Seed treats a stored `0`-valued effect as 0 (not empty).
- **Dependencies:** I2 (must land in the same commit as I2).
- **Acceptance criteria:** a weapon with Damage Step 0 round-trips (clean -> save -> reopen shows 0) and shows "dmg 0" in the picker; a hand-added duplicate disables save with the "use the Damage Step field" message; an old weapon with only the effect opens with the field seeded and saves with the field authoritative; `strMin`/`size` behaviour unchanged; the shared validator is not modified.
- **Risks / unknowns:** an old item with the field AND a disagreeing effect silently takes the field value on next save (per owner decision "field authoritative"). A deep-equal check on save of untouched items is not required: a re-save only happens when the user edits and saves the form.

### I4 — Hide range fields for `unarmed`
- **Covers tickets:** T4
- **Rules:** R2
- **Tier:** 3
- **What:** do not render Short range / Long range when category is `unarmed`; drop `shortRange`/`longRange` when the category is unarmed.
- **Where:** `ui/ed-custom-item.js` (filter in the `refFields.map` for weapon + unarmed; clear on category change in the select handler via a `_setRef` variant that also removes the two keys); `ui/custom-item-builder.js` `cleanItemForm` (safety net: omit both keys when weapon `category === 'unarmed'`, so an item loaded with stale ranges cleans on save).
- **Approach:** the UI clear is a form-state change via the existing form setters (no game computation). The clean-step strip makes the saved item correct even if the form state were stale. Other categories unchanged, including melee.
- **Dependencies:** I1.
- **Acceptance criteria:** range inputs absent for unarmed, present for the other three; switching to unarmed and saving yields an item with no `shortRange`/`longRange`; switching back to melee shows empty range inputs.
- **Risks / unknowns:** none.

### I5 — Tests, docs, changelog
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** extend `custom-item-builder.test.js` and `ui/custom-item-state.test.js` as needed; update docs; add changelog entries.
- **Where:** tests above; `plans/PLAN-CUSTOM-ITEMS.md` (§6.2 table l.306: categories incl. unarmed, Damage Step field generates the read-only effect; reword the "ranges when missile/throwing" text to "short/long range shown except for unarmed", which is the true behaviour; same correction in `docs/UI-GUIDELINES.md` if it carries that claim; drop the Damage template mention and add a short build note in §6.6 style); `data/changelog.json` `unreleased.changes`; re-check `docs/UI-GUIDELINES.md` and `docs/THREAD-ITEMS.md` for stale lists (THREAD-ITEMS already lists `unarmed`).
- **Approach:** new builder tests: generated effect from field (value, summary, source, condition, single instance); empty field gives none; `damageStep: 0` kept and `+0` effect, as an explicit sibling test next to the existing "cost 0 kept, empties dropped" test (l.75-78, which stays valid); other 0s (`strMin`) still dropped; negative / decimal / NaN Damage Step yields the "whole number of 0 or more" error and no generated effect; hand-added duplicate yields the "use the Damage Step field" error and validator-passing otherwise; `seedDamageStep` cases (effect only, field + effect, field only, two effects, non-weapon untouched); unarmed strips ranges, melee keeps them; `unarmed` item passes `validateItem`. Update any existing test that pins a `+ Damage Step` template-created effect (the l.27 test builds an effect directly and remains valid). `ui/custom-item-state.test.js` only if state helpers change (none expected). Changelog: `{type:'added', text:'Custom item builder: weapons can now be Unarmed (e.g. a Gauntlet) ...'}` and `{type:'fixed', text:'Custom item builder: a weapon Damage Step of 0 is now kept, and the Damage Step field is the single source for the weapon's Damage effect.'}`. Run `npm test`.
- **Dependencies:** I1-I4.
- **Acceptance criteria:** `npm test` passes; changelog has an `added` and a `fixed` entry; no doc lists three categories or the Damage template.
- **Risks / unknowns:** none.

## Sequencing
1. I1 (trivial, unblocks I4 and manual testing of the Gauntlet).
2. I2 (introduces the generated-effect helper and read-only row).
3. I3 (needs I2's helper; adds 0 handling, guard, seed).
4. I4 (independent of I2/I3 but after I1; small).
5. I5 last, covering everything, with a final Tier-1 recheck (light/dark tokens, Escape/Enter, no root-absolute paths).
Implementation of I2-I4 all touch `cleanItemForm`; tests should be written alongside each item and consolidated in I5.

## Open questions
- Negative/non-integer Damage Step: decided, rejected with an inline error (owner can overrule; non-blocking).
- `strMin`/`size` of 0 left as-is (dropped); revisit only if the owner wants 0 stored there.
- Manual UI verification of the read-only row and range hiding is left to the owner per their preference.

## Review responses
- F1 (major, negative/non-integer Damage Step): fixed. Decision fixed in I2: `cleanItemForm` rejects anything not a finite whole number >= 0 with an inline error; `min=0` is only a hint; added to I2 acceptance and I5 tests; Open questions updated.
- F2 (minor, intermediate state / `@change`): fixed. I2 and I3 must land in the same commit (stated in both items); Damage Step input uses `@input` and the criterion says per keystroke.
- F3 (minor, tests and docs wording): fixed. Explicit sibling `damageStep: 0` test added to I5; the PLAN-CUSTOM-ITEMS l.306 edit is worded "short/long range shown except for unarmed", with the same check for UI-GUIDELINES.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
