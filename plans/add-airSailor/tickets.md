# Feature: Add Air Sailor discipline (add-airSailor)

## Summary
Add the Air Sailor discipline (Circles 1-8) to the app as pure rule data, and flesh out every Air Sailor talent (discipline talents and Novice/Journeyman options) in `rules/talents.json` with full book detail. Air Sailor then appears in the loader's "Start a new character" list and works in the Disciplines tab. Air Sailors are not spellcasters; no spell data.

## Goals / Non-goals
- Goal: `rules/disciplines.json` Air Sailor entry (header, durability, free talent Air Sailing, talent options, 8 circles with defense/karma/recovery/Collaborate effects).
- Goal: full entries for all 33 Air Sailor talents (existing stubs upgraded; none missing).
- Goal: tests: data conformance + Circle-1 creation test.
- Non-goal: spells/Spellcasting, new taxonomy vocabulary, UI/engine changes, sample character file, changelog (release step).

## Guardrail alignment
Touches `rules/disciplines.json` and `rules/talents.json` only, within the existing schema and taxonomy (Tier 3). Circle abilities that do not map cleanly use `note` effects (owner's choice, qa-log). No Tier-1 or Tier-2 item; no sign-off required.

## Tickets
### T1 — Air Sailor discipline entry
- **What:** Add Air Sailor to `rules/disciplines.json`: important attributes, karma ritual, artisan skills, half-magic, durability 5, novice/journeyman options, circles 1-8 (freeTalents Air Sailing at C1; talents per R2; effects: karma-use grants incl. airship scope, Physical Defense +1/+2/+3 and Social +1 with `stacking: highest`, extra Recovery test, Collaborate as `note`).
- **Why:** Makes the discipline selectable and playable.
- **Tier:** 3
- **Acceptance criteria:** Discipline appears in the loader; creating an Air Sailor yields Air Sailing free talent and Durability 5; every talent name referenced resolves in talents.json; passes the `rules-conformance` tests.
- **Open questions:** none

### T2 — Flesh out Air Sailor discipline talents
- **What:** Full entries (presentation, action, attribute, strain, skillUse, tier, summary, effects) in `rules/talents.json` for Air Sailing, Avoid Blow (verify), Climbing, Melee Weapon, Thread Weaving (Air Sailor), Wind Catcher, Awareness (verify), Empathic Sense, Wound Balance (verify), Heartening Laugh, Air Dance (verify), Inspire Others, Lion Heart, per R4/R5/R6.
- **Why:** Owner asked for fleshed-out talents.
- **Tier:** 3
- **Acceptance criteria:** Each matches Q042 values; effects use existing vocabulary or `note`.
- **Open questions:** none

### T3 — Flesh out Air Sailor option talents
- **What:** Full entries for the Novice and Journeyman options (R3/R4): Acrobatic Defense, Distract, First Impression, Great Leap, Haggle, Maneuver, Navigation, Speak Language, Taunt, Throwing Weapon, Air Speaking, Battle Bellow, Conceal Object, Engaging Banter, Etiquette, Graceful Exit, Leadership, Resist Taunt, Second Weapon, Surprise Strike (existing full entries verified, stubs upgraded).
- **Why:** As T2.
- **Tier:** 3
- **Acceptance criteria:** As T2; no existing full entry regresses.
- **Open questions:** none

### T4 — Tests
- **What:** Data-conformance tests (Air Sailor circles, option lists, all talents resolve and are non-stub, effects well-formed) and a Circle-1 new-character creation test for an Air Sailor (non-magician: no grimoire/spells), with golden values from the sample where applicable (R7, R8).
- **Why:** Guards the data; mirrors existing creation goldens.
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes including new tests; existing tests that assume four disciplines are updated only where they must be.
- **Open questions:** none
