// ui/ed-edit-meta.js — the first edit form. A modal for the character's
// descriptive meta (description, age, weight, sex, height, skin tone,
// background). These are pure *inputs* with no engine impact.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything itself. On save it dispatches `ed-edit-meta` up to ed-app, which
// applies the patch, persists the overlay, and re-derives the model. It closes
// via `close` (Escape / Cancel / backdrop). Enter confirms; theme-aware.
import { LitElement, html, css } from 'lit';

// The editable fields, in display order. `area` → multi-line textarea.
// Add a field here (plus the matching meta key) to extend the form.
const FIELDS = [
  { key: 'description', label: 'Description', type: 'area', rows: 2 },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'sex', label: 'Sex', type: 'text' },
  { key: 'height', label: 'Height', type: 'text' },
  { key: 'weight', label: 'Weight', type: 'text' },
  { key: 'skinTone', label: 'Skin Tone', type: 'text' },
  { key: 'background', label: 'Background', type: 'area', rows: 6 },
];

export class EdEditMeta extends LitElement {
  static properties = {
    meta: { attribute: false },
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
    .modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 32rem; max-width: 100%; max-height: 88vh; overflow: auto; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem 0.8rem; }
    .field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input, textarea { font: inherit; font-size: var(--fs-body); color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
    textarea { resize: vertical; line-height: 1.4; }
    input:focus, textarea:focus { outline: none; border-color: var(--accent); }
    .actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; margin-top: 0.25rem; }
    button.btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    button.btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .hint { grid-column: 1 / -1; font-size: var(--fs-fine); color: var(--muted); margin: -0.2rem 0 0; }
    @media (max-width: 480px) { form { grid-template-columns: 1fr; } }
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

  // Focus the first field once the form is in the DOM.
  firstUpdated() {
    const first = this.renderRoot.querySelector('input, textarea');
    if (first) first.focus();
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const patch = {};
    for (const f of FIELDS) {
      const raw = (form.elements[f.key]?.value ?? '').trim();
      if (f.type === 'number') {
        patch[f.key] = raw === '' ? null : Number(raw);
      } else {
        patch[f.key] = raw;
      }
    }
    // Dispatch up — ed-app applies, persists, and re-derives. Then close.
    this.dispatchEvent(new CustomEvent('ed-edit-meta', { detail: patch, bubbles: true, composed: true }));
    this._close();
  }

  render() {
    const meta = this.meta ?? {};
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Edit character details" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>Edit character details</span>
            <button class="mclose" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <form @submit=${this._save}>
            ${FIELDS.map((f) => {
              const val = meta[f.key] ?? '';
              const wide = f.type === 'area';
              return html`
                <div class="field ${wide ? 'wide' : ''}">
                  <label for=${f.key}>${f.label}</label>
                  ${f.type === 'area'
                    ? html`<textarea id=${f.key} name=${f.key} rows=${f.rows} .value=${String(val)}></textarea>`
                    : html`<input id=${f.key} name=${f.key} type=${f.type === 'number' ? 'number' : 'text'} .value=${String(val)} />`}
                </div>
              `;
            })}
            <p class="hint">Saved to this browser. These details don't affect any rules or rolls.</p>
            <div class="actions">
              <button type="button" class="btn" @click=${this._close}>Cancel</button>
              <button type="submit" class="btn primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-edit-meta', EdEditMeta);
