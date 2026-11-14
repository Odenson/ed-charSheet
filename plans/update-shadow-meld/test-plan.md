# Test Plan: Update Shadow Meld (update-shadow-meld)

## Test files
- engine/shadow-meld.test.js

(Not touched: the uncommitted engine/spells.test.js.)

## Coverage
All cases are in `engine/shadow-meld.test.js`; the "test" names below are the `test(...)` titles. Rank-1 caster, no store/DOM. 1 minute = 10 rounds (spec engine conversion), rank-1 base = 10 rounds.

- **unchanged base facts** - Rule R1. Circle 1, 1 thread, weaving 5/10, TMD, Touch, "Rank minutes", area null stay. Catches accidental edits.
- **success level: one per-success Increase Duration** - R2. `successes[0]` shape (add 2 minutes, on-success, perSuccess).
- **extra threads: Increase Duration and Increase Effect** - R3. Labels/order; duration thread effect has no `duration` field.
- **Increase Effect matches base target/measure/duration** - R3. Prevents the fold treating it as a standalone effect.
- **base and Increase Effect are always-on** - R4. `condition:"always"` and `autoApplies` true.
- **default-skill note effect** - R6. Note exists, mentions Stealthy Stride/default, not sustained.
- **description and summary state book facts** - R1, R4, R6. Mentions near shadows, default skill, light, +4.
- **sustainedEffectsOf returns only +4** - R6. Note not folded.
- **no options baseline** - R1. 10 rounds, one +4 effect, no note in active record.
- **successLevels 1 / 0 no boost; 2 gives 30; 3 gives 50** - R2. Only levels-1 count.
- **Increase Duration thread +20 rounds; stacks with success level (50)** - R2, R3.
- **one Increase Effect pick gives +6, two give +8, single effect, duration unchanged** - R3. Locks the matching requirement.
- **mixed picks** - R3. Both boosts fold.
- **boostedDuration** - R2. +20 rounds at rank 1 = 30.

## Not covered (and why)
- Spells tab UI (no browser harness): owner checks in light and dark themes that the success option and two thread options appear, picking them updates the duration readout and the Stealthy Stride bonus (+4 to +6 per Increase Effect), and the default-skill text is visible in the description. Whether the `note` effect is displayed at all: if not, flag, do not edit the UI.
- The Stealthy Stride roll actually receiving the bonus via `store.js` `abilityTestMods` (store-level; only `autoApplies` is pinned here).
- docs/TAXONOMY-AUDIT.md T-052 (docs; verify by `git diff`).
- `tools/rules-conformance.test.js` validity of the new entry is covered by the existing suite, not new tests.

## How to run
`npm test` (or `node --test engine/shadow-meld.test.js`)
