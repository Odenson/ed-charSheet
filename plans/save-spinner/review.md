# Plan Review: Save spinner (save-spinner)

## Summary
The plan is sound and well grounded: Tier 3 classification is correct, `_doSave` has the single set point and single `finally` the plan relies on, and no rules are used. 0 blockers, 2 major (focus handling), 3 minor (wording and design cleanups).

## Findings
### F1 — I3 — Focus restore on programmatic unmount can steal focus from the conflict / rename modal
- **Severity:** major
- **Problem:** `ModalController.hostDisconnected()` calls `_restoreFocus()` (ui/kit/modal-controller.js ~L251-255). When the overlay is still open as the save ends in a conflict (or draft rename clash), `finally` clears `_savingManual` in the same render that mounts `ed-conflict` / the rename modal. The overlay's disconnect restore may focus the Save trigger after, or instead of, the new modal's own focus. MODALS §2/§4 require a hand-off to keep the new modal focused. The plan only lists this as a risk to "confirm"; it gives no mitigation.
- **Fix:** Make it a designed step. Either close the overlay with `close({ restoreFocus: false })` when a hand-off modal is about to open (for example by rendering the overlay only while `!this._conflict && !this._renameDraft`, and having `ed-saving` skip the restore on disconnect), or add an explicit manual-verification step with a pass/fail criterion and a fallback. Add the conflict and rename-clash focus checks to the owner's manual list.

### F2 — I2/I3 — "Focus returns to the Save trigger" is probably unachievable as written
- **Severity:** major
- **Problem:** The Save button is `?disabled=${this._saving}` (ed-app.js ~L2634). `_saving` is set before the overlay's first render. When `ed-saving.connectedCallback` runs `deepActiveElement()`, the trigger is already disabled, so it may be `<body>`. A disabled element cannot take focus back, and the button only re-enables in the same render that removes the overlay. Acceptance criteria in I2 and T1 ("focus returns to trigger") may fail or be order-dependent.
- **Fix:** Either capture the trigger before `_saving = true` and pass it to the overlay, or relax the criterion to "focus falls back to `<body>`" and record it in MODALS §7 as a trigger-gone case. Decide this in the plan rather than during the build. Also note that a manual Save from keyboard or a pointer click both reach this path.

### F3 — I1/I3 — Redundant helper inputs and inconsistent state description
- **Severity:** minor
- **Problem:** I3 passes `silent: false` as a literal, so the helper's `silent` input is dead in the one real call site and the unit test for it is meaningless against the real wiring. I1 also says `_savingDismissed` is a "plain" flag, while I3 says to make it reactive state; it must be declared `state: true` in `static properties` (~L79), and `_savingManual` too, or the overlay will not re-render on dismiss.
- **Fix:** Drop `silent` from the helper (`_savingManual` is already manual-only) or pass the real value. State explicitly that both flags are `state: true`, initialised in the constructor (~L266).

### F4 — I2 — Garbled approach text and "OK" vs ✕-only ambiguity
- **Severity:** minor
- **Problem:** The I2 Approach contains an unfinished `modalFrame(title 'Saving to GitHub…'` or title "Saving"` clause with misplaced quotes and parentheses, and the open question on `ack` is still open. MODALS §5 says info modals are ✕-only, with `ack` as an owner-sanctioned exception for the roll modal and creation guide. A transient spinner is not obviously within that exception.
- **Fix:** Fix the title wording (one choice). Settle `ack` vs ✕-only: the qa-log answer says "Escape/backdrop/OK", so `ack` follows the owner, but cite that explicitly in the plan, and note that Enter would also close the overlay.

### F5 — I2/I3 — Fast saves cause a flash and a focus grab
- **Severity:** minor
- **Problem:** With no minimum display time (owner decision), a sub-200 ms save mounts a focus-trapping modal and tears it down immediately. This causes a visible flash and a focus move on every manual Save. The plan does not call this out.
- **Fix:** Name it in Risks and include it in the manual verification list. Do not add a delay unless the owner asks. This is a candidate for `NEEDS_HUMAN` only if the owner wants a show-delay, which would contradict the answer "no minimum display time" (a show-delay is a separate thing from a minimum display time).

## Verified OK
- `_saving` is also set at L1941 and L2021 (delete / custom-item saves). Neither calls `_doSave`, and the dedicated `_savingManual` flag correctly avoids showing the overlay there.
- `_doSave` structure matches the plan: the key prompt returns before `_saving = true`; the draft clash `return` and the conflict path both reach `finally`.
- Test coverage is limited to the pure helper; UI behavior is flagged for manual verification.
