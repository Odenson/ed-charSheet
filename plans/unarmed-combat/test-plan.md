# Test Plan: Unarmed Combat (unarmed-combat)

## Test files
- engine/combat.test.js

## Coverage
### engine/combat.test.js::unarmed: UNARMED_WEAPON has the promised shape and is frozen
- **Validates:** T1 descriptor shape.
- **Rule:** R1 (Damage Step 0)
- **Why:** Catches a wrong step/category or a mutable constant.

### ::unarmed: Damage Step is Strength step + 0 ...
- **Validates:** T1 damagePool: 7 -> 7, null Strength -> null, bonusSteps add (4 -> 11), null stays null with a bonus.
- **Rule:** R1
- **Why:** No fabricated step; Unarmed is Strength-only.

### ::unarmed: attackTalentNamesFor(UNARMED_WEAPON.category) ...
- **Validates:** T1 talent filter is ['Unarmed Combat'].
- **Rule:** R2

### ::unarmed: audit sum equals the damage pool step
- **Validates:** T2 audit invariant (Strength step + Unarmed Damage Step 0 + bonus).
- **Rule:** R1, R3

### ::successDamageSteps: +2 Damage steps per level ...
- **Validates:** T4 helper and EXTRA_SUCCESS_DAMAGE_STEPS = 2; 0/negative/null/undefined/NaN/Infinity -> 0.
- **Rule:** R3

### ::success levels to damage steps end to end
- **Validates:** T4 11 vs 5 = +2, 17 vs 5 = +4, miss = 0.
- **Rule:** R3

### ::auditPool: damage breakdown carries both bases and the success-level bonus (rewritten)
- **Validates:** T4 audit row shows 4 steps for 2 levels; sum equals damagePool.
- **Rule:** R3
- **Why:** The old test encoded +1 per level.

## Not covered (and why)
UI (no browser harness); owner verifies manually:
- Weapon dropdown shows None / Unarmed ("Unarmed · dmg 0") / equipped weapons.
- Unarmed + Unarmed Combat + target: attack labelled "Attack - Unarmed", Hit/Miss, then Damage enabled and rolls Strength step plus +2 per level; manual success count also +2 each.
- Character without Unarmed Combat shows "No matching talent/skill"; None unchanged (free action, no damage step).
- Badge shows steps; audit "Attack success levels" row shows +2 per level.
- Equipping a custom weapon named "Unarmed"/"None" does not collide (`equipped:` key prefix); removed stored weapon falls back to None.
- Light and dark rendering.

## How to run
`npm test`
