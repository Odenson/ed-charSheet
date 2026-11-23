---
status: implemented
shipped: unreleased
---
# Delivery Plan: Save spinner (save-spinner)

## Context & learnings
A manual Save to GitHub can take 2-3 s with only the Save icon disabling and its tooltip changing. The owner chose (qa-log 2026-11-23) a blocking-style modal spinner, but dismissible so the Tier-1 Escape/backdrop rule holds: a kit `info` modal "Saving to GitHub…" with a CSS spinner. Escape/backdrop/✕/Enter hide it only; the save continues. Shown only for manual saves (not autosave/flush-on-hide). It closes itself on success, error, or when the conflict modal opens. Existing saved/error toasts are unchanged. No minimum display time. No changes to save worker, overlay storage, or conflict flow.

## Discoveries
- `ui/ed-app.js` `_doSave({silent, base, keepalive})` (~L2341-2452): early returns (no character / `_saving`, draft+silent, staged portrait+keepalive), key prompt return (sets `_keyPrompt`), then `_saving = true` at ~L2356. Everything (draft first-save via `saveDraftFirstTime`, portrait upload, `/save`, `/save-items`, `/save-skills`) is inside one `try`; the draft id-clash path sets `_renameDraft` and `return`s inside the try; conflict sets `_conflict` in `catch`; a single `finally` clears `_saving`. So one set at `_saving = true` (when `!silent`) and one clear in `finally` covers every exit path.
- Conflict "keep-mine" re-calls `_doSave({base})` (L2483), so the overlay re-appears for the resave, which is correct.
- Modal mounts are rendered in ed-app's `render()` near L2735-2780 (`_keyPrompt`, `_conflict`, `_creationGuide`) with `@close` clearing mount state.
- Template to copy: `ui/ed-creation-guide.js` (kind `info`, `ModalController`, `modalFrame`, `modalCss`, `this._ctl.opened(deepActiveElement())` in `connectedCallback`, `close` event). Layers in MODALS §5: save key 2200, conflict/Settings 2200, rename/new-char 2150.
- `ui/kit/` is the kit; `tools/check-ui-kit.mjs` ratchets `keydown`, `dialog-role`, `frame-css`, `font-size`, `button-style` per file; the new file must add none (use `--fs-*` vars only).
- No existing `prefers-reduced-motion` usage in the repo (grep), so the spinner introduces the first; keep it local to the component.
- Pure-helper tests are colocated `*.test.js`, run by `node --test` (`npm test`). Changelog: `data/changelog.json` `unreleased.changes[]` (currently empty).

## Guardrail classification
All items Tier 3 (new view/modal using the kit; bug-free wiring; docs). Tier-1 Escape/Enter modal contract is preserved by the dismissible `info` variant (owner, qa-log 2026-11-23 second entry). No Tier-1 sign-off required; no Tier-2 changes. Pre-finish checks: light/dark, two weights, relative paths, Overview unaffected (overlay is a modal).

## Rules dependencies
None. `rules.md` states no Earthdawn rules are used.

## Implementation items
### I1 — Pure show/hide helper + tests
- **Covers tickets:** T2, T3
- **Rules:** none
- **Tier:** 3
- **What:** Small pure function deciding whether the saving overlay shows, so the decision is unit-testable.
- **Where:** new `ui/saving-overlay-state.js`, `ui/saving-overlay-state.test.js`.
- **Approach:** `showSavingOverlay({ saving, dismissed, handoff })` returns `saving && !dismissed && !handoff` (no `silent` input: `saving` is the manual-only flag `_savingManual`, so silent saves can never reach it). In ed-app, `_savingManual` and `_savingDismissed` are both declared `state: true` in `static properties` (~L79) and initialised false in the constructor (~L266); `_savingDismissed` is reset to false at each manual `_doSave` start and set true by the overlay's `@close`. `handoff` is `!!(this._conflict || this._renameDraft)` (review F1). Tests: shows when saving; hidden when not saving; hidden when dismissed while `saving` stays true; hidden when a hand-off modal is open.
- **Dependencies:** none
- **Acceptance criteria:** tests pass under `npm test`.
- **Risks / unknowns:** `_saving` is also set true by other paths (~L1941, L2021: delete/custom-item saves). The overlay must not appear for those: gate on a dedicated flag `_savingManual` (state) set only in `_doSave` when `!silent`, and pass that as `saving` to the helper. Confirm those paths do not call `_doSave`.

### I2 — `ed-saving` modal component
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Kit `info` modal with a CSS spinner and "Saving to GitHub…".
- **Where:** new `ui/ed-saving.js`; import in `ui/ed-app.js` near L44-49.
- **Approach:** Copy `ed-creation-guide.js` structure: `ModalController({kind:'info', onClose → dispatch 'close'})`, `connectedCallback → this._ctl.opened(null)` (no trigger; see Focus decisions), `modalFrame(this._ctl, { title: 'Saving to GitHub…', layer: 2150, width: '20rem', ack: { label: 'OK' }, body })`. `ack` OK is used because the owner's answer names "Escape/backdrop/OK" (qa-log 2026-11-23, second entry) and `ed-creation-guide` is precedent; Enter also closes it (info kind). Body: a `role="status" aria-live="polite"` region containing a spinner element (`border` ring using `currentColor`/`light-dark()` theme vars, `@keyframes` rotate) and the text; a short muted line "You can close this; the save continues." Under `@media (prefers-reduced-motion: reduce)` stop the animation and show a static indicator (e.g. a partial ring or "…" glyph). Weights 400/500 only; `--fs-*` sizes; no hardcoded colors outside `light-dark()` fallbacks.
- **Dependencies:** kit modules.
- **Acceptance criteria:** UI-kit check passes with no baseline change; Escape/Enter/backdrop/✕/OK close it via the controller (hiding only); focus is never sent to a disabled control (falls to `<body>` per Focus decisions); light and dark OK; reduced-motion stops the spin.
- **Risks / unknowns:** MODALS §5 says info modals are ✕-only, with `ack` as a sanctioned exception; settled above by the owner's "OK" wording. Fast saves (review F5): with no minimum display time (owner decision) a sub-200 ms save mounts and tears down a focus-taking modal, causing a flash and a focus move on every manual Save. Accepted; no show-delay unless the owner asks.

### I3 — Wire into ed-app `_doSave`
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Mount `<ed-saving>` while a manual save is in flight; unmount on finish; dismissal does not cancel.
- **Where:** `ui/ed-app.js`: properties (~L79), constructor init (~L266), `_doSave` (~L2356 and `finally` ~L2450), `render()` (~L2735).
- **Approach:** Add `state: true` properties `_savingManual` and `_savingDismissed`, initialised in the constructor. In `_doSave`, immediately after `this._saving = true`, `if (!silent) { this._savingManual = true; this._savingDismissed = false; }`; in `finally`, `this._saving = false; this._savingManual = false;`. Render: `${showSavingOverlay({saving:this._savingManual, dismissed:this._savingDismissed, handoff:!!(this._conflict || this._renameDraft)}) ? html\`<ed-saving @close=${() => (this._savingDismissed = true)}></ed-saving>\` : ''}` Placement is after the key prompt so the overlay is only ever set after the key exists (the key-prompt return precedes `_saving = true`). Draft rename-clash and conflict paths hit `finally`, so the overlay unmounts in the same render as the rename/conflict modal mounts; no `_conflict`-specific code needed. Keep existing toasts and `_saving` tooltip untouched. Do not edit save logic.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** manual Save shows it until success/error/conflict; silent autosave and flush never show it (`_doSave({silent:true})` leaves `_savingManual` false); dismissing early leaves the save running and the toast still appears; no stuck overlay on key rejection, draft clash, portrait upload failure, or conflict; conflict keep-mine resave re-shows it.
- **Risks / unknowns:** see Focus decisions. Manual verification list for the owner (pass/fail): (a) keyboard and pointer manual Save: overlay shows, Escape hides it, save completes with the toast; (b) conflict: overlay gone and `ed-conflict` holds focus; (c) draft rename clash: overlay gone and the rename modal holds focus; (d) key rejected / error: overlay gone, error toast; (e) fast save: acceptable flash, no stuck focus; (f) silent autosave never shows it. Fallback if (b) or (c) fail: close the overlay via `close({ restoreFocus:false })` from ed-app before setting the hand-off state.

### I4 — Docs and changelog
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Record the new modal and the feature.
- **Where:** `docs/MODALS.md` (§5 layer table row, §7 trigger-gone note for `ed-saving`, §8 list of separate-component modals and a note on the dismissible-while-saving behavior); `docs/UI-GUIDELINES.md` (§7 modals mention); `data/changelog.json` `unreleased` (set `summary` if empty and add a `changes` line, matching existing entry wording style).
- **Approach:** Short entries; no restating of rules.
- **Dependencies:** I2, I3.
- **Acceptance criteria:** MODALS §8 lists `ed-saving`; changelog entry present and the JSON valid; `npm test` green incl. UI-kit check and any docs/changelog tests.
- **Risks / unknowns:** a changelog schema test may constrain `summary`/`changes` shape; follow the 2.5.0 entry.

## Focus decisions (review F1, F2)
- The Save button is `?disabled=${this._saving}` and `_saving` is true before the overlay's first render, so a captured trigger would be a disabled control or `<body>`. Decision: `ed-saving` opens with no trigger (`opened(null)`); on close focus falls to `<body>` (the kit's documented trigger-gone behaviour). Record it in MODALS §7 as another trigger-gone case. Applies equally to keyboard and pointer Saves.
- `ModalController.hostDisconnected()` calls `_restoreFocus()` (ui/kit/modal-controller.js ~L251); with a null trigger that is a no-op, so it cannot steal focus from `ed-conflict` or the rename modal. In addition the overlay is not rendered while `_conflict` or `_renameDraft` is set (the `handoff` input), so it unmounts in the same render those modals mount.

## Sequencing
I1 (pure, testable) → I2 (component) → I3 (wire) → I4 (docs/changelog, then run `npm test`). I3 depends on both prior items; docs last so they describe the final behavior.

## Open questions
- None blocking. The owner may later ask for a show-delay for fast saves (separate from a minimum display time).

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- F1 (major): fixed. `handoff` gating plus `opened(null)` (no restore) and a pass/fail manual list with a fallback (Focus decisions, I3).
- F2 (major): fixed. Decided now: no trigger; focus falls to `<body>`; criteria in T1/I2 relaxed; MODALS §7 note added to I4.
- F3 (minor): fixed. `silent` dropped from the helper; both flags `state: true`, initialised in the constructor.
- F4 (minor): fixed. Single title "Saving to GitHub…"; `ack` OK justified by the owner's "Escape/backdrop/OK" answer; Enter also closes.
- F5 (minor): fixed. Named in I2 risks and the manual list; no show-delay added.
