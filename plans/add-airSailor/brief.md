# Brief: Add Air Sailor discipline (add-airSailor)
## What & why
Add Air Sailor (Circles 1-8) as rule data in rules/disciplines.json and flesh out all 33 Air Sailor talents in rules/talents.json (23 are stubs). Air Sailor becomes selectable in the loader and Disciplines tab. Not a spellcaster. Data + tests only; no UI/engine/taxonomy change.
## Tickets & tiers
T1 Air Sailor discipline entry - Tier 3 - n/a. T2 Discipline talents full - Tier 3 - n/a. T3 Option talents full - Tier 3 - n/a. T4 Tests - Tier 3 - n/a. No Tier 1/2.
## Items
I1 — disciplines.json Air Sailor entry — rules/disciplines.json — T1 — R1,R2,R3,R6,R9
I2 — upgrade discipline talents — rules/talents.json — T2 — R4,R5,R6
I3 — upgrade option talents — rules/talents.json — T3 — R3,R4,R5
I4 — data-conformance + Circle-1 creation tests; update hard-coded discipline lists — engine/*.test.js, tools/dev-server.test.js:219, engine/creation.test.js:1247, store-creation-golden.test.js:216-219 (`addable`) — T4 — R7,R8
## Rules
R1 — Attrs CHA/DEX/WIL; artisan Rune Carving, Sail Embroidery; Durability 5; free talent Air Sailing.
R2 — C1 Avoid Blow, Climbing, Melee Weapon, Thread Weaving (Air Sailor), Wind Catcher + karma once/round aboard airship; C2 PD+1 Awareness; C3 karma Initiative, Empathic Sense; C4 SD+1 Wound Balance; C5 Collaborate (Simple, 1 Strain, ally +2) + karma Interaction, Heartening Laugh; C6 PD+2 Air Dance; C7 extra Recovery test, Inspire Others; C8 PD+3 Lion Heart. Decision: stacking highest (repo convention).
R3 — Novice opts: Acrobatic Defense, Distract, First Impression, Great Leap, Haggle, Maneuver, Navigation, Speak Language, Taunt, Throwing Weapon. Journeyman: Air Speaking, Battle Bellow, Conceal Object, Engaging Banter, Etiquette, Graceful Exit, Leadership, Resist Taunt, Second Weapon, Surprise Strike.
R4 — per-talent step/action/strain/skill use in RULES-FAQ Q042.
R5 — no talent tier in book; skill-use tier as printed.
R6 — no Spellcasting/spells; keep name Thread Weaving (Air Sailor). Decision: owner 2026-11-22.
R7 — sample Human Air Sailor is mid-circle; creation test uses engine-derived values.
R8 — generic kit, crew needs Air Sailing Rank 1+ (met by free talent).
R9 — app names kept (Melee Weapon, Throwing Weapon).
## Owner decisions
2026-11-22: flesh out all talents fully. 2026-11-22: no spells. 2026-11-22: use existing vocab + note effects (no taxonomy change). 2026-11-22: data + creation tests. 2026-11-22: no sample character file, no UI/engine changes.
## Constraints & gotchas
- Mirror Archer entry shapes (rules/disciplines.json); defense effects `stacking:"highest"`; RecoveryTests uses `characteristic-modifier` rating (Warrior C7).
- Do not change action/attribute/tier of existing talent entries (shared with other Disciplines).
- Distilled summaries, no verbatim book prose.
- Engine finds `Thread Weaving (<discipline>)`; keep the name.
- C5 Interaction karma: `grant-karma-use` target Action, `scope:"Interaction tests"` (no vocabulary added).
- No code reads talents.json `tier` (verified), so adding tier to stubs is additive.
- `npm test` after I1 is a hard gate; log every test file touched.
- Goldens `addable` arrays and hard-coded four-discipline lists in tests need Air Sailor added.
