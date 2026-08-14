// ui/ed-save-key.js — the key-prompt for saving to GitHub.
//
// Rendered as a **light-DOM portal on `<body>`** — deliberately *outside*
// `<ed-app>`'s shadow tree — with proper credential autocomplete, so password
// managers can offer to save and fill the key: 1Password (which pierces open
// shadow DOM) and, crucially, Apple's iCloud Keychain / Safari native autofill,
// which does **not** pierce shadow DOM and so needs the field at document level.
// The field is `type=password` + `autocomplete="current-password"`; a hidden
// `username` field gives managers a login pair to store. The key is still held in
// memory only (dispatched up to ed-app); nothing is persisted by the app itself.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything. On submit it dispatches `ed-save-key` up; it closes via `close`
// (Escape / Cancel / backdrop). Enter confirms; theme-aware via the document's
// color-scheme (light-dark()). Handlers are arrow fields so `this` is always the
// component — the dispatched events must originate on the element (which lives in
// ed-app's shadow) to reach ed-app's listeners, even though the DOM is portaled.
import { LitElement, html } from 'lit';

export class EdSaveKey extends LitElement {
  // Render into a fresh <body>-level container instead of a shadow root, so the
  // credential field is visible to native password managers. No shadow root means
  // `static styles` won't apply, so styles ship inline in the template.
  createRenderRoot() {
    const portal = document.createElement('div');
    portal.className = 'edk-portal';
    document.body.appendChild(portal);
    this._portal = portal;
    return portal;
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
    this._portal?.remove();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this.renderRoot.querySelector('#ed-savekey')?.focus();
  }

  _close = () => {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  };

  _submit = (e) => {
    e.preventDefault();
    const key = (this.renderRoot.querySelector('#ed-savekey')?.value ?? '').trim();
    if (!key) return; // nothing to submit
    // Dispatch up — ed-app stores it in memory and retries the save. Then close.
    this.dispatchEvent(new CustomEvent('ed-save-key', { detail: { key }, bubbles: true, composed: true }));
    this._close();
  };

  render() {
    return html`
      <style>
        .edk-overlay {
          position: fixed; inset: 0; z-index: 2100; padding: 1rem;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          --bg-chip: light-dark(#ffffff, #232833);
          --border: light-dark(#e2e5ea, #2c313b);
          --muted: light-dark(#5a6472, #93a0b3);
          --accent: light-dark(#7a3e12, #d9944e);
          --accent-bg: light-dark(#f6e9dc, #3a2a17);
          --text: light-dark(#111418, #f0f3f7);
        }
        .edk-modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; box-sizing: border-box; }
        .edk-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem; }
        .edk-close { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
        .edk-form { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; }
        .edk-label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
        .edk-input { font: inherit; font-size: var(--fs-body); color: var(--text); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px; padding: 7px 9px; width: 100%; box-sizing: border-box; }
        .edk-input:focus { outline: none; border-color: var(--accent); }
        /* Off-screen but present for managers (not display:none — they skip that). */
        .edk-user { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; opacity: 0; border: 0; pointer-events: none; }
        .edk-hint { font-size: var(--fs-fine); color: var(--muted); margin: 0; line-height: 1.4; }
        .edk-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 0.25rem; }
        .edk-btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
        .edk-btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
      </style>
      <div class="edk-overlay" @click=${this._close}>
        <div class="edk-modal" role="dialog" aria-modal="true" aria-label="Enter your save key" @click=${(e) => e.stopPropagation()}>
          <div class="edk-head">
            <span>Save to GitHub</span>
            <button class="edk-close" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <form class="edk-form" @submit=${this._submit} autocomplete="on">
            <!-- Hidden username so managers store/fill a proper login pair. -->
            <input class="edk-user" type="text" name="username" autocomplete="username"
                   value="ed-charsheet" readonly tabindex="-1" aria-hidden="true" />
            <div>
              <label class="edk-label" for="ed-savekey">Save key</label>
              <input class="edk-input" id="ed-savekey" name="password" type="password"
                     autocomplete="current-password" spellcheck="false"
                     placeholder="Paste your save key" />
            </div>
            <p class="edk-hint">Kept only for this browser session — the app never stores it. Your password manager (1Password, iCloud Keychain, …) can save and fill it next time.</p>
            <div class="edk-actions">
              <button type="button" class="edk-btn" @click=${this._close}>Cancel</button>
              <button type="submit" class="edk-btn primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-save-key', EdSaveKey);
