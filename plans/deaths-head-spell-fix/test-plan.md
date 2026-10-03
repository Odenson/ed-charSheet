# Test Plan: Death's Head spell fix (deaths-head-spell-fix)

## Test files
- engine/spells-standalone-option.test.js (new)
- engine/spells-options.test.js (changed: stale "+2 Damage Step" Death's Head test removed; replaced by the new file)

## Coverage
### engine/spells-standalone-option.test.js
- **data: one extra thread, effect shape** - Validates T1(a); Rule R2, R4. Catches wrong/extra options or non-auto-applying effect.
- **data: success level / block** - T1; R1, R3. Catches changes to success option, threads, circle.
- **removed labels gone** - T1; R2. Catches leftover range/target/damage options.
- **0 picks** - T1(c); R3. 14 rounds, no Frighten bonus, summary label.
- **1 pick / 2 picks** - T1(b), T2; R4. +2 / +4 step on test|Frighten, picks recorded, origin tag, tile label `+4 ...`.
- **stale label** - T2 edge case. No throw, no effect.
- **expiry via tickActiveSpells** - T1(b); R3. Bonus gone after 10 ticks.
- **effectStepBonus / otherCastOutcome** - T2/I2 acceptance. Standalone effect must not leak into the Effect step.
- **fixture spell** - T2. Engine path works independent of data; value*count stacking.
- **Soul Armor regression** - T2. Option still boosts base once, not folded twice.
- **data-driven regression** - T2. Every spell whose sustained option matches a base effect (Soulless Eyes, Shield Mist, Aspects, Soul Armor) gains no extra record entry.

## Not covered (and why)
- `castPlan`: takes no picks, so it cannot show a pick-dependent Effect step; covered indirectly via `effectStepBonus`.
- Store-level Frighten step bonus (`abilityTestMods`/`applyTestMods`) - no spell store test harness; owner verifies: self-cast Death's Head with extra threads, Frighten talent shows +2N steps, disappears on expiry.
- UI: tile wording ("+2 Frighten test"), light/dark themes, no double count in ed-spells.js (~L1045) - manual.
- `isStandaloneOptionEffect` is not exported, so it is tested via `buildActiveSpell` output.

## How to run
`npm test`
