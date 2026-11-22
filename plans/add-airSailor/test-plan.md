# Test Plan: Add Air Sailor discipline (add-airSailor)

## Test files
- engine/air-sailor-data.test.js (new)
- engine/creation.test.js (edit, line 1247: 'Air Sailor' added to the discipline list)
- tools/dev-server.test.js (edit, lines 217-219: title "(5 Disciplines)", 'Air Sailor' added)
- store-creation-golden.test.js (edit, lines 216-219: "Air Sailor" inserted first in each `addable` literal)

## Coverage
### engine/air-sailor-data.test.js::Air Sailor discipline header
- **Validates:** entry exists first and file stays alphabetical; attributes CHA/DEX/WIL, artisan skills, Durability 5, karmaRitual/halfMagic summaries; option lists (10+10, in order); 8 circles with the exact DTs; C1 free talent exactly Air Sailing; no Spellcasting/matrix/Patterncraft, no `spells`; no talent repeated, 33 distinct.
- **Rule:** R1, R2, R3, R6 (Q042)
- **Why:** catches wrong/missing circle data, an accidental caster, duplicates.

### engine/air-sailor-data.test.js::Air Sailor talents resolve and are fully written
- **Validates:** key count stays 456; all 33 names resolve; per talent (literal table, stored strings such as "Sustain" vs "Sustained"): action, attribute, strain, skillUse allowed/tier, tier in {Novice, Journeyman}, non-empty summary and effects (source "talent"); 23 upgraded talents have presentation.shortEffect. Existing full entries are also checked still to match Q042.
- **Rule:** R4, R5 (Q042, Q001)
- **Why:** catches stubs left behind and altered shared fields.

### engine/air-sailor-data.test.js::Air Sailor circle effects
- **Validates:** Physical +1/+2/+3 (C2/C6/C8) and Social +1 (C4) rating/highest; C1 Action karma scope "on board an airship"; C3 Initiative karma; C5 Interaction karma + Collaborate note; C7 RecoveryTests add 1; only the four allowed effect types; taxonomy stays v6.
- **Rule:** R2 (stacking: highest)
- **Why:** catches wrong values or vocabulary drift.

### engine/air-sailor-data.test.js::Air Sailor Circle-1 creation
- **Validates:** `buildNewCharacter` takes the non-magician path (no spells, no Grimoire), stores only Durability and Karma Ritual (Rank 1, Circle 1), `freeTalentRows` yields Air Sailing at Rank 1, Durability 5 from the discipline file.
- **Rule:** R1, R6, R7, R8
- **Why:** free talent derived, not stored; crew requirement met.

### Edited existing tests
- creation.test.js fuzz session, dev-server builder validation, golden `addable` lists: Air Sailor is now an addable/creatable discipline.

## Not covered (and why)
UI: Air Sailor appears first in "Start a new character" and the Disciplines tab; creating and opening a character works in light and dark themes; talent descriptions read correctly (original wording, no verbatim prose). Summary wording is not asserted.

## How to run
`npm test`
