// ui/ed-saving.js — small "Saving to GitHub…" spinner shown while a manual save is in flight.
// Presentational only: dispatches `close` when dismissed (the save carries on); stores nothing.
//
// Built on the UI kit (ui/kit/, docs/MODALS.md), kind `info`: Escape / ✕ / backdrop / OK / Enter
// all close it. Layer 2150. Opened without a trigger, so unmounting never moves focus.
import { LitElement, html, css } from 'lit';
import { ModalController } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

export class EdSaving extends LitElement {
  static styles = [modalCss, css`
    .row { display: flex; align-items: center; gap: 0.7rem; font-size: var(--fs-body); font-weight: 500; }
    .spinner {
      flex: none; width: 1.2rem; height: 1.2rem; box-sizing: border-box; border-radius: 50%;
      border: 3px solid var(--muted, light-dark(#c9ced6, #3a4452));
      border-top-color: var(--accent, light-dark(#7a3e12, #d9944e));
      animation: ed-saving-spin 0.8s linear infinite;
    }
    @keyframes ed-saving-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; }
    }
    .note { margin: 0.5rem 0 0; font-size: var(--fs-small); font-weight: 400; color: var(--muted, light-dark(#5a6472, #93a0b3)); }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'info',
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(null);
  }

  render() {
    return modalFrame(this._ctl, {
      title: 'Saving to GitHub…',
      layer: 2150,
      width: '20rem',
      ack: { label: 'OK' },
      body: html`
        <div role="status" aria-live="polite">
          <div class="row"><span class="spinner" aria-hidden="true"></span><span>Saving to GitHub…</span></div>
        </div>
        <p class="note">You can close this; the save continues.</p>`,
    });
  }
}

customElements.define('ed-saving', EdSaving);
