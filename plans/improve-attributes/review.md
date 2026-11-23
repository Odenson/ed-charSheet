# Plan Review: Improve attributes (improve-attributes)

## Summary
The plan is sound: all tickets are covered, the cited files and APIs exist, sequencing is valid, every rules claim traces to a rules.md entry (R4 and R5 have recorded Decisions), and no Tier-1 or Tier-2 surface is touched. 3 minor findings, 0 blockers, 0 major.

## Findings
### F1 - I2 - Enumerate the baseline refresh paths concretely
- **Severity:** minor
- **Problem:** I2 says the builder must grep for other character-swap paths. There is a known one: `_reloadSaved` (ed-app ~L2532-2544, the Discard flow). It calls `loadCharacter` and swaps `_character` but does not touch `_savedAttributes`. `_loadCharacter` (L647) and `_doSave` are listed, but `_reloadSaved` is not. Without a refresh there, a stale baseline survives Discard and the one-per-save lock breaks.
- **Fix:** List `_reloadSaved` explicitly in I2 "Where" and acceptance criteria (Discard resets the baseline and clears the pending state). Add a test or manual check for this.

### F2 - I3 - Vague dirty recomputation
- **Severity:** minor
- **Problem:** "`this._dirty = hasPendingEdits(id) || customPending...` (as in L1924)" is imprecise. `_reloadSaved` uses `hasCustomPendingEdits() || hasCustomSkillPendingEdits()` and the undo-to-clean path depends on getting this right.
- **Fix:** State the exact expression the builder must use, and add a manual or unit check that undo-to-clean clears the dirty dot when nothing else is pending.

### F3 - I1 - Unused import
- **Severity:** minor
- **Problem:** I1 imports `attributeIncreaseCost` from `legend-spent.js`, but the approach prices the next single step with a direct `costTable[String(increases+1)]` lookup. The cumulative function is not needed.
- **Fix:** Drop the import, or use it for the cap check (null beyond the table). Also add an I1 test that the module's single-step costs agree with the audit's cumulative `attributeIncreaseCost` differences (800, 1300, 2100).

Verification notes: items I1-I6 are testable with `node:test` (I1, I2, I4, I6). The UI in I5 is correctly flagged for owner browser verification (no-scroll Overview, light/dark, mobile, `.an` line width).
