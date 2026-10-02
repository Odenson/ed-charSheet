# Plan Review: Spell effect outcome on other targets (spell-target-effect-outcome)

## Summary
The plan is well grounded in the code and covers T1-T3, with Tier-1 sign-off recorded and R3 backed by an owner Decision. No blockers. There are 2 major and 3 minor findings, mostly about duration rules grounding, the rank source, and a missing miss-then-Effect edge.

## Findings
### F1 — I1 — Duration "rounds" rests on an app convention, not on R5
- **Severity:** major
- **Problem:** I1 cites R5 for `duration.rounds`. R5 only says duration is measured in rounds/minutes/hours/other and that success levels may extend it. The 1 minute = 10 rounds and 1 hour = 600 rounds conversion in `durationRounds` is an owner/app rule, not in rules.md. Adding a rounds figure to the outcome also goes beyond the ticket's "duration if any", which the owner described as mechanical values without extra derivation. The Rank-based part also depends on a rank source (F2).
- **Fix:** Either show only the spell's duration label plus any success-level extension, or record in rules.md or the plan that the conversion is an existing app convention (cite where it is already authorised) and that R5 does not cover it. State which the planner chooses, and keep the rounds figure null whenever unsupported.

### F2 — I1 — castingRank source is unverified and left as an open question
- **Severity:** major
- **Problem:** The plan defers whether `castingRank` can be read in `buildSpellsContext`. That function reads `derived.disciplines[].talents`, but `ed-app._spellcastingRank()` reads `this._character.disciplines[].talents[].rank` from the raw character. Nothing in the plan confirms the derived talent objects carry `rank`. If they do not, `castingRank` would silently be 0 and wrong durations would result, which is a correctness risk for the acceptance criteria. The fallback "pass `_spellcastingRank()` via the model" is also vague, because the Spells UI has no access to the character.
- **Fix:** Verify now, and name one approach. If derived talents have `rank`, add `castingRank` to the ctx next to `castStep` with a unit test. Otherwise pass the rank as an `ed-app` prop to `ed-spells`. Remove this from Open questions. Also test the case where `rank` is absent.

### F3 — I2 — Effect roll after a miss, and `effectTotal` guard
- **Severity:** minor
- **Problem:** I2 sets `effectTotal` from the 'effect' branch whenever `_castOnOther` and the name matches. The plan does not say whether a step-effect spell that missed still goes through the Effect roll in the current flow. If it does, `effectTotal` would be set on a miss record. The "name matches" guard also cannot tell two consecutive casts of the same spell apart. The risk note defers this to the spec.
- **Fix:** State that the engine ignores `effectTotal` when `hit` is false, and add a test for it. Or clear the pending flag at cast time on a miss. Replace the name match with a per-cast token, for example the cast rollId or a counter captured in `_rollCast`.

### F4 — I1/I3 — Duplicate success-level display risk and an ambiguous "N successes"
- **Severity:** minor
- **Problem:** `levels` (cast successes, 1 at the number) and `extraSuccesses` (levels − 1) are both exposed. The text and pills say "N success(es) vs <target>". The plan does not say which number N is. The rules brief (R2) calls the number at the Difficulty Number 1 success and each full 5 over an extra success, so N must equal `levels`, with extras used only for the duration/effect boosts.
- **Fix:** In I1 state that N = `levels`, and assert it in the test for "target+10 -> 3 successes".

### F5 — I3 — Spell resolution fallback and "one to three lines" under-specified
- **Severity:** minor
- **Problem:** I3 says to resolve the spell via `joinSpell`/catalog from `this.ctx`, with a fallback to the engine text when unresolvable. But `otherCastOutcome` takes the spell, so the call without a spell is undefined. The compact layout also puts a Hit/Miss pill, a success count, an Effect pill, picks and a duration in three lines, which is likely tight. None of this can be tested with `node:test`, so it relies on owner verification.
- **Fix:** Define the signature when the spell is null: return a text-only outcome built from `name`. Add an explicit manual-verification checklist for the owner: miss, hit, pending placeholder, a different spell selected, a tab switch, light and dark themes, and desktop height.

## Checks passed
- Grounding: `_castPanel`, `_activeEffects`, `_rollCast`, `_onRoll`, `SCRATCH`, `_saveScratch`/`_restoreScratch`/`_resetWorkspace`, `castBoosts`, `durationRounds`, `effectReadout` and `castPlan` all exist and are used as described.
- Sequencing is valid and every ticket is covered. Guardrail tiers are correct, with sign-off recorded in the qa-log for I2-I4.
- R3 is backed by an owner Decision recorded on RULES-FAQ Q013. R1, R2 and R4 trace to rules.md. No Tier-2 change.
- The UI-GUIDELINES.md l.60 Spells row exists, so the I4 edit target is real.
