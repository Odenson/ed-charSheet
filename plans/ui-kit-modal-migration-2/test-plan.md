# Test Plan: UI kit modal migration 2 (ui-kit-modal-migration-2)

## Test files
- ui/kit/dirty.test.js (new)
- ui/kit/scope-css.test.js (new)
- tools/check-ui-kit.test.js (changed: the old "exactly 16 files" end-state test is replaced by the new end state)

## Coverage
### ui/kit/dirty.test.js
- equal objects clean / changed value dirty; null/undefined/'' equal; numbers and booleans by string form; objects/arrays by JSON; no trimming; union of keys; revert is clean and inputs not mutated.
- **Validates:** spec "Edge cases" isDirty bullet. **Rule:** n/a. **Why:** a wrong dirty check either loses text silently or prompts needlessly on every modal.

### ui/kit/scope-css.test.js
- wrapper string `${sel} { ${css} }`, empty input, selector passthrough, multi-rule input.
- **Validates:** spec `scopeCss` contract. **Rule:** n/a. **Why:** breaks the light-DOM `ed-save-key` styling.

### tools/check-ui-kit.test.js::end state (migration-2) baseline is exactly the three non-modal entries
- **Validates:** baseline == ed-app button-style 1, ed-spells font-size 5, legend-spent-view font-size 2, in sorted order. **Rule:** n/a.
### tools/check-ui-kit.test.js::migrated modal hosts have no violations at all
- **Validates:** the 13 listed hosts (add-legend, changelog, character-picker, combat, conflict, custom-item, day-reset, edit-meta, homebrew, notes, overview, save-key, settings) have zero violations of every rule (no document keydown, role=dialog, frame CSS, inline button style).
- The existing "real repo passes the check" test enforces the two-way ratchet.

## Not covered (and why)
- Modal controller dirty guard (`requestClose` asks, `close()` unguarded) is already covered by `ui/kit/modal-controller.test.js`; spec says no controller change expected.
- `modalFrame` `cancelLabel`/`focusCancel`, `ed-confirm` props, `ensureLightStyles()` import lit/DOM: not node-testable. Owner verifies manually per the plan's Owner verification script (V1-V3, G1-G8): focus return, stacking, discard prompt (custom-item confirm label "Close", others "Discard"), Ctrl/Cmd+Enter, light-DOM styling and autofill, theming, Overview viewport fit.
- Docs/changelog edits are not tested.

## How to run
`npm test` (new tests are red until `ui/kit/dirty.js` and `ui/kit/scope-css.js` exist and the baseline is lowered).
