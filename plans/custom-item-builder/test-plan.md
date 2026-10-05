# Test Plan: Custom item builder: unarmed weapons (custom-item-builder)

## Test files
- custom-item-builder-unarmed.test.js

## Coverage
### custom-item-builder-unarmed.test.js
- damageStepEffect shape/summary (R3), +0 effect (R4), null cases, isDamageStepEffect matching: validates the pure helpers.
- cleanItemForm generation: one effect, first; none when empty; damageStep 0 kept (R4); strMin/size 0 still dropped, cost 0 kept; negative/decimal/NaN error; duplicate-effect guard ("use the Damage Step field"), also without a field value; non-weapon untouched.
- Unarmed: ranges stripped (R2), melee keeps ranges, unarmed passes validateItem.
- seedDamageStep: effect-only, field wins, empty-string field, field-only, two effects, stored 0, non-weapon, no mutation, seed+clean round trip.
- Why: catches regressions in the single-source Damage Step behaviour and the legacy-item migration.

## Not covered (and why)
No DOM harness; owner verifies by hand: category dropdown offers four options; Unarmed hides range inputs and clears them, switching back shows empty ranges; read-only "from Damage Step" row updates per keystroke (light/dark); invalid value shows inline error and disables Save; hand-added Damage effect shows error; Damage Step hint text; Quick-template strip hidden for weapons; editing a legacy weapon seeds the field; Gauntlet appears in Combat Weapon picker and rolls Strength + Damage Step with Unarmed Combat. Changelog/docs entries are not tested.

## How to run
`npm test`
