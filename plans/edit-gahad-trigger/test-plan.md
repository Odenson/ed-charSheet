# Test Plan: Edit Gahad trigger (edit-gahad-trigger)

## Test files
- store-traits.test.js

## Coverage
### store-traits.test.js::saveTraitsEdits / overlay (3 cases)
- **Validates:** T1 / I1: whole-array `traits` overlay; applyEdits yields it; hasPendingEdits true; reconcileOverlay clears; an empty array is still applied.
- **Rule:** n/a
- **Why:** catches `traits` missing from SAVED_CATEGORIES or applyEdits.

### store-traits.test.js::applyGahadTrigger (11 cases)
- **Validates:** T3 / I1: update (name/type/relatedTo/other keys preserved, trimmed, blank keys omitted, undefined as blank), create default "Gahad trigger", remove, both-blank-no-trait creates nothing, non-Gahad and non-trigger traits untouched, first-match-only, no input mutation.
- **Rule:** R2 (editable any time, single trigger); R1 (free text)
- **Why:** catches data loss on existing traits, spurious empty traits, and mutation.

### store-traits.test.js::gahadTriggerChanged (5 cases)
- **Validates:** I2: no spurious dirty/event for identical, whitespace-only, undefined vs "", null prefill with blanks; real changes detected.
- **Rule:** n/a
- **Why:** catches spurious dirty marking.

## Not covered (and why)
No ed-app/Lit harness. Verify manually: fields shown only for Ork and prefilled; trigger values never leak into the meta patch; Escape/Enter; light/dark; mobile single column; Gahad "i" modal updates after save; dirty dot only when changed; reload persistence; GitHub save reconcile; Overview viewport fit.

## How to run
`npm test`
