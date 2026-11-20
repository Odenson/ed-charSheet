// ui/kit/modal-controller.js — the one place the app implements the modal
// keyboard and focus contract, so every modal behaves the same and the "Escape
// leaves a focus ring stuck on the trigger" bug can't come back. See
// docs/MODALS.md for the contract and the adoption recipe.
//
// A Lit Reactive Controller (used as the shared "modal mixin"): a host that
// renders a modal from its own state creates one, tells it when the modal opens
// (passing the trigger element) and routes every close through it. The
// controller then owns:
//   - Escape closes and Enter = OK, both routed by ONE capture-phase document
//     keydown listener that acts on the top modal only (ordered rules in
//     ui/kit/modal-stack.js).
//   - Focus moves INTO the dialog on open.
//   - Tab is trapped within the dialog while it is open.
//   - On close, focus RETURNS to the trigger. If the modal was opened by pointer
//     (mouse/touch), the trigger's keyboard focus ring is suppressed for that
//     restore, so a click-then-Escape never leaves a "stuck highlight"; a
//     keyboard-opened modal keeps the ring.
//
// The controller is DOM-only plumbing — it never dispatches game events or
// mutates character state; the host still owns its `_modal` state and its close
// side effects (it passes them in as `onClose` / `onConfirm`). The module is
// lit-free and touches the DOM only inside methods and the guarded listener
// registration at the bottom of the helpers.
import { createModalStack, routeKey } from './modal-stack.js';

// The dialog's tabbable set. `:not([disabled])` and a non-negative tabindex keep
// hidden/inert controls out of the trap.
export const FOCUSABLE = [
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

// ---- shared stack + held-key latch -----------------------------------------

/** The one shared modal stack. Only its top entry is ever acted on. */
export const modalStack = createModalStack();

// Enter/Escape keys currently held down, and the subset latched by a kit close
// or confirm (their further repeats are swallowed until keyup).
const held = new Set();
const latchedKeys = new Set();
const latchHeldKeys = () => { for (const k of held) latchedKeys.add(k); };

/** Test-only: clear the stack and both key sets. */
export function __resetModalKit() {
  modalStack.clear();
  held.clear();
  latchedKeys.clear();
}

/** Forget every held/latched key (window blur). */
export function releaseAllKeys() {
  held.clear();
  latchedKeys.clear();
}

/** A key was released: it no longer counts as held or latched. */
export function handleKeyup(key) {
  held.delete(key);
  latchedKeys.delete(key);
}

/**
 * Route one keydown through the stack. `facts` carries the event/target facts
 * (see routeKey); this fills in the latch and the top entry's kind/canConfirm,
 * calls `onSwallow` for any non-pass result, then acts on the top entry.
 * @returns {'close'|'confirm'|'block'|'pass'}
 */
export function handleKeydown(facts, onSwallow) {
  const key = facts.key;
  if ((key === 'Enter' || key === 'Escape') && !facts.isComposing) held.add(key);
  const top = modalStack.top();
  const route = routeKey({
    ...facts,
    latched: !!facts.repeat && latchedKeys.has(key),
    stackEmpty: !top,
    kind: top ? top.kind : null,
    canConfirm: top ? top.canConfirm() : false,
  });
  if (route !== 'pass') {
    onSwallow?.();
    if (route === 'close') top?.requestClose();
    else if (route === 'confirm') top?.confirm();
  }
  return route;
}

const DIALOG_SEL = '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';

// The DOM wrapper: turns a real keydown into plain facts for handleKeydown.
function onDocKeydown(e) {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  const target = path[0] ?? e.target;
  const top = modalStack.top();
  const dialog = path.find((n) => n && typeof n.matches === 'function' && n.matches(DIALOG_SEL)) ?? null;
  const owner = dialog ? modalStack.entries().find((c) => c.dialogEl() === dialog) ?? null : null;
  const targetInTop = !!top && owner === top;
  const targetInForeignDialog = !!dialog && !owner;
  if (e.key === 'Tab') {
    if (top && !e.isComposing && !targetInForeignDialog) top.trapTab(e, target, targetInTop);
    return;
  }
  let enterLocal = false;
  for (const n of path) {
    if (n === dialog) break;
    if (n && typeof n.getAttribute === 'function' && n.getAttribute('data-enter') === 'local') { enterLocal = true; break; }
  }
  handleKeydown(
    {
      key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey,
      isComposing: e.isComposing, defaultPrevented: e.defaultPrevented, repeat: e.repeat,
      targetTag: String(target?.tagName ?? '').toLowerCase(),
      targetType: String(target?.type ?? '').toLowerCase(),
      targetRole: String(target?.getAttribute?.('role') ?? '').toLowerCase(),
      targetEnterLocal: enterLocal,
      targetIsPrimary: !!top && !!target && target === top.primaryEl(),
      targetInTop, targetInForeignDialog,
    },
    () => { e.preventDefault(); e.stopPropagation(); },
  );
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onDocKeydown, { capture: true });
  document.addEventListener('keyup', (e) => handleKeyup(e.key), { capture: true });
  if (typeof window !== 'undefined') window.addEventListener('blur', releaseAllKeys);
}

let nextId = 1;
const enabled = (el) => !!el && !el.disabled;
const read = (v) => (typeof v === 'function' ? v() : v);

export class ModalController {
  /**
   * @param {import('lit').ReactiveControllerHost & HTMLElement} host
   * @param {object} opts  See docs/MODALS.md "ModalController".
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.id = `kit-modal-${nextId++}`;
    this._opts = opts;
    this._open = false;
    this._trigger = null;
    this._openedByKeyboard = false;
    host.addController(this);
  }

  get open() { return this._open; }

  /** The current kind (`input|confirm|info|picker`), or null for a legacy controller. */
  get kind() { return read(this._opts.kind) ?? null; }

  _root() {
    return this._opts.light ? document : this.host.renderRoot;
  }

  dialogEl() {
    const root = this._root();
    if (!root) return null;
    const o = this._opts;
    if (o.dialogSelector) return root.querySelector(o.dialogSelector) ?? null;
    if (o.kind != null) return root.querySelector(`[data-modal="${this.id}"]`) ?? null;
    return root.querySelector('[role="dialog"]') ?? null;
  }

  primaryEl() {
    return this.dialogEl()?.querySelector(this._opts.primarySelector ?? '[data-primary]') ?? null;
  }

  canConfirm() {
    const k = this.kind;
    if (k !== 'input' && k !== 'confirm') return false;
    if (this._opts.canConfirm) return !!this._opts.canConfirm();
    const p = this.primaryEl();
    return !!p && !p.disabled;
  }

  hostConnected() {}

  hostDisconnected() {
    if (!this._open) return;
    modalStack.remove(this);
    latchHeldKeys();
    this._restoreFocus();
    this._open = false;
  }

  /** Announce the modal is open (call in the handler that sets host state). */
  opened(trigger) {
    if (!this._open) {
      this._open = true;
      this._trigger = trigger ?? null;
      this._openedByKeyboard = currentModality() === 'keyboard';
    } else if (trigger) {
      this._trigger = trigger;
    }
    modalStack.push(this);
    this.host.updateComplete.then(() => {
      if (this._open) this.focusInitial();
    });
  }

  /** Programmatic close (unguarded). `onClose` runs after the entry is removed and focus restored. */
  close({ restoreFocus = true, reason = 'cancel' } = {}) {
    if (!this._open) return;
    this._open = false;
    modalStack.remove(this);
    latchHeldKeys();
    // `restoreFocus: false` is for a hand-off: the next modal takes focus and
    // returns it itself.
    if (restoreFocus) this._restoreFocus();
    else this._trigger = null;
    this._opts.onClose?.(reason);
  }

  /** User-cancel path (Escape, ✕, backdrop, Cancel): honours the dirty guard. */
  requestClose() {
    if (this._opts.isDirty?.() && this._opts.onDiscardPrompt) {
      this._opts.onDiscardPrompt();
      return;
    }
    this.close({ reason: 'cancel' });
  }

  /** The OK path: info closes; input/confirm run the host's onConfirm. */
  confirm() {
    if (!this._open) return;
    latchHeldKeys();
    if (this.kind === 'info') { this.close({ reason: 'confirm' }); return; }
    if (this.canConfirm()) this._opts.onConfirm?.();
  }

  /** Re-run the initial-focus order while open (the view changed in place). */
  refocus() {
    if (!this._open) return;
    this.host.updateComplete.then(() => {
      if (this._open) this.focusInitial();
    });
  }

  focusInitial() {
    const dialog = this.dialogEl();
    if (!dialog) return;
    const focusDialog = () => {
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
      dialog.focus?.();
    };
    const o = this._opts;
    const kind = this.kind;
    const selectors = () => {
      const v = read(o.initialFocus);
      return v == null ? [] : Array.isArray(v) ? v : [v];
    };
    if (o.kind == null) {
      // Legacy order, exactly as before.
      const target =
        dialog.querySelector('[autofocus]') ||
        selectors().map((s) => dialog.querySelector(s)).find(Boolean) ||
        dialog.querySelector(FOCUSABLE) ||
        dialog;
      if (target === dialog) focusDialog();
      else target.focus?.();
      return;
    }
    const af = [...(dialog.querySelectorAll('[autofocus]') ?? [])].find(enabled);
    if (af) { af.focus?.(); return; }
    const primary = dialog.querySelector(o.primarySelector ?? '[data-primary]');
    if ((kind === 'input' || kind === 'confirm') && enabled(primary)) { primary.focus?.(); return; }
    for (const s of selectors()) {
      const el = dialog.querySelector(s);
      if (enabled(el)) { el.focus?.(); return; }
    }
    if (kind === 'info') {
      if (enabled(primary)) primary.focus?.();
      else focusDialog();
      return;
    }
    const body = dialog.querySelector('.mbody');
    const first = [...(body?.querySelectorAll(FOCUSABLE) ?? [])].find(enabled);
    if (first) { first.focus?.(); return; }
    focusDialog();
  }

  /** Tab trap. `target` is the deep event target; `inTop` whether it is in this dialog. */
  trapTab(e, target, inTop) {
    const dialog = this.dialogEl();
    if (!dialog) return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === dialog);
    if (!items.length) {
      e.preventDefault();
      dialog.focus?.();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (!inTop) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && target === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && target === last) {
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
