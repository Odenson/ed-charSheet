---
status: implemented
shipped: v2.5.0
---
# Delivery Plan: Custom skills and picker filters (gen-skill-other)

## Context & learnings
Owners want (a) quick category filter chips in both skill pickers (edit-mode learn picker, Adept creation picker) and (b) the ability to create their own Knowledge / Artisan / General skills with an attribute and an optional description. The owner first asked for the extra data on the stored skill entry (a Tier 1 shape change), then declined that and redirected (qa-log 2026-11-22): custom skills are catalog entries in their own shared rules file, mirroring custom items, tagged Custom, and the stored character skill stays `{name, rank, tier}`. Decisions:
- Persistence: new `/save-skills` worker route -> `data/custom-skills.json` on `character-data` -> CI fold to `rules/custom-skills.json`; owner redeploys the worker.
- Form: name, attribute (Knowledge/Artisan prefilled with the generic template's default, editable), optional description, tier (General only: Novice or Journeyman; Knowledge/Artisan Novice). Per-section "Create custom skill" action; the existing `Knowledge (...)` / `Artisan (...)` quick-add rows stay.
- Chips: All / Knowledge / Artisan / Speak Language / Read/Write Language / General / Custom in both pickers.
- Creation is gated by a homebrew boolean `set` rule, shipped `enabled: true`.
- Out of scope: edit/delete of custom skills, Language free text, any stored-shape change.
- Rules (rules.md): R1 Knowledge/Artisan Novice, default PER/CHA, GM approval; R2 tier/cost data-driven; R3 Step = Rank + attribute Step; R4 custom General skill tier/attribute is an owner house rule (NOT-COVERED by the book, Decision recorded).

## Discoveries
- `store.js` `makeSkillRef(skillsFile)` (l.828) builds a name->entry map from `skillsFile.skills`, exact name then bracket-stripped base. Used by `deriveModel` (l.1432, builds `model.skills`), `creationContext` (l.842-855: `skillCatalog` + `resolveSkill`), and `ed-app.js` `_learnSkill` (l.1674, `catalog: this._rules.skillsFile.skills`). `deriveModel` also builds `skillOptions` via `learnableSkills` (l.1683-1687).
- `engine/skill-options.js` `learnableSkills` maps catalog entries to option objects (no `custom` field today); `engine/creation.js` l.394-411 builds creation `candidates` (no `custom` field). Creation excludes `general` entries with `tier !== 1` (l.398), so a Journeyman custom General skill is automatically not offered at creation (R2 consistent). `skillCatalog` entries need `category`; `artisanKey` is absent on a custom Artisan (so `disciplineList` is false; it uses the 'extra' pool, which is correct).
- `resolveSkillName` (skill-options.js l.17) bans `()` and >40 chars for free text; reuse the same limits for custom names so a custom name never collides with the `Name (text)` stored form or the bracket-strip fallback.
- Pickers: `ui/ed-disciplines.js` `_learnSkillModal` (l.1418; sections by `category`, General = everything else; search `_skillSearch`) and `_creationSkillModal` (l.629; sections, search `_creationSearch`). Both use `modalFrame(this._modalCtl, ...)` from `ui/kit/`. Skill detail modal `_skillModal` (l.925) and row `_skillRow` (l.704) show skills; both read model skills.
- Custom-items precedent to mirror: `store-custom-items.js` (`ed-custom-items` localStorage overlay, `saveCustomItems`, `isItemsReflected`), `store.js` `loadCustomItems` (l.341; contents API -> CDN -> bundled `rules/custom-items.json`; local dev reads `./data/...`), `loadRules` (l.779-789), `ed-app.js` `_editCustomItems` / `_saveCustomItems` / `_refreshCustomItems` / `_endpointFor` / save-key replay (`ed-save-key` listener l.522, `_doSave` l.2332), `engine/validate-item.js` (shared by UI, worker, fold), `tools/worker/worker.js` (`/save-items` route l.111, `upsertItems`, `readItemsFile`, `checkItemsDelta`; CORS allow-list l.72-79), `tools/dev-server.mjs` (l.77, 247, 541), `tools/fold-custom-items.mjs` + `.github/workflows/fold-custom-items.yml`, `tools/worker/wrangler.toml` (`GITHUB_ITEMS_PATH`), `scripts/sync-local-data.sh`, `.gitignore` (data/custom-items.json), docs `GITHUB-SERVERLESS-SAVE.md`, `GITHUB-SERVERLESS-SAVE-RUNBOOK.md`, `WORKFLOW.md`, `AI-WORKFLOWS.md`, `ARCHITECTURE.md`.
- Homebrew: `HOMEBREW_SET_TARGETS` (store.js l.795) + `homebrewSetsFor`; precedent `advancement.optionalTable` is read as strict `true`. Rule entries live in `rules/homebrew.json` (`hb-optional-circle-advancement` ~l.87). Docs registry list in `docs/HOMEBREW-RULES.md` ~l.194-239 (doc states adding a target is code + doc, not a format change). Test precedent `tools/homebrew-optional-advancement-data.test.js`, `store-optional-advancement.test.js`.
- `tools/rules-conformance.test.js` enumerates every `rules/*.json` via `readdirSync` (l.16): each needs a schema tag matching `/^ed-[a-z-]+\/\d+$/`, an `effectTaxonomy` ref only if it has effects (`docs/EFFECT-TAXONOMY.md (v6)`). `rules/custom-skills.json` must use `schema: "ed-skills/1"` and either omit `effects` (plan: custom entries carry none) or carry the v6 ref. `tools/check-imports.mjs` and `tools/plans-status.test.js` also scan the tree (new modules must import only real exports; plan frontmatter valid).
- Skill entry shape (rules/skills.json): `{name, tier (1|2), category, strain:0, attribute, action, versus, summary, effects, presentation.shortEffect}`. Custom entries: `{name, tier, category, strain:0, attribute, summary?, custom:true}` — never fabricate `action`/`versus`/`effects`.

## Guardrail classification
Whole plan Tier 3 (tickets.md Guardrail alignment; qa-log 2026-11-22 and 2026-11-22 homebrew classification). No stored-shape change, no taxonomy change, engine stays pure, `rules/custom-skills.json` reuses `ed-skills/1`, the homebrew toggle is a new registry target (code + doc, not an `ed-homebrew/3` format change). Per item: I1-I10 Tier 3. No Tier 1 item, so no sign-off required. Guard rail: if implementation tempts a new top-level homebrew lever or a stored-field addition, stop — that is Tier 1. Worker change requires an owner redeploy (operational, not a tier issue). UI items must follow UI-GUIDELINES and `docs/MODALS.md`.

## Rules dependencies
- R1 (Q043, Q044) FAQ-HIT: Knowledge/Artisan Novice, Strain 0, default attributes PER/CHA (used as form prefill from the generic template entry, never hardcoded in code), GM approval note.
- R2 (Q045, Q043) ANSWERED: tier prints per skill; costs come from `rules/legend.json` via existing `learnableSkills`; only Novice at creation (existing gate).
- R3 (Q045) ANSWERED: Step = Rank + attribute Step; existing `deriveModel` already does this once the entry has `attribute`.
- R4 NOT-COVERED with owner Decision (2026-11-22): custom General skill gets an owner-chosen attribute and Novice/Journeyman tier; gated by the homebrew rule. This is the basis for the `rules/homebrew.json` entry's `overrides`/`note` text (I6).
No open NEEDS_RULES.

## Implementation items

### I1 — Pure custom-skill validator
- **Covers tickets:** T1
- **Rules:** R1, R3, R4
- **Tier:** 3
- **What:** `engine/validate-skill.js`: `validateSkill(name, skill, { coreNames, attributeNames, customNames })` and `validateSkillsFile(file, opts)`, plus exported constants `SKILL_KINDS = ['knowledge','artisan','general']`, `MAX_DESCRIPTION`. Rules: name trimmed, non-empty, <= `MAX_TEXT` (40), no `(` `)`; unique case-insensitively against core names and other custom names (and not equal to a generic template name); `category` in kinds; `attribute` in `attributeNames` (from `rules/attributes.json`); `tier` 1 for knowledge/artisan, 1 or 2 for general; `summary` optional string <= ~500 chars; `custom: true` required; no unexpected keys (strict, like validate-item since the worker endpoint is public). Pure, never mutates.
- **Where:** `engine/validate-skill.js`, `engine/validate-skill.test.js`.
- **Approach:** Mirror `engine/validate-item.js` structure (`{ ok, errors }`). File check: `schema === 'ed-skills/1'`, `skills` is an array, each entry validated, names unique. Reuse `MAX_TEXT` from `engine/skill-options.js`.
- **Dependencies:** none.
- **Acceptance criteria:** Tests cover duplicate (core and custom, case-insensitive), bad attribute, empty name, parens, over-length name, bad tier per kind, bad category, over-long description, unknown keys, valid minimal and full entries, file-level schema.
- **Risks / unknowns:** Worker may not be able to supply `coreNames`/`attributeNames` (see I4); options are therefore optional and skipped when absent.

### I2 — Custom skill catalog load, merge and `custom` flag
- **Covers tickets:** T1, T6
- **Rules:** R3
- **Tier:** 3
- **What:** Load `rules/custom-skills.json` / `data/custom-skills.json` optionally and merge into the catalog every consumer reads; carry `custom: true` through to the picker options, creation candidates and model skills. Absent file = unchanged behaviour.
- **Where:** `store.js` (`loadCustomSkills` mirroring `loadCustomItems` with URLs for `data/custom-skills.json`; `loadRules` adds `customSkillsCommittedFile` + `customSkillsFile` (overlay applied); new exported pure `mergeSkillCatalog(skillsFile, customSkillsFile)` returning a `{...skillsFile, skills:[...core, ...custom]}` copy with core winning on a name collision; `deriveModel` merges before `makeSkillRef`/`learnableSkills` and adds `custom` to each `model.skills` row; `creationContext` uses the merged file); `ed-app.js` l.1674 (`_learnSkill` catalog uses the merged file); `engine/skill-options.js` `learnableSkills` adds `custom: s.custom === true`; `engine/creation.js` candidates add `custom: e.custom === true`; new `rules/custom-skills.json` = `{"schema":"ed-skills/1","source":"custom","notes":"Owner-created skills, folded from data/custom-skills.json by CI.","skills":[]}`.
- **Approach:** One helper, applied at the four consumption sites, so `makeSkillRef`'s signature and behaviour are unchanged (it still takes a skills file). Core never overridden: merge drops a custom entry whose name matches a core name case-insensitively. `mergeSkillCatalog(skillsFile, undefined | null | {skills: []})` returns the core entries unchanged (same element references, so `store-creation-model.test.js` l.89 `deepEqual(ctx.skillCatalog, rules.skillsFile.skills)` still holds; many `store-*.test.js` pass only `skillsFile`). The `custom` property is added ONLY when true (`...(s.custom === true ? { custom: true } : {})`), never `custom: false`, so exact-shape assertions on options/candidates/model skills stay green. Stored character shape untouched.
- **Dependencies:** I1. Ships with the bundled empty `rules/custom-skills.json`; the overlay (I3) layers on afterwards. Delivered as two commits: I2a pure `mergeSkillCatalog` + `custom` flags in engine/model (with tests), I2b store load wiring (`loadCustomSkills`, `loadRules`, ed-app l.1674).
- **Acceptance criteria:** The whole existing suite (`npm test`, notably `store-creation-model.test.js`, `store-creation-audit.test.js`, `engine/skill-options.test.js`, `engine/creation` tests) passes unmodified; a custom skill in the file resolves via `makeSkillRef` to its own attribute/description, derives a step, appears in `skillOptions` and creation candidates with `custom: true`; absent/404 file leaves existing tests green; core collision refused; `rules-conformance`, `check-imports` pass with the new rules file.
- **Risks / unknowns:** Other places that read `rules.skillsFile.skills` directly (grep again before building: only `ed-app.js` l.1674 and store.js sites found). Custom entry with no `summary`: leave `brief`/description null (existing "Skill description not yet recorded." fallback); do not copy the generic template text.

### I3 — Client overlay and save plumbing
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** `store-custom-skills.js` mirroring `store-custom-items.js`: `DEFAULT_SKILLS_ENDPOINT` (`.../save-skills`), overlay key `ed-custom-skills`, `saveCustomSkills`, `loadCustomSkillEdits`, `hasCustomSkillPendingEdits`, `saveCustomSkillEdits`, `reconcileCustomSkillEdits`, `applyCustomSkillEdits(file, delta)`, `isSkillsReflected`. Delta shape `{ skills: { <name>: <skill> } }` (no delete: non-goal). Wire `ed-app.js`: `_createCustomSkill({name, skill})` (writes overlay instantly, re-derives so the skill is selectable in the open picker, then saves), `_saveCustomSkills`, `_refreshCustomSkills`, key-prompt replay in the `ed-save-key` listener, inclusion in the Save-all path (l.2332) and in `_dirty`.
- **Where:** `store-custom-skills.js` (+ `store-custom-skills.test.js`), `store.js` (imports), `ui/ed-app.js` (listener for `ed-create-custom-skill`). The dispatch from `ed-disciplines.js` belongs to I8.
- **Approach:** Copy the custom-items state machine; share `SaveError`. `_endpointFor('save-skills', DEFAULT_SKILLS_ENDPOINT)` — update `_endpointFor`'s sibling-route rewrite exclusion list only if `?save-skills=` param is supported (mirror items: yes, also exclude from the `?save=` rewrite? items are excluded, so exclude `save-skills` too). Run `_derive()` after overlay write.
- **Dependencies:** I1 (client-side validation before write); I2 (ships first with the bundled empty file, so there is no I2/I3 cycle).
- **Acceptance criteria:** Overlay survives reload; created skill appears immediately; confirmed save reconciles the overlay only when the branch read reflects it; failed save keeps the overlay and shows the existing save error; unauthorized clears the key. Tests mirror `store-custom-items.test.js`.
- **Risks / unknowns:** Two overlays now feed the dirty dot; verify `_dirty` composition and the combined Save path.

### I4 — Worker route and local dev server
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3 (owner redeploy)
- **What:** `POST /save-skills { skills: { name: skill } }` in `tools/worker/worker.js`: validate delta (`checkSkillsDelta`), `ensureBranch`, GET-sha/merge/re-validate/PUT with bounded 409 retry (`upsertSkills`, `readSkillsFile` default `{schema:'ed-skills/1', source:'custom', notes, skills:[]}`), commit message `Save custom skills (serverless)`. Add to the allowed-path list and CORS comment (l.72-79). `wrangler.toml`: `GITHUB_SKILLS_PATH = "data/custom-skills.json"`. `tools/dev-server.mjs`: `SKILLS_STORE`, `handleSaveSkills`, route, banner, 404 message. `scripts/sync-local-data.sh` and `.gitignore`: `data/custom-skills.json`. Update worker and dev-server tests.
- **Where:** `tools/worker/worker.js`, `tools/worker/worker.test.js`, `tools/worker/wrangler.toml`, `tools/dev-server.mjs`, `tools/dev-server.test.js`, `scripts/sync-local-data.sh`, `.gitignore`.
- **Approach:** Store the file as an array under `skills` (keyed upsert by name in the delta -> merged into the array, replacing an equal custom name). Decision (review F1): the worker imports `rules/attributes.json` and `rules/skills.json` (wrangler bundles JSON imports; confirm in the first build step) and ALWAYS passes `attributeNames` and `coreNames`, so the attribute and core-collision checks are mandatory server-side, never shape-only. If bundling proves impossible, the worker hard-codes the attribute-name list and core-name list generated by a small script with a test asserting they match the JSON. The fold (I5) is additionally tolerant as a second line of defence.
- **Dependencies:** I1.
- **Acceptance criteria:** Worker tests: success commit, invalid skill 400 `invalid_skills`, fail-closed without key, 409 retry, first-save empty file; dev-server parity.
- **Risks / unknowns:** Bundle size of core JSON in the worker (see fallback above). Deploy is the owner's step; flag in handoff. Add a worker test: a delta whose merged file would contain an unknown attribute or core-name collision is rejected 400 `invalid_skills`.

### I5 — CI fold
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** `tools/fold-custom-skills.mjs` (+ test) mirroring `fold-custom-items.mjs` (SOURCE `data/custom-skills.json` on `character-data`, TARGET `rules/custom-skills.json` on `dev`, validate with `validateSkillsFile` including core names/attributes read from the dev checkout; invalid entries are DROPPED and reported in a failure issue while valid entries are still folded (review F1: one bad entry on `character-data` must not block every later fold; a file-level problem such as bad JSON or wrong schema still aborts), diff-guard, bounded 409 retry, failure issue) and `.github/workflows/fold-custom-skills.yml` (paths `data/custom-skills.json`, concurrency group `fold-custom-skills`).
- **Where:** `tools/fold-custom-skills.mjs`, `tools/fold-custom-skills.test.js`, `.github/workflows/fold-custom-skills.yml`.
- **Approach:** Prefer parameterising the existing fold (shared `foldFile({sourcePath, targetPath, validate, message})`) only if it can be done without touching the custom-items tests; otherwise a straight mirror is acceptable (duplication over regression risk).
- **Dependencies:** I1.
- **Acceptance criteria:** Mocked-fetch tests mirror `fold-custom-items.test.js` (404 no-op, identical -> no PUT, 409 retry, bad JSON -> issue) plus: an invalid entry already on `character-data` is dropped, reported via an issue, and the valid entries still fold.
- **Risks / unknowns:** Workflow file must also exist on `character-data` for the `push` trigger (same gotcha as custom items); document in the runbook.

### I6 — Homebrew toggle `skills.allowCustom`
- **Covers tickets:** T3
- **Rules:** R4 (owner house rule)
- **Tier:** 3
- **What:** Add `'skills.allowCustom'` to `HOMEBREW_SET_TARGETS`; add rule `hb-custom-skills` to `rules/homebrew.json` with `enabled: true`, `set: { "skills.allowCustom": true }`, `overrides` citing the PG silence on custom General skills (R4), `summary`, `note`; document the target in `docs/HOMEBREW-RULES.md` registry list; update the `rules/homebrew.json` top-level `source` text that enumerates set targets (and leave the stale 'rules ship enabled: false' note consistent with the existing enabled `hb-optional-circle-advancement` precedent, correcting it if trivial). Grep `store-homebrew.test.js`, `store-creation-audit.test.js` l.429 and the homebrew data tests for registry-set or rule-count assertions and update them. `deriveModel` exposes `model.customSkills = { enabled: homebrewSets['skills.allowCustom'] === true }` (strict `true`, like `optionalTable`). When off: no Create actions; existing custom skills still resolve (I2 is unconditional).
- **Where:** `store.js`, `rules/homebrew.json`, `docs/HOMEBREW-RULES.md` (+ `docs/TAXONOMY-AUDIT.md` count line if it still counts registry targets, l.664), new `tools/homebrew-custom-skills-data.test.js`, extend `store-optional-advancement.test.js` style tests in `store-custom-skills.test.js`.
- **Approach:** Copy the `advancement.optionalTable` pattern verbatim. Does not touch `ed-homebrew/3` file shape.
- **Dependencies:** none.
- **Acceptance criteria:** Rule ships enabled; `enabled:false` or non-`true` value => `model.customSkills.enabled === false`; data test asserts the rule id/set; the homebrew tab (`ui/ed-homebrew.js`) lists it without code change (verify).
- **Risks / unknowns:** The worker does not read the homebrew file, so the toggle gates UI only (documented in I10).

### I7 — Category filter chips in both pickers
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** A chip row All / Knowledge / Artisan / Speak Language / Read/Write Language / General / Custom in `_learnSkillModal` and `_creationSkillModal`. A chip narrows to one category's section (Custom: only entries with `custom: true`, across sections; the free-text quick rows hide under Custom and also under non-matching chips). Combines with search. Chip state held on the component (`_skillFilter`, `_creationFilter`), reset to All on modal open; "N of M skills" counter reflects the filter in the learn picker.
- **Where:** pure helper `ui/skill-filter.js` (+ `ui/skill-filter.test.js`): `SKILL_CHIPS`, `chipMatches(chipId, optionOrCandidate)` where General = not knowledge/artisan/language; `ui/ed-disciplines.js` (both modals; learn picker already has `section-gap` headings).
- **Approach:** Reuse the existing pill/chip styling (`.pill`/`.chip` classes in ed-disciplines CSS); render as a `role="group"` row of toggle `<button aria-pressed>` elements, theme tokens only, no new colours. Do not use `autofocus` on chips (search keeps autofocus); Escape/Enter handling stays with `modalFrame`/`data-enter` contract (docs/MODALS.md, check `tools/check-ui-kit.mjs` baseline).
- **Dependencies:** I2 (for the Custom chip).
- **Acceptance criteria:** Each chip shows only matching sections; Custom lists only custom skills; keyboard focus order and Space/Enter toggling work; light/dark ok; `check-ui-kit` passes.
- **Risks / unknowns:** Creation picker rows are `candidates` (category present); learn-picker General is a derived bucket — keep both on the shared helper to avoid drift.

### I8 — Create custom skill form
- **Covers tickets:** T5
- **Rules:** R1 (default attribute/tier), R2, R4
- **Tier:** 3
- **What:** A "Create custom skill" action in the Knowledge, Artisan and General section headers of both pickers, shown only when `model.customSkills.enabled`. It opens a nested modal form: name, attribute `<select>` (options from `rules/attributes.json`; Knowledge/Artisan prefilled from the generic template entry's attribute, General no prefill/first required choice), optional description textarea, tier select shown for General only (Novice/Journeyman), Knowledge/Artisan fixed Novice. Inline validation messages from `validateSkill` (I1). On confirm it dispatches `ed-create-custom-skill`; the skill then shows in the picker and is selectable (not auto-learned).
- **Where:** `ui/ed-custom-skill.js` (new element, or a `modalFrame` form method in `ed-disciplines.js`; prefer a small new element + `ui/custom-skill-state.js` pure state with `.test.js`, mirroring `ed-custom-item.js` / `custom-item-state.js`), `ui/ed-disciplines.js` (section header action, modal type, `ed-create-custom-skill` dispatch), `ui/ed-app.js` registration/import. Delivered as I8a form state + element (pure state tested) and I8b picker integration.
- **Approach:** Use `ui/kit` modal frame (layer above the picker, Escape closes only the form, Enter confirms from inputs but not inside the textarea), `data-enter` conventions as in the learn picker, existing form/`searchin`/button classes. Attribute list and generic-template defaults come from data passed down as props (model/rules), no DOM in engine.
- **Dependencies:** I1, I2, I3, I6, I7 (section headers).
- **Acceptance criteria:** Escape closes the form and leaves the picker open; Enter confirms; duplicate/empty/bad-attribute errors shown; light/dark; both pickers offer it; hidden when the homebrew rule is off; General form offers tier, others do not; created entry carries `custom: true`.
- **Risks / unknowns:** Nested-modal focus return (verify with modal-controller tests/doc); General attribute default (no template): require an explicit choice.

### I9 — Custom badge and sheet display
- **Covers tickets:** T6
- **Rules:** R3
- **Tier:** 3
- **What:** A "Custom" pill on custom skills in both pickers' rows, on the skills list row (`_skillRow`), and in the skill detail modal (`_skillModal`); description and attribute render as for catalog skills (from the merged catalog). Missing description keeps the existing "not yet recorded" line.
- **Where:** `ui/ed-disciplines.js`, `store.js` (`model.skills[].custom`, set in I2), CSS in the component styles using theme tokens.
- **Approach:** Reuse the `.pill` class; no fabricated values; light/dark verified via existing tokens.
- **Dependencies:** I2.
- **Acceptance criteria:** Badge visible in light and dark in pickers, list and modal; not shown for core skills.
- **Risks / unknowns:** A character that holds a custom skill whose file entry later disappears degrades to the existing unknown-skill behaviour (`known: false`); acceptable since delete is out of scope.

### I10 — Docs
- **Covers tickets:** T2, T3
- **Rules:** none
- **Tier:** 3
- **What:** Update `docs/GITHUB-SERVERLESS-SAVE.md` (new route, file, overlay, fold, redeploy note), `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`, `docs/HOMEBREW-RULES.md` (I6), `ARCHITECTURE.md` (data files and layers), `WORKFLOW.md`, `docs/AI-WORKFLOWS.md` if it lists workflows/scripts, README run-locally param `?save-skills=`, and changelog entry per repo convention.
- **Where:** as listed.
- **Approach:** Docs follow code; note the UI-only gate on the toggle and that custom-skill names are globally unique.
- **Dependencies:** I1-I9.
- **Acceptance criteria:** No doc/code disagreement; `check-imports` and tests green.
- **Risks / unknowns:** none.

## Verification note (review F5)
`node:test` covers only the pure helpers (validator, merge, filter, form state, overlay, worker, fold). I7, I8b and I9 are owner-manual UI verification in light and dark themes; the hand-off must list that checklist.

## Sequencing
1. I1 validator (everything depends on it).
2. I6 homebrew toggle (small, independent, unblocks UI gating).
3. I2 catalog merge + `custom` flag (data path end to end with an empty bundled file).
4. I3 client overlay/save, then I4 worker + dev-server, I5 fold (persistence; I4/I5 are independent of the UI).
5. I7 chips (UI, independent of create).
6. I8 create form (needs I1-I3, I6, I7).
7. I9 badge (needs I2; can land with I7/I8).
8. I10 docs last.
Rationale: engine/data first, persistence next, UI last, so each step is testable without the next.

## Open questions
- Custom skill with no description: plan stores no `summary` and shows the existing "not yet recorded" text rather than the generic template text (owner said the custom description "replaces the generic description"; blank = none). Confirm at review if the template text should be the fallback instead.
- Whether the worker can bundle `rules/skills.json` + `rules/attributes.json` for server-side collision/attribute checks (I4); fallback is shape-only in the worker and full check in the fold.
- Release note: owner must redeploy the worker and ensure the new workflow exists on `character-data`.

## Review responses
- F1 (major): fixed. Worker always runs the attribute and core-collision checks (bundled JSON, or generated hard-coded lists with a matching test); fold drops and reports invalid entries and folds the rest; test for an invalid entry already on `character-data` added (I4, I5).
- F2 (major): fixed. `mergeSkillCatalog` returns identical core elements when no custom file; `custom` added only when true; existing suite named in I2 acceptance.
- F3 (minor): fixed. Dispatch moved to I8; I2 ships with the bundled empty file before I3, no cycle.
- F4 (minor): fixed. I6 updates the homebrew `source` text and checks registry/rule-count assertions in tests.
- F5 (minor): fixed in part. I2 and I8 are each split into two sub-deliveries (a/b) rather than renumbered; manual UI verification note added.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
