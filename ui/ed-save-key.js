// ui/ed-save-key.js — the lean key-prompt for saving to GitHub. Shown when the
// user saves without a SAVE_KEY set for the session (store-server.js requires
// it, fail-closed). It collects the key and dispatches it up; ed-app holds it in
// memory only (never localStorage) and immediately retries the save.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything itself. On submit it dispatches `ed-save-key` up; it closes via
// `close` (Escape / Cancel / backdrop). Enter confirms; theme-aware.
import { LitElement, html, css } from 'lit';

export class EdSaveKey extends LitElement {
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
    form { display: flex; flex-direction: column; gap: 0.6rem; }
    label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input { font: inherit; font-size: 0.85rem; color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; width: 100%; box-sizing: border-box; }
    input:focus { outline: none; border-color: var(--accent); }
    .hint { font-size: 0.68rem; color: var(--muted); margin: 0; line-height: 1.4; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 0.25rem; }
    button.btn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    button.btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    button.btn[disabled] { opacity: 0.5; cursor: default; }
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
    const input = this.renderRoot.querySelector('input');
    if (input) input.focus();
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  _submit(e) {
    e.preventDefault();
    const key = (e.currentTarget.elements['savekey']?.value ?? '').trim();
    if (!key) return; // nothing to submit
    // Dispatch up — ed-app stores it in memory and retries the save. Then close.
    this.dispatchEvent(new CustomEvent('ed-save-key', { detail: { key }, bubbles: true, composed: true }));
    this._close();
  }

  render() {
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Enter your save key" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>Save to GitHub</span>
            <button class="mclose" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <form @submit=${this._submit}>
            <div>
              <label for="savekey">Save key</label>
              <input id="savekey" name="savekey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your save key" />
            </div>
            <p class="hint">Kept only for this browser session — never stored. You'll re-enter it next time you open the sheet.</p>
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

customElements.define('ed-save-key', EdSaveKey);
