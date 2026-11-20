// ui/ed-conflict.js — the keep-mine / take-theirs modal for a `stale_base`
// conflict (plans/PLAN-SAVE-CONCURRENCY Phase C1).
//
// The worker rejected a save because the character changed on the branch since
// this client last read or saved it. The overlay still holds the local draft;
// nothing was lost. The player picks how to resolve the divergence:
//   Keep mine   (primary, Enter) — overwrite the branch with the local version.
//   Take theirs — discard the local draft and reload the branch version.
//   Cancel      — close; the local draft stays in this browser, nothing written.
//
// Built on the UI kit (ui/kit/, docs/MODALS.md) in its own shadow root, layer 2200
// so it renders over any open modal. Architecture (Tier-1 golden rule): this view
// NEVER mutates state or persists anything. On a choice it dispatches
// `ed-conflict` up with `{ choice }`; Escape / Cancel / ✕ / backdrop dispatch
// `close` (ed-app clears the conflict; the local draft stays). Enter = Keep mine.
// Theme-aware via the kit's light-dark(); two font weights only (400/500).
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

export class EdConflict extends LitElement {
  static styles = [modalCss, css`
    .body { font-size: var(--fs-body); color: var(--muted, light-dark(#5a6472, #93a0b3)); margin: 0; line-height: 1.5; }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'confirm',
      onConfirm: () => this._choose('keep-mine'),
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  _choose = (choice) => {
    // Dispatch up — ed-app routes the choice (keep-mine / take-theirs). Then close.
    this.dispatchEvent(new CustomEvent('ed-conflict', { detail: { choice }, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  };

  render() {
    return modalFrame(this._ctl, {
      title: 'This character changed elsewhere',
      layer: 2200,
      width: '26rem',
      primary: { label: 'Keep mine' },
      extra: html`<button type="button" class="btn" @click=${() => this._choose('take-theirs')}>Take theirs</button>`,
      body: html`<p class="body">This character changed on another device or player since you last loaded it. Your unsaved edits are safe here — how do you want to resolve the difference?</p>`,
    });
  }
}

customElements.define('ed-conflict', EdConflict);
