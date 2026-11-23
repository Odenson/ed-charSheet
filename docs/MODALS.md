# Modals — the UI kit and the keyboard contract

Every modal in this app follows one keyboard and focus contract, implemented once
in the in-repo kit under [`ui/kit/`](../ui/kit/). This doc is the authority for
*how a modal behaves*; the Tier-1 UI rule that a modal **must** honour
Escape-closes / Enter-confirms (and that read-only modals close on Enter) lives
in [UI-GUIDELINES.md](UI-GUIDELINES.md) §7. New or edited modals use the kit;
they do not hand-roll Escape, Enter or focus handling, frame markup or button
styles.

## 1. The UI kit

| File | Contents |
|---|---|
| `ui/kit/modal-stack.js` | Pure (no `lit`, no DOM): the modal stack, `routeKey(facts)` (the ordered Enter/Escape router) and `footerHint()`. |
| `ui/kit/modal-controller.js` | `ModalController` (Lit reactive controller, lit-free): **one** capture-phase `document` key listener that acts on the top modal only, the held-key latch, initial focus, Tab trap, return-to-trigger. Also exports `currentModality`, `deepActiveElement`, `returnFocusToTrigger`. |
| `ui/kit/modal.js` | `modalFrame(ctl, opts)` (the Lit frame template), `modalCss` (frame styles; it includes `buttonCss`) and `ensureLightStyles()` (adopts the kit CSS scoped under `.kit-portal` for a light-DOM host). |
| `ui/kit/dirty.js` | Pure: `isDirty(snapshot, draft)`, the free-text dirty check (null/undefined/'' equal, numbers and booleans by string form, no trimming). |
| `ui/kit/scope-css.js` | Pure: `scopeCss(cssText, selector)`, wraps a stylesheet in a scope selector with native CSS nesting. |
| `ui/kit/button-css.js` | `buttonCss`: the one button shape and its tones. |

**The rule:** modals and modal-like UI use `ui/kit/`. `tools/check-ui-kit.mjs`
runs in `pretest` (`npm test`) and fails on new hand-rolled copies (see
[The UI-kit check](#the-ui-kit-check)). The kit never dispatches game events and
never touches character state: hosts pass `onConfirm` / `onClose` callbacks and
keep data-down / dispatch-up.

## 2. The contract

1. **Escape closes only the top modal.** Stacked modals close one per Escape.
2. **Enter = OK**: the primary action, or close for read-only modals (UI-GUIDELINES §7).
3. **Ctrl/⌘+Enter saves** in textarea modals (Enter keeps typing a newline;
   UI-GUIDELINES §7).
4. **Focus moves in** on open, **Tab is trapped**, and **focus returns to the
   trigger** on close. A pointer-opened modal restores focus with the keyboard
   ring suppressed; a keyboard-opened one keeps the ring.
5. **Theme-aware** (light and dark), two font weights, `--fs-*` tokens.
6. Backdrop click, ✕ and Escape are all the same cancel path.

## 3. Key routing

The wrapper turns a keydown into plain facts, and `routeKey` returns one of
`close | confirm | block | pass`. Anything but `pass` is swallowed
(`preventDefault` + `stopPropagation`), in the capture phase, so legacy
bubble-phase listener can also act (none remain outside `ui/kit/`; the UI-kit check forbids new ones). Ordered rules, first
match wins:

| # | Condition | Result |
|---|---|---|
| R1 | key is not Enter/Escape | pass |
| R2 | IME composing | pass |
| R3 | latched (held through a kit close/confirm) | block |
| R4 | stack empty | pass |
| R5 | target is in a dialog that is not on the kit stack (legacy modal on top) | pass |
| R6 | key repeat (except a plain Enter in a textarea inside the top modal) | block |
| R7 | `defaultPrevented` | pass |
| R8 | controller has no `kind` (legacy) | Escape → close; Enter → pass |
| R9 | target outside the top modal (stray focus / `<body>`) | Escape → close; modified Enter → block; plain Enter: info → close, input/confirm → confirm if allowed else block, picker → block |
| R10 | Escape | close |
| R11 | Shift/Alt+Enter | pass |
| R12 | Ctrl/⌘+Enter in a textarea | confirm if allowed, else pass |
| R13 | own-control target: textarea, select, link, a non-primary button, or `data-enter="local"` | pass |
| R14 | Enter on the primary | info → confirm; others confirm if allowed, else block |
| R15 | Enter by kind | info → close; input/confirm → confirm if allowed else pass; picker → pass |

- **`data-enter="local"`** marks a field whose Enter belongs to itself (the roll
  modal's optional-mod checkboxes, trade gem inputs, Disciplines fee fields).
- **Checkboxes and radios are fields**, not own-Enter controls, so Enter on them
  follows R15 unless marked local (keeps UI-GUIDELINES §8a "Enter saves" possible).
- **Held keys and the latch.** A held key acts once. When a kit modal closes or
  confirms (by any path, including a native click after a passed Enter on
  Cancel/✕/OK), the keys held at that moment are *latched*: their further
  repeats are swallowed, even with an empty stack, until that key's `keyup` (or
  window blur). So holding Enter on the roll's OK never re-fires the dice button
  that was just refocused.
- **Foreign-dialog rule.** Every modal is on the kit now; R5 (a dialog that is
  not on the kit stack keeps its own keys) stays as a safety net for any future
  third-party dialog.

## 4. ModalController

```js
import { ModalController } from './kit/modal-controller.js';
this._modalCtl = new ModalController(this, { kind: 'info', onClose: () => { this._modal = null; } });
```

Open from the same handler that sets state, passing the trigger:
`this._modalCtl.opened(event?.currentTarget)`. Route every close through the
controller (`requestClose()` for user cancel, `close()` programmatically).

| Option | Default | Meaning |
|---|---|---|
| `onClose(reason)` | — | `'cancel'` or `'confirm'`. Runs **after** the stack entry is removed and focus restored. |
| `kind` | `null` | `input`, `confirm`, `info`, `picker`, or a function returning one (read per key and per render). `null` = legacy: Enter is not routed and today's focus order is kept. |
| `onConfirm` | — | Run by `confirm()` for input/confirm kinds. It never closes the modal by itself; the host decides. |
| `canConfirm` | primary exists and is enabled | Evaluated per key. Always false unless the kind is input/confirm. |
| `primarySelector` | `[data-primary]` | Locates the router primary. |
| `initialFocus` | — | Selector, array of selectors (tried in order) or a function returning either. |
| `dialogSelector` | see below | Explicit dialog override. |
| `isDirty` / `onDiscardPrompt` | — | Dirty guard (below). |
| `light` | `false` | Portal hosts: the root is `document`, not `host.renderRoot`. Used by `ed-save-key` (credential autofill needs the field in the light DOM) with `ensureLightStyles()`; its portal div carries the class `kit-portal`. |

Methods: `opened(trigger)`, `close({ restoreFocus = true, reason = 'cancel' })`
(unguarded), `requestClose()`, `confirm()`, `refocus()`, `dialogEl()`,
`primaryEl()`, plus the `id`, `open` and `kind` getters.

- **Close reasons.** `requestClose()` gives `'cancel'`; an info modal's
  `confirm()` gives `'confirm'`. A separate-component modal (`ed-confirm`,
  `ed-trade-modal`) closes with `{ reason: 'confirm' }` before dispatching
  `confirm`, and only dispatches `close` for `'cancel'`: hosts read prompt state
  in `@confirm` and clear it in `@close`, so a `close` before `confirm` would
  cancel the action.
- **Dialog lookup.** `dialogSelector` if given; for a controller with a `kind`,
  only `[data-modal="<id>"]` (the frame stamps it, so several controllers can
  share one shadow root); otherwise `[role="dialog"]`.
- **Initial focus** (controllers with a `kind`): an enabled `[autofocus]`; the
  enabled primary (input/confirm only); `initialFocus`; for `info`, the primary
  (the `ack` button) else the dialog; the first enabled control in `.mbody`
  (never the header ✕); the dialog (`tabindex="-1"`). A legacy controller keeps
  `[autofocus]`, `initialFocus`, first focusable, dialog.
- **`refocus()`** re-runs the order while open, for a view that changes in place
  (the roll chooser becoming the result).
- **Dirty guard (D3).** User cancels (Escape, ✕, backdrop, Cancel) call
  `onDiscardPrompt` when `isDirty()` and stay open. Free-text modals (Notes note
  and event, Edit character details, custom item) ask; short numeric or choice
  modals (Add Legend, Settings, Trade, Take damage, Karma Ritual) do not. The
  host snapshots its fields when the modal opens, passes
  `isDirty: () => isDirty(snap, draft)` (`ui/kit/dirty.js`) and sets a flag in
  `onDiscardPrompt` that renders a stacked
  `<ed-confirm heading="Discard unsaved changes?" confirmLabel="Discard"
  cancelLabel="Keep editing" focusCancel>` **after** the frame (same layer, DOM
  order puts it on top). Its `@confirm` calls the host controller's unguarded
  `close()`; its `@close` (Escape, Keep editing, ✕) clears the flag and calls
  `refocus()` so the field (`autofocus`) is focused again. `ed-confirm` takes
  `cancelLabel` and `focusCancel` (stamps `autofocus` on Cancel, which wins over
  the enabled primary) so Enter on the prompt keeps editing. The hook can also be
  a **back-one-step interceptor**: `onDiscardPrompt` may change the view instead
  of asking (the custom-item form returns to the list; the day-reset modal
  dismisses its embedded roll). The custom-item prompt uses the confirm label
  "Close" because its working set persists in the browser.
- **Hand-offs.** `close({ restoreFocus: false })` is for a hand-off to another
  modal that takes focus and returns it itself. `close()` restores focus
  synchronously *before* `onClose`, so a follow-on modal keeps its own focus.

## 5. modalFrame

```js
static styles = [modalCss, css`…host styles…`];
render() { return modalFrame(this._ctl, { title, layer: 2100, width: '26rem', body, primary: { label: 'OK' } }); }
```

Renders `.overlay > .modal[role=dialog][aria-modal][data-modal] > .mhead / .mbody /
footer`. Options: `title` (string or template), `label` (the `aria-label`;
required when the title is a template), `titleExtra`, `body`, `layer`, `width`,
`scroll` (85vh cap), `cancelLabel` (default `Cancel`), `focusCancel` (autofocus the Cancel button), `variant` (stamps `data-variant`; style
`[data-variant='…']`, the sanctioned variant hook), `primary`
`{ label, tone, disabled, type, form, title, className }`, `extra`, `ack`,
`hasTextarea`.

| Host | Layer | Width |
|---|---|---|
| Disciplines, Equipment item, Equipment add-item picker (kind `picker`; its own controller) | 2000 | 30rem, scroll |
| confirm, Take damage, Spells info / learn / cast | 2100 | 26rem / 26rem / 30rem / 48rem scroll / 30rem |
| Notes, Edit details, Add Legend, custom item, day reset, picker, Combat step audit | 2100 | 30rem / 32rem scroll / 26rem / 40rem scroll / 26rem / 24rem scroll / 26rem |
| Overview modals, changelog, homebrew | 2000 | 32rem scroll (Karma Ritual 26rem; lightbox `auto`, no scroll) |
| trade, new character / rename (`ed-new-character`, kind `input`), delete character (`ed-delete-character`, kind `input`, danger primary) | 2150 | 27rem scroll / 24rem / 26rem |
| manual-save spinner (`ed-saving`, kind `info`, mounted by ed-app while a manual `_doSave` is in flight; dismissible, the save continues) | 2150 | 20rem |
| save key (`ed-save-key`, portal; must sit above the picker's delete modal) | 2200 | 26rem |
| create custom skill (`ed-custom-skill`, kind `input`; dispatches `ed-create-custom-skill`, then closes; opened from the Disciplines skill pickers) | 2200 | 30rem scroll |
| Settings, conflict | 2200 | 26rem |
| roll | 3000 | 340px |

Creation mode (UI-GUIDELINES §6b) adds three more uses of the kit and no new
host: the Disciplines `creation-skill` picker (kind `picker`, layer 2000, 30rem
scroll; its Knowledge and Artisan free-text fields carry `data-enter="local"` and
handle their own Enter; it and the edit-mode learn-skill picker also carry category filter chips, `ui/skill-filter.js`, and, when the homebrew rule `skills.allowCustom` is on, a per-section "Create custom skill" button that opens `ed-custom-skill` above the picker so Escape closes only the form, which is not dirty-guarded), the Spells starting-spell picker (kind `picker`, layer
2100, 30rem scroll, its own controller in the Spells shadow root), the one-off "Creating your character" guide (`ed-creation-guide`, kind `info`, layer 2150,
30rem scroll, "Got it") shown after a new character is created, and the "Finish
creation?" `ed-confirm` (tone `accent`, with a warning line) rendered by ed-app.

**Footers (D5) and hint (V4).** Input and confirm modals: `[Cancel] [Primary]`,
right-aligned, with a muted hint "Enter = OK · Esc = Cancel" ("Ctrl+Enter saves ·
Esc = Cancel" for textarea modals; the text cannot be overridden). Read-only
(`info`) modals: ✕ only, no footer, no hint. **Roll-modal exception** (owner,
qa-log 13:40): the roll result view and the Knockdown result keep a visible
**OK** via the `ack` option; Enter = OK closes it. Pickers: ✕ only.

## 6. buttonCss

`.btn` (neutral) and `.btn.primary` (weight 500, amber by default) share one
shape. A tone class recolours: `accent`, `danger`, `spell`, `karma`, `heal`
(declared after `.primary`, so a tone wins). Karma tone is for spending Karma;
spell tone on Spells. Disabled is opacity 0.4. Colours are host variables with
`light-dark()` fallbacks. There is no focus-ring rule, so the UA ring stays.

## 7. Hand-offs and known trigger-gone cases

Focus falls to `<body>` (as before) when the trigger is gone or a hand-off
carries no trigger:

- Spells cast → roll (`close({ restoreFocus: false })`);
- Take damage → Knockdown roll (`close({ restoreFocus: !roll })`);
- Apply closes (the roll is removed; no restore);
- an Equipment full sell (the tile is removed);
- the `ed-saving` spinner opens with no trigger (`opened(null)`), so its removal (save finished, or
  hand-off to the conflict / rename modal) never moves focus.

## 8. Separate-component modals

The migrated child modals `ed-add-legend`, `ed-edit-meta`, `ed-edit-portrait`, `ed-custom-item`, `ed-custom-skill`,
`ed-day-reset`, `ed-conflict`, `ed-settings`, `ed-save-key`,
`ed-character-picker`, `ed-new-character`, `ed-delete-character` and `ed-saving` (a dismissible
spinner shown while a manual save runs; closing it hides it only, the save carries on) also own their controller. Unlike
`ed-confirm`, they dispatch their domain event (for example `ed-conflict`,
`ed-edit-meta`, `create-character`) and then `close` for any reason (`onClose`
always dispatches `close`). Hosts act on the domain event and clear their mount
state in `@close`.

**Modals nested in a picker (`ed-character-picker`).** The loader renders
`<ed-new-character>` (input, layer 2150), `<ed-delete-character>` (input, layer 2150, opened by
a row's Delete button; type-the-name confirm: Enter confirms only when the typed name matches and
nothing is in flight, and it stays open while busy or showing an inline error until the host removes
it; the picker stops its `close` and dispatches `delete-dismissed`, but deliberately does not stop
`delete-character { id, deleteImage }`, which ed-app acts on) and an `<ed-confirm>` (the draft Discard,
layer 2100, which DOM order puts on top) as children in its own shadow root, after
its frame, so the kit stack routes Escape to the top one only. Their `close` and
`confirm` events bubble composed, so the picker calls `e.stopPropagation()` on the
child element for both: an un-stopped `close` would reach ed-app's `@close` on
`<ed-character-picker>` and shut the whole picker. `create-character` (from
`ed-new-character`) is deliberately not stopped; ed-app acts on it. This is the rule
for any modal that renders a child modal whose `close` its own host listens to.
The picker is kind `picker`, so Enter on a focused row, "+" (start a new character)
or Discard ✕ button activates it natively (R15 passes it on); each trigger focuses
itself first so the kit returns focus to it on close (Safari does not focus a
clicked button), and after a discard the picker re-runs `refocus()` once the shorter
list renders. The picker body scrolls (`scroll`, 85vh cap) because the new-character
section makes it taller. `ed-new-character` is kind `input`: Enter confirms the
primary only when it is enabled (a valid name and a race), and the name field is
`autofocus`.

`ed-confirm`, `ed-trade-modal` and `ed-roll-modal` are their own elements shown
by a parent. `ed-confirm` and `ed-trade-modal` own a controller and only dispatch
`confirm` / `close` (Confirm dispatches only `confirm`). `ed-roll-modal` owns a
controller for its framed views and dispatches `close` for any reason; the
**parent (`ed-app`) owns the trigger**, captured with `deepActiveElement()` and
restored in `_closeRoll` with `returnFocusToTrigger()`:

```js
this._rollTrigger = deepActiveElement();
this._rollOpenedByKeyboard = currentModality() === 'keyboard';
```

The embedded roll (inside the day-reset modal) never opens its controller and
keeps its own `.dm` markup; its ✕/OK dispatch `close` directly.

## 9. Why the ring can be suppressed across Shadow DOM

Each component styles its own focus ring inside its shadow root with no
`!important`. The controller restores a pointer-opened trigger by setting
**inline** `outline:none; box-shadow:none` on the element itself — inline styles
outrank the component's rule even across the shadow boundary — then tears that
override down on the trigger's next real interaction, so ordinary keyboard focus
still rings. No global CSS needed.

## 10. Not yet on the kit

Nothing: every modal is on the kit. (The remaining
`tools/ui-kit-baseline.json` entries are non-modal: Spells and the Legend-spent
view font sizes, and one inline-styled button in `ed-app`.)

## 11. Checklist for a touched modal

- [ ] Built on `ui/kit/` (`ModalController` + `modalFrame` + `modalCss`); no
      `document` key listener, no hand-rolled frame/button CSS.
- [ ] Escape closes only this modal when it is on top; Enter = OK (or closes, if
      read-only).
- [ ] Every close path goes through the controller so focus returns to the trigger.
- [ ] Pointer-opened → no ring left; keyboard-opened → ring kept.
- [ ] Fields that own Enter carry `data-enter="local"`.
- [ ] Footer per D5, hint per V4; title at `--fs-title`.
- [ ] Works in light and dark mode.
- [ ] `npm test` passes, including the UI-kit check.

## 12. The UI-kit check

`tools/check-ui-kit.mjs` counts, per `ui/**/*.js` file (comments stripped):
`keydown` (document/window keydown or keyup listeners), `dialog-role` (a literal
`role="dialog"`), `frame-css` (CSS naming `.overlay`, `.modal`, `.mhead`,
`.mclose` or `button.btn`), `font-size` (a non-`--fs-*` size, or a `--fs-*`
redefinition) and `button-style` (an inline `style=` on a `<button>`). Files in
`ui/kit/` are exempt except for `font-size`.

`tools/ui-kit-baseline.json` is a **two-way ratchet** allowlist of today's
counts; since `ui-kit-modal-migration-2` it holds only the three non-modal
entries (`ed-app.js` button-style 1, `ed-spells.js` font-size 5,
`legend-spent-view.js` font-size 2): a count above it fails as a new
violation ("use ui/kit/"); a count below it fails with "lower the baseline to N"
(delete the rule at 0); a baseline entry for a missing file fails with "remove
stale entry". A migration lowers its own file's entry in the same change.
