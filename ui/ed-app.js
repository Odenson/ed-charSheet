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
    /* Dev-only pill: fixed to the viewport, shown only on the /dev/ instance. */
    .dev-pill {
      position: fixed;
      top: 0.75rem;
      right: 0.75rem;
      z-index: 1000;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      background: #b26a00;
      color: #fff;
      font: 700 0.7rem/1 system-ui, sans-serif;
      letter-spacing: 0.08em;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }
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
    // Dev instance is served from the "/dev/" subpath; production from the root.
    const isDev = location.pathname.includes('/dev/');
    return html`
      ${isDev ? html`<div class="dev-pill" title="Development environment">DEV</div>` : ''}
      ${this._error
        ? html`<p class="status error">Could not load character: ${this._error}</p>`
        : !this._model
          ? html`<p class="status">Loading character…</p>`
          : html`<ed-stats-view .model=${this._model}></ed-stats-view>`}
      <footer>Earthdawn Character Sheet</footer>
    `;
  }
}

customElements.define('ed-app', EdApp);
