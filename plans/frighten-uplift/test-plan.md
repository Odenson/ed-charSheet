# Test Plan: Frighten uplift (frighten-uplift)

## Test files
- engine/frighten-data.test.js (new)
- engine/active-effects.test.js (appended armOpponent cases)
- engine/taunt-data.test.js (updated for explicit opponent flag)

## Coverage
### engine/active-effects.test.js
- armOpponent perSuccess text ("-2 x 3 = -6 to all tests", note, "Frighten Step 9"); Rule R2, R3. Catches missing computed total or Step.
- head/note/Step ordering; R2/R3.
- allTests false omits "to all tests" (non-Action target).
- step null/absent omits the Step sentence.
- no perSuccess -> static Taunt text and default name unchanged (regression).
- positive delta printed as-is; miss returns null.
### engine/frighten-data.test.js
- Frighten arms data: opponent true, rounds "rank", vs Mystic (R1, R2).
- Frighten effects: test-modifier untouched (on-success, perSuccess, subtract 2, Action) plus a note effect (R2, R3, R4).
- Store: Frighten row opponent, perSuccess {-2, true}, rounds = rank, effects [], text = note; Taunt opponent, perSuccess null, static text; Mystic Aim opponent false, payload kept; non-arming talent arms null.
- End to end model arms -> armOpponent text.
- Pools unaffected: collectCombatEffects ignores an opponent Frighten record; deriveModel with Frighten learned plus an opponent entry leaves activeEffects/combat/castingArmed unchanged.
- Taxonomy still v6.
### engine/taunt-data.test.js
- Taunt arms equals `{roll:{vs:'Social'}, rounds:'rank', opponent:true}`; string-rounds talents are now Taunt and Frighten.

## Not covered (and why)
- UI forwarding of `perSuccess`/`step` in ui/ed-disciplines.js and ui/ed-combat.js (no DOM harness). Manual: roll Frighten from Disciplines and the Combat dropdown, in light and dark; entry reads "-2 x k = -2k to all tests. <note> Frighten Step S.", countdown from Rank, X ends it; a miss adds nothing; Combat vs preset sensible; Mystic Aim and Taunt unchanged.
- Docs (EFFECT-TAXONOMY etc.) and the absence of `=== 'Social'` in store.js: reviewer grep.
- engine/validate-item.js `arms` allow-list: dev to grep.

## How to run
`npm test`
