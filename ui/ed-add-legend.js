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
// (single-line inputs submit the form; the amount field is autofocused);
// theme-aware.
import { LitElement, html, css } from 'lit';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export class EdAddLegend extends LitElement {
  static properties = {
    earned: { attribute: false }, // the real earned entries (no virtual row)
  };

  static styles = css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --text: light-dark(#111418, #f0f3f7);
    }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
    form { display: flex; flex-direction: column; gap: 0.7rem; }
    .fld { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input { font: inherit; font-size: 0.85rem; color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
    input:focus { outline: none; border-color: var(--accent); }
    .hint { font-size: 0.68rem; color: var(--muted); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button.btn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    button.btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
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

  firstUpdated() {
    this.renderRoot.querySelector('input[name="amount"]')?.focus();
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _save(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const amount = Number(f.elements.amount?.value);
    const description = (f.elements.description?.value ?? '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !description) return;
    const date = f.elements.date?.value || null;
    const earned = [...(this.earned ?? []), { id: uid(), amount, description, date }];
    this.dispatchEvent(new CustomEvent('ed-edit-legend-earned', { detail: earned, bubbles: true, composed: true }));
    this._close();
  }

  render() {
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Add Legend earned" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>Add Legend earned</span>
            <button class="mclose" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <form @submit=${this._save}>
            <div class="fld">
              <label for="al-amount">Amount</label>
              <input id="al-amount" name="amount" type="number" min="1" step="1" required />
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
            <div class="actions">
              <button type="button" class="btn" @click=${this._close}>Cancel</button>
              <button type="submit" class="btn primary">Add</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-add-legend', EdAddLegend);
