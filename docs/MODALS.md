# Modals — the standard implementation

Every modal in this app follows one focus contract, implemented once in
[`ui/modal-controller.js`](../ui/modal-controller.js). This doc is the authority
for *how a modal behaves*; the Tier-1 UI rule that a modal **must** exist for
these interactions (Escape-closes / Enter-confirms, theme-aware) lives in
[UI-GUIDELINES.md](UI-GUIDELINES.md). New or edited modals adopt the controller;
they do not hand-roll their own Escape/focus handling.

## The bug this prevents

> "I press Escape to close the modal and a focus ring is left stuck on the button
> that opened it."

Cause: an inline modal (rendered from a component's own `_modal` state) never
moved focus off the trigger when it opened. You click the button (pointer — no
ring), the modal opens with focus still on that button behind the backdrop, you
press **Escape** (keyboard), the modal closes, and *that keydown* flips the
still-focused button into `:focus-visible` — so a ring appears on it. It reads as
"Escape parked focus on the button."

It is a whole family: keyboard users also never got their focus into the dialog,
Tab escaped to the page behind the backdrop, and focus was lost to `<body>` on
close. One contract fixes all of it.

## The contract

1. **Escape closes.** (Tier-1.) The controller owns a document-level keydown
   listener while the modal is open — the component does not add its own.
2. **Enter confirms**, where the modal has a primary action. The component
   focuses its primary control (see *Initial focus* below) so Enter triggers it.
3. **Focus moves into the dialog on open.** Keyboard and screen-reader users land
   inside the modal, not stranded on the trigger.
4. **Tab is trapped** within the dialog while it is open.
5. **Focus returns to the trigger on close** — via Escape, the ✕ button, or the
   backdrop. If the modal was opened by **pointer** (mouse/touch), the trigger's
   keyboard focus ring is **suppressed** for that restore (no stuck highlight); if
   it was opened by **keyboard**, the ring is kept (the keyboard user needs to see
   where focus went). This is the owner-chosen behaviour: *return-to-trigger, no
   ring on pointer opens*.
6. **Theme-aware, backdrop + ✕ + Escape all close.** Unchanged from before.

### Why the ring can be suppressed across Shadow DOM

Each component styles its own focus ring inside its shadow root (e.g.
`.tinfo:focus-visible { box-shadow: 0 0 0 3px … }`), with no `!important`. The
controller restores a pointer-opened trigger by setting **inline**
`outline:none; box-shadow:none` on the element itself — inline styles live on the
node and outrank the component's rule even across the shadow boundary — then tears
that override down on the trigger's next real interaction, so ordinary keyboard
focus still rings. No global CSS, no per-component change needed.

## Adoption recipe (inline-state modal)

For a component that renders a modal from its own reactive state (the common
case — `ed-disciplines`, `ed-equipment`, …):

```js
import { ModalController } from './modal-controller.js';

constructor() {
  super();
  this._modal = null;
  // onClose is the host's own close side effect; the controller calls it AFTER
  // focus is restored. It owns the Escape listener and the focus trap.
  this._modalCtl = new ModalController(this, { onClose: () => { this._modal = null; } });
}

// Open from the SAME handler that sets state, passing the trigger element so
// focus can return to it. `event.currentTarget` is the button that was clicked.
_openModal(entry, event) {
  this._modal = entry;
  this._modalCtl.opened(event?.currentTarget);
}
```

- Every **info/open** button: `@click=${(e) => this._openModal(x, e)}` — pass the
  event so the controller learns the trigger.
- Every **close** point (backdrop `@click`, the ✕ button): route through
  `() => this._modalCtl.close()`, **not** a direct `this._modal = null`. Closing
  through the controller is what restores focus. (Escape is automatic.)
- Keep `@click=${(e) => e.stopPropagation()}` on the inner `.modal` so a click
  inside it doesn't hit the backdrop's close.
- The dialog element must match the controller's `dialogSelector` (default
  `[role="dialog"]`). Keep `role="dialog"` and `aria-modal="true"` on it.

### Options

`new ModalController(host, opts)`:

| Option | Default | Meaning |
|---|---|---|
| `onClose` | — | Host close side effect, run after focus is restored. |
| `dialogSelector` | `'[role="dialog"]'` | The dialog element inside the host's `renderRoot`. |
| `initialFocus` | first focusable | Selector (within the dialog) to focus on open — set this to the primary button when Enter should confirm. |

## Separate-component modals

Some modals are their own element (`ed-confirm`, `ed-conflict`, `ed-roll-modal`),
shown by a parent from its state and closed by a dispatched `close` event. The
**parent owns the trigger**, so the parent restores focus — using the two helpers
the controller also uses, so behaviour is identical without a full controller:

```js
import { currentModality, deepActiveElement, returnFocusToTrigger } from './modal-controller.js';

// On open (the parent's `ed-roll` / show handler): capture the ACTUAL focused
// element. Do NOT use the event's target/composedPath — a roll button dispatches
// `ed-roll` from its component (`this.dispatchEvent`), so the path names the
// component, never the button. `deepActiveElement()` pierces Shadow DOM to the
// button that actually holds focus (and would keep the leftover ring).
this._rollTrigger = deepActiveElement();
this._rollOpenedByKeyboard = currentModality() === 'keyboard';

// On the modal's `@close`: clear state, then return focus (ring suppressed for
// pointer opens).
_closeRoll() {
  const trigger = this._rollTrigger;
  const openedByKeyboard = this._rollOpenedByKeyboard;
  this._rollTrigger = null;
  this._roll = null;
  returnFocusToTrigger(trigger, { openedByKeyboard });
}
```

This is exactly what `ed-app` does for `ed-roll-modal` — it fixes the focus ring
left on **every** roll button (the ⚄ on talents, skills, half-magic, combat) in
one place. `returnFocusToTrigger(el, { openedByKeyboard })` is safe to call even
when focus never left the trigger: it re-focuses with the ring suppressed.
Result-apply closes (an in-modal button click that removes the modal) need no
restore — focus falls away from the trigger on its own, with no ring.

## Checklist for a touched modal

- [ ] Escape closes (via the controller, not a hand-rolled listener).
- [ ] Focus moves into the dialog on open; Tab stays trapped inside.
- [ ] Every close path (Escape / ✕ / backdrop) goes through `close()` so focus
      returns to the trigger.
- [ ] Pointer-opened → no ring left on the trigger; keyboard-opened → ring kept.
- [ ] Enter confirms if there is a primary action (`initialFocus` on it).
- [ ] Works in light and dark mode.
