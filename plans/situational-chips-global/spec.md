# Tech Spec: Situational chips global (situational-chips-global)

## Overview
Every `rules/combat.json` `situations` chip becomes a session-only global live condition, generalising the Knocked Down mechanism. `ed-app` holds a `_situations: string[]` session array beside `_knockedDown` and passes it to `deriveModel(character, rules, session)` in `store.js`. The derive folds Defence mods into derived Physical/Mystic Defence and lists Active Effects rows. A pure engine helper classifies test mods into unscoped (every roll) and scoped (auto in Combat pools, per-roll toggles in the roll modal elsewhere). Nothing is stored in the character.

## Guardrail alignment
- I1 (derive session input, engine helper) and I3 (Combat chips dispatch a global toggle, UI-GUIDELINES Combat row): **Tier 1**. Sign-off is qa-log.md "B7 sign-off" (2026-10-05), which retires B7 for Situational chips only.
- I2 (`rules/combat.json`), I4 (Overview rows), I5 (roll modal), I6 (docs), I7 (tests): **Tier 3**. The Overview x control is authorised by the qa-log "Active Effects row ... clear (x)" answer, and I6 updates the UI-GUIDELINES text to match.
- No taxonomy vocabulary change. `scope` is free text (EFFECT-TAXONOMY section 6), so the new `ranged` and `movement` strings do not trigger Tier 2.
- Data flows down through render and events flow up via `dispatch`. The engine helper is pure and DOM-free. State is session-only, so only inputs are stored. Defence and test mods are derived values, never stored, and they show as derived values.
- No missed Tier-1 items.

## Design
### Data / types
- Session input: `session.situations: string[]` (active situation names), alongside `session.knockedDown`. It is not persisted and is not part of `character`.
- `rules/combat.json`:
  - Remove the `Range — Short` situation. Grep `rules/`, `ui/`, `engine/`, tests and docs: no reference may remain.
  - Surprised: add two `defense-modifier` effects (Physical and Mystic), value -3, `operation:'add'`, `measure:'rating'`, `condition:'situational'`, `source:'condition'`. Mirror the Blindsided objects. Keep the "no actions" note.
  - Range Long test-modifier: add `scope:"ranged"`.
  - Impaired Movement Light and Heavy test-modifiers: add `scope:"movement"`.
  - Darkness keeps `scope:"sight"`.
- Helper output type: `{ unscoped: [{label, value, measure}], scoped: [{label, value, measure, scope}] }`, where `measure` is `'step'` or `'result'`.

### Modules & functions
- `engine/combat.js`
  - New export `situationRollMods(activeNames, rules)`.
    - It resolves names against `rules.combat.situations` and skips unknown names.
    - It ignores "Knocked Down" (sole source is `session.knockedDown`).
    - It collects `test-modifier` effects with target `{domain:'test', name:'Action'}`. Unscoped means no `scope`. Scoped means it has a `scope`. `measure` is carried through. The label is the situation name.
  - New exported constant for the roll kinds exempt from unscoped penalties: `UNSCOPED_EXEMPT_KINDS = ['karma']` (single point of change).
  - `appliesToTest`: for the Action target on `kind==='damage'`, also admit `e.scope === 'ranged'` (alongside `except-knockdown`). Darkness (`sight`) and Impaired Movement (`movement`) stay out of damage pools. Attack pools still admit all scopes, with the `sight` gating via `ctx.sightBased` unchanged.
  - `collectCombatEffects` (~515-600): global active situations strip their defence mods (already folded into derived Defence) and their unscoped test mods (they now ride the roll-time path). Scoped test mods are kept: attack pools get all scopes, damage pools get `ranged` only. Remove the "locked Harried keeps Action -2 in pool" exception so Harried is not counted twice. The net Combat attack Step for Harried is unchanged. Update the docblock.
  - `foldCombatRatings` (~627): no longer adds situation defence mods again. Only option and charm mods remain, so Combat Defence reads the folded model value.
- `store.js`
  - `deriveModel` (~1011-1064): build the effective situation set as the chip names plus encumbrance-Harried, deduped by name. When Burdened, Harried comes from `encumbranceEffects` only and the chip is ignored in the fold. For each active situation, append its `defense-modifier` effects to `conditionDefenseEffects` (folded into `foldedEffects`, hence derived Defence). Append its other `effects` to `conditionEffects` with `origin:{kind:'condition', name}`. Knocked Down keeps its existing `KNOCKED_DOWN_*` branch.
  - `model.combat.conditions` (~1557) gains `situations: string[]` (active names). Existing `knockedDown` and `harried` keys are unchanged.
  - `activeEffects` (~1740) lists the new condition effects.
  - Verify that the `engine/characteristics.js` per-target fold collapse (109-124) does not merge same-target effects from different origins.
  - Expose the model data the modal needs, for example `stepByNumber` (already present).
- `ui/ed-app.js`
  - Add `_situations: { state: true }`, default `[]`.
  - `_derive()` (~835) passes `situations: this._situations`.
  - New event `ed-toggle-situation` (`detail:{name}`) handled next to `ed-edit-knockdown` (408). The handler toggles the name, and ignores "Knocked Down" and encumbrance-Harried. It appends a roll-log action entry like Knocked Down does.
  - Reset `_situations = []` on character switch (~515) and in `_dayResetFinalize` (~932).
  - `_rollTimeMods({kind, apply})` (~1496) returns `{label, value, measure}`. It includes Knocked Down (result -3), unscoped situation mods and encumbrance Harried, skipped for `UNSCOPED_EXEMPT_KINDS`.
  - Scoped mods for the modal:
    - Add them as optional entries `{label, value, measure, optional:true, on:true}` on rolls that are not a Combat pool attack or damage roll.
    - On `kind:'damage'` rolls elsewhere, offer only `scope:'ranged'`.
    - Combat attack and damage pool rolls get no toggle, because the pool applies them (no double count).
  - `_rollConfig` (~1518-1557): sum step-measure mods into `rollStep`, clamp to min Step 1, then do the `stepByNumber` lookup. This sits alongside the existing recovery step bonus. Result-measure mods go into `mods` as today.
  - The config also passes the base step and the `stepByNumber` map so the modal can re-resolve.
- `ui/ed-roll-modal.js`
  - Render optional mods as pre-ticked checkboxes in tab order. Escape closes and Enter confirms, per docs/MODALS.md and `ui/modal-controller.js`.
  - Ticking re-resolves the Step row (min Step 1) for step-measure mods, or adjusts the total for result-measure mods.
  - Unticked mods are excluded from the dice, total, breakdown and Roll Log entry.
  - Put the re-resolve and total logic in a pure function (suggested `resolveOptionalMods({baseStep, mods, stepByNumber})`) so it can be unit-tested.
- `ui/ed-combat.js`
  - `_toggle`: Situational chips dispatch `ed-toggle-situation`. Knocked Down keeps `_fallDown`/`_standUp`.
  - `_situations()` (1030-1038): active state comes from `model.combat.conditions.situations`. Knocked Down and encumbrance-Harried stay locked.
  - `_poolEffects()` (~620) passes the global situations to `collectCombatEffects`.
  - `_sits` (81, 314, save/restore ~407-443) no longer holds Situational names. It keeps spell-situational chips (`_situationalSpells`), combat options and charms. Any stored Situational names are ignored harmlessly.
- `ui/combat-mods-state.js`: persistence stops saving Situational names. Stored names from older sessions are ignored.
- `ui/ed-overview.js` (~815-850): each active situation renders as a condition row, grouped by origin name. Each row gets a real `<button>` x with `aria-label`, dispatching `ed-toggle-situation`. Knocked Down keeps Stand up. The encumbrance-Harried row has no x.
- Docs (I6): `docs/UI-GUIDELINES.md` (Combat row, Overview Active Effects), `docs/THREAD-ITEMS.md:166` (B7), `ARCHITECTURE.md` (derive inputs: `knockedDown`, `situations`), `plans/PLAN-COMBAT-TAB.md` note, and the `engine/combat.js` docblock.

### UI / behavior
- Clicking a Situational chip on Combat toggles it app-wide. Click again, or the x in Overview Active Effects, clears it.
- Derived Physical/Mystic Defence reflects the active chips on every tab. Mods are additive with no cap.
- Roll breakdowns list applied modifiers.
- Non-Combat roll modal: pre-ticked checkboxes appear only when a scoped penalty is active. Nothing is shown when none is active.
- Overview must still fit the desktop viewport with no vertical scroll when several chips are active. The Active Effects panel stays compact or scrolls internally.
- New styling reuses `.aefx-row` and `.stand` tokens, `--fs-*` and theme variables. Check light and dark.

### Rules
| Rule | Value / formula | rules.md id and source |
|---|---|---|
| Blindsided | -2 Physical and Mystic Defence | R1, PG 14546-14554, 14595 |
| Surprised | -3 Physical and Mystic Defence; "no actions" stays a note | R2, PG 14684-14688 (owner: follow book) |
| Partial Cover | +2 Physical and Mystic Defence | R3, PG 14557-14567, 14584 |
| Full Cover | No numeric effect (cannot be attacked), note only | R3 |
| Darkness | Partial -2, Full -4, scope `sight`, Step | R4, PG 14585-14586 (owner: per-roll toggle) |
| Range Long | -2 Step to Attack and Damage tests (scope `ranged`). Example: attack 13 to 11, damage 10 to 8 | R5, R9, PG p.390 lines 14667-14678 |
| Range Short | No modifier, chip removed | R9 (owner) |
| Impaired Movement | Light -2, Heavy -4, scope `movement`, per-roll toggle; Movement Rate reduction stays a note | R5 (owner) |
| Stacking | Additive, no cap (Surprised + Blindsided = -5, player-managed) | R6 (owner) |
| Harried | -2 Step to every roll except the Karma die, plus -2 Physical and Mystic Defence | R7, R8 (inference for non-Action tests; owner chose unscoped on every roll) |
| Knocked Down | -3 result mod on every roll (existing app convention, differs from the book's Step default), plus -3 Physical and Mystic Defence | R7, R8 |
| Step floor | Step modifiers applied before the dice lookup, min Step 1 | R6, R8 |

### Edge cases & invariants
- Knocked Down is sourced only from `session.knockedDown`. A "Knocked Down" entry in `situations` is ignored and gives one -3 only.
- Harried chip plus Burdened gives one -2, not two.
- A Harried -2 Combat attack and a Harried -2 Skill roll land at the same Step, including the min Step 1 clamp.
- Knocked Down stays a flat -3 on the total, not a Step change.
- Damage rolls elsewhere offer only Range Long. Darkness and Impaired Movement never touch a damage pool or damage roll.
- Combat attack and damage pool rolls show no scoped toggle, because the pool already applies the penalty.
- Unknown situation names are skipped. `character` is not mutated. The engine has no DOM.
- Clearing a chip restores the derived Defence and Step. Resets (character switch, day-reset finalize) clear `_situations`.
- No `Range — Short` remains anywhere.

## Testability notes
- node:test units:
  - `engine/combat.test.js`:
    - `situationRollMods` split and `measure` carried through.
    - `collectCombatEffects` strip rules: defence stripped, unscoped stripped, scoped kept.
    - `appliesToTest` with the `ranged` scope on damage. Range Long on gives attack 13 to 11 and damage 10 to 8, and off restores. Darkness and Impaired Movement leave the damage pool unchanged.
  - `store-combat.test.js` and `store-health.test.js`:
    - Blindsided gives -2 on both Defences.
    - Surprised + Blindsided gives -5. Surprised gives -3 on both.
    - Cover gives +2.
    - Blindsided + Harried + Knocked Down sum.
    - Clearing restores.
    - Harried chip + Burdened gives -2 once.
    - "Knocked Down" in `situations` is ignored.
    - `character` is not mutated.
    - `model.combat.conditions.situations` is correct.
  - `tools/rules-conformance.test.js`: the edited `combat.json` passes, and there is no Range Short situation.
  - `ui/combat-mods-state.test.js`: persistence no longer stores Situational names.
  - The pure `resolveOptionalMods`: Step re-resolution with min Step 1, and result-mod totals.
- Seams: `_rollTimeMods` and `_rollConfig` logic can be extracted into pure functions for tests if needed.
- Manual verification by the owner:
  - Overview viewport fit with several chips active.
  - Light and dark themes.
  - Modal Escape/Enter and keyboard use of the x and checkboxes.
  - Roll Log entries.

## Changelog entry
Situational chips (Blindsided, Cover, Darkness, Surprised, Range Long and others) now apply across the whole app: Defence updates on every tab, penalties apply to rolls, and each active chip shows in Overview Active Effects with a clear button. Surprised now applies its -3 Defence, and Range Long also affects damage.

## Out of scope
- Spell-driven situational chips (Aspect of the Casual Murderer), Combat-option chips and blood-charm chips stay informational or Combat-local.
- Storing chip state in the character or persisting across reload.
- New Overview rows beyond Active Effects entries.
- Movement Rate reduction (stays a note).
- Changing Knocked Down from result to Step.
- Automatic handling of Heat Sight and Low-Light Vision (manual via the per-roll untick).
- Enforcing Surprised vs Blindsided exclusivity.
