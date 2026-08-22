// ui/modal-controller.js — the one place the app implements the modal focus
// contract, so every modal behaves the same and the "Escape leaves a focus ring
// stuck on the trigger" bug can't come back. See docs/MODALS.md for the contract
// and the adoption recipe.
//
// A Lit Reactive Controller (used as the shared "modal mixin"): a host that
// renders a modal from its own state creates one, tells it when the modal opens
// (passing the trigger element) and routes every close through it. The
// controller then owns:
//   - Escape closes (Tier-1 modal rule) via a document-level keydown listener.
//   - Focus moves INTO the dialog on open (keyboard users land in the modal, not
//     stranded on the trigger behind the backdrop).
//   - Tab is trapped within the dialog while it is open.
//   - On close, focus RETURNS to the trigger. If the modal was opened by pointer
//     (mouse/touch), the trigger's keyboard focus ring is suppressed for that
//     restore, so a click-then-Escape never leaves a "stuck highlight"; a
//     keyboard-opened modal keeps the ring (the keyboard user needs to see where
//     focus went). This is the owner-chosen behaviour (return-to-trigger, no ring
//     on pointer opens).
//
// The controller is DOM-only focus plumbing — it never dispatches game events or
// mutates character state; the host still owns its `_modal` state and its close
// side effects (it passes them in as `onClose`).

// The dialog's tabbable set. `:not([disabled])` and a non-negative tabindex keep
// hidden/inert controls out of the trap.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Track the input modality of the LAST interaction before a modal opens, so the
// controller can tell a pointer-opened modal (suppress the restore ring) from a
// keyboard-opened one (keep it). Capture-phase, passive, once per module.
let lastModality = 'pointer';
if (typeof window !== 'undefined') {
  const mark = (m) => () => { lastModality = m; };
  window.addEventListener('keydown', mark('keyboard'), { capture: true, passive: true });
  window.addEventListener('pointerdown', mark('pointer'), { capture: true, passive: true });
}

/** The input modality of the last interaction — `'keyboard'` or `'pointer'`. Read
 * this at open time to record how a modal was opened (see `returnFocusToTrigger`). */
export function currentModality() {
  return lastModality;
}

/**
 * The truly focused element, piercing Shadow DOM. `document.activeElement` stops
 * at a shadow host; this descends into the active element of each nested shadow
 * root. Use it to capture a modal's real trigger at open time — e.g. a roll
 * button whose `ed-roll` event is dispatched from its component (so the event's
 * `composedPath` names the component, not the button, but the button is what
 * actually holds focus and would wear the leftover ring).
 * @returns {HTMLElement|null}
 */
export function deepActiveElement(root = document) {
  let el = root.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/**
 * Return focus to a modal's trigger on close, honouring the house rule: a
 * pointer-opened modal restores focus WITHOUT the keyboard focus ring the closing
 * Escape keydown would paint on it; a keyboard-opened one keeps the ring (the
 * keyboard user needs to see where focus went). Shared by `ModalController` and by
 * `ed-app` for the separate-component roll modal, so both behave identically.
 *
 * Inline styles sit on the element itself, so they override the component's
 * `:focus-visible` rule (no `!important`) even across the shadow boundary; the
 * override is torn down on the trigger's next real interaction.
 * @param {HTMLElement} el  The trigger to refocus.
 * @param {{ openedByKeyboard?: boolean }} [opts]
 */
export function returnFocusToTrigger(el, { openedByKeyboard = false } = {}) {
  if (!el || !el.isConnected) return;
  if (openedByKeyboard) {
    el.focus();
    return;
  }
  const prev = { outline: el.style.outline, boxShadow: el.style.boxShadow };
  el.style.outline = 'none';
  el.style.boxShadow = 'none';
  el.focus();
  const clear = () => {
    el.style.outline = prev.outline;
    el.style.boxShadow = prev.boxShadow;
    el.removeEventListener('blur', clear);
    el.removeEventListener('keydown', clear);
    el.removeEventListener('pointerdown', clear);
  };
  el.addEventListener('blur', clear);
  el.addEventListener('keydown', clear);
  el.addEventListener('pointerdown', clear);
}

export class ModalController {
  /**
   * @param {import('lit').ReactiveControllerHost & HTMLElement} host
   * @param {object} opts
   * @param {() => void} opts.onClose  Host close side effect (usually `() => { this._modal = null; }`).
   *   Called by the controller for Escape / any routed close, AFTER focus is restored.
   * @param {string} [opts.dialogSelector]  Selector for the dialog element inside the host's
   *   renderRoot. Defaults to `[role="dialog"]`.
   * @param {string} [opts.initialFocus]  Selector (within the dialog) for the element to focus on
   *   open. Defaults to the first focusable; falls back to the dialog itself.
   */
  constructor(host, { onClose, dialogSelector = '[role="dialog"]', initialFocus = null } = {}) {
    this.host = host;
    this._onClose = onClose;
    this._dialogSelector = dialogSelector;
    this._initialFocus = initialFocus;
    this._open = false;
    this._trigger = null;
    this._openedByKeyboard = false;
    host.addController(this);
  }

  hostConnected() {
    this._onKeydown = (e) => {
      if (!this._open) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      } else if (e.key === 'Tab') {
        this._trapTab(e);
      }
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  hostDisconnected() {
    document.removeEventListener('keydown', this._onKeydown);
    // If the host is torn down with the modal still open, put focus back so it is
    // never lost to <body>. No host close side effect here — the host is going away.
    if (this._open) this._restoreFocus();
    this._open = false;
    this._trigger = null;
  }

  /**
   * Announce that the modal is now open. Call this in the SAME handler that sets
   * the host's modal state, passing the trigger element (`event.currentTarget`)
   * so focus can return to it on close.
   * @param {HTMLElement} [trigger]  The control that opened the modal.
   */
  opened(trigger) {
    this._open = true;
    this._trigger = trigger ?? null;
    this._openedByKeyboard = currentModality() === 'keyboard';
    // The dialog does not exist until the host re-renders; focus it after that.
    this.host.updateComplete.then(() => {
      if (this._open) this._focusDialog();
    });
  }

  /**
   * Close the modal through the controller: restore focus to the trigger (ring
   * suppressed for pointer opens), then run the host's close side effect. Route
   * EVERY close here — Escape (automatic), the ✕ button, and the backdrop click —
   * so focus is always restored.
   */
  close() {
    if (!this._open) return;
    this._open = false;
    this._restoreFocus();
    this._onClose?.();
  }

  _dialog() {
    return this.host.renderRoot?.querySelector(this._dialogSelector) ?? null;
  }

  _focusDialog() {
    const dialog = this._dialog();
    if (!dialog) return;
    const target =
      (this._initialFocus && dialog.querySelector(this._initialFocus)) ||
      dialog.querySelector(FOCUSABLE) ||
      dialog;
    if (target === dialog && !dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    target.focus?.();
  }

  _trapTab(e) {
    const dialog = this._dialog();
    if (!dialog) return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === dialog);
    if (!items.length) {
      e.preventDefault();
      dialog.focus?.();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.host.renderRoot.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  _restoreFocus() {
    const el = this._trigger;
    this._trigger = null;
    returnFocusToTrigger(el, { openedByKeyboard: this._openedByKeyboard });
  }
}
