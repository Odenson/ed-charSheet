// ui/ed-character-picker.js — modal listing every character in the per-character
// store so the player can choose one to load.
//
// Presentational only (Tier-1 golden rule): it lists `characters` (the index
// rows [{ id, name, portrait }] from store.js `listCharacters`) and dispatches
// `load-character` up with the chosen id; ed-app does the loading. It opens both
// on first-run startup (no saved selection) and from the header icon, and it
// closes via `close` (Escape / backdrop / ✕). Built on the UI kit (docs/MODALS.md),
// kind `picker`.
//
// Tier-1 modal rules: Escape / backdrop close; Enter confirms (the list rows are
// native <button>s, the kit focuses the first, so Enter activates it); theme-aware
// via light-dark(); two font weights only (400/500). Portrait thumbnails resolve
// through store.js `portraitUrlFor` (raw CDN on Pages, bundle-relative locally)
// and degrade to a name-initial placeholder on a missing/broken image.
import { LitElement, html, css } from 'lit';
import { portraitUrlFor } from '../store.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

export class EdCharacterPicker extends LitElement {
  static properties = {
    characters: { type: Array },
    current: { type: String },
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
    .hint { font-size: var(--fs-fine); color: var(--muted); margin: 0 0 0.6rem; line-height: 1.4; }
    .list { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow-y: auto; }
    .row {
      display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      padding: 8px 10px; border-radius: 8px; cursor: pointer; box-sizing: border-box;
      border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); color: var(--text);
      font: inherit; font-size: var(--fs-body);
    }
    .row:hover { border-color: var(--accent); }
    .row.current { border-color: var(--accent); background: var(--accent-bg); }
    .thumb { width: 38px; height: 38px; border-radius: 6px; flex: 0 0 auto; object-fit: cover; background: var(--accent-bg); }
    .thumb.fallback {
      display: flex; align-items: center; justify-content: center;
      font-weight: 500; color: var(--accent); font-size: var(--fs-value); text-transform: uppercase;
    }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .nm { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .id { font-size: var(--fs-fine); color: var(--muted); }
  `];

  constructor() {
    super();
    this.characters = [];
    this.current = null;
    this._broken = new Set(); // ids whose portrait failed to load
    this._ctl = new ModalController(this, { kind: 'picker', onClose: () => this._close() });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _pick(id) {
    this.dispatchEvent(new CustomEvent('load-character', { detail: { id }, bubbles: true, composed: true }));
  }

  _portraitError(id) {
    this._broken.add(id);
    this.requestUpdate();
  }

  // A row's thumbnail: the character's portrait via portraitUrlFor, degrading to
  // a name-initial placeholder when the path is empty or the image fails.
  _thumb(id, row) {
    const url = portraitUrlFor(row?.portrait);
    if (!url || this._broken.has(id)) {
      const initial = (row?.name ?? id).trim().charAt(0).toUpperCase();
      return html`<div class="thumb fallback" aria-hidden="true">${initial || '?'}</div>`;
    }
    return html`<img class="thumb" src=${url} alt="" loading="lazy" @error=${() => this._portraitError(id)} />`;
  }

  render() {
    const rows = [...(this.characters ?? [])].sort((a, b) => (a?.id ?? '').localeCompare(b?.id ?? ''));
    return modalFrame(this._ctl, {
      title: 'Load a character',
      layer: 2100,
      width: '24rem',
      body: html`
        <p class="hint">Pick a character to load. The choice is remembered for the next visit.</p>
        <div class="list">
          ${rows.map((row) => html`
            <button type="button" class="row ${row.id === this.current ? 'current' : ''}" @click=${() => this._pick(row.id)}>
              ${this._thumb(row.id, row)}
              <span class="who">
                <span class="nm">${row?.name ?? row.id}</span>
                <span class="id">${row.id}${row.id === this.current ? ' — loaded' : ''}</span>
              </span>
            </button>
          `)}
          ${rows.length === 0 ? html`<p class="hint">No characters found.</p>` : ''}
        </div>`,
    });
  }
}

customElements.define('ed-character-picker', EdCharacterPicker);
