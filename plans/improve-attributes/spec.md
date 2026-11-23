# Tech Spec: Improve attributes (improve-attributes)

## Overview
After creation, an owner in edit mode raises an attribute by spending Legend: a `+` in each Overview attribute tile opens a kit confirm modal; confirming dispatches `ed-edit-attribute`, which a new pure engine module (`engine/attribute-improve.js`) validates and applies by bumping only `attributes[n].increases`. A baseline of the file's attributes (`savedAttributes`, returned by `store.loadCharacter`) enforces one improvement per save and allows undo of the pending one. Derived Value/Step/defences/Legend available all cascade through existing derive; nothing new is stored.

## Guardrail alignment
- All items Tier 3 (plan "Guardrail classification"); no Tier-1 sign-off needed. No schema change (`increases` already in `ed-character/2`), no taxonomy change, no `rules/*.json` change.
- Data down / events up: Overview receives a prebuilt view-state prop and only dispatches `ed-edit-attribute { name, action }`; ed-app decides via the engine. Engine is pure, DOM-free. Only inputs stored (`increases`); training days / silver / weeks / cost / new Step are derived for display. Any null value in the modal renders the muted placeholder pill, never a number.
- Keep Tier-1 UI rules: Overview no vertical scroll on desktop, light+dark theme tokens only, kit modal (Escape closes, Enter confirms).

## Design
### Data / types
- No stored-field change. `attributes[name] = { base, points, increases }` unchanged.
- New transient ed-app property `_savedAttributes` (object or `null`); not persisted.
- `loadCharacter(id)` return gains `savedAttributes` (deep copy of the file's `attributes` before `applyEdits`). `loadDraftCharacter` returns `savedAttributes: null`.

### Modules & functions
- NEW `engine/attribute-improve.js` (imports only `valueToStep`, `attributeValue` from `engine/derive.js`; no DOM/globals):
  - `nextIncreaseCost(increases, table)` -> `table[String(increases+1)]` or `null` beyond the table's highest key (cap = max numeric key, 3).
  - `attributeImprovePlan(attributes, saved, name, { costTable, available, stepOf })` -> `{ ok, reason?, cost, newIncreases, current:{value,step}, next:{value,step}, trainingDays, silverFee, weeksWait }`. trainingDays = current Step; silverFee = current Step x 10 (sp/day); weeksWait = new Step.
  - `applyAttributeIncrease(attributes, saved, name, ctx)` and `undoAttributeIncrease(attributes, saved, name)` -> `{ ok:true, attributes }` (new objects; only `increases` changes; `base`/`points` copied) or `{ ok:false, reason, attributes }` with the SAME input reference.
  - `pendingAttribute(attributes, saved)` -> name whose `increases` > saved's, else `null`.
  - Refusal reasons: `cap`, `insufficient-legend`, `already-pending` (a different attribute pending, or the same one already pending), `no-baseline`, `unknown-attribute`, `nothing-to-undo`. Undo never goes below the saved value.
- NEW `engine/attribute-improve.test.js` (node:test).
- NEW `ui/attribute-improve-state.js` (+ `.test.js`; pattern `ui/item-equip-state.js`): pure `attributeImproveView({ attributes, savedAttributes, available, costTable, editMode, creationOpen })` -> per-row `{ show, canImprove, pending, title }` and modal content (labels/values from `attributeImprovePlan`). Hidden: edit off, creation open, null baseline (draft), `cap`. Disabled with reason title: `insufficient-legend`, other pending. Pending row: `pending:true` with undo.
- `store.js` `loadCharacter` (L787): add `savedAttributes`. Reuse `saveAttributeEdits` (L481), `reconcileOverlay(['attributes'], id)` (L698), `hasPendingEdits` (L686).
- `ui/ed-app.js`:
  - `_loadCharacter` (~L647-669) and `_reloadSaved` (~L2532, Discard) set `_savedAttributes` from `loadCharacter`; draft path sets `null`. Enumerate any other `loadCharacter(` caller (conflict "use branch"/refresh) and refresh the baseline there too.
  - `_doSave` success (~L2415, beside `reconcileOverlay`) and `_firstSaveLanded` (~L2468): `_savedAttributes = structuredClone(this._character.attributes)`.
  - Listener near L577: `this.addEventListener('ed-edit-attribute', (e) => this._editAttribute(e.detail))`.
  - `_editAttribute({ name, action })` (near `_creationEdit` L1163): guard `_character`, `_rules`, non-null baseline, not `creation.open`, edit mode. Call apply/undo with `costTable = rules.legendFile.costs.attributeIncrease`, `available = this._model.legend.available` (pre-change value). Refusal -> `_showNotice(reason text)`, no state change. Success -> `_character = {..., attributes}`; if deep-equal to baseline `reconcileOverlay(['attributes'], id)` else `saveAttributeEdits(attributes, id)`; `_dirty = hasPendingEdits(id) || (hasCustomPendingEdits() || hasCustomSkillPendingEdits())`; `_scheduleAutosave()` when dirty (use `_markDirty()` only on the non-clean path); `_model = this._derive()`. No Legend log entry.
  - Builds the view-state prop via `attributeImproveView` and passes it to `<ed-overview>`.

### UI / behavior
- `ui/ed-overview.js` `_attrCell` (L417): in the `.an` line add a compact `+` (touch-sized in stacked mobile layout, reusing `.astepbtn`/`astep` look) when `show`; disabled + `title` reason when `!canImprove`. Shown only when `_cr` (creation open) is false; creation `-/+` stepper unchanged. Pending tile shows a small "Improved this save" badge (abbreviated/dot with `title`) plus an undo control dispatching `{action:'undo'}`.
- Modal: new `ModalController` + `modalFrame` (ui/kit, docs/MODALS.md section 11 checklist; `ctl.opened(trigger)`), alongside `_karmaCtl` (L687/L1109). Content: attribute name, current -> new Value and Step (labelled natural Step, no modifier fold), LP cost, Legend remaining after, training days, silver fee, weeks-wait, reminder "must be rested and healthy (no Damage or Wounds)". Confirm button/Enter dispatches `increase`; Escape/Cancel closes.
- Theme tokens only (light + dark); no new font weights; Overview must fit desktop viewport with no vertical scroll, including `.adelt` badge + `+` + pending badge on the `.an` line at narrowest desktop width. Read-only mode shows nothing new.

### Rules
| Rule | Value | rules.md |
|---|---|---|
| Cost per increase | 1st 800, 2nd 1,300, 3rd 2,100 LP, per-step (not cumulative), from Legend, never Karma | R1 (PG pp. 447-448; rules/legend.json costs.attributeIncrease) |
| Cap / limits | max +3; one attribute at a time; rested and healthy; weeks wait = new Step (info only) | R2 |
| Training | days = current Step; fee = current Step x 10 sp/day (e.g. Step 7: 7 d x 70 sp = 490 sp) (info only) | R3 |
| Cap scope | counts `increases` only; creation `points` excluded (house ruling, 2026-11-23) | R4 |
| Derived cascade | Step, defences, health thresholds, talent steps follow automatically; nothing stored | R6 |
| Timing | any time; no GM trigger | R7 |
| Circle-based optional rule | out of scope | R5 |

### Edge cases & invariants
- Inputs never mutated; refusals return the same `attributes` reference.
- Cap: attribute with `increases` 3 -> `cap`, `+` hidden. Creation `points` do not count toward the cap.
- Legend available < cost -> `insufficient-legend`; available exactly equal to cost -> ok.
- Another attribute pending, or same one already pending, -> `already-pending` (all `+` disabled until save).
- Undo restores baseline `increases`, clears overlay (`reconcileOverlay`) and dirty dot only if nothing else pending.
- Null baseline (draft, unsaved) -> `no-baseline`, no `+`. Creation open -> no Improve.
- After save baseline = saved attributes, lock clears; reload with unsaved overlay still recognises pending; Discard resets baseline and clears pending.
- Legend available passed to the engine is the pre-change value (already includes any pending increase).

## Testability notes
- node:test units: `engine/attribute-improve.test.js` (each rule, each reason, costs equal differences of `attributeIncreaseCost` from `engine/legend-spent.js`: 800, 1300, 2100; `points`/`base` untouched; same-reference refusals); `ui/attribute-improve-state.test.js` (edit off, creation open, +3 hidden, Legend short, other pending, pending row/undo, null baseline); store test for `savedAttributes` (overlay present -> baseline = file attributes; draft null); store/engine end-to-end: apply -> `saveAttributeEdits` -> `applyEdits` -> derived Legend spent rises by cost; undo -> `reconcileOverlay` -> `hasPendingEdits` false. `npm test` incl. `tools/rules-conformance.test.js`.
- Owner manual verification: no vertical scroll on Overview (with pending badge, narrowest desktop width), mobile stacked layout, light/dark, Escape/Enter, dirty-dot clear on undo, Discard and save lock-clear, creation stepper unchanged.

## Changelog entry
`{"type": "added", "text": "Improve attributes after creation: spend Legend from a + on each Overview attribute (800 / 1,300 / 2,100 for +1 / +2 / +3), one improvement per save, with undo until saved."}`

## Out of scope
- Optional Circle-based improvement (R5); Damage/Wounds enforcement; tracking silver or weeks-wait; new stored fields or schema/taxonomy changes; improving drafts before first save; Karma spending; modifier-folded preview Step.
- Docs touched in I6: `ARCHITECTURE.md`, `docs/UI-GUIDELINES.md`, `data/changelog.json`.
