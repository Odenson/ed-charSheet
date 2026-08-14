// ui/ed-confirm.js — a small reusable confirmation modal for actions with a
// clear yes/no (first use: "Discard local changes"; also armour swaps and the
// recovery-test reset). Presentational only: it renders a message and two
// buttons, and dispatches `confirm` or `close` up — it never performs the
// action itself (Tier-1 golden rule: views dispatch, ed-app acts).
//
// The confirm button's `tone` is 'danger' by default (destructive actions) and
// 'accent' for non-destructive choices like the armour swap.
//
// Tier-1 modal rules: Escape / Cancel / backdrop close (= cancel); Enter confirms
// (the primary button is autofocused, so Enter triggers it); theme-aware.
import { LitElement, html, css } from 'lit';

export class EdConfirm extends LitElement {
  static properties = {
    heading: { type: String },
    message: { type: String },
    confirmLabel: { type: String },
    tone: { type: String }, // 'danger' (default) | 'accent'
    warn: { type: String }, // optional highlighted caution line above the buttons
    disabled: { type: Boolean }, // when true the primary action is blocked (Cancel-only)
  };

  static styles = css`
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
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.5rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
    .msg { font-size: 0.85rem; line-height: 1.5; color: var(--text); margin: 0 0 1rem; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button.btn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    button.btn.danger { border-color: var(--danger); background: var(--danger-bg); color: var(--danger); font-weight: 500; }
    button.btn.accent { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    button.btn[disabled] { opacity: 0.4; cursor: not-allowed; }
    .warn { display: flex; gap: 8px; align-items: flex-start; font-size: 0.8rem; line-height: 1.4; color: var(--accent); background: var(--accent-bg); border: 1px solid var(--accent); border-radius: 8px; padding: 8px 10px; margin: 0 0 1rem; }
    .warn.block { color: var(--danger); background: var(--danger-bg); border-color: var(--danger); }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._onKeydown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this._close(); }
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  // Focus the primary (confirm) button so Enter confirms. The button carries a
  // tone class (`danger` by default, `accent` for non-destructive choices). When
  // the action is blocked (`disabled`), focus Cancel instead so Enter can't fire.
  firstUpdated() {
    const primary = this.disabled ? null : this.renderRoot.querySelector('.btn.danger, .btn.accent');
    (primary ?? this.renderRoot.querySelector('.btn')).focus();
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _confirm() {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${this.heading || 'Confirm'} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>${this.heading || 'Are you sure?'}</span>
            <button class="mclose" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <p class="msg">${this.message}</p>
          ${this.warn
            ? html`<div class="warn ${this.disabled ? 'block' : ''}"><span aria-hidden="true">${this.disabled ? '⛔' : '⚠'}</span><span>${this.warn}</span></div>`
            : ''}
          <div class="actions">
            <button type="button" class="btn" @click=${this._close}>Cancel</button>
            <button type="button" class="btn ${this.tone === 'accent' ? 'accent' : 'danger'}" ?disabled=${this.disabled} @click=${this._confirm}>${this.confirmLabel || 'Confirm'}</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-confirm', EdConfirm);
