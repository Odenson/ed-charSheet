# Test Plan: Unarmed Combat missing short effect (unarmed-short-effect)

## Test files
engine/unarmed-combat-data.test.js

## Coverage
### engine/unarmed-combat-data.test.js::Unarmed Combat entry exists under its own name
- **Validates:** I2 — the catalog key and `name` stay "Unarmed Combat".
- **Rule:** n/a
- **Why:** Catches a rename/removal of the entry while it is rewritten.

### engine/unarmed-combat-data.test.js::Unarmed Combat shortEffect is exactly "Unarmed close-combat attack" (owner decision)
- **Validates:** B-001 core fix — `presentation.shortEffect` drives the Disciplines Effect column (`store.js` row `brief`).
- **Rule:** n/a (owner decision 2026-11-26T21:57:50Z)
- **Why:** Fails on the stub; catches a missing or reworded short effect.

### engine/unarmed-combat-data.test.js::Unarmed Combat: Standard action, Dexterity, Strain 0 (R1)
- **Validates:** action / attribute / strain fields.
- **Rule:** R1
- **Why:** Catches wrong action, attribute or a missing/non-zero strain (strain fails on the stub).

### engine/unarmed-combat-data.test.js::Unarmed Combat: Skill Use allowed at Novice (R2)
- **Validates:** `skillUse` shape and values.
- **Rule:** R2
- **Why:** Catches missing Skill Use info in the info modal.

### engine/unarmed-combat-data.test.js::Unarmed Combat: talent tier Novice (R3)
- **Validates:** `tier: "Novice"`.
- **Rule:** R3
- **Why:** Catches a wrong or missing catalog tier.

### engine/unarmed-combat-data.test.js::Unarmed Combat: versus the target's Physical Defense (R4)
- **Validates:** `versus` mentions Physical Defense (regex only, per spec).
- **Rule:** R4
- **Why:** Catches a missing or wrong defense target.

### engine/unarmed-combat-data.test.js::Unarmed Combat summary documents the attack and Strength Step damage (R4, R5)
- **Validates:** non-empty `summary` (makes the modal "documented") mentioning Physical Defense and Strength Step.
- **Rule:** R4, R5
- **Why:** Catches an undocumented entry or a summary that misstates the damage basis.

### engine/unarmed-combat-data.test.js::Unarmed Combat has exactly one effect: an on-success talent note (R5)
- **Validates:** `effects` is exactly one `note` / `on-success` / `talent` entry with a non-empty summary mentioning Strength Step.
- **Rule:** R5
- **Why:** Catches missing note, extra effects, or off-taxonomy condition/source.

### engine/unarmed-combat-data.test.js::Unarmed Combat carries no karma, combatOptions or arms (R6; display-only)
- **Validates:** no `karma`, `combatOptions`, `arms` fields — keeps the talent display-only.
- **Rule:** R6
- **Why:** Catches accidental Combat-tab folding or a fabricated Karma grant. (Passes on the stub; guards the build.)

### engine/unarmed-combat-data.test.js::effectTaxonomy reference is still v6 (no version bump)
- **Validates:** header `effectTaxonomy` untouched.
- **Rule:** n/a
- **Why:** Catches an unintended Tier-2 taxonomy bump.

Existing suites that must stay green (not modified): `store-creation-model.test.js` (row brief equals catalog shortEffect), `tools/rules-conformance.test.js` (catalog conformance / JSON validity).

## Not covered (and why)
No browser harness; UI is manual. Owner checks on the dev server, light and dark themes:
- Open Fighter Test (`data/characters/fighter-test.json`, Unarmed Combat rank 2). Disciplines tab: the Effect column for Unarmed Combat shows "Unarmed close-combat attack".
- Open its info modal: it is documented and shows the summary, versus "target's Physical Defense", Strain 0, Skill Use (Novice), and the note "Hit — follow with an unarmed Damage test (Strength Step)." The tier chip still follows the circle.
- Warrior option pickers show the same brief. The Combat tab does not change.
- Byte-identity of other talents and the `—` escape style are review items, not tested.

## How to run
`npm test`
