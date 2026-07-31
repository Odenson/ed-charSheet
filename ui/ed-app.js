// ui/ed-app.js — root: loads the model, renders the tab shell, routes tabs.
import { LitElement, html, css } from 'lit';
import { loadCharacterModel } from '../store.js';
import './ed-overview.js';
import './ed-disciplines.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '▤' },
  { id: 'disciplines', label: 'Disciplines', icon: '◈' },
  { id: 'spells', label: 'Spells', icon: '✦' },
  { id: 'gear', label: 'Gear', icon: '⚔' },
  { id: 'notes', label: 'Notes', icon: '❋' },
];

export class EdApp extends LitElement {
  static properties = {
    _model: { state: true },
    _error: { state: true },
    _tab: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem 1rem 1.5rem;
      color: var(--value, light-dark(#111418, #f0f3f7));
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    :host { color-scheme: light dark; }
    .tabbar {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .tab {
      display: flex; align-items: center; gap: 6px;
      padding: 7px 13px; font-size: 0.85rem; font-family: inherit;
      color: var(--muted, #6b7280); background: none; border: none;
      border-bottom: 2px solid transparent; cursor: pointer;
    }
    .tab[aria-selected='true'] { color: var(--value, #111); border-bottom-color: var(--accent, #b26a00); }
    .tab .ico { font-size: 0.8rem; opacity: 0.8; }
    .status { padding: 2rem 0; color: var(--muted, #667); font-weight: 500; }
    .status.error { color: #c0392b; }
    .stub { text-align: center; color: var(--muted, #889); padding: 3rem 0; font-size: 0.9rem; }
    .stub .big { font-size: 1.6rem; display: block; margin-bottom: 0.5rem; opacity: 0.7; }
    footer {
      margin-top: 1.25rem; font-size: 0.72rem;
      color: var(--muted, #889);
    }
    .dev-pill {
      position: fixed; top: 0.75rem; right: 0.75rem; z-index: 1000;
      padding: 0.25rem 0.7rem; border-radius: 999px;
      background: #b26a00; color: #fff;
      font: 700 0.7rem/1 system-ui, sans-serif; letter-spacing: 0.08em;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); pointer-events: none;
    }
  `;

  constructor() {
    super();
    this._model = null;
    this._error = null;
    this._tab = 'overview';
  }

  async connectedCallback() {
    super.connectedCallback();
    try {
      this._model = await loadCharacterModel();
    } catch (e) {
      this._error = String(e);
    }
  }

  _panel() {
    const m = this._model;
    switch (this._tab) {
      case 'overview':
        return html`<ed-overview .model=${m}></ed-overview>`;
      case 'disciplines':
        return html`<ed-disciplines .model=${m}></ed-disciplines>`;
      case 'spells':
        return html`<div class="stub"><span class="big">✦</span>Spellbook — matrices and spells by circle. Coming soon.</div>`;
      case 'gear':
        return html`<div class="stub"><span class="big">⚔</span>Gear — weapons, armour, thread items, kit. Coming soon.</div>`;
      case 'notes':
        return html`<div class="stub"><span class="big">❋</span>Notes — a running history of the character. Coming soon.</div>`;
      default:
        return html``;
    }
  }

  render() {
    const isDev = location.pathname.includes('/dev/');
    if (this._error) return html`<p class="status error">Could not load character: ${this._error}</p>`;
    if (!this._model) return html`<p class="status">Loading character…</p>`;
    return html`
      ${isDev ? html`<div class="dev-pill" title="Development environment">DEV</div>` : ''}
      <div class="tabbar" role="tablist">
        ${TABS.map(
          (t) => html`
            <button
              class="tab"
              role="tab"
              aria-selected=${this._tab === t.id}
              @click=${() => (this._tab = t.id)}
            >
              <span class="ico" aria-hidden="true">${t.icon}</span>${t.label}
            </button>
          `,
        )}
      </div>
      ${this._panel()}
      <footer>Earthdawn Character Sheet</footer>
    `;
  }
}

customElements.define('ed-app', EdApp);
