// ui/ed-edit-meta.js — the first edit form. A modal for the character's
// descriptive meta (description, age, weight, sex, height, skin tone,
// background; for Orks also the Gahad trigger summary/description, dispatched
// separately as `ed-edit-gahad-trigger`). These are pure *inputs* with no engine impact.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything itself. On save it dispatches `ed-edit-meta` up to ed-app, which
// applies the patch, persists the overlay, and re-derives the model. It closes
// via `close` (Escape / Cancel / backdrop). Enter saves from a single-line field,
// Ctrl/⌘+Enter from a textarea; a dirty Escape/✕/backdrop asks "Discard unsaved
// changes?" (stacked ed-confirm); theme-aware. Built on the UI kit (docs/MODALS.md).
import { LitElement, html, css } from 'lit';
import './ed-confirm.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { isDirty } from './kit/dirty.js';
import { gahadTriggerChanged } from '../store.js';

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
    gahadTrigger: { attribute: false },
    _discard: { state: true },
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
    form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem 0.8rem; }
    .field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input, textarea { font: inherit; font-size: var(--fs-body); color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 100%; box-sizing: border-box; }
    textarea { resize: vertical; line-height: 1.4; }
    input:focus, textarea:focus { outline: none; border-color: var(--accent); }
    .hint { grid-column: 1 / -1; font-size: var(--fs-fine); color: var(--muted); margin: -0.2rem 0 0; }
    @media (max-width: 480px) { form { grid-template-columns: 1fr; } }
  `];

  constructor() {
    super();
    this._discard = false;
    this._snap = {};
    this._ctl = new ModalController(this, {
      kind: 'input',
      isDirty: () => isDirty(this._snap, this._draft()),
      onDiscardPrompt: () => { this._discard = true; },
      onConfirm: () => this._save(),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    // Snapshot of every rendered field, taken when the modal opens.
    const meta = this.meta ?? {};
    this._snap = Object.fromEntries(FIELDS.map((f) => [f.key, meta[f.key] ?? '']));
    if (meta.race === 'Ork') {
      this._snap.gahadSummary = this.gahadTrigger?.summary ?? '';
      this._snap.gahadDescription = this.gahadTrigger?.description ?? '';
    }
    this._ctl.opened(deepActiveElement());
  }

  _form() {
    return this._ctl.dialogEl()?.querySelector('form') ?? null;
  }

  // Current field values (same keys as the snapshot); the snapshot itself when
  // the form is not rendered yet.
  _draft() {
    const form = this._form();
    if (!form) return this._snap;
    return Object.fromEntries(Object.keys(this._snap).map((k) => [k, form.elements[k]?.value ?? '']));
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _save() {
    const form = this._form();
    if (!form) return;
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
    if (form.elements.gahadSummary && gahadTriggerChanged(this.gahadTrigger, {
      summary: form.elements.gahadSummary.value,
      description: form.elements.gahadDescription.value,
    })) {
      this.dispatchEvent(new CustomEvent('ed-edit-gahad-trigger', {
        detail: { summary: form.elements.gahadSummary.value, description: form.elements.gahadDescription.value },
        bubbles: true, composed: true,
      }));
    }
    this._ctl.close({ reason: 'confirm' });
  }

  render() {
    const meta = this.meta ?? {};
    return html`
      ${modalFrame(this._ctl, {
        title: 'Edit character details',
        layer: 2100,
        width: '32rem',
        scroll: true,
        hasTextarea: true,
        primary: { label: 'Save' },
        body: html`
          <form @submit=${(e) => e.preventDefault()}>
            ${FIELDS.map((f, i) => {
              const val = meta[f.key] ?? '';
              const wide = f.type === 'area';
              return html`
                <div class="field ${wide ? 'wide' : ''}">
                  <label for=${f.key}>${f.label}</label>
                  ${f.type === 'area'
                    ? html`<textarea id=${f.key} name=${f.key} rows=${f.rows} ?autofocus=${i === 0} .value=${String(val)}></textarea>`
                    : html`<input id=${f.key} name=${f.key} type=${f.type === 'number' ? 'number' : 'text'} ?autofocus=${i === 0} .value=${String(val)} />`}
                </div>
              `;
            })}
            ${meta.race === 'Ork'
              ? html`
                <div class="field wide">
                  <label for="gahadSummary">Gahad trigger: Summary</label>
                  <input id="gahadSummary" name="gahadSummary" type="text" .value=${this.gahadTrigger?.summary ?? ''} />
                </div>
                <div class="field wide">
                  <label for="gahadDescription">Gahad trigger: Description</label>
                  <textarea id="gahadDescription" name="gahadDescription" rows="3" .value=${this.gahadTrigger?.description ?? ''}></textarea>
                </div>
                <p class="hint">Shown in the Gahad info on the Overview. Leave both blank to remove it.</p>`
              : ''}
            <p class="hint">Saved to this browser. These details don't affect any rules or rolls.</p>
        </form>`,
      })}
      ${this._discard
        ? html`<ed-confirm heading="Discard unsaved changes?" message="Your edits to the character details have not been saved."
            confirmLabel="Discard" cancelLabel="Keep editing" focusCancel
            @confirm=${() => { this._discard = false; this._ctl.close(); }}
            @close=${() => { this._discard = false; this._ctl.refocus(); }}></ed-confirm>`
        : ''}
    `;
  }
}

customElements.define('ed-edit-meta', EdEditMeta);
