---
status: building
---
# Delivery Plan: Improve attributes (improve-attributes)

## Context & learnings
After creation is finished, an owner in edit mode can raise an attribute by spending Legend Points (not Karma): 800 / 1,300 / 2,100 for the 1st/2nd/3rd increase (PG pp. 447-448, rules.md R1). Owner decisions (qa-log 2026-11-23): cap of +3 counts only `attributes[n].increases` (creation `points` excluded, R4 house ruling); enforce Legend cost + cap + one improvement per save; show training days (= current Step), silver (Step x 10 sp/day) and weeks-wait (= new Step) as info only; no Damage/Wounds check, no tracking of silver/weeks, no new stored fields; standard rule only (no Circle-based optional rule, R5); UI = a `+` on each attribute row in the Overview opening a confirm modal; while one improvement is pending (unsaved) all `+` are disabled, and the pending one can be undone.

## Discoveries
- `engine/legend-spent.js` `attributeIncreaseCost(increases, table)` already prices the cumulative cost of `increases` (per-step table, returns null beyond the table). `rules/legend.json` line 37: `costs.attributeIncrease = {1:800,2:1300,3:2100}`. The Legend-spent audit already counts `increases`, so `legend.available` (derived in `store.js` deriveModel ~L1662 via `legendAvailable(totalEarnt, spent.total)`) drops automatically once `increases` is bumped. It already includes any pending increase.
- `engine/derive.js`: `attributeValue(attr)` = base + points + increases; `valueToStep(value)` gives the Step. Reuse for the modal's new Value/Step (raw, natural Value; always-on item/racial modifiers are not folded into the preview).
- `store.js` L481 `saveAttributeEdits(attributes, id)` writes the whole `attributes` map into the overlay; `applyEdits` L719 REPLACES the map; `attributes` is already in `SAVED_CATEGORIES`, so dirty marking and `reconcileOverlay` after save already work. `reconcileOverlay(['attributes'], id)` can clear only that category.
- Saved baseline: `loadCharacter(id)` (store.js L787) returns the overlay-merged character only; the raw file is `fileCharacter` inside it. ed-app keeps no baseline. Plan: `loadCharacter` additionally returns `savedAttributes` (the file's `attributes` before `applyEdits`); ed-app holds `_savedAttributes`, set in `_loadCharacter`, and set to a copy of `_character.attributes` after a successful non-draft save (ed-app ~L2413-2415 next to `reconcileOverlay`). A draft has no file, so its baseline is null and Improve is unavailable for drafts (unsaved new characters) and while `creation.open`.
- ed-app pattern to copy: `_creationEdit` (~L1163) + `_applyCreationResult` (~L1187): set `_character`, persist, `_markDirty()`, `this._model = this._derive()`; refusal shown via `_showNotice`. Event listeners registered ~L461-577.
- `ui/ed-overview.js`: `_attrCell(a)` (L417) renders each tile; `_cr` getter (L387) is true while creation is open in edit mode; creation `-/+` stepper `_attrStepper` (L395) uses `.astep` styles. Modals there use `ModalController` + `modalFrame` from `ui/kit` (L18-19, L685-690, L1095+); docs/MODALS.md checklist and the UI-kit check apply. The model's attribute rows spread the stored `{base, points, increases}` (store.js L1142), so the UI sees `increases`.
- Changelog source is `data/changelog.json` (ui/ed-changelog.js; WORKFLOW.md); builder follows existing entry shape.
- Overview must not gain vertical scroll on desktop: the `+` must fit inside the existing `.an` name line (compact, like the creation stepper).

## Guardrail classification
Whole plan Tier 3 (tickets.md "Guardrail alignment"): no schema change (`increases` already exists in `ed-character/2`), derived Value/Step stay derived, data-down/dispatch-up kept (UI only dispatches `ed-edit-attribute`; the engine decides), no taxonomy change. Must keep Tier 1 UI rules (no-scroll Overview, placeholder pills for unknowns, light/dark, kit modal Escape/Enter). No Tier-1 item, so no sign-off needed. Note: a new `engine/` module and a new `store.js` return field are additive and non-shape-changing for stored data.

## Rules dependencies
- R1 (Q047/Q039) ANSWERED - costs 800/1,300/2,100, from Legend only.
- R2 ANSWERED - max +3; one at a time; rested/healthy and weeks-wait (info only here).
- R3 ANSWERED - training days = current Step; fee = Step x 10 sp/day (info only).
- R4 NOT-COVERED, Decision 2026-11-23: cap on `increases` only.
- R5 ANSWERED, Decision: out of scope.
- R6 ANSWERED - derived cascade handled by existing derive; nothing stored.
- R7 ANSWERED - any time; no GM trigger.
No open NEEDS_RULES.

## Implementation items
### I1 - Pure engine module `engine/attribute-improve.js`
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4, R6
- **Tier:** 3
- **What:** DOM-free module exporting: `nextIncreaseCost(increases, table)` (null when > cap); `attributeImprovePlan(attributes, saved, name, { costTable, available, stepOf })` returning `{ ok, reason?, cost, newIncreases, current:{value,step}, next:{value,step}, trainingDays, silverFee, weeksWait }`; `applyAttributeIncrease(attributes, saved, name, ctx)` and `undoAttributeIncrease(attributes, saved, name)` returning `{ ok, attributes }` (refusals `{ ok:false, reason, attributes }` with the SAME input reference); `pendingAttribute(attributes, saved)` (name of the one whose `increases` exceeds saved, else null). Refusal reasons: `cap`, `insufficient-legend`, `already-pending` (a different attribute is pending vs baseline), `no-baseline` (saved null), `unknown-attribute`, `nothing-to-undo`.
- **Where:** new `engine/attribute-improve.js`, `engine/attribute-improve.test.js`. Imports only `valueToStep`/`attributeValue` from `engine/derive.js`; the next single step is a direct `costTable[String(increases+1)]` lookup (no `attributeIncreaseCost` import). The test file imports `attributeIncreaseCost` from `engine/legend-spent.js` to assert agreement.
- **Approach:** cost of the NEXT increase = `costTable[String(increases+1)]` (single step, not cumulative). `available` is passed in (the derived Legend available BEFORE the change). Cap constant derived from the table's highest key (3) rather than hard-coded where possible. Info: trainingDays = current Step; silverFee = Step x 10 (sp); weeksWait = new Step. Only `increases` is changed; `base` and `points` are copied untouched; returns new objects, never mutates inputs. Undo only lowers the pending attribute's `increases` back to the saved value (it cannot go below the baseline).
- **Dependencies:** none.
- **Acceptance criteria:** cost 800/1,300/2,100 for the 1st/2nd/3rd; 4th refused (`cap`); refused when available < cost; refused when another attribute is pending vs baseline; re-applying to the already-pending attribute is refused (one per save); undo removes only the pending increase; `points`/`base` unchanged; refusals return the same reference; unit tests for each rule and each reason, including that the single-step costs equal the differences of the audit's cumulative `attributeIncreaseCost` (800, 1300, 2100); no DOM/global access.
- **Risks / unknowns:** preview Step uses the raw Value (no always-on modifier fold); acceptable, note it in the modal as the natural Step.

### I2 - Baseline plumbing in store and ed-app state
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Make the saved attributes baseline available to ed-app and keep it correct across load and save.
- **Where:** `store.js` (`loadCharacter` return gains `savedAttributes`), `ui/ed-app.js`: `_loadCharacter` (~L651-669), `_doSave` success (~L2413-2415), and `_reloadSaved` (~L2532-2544, the Discard flow, which calls `loadCharacter` and swaps `_character`). Also check the conflict "use branch" flow and any other `loadCharacter(` caller.
- **Approach:** `loadCharacter` captures `fileCharacter.attributes` (deep-copied) before `applyEdits`; `loadDraftCharacter` returns `savedAttributes: null`. ed-app stores `_savedAttributes` (a plain property, not rendered state unless needed by the model passthrough). On successful non-draft save: `this._savedAttributes = structuredClone(this._character.attributes)`. The first-save-of-draft path (`_firstSaveLanded`) also sets it, since the file now exists.
- **Dependencies:** none (parallel to I1).
- **Acceptance criteria:** reload with an unsaved attributes overlay yields baseline = file attributes (so a pending improvement is still recognised as pending); after save the baseline equals the saved attributes so the lock clears; drafts have a null baseline; Discard (`_reloadSaved`) resets `_savedAttributes` from the reloaded file and clears the pending state and lock (test or manual check); existing store tests unaffected (add a store test for `savedAttributes`).
- **Risks / unknowns:** other character-swap paths (conflict resolution, refresh) must also refresh the baseline; builder must enumerate them. Answers the T3 open question: the baseline is the pre-overlay file attributes, captured at load and refreshed on save, not derived from the merged store.

### I3 - ed-app handler `ed-edit-attribute`
- **Covers tickets:** T3
- **Rules:** R1, R2, R4
- **Tier:** 3
- **What:** New `ed-edit-attribute` event `{ name, action: 'increase' | 'undo' }` handled by `_editAttribute(detail)`.
- **Where:** `ui/ed-app.js` (listener near L461-577; handler near `_creationEdit`), `store.js` (reuse `saveAttributeEdits`, `reconcileOverlay`).
- **Approach:** Guard: `_character`, `_rules`, baseline non-null, not `creation.open`, edit mode. Call I1 `applyAttributeIncrease`/`undoAttributeIncrease` with `costTable = rules.legendFile.costs.attributeIncrease`, `available = this._model.legend.available`. Refusal: `_showNotice(text)` with a reason-to-text map, no state change. Success: `this._character = { ...character, attributes: res.attributes }`; if the new attributes deep-equal the baseline, `reconcileOverlay(['attributes'], id)` (overlay clears) else `saveAttributeEdits(res.attributes, id)`; then recompute `this._dirty = hasPendingEdits(this._characterId) || (hasCustomPendingEdits() || hasCustomSkillPendingEdits())` (the exact expression used in `_reloadSaved`/`_doSave`), call `_scheduleAutosave()` when dirty as other edits do (reuse `_markDirty()` only on the non-clean path), `this._model = this._derive()`. No Legend log entry and no stored cost (audit derives it).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** after an increase the attribute Value/Step and every dependent (defences, health thresholds, talent steps) update and Legend Available drops by the cost; undo restores the pre-increase state and clears the overlay, and the dirty dot clears when nothing else is pending (store-level test of overlay clear + `hasPendingEdits` false, plus manual check); after save the lock clears; reload with an unsaved overlay keeps the pending state; a refused request changes nothing and shows a notice.
- **Risks / unknowns:** undo-to-clean must recompute `_dirty` rather than set it true blindly.

### I4 - Pure UI state helper for the row affordance
- **Covers tickets:** T2, T4
- **Rules:** R1, R2
- **Tier:** 3
- **What:** A small pure helper (e.g. `ui/attribute-improve-state.js`, with test) that maps `{ model.attributes, savedAttributes, legend.available, costTable }` to per-row view state: `{ show, canImprove, pending, title }` plus the modal content (labels and values from the I1 plan). Keeps the template free of logic.
- **Where:** new `ui/attribute-improve-state.js` + `ui/attribute-improve-state.test.js` (pattern: `ui/item-equip-state.js`).
- **Approach:** Delegates every decision to I1 (`attributeImprovePlan`, `pendingAttribute`); hidden at +3 (`cap`), disabled with a tooltip reason when Legend is short or another attribute is pending. Overview needs the baseline and cost table: ed-app passes them down as properties (`savedAttributes`, `attributeCosts`) or as a `model.attributeImprove` slot built in ed-app (data-down). Prefer a single prop built by ed-app via I1 so the Overview stays dumb.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** tests cover: edit-mode-off shows nothing; creation open shows nothing (stepper remains); +3 hidden; Legend short disabled with reason; another pending disabled; pending row shows the "Improved this save" state with undo.
- **Risks / unknowns:** none notable.

### I5 - Overview UI: `+` per row, confirm modal, pending mark and undo
- **Covers tickets:** T2
- **Rules:** R1, R2, R3
- **Tier:** 3 (must keep Tier 1 UI rules)
- **What:** In edit mode with creation closed, each attribute tile gets a compact `+` button in the `.an` line. Click opens a standard confirm modal showing attribute name, current -> new Value and Step, LP cost, remaining Legend after, training days, silver fee, weeks-wait, and the "must be rested and healthy (no Damage or Wounds)" reminder. Confirm (button or Enter) dispatches `ed-edit-attribute { name, action: 'increase' }`; Escape/Cancel closes. A pending tile shows an "Improved this save" mark (small badge) with an undo control that dispatches `{ action: 'undo' }`.
- **Where:** `ui/ed-overview.js` (`_attrCell`, a new `ModalController` + `modalFrame` alongside `_karmaCtl`, css via `modalCss`/existing `.astepbtn` styles); `ui/ed-app.js` passes the new property down.
- **Approach:** Follow docs/MODALS.md section 11 checklist (focus contract, `ctl.opened(trigger)`, Escape/Enter via kit). Reuse the compact `astep` look; no new font weights; badge uses theme tokens (no hardcoded colours). Values in the modal come only from the I4/I1 plan; any null renders the muted placeholder pill, never a number. Mobile: tile layout unchanged, button touch-sized in the stacked layout like `.astepbtn`.
- **Dependencies:** I3, I4.
- **Acceptance criteria:** Overview still fits the desktop viewport with no vertical scroll (verify in browser, with the pending badge shown); mobile stacked layout intact; light and dark both fine; Escape closes, Enter confirms; creation-mode `-/+` unchanged and shown only while creation is open; read-only mode shows nothing new; UI-kit check passes.
- **Risks / unknowns:** tile width: the `+`, the item-modifier badge (`.adelt`) and the pending badge share the `.an` line; may need the pending mark as a small dot/abbreviated label with a title. Verify at the narrowest desktop width.

### I6 - Tests and docs
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** Run the full suite; add an end-to-end style store/engine test (apply -> overlay written -> `applyEdits` -> derive Legend spent increases by the cost, undo clears); docs: `ARCHITECTURE.md` note (post-creation attribute gains use `increases` via Improve attribute, with the baseline `savedAttributes` mechanism), `docs/UI-GUIDELINES.md` entry for the row `+` affordance, modal and pending mark, `docs/AI-WORKFLOWS`/RULES-FAQ untouched; `data/changelog.json` entry in the existing format.
- **Where:** `ARCHITECTURE.md`, `docs/UI-GUIDELINES.md`, `data/changelog.json`, new tests beside I1/I2/I4.
- **Approach:** Confirm `tools/rules-conformance.test.js` still passes (no rules file change). Note: rules.md R-entries already mirrored in `docs/RULES-FAQ.md` Q047.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** `npm test` passes including conformance; docs updated; changelog entry present.
- **Risks / unknowns:** none.

## Sequencing
1. I1 (engine, no dependencies, pure and testable first).
2. I2 (baseline plumbing; can run alongside I1).
3. I3 (handler needs I1+I2; makes the feature drivable via events/console).
4. I4 (UI state helper, depends on I1+I2).
5. I5 (visible UI; depends on I3+I4; the only item needing browser verification of Tier 1 UI rules).
6. I6 (tests and docs finalisation).
Rationale: logic first, wiring next, presentation last, so each step is reviewable and testable in isolation.

## Open questions
- Should the preview Step include always-on item/racial modifiers? Plan: no (natural Step per the book); the modal labels it.
- Improve for an unsaved draft whose creation is finished: plan keeps it unavailable until the first save (no baseline). Flag if the owner wants otherwise.

## Review responses
- F1 (I2 refresh paths, `_reloadSaved`): fixed - listed in I2 Where and acceptance criteria with a test/manual check.
- F2 (I3 dirty expression): fixed - exact expression stated and undo-to-clean check added.
- F3 (I1 unused import): fixed - import dropped; test asserts agreement with the audit's cumulative function.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
