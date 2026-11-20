// ui/ed-confirm.js — a small reusable confirmation modal for actions with a
// clear yes/no (first use: "Discard local changes"; also armour swaps and the
// recovery-test reset). Presentational only: it renders a message and two
// buttons, and dispatches `confirm` or `close` up — it never performs the
// action itself (Tier-1 golden rule: views dispatch, ed-app acts).
//
// The confirm button's `tone` is 'danger' by default (destructive actions) and
// 'accent' for non-destructive choices like the armour swap.
//
// Built on the UI kit (ui/kit/, docs/MODALS.md): Escape / ✕ / Cancel / backdrop
// close (= cancel); Enter confirms (the kit routes it); theme-aware.
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

export class EdConfirm extends LitElement {
  static properties = {
    heading: { type: String },
    message: { type: String },
    confirmLabel: { type: String },
    tone: { type: String }, // 'danger' (default) | 'accent'
    warn: { type: String }, // optional highlighted caution line above the buttons
    cancelLabel: { type: String }, // default 'Cancel'
    focusCancel: { type: Boolean }, // Enter lands on Cancel (discard prompts)
    disabled: { type: Boolean }, // when true the primary action is blocked (Cancel-only)
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --danger: light-dark(#c0392b, #e06557);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --text: light-dark(#111418, #f0f3f7);
    }
    .msg { font-size: var(--fs-body); line-height: 1.5; color: var(--text); margin: 0; }
    .warn { display: flex; gap: 8px; align-items: flex-start; font-size: var(--fs-body); line-height: 1.4; color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); border-radius: 8px; padding: 8px 10px; margin: 1rem 0 0; }
    .warn.block { color: var(--danger); background: var(--danger-bg); border-color: var(--danger); }
  `];

  constructor() {
    super();
    // Escape / ✕ / backdrop / Cancel end in onClose('cancel'); Confirm goes
    // through _confirm, which closes first (restoring focus) and then dispatches
    // ONLY `confirm` — hosts read their prompt state in @confirm and clear it in
    // @close, so a `close` before `confirm` would silently cancel the action.
    this._ctl = new ModalController(this, {
      kind: 'confirm',
      onConfirm: () => this._confirm(),
      canConfirm: () => !this.disabled,
      initialFocus: '[data-cancel]',
      onClose: (r) => { if (r === 'cancel') this._close(); },
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _confirm() {
    if (this.disabled) return;
    this._ctl.close({ reason: 'confirm' });
    this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
  }

  render() {
    return modalFrame(this._ctl, {
      title: this.heading || 'Are you sure?',
      label: this.heading || 'Confirm',
      layer: 2100,
      width: '26rem',
      cancelLabel: this.cancelLabel || 'Cancel',
      focusCancel: !!this.focusCancel,
      body: html`
        <p class="msg">${this.message}</p>
        ${this.warn
          ? html`<div class="warn ${this.disabled ? 'block' : ''}"><span aria-hidden="true">${this.disabled ? '⛔' : '⚠'}</span><span>${this.warn}</span></div>`
          : ''}`,
      primary: {
        label: this.confirmLabel || 'Confirm',
        tone: this.tone === 'accent' ? 'accent' : 'danger',
        disabled: !!this.disabled,
      },
    });
  }
}

customElements.define('ed-confirm', EdConfirm);
