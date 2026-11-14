// ui/ed-damage-modal.js — the shared "Take damage" modal, used by the Overview
// Health card and the Combat tab (one implementation, one behaviour).
//
// Data down / events up: it reads `model` and dispatches `ed-edit-health` (the
// new health inputs) and, for a hit five or more over the Wound Threshold,
// `ed-roll` (Knockdown test). Wound and Knockdown come from the engine
// (`resolveHit`) — this view computes no game values. Built on ModalController
// (docs/MODALS.md): Escape, focus in/trap/restore.
import { LitElement, html, css } from 'lit';
import { resolveHit } from '../engine/health.js';
import { ModalController } from './modal-controller.js';

export class EdDamageModal extends LitElement {
  static properties = {
    model: { type: Object },
    _open: { state: true },
    _take: { state: true },
  };

  static styles = css`
    :host { display: contents; }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--card, light-dark(#ffffff, #232833)); color: var(--fg, light-dark(#111418, #f0f3f7)); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    .mpara { font-size: var(--fs-small); line-height: 1.5; margin: 0; }
    .mpara b { font-weight: 500; }
    .mpara.hint { font-size: var(--fs-fine); color: var(--muted); }
    .hrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--fs-body); }
    .hrow input { font: inherit; font-size: var(--fs-body); color: var(--fg, light-dark(#111418, #f0f3f7)); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 6rem; text-align: right; }
    .hrow input:focus { outline: none; border-color: var(--accent); }
    .hfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .hint { font-size: var(--fs-fine); color: var(--muted); }
    .hbtn { font: inherit; font-size: var(--fs-body); font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); }
    .hbtn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pend { font-weight: 400; color: var(--muted); border: 1px dashed var(--muted); border-radius: 999px; padding: 0 6px; font-size: var(--fs-small); }
  `;

  constructor() {
    super();
    this.model = null;
    this._open = false;
    this._take = 0;
    this._ctl = new ModalController(this, {
      onClose: () => { this._open = false; },
      initialFocus: 'input',
    });
  }

  /** Open the modal; `trigger` is the control to return focus to on close. */
  show(trigger) {
    this._take = 0;
    this._open = true;
    this._ctl.opened(trigger);
  }

  _rating(n) { return n == null ? html`<span class="pend">—</span>` : html`${n}`; }

  _apply() {
    const take = Math.max(0, Number(this._take) || 0);
    if (take <= 0) return;
    const health = this.model?.resources?.health ?? {};
    const wt = this.model?.characteristics?.woundThreshold?.value;
    const { next, knockdown } = resolveHit(health, take, wt);
    this.dispatchEvent(new CustomEvent('ed-edit-health', { detail: next, bubbles: true, composed: true }));
    const kd = this.model?.characteristics?.knockdown;
    const roll = knockdown && kd?.value != null;
    this._ctl.close({ restoreFocus: !roll });
    if (roll) {
      this.dispatchEvent(new CustomEvent('ed-roll', {
        detail: {
          label: 'Knockdown test',
          step: kd.value,
          karma: null,
          kind: 'knockdown',
          difficulty: { value: knockdown.difficulty },
          apply: { action: 'knockdown-result' },
        },
        bubbles: true,
        composed: true,
      }));
    }
  }

  render() {
    if (!this._open) return html``;
    const h = this.model?.resources?.health ?? {};
    const st = this.model?.healthState;
    const stateWord =
      st?.state && st.state !== 'unhurt'
        ? html` · <b>${st.state === 'dead' ? 'Dead' : st.state === 'unconscious' ? 'Unconscious' : 'Conscious'}</b>`
        : '';
    const ch = this.model?.characteristics;
    const close = () => this._ctl.close();
    return html`
      <div class="overlay" @click=${close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Take damage" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>Take damage</span>
            <button class="mclose" type="button" aria-label="Close" @click=${close}>✕</button>
          </div>
          <p class="mpara">Current damage <b>${h.damage ?? 0}</b>${stateWord} — Unconscious ${this._rating(ch?.unconsciousness?.value)} · Death ${this._rating(ch?.death?.value)}</p>
          <form @submit=${(e) => { e.preventDefault(); this._apply(); }}>
            <div class="hrow"><span>Take damage</span><input type="number" min="0" step="1" .value=${String(this._take)} aria-label="Damage to take" @input=${(e) => { this._take = Math.max(0, Number(e.target.value) || 0); }} /></div>
            <p class="mpara hint">A hit at or above the Wound Threshold ${this._rating(ch?.woundThreshold?.value)} records one Wound; a hit five or more over it triggers a Knockdown test. Healing is done through a Recovery test.</p>
            <div class="hfoot">
              <span class="hint">Enter applies · Escape closes</span>
              <button type="submit" class="hbtn" ?disabled=${!(Number(this._take) > 0)}>Apply</button>
            </div>
          </form>
        </div>
      </div>`;
  }
}

customElements.define('ed-damage-modal', EdDamageModal);
