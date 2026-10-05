# Feature: Custom item builder: unarmed weapons (custom-item-builder)

## Summary
Extend the custom-item builder UI (`ui/ed-custom-item.js`, `ui/custom-item-builder.js`) so a player can build an equippable unarmed weapon such as a +1 Gauntlet. Adds the `unarmed` weapon category, makes the Damage Step field the single source for weapon damage (the builder generates the matching effect), stores a Damage Step of 0, and hides range for unarmed weapons.

## Goals / Non-goals
- Goal: a Gauntlet (category unarmed, Damage Step 1) is buildable in the UI, equips, shows in the Combat Weapon picker, and rolls Unarmed Combat at Strength step + 1.
- Goal: field and generated effect can never disagree.
- Non-goal: seed data (no `rules/` or `data/` file changes); the owner builds the Gauntlet in the UI.
- Non-goal: engine changes (the engine already supports `unarmed`); schema/taxonomy changes; hiding range for melee.

## Guardrail alignment
All tickets Tier 3: builder UI behaviour within an existing field and an existing category tag, plus a bug fix. No schema shape, taxonomy vocabulary, version tag, engine or `rules/*.json` change. The builder stays dispatch-up (no game computation in the UI beyond writing item input). No sign-off needed. Rules: R1-R4 in rules.md (R3, R4 owner house decisions).

## Tickets
### T1 — Add `unarmed` weapon category
- **What:** add `'unarmed'` to the weapon Category options at `ui/ed-custom-item.js:38`.
- **Why:** the gauntlet needs the category that links it to Unarmed Combat.
- **Tier:** 3
- **Acceptance criteria:** Category dropdown offers melee, missile, throwing, unarmed; an item saved with `unarmed` passes `validateItem`, appears in the Combat Weapon picker after None and Unarmed, filters talents to Unarmed Combat, and rolls Strength step + Damage Step (R3 house convention). Builder help text states the additive convention.
- **Open questions:** none.

### T2 — Damage Step field is the single input; generated read-only effect
- **What:** for kind weapon, the builder generates the `attack-modifier` / `attack|Damage` / `add` / `measure: step` / `condition: always` / `source: item` effect (value + summary) from the Damage Step field on save/clean, and shows it read-only labelled "from Damage Step" in the effects list. Remove the "＋ Damage Step" quick template. Empty field = no generated effect.
- **Why:** Combat reads `ref.damageStep` only (store.js:1395; engine/combat.js:325); the effect is display/provenance. One input prevents disagreement.
- **Tier:** 3
- **Acceptance criteria:** editing the field updates the generated effect value and summary; no duplicate generated effects; the saved item passes `validateItem`; the Combat damage pool step equals Strength step + field value.
- **Open questions:** none.

### T3 — Store Damage Step 0; guard hand-added duplicates; seed on open
- **What:** (a) `cleanItemForm` must keep `damageStep: 0` (it currently drops `0`; other numeric fields such as `strMin`/`size` keep their current behaviour unless the planner finds `0` is equally valid there) and generate a `+0` effect (R4). (b) save-time validation error on a weapon carrying a hand-added `attack/Damage add step` effect that is not the generated one: "use the Damage Step field". (c) on opening an existing weapon whose Damage Step field is empty but which has an `attack/Damage add step` effect, seed the field from that effect; on save the field is authoritative and rewrites the effect.
- **Why:** correctness for 0, no duplicate effects, backward compatibility with weapons saved under the old model.
- **Tier:** 3 (bug fix + builder behaviour)
- **Acceptance criteria:** a weapon with Damage Step 0 round-trips and shows "dmg 0" in the picker; a hand-added duplicate blocks save with the message; an old weapon with only the effect opens with the field seeded.
- **Open questions:** whether the duplicate guard lives in `cleanItemForm` or the form-error path (planner decides; must not weaken the shared `engine/validate-item.js` gate for other items).

### T4 — Hide range fields for `unarmed`
- **What:** hide Short range and Long range when weapon category is `unarmed`; clear stored `shortRange`/`longRange` when the category is switched to `unarmed`.
- **Why:** unarmed attacks are close combat with no range increments (R2).
- **Tier:** 3
- **Acceptance criteria:** range fields not rendered for unarmed; switching category to unarmed removes any stored range from the saved item; other categories unchanged.
- **Open questions:** none.

### T5 — Tests, docs, changelog
- **What:** update/extend `custom-item-builder.test.js` and `ui/custom-item-state.test.js` (and any test pinning the category list or the quick template); add changelog entries to `data/changelog.json` `unreleased.changes`; update any doc that lists the three weapon categories or the Damage template (check docs/THREAD-ITEMS.md, docs/UI-GUIDELINES.md, plans/PLAN-CUSTOM-ITEMS.md).
- **Why:** keep tests and docs truthful.
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes; changelog has an `added` entry for the unarmed category and a `fixed` entry for Damage Step 0 / single-input Damage Step.
- **Open questions:** none.
