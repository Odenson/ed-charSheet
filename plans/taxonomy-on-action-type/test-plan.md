# Test Plan: Taxonomy on action type (taxonomy-on-action-type)

## Test files
- engine/ability-actions.test.js (new)
- store-action-modifier.test.js (new)
- tools/rules-conformance.test.js (changed)
- tools/dev-server.test.js (changed: v4 -> v5 stamp assertion)
- tools/worker/worker.test.js (changed: fresh-catalog stamp assertion)
- engine/spells-standalone-option.test.js (changed: Death's Head action-modifier data tests)

## Coverage
### engine/ability-actions.test.js
- ACTION_SPEED order and doc drift guard (R1, R2): catches vocabulary drift between engine and taxonomy section 5.1.
- Simple on Standard; Free+Simple (Free wins, flags); order independence; ties all applied; slower override (Simple on Free); equal-to-base returns null (also with a slower extra effect) (R2).
- Ignored effects: no effects, other ability, wrong type/operation/domain, gmDiscretion, situational; condition "always" applies; invalid values Sustained/NA/Instant/lowercase/number/null/missing (R1).
- Non-listed bases still overridden with raw actionBase; source-name fallback; de-dup; no mutation; no DOM/store import.

### store-action-modifier.test.js
- Death's Head data has the Simple Frighten action-modifier (R3).
- Death's Head active (0 and 1 picks): Frighten Simple, base Standard, one applied source (R3).
- Other talents unchanged; expiry reverts with no actionBase; Frighten step unchanged at 0 picks and +2 for one pick.
- Synthetic skill effect folds onto a skill (base read from skills.json); two effects give Free applied and Simple overridden; equal-to-printed adds no keys; invalid/gmDiscretion ignored; input not mutated, nothing persisted.

### tools/rules-conformance.test.js
- Doc is v5, all refs v5 (Tier 2 migration all-or-none).
- action-modifier and action in doc vocab; ACTION == [Free, Simple, Standard] and not polluting measure vocab (R1).
- Vocab walk validates every action-modifier in rules/*.json; Death's Head has a valid one.
- actionModifierProblems negative/positive unit tests (Sustained, NA, Instant, number, missing, operation add, wrong measure, wrong domain, empty name).
- Note: this file fails to load wholesale until doc section 5.1 exists (module-level parse).

### tools/dev-server.test.js, tools/worker/worker.test.js
- Fresh custom-items catalog stamps `docs/EFFECT-TAXONOMY.md (v5)`.

### engine/spells-standalone-option.test.js
- Death's Head base effect shape, note and extra thread kept; label equals summary at 0 picks, Frighten step bonus 0 / +2 unchanged (R3).

## Not covered (and why)
Owner manual verification (no browser harness):
- Accent colour in light and dark on Disciplines talent and skill rows and both modals; unchanged abilities look identical.
- Hover text: line 1 "Standard → Simple", then "Simple: Death’s Head (applied)" lines.
- Combat attack picker: changed option and the closed select show accent (not in Safari).
- Active Effects card on Overview renders the string-valued spell effect sanely.
- `actionHoverText` formatter is module-private and not promised by the spec, so untested.
- Doc prose edits other than version/5.1, changelog.json entry, and Cloudflare worker redeploy (owner at release).

## How to run
`npm test`
