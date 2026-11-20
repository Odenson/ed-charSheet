# Test Plan: UI kit + modal keyboard contract (ui-kit-modal-keyboard-contract)

## Test files
- ui/kit/modal-stack.test.js (new)
- ui/kit/modal-controller.test.js (new)
- tools/check-ui-kit.test.js (new)
- tools/check-imports.test.js (changed: real-repo walker now descends into `ui/kit` and asserts `ui/kit/modal-stack.js` and `ui/kit/modal-controller.js` are walked; one new source test for the walker line and the `pathToFileURL` main-module guard)

## Coverage
Rules: this feature implements no Earthdawn rule; every Rule field is n/a (spec "Rules"; `rules.md` has no ids).

### ui/kit/modal-stack.test.js
- Stack tests (push moves to top / idempotent, remove no-op, top null when empty, entries copy, clear, instances independent, KINDS frozen). **Validates:** I1 stack contract. **Catches:** a stack that duplicates entries or acts on the wrong entry.
- `R1`..`R15` one or more tests each, plus "missing boolean / unknown kind reads as null/false". **Validates:** I1 ordered router. **Catches:** reordered rules.
- I1 ordering cases, each its own test: held Escape on a two-entry stack (close then block); Shift+Enter and picker Enter behind the top blocked; latched Enter with empty stack blocked; foreign beats repeat and outside-top (R5 tests); checkbox confirms, passes with `targetEnterLocal`; R6 textarea carve-out (plain passes, Ctrl/Meta/outside-top/Escape still block); Ctrl/Meta+Enter outside a textarea routes like plain Enter.
- `footerHint` both strings. **Validates:** V4 hint text.
- Purity source check (no `lit`, no `document`/`window` outside comments). **Validates:** "imports nothing from lit and touches no DOM global".

### ui/kit/modal-controller.test.js (fake host/trigger/dialog per spec)
- Unique `kit-modal-<n>` ids; registers with host; opened/close push and remove; re-open moves to top without duplicates; trigger replacement rule.
- Escape top-only on two stacked controllers, twice; held Escape closes once and leaves the lower modal; empty stack passes.
- Hand-off leaves the new modal on top; inside `onClose` the trigger is focused and the entry is gone; `restoreFocus:false`; `hostDisconnected` removes entry, restores focus, no `onClose`.
- Dirty guard: Escape and `requestClose` call `onDiscardPrompt` and stay open; `close()` unguarded; clean or no hook closes.
- Reasons: `requestClose` -> `cancel`; info `confirm()` -> `confirm`; input `confirm()` calls `onConfirm`, never `onClose`; `canConfirm` gating; `ctl.canConfirm()` false for non input/confirm kinds; default `canConfirm` from the primary; `primarySelector`; `dialogEl()` lookup order.
- Legacy-neutral default (no `kind`: Enter passes, Escape closes); `kind` function re-read per key; `canConfirm` evaluated per key; `onSwallow` only on non-pass.
- Latch (F2): routed close with Enter held -> repeat blocked, keyup releases; latch only affects repeats; Escape latch does not swallow Enter; native-click path (Enter passes on Cancel, then `requestClose()`); `confirm()` latches; `hostDisconnected` latches; composing keys never latch; `releaseAllKeys`, `handleKeyup`, `__resetModalKit`.
- Initial focus: kit order steps 1-6 (autofocus first-enabled, primary for input/confirm only, `initialFocus` string/array/function, info primary else dialog, first enabled FOCUSABLE in `.mbody`, dialog with `tabindex=-1`), legacy order, `refocus()` (F5), no focus before `updateComplete` or after an early close.
- Assumption worth knowing: the tests treat the controller itself as the stack entry (`modalStack.top() === ctl`, `entries().includes(ctl)`), which follows from the spec's "top.requestClose()/top.confirm()".
- Assumption: for an `info` kit modal with no `[data-primary]` and body focusables, focus goes to the dialog (spec step 4 "otherwise the dialog").

### tools/check-ui-kit.test.js
- `RULES` order; `countViolations` shape. One fixture set per rule (keydown, dialog-role, frame-css, font-size incl. `--fs-*` redefinition, button-style).
- Gotchas: `.overlay=${x}` = 0; `font-size: var(--fs-body)` and extra-space `var(--fs-title)` = 0; `<button @click=${() => go()} style=...>` = 1 and the arrow does not end the tag; `'[role="dialog"]'` = 0; `.modal.magic` = 1, `[data-variant='magic']` = 0, `.modal-x`/`.mtitle`/`.learnmodal` = 0; `@media{.overlay{}}` = 1; `el.`/`this.addEventListener('keydown')` = 0; `ui/kit/` file counts only `font-size`.
- Ratchet kinds with exact messages: `new-violation`, `no-entry`, `ratchet` (and "(delete the rule)"), `stale-entry`, `bad-entry`; sort order; `counts` non-zero only; comments stripped; `listUiSources` recursive and excluding `*.test.js`.
- Real repo passes against the committed baseline; baseline well formed. **End state (I3, I5-I11):** no baseline entries for the seven migrated files or `ui/modal-controller.js`; `ed-spells.js` = `{font-size: 5}`; `ed-app.js` = `{button-style: 1}`; `legend-spent-view.js` = `{font-size: 2}`; exactly the 16 expected files; the seven hosts have zero keydown/dialog-role/frame-css/button-style violations (confirm/roll/damage/trade/equipment/disciplines also font-size 0); `ui/modal-controller.js` deleted, `ui/kit/modal-controller.js` exists, no non-kit `ui/` file imports `./modal-controller.js`.
- `package.json` `pretest` and `lint:ui-kit`; CLI exits 0 and prints the success line.
- `data/changelog.json` has an `improved` entry whose text contains "Enter = OK" and "Escape closes only the top" (shape and key phrases, anywhere in unreleased/releases, so a later release move does not break it).

### tools/check-imports.test.js
- Real-repo walker includes `ui/kit/` (I3) and source guard for `rel === 'ui/kit'` plus `pathToFileURL` (I3).

## Acceptance-criteria mapping
- I1: modal-stack.test.js (all). I2: check-ui-kit.test.js (rules, ratchet, baseline, CLI, pretest). I3: modal-controller.test.js (stack lifecycle, latch, focus), check-imports.test.js, "controller moved" test.
- I4 (kit frame/button CSS): not automatable (Lit).
- I5-I11 migrations: automated only through the baseline end-state and zero-violation tests (listeners deleted, no frame CSS/role=dialog/button style left); behaviour is manual.
- I12 docs: only the changelog line is automated.

## Not covered (and why)
Lit/DOM, left to the owner's manual checklist in plan.md:
- `modal.js` frame markup/footers/hint display, `button-css.js` tones, light/dark appearance.
- The DOM keydown wrapper: capture-phase swallowing, composedPath target/dialog/owner facts, `trapTab` (Tab trapping and wrap, stray-focus recovery).
- Real focus behaviour: focus returns to the trigger, no stuck ring on pointer opens, trigger-gone cases.
- Every host migration's behaviour: confirm, roll (chooser/aim/apply/OK, embedded unchanged), damage (Take 0 blocks Enter), trade (gem Enter local), Equipment item (picker Escape), Spells info/learn/cast, Disciplines nine modals; Strain and Karma charged once; held Enter does not re-open the roll.
- Docs content (UI-GUIDELINES section 7 line, MODALS.md, GUARDRAILS, ARCHITECTURE, CLAUDE.md, review table).

## How to run
`npm test`
