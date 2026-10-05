# Tech Spec: Custom item builder: unarmed weapons (custom-item-builder)

## Overview
Extend the custom-item builder so a weapon can be category `unarmed` (e.g. a +1 Gauntlet). The Damage Step field (`ref.damageStep`) becomes the single input for weapon damage: a pure helper in `ui/custom-item-builder.js` derives the `attack-modifier` Damage effect from it at clean time, and the form shows it as a read-only row. `cleanItemForm` also keeps `damageStep: 0`, validates it, guards hand-added duplicates, and strips ranges for unarmed. `_editItem` seeds the field from legacy effects. No engine, schema, taxonomy or data changes.

## Guardrail alignment
All changes Tier 3 (builder UI behaviour, existing field, existing category tag, bug fix); no Tier-1 sign-off needed, no Tier-2 taxonomy change (the generated effect uses existing vocabulary `attack-modifier` / `attack|Damage` / `add` / `step`). Data flows down through render, events up through the existing `_setRef`/`_setFormItem` setters. The UI computes no game values: the only derived thing is a restatement of the input as an effect, produced by a pure helper and validated by the shared `validateItem`. Engine untouched (stays pure). Only inputs are stored (`ref.damageStep` plus the generated effect, which is the same data restated; it is never held in form state). No new derived pills. Styling uses existing tokens only (light and dark).

## Design
### Data / types
- No schema changes. Stored weapon item: `{kind:'weapon', ref:{category, damageStep, ...}, effects:[<generated Damage effect first>, ...hand-added]}`.
- Generated effect shape: `{type:'attack-modifier', target:{domain:'attack',name:'Damage'}, operation:'add', value:<damageStep>, measure:'step', condition:'always', source:'item', summary}` (built via `finishEffect`/`summaryFor`).
- Form state (`this._form.item.effects`) never contains the generated effect.

### Modules & functions
`/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/custom-item-builder.js`
- New export `damageStepEffect(step)`: returns the effect above, or `null` when `step` is `undefined`/`''`/not a finite integer >= 0. `step` of `0` yields a `+0` effect (summary "Adds +0 Damage step").
- New export `isDamageStepEffect(e)`: `type==='attack-modifier' && target?.domain==='attack' && target?.name==='Damage' && operation==='add' && measure==='step'`.
- New export `seedDamageStep(item)`: pure, returns a new item. Non-weapon: returned unchanged. Weapon: find first `isDamageStepEffect` effect; remove it from the returned `effects`; if `ref.damageStep` is `undefined`/`''`, set it to that effect's `value` (a stored `0` counts as 0). If the field is already set, the field wins (effect just dropped). Further matching effects remain.
- Change `cleanItemForm(name, item)`:
  - Ref loop: keep `0` only for keys `cost` (existing) and `damageStep`; all other keys keep `v !== 0` dropping (`strMin`, `size` unchanged).
  - Weapon only: if `ref.damageStep` is defined and not a finite integer >= 0, push error "Damage Step must be a whole number of 0 or more" and generate no effect. If any form effect satisfies `isDamageStepEffect`, push error mentioning "use the Damage Step field". Errors return `{ok:false, errors}` before `validateItem`.
  - Weapon only, valid step: prepend `damageStepEffect(step)` to `effects` (exactly one).
  - Weapon with `category==='unarmed'`: omit `shortRange` and `longRange` from the clean ref.
  - Non-weapon kinds: no generation, no guard.
- `engine/validate-item.js`: NOT modified (does not enumerate categories; `unarmed` passes).

`/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-custom-item.js`
- `REF_FIELDS.weapon` category options become `['melee','missile','throwing','unarmed']`; `damageStep` field def gets `hint` (text stating the Damage Step is added to Strength step, also for unarmed weapons).
- `QUICK_TEMPLATES.weapon = []` (strip hides, as `ammunition: []`).
- `_editItem` (l.~194): run the deep-copied item through `seedDamageStep`.
- Ref grid: number fields render a `.hint` span when `rf.hint`; the Damage Step input uses `@input` (not `@change`) so the read-only row updates per keystroke; for weapon with category `unarmed`, filter out `shortRange`/`longRange` fields.
- Category select handler: when the new value is `unarmed`, also remove `shortRange`/`longRange` from `ref` (via a `_setRef` variant or a `_setFormItem` ref update; no new game logic).
- `_formView` Effects group: for weapon kind, render a read-only muted `.erow` from `damageStepEffect(item.ref?.damageStep)` above the editable rows, tagged "from Damage Step", no edit/remove controls. Weapon empty-state text must still read sensibly. Custom-items list sub-line (`effects[0].summary`, ~l.389) naturally shows "Adds +N Damage step".

### UI / behavior
- Category dropdown offers four options. Choosing unarmed hides range inputs and clears stored ranges; switching back to melee shows empty range inputs.
- Typing a Damage Step updates the read-only row live. Invalid value (negative, decimal, NaN) shows the inline error via the existing `_formErrors` path and disables Save. Empty field: no row, no effect.
- A hand-added `attack/Damage add step` effect shows an inline error ("use the Damage Step field") and disables Save.
- Modal Escape/Enter behaviour unchanged (shared `ui/modal-controller.js`). Overview viewport fit not affected. Combat needs no change: store reads `ref.damageStep`; `ed-combat.js` shows `dmg 0` for a 0 step.
- Landing constraint: the generated-effect work and seed/guard must ship in the same commit.

### Rules
| Rule | Value / formula | rules.md id, source |
|---|---|---|
| Unarmed damage | Strength step with no base fist step; weapons add Damage Step to Strength | R1, FAQ Q025 (PG p.177, 378-379) |
| Unarmed range | Close combat, no range increments, so no short/long range for unarmed | R2, FAQ Q025 (PG p.391-392) |
| Unarmed-weapon damage | House convention: Strength step + item Damage Step (additive) | R3, owner decision 2026-10-05 |
| Damage Step 0 | Valid and stored | R4, owner decision 2026-10-05 |

### Edge cases & invariants
- Field and generated effect always agree; exactly one generated Damage effect per valid weapon; none when empty/invalid.
- `damageStep: 0` round-trips (clean, save, reopen shows 0); `strMin: 0`, `size: 0` still dropped; `cost: 0` still kept.
- Seed cases: effect only (field seeded), field plus agreeing/disagreeing effect (field wins), field only, two matching effects (first consumed, second stays and triggers guard), non-weapon untouched, stored `0` effect seeds 0.
- User clearing the field after open is respected (seed only runs in `_editItem`).
- Kind change resets `ref: {}`; nothing generated for non-weapons.
- Stale ranges on an unarmed item are stripped at clean time.
- Not changed: `unarmed` item passes `validateItem`.

## Testability notes
Node:test (`/Users/garyfebbrarino/Work/workspace/EDCharSheet/custom-item-builder.test.js`, root-level; `ui/custom-item-state.test.js` only if state helpers change): `damageStepEffect` (value, summary, source, condition, null cases, invalid); `cleanItemForm` (generated effect single and first, empty none, `damageStep:0` sibling to the "cost 0 kept" test, `strMin` 0 dropped, negative/decimal/NaN error, duplicate guard error and otherwise validator-passing, unarmed strips ranges, melee keeps them, unarmed passes `validateItem`, non-weapon no effect); `seedDamageStep` cases above. Existing l.27 test (effect built directly) stays valid. Manual (owner): read-only row look in light/dark, per-keystroke update, range hide/clear, Gauntlet in Combat Weapon picker after None and Unarmed rolling Strength + Damage Step with Unarmed Combat. Run `npm test`.

## Changelog entry
Two entries in `unreleased.changes`: `{type:'added', text:'Custom item builder: weapons can now be Unarmed (e.g. a Gauntlet), with range fields hidden for them.'}` and `{type:'fixed', text:"Custom item builder: a weapon Damage Step of 0 is now kept, and the Damage Step field is the single source for the weapon's Damage effect."}`. Also docs: `plans/PLAN-CUSTOM-ITEMS.md` (§6.2 categories, ranges "shown except for unarmed", drop Damage template, build note), re-check `docs/UI-GUIDELINES.md`; `docs/THREAD-ITEMS.md` already lists `unarmed`.

## Out of scope
Seed data / `rules/*.json` / `data/` items; engine, schema or taxonomy changes; hiding range for melee; storing 0 for `strMin`/`size`; changes to Combat UI; changes to `engine/validate-item.js`.
