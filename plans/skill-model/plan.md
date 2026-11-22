---
status: implemented
shipped: unreleased
---
# Delivery Plan: Skill model (skill-model)

## Context & learnings
Edit-mode "+ add skill" (`_learnSkillModal`) lists only plain catalog skills; the Adept creation picker (`_creationSkillModal`) is sectioned, searchable and offers free-text `Knowledge (…)` / `Artisan (…)` rows. Owner decisions (qa-log 2026-11-22): adopt the full creation-style picker in edit mode; pricing stays edit-mode (Rank 1 Novice Legend + editable silver fee seeded from `costs.skillTraining[1]`); Journeyman General skills stay learnable at their tier price; non-goals are Language free-text, rename/edit of existing skills, schema change. Stored shape stays `{name, rank, tier}` with name `Knowledge (<text>)`.

## Discoveries
- `engine/skill-options.js` `learnableSkills(catalog, knownNames, costs)` returns name/tier/attribute/brief/rank1Cost/trainingSilver; no `category`/`generic`; lists every catalog entry not known (so bare generic Knowledge/Artisan and language templates appear as plain rows). Called from `store.js:1683-1687` (`skillOptions`); `known` is an exact-name Set.
- `engine/creation.js` already has the model: `skillBudget().candidates` carries `category`, `generic`, `freeText` (`'knowledge'|'artisan'|null`); language templates skipped (`e.generic && isLanguage(e.category)`); catalog lists Bribery and Skinning twice (dedupe by name); `applySkillAdd` validates text with module-private `MAX_TEXT = 40` and `/[()]/`, trims, refuses case-insensitive duplicates. `isLanguage` is a creation.js helper (check export status when implementing).
- `ui/ed-disciplines.js`: `_creationTextRow`, `_creationSkillCandidate`, `_creationSkillModal` (lines ~589-666) use `_creationText`, `_creationSearch`, `_poolBadge`; edit picker `_learnSkillModal` (~1415) has fee input (`data-enter="local"`), purse/Legend checks, `_learnSkillPick(name)` dispatching `ed-learn-skill {name, silver}`; `_openSkillLearnModal` (~784) seeds `_skillSilver`/`_skillSearch`. Modal kind `learn-skill: 'picker'` in `DISC_KIND`.
- `ui/ed-app.js:1667` `_learnSkill({name, silver})`: duplicate check, catalog lookup, tier -> label, silver guard `payFromPurse`, `_canAffordRank`, persist, `logSkillLearned({name,...})`.
- `store.js:849` provides `resolveSkill: makeSkillRef(skillsFile)` for stored names (confirm `Knowledge (X)` resolves to the generic entry; creation already stores such names).

## Guardrail classification
All items Tier 3 (per tickets.md Guardrail alignment): no schema shape change, engine remains pure/DOM-free, no taxonomy change. UI must still honor Tier-1 UI rules (modal kit, Escape/Enter, light/dark, no hardcoded colours). No Tier-1 items, so no sign-off needed.

## Rules dependencies
- R1 (rules.md) ANSWERED: subject player-named, GM-approved; not tracked in app.
- R2 ANSWERED: Knowledge/Artisan Novice; Rank 1 = 200 LP Novice / 300 Journeyman, 10 sp fee.
- R3 ANSWERED: languages are per-language catalog entries, no free text.
- R4 ANSWERED: multiple Knowledge subjects allowed, no cap.
No open NEEDS_RULES.

## Implementation items
### I1 — Engine: shared stored-name resolver
- **Covers tickets:** T1
- **Rules:** R1, R3, R4
- **Tier:** 3
- **What:** Add a pure `resolveSkillName(catalogEntry, text, existingNames)` returning `{ok:true, storedName}` or `{ok:false, reason}` with reasons `unknown-skill`, `generic-not-allowed` (language template), `bad-text` (trim, 1-40 chars, no parentheses) and `duplicate` (case-insensitive against existing names). It owns the generic check, the language gate and the `Name (text)` composition; a non-generic entry returns its own name (duplicate-checked, case-insensitively).
- **Where:** `engine/skill-options.js` (no imports today). Decision: the helper lives here; `engine/creation.js` imports it (no cycle). Export `MAX_TEXT` and `isLanguage` from skill-options.js and remove creation.js's private copies (creation.js:309, :416). Refactor `applySkillAdd` and I2 to use it; creation keeps its refusal codes.
- **Dependencies:** none
- **Acceptance criteria:** Creation tests unchanged and green; tests for trim, length 40/41, parentheses, empty, language-template refusal, non-generic passthrough and case-insensitive duplicate (`knowledge (x)` vs `Knowledge (X)`).
- **Risks / unknowns:** none significant.

### I2 — Engine: learnableSkills exposes categories and free-text candidates
- **Covers tickets:** T1
- **Rules:** R2, R3, R4
- **Tier:** 3
- **What:** Extend each `learnableSkills` entry with `category`, `generic`, `freeText`; skip generic language templates; bare generic Knowledge/Artisan appear as one free-text candidate each (never as a plain stored name, and never filtered by `known`, so multiple subjects can be added); dedupe duplicate catalog names; keep tier ordering and pricing fields (Rank 1 from the entry's tier, Journeyman kept).
- **Where:** `engine/skill-options.js`; `engine/skill-options.test.js`; `store.js:1683` (pass known names, case-insensitively comparable).
- **Approach:** Mirror the `skillBudget` candidate logic (creation.js:394-412) minus pools and the Novice-only gate. Sorting: keep Novice-first/alpha within the picker data; UI groups by category.
- **Dependencies:** I1 (optional)
- **Acceptance criteria:** Knowledge/Artisan have `freeText` 'knowledge'/'artisan'; language templates absent, per-language entries present; existing tests adjusted for the new fields and still pass; a known `Knowledge (X)` does not hide the free-text row. The `known` filter is skipped only for generic free-text entries; tests: a known ordinary skill (and known per-language entry) is hidden, Bribery/Skinning duplicate catalog names appear once, Journeyman entries are retained with the correct Rank-1 Journeyman cost. The `known` comparison is case-insensitive.
- **Risks / unknowns:** existing tests asserting bare Knowledge/Artisan are listed plainly need updating; `_addSkillSlot` "No skills left to learn" logic still correct (free-text rows keep it non-empty).

### I3 — Learn flow accepts free text
- **Covers tickets:** T2
- **Rules:** R1, R2
- **Tier:** 3
- **What:** `ed-learn-skill` detail gains optional `text`. A mandatory pure engine function `learnSkillPlan({name, text, silver, character, catalog, costs, coins})` (in `engine/skill-options.js`) returns `{ok, skill, tier, legendCost, trainingFee}` or a refusal reason. It uses the I1 resolver (generic and language gate, name composition, case-insensitive duplicate), catalog tier (Novice for Knowledge/Artisan), silver purse check and Legend affordability. `_learnSkill` stays thin: call the plan, then persist and log the full stored name.
- **Where:** `engine/skill-options.js` (+ `skill-options.test.js`); `ui/ed-app.js` `_learnSkill` (~1667-1709) replaces its exact `s.name === name` duplicate check (case-sensitive today) with the plan's case-insensitive one; `ui/ed-disciplines.js` `_learnSkillPick(name, text)`.
- **Approach:** Move guard logic out of ed-app.js into the plan; refusals return before any state change. Tier/Legend via `skillRankStepCost`/`costs`; silver via `payFromPurse` (already in an engine-reachable module; confirm import).
- **Dependencies:** I1
- **Acceptance criteria:** `node:test` tests for `learnSkillPlan`: `Knowledge (Barsaive History)` yields `{rank 1, tier Novice}`, correct Legend and silver; bad text, duplicate (including `knowledge (x)` vs `Knowledge (X)`), unknown skill, language template, insufficient silver and insufficient Legend each refuse and the plan reports no change; Journeyman General skill priced at Journeyman. Thin `_learnSkill` wiring verified manually (I4 checklist).
- **Risks / unknowns:** `_canAffordRank` is a UI-side method; the plan must obtain Legend availability from inputs (or the plan returns `legendCost` and `_learnSkill` keeps `_canAffordRank`). Pick whichever keeps behavior identical.

### I4 — Creation-style edit picker UI
- **Covers tickets:** T3
- **Rules:** R3
- **Tier:** 3
- **What:** Rework `_learnSkillModal` into sections (Knowledge, Artisan, Speak Language, Read/Write Language, General), free-text rows with Add and Enter-in-field (`data-enter="local"`), search, retained fee input and Legend/silver affordability checks and cost labels; no pool badges.
- **Where:** `ui/ed-disciplines.js` (`_learnSkillModal`, `_openSkillLearnModal` to reset `_learnText` state, `_learnSkillPick`); factor shared row rendering with `_creationTextRow` / `_creationSkillCandidate` where practical (parameterise badge/affordability) without changing creation behavior.
- **Approach:** Reuse the section-building from `_creationSkillModal`; free-text Add disabled when text empty or Legend/silver unaffordable; counts line kept. Use `modalFrame`/`ui/kit` only; existing classes (`.ftrow`, `.lopt`, `.hmopts`, `.searchin`) are theme-aware.
- **Dependencies:** I2, I3
- **Acceptance criteria:** UI-kit check passes; node tests green. Owner manual-verification checklist (not coverable by node:test): Escape closes the picker; Enter activates the focused option; Enter in a free-text field adds when affordable; Enter in the fee input does not submit the modal; light and dark mode; search filters; Add disabled when empty text or unaffordable; creation picker behaves as before.
- **Risks / unknowns:** shared-render refactor could regress creation picker; if risky, duplicate minimally and note it.

### I5 — Tests and docs
- **Covers tickets:** T1, T2, T3
- **Rules:** none
- **Tier:** 3
- **What:** Run `npm test` (incl. UI-kit check); update docs mentioning the edit picker (grep `PLAN-LEARN-SKILLS`, docs for "learn a new skill") and changelog entry if the repo convention requires.
- **Where:** `engine/*.test.js`, docs.
- **Dependencies:** I1-I4
- **Acceptance criteria:** all tests green.

## Sequencing
I1 (shared validation) -> I2 (candidates data) -> I3 (learn flow) -> I4 (UI) -> I5. Engine first so the UI stays dumb and each step is testable.

## Open questions
None. (`makeSkillRef` resolves the exact name then the bracket-stripped base; covered by `store-creation-audit.test.js:468`.)

## Review responses
- F1 — fixed: I1 now takes the catalog entry, owns generic/language gate and name composition; `isLanguage`/`MAX_TEXT` exported from skill-options.js; `applySkillAdd` and I2 use it.
- F2 — fixed: pure `learnSkillPlan` is mandatory in I3 with node:test tests.
- F3 — fixed: case-insensitive duplicate check in the plan, `_learnSkill` and the `known` filter, with tests.
- F4 — fixed: helper lives in skill-options.js; creation.js imports it.
- F5 — fixed: I2 acceptance adds known-hidden, dedupe and Journeyman tests.
- F6 — fixed: open question closed; manual verification checklist added to I4.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
