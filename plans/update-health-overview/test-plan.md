# Test Plan: Update Health overview (update-health-overview)

## Test files
- engine/health-danger.test.js
- store-health-danger.test.js

(New files beside the existing suites; engine/health.test.js and store-health.test.js are untouched.)

## Coverage
### engine/health-danger.test.js
- healthDanger: fixture 3/58/72, boundaries 47/48/57/58, beyond-Death clamp, wounds 0/1/2, Unconscious<=10 at 0 damage, missing-rating shapes (both / only Unconscious / only Death or <=0), bare-number ratings, clamping, non-mutation. Rule: R3 (amber margin is an owner choice, not a rule); R1 for wounds.
- resolveHit: WT-1/WT/WT+4/WT+5, difficulty = take - WT, null WT, take 0/negative, non-mutation. Rule: R1, R2 (WT values are test-local fixtures, not Earthdawn data).

### store-health-danger.test.js
- model.healthDanger derived from inputs and the model's own ratings, tracks damage/wounds, exists with no health stored. Rule: R3.

## Not covered (and why)
UI (no browser harness), for the owner to check by hand: ed-damage-modal (open, Escape/X/backdrop, Enter applies, focus trap/restore, show() resets to 0, Apply disabled at 0, event shapes and composed); Overview Health card (V1 layout, amber/red, gauge and tick, .pend pill, no scroll at 1280x720, mobile fold); Recoveries dice button (disabled at 0, inert in edit mode, armed bonus); plus button and old modal gone in both modes; Combat uses the shared modal. Greps: no font-weight 600, no raw font sizes, removed identifiers gone. Existing store-combat.test.js must still pass.

## How to run
`npm test`
