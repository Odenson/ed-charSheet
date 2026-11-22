# Tech Spec: Skill model (skill-model)

## Overview
Make the edit-mode "+ add skill" picker creation-style: sections, search, and free-text `Knowledge (<text>)` / `Artisan (<text>)` rows, while keeping edit-mode pricing (Novice Rank 1 Legend plus an editable silver fee). A shared pure resolver (`resolveSkillName`) and a pure `learnSkillPlan` live in `engine/skill-options.js`. `learnableSkills` gains `category/generic/freeText`. `_learnSkill` becomes thin. No schema change: stored shape stays `{name, rank, tier}`.

## Guardrail alignment
All items Tier 3 (new data fitting the schema, new view content, in-guideline styling). No Tier-1 sign-off needed. Data-down/dispatch-up holds (`ed-learn-skill` event gains optional `text`). Engine stays pure and DOM-free (skill-options.js will import only `wealth.js` and `legend-spent.js`, neither of which imports anything, so there is no cycle). Only inputs are stored (the skill row). Derived values (Rank-1 cost, silver preview) stay computed. The creation picker behavior must not change. Modals use `ui/kit` (Escape/Enter), theme-aware classes only.

## Design
### Data / types
None stored. `learnableSkills` entries gain `category: string|null`, `generic: boolean`, `freeText: 'knowledge'|'artisan'|null`.

### Modules & functions
**`engine/skill-options.js`**
- `export const MAX_TEXT = 40;` and `export const isLanguage = (category) => category === 'language-speak' || category === 'language-readwrite';` (moved from creation.js).
- `resolveSkillName(entry, text, existingNames) -> {ok:true, storedName} | {ok:false, reason}`.
  - Order: no entry -> `unknown-skill`. If `entry.generic`: language category -> `generic-not-allowed`; text trimmed, empty/longer than MAX_TEXT/contains `(` or `)` -> `bad-text`; storedName = `${entry.name} (${t})`. If not generic: storedName = `entry.name` (text ignored).
  - Then case-insensitive duplicate against `existingNames` (iterable of strings) -> `duplicate`.
- `learnableSkills(catalog, knownNames, costs)`: dedupe by name (first wins); skip `generic && isLanguage(category)`; `known` filter compares lowercased and is skipped only when `generic` (so Knowledge/Artisan free-text rows always remain); add `category/generic/freeText` (freeText as in creation.js:405). Keep existing fields and Novice-then-Journeyman, alpha ordering. Journeyman General skills retained with their Journeyman rank1Cost.
- `learnSkillPlan({name, text, silver, character, catalog, costs, coins})` -> `{ok:true, skill:{name,rank:1,tier}, tier, legendCost, trainingFee, coins}` or `{ok:false, reason}`.
  - Steps: find entry by `name` in `catalog` (else `unknown-skill`); `resolveSkillName(entry, text, character.skills names)`; tier label = `entry.tier === 2 ? 'Journeyman' : 'Novice'`; `trainingFee` = `Number(silver)` finite and >= 0 ? `Math.round` : 0; if fee > 0, `payFromPurse(coins, fee)`, not ok -> `insufficient-silver`, else `coins` = result coins (else coins unchanged); `legendCost = skillRankStepCost({tier}, costs, 1)`.
  - It performs no state change and no Legend affordability check.

**Decision (plan risk I3): Legend affordability stays UI-side.** `_canAffordRank` depends on `this._legendTotalEarnt` and `this._model.legendAuditOptions` (audit options), which are app state, not available to a pure function without duplicating the audit wiring. The plan returns `legendCost` and the new skill; `_learnSkill` builds `nextCharacter` from the plan and calls `this._canAffordRank(nextCharacter)` exactly as today, immediately before any state mutation. Behavior is therefore identical. The tests for "insufficient Legend" are therefore not on the plan; the plan test asserts the correct `legendCost` (and manual checklist covers the Legend guard).

**`engine/creation.js`**: `import { MAX_TEXT, isLanguage, resolveSkillName } from './skill-options.js'`; delete private `isLanguage` (:309) and `MAX_TEXT` (:416). `applySkillAdd` calls `resolveSkillName(catalogEntry, text, character.skills names)` and maps reasons 1:1 to existing `refuse` codes (`unknown-skill`, `generic-not-allowed`, `bad-text`, `duplicate`). The `tier-not-novice` check stays between name resolution and the duplicate check as today: preserve the existing refusal precedence (generic/text, then tier, then duplicate). If `resolveSkillName` applying the duplicate check first would change precedence for a general Journeyman duplicate, apply tier check before calling resolver for non-generic entries. Creation tests must remain unchanged and green.

**`store.js:1683`**: `skillOptions` passes `known` as the set of stored names (lowercasing is done inside `learnableSkills`).

**`ui/ed-app.js` `_learnSkill({name, text, silver})`**: guard `_character`/`name`; `const plan = learnSkillPlan({name, text, silver, character: this._character, catalog: this._rules?.skillsFile?.skills ?? [], costs: this._rules.legendFile?.costs, coins: this._character.wealth?.coins ?? {}})`; `if (!plan.ok) return`. Build `nextCharacter` (wealth coins updated only when fee > 0, skills appended with `plan.skill`); `if (!this._canAffordRank(nextCharacter)) return;` then persist (`saveAdvancementEdits`, `saveWealthEdits` if fee > 0), `_markDirty`, re-derive, `logSkillLearned` with `name: plan.skill.name`, `tier`, `legendCost: plan.legendCost`, `silverFee`, before/after coins. Remove now-unused imports only if unused elsewhere.

**`ui/ed-disciplines.js`**: `_learnSkillPick(name, text)` dispatches `ed-learn-skill {name, text, silver}`; `_openSkillLearnModal` also resets learn-text state (e.g. `_learnText = {}`); `_learnSkillModal` reworked (see UI).

### UI / behavior
- `_learnSkillModal` builds sections from `skillOptions` by `category`: Knowledge, Artisan, Speak Language, Read/Write Language, General (same section grouping as `_creationSkillModal`, ui/ed-disciplines.js ~589-666). Reuse/parameterise `_creationTextRow` and `_creationSkillCandidate` (no pool badge; show Rank-1 Legend cost, tier label). If a shared refactor risks the creation picker, duplicate minimally instead and note it.
- Free-text rows: input (`data-enter="local"`, maxlength MAX_TEXT) plus Add; Enter in the field adds when affordable. Add disabled when trimmed text is empty or Legend/silver unaffordable (same checks as today's modal: purse and Legend preview). Plain rows behave as today.
- Search input filters rows (`_skillSearch`); counts line kept; fee input retained with `data-enter="local"` (Enter does not submit the modal). Empty-state: "No skills left to learn" only when no rows remain (free-text rows keep it non-empty).
- Modal via `modalFrame`/`ui/kit`; Escape closes, Enter activates focused option; uses `.ftrow`, `.lopt`, `.hmopts`, `.searchin`; no hardcoded colours; light and dark must both be checked. Overview viewport fit not affected.

### Rules
| Rule | Value | rules.md id |
|---|---|---|
| Knowledge/Artisan subject is player-named, GM-approved (not tracked) | stored as `Knowledge (<text>)` | R1 |
| Knowledge/Artisan are Novice skills; Rank 1 cost | 200 LP Novice / 300 LP Journeyman; training fee default 10 sp (`costs.skillTraining[1]`, editable) | R2 |
| Languages are per-language catalog entries; no free text | templates not offered | R3 |
| Multiple Knowledge/Artisan skills allowed, no cap | free-text rows never hidden by `known` | R4 |

Tests take expected Legend values from `rules/legend.json` costs (`skillRank['1']`), not literals beyond the above.

### Edge cases & invariants
- Text: trimmed; 40 ok, 41 bad; `(` / `)` bad; empty/whitespace bad.
- Duplicate is case-insensitive everywhere (`knowledge (x)` vs `Knowledge (X)`): resolver, plan, `learnableSkills` known filter.
- Bribery/Skinning appear once. Language templates never listed or learnable; per-language entries are, and are hidden once known.
- A refusal leaves character, purse and log untouched (plan is pure; `_learnSkill` returns before mutating).
- Journeyman General skills stay learnable at Journeyman price.
- Negative/non-numeric silver -> fee 0 (as today).
- `makeSkillRef` already resolves `Knowledge (X)`.

## Testability notes
node:test in `engine/skill-options.test.js` (adjust existing tests for new fields and the bare Knowledge/Artisan change):
- `resolveSkillName`: trim, 40/41, parentheses, empty, language template refused, non-generic passthrough (text ignored), unknown entry, case-insensitive duplicate.
- `learnableSkills`: freeText values; language templates absent, per-language present; known ordinary skill and per-language entry hidden (case-insensitive); known `Knowledge (X)` does not hide the free-text row; Bribery/Skinning once; Journeyman retained with Journeyman rank1Cost.
- `learnSkillPlan`: `Knowledge (Barsaive History)` -> rank 1, Novice, correct `legendCost`, fee; bad text, duplicate (case-insensitive), unknown, language template, insufficient silver each `{ok:false}`; Journeyman General priced Journeyman; silver coins output equals `payFromPurse`.
- Creation tests (`engine/creation*.test.js`, `store-creation-audit.test.js`) unchanged and green; run `npm test` including the UI-kit check.
Manual (owner): Escape closes; Enter activates focused option; Enter in free-text field adds when affordable; Enter in fee input does not submit; light and dark; search filters; Add disabled for empty text or unaffordable (Legend and silver); adding when Legend insufficient is blocked (the `_canAffordRank` guard); creation picker unchanged; log entry shows full `Knowledge (<text>)` name.

## Changelog entry
{"type": "improved", "text": "Adding a skill in edit mode now uses the creation-style picker with sections, search and free-text Knowledge and Artisan skills."}

## Out of scope
Language free-text, renaming/editing existing skills, schema change, pool/budget badges in edit mode, tracking GM approval of subjects. Docs (I5): grep `PLAN-LEARN-SKILLS` and learn-a-skill mentions and update them.
