# Tech Spec: Custom skills and picker filters (gen-skill-other)

## Overview
Add owner-created Knowledge/Artisan/General skills as catalog entries held in a shared rules file (`rules/custom-skills.json`, schema `ed-skills/1`), persisted exactly like custom items (`/save-skills` worker route -> `data/custom-skills.json` on `character-data` -> CI fold). A pure `mergeSkillCatalog` feeds the merged catalog to every consumer of `rules.skillsFile.skills`; entries carry `custom: true`, which flows to picker options, creation candidates and `model.skills`. Both skill pickers gain category filter chips (pure helper `ui/skill-filter.js`), and creation is gated by a new homebrew boolean `skills.allowCustom`. The stored character skill `{name, rank, tier}` is unchanged.

## Guardrail alignment
- All items Tier 3 (plan "Guardrail classification"; qa-log 2026-11-22). No Tier 1 sign-off needed.
- Stored shape untouched; no derived value stored; custom skills are catalog data, not character data.
- Engine stays pure and DOM-free: `engine/validate-skill.js`, `mergeSkillCatalog`, `ui/skill-filter.js` and `ui/custom-skill-state.js` are pure. UI never computes game values: step/cost come from `deriveModel`/`learnableSkills`. Data flows down via props; the form dispatches `ed-create-custom-skill` up to `ed-app.js`.
- `rules/custom-skills.json` reuses `ed-skills/1`; no taxonomy change (entries carry no `effects`). Homebrew target is a registry addition (code + doc), not an `ed-homebrew/3` format change.
- Stop-and-ask triggers: a new top-level homebrew lever, or any stored-field addition (Tier 1).
- Operational: owner must redeploy the worker and ensure `fold-custom-skills.yml` exists on `character-data`.

## Design

### Data / types
- Custom skill entry (file and catalog): `{ name, tier: 1|2, category: 'knowledge'|'artisan'|'general', strain: 0, attribute: <Attribute name>, summary?: string, custom: true }`. No `action`/`versus`/`effects`/`presentation`; no `artisanKey`.
- `rules/custom-skills.json` (new, bundled empty): `{"schema":"ed-skills/1","source":"custom","notes":"Owner-created skills, folded from data/custom-skills.json by CI.","skills":[]}`.
- Delta/overlay (localStorage key `ed-custom-skills`): `{ skills: { [name]: <skill entry> } }`; no delete.
- Worker body: `POST /save-skills { skills: { [name]: skill } }`. Stored file `data/custom-skills.json` is the same shape as the rules file (array under `skills`).
- Homebrew: new set target `'skills.allowCustom'` (boolean); `model.customSkills = { enabled: boolean }` (strict `=== true`).
- Optional field on derived rows only (added only when true, never `custom:false`): `learnableSkills` option `.custom`, creation `candidates[].custom`, `model.skills[].custom`.

### Modules & functions
I1 (`engine/validate-skill.js`, `engine/validate-skill.test.js`)
- `export const SKILL_KINDS = ['knowledge','artisan','general']; export const MAX_DESCRIPTION = 500;`
- `validateSkill(name, skill, { coreNames, attributeNames, customNames } = {}) -> { ok: boolean, errors: string[] }`. `name` trimmed non-empty, `<= MAX_TEXT` (import from `./skill-options.js`), no `(`/`)`; `name === skill.name`; unique case-insensitively vs `coreNames` (incl. generic template names, e.g. `Knowledge`/`Artisan` base names as present in core) and `customNames`; `category` in kinds; `attribute` in `attributeNames`; `tier` 1 for knowledge/artisan, 1|2 for general; `strain === 0`; `summary` optional string `<= MAX_DESCRIPTION`; `custom === true`; unknown keys rejected. Options absent => that check skipped. Never mutates.
- `validateSkillsFile(file, opts) -> { ok, errors }`: `schema === 'ed-skills/1'`, `skills` array, each entry validated (other entries' names as `customNames`), names unique.

I2a (pure + engine)
- `store.js` export `mergeSkillCatalog(skillsFile, customSkillsFile) -> skillsFile'`: if custom absent/null/empty returns `skillsFile` itself (same element refs); else `{ ...skillsFile, skills: [...skillsFile.skills, ...customFiltered] }`, dropping custom entries whose name equals a core name case-insensitively; adds nothing but the entries as given.
- `engine/skill-options.js` `learnableSkills`: option gets `...(s.custom === true ? { custom: true } : {})`.
- `engine/creation.js` (~l.394-411): candidate gets same conditional spread. Existing l.398 exclusion of general `tier !== 1` stays (Journeyman custom General not offered at creation).
- `store.js` `deriveModel`: `const skillsFile = mergeSkillCatalog(rules.skillsFile, rules.customSkillsFile)` before `makeSkillRef`/`learnableSkills`; `model.skills[]` row adds conditional `custom: true`. `creationContext` uses merged file for `skillCatalog` and `resolveSkill`. `makeSkillRef` signature unchanged.

I2b (wiring)
- `store.js` `loadCustomSkills(...)` mirroring `loadCustomItems` (contents API -> CDN `data/custom-skills.json` -> bundled `rules/custom-skills.json`; local dev `./data/custom-skills.json`; 404 => empty file). `loadRules` returns `customSkillsCommittedFile` and `customSkillsFile` (overlay applied via I3).
- `ui/ed-app.js` `_learnSkill` (~l.1674): `catalog: mergeSkillCatalog(this._rules.skillsFile, this._rules.customSkillsFile).skills`. Re-grep for other `skillsFile.skills` readers before building.

I3 (`store-custom-skills.js`, `store-custom-skills.test.js`)
- `DEFAULT_SKILLS_ENDPOINT` (`.../save-skills`), `saveCustomSkills(skills, { endpoint, saveKey })` (reuse `SaveError` from `store-custom-items.js`), `loadCustomSkillEdits()`, `hasCustomSkillPendingEdits()`, `saveCustomSkillEdits(delta)`, `reconcileCustomSkillEdits()`, `applyCustomSkillEdits(file, delta)` (upsert by name into array, core-agnostic), `isSkillsReflected(savedSkills, committedSkills)`.
- `ui/ed-app.js`: handler for `ed-create-custom-skill` -> `_createCustomSkill({name, skill})` (validate via `validateSkill`, write overlay, `_derive()`, then `_saveCustomSkills`), `_refreshCustomSkills`, replay in the `ed-save-key` listener, inclusion in `_doSave` Save-all and `_dirty`, `_endpointFor('save-skills', DEFAULT_SKILLS_ENDPOINT)` with `?save-skills=` param excluded from the `?save=` rewrite like items.

I4 (worker/dev)
- `tools/worker/worker.js`: `/save-skills` route, `checkSkillsDelta`, `readSkillsFile`, `upsertSkills` (GET sha, merge into array, re-validate whole merged file with `validateSkillsFile`, PUT, bounded 409 retry; message `Save custom skills (serverless)`), CORS/path allow-list update, env `GITHUB_SKILLS_PATH`. Always passes `attributeNames` (from `rules/attributes.json`) and `coreNames` (from `rules/skills.json`) — import JSON (confirm wrangler bundling in first step; fallback: generated lists + test asserting equality with the JSON). Invalid => 400 `invalid_skills`; no key => fail-closed.
- `tools/worker/wrangler.toml`: `GITHUB_SKILLS_PATH = "data/custom-skills.json"`. `tools/dev-server.mjs`: `SKILLS_STORE`, `handleSaveSkills`, route, banner, 404 text. `scripts/sync-local-data.sh`, `.gitignore`: `data/custom-skills.json`. Tests: `tools/worker/worker.test.js`, `tools/dev-server.test.js`.

I5 (`tools/fold-custom-skills.mjs`, `tools/fold-custom-skills.test.js`, `.github/workflows/fold-custom-skills.yml`)
- Mirror fold-custom-items: SOURCE `data/custom-skills.json` (`character-data`) -> TARGET `rules/custom-skills.json` (`dev`); read core names/attributes from the dev checkout; file-level failure (bad JSON, wrong schema) aborts + issue; invalid entries DROPPED, reported in an issue, valid ones still folded; diff-guard (identical => no PUT); bounded 409 retry. Workflow: paths `data/custom-skills.json`, concurrency `fold-custom-skills`. Pure exported helper (e.g. `foldSkills(sourceFile, { coreNames, attributeNames }) -> { file, dropped: [{name, errors}] }`) as test seam.

I6 (homebrew)
- `store.js`: add `'skills.allowCustom'` to `HOMEBREW_SET_TARGETS` (l.795); `deriveModel` adds `customSkills: { enabled: homebrewSets['skills.allowCustom'] === true }` beside the `optionalTable` read (~l.1038).
- `rules/homebrew.json`: rule `hb-custom-skills`, `enabled: true`, `set: {"skills.allowCustom": true}`, `overrides` (PG silent on custom General skills; owner house rule 2026-11-22), `summary`, `note`; update top-level `source` prose enumerating set targets.
- `docs/HOMEBREW-RULES.md` registry list; `docs/TAXONOMY-AUDIT.md` count line (~l.664) if it counts targets. Update any registry/rule-count assertions (`store-homebrew.test.js`, `store-creation-audit.test.js` ~l.429, homebrew data tests). New `tools/homebrew-custom-skills-data.test.js`.

I7 (`ui/skill-filter.js`, `ui/skill-filter.test.js`)
- `export const SKILL_CHIPS = [{id:'all',label:'All'},{id:'knowledge',...},{id:'artisan',...},{id:'language-speak',label:'Speak Language'},{id:'language-readwrite',label:'Read/Write Language'},{id:'general',...},{id:'custom',label:'Custom'}]`.
- `chipMatches(chipId, item) -> boolean`: `all` true; `custom` => `item.custom === true`; `general` => category not knowledge/artisan/language-*; otherwise `item.category === chipId`. Quick-add free-text rows (`Knowledge (...)`, `Artisan (...)`, language free text) shown only under All and their own category chip; hidden under Custom.
- `ui/ed-disciplines.js` `_learnSkillModal` (~l.1418) and `_creationSkillModal` (~l.629): chip row `role="group"`, `<button aria-pressed>`, existing `.pill`/chip styling, theme tokens; state `_skillFilter`/`_creationFilter` reset to `all` on modal open; combines with `_skillSearch`/`_creationSearch`; "N of M skills" counter reflects filter in learn picker; empty sections hidden. No autofocus on chips.

I8 (form)
- I8a: `ui/custom-skill-state.js` (+ `.test.js`) pure: `initialForm(kind, { attributes, templateAttribute }) -> {kind, name, attribute, summary, tier}` (knowledge/artisan prefilled from the generic template entry's `attribute` in data, tier 1; general attribute `''`, tier 1); `setField(form, field, value)`; `formErrors(form, opts) -> string[]` (delegates to `validateSkill`; general with empty attribute => "Choose an attribute"); `toSkill(form) -> skill` (trimmed, `custom:true`, `strain:0`, `summary` omitted when blank, tier forced 1 unless general). `ui/ed-custom-skill.js` element: props `kind`, `attributes`, `templateAttribute`, `coreNames`, `customNames`; fires `ed-create-custom-skill` `{ detail: { name, skill } }` and `ed-cancel` equivalents following `ui/ed-custom-item.js`. Uses `modalFrame` from `ui/kit/`.
- I8b: `ui/ed-disciplines.js`: per-section (Knowledge, Artisan, General) "Create custom skill" header button in both pickers, rendered only when `model.customSkills.enabled`; opens the form as a nested modal layer above the picker; bubbles `ed-create-custom-skill`. `ui/ed-app.js` imports/registers `ed-custom-skill`. Existing quick-add rows kept. Created skill appears selectable in the picker but is NOT auto-learned.

I9 (badge)
- `ui/ed-disciplines.js`: `.pill` "Custom" on rows in both pickers, `_skillRow` (~l.704), and `_skillModal` (~l.925) when `custom === true`; description/attribute from merged catalog; no description => existing "Skill description not yet recorded." (no template text copied).

I10 (docs)
- `docs/GITHUB-SERVERLESS-SAVE.md`, `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`, `docs/HOMEBREW-RULES.md`, `ARCHITECTURE.md`, `WORKFLOW.md`, `docs/AI-WORKFLOWS.md` (if listing scripts), README (`?save-skills=`). Note: toggle gates UI only; names globally unique; redeploy + workflow-on-`character-data` steps.

### UI / behavior
- Pickers: chip row under the search box; selecting a chip filters sections; Custom lists only custom entries. Both themes via tokens only.
- Form modal: fields name (text, maxlength 40), attribute select (options from `rules/attributes.json`), description textarea (optional), tier select for General only (Novice/Journeyman), Knowledge/Artisan tier fixed Novice (shown as text). Inline errors. Escape closes only the form (picker stays); Enter confirms from inputs/selects but not inside the textarea; Cancel and Create buttons; focus returns to the opening button.
- Toggle off: no Create actions; already-created custom skills still resolve and display.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Knowledge/Artisan tier and strain | Novice (tier 1), Strain 0 | R1; Q043, Q044; PG p.198 |
| Default attribute | Knowledge PER, Artisan CHA — taken from the generic template entry in data as form prefill, not hardcoded | R1 |
| GM approval | Informational only; no engine behaviour | R1 |
| Tier prints per skill; Rank 1 cost | Novice 200 LP, Journeyman 300 LP (from `rules/legend.json`, via existing `learnableSkills`); only Novice at creation | R2; Q045, Q043; PG pp.450-451, p.70 |
| Skill Step | Rank + step of the skill's attribute (existing `deriveModel`) | R3; Q045; p.184 |
| Custom General skill | Owner-chosen attribute, Novice or Journeyman tier (house rule, book silent) | R4 (Decision 2026-11-22) |

### Edge cases & invariants
- No custom file / 404 / empty: all existing tests pass unmodified; `mergeSkillCatalog` returns identical element references; `custom` key present only when true.
- Core wins on name collision (case-insensitive); dropped from merge, rejected by validator/worker/fold.
- Names: trimmed, 1..40 chars, no parentheses, unique vs core + custom case-insensitively.
- Journeyman custom General: valid, not offered at creation (l.398), offered in learn picker with Journeyman cost.
- A held custom skill whose entry vanishes degrades to unknown-skill (`known:false`).
- `custom` never written into a character's stored skill.
- Overlay survives reload; failed save keeps overlay; unauthorized clears key; reconcile only when committed branch reflects the skill.
- Fold: one invalid entry never blocks valid ones; bad JSON/schema aborts.
- Description > 500 rejected; unknown keys rejected; `strain` must be 0.

## Testability notes
- node:test: `engine/validate-skill.test.js` (all I1 criteria); `mergeSkillCatalog` + `learnableSkills`/creation `custom` flag + `deriveModel` custom skill step/attribute/`custom` (extend `store-*` style tests, e.g. `store-custom-skills.test.js`); `store-custom-skills.test.js` overlay/reconcile/apply mirroring `store-custom-items.test.js`; `homebrew-custom-skills-data.test.js` and `model.customSkills.enabled` strictness (`true`, `false`, `'true'`, absent); `ui/skill-filter.test.js`; `ui/custom-skill-state.test.js`; worker tests (success, `invalid_skills` for bad attribute/core collision, fail-closed, 409 retry, first-save); dev-server parity; fold tests (404 no-op, identical no PUT, 409 retry, bad JSON, invalid entry dropped + issue + rest folded). Run `npm test`, `rules-conformance`, `check-imports`, `check-ui-kit`, `plans-status`.
- Owner manual checklist (light AND dark): (1) chip row in learn picker and Adept creation picker: each chip filters correctly, Custom lists only custom skills, search combines, keyboard Tab/Space/Enter toggles, counter correct; (2) Create button appears in Knowledge/Artisan/General sections of both pickers only when homebrew rule on; (3) form: Knowledge/Artisan prefilled PER/CHA and fixed Novice, General shows tier select and requires attribute; inline errors for empty/duplicate/parens/long; Escape closes only the form; Enter confirms (not in textarea); focus returns; (4) created skill appears at once, tagged Custom, selectable, learnable with correct cost/step; (5) Custom badge in picker rows, skills list row, skill detail modal; absent on core skills; no-description text correct; (6) reload keeps skill; save flow dot/prompt with both overlays; (7) Overview unaffected.

## Changelog entry
{"type": "added", "text": "Create your own Knowledge, Artisan and General skills, shown with a Custom tag, and filter both skill pickers by category."}

## Out of scope
Editing/deleting custom skills; Language free-text changes; any stored character skill shape change; worker reading the homebrew file; description templates as fallback text; fabricated `action`/`versus`/`effects` for custom skills.
