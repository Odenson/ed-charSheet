// ui/ed-character-picker.js — modal listing every character in the grouped
// store so the player can choose one to load.
//
// Presentational only (Tier-1 golden rule): it lists `characters` (the store's
// id → entry map) and dispatches `load-character` up with the chosen id; ed-app
// does the loading. It opens both on first-run startup (no saved selection) and
// from the header icon, and it closes via `close` (Escape / backdrop / ✕).
//
// Tier-1 modal rules: Escape / backdrop close; Enter confirms (the list rows are
// native <button>s, the first is autofocused, so Enter activates it); theme-aware
// via light-dark(); two font weights only (400/500). Portrait thumbnails resolve
// through store.js `portraitUrlFor` (raw CDN on Pages, bundle-relative locally)
// and degrade to a name-initial placeholder on a missing/broken image.
import { LitElement, html, css } from 'lit';
import { portraitUrlFor } from '../store.js';

export class EdCharacterPicker extends LitElement {
  static properties = {
    characters: { type: Object },
    current: { type: String },
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
    .overlay {
      position: fixed; inset: 0; z-index: 2100; padding: 1rem;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.5); font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .modal {
      background: var(--bg-chip); color: var(--text); border: 1px solid var(--border);
      border-radius: 12px; width: 24rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem;
      box-sizing: border-box;
    }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; }
    .close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
    .hint { font-size: 0.68rem; color: var(--muted); margin: 0 0 0.6rem; line-height: 1.4; }
    .list { display: flex; flex-direction: column; gap: 6px; max-height: 45vh; overflow-y: auto; }
    .row {
      display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      padding: 8px 10px; border-radius: 8px; cursor: pointer; box-sizing: border-box;
      border: 1px solid var(--border); background: light-dark(#f7f8fa, #1b1f27); color: var(--text);
      font: inherit; font-size: 0.85rem;
    }
    .row:hover { border-color: var(--accent); }
    .row.current { border-color: var(--accent); background: var(--accent-bg); }
    .thumb { width: 38px; height: 38px; border-radius: 6px; flex: 0 0 auto; object-fit: cover; background: var(--accent-bg); }
    .thumb.fallback {
      display: flex; align-items: center; justify-content: center;
      font-weight: 500; color: var(--accent); font-size: 0.9rem; text-transform: uppercase;
    }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .nm { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .id { font-size: 0.68rem; color: var(--muted); }
  `;

  constructor() {
    super();
    this.characters = {};
    this.current = null;
    this._broken = new Set(); // ids whose portrait failed to load
  }

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

  // Focus the first row so Enter confirms (native button activation).
  firstUpdated() {
    this.renderRoot.querySelector('.row')?.focus();
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
  _thumb(id, entry) {
    const meta = entry?.meta ?? {};
    const url = portraitUrlFor(meta.portrait);
    if (!url || this._broken.has(id)) {
      const initial = (meta.name ?? id).trim().charAt(0).toUpperCase();
      return html`<div class="thumb fallback" aria-hidden="true">${initial || '?'}</div>`;
    }
    return html`<img class="thumb" src=${url} alt="" loading="lazy" @error=${() => this._portraitError(id)} />`;
  }

  render() {
    const entries = Object.entries(this.characters ?? {}).sort(([a], [b]) => a.localeCompare(b));
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Load a character" @click=${(e) => e.stopPropagation()}>
          <div class="head">
            <span>Load a character</span>
            <button class="close" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <p class="hint">Pick a character to load. The choice is remembered for the next visit.</p>
          <div class="list">
            ${entries.map(([id, entry]) => html`
              <button class="row ${id === this.current ? 'current' : ''}" @click=${() => this._pick(id)}>
                ${this._thumb(id, entry)}
                <span class="who">
                  <span class="nm">${entry?.meta?.name ?? id}</span>
                  <span class="id">${id}${id === this.current ? ' — loaded' : ''}</span>
                </span>
              </button>
            `)}
            ${entries.length === 0 ? html`<p class="hint">No characters found.</p>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-character-picker', EdCharacterPicker);
