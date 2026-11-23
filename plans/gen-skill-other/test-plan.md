# Test Plan: Custom skills and picker filters (gen-skill-other)

## Test files
- engine/validate-skill.test.js
- store-custom-skills.test.js
- store-custom-skills-catalog.test.js
- tools/homebrew-custom-skills-data.test.js
- tools/worker/worker-skills.test.js
- tools/dev-server-skills.test.js
- tools/fold-custom-skills.test.js
- ui/skill-filter.test.js
- ui/custom-skill-state.test.js

## Coverage
### engine/validate-skill.test.js (26 cases)
- **Validates:** I1 — name (empty, 40/41 chars, parentheses, key == skill.name), case-insensitive uniqueness vs core (incl. generic Knowledge/Artisan) and custom names, attribute in list, category in kinds, tier per kind, strain 0, custom === true, summary <= 500, unknown keys rejected, options-absent skips checks, no mutation; `validateSkillsFile` schema/array/entries/duplicates/core collision.
- **Rule:** R1 (Knowledge/Artisan Novice, Strain 0), R4 (General Novice/Journeyman, owner attribute)
- **Why:** the validator gates UI, worker and fold; a hole here lets junk reach `rules/`.

### store-custom-skills.test.js (17)
- **Validates:** I3 — `saveCustomSkills` (POST `{skills}`, key header, endpoint override, no_key, typed worker errors incl. `invalid_skills`, offline); `ed-custom-skills` overlay round-trip/net-empty/corrupt; `applyCustomSkillEdits` upsert, no mutation, null delta; `isSkillsReflected` (equal vs lagged read).
- **Rule:** n/a
- **Why:** overlay/reconcile bugs lose or duplicate created skills.
- **Assumption:** `isSkillsReflected(savedMap, committedSkillsArray)` takes the committed file's `skills` array.

### store-custom-skills-catalog.test.js (20)
- **Validates:** I2/I6 — `mergeSkillCatalog` (identity when no custom, core refs kept, core wins collisions case-insensitively); `custom: true` only on custom in `learnableSkills`, creation candidates, `model.skills`, `skillOptions`; Journeyman custom General not offered at creation; `creationContext` catalog/resolver; deriveModel Step = Rank + attribute Step, description, unknown-skill degrade, stored shape untouched; `skills.allowCustom` registry + strict `=== true` gate; existing custom skills still resolve when toggle off.
- **Rule:** R2 (costs read from legend.json, not hard-coded), R3 (Step), R4 (Journeyman General)
- **Why:** guards the "existing tests unchanged / no `custom:false`" invariant and the gate strictness.

### tools/homebrew-custom-skills-data.test.js (3)
- **Validates:** I6 data — `hb-custom-skills` ships enabled with `set {skills.allowCustom: true}`, summary/note/overrides, `source` prose mentions the target; bundled `rules/custom-skills.json` is empty `ed-skills/1`.
- **Rule:** R4
- **Why:** shipped data matches the owner decision.

### tools/worker/worker-skills.test.js (13)
- **Validates:** I4 — upsert + whole-file PUT with message `Save custom skills (serverless)`, replace-by-name, 404 first save, 400 `invalid_skills` (bad attribute, core/case/template collisions, parens, tier, unknown key, malformed, no PUT), custom collision, fail-closed auth, envelope separation from /save and /save-items, `GITHUB_SKILLS_PATH`, 409 retry/bounded conflict, 403 -> 502, CORS preflight.
- **Rule:** n/a
- **Why:** public endpoint; attribute/core checks are mandatory server-side (review F1).

### tools/dev-server-skills.test.js (5)
- **Validates:** I4 parity — create/merge/replace, `invalid_skills` 400 with file untouched, envelope required, 404 hint lists `/save-skills`.
- **Why:** local dev must mirror the worker.

### tools/fold-custom-skills.test.js (14)
- **Validates:** I5 — pure `foldSkills` (keep valid, drop invalid with name+errors, no mutation); `foldCustomSkills(env)` 404 no-op, create, update, identical no-PUT, invalid entries dropped + issue + valid still folded, bad JSON / wrong schema abort, 409 retry and bounded failure, env guard, upstream 500 issue.
- **Why:** one bad entry must not block later folds; file-level failures must not reach `dev`.
- **Assumption:** export name `foldCustomSkills` (mirror of `foldCustomItems`) plus `foldSkills`; core names/attributes may come from the checkout or contents API (mock serves both).

### ui/skill-filter.test.js (8)
- **Validates:** I7 — `SKILL_CHIPS` ids/labels/order, `chipMatches` for all/category/general/custom, quick-add rows hidden under Custom, no mutation.
- **Why:** both pickers share this helper; drift breaks filtering.

### ui/custom-skill-state.test.js (13)
- **Validates:** I8a — `initialForm` prefill from the passed template attribute (Knowledge/Artisan) vs empty General, `setField` purity, `formErrors` (delegates to validator; "Choose an attribute"), `toSkill` trimming/custom/strain/summary-omitted/tier forcing and validator-clean output.
- **Rule:** R1, R4
- **Assumption:** `attributes` is an array of names; `formErrors(form, validateSkill-opts)`.

## Not covered (and why)
No browser harness, so UI is for the owner to check by hand in light AND dark (spec "Testability notes" checklist): (1) chip row in learn picker and Adept creation picker — each chip filters, Custom lists only custom skills, search combines, keyboard Tab/Space/Enter toggles, counter correct; (2) per-section Create button only when the homebrew rule is on; (3) form: Knowledge/Artisan prefilled and fixed Novice, General shows tier and requires attribute, inline errors, Escape closes only the form, Enter confirms (not in textarea), focus returns; (4) created skill appears at once, tagged Custom, selectable, correct cost/step; (5) Custom badge in picker rows, skills list row and detail modal, absent on core skills, no-description text; (6) reload keeps the skill, save dot/prompt with both overlays; (7) Overview unaffected. Also manual: worker redeploy and the fold workflow on `character-data`; `loadCustomSkills` network fallbacks (I2b) and `ed-app.js` wiring are not unit-tested. `npm test` also runs `rules-conformance`, `check-imports`, `check-ui-kit`, `plans-status`.

## How to run
`npm test`
