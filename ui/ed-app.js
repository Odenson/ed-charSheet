// ui/ed-app.js — root component: loads the model, handles loading/error states,
// and renders the character sheet. Later phases add a view router here.

import { LitElement, html, css } from 'lit';
import { loadCharacterModel } from '../store.js';
import './ed-stats-view.js';

export class EdApp extends LitElement {
  static properties = {
    _model: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1.5rem 1rem 4rem;
    }
    .status {
      padding: 2rem 0;
      color: var(--muted, #667);
      font: 500 1rem/1.5 system-ui, sans-serif;
    }
    .status.error { color: #c0392b; }
    footer {
      margin-top: 3rem;
      font: 400 0.75rem/1.4 system-ui, sans-serif;
      color: var(--muted, #889);
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .env {
      padding: 0.1rem 0.5rem;
      border-radius: 0.4rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      font-size: 0.7rem;
    }
    .env.prod { background: #1b5e20; color: #fff; }
    .env.dev { background: #b26a00; color: #fff; }
  `;

  constructor() {
    super();
    this._model = null;
    this._error = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    try {
      this._model = await loadCharacterModel();
    } catch (e) {
      this._error = String(e);
    }
  }

  render() {
    const isDev = location.pathname.includes('/dev/');
    return html`
      ${this._error
        ? html`<p class="status error">Could not load character: ${this._error}</p>`
        : !this._model
          ? html`<p class="status">Loading character…</p>`
          : html`<ed-stats-view .model=${this._model}></ed-stats-view>`}
      <footer>
        Earthdawn Character Sheet
        <span class="env ${isDev ? 'dev' : 'prod'}">${isDev ? 'DEV' : 'PROD'}</span>
      </footer>
    `;
  }
}

customElements.define('ed-app', EdApp);
