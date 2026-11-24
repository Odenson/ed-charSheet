# Plan Review: Frighten uplift (frighten-uplift)

## Summary
The plan is sound overall. The Tier-1 sign-off is recorded, every rules claim traces to `rules.md`, and the sequencing is valid. I found 4 findings and no blockers: 1 major (a descriptor field mismatch between I2 and I3) and 3 minor.

## Findings
### F1 — I2/I3 — `step` field shape mismatch between descriptor and engine
- **Severity:** major
- **Problem:** I3 adds `step: t.arms.roll?.step ?? null` as a top-level field of the descriptor's `arms` object. I2's `armOpponent` reads `arms.roll?.step`. The Disciplines (`ui/ed-disciplines.js` 409) and Combat (`ui/ed-combat.js` 841) builders construct `arms` with explicit fields and carry no `roll` key. So the engine would never see the step, and the "Frighten Step <step>" sentence would be silently dropped. The same applies to `perSuccess`, which the engine reads from `arms.perSuccess`. That one is consistent, but only because I3 lists it explicitly.
- **Fix:** Pick one shape and use it in I2, I3 and the tests. For example, the engine reads `arms.step` and `arms.perSuccess`, and I3 forwards both at the top level of the descriptor `arms`. Drop the "already present" claim for `arms.roll.step` in I2. Add an `armOpponent` test that feeds the real descriptor shape, not the store shape.

### F2 — I2/I3 — No test covers the store derivation or the descriptor forwarding
- **Severity:** minor
- **Problem:** The acceptance criteria rely on the store computing `opponent`, `text` and `perSuccess` (I1, I2). They also rely on the descriptors forwarding them (I3). The listed tests are `engine/taunt-data.test.js`, `engine/active-effects.test.js` and `engine/frighten-data.test.js`. These cover data and the pure engine, but they do not cover `buildTalentRow`. The F1 bug class would pass them all.
- **Fix:** Add a store-level test that builds a character with Frighten and Taunt and asserts `arms.opponent`, `arms.perSuccess = {delta:-2}`, `arms.text` and `arms.rounds` (rank). Also assert that Mystic Aim has `opponent === false`. Call out the descriptor forwarding in I3 as manual verification (a Disciplines Frighten roll), since the UI is not testable under `node:test`.

### F3 — I3 — Roll-modal aim outcome text is misleading for opponent arms that carry `aim.effects`
- **Severity:** minor
- **Problem:** `ui/ed-combat.js` 839 passes `effects: opt.arms.effects` into `aim`. For Frighten, `arms.effects` includes the on-success test-modifier (store 1209). `ed-roll-modal.js` `_aimSummary` (460) then renders "Aim hit — N successes, +-2 steps to Action". That is wrong wording for an opponent penalty. The Disciplines builder passes no `aim.effects`, so it would show a dangling "Aim hit — N successes, ". Taunt already has this trailing-comma behaviour, since its effects list is empty. I2/I3 say the roll modal needs no change, and that is only true of the hint at line 527.
- **Fix:** In I3, either filter `arms.effects` to `[]` for opponent arms in the store (the payload is unused on the opponent path), or have the roll modal skip the effect summary when `aim.opponent` is set. Keep it minimal and mention it in the plan. Taunt's behaviour must stay unchanged, so only touch the summary text if the owner accepts that.

### F4 — I2 — Duration and wording logic is under-specified
- **Severity:** minor
- **Problem:** The `duration` handling is muddled. It says to update `duration` "only if the vocabulary has one", otherwise leave `"special"` and mention the difference in the summary. The "all tests" wording is a multi-branch derivation ("`target.name === Action`", then `scope`, then fallback). That is brittle logic for a feature with a single consumer. The talent's own `summary` text already says "-2 to all the target's tests".
- **Fix:** Decide now to leave `duration: "special"` untouched (the arm's `rounds` drives the countdown) and record that in the Discoveries section. Simplify the display to `"<delta> x N = <delta*N> to all tests"`, with "all tests" derived only when `target.name === 'Action'`; otherwise omit the "to all tests" suffix. Add a test for the fallback.
