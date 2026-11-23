# Test Plan: Save spinner (save-spinner)

## Test files
- ui/saving-overlay-state.test.js

## Coverage
### ui/saving-overlay-state.test.js::shows while a manual save is in flight
- **Validates:** helper returns true when saving, not dismissed, no hand-off
- **Rule:** n/a
- **Why:** overlay never appears
### ::hidden when not saving
- **Validates:** no overlay when no manual save. **Rule:** n/a. **Why:** stuck overlay.
### ::hidden when dismissed while saving
- **Validates:** dismiss hides overlay for the rest of the save. **Rule:** n/a. **Why:** reappearing overlay.
### ::hidden during hand-off to conflict/rename modal
- **Validates:** never co-mounted with ed-conflict/rename. **Rule:** n/a. **Why:** modal stacking/focus theft.
### ::hidden when dismissed and hand-off both true
- **Validates:** combined hide. **Rule:** n/a. **Why:** precedence bugs.
### ::undefined inputs coerce to hidden and return a strict boolean
- **Validates:** `!!` coercion, boolean result. **Rule:** n/a. **Why:** truthy leakage.

## Not covered (and why)
No DOM harness. Owner verifies by hand (spec Testability notes): (a) Save shows overlay, Escape/OK/backdrop hides it, save completes with toast; (b) conflict: overlay gone, ed-conflict focused; (c) draft rename clash: overlay gone, rename modal focused; (d) error: overlay gone, error toast; (e) fast save flashes, no stuck focus; (f) autosave never shows it; (g) reduced-motion stops spin; light/dark. UI-kit check and changelog tests run via existing `npm test`.

## How to run
`npm test`
