# Plan Review: Roll knacks (roll-knacks)

## Summary
The plan is well grounded. The cited files, lines and patterns exist, every ticket is covered, and every rules claim traces to `rules.md`, with owner decisions recorded for R2, R5 and R8. There are no blockers and no Tier-1 or Tier-2 problems. I found 5 findings, 2 major and 3 minor. The major ones are an inconsistent step derivation in I2 and an ordinary-roll Strain commit point that quietly differs from the owner's "Escape costs nothing".

## Findings
### F1 — I2 — Step derivation is specified two contradictory ways
- **Severity:** major
- **Problem:**
  - The Approach says `step = talentStep(attrStep, parentRank)` and then adds the parent's step-measure bonus.
  - The Risks section says to use `parent.step - parentAttrStep + knackAttrStep`, falling back to `talentStep` when the parent has no attribute.
  - Neither says where the "step-measure bonus" comes from. `abilityTestMods` is a local closure that is not exposed, and the folded `stepBonus` is not stored on the talent. Only `stepBase` and `rollMods` are.
  - The swap approach also copies anything else folded into the parent's step. That includes rank grants and any future parent-only adjustment.
  - Acceptance tests are phrased for the first approach ("parent step-mod adds to the knack's step").
  - The implementer is told to "pick whichever", so the tests do not pin one behavior.
- **Fix:**
  - Choose one derivation in the plan.
  - Recommended: `parent.step - parentAttrStep + knackAttrStep` (which equals `talentStep(knackAttrStep, rank)` plus the parent's folded step mods and rank grants). If the parent has no attribute, use `talentStep(knackAttrStep, rank)` plus the sum of `rollMods` whose measure is `step`.
  - State how the parent's attribute step is obtained: `t.attribute` is available on the talent object at store.js ~926.
  - Add acceptance tests for both a stepped parent and a rank-granted parent.

### F2 — I4 — Ordinary-roll Strain is charged when the modal opens, not at a deferred commit
- **Severity:** major
- **Problem:**
  - The owner answered "at roll commit... Escape before rolling costs nothing".
  - T3 (the ticket) says the same, and its open question assigned the planner to confirm the commit point.
  - The plan confirms that an ordinary modal auto-rolls in `updated()`. That means Strain is charged at button click, and Escape cannot avoid it. This is effectively the "on button click" option the owner declined.
  - It is documented only as an Open question and a release-notes remark. The ticket text, "(Escape before rolling costs nothing)", is now false for ordinary rolls.
  - The behavior is technically sound, since I verified `_roll()` is called from `updated()` at ed-roll-modal.js:150, but the owner has not ratified it.
- **Fix:**
  - Get an explicit owner ack of "charged when the modal opens" for ordinary talent and knack rolls, or change the design to defer ordinary Strain rolls behind a commit step.
  - Correct T3's wording either way.
  - Record the owner's answer in qa-log.md.

### F3 — I3 / I4 / Sequencing — Circular dependency declaration
- **Severity:** minor
- **Problem:** I3 lists "Dependencies: I2, plus I4", and I4 lists "Dependencies: I2, I3". Sequencing then says to build I4 first. I4 also edits `_rollDetail` and the knack roll pass-through in `ed-disciplines.js`, which is I3's file and surface.
- **Fix:**
  - Make I4 depend on I2 only. Its knack part consumes `k.roll.strain` from I2.
  - Keep I3 depending on I2 and I4.
  - Alternatively, merge the shared `ed-disciplines.js` edits into one item, since the plan already says they can be built in one change.

### F4 — I1 / I7 — Stale `attribute` contract in code and docs
- **Severity:** minor
- **Problem:**
  - The `store.js` comment at ~113-119 documents `attribute` as "Structured mechanics for a knack that grants a combat option... Null for the vast majority of knacks".
  - After I1, 100 of 145 knacks carry `attribute`.
  - The plan only proposes an optional `notes` line in `knacks.json` and a vague "note the attribute convention" in I7. The `store.js` comment is not scoped.
  - I verified the combat path is not affected: `knackOptions` and combat options are gated on `combatOptions`/`arms`, and only Anticipate Spell has them.
- **Fix:**
  - Add updating the `resolveKnack` comment (store.js ~113-119) to I2.
  - Make the `knacks.json` `notes` line mandatory in I1, not optional.
  - Add an acceptance check that combat knack options are unchanged. I2 already lists this.

### F5 — I2 / I4 — Testability of the charge and button logic
- **Severity:** minor
- **Problem:**
  - Strain-once-per-`stepRow` (in `ed-roll-modal.js`) and the `_rollDetail` pass-through have no unit seam, so the key I4 acceptance criteria ("Karma toggle or Step-mod toggle does not re-charge", "no double charge on aim or set-dice") are manual-only.
  - The plan says only "add a test if a seam exists", and the helper in I2 is "optional".
- **Fix:**
  - Make the pure `knackRoll()` helper required, so the step, strain and karma logic is covered by `node:test`.
  - List the I4 charge cases (open once, Karma toggle, Step-mod toggle, aim, set-dice, Strain 0) explicitly as owner manual-verification items in I7.

## Notes (not findings)
- The scan I ran confirms the plan's data claims. There are 145 knacks, of which 100 have a `Rank+ATTR` or `CHA+Rank` step. Among those 100, only Swinging Move and Take the Hit have a non-plain strain. Only Anticipate Spell has `attribute` today. Both knack summaries already mention the extra Strain.
- The Disciplines-tab `karmaCtx` carries no `rank`, so ordinary knack and talent rolls will not be treated as set-dice (`_isSetDice` is `karma?.rank != null`). I3 must mirror that, with no `rank` in the knack Karma context.
- Only `ed-combat.js` passes a non-zero `strain` today, and only for set-dice. Ordinary combat rolls pass 0, so the new ordinary-roll charge cannot double charge them.
- Take the Hit's "2 Strain" printed in its text is an optional redirect cost. Normalizing it to "2" means every Take the Hit test charges 2. That is within the owner's R8 ruling, so no finding, but it is worth stating in the release notes.

NEEDS_HUMAN: Ordinary (auto-rolled) talent and knack roll modals commit the instant they open, so the Strain is charged at button click and Escape cannot avoid it. That differs from your answer "Escape before rolling costs nothing", which still holds for set-dice and aim rolls. Do you accept that, or should ordinary Strain-bearing rolls wait for a commit step?
