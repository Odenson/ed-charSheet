# Plan Review: Situational chips global (situational-chips-global)

## Summary
The plan is grounded and the Tier-1 sign-off and rules entries are in place. It has one major correctness gap (step versus result modifiers) and a few smaller ones: 0 blockers, 2 major, 4 minor.

## Findings
### F1 — I1 / I3 / I5 — Roll-time mods turn Step penalties into flat result penalties
- **Severity:** major
- **Problem:**
  - `_rollTimeMods` and `ed-roll-modal` `mods` are flat result modifiers, added to the roll total (`rollTotal`).
  - Only Knocked Down is `measure:"result"` (`engine/health.js`).
  - Harried (chip and encumbrance), Darkness, Range Long and Impaired Movement are `measure:"step"` in `rules/combat.json` and `engine/encumbrance.js`. Today the Combat pool applies these to the Step, so they change the dice.
  - The plan's helper returns only `{label,value}`. Routing Harried -2 and the other step penalties through `_rollTimeMods` and the modal silently changes them from Step -2 to Result -2.
  - rules.md R6 says test mods "apply to Step, min Step 1".
  - The plan does not say how a step-measure penalty is applied on a non-Combat roll, so I1, I3 and I5 cannot be implemented unambiguously.
  - Strip-rule point: I3 strips unscoped test mods from the Combat pool so they ride `_rollTimeMods`. Combat Harried would then change from step to result.
- **Fix:**
  - Decide explicitly how step-measure penalties apply at roll time: either fold into the roll's Step before the modal, or add a step-mod path to the modal.
  - Carry `measure` through the helper's output.
  - Keep the Combat pool behaviour identical for Harried, or state the intended change.
  - Add a test that a Harried -2 attack and a Harried -2 Skill roll land at the same Step.
  - If the owner wants result semantics, record it as a `NEEDS_HUMAN` decision or a rules ruling (`NEEDS_RULES`).

### F2 — I3 / I5 — "Unscoped on every roll" widens Harried well beyond current behaviour
- **Severity:** major
- **Problem:** Harried's test penalty is written as "Action tests" in the data and in the encumbrance summary ("−2 to Action test Steps").
  - Today the encumbrance Harried Action -2 is not in the `applyTestMods` fold. It only reaches Combat pools via `conditions.harried`.
  - The plan applies it to every roll except the Karma die, including Initiative, Knockdown, Recovery and spells.
  - R7 supports "tests generally" for Knocked Down. Its support for Harried on non-Action rolls is not evidenced; the cited lines cover the Harried and Knocked Down examples.
  - Nothing in the plan states which `kind`s Harried applies to.
- **Fix:**
  - State the per-`kind` applicability for Harried.
  - Cite R7 lines that cover Harried on non-Action tests, or restrict it to Action tests with a `kind` filter.
  - If the evidence is thin, emit `NEEDS_RULES`: does Harried -2 apply to Initiative, Recovery and Knockdown tests?

### F3 — I1 — Knocked Down representation left open
- **Severity:** minor
- **Problem:** "listed in the set or as the dedicated flag, but folded exactly once" leaves the implementer a choice. That is a double-count risk, because `session.knockedDown` and `session.situations` could both contain it.
- **Fix:** Pick one. For example, keep `knockedDown` as the only source and make the helper and Combat ignore a "Knocked Down" name in `situations`. Add a test for that.

### F4 — I1 / I2 — Surprised and Blindsided stack additively
- **Severity:** minor
- **Problem:** R1 says a fully Surprised target takes Surprised instead of Blindsided. R6 and the owner chose additive with no cap. The plan does not note that Surprised plus Blindsided (-5) differs from the book here.
- **Fix:** Add a one-line note or an owner `Decision` in rules.md R1/R6 acknowledging that this overlap is player-managed, so it is not an undocumented APP-DIFFERS.

### F5 — I5 — Scoped toggles on Combat damage rolls
- **Severity:** minor
- **Problem:** I5 offers scoped toggles on "non-Combat-attack rolls", which includes Combat damage rolls.
  - Damage pools exclude unscoped and scoped Action mods (`appliesToTest`).
  - So Darkness (sight) would be offered on a damage roll, and Range Long (which R5 says applies to damage) would be offered there only as a toggle.
  - The Open question mentions Range Long but does not define the damage-roll behaviour.
- **Fix:** State explicitly what the modal offers on `kind:'damage'` rolls, and test it.

### F6 — I4 — Overview x button
- **Severity:** minor
- **Problem:** I4 is classed Tier 3. A new interactive control in the Overview Active Effects panel touches the UI-GUIDELINES Overview contract, and I6 only updates the Combat row and the Active Effects description.
- **Fix:** Confirm in the guardrail classification that the Overview row change is in-guideline. Otherwise cite the owner's qa-log answer ("Active Effects row per active situation, each with a clear (×) button") as the authorisation.
