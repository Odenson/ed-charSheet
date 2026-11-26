# Plan Review: Unarmed Combat missing short effect (unarmed-short-effect)

## Summary
The plan is sound: both tickets are covered, the plan is Tier 3 (data within the
`ed-talents/1` shape, taxonomy v6 vocabulary, plus a new test), every rules value
traces to rules.md R1–R6 with no NOT-COVERED/CONFLICT/APP-DIFFERS entries, and all
cited code locations check out (`rules/talents.json:948-952` stub, Melee Weapon at
656-679, `store.js:1233/1238/933-943`, `COMBAT_ATTACK_TALENTS` at 1785,
`engine/combat.js:58`, `fighter-test.json` rank 2 circle 1,
`store-creation-model.test.js:150`, `tools/rules-conformance.test.js`,
`MAX_SHORT_EFFECT`). The catalog `tier` is not used for pricing, and `rollStrain`
going from null to 0 changes nothing because every UI consumer already applies
`?? 0`. One minor finding, no blockers.

## Findings
### F1 — I2 — Em dash style in the JSON snippet contradicts Discoveries
- **Severity:** minor
- **Problem:** Discoveries say to store the non-ASCII em dash escaped (`—`) like
  Melee Weapon's note, but the I2 snippet shows a literal `—` in the effect summary
  ("Hit — follow with…"). The file already mixes both styles (2 literal, 9 escaped),
  so either works, but the implementer gets two different instructions.
- **Fix:** Spell it as `"Hit — follow with an unarmed Damage test (Strength Step)."`
  in the I2 snippet, or drop the escaping instruction from Discoveries. I1's
  assertions don't depend on this, so the test is unaffected either way.
