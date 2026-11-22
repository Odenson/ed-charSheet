# Plan Review: Skill model (skill-model)

## Summary
Plan is broadly sound, Tier-3 classification and rules grounding hold (R1-R4 all ANSWERED, no Decisions needed). 6 findings: 0 blockers, 3 major, 3 minor.

## Findings
### F1 — I1/I3 — Helper does not cover generic/language gating or name composition
- **Severity:** major
- **Problem:** I1's `resolveFreeTextName(baseName, text, existingNames)` only validates text and duplicates. I3 says "generic entries only; language templates refused" and "the UI file does not compute rules", but no engine function owns the catalog lookup, the generic check, the language-template refusal (`generic-not-allowed`, today in `applySkillAdd`, creation.js:431), or the `Name (text)` composition. `isLanguage` is module-private in creation.js (line 309), and I2 also needs it.
- **Fix:** Make the engine function take the catalog entry (or catalog plus name) and return `{ok, storedName}` or a refusal reason. It must include the generic and language gate. Export or move `isLanguage` to the shared module. Have both `applySkillAdd` and I2 use it.

### F2 — I3 — Pure `learnSkillPlan` is optional but required for testability
- **Severity:** major
- **Problem:** `ed-app.js` has no unit tests. I3's acceptance (refusals leave state unchanged, correct stored shape, Legend/silver deducted) is only testable if the guard logic is extracted. The plan leaves this as "consider".
- **Fix:** Make a pure engine `learnSkillPlan` (name, text, silver, character, catalog, costs, coins -> `{ok, skill, tier, legendCost, trainingFee}` or refusal) a mandatory part of I3 with `node:test` tests. `_learnSkill` stays thin.

### F3 — I3 — Duplicate check is case-sensitive today
- **Severity:** major
- **Problem:** `_learnSkill` (ed-app.js:1669) uses exact `s.name === name`. The plan wants case-insensitive refusal but never says to change this check. Without the change, `knowledge (x)` and `Knowledge (X)` could both be stored. The same applies to the `known` Set in `learnableSkills` and `store.js:1683`.
- **Fix:** State explicitly that the duplicate check in `_learnSkill`/plan uses the I1 helper's case-insensitive comparison. Add a test for it.

### F4 — I1 — Import direction left undecided
- **Severity:** minor
- **Problem:** "pick one direction" is unresolved. `creation.js` imports `talent-options.js` only, and `skill-options.js` has no imports.
- **Fix:** Decide now: shared helper lives in `skill-options.js` (no imports). `creation.js` imports it, so there is no cycle. Export `MAX_TEXT` and `isLanguage` from there.

### F5 — I2 — Plain-name `known` filter vs. generic rows, and Journeyman language edge
- **Severity:** minor
- **Problem:** I2 must skip the `known` filter only for generic free-text entries. Per-language entries and ordinary entries must still be hidden once known. The plan says "never filtered by known" for generics, which is fine, but the acceptance criteria don't test that ordinary known names stay hidden. The dedupe of Bribery/Skinning by name also has no stated test.
- **Fix:** Add tests for these cases: known ordinary skill hidden, duplicate catalog names appear once, Journeyman entries retained with a correct Rank-1 cost.

### F6 — Open questions — Already resolvable
- **Severity:** minor
- **Problem:** The open question about `Knowledge (X)` resolving through `makeSkillRef` is answered: `store.makeSkillRef` resolves the exact name, then the bracket-stripped base, and `store-creation-audit.test.js:468` covers it. UI manual verification is also not called out. The picker, modal Escape/Enter, light/dark and fee-input behavior cannot be covered by `node:test`.
- **Fix:** Close the open question. Add an owner manual-verification checklist to I4 (Escape, Enter in the free-text field, light/dark, fee Enter, creation picker unchanged). Run the UI-kit check as stated.
