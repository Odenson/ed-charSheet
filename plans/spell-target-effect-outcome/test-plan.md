# Test Plan: Spell effect outcome on other targets (spell-target-effect-outcome)

## Test files
- engine/spells.test.js (appended `otherCastOutcome` cases; import list extended)

## Coverage
All cases in engine/spells.test.js named `otherCastOutcome: ...`:
- miss one exact line, effectTotal/picks ignored, no effect/duration (R1, R3)
- exactly one success -> "1 success vs T", extraSuccesses 0 (R2)
- target+10 -> levels 3, extraSuccesses 2, "3 successes vs T" (R2)
- step effect pending (`total`/`text` null, "Effect —") then rolled "Effect 14"; rolled 0 not pending (R4)
- static effect "+value label" matching effectReadout wording (R4)
- no-effect spell "No Effect roll" (R4)
- stacked picks first-seen order and full composed line with "Duration Rank minutes", no rounds figure (R5)
- no-duration spell omits duration part (R5)
- null/undefined spell: text-only from cast.name; miss still exact line (R3)
- absent extraPicks tolerated; inputs not mutated
- real catalog spell (Arrow of Night) smoke test
Rule values come only from spec.md Rules R1-R5; levels are supplied by the cast record, not computed.

## Not covered (and why)
UI (no browser harness); owner verifies by hand:
1. Miss shows one line "Miss vs N — no effect".
2. Hit with 1 and several successes.
3. Step spell: dashed "Effect —" pill, becomes "Effect <n>" after the Effect roll.
4. Static and no-effect spells.
5. Select a different spell: card still shows the previous Other cast.
6. Toggle to This character and back, tab switch and back: record persists, Active effects unchanged.
7. Second Other cast replaces it; Effect roll after a miss adds no Effect pill; Effect roll only updates its own cast (seq).
8. Character switch: no carry-over.
9. Light and dark themes.
10. Desktop: no added vertical scroll; mobile single column.
Also: _saveScratch/_restoreScratch, no dispatched events, docs/changelog edits.

## How to run
`npm test`
