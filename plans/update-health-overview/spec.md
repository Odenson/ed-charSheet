# Tech Spec: Update Health overview (update-health-overview)

## Overview
Redraw the Overview Health card (V1 mock) driven by a new pure engine
classification `healthDanger` (plus a pure `resolveHit` helper) in
`engine/health.js`, surfaced on the model in `store.js`. A new shared Lit element
`<ed-damage-modal>` (`ui/ed-damage-modal.js`, built on `ModalController`)
replaces Combat's hand-rolled damage modal and is opened from the Overview
Damage row in read mode. The Overview's ✚ button and free-entry Take/Heal/Used
modal are deleted; healing is a ⚄ Recovery test on the Recoveries row.

## Guardrail alignment
All items Tier 3 (plan I1-I6); no Tier-1/2 item, no sign-off needed. No schema,
taxonomy, `rules/*.json` or character-data change.
- Data down / events up: the card and modal read `model`; they dispatch
  `ed-edit-health` and `ed-roll` (both `bubbles: true, composed: true`). The UI
  computes no game values: danger level, fill, tick, wounds, knockdown all come
  from the engine.
- Engine stays pure and DOM-free; `healthDanger`/`resolveHit` never mutate.
- Store only inputs: `healthDanger` is derived on the model, nothing persisted.
- Placeholder pill: missing ratings render the dashed `.pend` pill, never a
  fabricated bar.
- Tier-1 UI rules kept: no vertical scroll on Overview (card must not grow;
  if it cannot fit, STOP and ask the owner), weights 400/500 only, `--fs-*` font
  sizes only, `light-dark()` colours.

## Design
### Data / types
None stored. New derived model field `model.healthDanger`:
`{ damage: 'none'|'warn'|'bad'|null, wounds: 'none'|'bad', fill: number|null, tick: number|null }`.
`resolveHit` returns `{ next: {damage,wounds,recoveriesUsed}, knockdown: {difficulty:number}|null }`.

### Modules & functions
1. `engine/health.js` (add exports, do not change existing ones)
   - `const WARN_MARGIN = 10;` with a comment: owner UI choice (qa-log 2026-11-15), not a rule.
   - `healthDanger(inputs, ratings)`: reuse `ratingValue`; `damage`/`wounds` clamped
     like `damageState` (`Math.max(0, Number(x)||0)`).
     - `wounds`: `'bad'` if >= 1 else `'none'` (always available).
     - `damage`: null if Unconscious missing; `'bad'` if damage >= unc; `'warn'` if
       damage > 0 && damage >= unc - WARN_MARGIN && damage < unc; else `'none'`.
     - `fill`: null if Death missing or <= 0; else clamp(damage/death, 0, 1).
     - `tick`: null if Unconscious or Death missing or Death <= 0; else clamp(unc/death, 0, 1).
     - JSDoc documents the per-field null shape (never a bare null).
   - `resolveHit(health, take, woundThreshold)`: `take` clamped to >= 0; if `take <= 0`
     returns `{ next: applyHealth(health, {}), knockdown: null }`. Otherwise
     `wound = woundsFromHit(take, wt)`, `next = applyHealth(health, {damage: take, wounds: wound, recoveriesUsed: 0})`,
     `d = knockdownDifficulty(take, wt)`, `knockdown = d != null ? {difficulty: d} : null`.
2. `store.js` (~L1781): add `healthDanger: healthDanger(character.resources?.health ?? {}, characteristics),`
   next to `healthState`; add to the engine/health import.
3. `ui/ed-damage-modal.js` (new): `class EdDamageModal extends LitElement`,
   `customElements.define('ed-damage-modal', ...)`.
   - Props: `model` (object). Internal state `_open`, `_take` (reactive).
   - `constructor`: `this._ctl = new ModalController(this, { onClose: () => { this._open = false; }, initialFocus: 'input' })`.
   - `show(trigger)`: `this._take = 0; this._open = true; this._ctl.opened(trigger);`
   - Close paths (Escape via controller, ✕, backdrop click) all call `this._ctl.close()`.
   - `_apply()`: `take = Math.max(0, Number(_take)||0)`; if `take <= 0` do nothing (Apply
     disabled at 0). `const {next, knockdown} = resolveHit(health, take, wt)`; dispatch
     `ed-edit-health` with `detail: next`  (match the detail shape Combat's
     `_dispatchHealth` uses today; dev must read it and copy exactly); then
     `this._ctl.close({restoreFocus:false})`... except restore focus normally (use `close()`);
     then if `knockdown && model.characteristics.knockdown?.value != null` dispatch `ed-roll`
     with the same detail Combat's `_roll` builds for
     `('Knockdown test', kd.value, null, 'knockdown', {difficulty:{value}, apply:{action:'knockdown-result'}})`
     (read `_roll` in `ui/ed-combat.js` and reproduce its event detail; do not invent).
     Because the roll modal takes focus next, use `close({ restoreFocus: false })` when a
     Knockdown roll is dispatched, `close()` otherwise.
   - Template: lifted from `_damageModalTpl` (ed-combat.js L1612-1639): `.overlay` >
     `.modal[role=dialog][aria-modal][aria-label="Take damage"]`, header + ✕, current damage with
     state word from `model.healthState`, Unconscious/Death via a local `_rating()` (`.pend`
     pill when null), `<form @submit>` with number input (min 0, step 1), WT hint, footer hint
     and Apply submit button.
   - Own shadow-DOM styles (`.overlay .modal .mhead .mclose .mpara .hrow .hbtn .hfoot .hint .pend`),
     weights 400/500, `--fs-*`, `light-dark()`. Copy values from ed-combat's existing damage-modal CSS (~L281).
4. `ui/ed-combat.js`: import `./ed-damage-modal.js`; remove `_damageModalTpl`, `_applyDamage`,
   `_damageDraft`, `_damageModal` state, its Escape branch (~L333), the `_damageModal = false`
   resets (~L434, L448), the render block (~L1522) and orphaned CSS; render
   `<ed-damage-modal .model=${this.model}></ed-damage-modal>` at the component root;
   `_openDamage(e)` becomes `this.renderRoot.querySelector('ed-damage-modal').show(e.currentTarget)`
   and the ✗ button passes the event. Remove imports `woundsFromHit, knockdownTriggered,
   knockdownDifficulty, applyHealth` only if grep shows no other use. Keep `_recoveryTest`.
5. `ui/ed-overview.js`
   - Health markup (~L1017-1044) -> V1: header (HEALTH label, `_healthChip()`, reset-day button; no ✚);
     `.hl` Damage row; `.hl` Wounds row; divider; `.line` stats Unconscious, Death, Wound Threshold, Recoveries.
   - Read mode Damage row: `<button class="hl dmg">` with `aria-label`, `title` (= `_healthTitle()` plus headroom text),
     `@click=${(e) => this.renderRoot.querySelector('ed-damage-modal').show(e.currentTarget)}`.
     Edit mode: plain `div` with `_healthField` inputs, no handler. Wounds row never clickable.
   - Level classes from `model.healthDanger` (`lvl-warn`, `lvl-bad`) on the Damage number and gauge fill;
     Wounds number red when `healthDanger.wounds === 'bad'`.
   - Gauge: track (6px) with fill `style="width:${fill*100}%"` and tick `style="left:${tick*100}%"` (the
     `*100` is presentation unit conversion only; no clamping/thresholds in the view). If `fill == null`:
     `.pend` dashed pill instead of the gauge. If only `tick == null`, render fill without tick.
   - Recoveries row (read mode): value plus ⚄ button; `_recoveryTest()` re-added without the
     `_healthModal = false` line, dispatching Combat's `Recovery test` ed-roll
     (Toughness step, `apply:{action:'recovery-heal', label:'Heal this amount'}`), guarded by
     `recoveriesRemaining`; `disabled` + explanatory title at 0 remaining; title/aria-label include
     `armedRecoveryBonus(this.arming?.pending).stepBonus` when > 0 (check/confirm import in ed-overview L8).
     Edit mode: no ⚄; `_recoveries` input stays.
   - Delete: `_healthModal`, `_healthDraft`, `_openHealth`, `_applyHealthDraft`, `_healthModalBody`,
     `_closeHealthModal`, the modal render block (~L1064-1081), Escape branch (~L640), imports
     `applyHealth, woundsFromHit, knockdownTriggered, knockdownDifficulty`, and CSS
     `.hrow .hnum .hbtn .hrec .hfoot .hint .hbtn.plain` and ✚-specific `.hhead .info`. Grep each before
     deleting; keep `.overlay/.modal/.mhead/.mclose/.mbody/.mpara` (info modal).
   - Add `<ed-damage-modal .model=${this.model}>` at the component root (not inside `.blk`).
   - Colours: red `light-dark(#a63a2b, #e0846f)` / bg `light-dark(#f6e4e0, #3a2320)` as already in the file;
     amber `--warn: light-dark(#8a5a00, #e0b35c)`, `--warn-bg: light-dark(#f6ecd6, #33290f)` defined locally
     (same as `ui/ed-custom-item.js:576-577`). Neutral rows `--bg-chip`, labels `--muted`, divider `--border`.
     Row height 25px, chip radius 7px, tick 2px, stats `--fs-small`, number weight 500.
6. Docs/changelog/tests: `docs/UI-GUIDELINES.md` (Overview Health card; Combat text only if it names the modal),
   `docs/MODALS.md` (list `ed-damage-modal` if modals are listed), `data/changelog.json`,
   `engine/health.test.js`, `store-health.test.js`.

### UI / behavior
- Calm: muted card, no colour. Damage warn (amber) from Unconscious-10 to just under Unconscious; red at/over Unconscious.
  Wounds red at 1+. State chip and a `title` carry headroom text so colour is not the only signal.
- Read mode: click Damage -> shared modal; Enter applies, Escape/✕/backdrop close, focus trapped and restored.
  Apply: hit < WT adds damage only; >= WT adds one Wound; >= WT+5 also opens the Knockdown roll.
- Healing only via ⚄ on Recoveries (read mode). Day-reset button unchanged.
- Edit mode: direct number fields for Damage, Wounds, Recoveries used; no ✚, no ⚄, no click-to-modal.
- Both themes; mobile single-column fold, gauge `flex:1; min-width:0`; Overview must still fit with no vertical scroll.

### Rules
| Rule | Value / formula | rules.md id / source |
|---|---|---|
| Wound per hit | 1 Wound if hit damage >= Wound Threshold, never more than one per hit | R1; RULES-FAQ Q010, PG p.379-380 |
| Knockdown | triggers when damage >= WT + 5; Difficulty = damage - WT | R2; Q031, PG p.380 |
| Unconscious / Death | Unconscious when damage >= Unconsciousness; dead when >= Death (gauge scale = Death, tick = Unconscious) | R3; Q031, PG p.380 |
| Amber margin | damage >= Unconscious - 10 (owner UI choice, NOT a rule) | R3 Decision |
| Recovery | healing only via Recovery test at Toughness step; limited per day | R4; Q031, PG p.380-381 |
| Wound healing | existing day-reset flow, unchanged | R5 (context) |

### Edge cases & invariants
- healthDanger fixtures: 3/58/72 -> damage `none`, fill 3/72, tick 58/72; 47 `none`, 48 `warn`, 57 `warn`, 58 `bad`;
  damage > Death -> fill 1, `bad`.
- Both ratings missing: damage/fill/tick null, wounds still computed. Only Unconscious missing: fill set, damage/tick null.
  Only Death missing or <= 0: damage set, fill/tick null.
- wounds 0 `none`; 1, 2 `bad`. Damage 0 with Unconscious <= 10 is `none`, not `warn`.
- Inputs not mutated; non-numeric/negative inputs clamp to 0.
- resolveHit at WT-1 / WT / WT+4 / WT+5: wounds 0/1/1/1, knockdown null/null/null/{difficulty 5}; WT null -> no Wound, no Knockdown;
  take 0 or negative -> no change.
- Modal `show()` resets draft to 0 every open. Knockdown event only when Knockdown step is non-null.
- ⚄ disabled at 0 remaining; inert in edit mode; Damage click inert in edit mode.
- Events must be `composed` to cross shadow roots to `ed-app`.

## Testability notes
- node:test: `engine/health.test.js` for `healthDanger` and `resolveHit` (cases above); `store-health.test.js`
  for `model.healthDanger` present and derived from stored inputs only; existing `store-combat.test.js` must pass unchanged.
- Seam: `resolveHit` carries the modal's logic so no DOM test is needed.
- Manual (owner): matches both mock PNGs in dark and light, amber distinct from accent; Overview fits 1280x720 and
  smallest supported desktop with no scroll and Health card no taller; mobile fold with ⚄ on Recoveries row;
  shared modal Escape/✕/backdrop/Enter/focus on both Overview and Combat; ⚄ disabled at 0; ✚ gone in both modes.
- Greps to verify: no `font-weight: 600`, no raw rem/px font sizes in new CSS, none of the removed identifiers remain.

## Changelog entry
{"type": "changed", "text": "Overview Health card redesigned: Damage and Wounds are highlighted rows with a damage gauge, amber/red warnings, click Damage to take a hit (shared with Combat), and healing now only through a Recovery test (the free-entry Heal and Recovery-used entry are removed; fix a miscount in edit mode)."}

## Out of scope
- Changing Wound/Knockdown/Recovery rules, taxonomy, schema or character data.
- Redesigning the Combat tab (only its Damage taken modal is swapped for the shared one).
- Heal-by-number anywhere.
- A shared amber token sheet (start local to `ed-overview.js`).
