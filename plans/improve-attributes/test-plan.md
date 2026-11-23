# Test Plan: Improve attributes (improve-attributes)

## Test files
- engine/attribute-improve.test.js
- ui/attribute-improve-state.test.js
- store-attribute-improve.test.js

## Coverage
### engine/attribute-improve.test.js
- nextIncreaseCost: 800/1300/2100, null at cap, agrees with `attributeIncreaseCost` differences. Rule R1, R2.
- attributeImprovePlan: ok plan fields (cost, newIncreases, current/next value+step, trainingDays = current Step, silverFee = Step x 10, weeksWait = new Step; Step 7 example 7 d / 70 sp), per-step costs, every refusal reason, Legend exactly equal to cost is ok. Rule R1, R2, R3.
- applyAttributeIncrease: only `increases` changes, inputs not mutated, creation points excluded from cap (R4), cap/insufficient-legend/already-pending/no-baseline/unknown-attribute refusals return the SAME attributes reference, next increase allowed after baseline catches up. Rule R1, R2, R4, R6.
- undoAttributeIncrease: restores baseline, nothing-to-undo, no-baseline, unknown-attribute. Rule R2.
- pendingAttribute: names the pending attribute or null.

### ui/attribute-improve-state.test.js
- Rows hidden for edit off, creation open, null baseline, +3 cap; disabled with title for Legend short or another pending; pending row flagged; inputs not mutated. Rule R1, R2. Container shape of the return value is not fixed by the spec, so `rowOf()` accepts `view.rows[name]`, `view[name]` or an array of rows with `name`.

### store-attribute-improve.test.js
- apply -> `saveAttributeEdits` -> `applyEdits` replaces the attribute; undo -> `reconcileOverlay(['attributes'])` -> `hasPendingEdits` false. Rule R1.

## Not covered (and why)
- `store.loadCharacter` returning `savedAttributes` (needs network/fetch mocking of `readCharacterFile`/`loadRules`; no existing harness). Owner/reviewer to verify: overlay present -> baseline = file attributes; draft -> null.
- All ed-app wiring and UI (no browser harness); owner to verify manually: `+` per tile in edit mode after creation, confirm modal (values, LP cost, Legend after, training days/silver/weeks info, rested and healthy reminder, Escape closes, Enter confirms), pending badge + undo, all `+` disabled while one is pending, dirty dot clears on undo, Discard resets baseline, lock clears after save, creation stepper unchanged, Overview has no vertical scroll at the narrowest desktop width, mobile stacked layout, light and dark themes.
- Derived Legend spent/available cascade (covered by existing engine tests; not retested).

## How to run
`npm test`
