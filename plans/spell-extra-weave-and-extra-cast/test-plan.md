# Test Plan: Apply weave-success and cast-success spell options together (spell-extra-weave-and-extra-cast)

## Test files
- engine/spells-options.test.js (new)
- engine/spells.test.js (one assertion adjusted: the stacked-picks `duration` deepEqual `{label}` became `duration.label`, since the shape widens to BoostedDuration)

## Coverage
### engine/spells-options.test.js
- appliedOptions: Pain pick + 2 successes; 3 successes mult 2 and 1 success null (Rule R1, R2); levels 0/null never negative; repeats stack in first-seen order (R2); unknown label count 1; no `successes[0]` no throw; inputs not mutated.
- boostedDuration: Pain rank 5 boost 2 -> "7 rounds (Rank 5 + 2)" (R3); boost 0 omits "+ boost"; minutes conversion (existing owner rule, R3); fixed rounds with/without boost; non-round -> null rounds and spell text; rank null/0/undefined -> fallback, never "Rank 0"; falsy duration -> null.
- otherCastOutcome: Pain example (R1, R3, R4: picks, success x1, 7 rounds, text content); 1 success; 3 successes (x2, 9 rounds, text "x2"); miss; missing opts/rank fallback; unknown pick; non-round duration.
- buildActiveSpell: `options` + boosted roundsTotal (R4); plain cast empty options; tickActiveSpells preserves options.
- buildSpellsContext: `castingRank` equals Spellcasting rank, first-match discipline order, null without talent or rank.
- Why: catches lost success-level option / unboosted duration (the reported bug) and "Rank 0" text.

## Not covered (and why)
- ui/ed-spells.js rendering (no browser harness): owner checks Pain rank 5, +1 Wound pick, 2 successes shows chips "Increase Effect (+1 Wound)" and "Increase Duration (+2 rounds)" (no x1) and "Duration 7 rounds (Rank 5 + 2)"; 3 successes shows "x2"; 1 success shows no success chip; Active effects row sub-line chips, plain cast no sub-line; chip wrapping, light/dark, no desktop scroll.
- Store-level `model.spells.active` retaining `options`: not unit-tested (store passes records through whole; needs a full model fixture). Manual check.
- Order/separator of segments in `out.text` is asserted only by substring.
- Fixed-round-with-boost breakdown "(2 + 2)" follows the spec's "otherwise the base rounds" wording.

## How to run
`npm test`
