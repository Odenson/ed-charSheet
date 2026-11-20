// ui/ed-add-legend.js — the shared "Add Legend earned" modal (PLAN-NOTES-TAB,
// Phase F): opened from both the Notes tab's Legend view and the Overview
// Legend panel's ✚, so the two surfaces add through one identical form.
//
// Architecture (Tier-1 golden rule): presentational only — it never mutates
// state or persists. On save it appends one real `{ id, amount, description,
// date }` entry to the `earned` list it was given (the real entries only —
// the virtual "Starting total" row is never in the payload, decision #6) and
// dispatches `ed-edit-legend-earned` up to ed-app, which persists the overlay
// (saveLegendEdits writes `earned` only — `totalEarnt` is never written,
// decision #1) and re-derives the running total.
//
// Tier-1 modal rules: Escape / Cancel / backdrop / ✕ close; Enter confirms
// (the kit routes it; the amount field is autofocused); theme-aware. Built on
// the UI kit (ui/kit/, docs/MODALS.md); no discard prompt (short numeric form).
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export class EdAddLegend extends LitElement {
  static properties = {
    earned: { attribute: false }, // the real earned entries (no virtual row)
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --text: light-dark(#111418, #f0f3f7);
    }
    form { display: flex; flex-direction: column; gap: 0.7rem; }
    .fld { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input { font: inherit; font-size: var(--fs-body); color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
    input:focus { outline: none; border-color: var(--accent); }
    .hint { font-size: var(--fs-fine); color: var(--muted); }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'input',
      onConfirm: () => this._save(),
      canConfirm: () => !!this._valid(),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  // The validated form values, or null (matches the old `required` guard).
  _valid() {
    const f = this._ctl.dialogEl()?.querySelector('form');
    if (!f) return null;
    const amount = Number(f.elements.amount?.value);
    const description = (f.elements.description?.value ?? '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !description) return null;
    return { amount, description, date: f.elements.date?.value || null };
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _save() {
    const v = this._valid();
    if (!v) return;
    const earned = [...(this.earned ?? []), { id: uid(), ...v }];
    this.dispatchEvent(new CustomEvent('ed-edit-legend-earned', { detail: earned, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  }

  render() {
    return modalFrame(this._ctl, {
      title: 'Add Legend earned',
      layer: 2100,
      width: '26rem',
      primary: { label: 'Add', disabled: !this._valid() },
      body: html`
        <form @submit=${(e) => e.preventDefault()} @input=${() => this.requestUpdate()}>
          <div class="fld">
            <label for="al-amount">Amount</label>
            <input id="al-amount" name="amount" type="number" min="1" step="1" required autofocus />
          </div>
          <div class="fld">
            <label for="al-description">Description</label>
            <input id="al-description" name="description" type="text" placeholder="e.g. Recovered the Crown of Tears" required />
          </div>
          <div class="fld">
            <label for="al-date">Date (optional)</label>
            <input id="al-date" name="date" type="date" />
          </div>
          <p class="hint">Adds to the running Total Legend Earned.</p>
        </form>`,
    });
  }
}

customElements.define('ed-add-legend', EdAddLegend);
