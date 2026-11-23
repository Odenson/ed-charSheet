# Tech Spec: Save spinner (save-spinner)

## Overview
A new kit `info` modal component `ed-saving` (spinner + "Saving to GitHub…") is mounted by `ui/ed-app.js` while a manual `_doSave` is in flight. Visibility is decided by a pure helper `showSavingOverlay` in `ui/saving-overlay-state.js`, driven by two new `state: true` flags on ed-app. Dismissing hides the overlay only; the save and its toasts are untouched.

## Guardrail alignment
All Tier 3 (new modal using the kit, wiring, docs); no Tier-1 sign-off needed and no Tier-2 change. The dismissible `info` variant keeps the Tier-1 Escape/backdrop/Enter modal contract (qa-log 2026-11-23). Data flows down (flags to render), events up (`@close`); the helper is pure and DOM-free; nothing is stored (flags are transient UI state, not character data); no derived values or pills involved. No Tier-1 item missed.

## Design
### Data / types
None stored. Transient ed-app state only: `_savingManual: boolean`, `_savingDismissed: boolean` (both `state: true`, init `false` in the constructor near L266; declare near L79 beside `_saving`).

### Modules & functions
- NEW `ui/saving-overlay-state.js`: `export function showSavingOverlay({ saving, dismissed, handoff }) { return !!saving && !dismissed && !handoff; }`. No imports, no DOM.
- NEW `ui/saving-overlay-state.test.js` (node:test): shows when saving; hidden when not saving; hidden when dismissed while saving is true; hidden when handoff true; hidden when all of dismissed+handoff; undefined inputs coerce to hidden.
- NEW `ui/ed-saving.js`: `class EdSaving extends LitElement`, `customElements.define('ed-saving', …)`. Copy `ui/ed-creation-guide.js`: `this._ctl = new ModalController(this, { kind: 'info', onClose: () => dispatch bubbling+composed 'close' })`; `connectedCallback` calls `super` then `this._ctl.opened(null)` (no trigger; do NOT import/use `deepActiveElement`); `render()` returns `modalFrame(this._ctl, { title: 'Saving to GitHub…', layer: 2150, width: '20rem', ack: { label: 'OK' }, body })`. Body: `<div role="status" aria-live="polite">` containing a `.spinner` span (`aria-hidden`) and the text "Saving to GitHub…", plus a muted line "You can close this; the save continues." Styles `[modalCss, css…]`: ring via `border` with `light-dark()` colours (muted track, accent top), `@keyframes` rotate, `@media (prefers-reduced-motion: reduce)` sets `animation: none` and shows a static partial ring. `font-size` only via `var(--fs-*)`, weights 400/500. No own keydown handlers, no frame CSS, no `[role=dialog]` of its own (tools/check-ui-kit.mjs must stay at baseline).
- CHANGE `ui/ed-app.js`: import `./ed-saving.js` (near L44) and `showSavingOverlay` from `./saving-overlay-state.js`; properties + constructor init; in `_doSave` immediately after `this._saving = true` (L2356): `if (!silent) { this._savingManual = true; this._savingDismissed = false; }`; in the single `finally` (L2450): `this._saving = false; this._savingManual = false;`. In `render()` after the key-prompt/conflict/creation-guide mounts (~L2773): when `showSavingOverlay({ saving: this._savingManual, dismissed: this._savingDismissed, handoff: !!(this._conflict || this._renameDraft) })`, render `<ed-saving @close=${() => (this._savingDismissed = true)}></ed-saving>`. Do not touch save logic, toasts or the L2503 tooltip. The `_saving` sets at L1941/L2021 (delete/custom-item saves) are not `_doSave` and must not set `_savingManual`.

Focus verification (plan's assumption, confirmed by reading `ui/kit/modal-controller.js`): `opened(null)` stores `_trigger = null`. `hostDisconnected()` (L251-257) calls `_restoreFocus()` -> `returnFocusToTrigger(null, …)`, whose first line is `if (!el || !el.isConnected) return;` - a no-op. `close()` likewise. So unmounting the overlay never moves focus, and cannot steal it from `ed-conflict` or the rename modal. Note: programmatic unmount fires no `close` event (only `close()` does), so `_savingDismissed` is not set then; it is reset at the next manual `_doSave`. Also `focusInitial()` for `info` focuses the OK button on open (focus moves into the overlay); after unmount focus falls to `<body>` as the dialog is removed (MODALS §7 trigger-gone behaviour).

- CHANGE docs: `docs/MODALS.md` (§5 layer row for `ed-saving` 2150; §7 trigger-gone note; §8 list `ed-saving`, note dismissible-while-saving), `docs/UI-GUIDELINES.md` §7 mention, `data/changelog.json`.

### UI / behavior
Manual Save: overlay appears, OK/Enter/Escape/backdrop/✕ hide it (save continues, existing saved/error toast still shown). Auto-removed on success, error, conflict (`_conflict` set in catch, `finally` clears flag, same render), draft rename clash (`_renameDraft` + `finally`). Conflict keep-mine calls `_doSave` again, so it reappears. Silent autosave/flush never set `_savingManual`. Key-prompt return precedes `_saving = true`, so no overlay. Light and dark via `light-dark()`; Overview unaffected (modal). Fast saves flash the modal (accepted, no minimum time).

### Rules
No Earthdawn rules apply (rules.md).

### Edge cases & invariants
- `_savingManual` is false whenever `_saving` is false (cleared in the same `finally`).
- Dismissed overlay does not reappear during the same save; reappears on a new manual save.
- Overlay never co-mounted with conflict/rename modals (handoff).
- UI-kit check baseline unchanged.

## Testability notes
node:test: `ui/saving-overlay-state.test.js` covers the helper. Run `npm test` (includes UI-kit check and changelog tests). Manual (owner) list: (a) keyboard and pointer Save shows overlay, Escape hides it, save completes with toast; (b) conflict: overlay gone, `ed-conflict` holds focus; (c) draft rename clash: overlay gone, rename modal holds focus; (d) key rejected/error: overlay gone, error toast; (e) fast save: flash acceptable, no stuck focus; (f) autosave never shows it; (g) reduced-motion stops spin; light/dark. Fallback if (b)/(c) fail: ed-app closes the overlay via `close({ restoreFocus:false })` before setting hand-off state.

## Changelog entry
{"type": "added", "text": "Saving to GitHub now shows a small spinner while a manual save is in progress. You can close it and the save carries on."}

## Out of scope
Autosave/flush indicator; save worker, overlay storage and conflict flow changes; minimum display time or show-delay; pill/icon alternatives; any Earthdawn rules.
