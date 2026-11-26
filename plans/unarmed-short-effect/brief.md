# Brief: Unarmed Combat missing short effect (unarmed-short-effect)

## What & why
Backlog B-001. The Warrior's optional Unarmed Combat talent (Fighter Test troll)
shows no short effect because `rules/talents.json` "Unarmed Combat" is a stub
(name/action/attribute). Fill it to Melee Weapon's shape with book-verified
values and add a data test. Data-only; no engine/UI/taxonomy change.

## Tickets & tiers
- T1 — Complete the Unarmed Combat talent entry — Tier 3 — n/a
- T2 — Data test guarding the entry — Tier 3 — n/a

## Items
- I1 — Data test (write first, must fail on stub) — `engine/unarmed-combat-data.test.js` (new, model: `engine/taunt-data.test.js`) — T2 — R1-R5
- I2 — Fill the entry — `rules/talents.json:948-952` — T1 — R1-R6

## Rules
- R1 — Step = Rank + Dexterity; action Standard; strain 0.
- R2 — skillUse `{ allowed: true, tier: "Novice" }`.
- R3 — `tier: "Novice"` (offered only as a Novice Talent Option; not a Warrior C1 Discipline Talent).
- R4 — versus "target's Physical Defense".
- R5 — On hit, Damage test uses Strength Step only unless noted otherwise; no unarmed-specific extra-success bonus.
- R6 — No Karma line in the talent; default eligibility applies -> add no `karma` field.

## Owner decisions
- 2026-11-26 21:57:23Z — full entry matching Melee Weapon; other Warrior stubs (Shield Bash, Tactics, Fireblood) out of scope.
- 2026-11-26 21:57:50Z — shortEffect exactly "Unarmed close-combat attack".
- 2026-11-26 21:58:26Z — plan = entry + data test, nothing else.

## Constraints & gotchas
- Target entry (Melee Weapon field order, `rules/talents.json:656-679`):
  shortEffect "Unarmed close-combat attack"; action "Standard"; attribute "Dexterity"; strain 0;
  skillUse {allowed:true, tier:"Novice"}; tier "Novice"; versus "target's Physical Defense";
  summary: "Close-combat attack with your hands, feet, or another body part vs the target's Physical Defense; on a hit, make a Damage test using your Strength Step only, unless noted otherwise.";
  effects: [{ type:"note", condition:"on-success", source:"talent", summary:"Hit \u2014 follow with an unarmed Damage test (Strength Step)." }].
- talents.json stores em dashes escaped as the six ASCII characters backslash-u-2-0-1-4 (`\u2014`); keep the style. Do not touch header `notes`/`effectTaxonomy` (v6).
- Do not add `karma`, `combatOptions` or `arms` — talent effects are display-only (`store.js:933-943` talentDetail; not folded by `engine/combat.js` collectCombatEffects).
- Brief renders via `store.js:1238` (`presentation.shortEffect`); `store-creation-model.test.js:150` and `tools/rules-conformance.test.js` must stay green.
- Test: assert shortEffect exactly; other prose via regex only (Physical Defense, Strength Step).
- Manual check: `data/characters/fighter-test.json:64` (Unarmed Combat rank 2) on dev server, Disciplines tab Effect column + info modal.
