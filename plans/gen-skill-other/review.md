# Plan Review: Custom skills and picker filters (gen-skill-other)

## Summary
The plan is well grounded: cited files, line numbers and the custom-items precedent check out. It is Tier 3 throughout and the rules trace to rules.md. There are 5 findings, 0 blockers, 2 major and 3 minor.

## Findings
### F1 — I4 / I5 — Shape-only worker fallback can poison the fold
- **Severity:** major
- **Problem:** I4 allows the worker to fall back to shape-only validation (no `coreNames`/`attributeNames`). I5's fold does the full check, including core collisions and attribute names. A skill with an unknown attribute or a core-name collision could then pass the worker and land on `character-data`. The fold would reject the whole file and open a failure issue on every later push, so no custom skill would reach `dev` until someone hand-edits the data branch.
- **Fix:** Decide the fallback up front. Either (a) make the worker check attributes against a small hard-coded or imported `attributes.json` list and make the core-name check mandatory (bundle the JSON, or import just the names), or (b) make the fold drop and report invalid entries and fold the valid ones instead of failing the whole file. Add a worker or fold test for "invalid entry already on character-data".

### F2 — I2 — Existing tests and callers that don't pass `customSkillsFile`
- **Severity:** major
- **Problem:** Many `store-*.test.js` files build a `rules` object with only `skillsFile` and call `deriveModel` / `creationContext`. `mergeSkillCatalog` must handle an undefined custom file everywhere. `store-creation-model.test.js:89` does a `deepEqual` of `ctx.skillCatalog` to `rules.skillsFile.skills`, so the merged copy must be element-identical. Adding `custom: false` to every option or candidate could break exact-shape assertions.
- **Fix:** State in I2 that `mergeSkillCatalog(skillsFile, undefined)` returns the core entries unchanged (same elements). Add `custom` as `true` only (or confirm no test does exact-shape equality on options or candidates). Name the check for the existing suite in the acceptance criteria.

### F3 — I3 / I8 — Event dispatch listed in two items
- **Severity:** minor
- **Problem:** I3 lists `ui/ed-disciplines.js` `ed-create-custom-skill` dispatch, but I8 builds the form and the dispatch. I2 also lists I3 as a dependency, which makes the I2/I3 dependency circular, with "stub" as the workaround.
- **Fix:** Move the `ed-disciplines.js` dispatch into I8. Keep I3 to `store-custom-skills.js` plus the `ed-app.js` handler. State that I2 ships with the bundled empty file and I3 follows.

### F4 — I6 — Homebrew file prose and tests need updating
- **Severity:** minor
- **Problem:** `rules/homebrew.json` `source` text enumerates the set targets, and its `note` says "Rules ship enabled: false". The plan adds a target but does not say to update that prose. The note already conflicts with the enabled `hb-optional-circle-advancement` rule, so shipping `enabled: true` has precedent. Existing homebrew tests may also assert the target set or the rule count.
- **Fix:** Add the `source` text update to I6's "What". Grep `store-homebrew.test.js` and the homebrew data tests for registry or rule-count assertions.

### F5 — I2 / I8 — Items are large
- **Severity:** minor
- **Problem:** I2 touches store, engine, ed-app and a new data file. I8 adds a new element, a state module and section-header wiring in both pickers. Each is borderline for one focused change.
- **Fix:** Optional. Split I2 into the pure merge + flags and the store load wiring. Split I8 into the form state/element and the picker integration. Flag I7 to I9 as owner-manual UI verification in both themes, since `node:test` only covers the pure helpers.
