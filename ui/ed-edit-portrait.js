// ui/ed-edit-portrait.js — the edit-mode portrait picker (plans/add-char-portrait).
// A modal to upload a new image, pick one already on the data branch, or remove
// the portrait. Opened from the Overview portrait / mobile avatar in edit mode.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything itself. Properties come down (`current`, `currentUrl`, `images`,
// `staged`, `loadingImages`, `characterId`); on OK it dispatches `ed-edit-portrait`
// `{ portrait, staged? }` up to ed-app, which stages the bytes, writes
// `meta.portrait` through the edits overlay and re-derives the model. An upload is
// downscaled client-side (ui/portrait-image.js) before it is even previewed.
// Escape / Cancel / backdrop close; a dirty cancel asks via a stacked ed-confirm;
// Enter confirms (Enter on a focused thumbnail selects it). Built on the UI kit
// (docs/MODALS.md); theme tokens only.
import { LitElement, html, css } from 'lit';
import './ed-confirm.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { processImage } from './portrait-image.js';
import { selectExisting, selectNew, selectRemove, isDirty, toDetail } from './portrait-modal-state.js';

export class EdEditPortrait extends LitElement {
  static properties = {
    current: { attribute: false },       // the character's current meta.portrait path | null
    currentUrl: { attribute: false },    // its loadable URL (data URL when staged)
    images: { attribute: false },        // [{ path, name, url }] on the branch
    staged: { attribute: false },        // { path, mime, dataUrl } | null: an unsaved upload
    loadingImages: { attribute: false },
    characterId: { attribute: false },
    _selection: { state: true },
    _error: { state: true },
    _busy: { state: true },
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
    .pick { display: flex; flex-direction: column; gap: 0.8rem; }
    .row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
    .preview { width: 96px; height: 96px; flex: none; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: var(--fs-hero); }
    .preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lbl { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); display: block; margin-bottom: 3px; }
    input[type='file'] { font: inherit; font-size: var(--fs-body); color: var(--text); max-width: 100%; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; max-height: 14rem; overflow-y: auto; padding: 3px; }
    .thumb { position: relative; padding: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: light-dark(#f7f8fa, #1b1f27); cursor: pointer; aspect-ratio: 1; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb:hover, .thumb:focus-visible { border-color: var(--accent); outline: none; }
    .thumb[aria-pressed='true'] { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
    .thumb .tag { position: absolute; left: 0; right: 0; bottom: 0; font-size: var(--fs-fine); background: var(--accent-bg); color: var(--accent); text-align: center; padding: 1px 0; }
    .err { color: light-dark(#a02020, #ff8a8a); font-size: var(--fs-body); margin: 0; }
    .note { color: var(--muted); font-size: var(--fs-fine); margin: 0; }
    .linkbtn { background: none; border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 4px 10px; font: inherit; font-size: var(--fs-body); cursor: pointer; }
    .linkbtn:hover, .linkbtn:focus-visible { border-color: var(--accent); outline: none; }
    .linkbtn[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
  `];

  constructor() {
    super();
    this._selection = null;
    this._error = '';
    this._busy = false;
    this._discard = false;
    this.images = [];
    this.loadingImages = false;
    this._ctl = new ModalController(this, {
      kind: 'input',
      isDirty: () => isDirty(this.current ?? null, this._selection),
      onDiscardPrompt: () => { this._discard = true; },
      onConfirm: () => this._save(),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _save() {
    if (this._busy) return;
    if (this._selection && isDirty(this.current ?? null, this._selection)) {
      // Dispatch up: ed-app stages the bytes, applies meta.portrait and re-derives.
      this.dispatchEvent(new CustomEvent('ed-edit-portrait', { detail: toDetail(this._selection), bubbles: true, composed: true }));
    }
    this._ctl.close({ reason: 'confirm' });
  }

  async _onFile(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    this._error = '';
    this._busy = true;
    try {
      const processed = await processImage(file, { charId: this.characterId });
      this._selection = selectNew(processed);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Could not process that image.';
    } finally {
      this._busy = false;
      input.value = ''; // allow re-picking the same file
    }
  }

  // The thumbnails: the unsaved staged upload first (labelled), then the branch
  // images; the current portrait is included even if the listing missed it.
  _rows() {
    const rows = [];
    const seen = new Set();
    if (this.staged) {
      rows.push({ path: this.staged.path, url: this.staged.dataUrl, unsaved: true, staged: this.staged });
      seen.add(this.staged.path);
    }
    for (const r of this.images ?? []) {
      if (seen.has(r.path)) continue;
      seen.add(r.path);
      rows.push({ path: r.path, url: r.url });
    }
    if (this.current && !seen.has(this.current)) rows.push({ path: this.current, url: this.currentUrl });
    return rows;
  }

  _selectedPath() {
    const s = this._selection;
    if (!s) return this.current ?? null;
    if (s.kind === 'remove') return null;
    return s.kind === 'new' ? s.processed.path : s.path;
  }

  _pickRow(row) {
    this._error = '';
    this._selection = row.staged ? selectNew(row.staged) : selectExisting(row.path);
  }

  _previewUrl(rows) {
    const s = this._selection;
    if (s?.kind === 'remove') return null;
    if (s?.kind === 'new') return s.processed.dataUrl;
    const path = this._selectedPath();
    return rows.find((r) => r.path === path)?.url || null;
  }

  render() {
    const rows = this._rows();
    const selected = this._selectedPath();
    const preview = this._previewUrl(rows);
    const removed = this._selection?.kind === 'remove';
    const noList = !this.loadingImages && !(this.images ?? []).length;
    return html`
      ${modalFrame(this._ctl, {
        title: 'Change portrait',
        layer: 2100,
        width: '34rem',
        scroll: true,
        primary: { label: 'OK' },
        body: html`
          <div class="pick">
            <div class="row">
              <div class="preview">${preview ? html`<img src=${preview} alt="Portrait preview" />` : html`<span aria-hidden="true">▢</span>`}</div>
              <div>
                <label class="lbl" for="portrait-file">Upload an image</label>
                <input id="portrait-file" type="file" accept="image/jpeg,image/png,image/webp" ?disabled=${this._busy} @change=${(e) => this._onFile(e)} />
                <p class="note">${this._busy ? 'Processing…' : 'JPEG, PNG or WebP, up to 10 MB. It is resized before saving.'}</p>
              </div>
            </div>
            ${this._error ? html`<p class="err" role="alert">${this._error}</p>` : ''}
            <div>
              <span class="lbl">Or choose one already saved</span>
              ${rows.length
                ? html`<div class="grid" role="group" aria-label="Saved images">
                    ${rows.map((r) => html`
                      <button type="button" class="thumb" aria-pressed=${String(!removed && r.path === selected)} title=${r.path}
                        @click=${() => this._pickRow(r)}>
                        <img src=${r.url} alt=${r.path.split('/').pop()} loading="lazy" />
                        ${r.unsaved ? html`<span class="tag">unsaved</span>` : ''}
                      </button>`)}
                  </div>`
                : ''}
              ${this.loadingImages ? html`<p class="note">Loading saved images…</p>` : ''}
              ${noList ? html`<p class="note">The saved-image list could not be loaded or is empty. Uploading and removing still work.</p>` : ''}
            </div>
            <div class="row">
              <button type="button" class="linkbtn" aria-pressed=${String(removed)} @click=${() => { this._error = ''; this._selection = selectRemove(); }}>Remove portrait</button>
            </div>
          </div>`,
      })}
      ${this._discard
        ? html`<ed-confirm heading="Discard unsaved changes?" message="Your portrait choice has not been applied."
            confirmLabel="Discard" cancelLabel="Keep editing" focusCancel
            @confirm=${() => { this._discard = false; this._ctl.close(); }}
            @close=${() => { this._discard = false; this._ctl.refocus(); }}></ed-confirm>`
        : ''}
    `;
  }
}

customElements.define('ed-edit-portrait', EdEditPortrait);
