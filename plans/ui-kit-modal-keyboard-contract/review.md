# Plan Review: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Summary
The plan covers all twelve tickets and its line references check out against the code. Every item that changes Tier-1 behaviour or text (I6, I9, I10, I11, I12) cites the D1 sign-off at 11:53, and the 13:40 (roll OK) and 13:42 (§7 scope) decisions are applied as recorded. There are no Tier-2 items and no rule dependencies (`rules.md` is clean). No blockers. There are **11 findings: 4 major, 7 minor**. The major ones:
- the I2 baseline is wrong for `ui/modal-controller.js`;
- the key router lets held keys and modifier keys get round the K1/K2 fixes;
- I6 could silently break the ✕/OK dismiss of the roll embedded in day-reset;
- the owner checklist leaves out most of the DOM behaviour that no agent can test.

## Findings

### F1 — I2 / I3 — The initial baseline leaves out `ui/modal-controller.js`, and the ratchet does not handle deleted files
- **Severity:** major
- **Problem:** I2 lands before I3. At that point the CLI walks `ui/**` and the controller still lives at `ui/modal-controller.js`, outside the exempt `ui/kit/`. It has two rule-1 hits:
  - `window.addEventListener('keydown', …)` at line 42;
  - `document.addEventListener('keydown', …)` at line 134.

  After comment stripping it also has `'[role="dialog"]'` at line 113, which counts for rule 2 if rule 2 scans code and not only `html` templates. A recount with the `stripComments` approach gives r1 = 2 and r2 = 1. The measured table leaves this file out, and I3 says it "was never counted". Followed literally, I2's real-repo test fails. If a builder adds the entry instead, I3 then has to remove an entry for a file that no longer exists. The plan's ratchet rules do not say what happens to a baseline entry whose file is gone (moved or renamed). If the analyzer only walks files that exist on disk, stale entries are silently ignored, and a renamed file drops off the allowlist without anyone noticing.
- **Fix:**
  - Add `ui/modal-controller.js` (r1: 2, and r2 if the analyzer counts it) to I2's initial baseline, and delete it in I3. The alternative is to exempt that one path explicitly in I2, with a test.
  - Correct the I3 dependency note.
  - Add a ratchet rule plus a fixture: a baseline entry for a file that does not exist fails, with "remove stale entry for <file>".

### F2 — I1 / I3 — Router order is not stated, and a held key can still chain close → reopen (K2, K1)
- **Severity:** major
- **Problem:**
  1. The routing table gives no order of precedence. Read top-down (first match wins):
     - "Escape → close" is matched before "repeat → swallow". A held Escape closes the top modal on the first keydown, and each auto-repeat then closes the next stack entry: K1 again, under a held key.
     - "Shift/Alt+Enter → pass" and "picker kind → pass" are matched before "target outside the top → never pass". Shift+Enter on the trigger behind the backdrop, or any Enter behind a picker, still clicks that trigger natively.
  2. Even with the repeat row moved first, repeats are only swallowed while the stack is non-empty. Two cases:
     - **Holding Enter on the roll modal's OK.** The kit closes the modal, and `_closeRoll` restores focus synchronously to the dice button (`ui/ed-app.js:1570–1577`). The stack is now empty, so the next auto-repeat keydown passes and clicks the dice button. That is a new `ed-roll`, a new `rollId`, an early Discord flush and a second Strain charge.
     - **Holding Enter on Cancel.** Cancel is a non-primary button, so the router passes and its native click closes the modal. The same chain follows.

     So the plan's claim that "a held Enter cannot chain open → close → open" covers only the open half.
- **Fix:**
  - **Precedence.** State it explicitly in I1, for example:
    1. `isComposing`
    2. foreign dialog
    3. repeat / latch
    4. target outside the top modal
    5. Escape
    6. modifiers
    7. own-control rows
    8. kind rows
  - **Key latch.** Add one in the controller. When a kit modal closes or confirms while a key is held, by any path including a native click from a passed Enter, swallow further `repeat` keydowns of that key until its `keyup`, even with an empty stack. Pass it to `routeKey` as a plain fact (e.g. `latched`) so it stays unit-testable. Repeats in textareas and in legacy modals stay unaffected, because the latch only sets after a kit close.
  - **Tests.** Add I1/I3 tests for:
    - held Enter on OK, and on Cancel, does not reopen the roll;
    - held Escape on a two-entry stack closes only the top;
    - Shift+Enter, and picker-kind Enter, on a target behind an open kit modal is swallowed.

### F3 — I6 — Routing `_close` through the controller breaks the ✕/OK dismiss of day-reset's embedded roll
- **Severity:** major
- **Problem:**
  - I6's "Where" says "route `_close` through the controller". The result-view `.dm` template is shared by both modes, and in embedded mode its `.x` and `button.ok` call `this._close` (`ui/ed-roll-modal.js:531`, `:637`).
  - `ed-day-reset` turns that `close` event into `roll-dismiss` (`@close=${(e) => this._rollClosed(e)}`, `ui/ed-day-reset.js:146`, `:106–109`).
  - In embedded mode the controller is never opened, and `ModalController.close()` returns early when it is not open (`ui/modal-controller.js:169–170`). So the embedded ✕/OK would silently do nothing.
  - I6's acceptance criterion and the owner checklist only test "dismisses on Escape". That path is day-reset's own legacy listener, so neither would catch this break.
- **Fix:**
  - State that in embedded mode `_close()` keeps dispatching `close` directly. Only the framed views go through `ctl.close()`, whose `onClose` then dispatches.
  - Add to I6's acceptance criteria and to the owner checklist: "Day-reset: the embedded roll's ✕ and OK return to the stats view; Heal applies; Escape dismisses."

### F4 — Owner manual checklist — Most DOM behaviour that agents cannot test is missing
- **Severity:** major
- **Problem:** I4–I11 cannot be unit-tested (they import `lit`), so their acceptance criteria rest entirely on the owner checklist. The checklist covers stacked Escape, the roll views, held Enter, §6a and the visible changes, but leaves out:
  - **Legacy-modal smoke.** The new capture-phase `document` listener sees every keydown in the app, so the legacy modals need a quick pass:
    - §8a Settings: Enter saves from a field, the switches and the radio group;
    - a Notes note modal, and the Notes delete confirm over it (Escape closes only the confirm);
    - Combat clear-log and drink confirms;
    - Overview info, Karma Ritual and Add Legend close on Escape;
    - the §6a picker: Enter on the focused row.
  - **I9 add-item combobox:** ↑/↓/Enter; Escape from the input, from Done and after a row click; closing on an outside click.
  - **I8:** Enter in Amount confirms only when the allocation is valid; Enter in the gem row only adds the gem.
  - **I10:**
    - Enter on a spell row only selects it;
    - Enter in the silver field confirms Learn only when allowed;
    - Enter in the cast target field confirms;
    - the cast → roll hand-off has focus inside the roll;
    - the learn draft survives Escape on the roll.
  - **I11:**
    - the Half-Magic default option and the Learn skill/knack search are autofocused;
    - Train focus when allowed and when blocked;
    - info Enter closes;
    - the Circle-track tooltip and requirement row are unchanged;
    - the plan's own flagged behaviour, "Enter in the Train fee field trains when allowed", which the owner should accept explicitly.
  - **I7:** Enter at Take 0 does nothing, and after the Knockdown hand-off focus is inside the roll.
  - **Held keys:** held Escape on a stack closes only the top; held Enter on OK does not reopen (F2).
  - **Day-reset embedded:** ✕/OK dismiss (F3).
  - **Karma:** toggling Karma charges it once.
- **Fix:** Add these to the "Owner manual checklist" section, grouped by modal, so the Dev Lead copies them into `build-log.md`.

### F5 — I6 — Focus after a chooser commits, and primary-button tones in the roll modal
- **Severity:** minor
- **Problem:**
  - **Focus.** After `_commit` / `_commitAim`, the chooser template is replaced by the result view. The focused Roll button is removed and focus falls to `<body>`. I6 only says "focus moves to the primary on open", so a keyboard user ends up outside the dialog until they press Tab again.
  - **Tones.** I6 gives no tone for its primaries. Today the aim chooser's "Roll" is karma-styled (`button.commit`), but V2 (11:58) gives the karma tone only where Karma is spent. If aim Roll becomes amber, that is an unlisted visible change.
- **Fix:**
  - Have the controller re-run its initial-focus order when the roll view changes (for example a `ctl.refocus()` from `updated()` after a commit). Add it to the acceptance criteria.
  - Name each primary's tone: set-dice Roll ✦ N karma, aim Roll per V2, Apply amber. Add any colour change to the "visible changes" checklist entry.

### F6 — I1 — A global "checkbox → pass" rule conflicts with §8a when Settings migrates
- **Severity:** minor
- **Problem:**
  - The checkbox row comes from T7 (the roll modal's optional-mod checkboxes), but it is written as a global router rule.
  - The plan says §8a "stays possible" because radios count as fields. It does not consider Settings' autosave and Discord switches, which are `input[type=checkbox]` inside its `<form>` (`ui/ed-settings.js:127`, `:206`), where §8a (Tier 1) says "Enter saves (form submit)".
  - Once Settings joins the kit, the global rule would make Enter on those switches a no-op.
- **Fix:** Keep checkboxes as fields in the router. Mark the roll modal's optional-mod checkboxes `data-enter="local"`, which satisfies T7. If the global rule stays, document in MODALS.md that the Settings migration must override it.

### F7 — I10 / I2 — `.lflag` is modal code, and feature 2 cannot empty the baseline
- **Severity:** minor
- **Problem:**
  - **`.lflag` is modal code.** T4 and the plan call the five `ed-spells.js` rule-4 literals "tab-body styles outside modal code". But `.lflag` (`ui/ed-spells.js:212`, `font-size: 8px`, below the §3 floor `--fs-eyebrow`) renders inside the Learn modal's spell rows (`:800`), which I10 migrates.
  - **Leftover entries.** After this build the baseline keeps three V8 (non-modal cleanup) entries: `ed-spells.js` r4 ×5, `legend-spent-view.js` r4 ×2 and `ed-app.js` r5 ×1. At least the five Spells literals belong to the later cleanup feature (qa-log 11:52), so the second feature cannot "empty the baseline allowlist" as qa-log 12:01 says.
- **Fix:**
  - Either tokenise `.lflag` in I10 (r4 → 4; note the change from the ticket's number and add it to the visible-changes list), or keep it under the 11:52 V8 deferral and correct the description.
  - Record in the plan which baseline entries outlive feature 2, so the next planning round decides whether to absorb them.

### F8 — I9 — Cancelling `pointerdown` may not keep focus in the add-item input
- **Severity:** minor
- **Problem:** I9 keeps focus in the combobox input after a row click by cancelling `@pointerdown` on `.res`. Focus change is a default action of `mousedown`, and browsers do not reliably suppress it when only `pointerdown` is cancelled. Focus can then still leave the input, and "Escape after a row click" breaks.
- **Fix:** Use `@mousedown=${(e) => e.preventDefault()}` on `.res`, optionally together with the pointerdown handler. Keep the row-click Escape case on the owner checklist (F4).

### F9 — I12 — The new §7 text ships while the legacy read-only modals do not follow it yet
- **Severity:** minor
- **Problem:** The signed-off §7 sentence ("Read-only modals: Enter closes") ships with this build. The read-only modals left for feature 2 still click the trigger behind on Enter:
  - Overview ⓘ info, character details and Legend spent;
  - the Combat step audit;
  - changelog and homebrew;
  - the lightbox.

  That is a known code/doc disagreement for at least one release. CLAUDE.md says such a disagreement must be resolved explicitly.
- **Fix:** In I12, add a short "not yet on the kit" list to MODALS.md (and the review doc's status table), naming those modals and the feature that migrates them, so the gap is recorded and not silent.

### F10 — I4 — The frame for the `picker` kind is not specified
- **Severity:** minor
- **Problem:** I4 specifies footers for `input`/`confirm` and for `info`, but not for `picker`, which is used by the four Disciplines pickers (I11). Nothing says whether pickers get a footer, a Cancel button or the V4 hint.
- **Fix:** State it: picker frame is ✕ only, no footer button and no hint, the same as today. This is consistent with D5/V4, because a picker has no primary.

### F11 — I3 — The new initial-focus order changes Disciplines behaviour before I11
- **Severity:** minor
- **Problem:** I3 calls the change "legacy-neutral" with "no visible change". But the new focus order (never the header ✕, then the dialog) also applies to controllers created without a `kind`:
  - From I3 until I11, the Disciplines info modals focus the dialog instead of ✕. Enter is not routed, so Enter stops closing them.
  - Blocked Train focuses the fee field.

  The final state is right, but the I3 claim and its "work as today" acceptance criterion are inaccurate for the commits in between.
- **Fix:** Either apply the new focus order only to controllers that have a `kind` (no-kind controllers keep today's order), or correct I3's claim and acceptance criterion to describe this interim change.
