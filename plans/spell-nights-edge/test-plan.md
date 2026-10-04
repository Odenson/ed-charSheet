# Test Plan: Night's Edge (spell-nights-edge)

## Test files
New:
- engine/dice-bonus.test.js
- engine/spells-nights-edge.test.js
- engine/combat-bonus-dice.test.js
- store-nights-edge.test.js
- ui/combat-log-rows-nights-edge.test.js

Existing files changed by the tester (the dev may not modify these):
- tools/rules-conformance.test.js (v5 literal -> v6; adds `validateObject` / `validateDiceValue` and their data and fixture tests)
- tools/dev-server.test.js (stamped taxonomy literal v5 -> v6, line ~179)
- tools/worker/worker.test.js (stamped taxonomy literal v5 -> v6, line ~657)
- engine/combat.test.js (four `damagePool` deepEqual assertions now include `bonusDice: []`)

## Coverage
### engine/dice-bonus.test.js
- parseDice "D4"/"2D6"/"D4+D6"/all sizes -> `[{count,sides}]`; junk (empty, D7, "D4+", spaces, non-strings) -> null. Validates I4 parser. Rule: n/a (grammar from spec).
- rollDiceList: max roll explodes and repeats; non-max does not; each die of a count explodes independently; groups total together; separate from step dice. Validates I4/I5a. Rule: R5 (inference, moderate confidence).

### engine/spells-nights-edge.test.js
- Catalog entry stat block, success level, three extra threads, step extra thread with same `object`, D4 base effect (not gmDiscretion), -2 MD note (gmDiscretion), fixed summary, option counts. Rule: R1, R2, R3, R4.
- spellObjectRequirement, weaponOccurrence (0,0,1; shift on unequip). Rule: R3.
- buildActiveSpell: `chosen`, no `object` on record, string D4 never boosted, duration Rank+5 (+2 per extra success), standalone step pick with object, label rule, Arrow of Night regression. Rule: R1, R2.
- activeSpellEffects stamping: `object` + `chosen` only on object-bearing effects.
- castWeaponChoices: plain / "Spear (2nd)" / "(3rd)" labels, any type, empty + reason, kind mismatch, non-object spell never empty. Rule: R3.
- weaponMysticDefense, nextCastNumber (untouched re-prefill, touched keeps, no weapon null). Rule: R6.
- wastedCastLogEntry shape; effectReadout not 'step' and no NaN; otherCastOutcome text contains D4. Rule: R1, R4.

### engine/combat-bonus-dice.test.js
- D4 lands in `damagePool().bonusDice` for the chosen weapon only, never in `step`; attack pool unaffected. Rule: R2, R3, R5.
- Duplicate-name index match and shift-on-unequip; absent when not selectable, back on re-equip.
- +2 Damage Step folds on the same weapon only.
- `activeSpellBundlesFor` object.kind replaces scope; Arrow of Night (scope, no object, 3-arg and legacy 2-arg) unchanged.
- auditPool part `kind:'dice'`; empty `bonusDice` when none.

### store-nights-edge.test.js
- `equippedWeapons[].mysticDefense`: Orc Stinger 10, Ork Dagger null. Rule: R6.
- No-NaN: an active Night's Edge record leaves derived ratings unchanged and finite; dice effect visible in `activeEffects`.
- Roll Log round-trip of the wasted entry and a `bonusResult` entry; old entries without it load.

### ui/combat-log-rows-nights-edge.test.js
- Wasted entry renders label, outcome word, dashes. Bonus group shows its total in detail (loose assertion; exact wording not pinned). Old entries render unchanged.

### tools/rules-conformance.test.js
- Doc is v6, all rules refs v6, doc defines dice grammar / object kinds / Night's Edge example, every effect in `rules/*.json` passes the validators, and validators reject malformed kind/require, malformed dice, number on dice, dice string on other measure (T1).

## Contract assumptions (flag for adjudication if wrong)
- `castWeaponChoices` ctx is `{ spell, equippedWeapons }` (spec says only `ctx`).
- `damagePool().bonusDice` is an array (empty when none); entry shape beyond containing the spell-name label is not pinned.
- `rollDiceList` returns one `dice` entry per physical die (count expanded).

## Not covered (and why)
UI is verified by the owner by hand (plan's "Owner manual verification"): cast modal flow (Escape/Enter/Tab trap, focus return, hand-off without returning focus, Karma re-roll not reopening it), "No equipped weapon" / "Cast on nothing" state and `_prog` reset, `_castOnNothing` null-total tolerance in `_rollRes`/banner/persisted snapshot, "vs" box hidden for this case, Active effects row naming the weapon, Combat Damage pill "Step N + D4" and audit line, roll-modal bonus group (explosion, total, Karma/re-roll), Roll Log and Notes/Spells log readers, Target effects penalty text, theme/type tokens, armed Anticipate Spell staying armed. Also not unit-tested: the `ed-app` pure helper adding the bonus to `_grandTotal` (name not in the spec) and the reader audit (recorded in build log); string-version greps (`npm test` conformance covers rules/worker/dev-server).

## How to run
`npm test`
