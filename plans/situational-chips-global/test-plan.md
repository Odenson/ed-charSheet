# Test Plan: Situational chips global (situational-chips-global)

## Test files
- engine/situations.test.js (new)
- store-situations.test.js (new)
- engine/combat.test.js (changed: 12 to 11 situations, Range Short removed from the note-only list, locked-Harried pool test now expects no Action -2)
- store-combat.test.js (changed: situations count 11, `conditions.situations` key)

## Coverage
### engine/situations.test.js
- **combat.json data cases** (no Range Short anywhere; Surprised -3 Phys/Mystic with note kept; scopes ranged/movement/sight) - Validates T2, T8, spec Data. Rule: R2, R4, R5, R9. Catches missing data edits.
- **UNSCOPED_EXEMPT_KINDS** is `['karma']` - spec single point of change. Rule: n/a.
- **situationRollMods** (split + measure carried; Knocked Down/unknown ignored; defence-only chips yield nothing; no mutation) - T1. Rule: R7, R8.
- **collectCombatEffects strips** (defence + unscoped stripped; locked Harried not in pool; scoped kept) - T3 no double count. Rule: R7.
- **Range Long attack 13 to 11, damage 10 to 8, off restores** - T8. Rule: R5, R9.
- **Darkness / Impaired Movement never touch damage pool; additive scoped stacking; sightBased false skips Darkness** - spec edge cases. Rule: R4, R5, R6.
- Assumption: the global set reaches `collectCombatEffects` as `conditions.situations` (the spec says `model.combat.conditions` gains `situations` and `_poolEffects` passes it through; the exact parameter is not named).

### store-situations.test.js
- Blindsided -2, Surprised -3, Surprised+Blindsided -5, Partial Cover +2, Full Cover 0, Blindsided+Harried+Knocked Down -7 on Physical and Mystic Defence; Social unchanged. Rule: R1, R2, R3, R6, R7.
- Clearing/unknown names restore; "Knocked Down" in situations ignored (single -3 only). Rule: R7.
- Active Effects condition rows named by chip; `conditions.situations` lists active names.
- Harried chip + Burdened gives -2 once. Rule: R7.
- No mutation of character or session; nothing stored.

### engine/combat.test.js, store-combat.test.js (edits)
- Updated existing assertions that encoded the old behaviour (12 situations, Range Short, locked Harried Action -2 in pool).

## Not covered (and why)
- `resolveOptionalMods` (modal Step re-resolve with min Step 1, result-mod totals): the spec only "suggests" this name and it would live in `ui/ed-roll-modal.js`, which imports Lit and cannot load under node. Not imported, to avoid asserting an unpromised symbol. If the dev extracts it into a DOM-free module, ask the tester to add a test.
- `_rollTimeMods` / `_rollConfig` (Knocked Down result -3, Harried step -2 on every roll except karma, Step clamp, Harried attack vs skill parity): live in `ui/ed-app.js`. Same reason.
- `ui/combat-mods-state.js` persistence of Situational names: the module has no persistence logic to test; the save/restore lives in `ed-combat.js`.
- Manual (owner): Combat chip toggles Overview Defence; Overview x (click and keyboard) and Stand up; Overview fits the viewport with several chips; light/dark; roll modal pre-ticked checkboxes (shown only with a scoped penalty, none on Combat pool rolls, Damage rolls offer only Range Long), Escape/Enter; Roll Log lists only applied mods; reset on character switch and day-reset.

## How to run
`npm test`
