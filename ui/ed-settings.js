// ui/ed-settings.js — the Settings modal (autosave preferences).
//
// A small preferences dialog for the GitHub autosave: turn it on/off and set the
// idle interval (seconds of no changes before a background save fires). Rendered
// as a **light-DOM portal on `<body>`** (same pattern as `ed-conflict` /
// `ed-save-key`), outside `<ed-app>`'s shadow tree.
//
// Architecture (Tier-1 golden rule): this view NEVER persists anything itself. It
// takes the current values down as properties and, on Save, dispatches
// `ed-settings` up with `{ enabled, seconds }` — ed-app persists to localStorage
// and re-schedules the autosave. Escape / Cancel / backdrop close without change;
// Enter (the form submit) saves. Theme-aware via light-dark(); two font weights.
import { LitElement, html } from 'lit';

const MIN_SECONDS = 10;
const MAX_SECONDS = 3600;
const DEFAULT_SECONDS = 60;

export class EdSettings extends LitElement {
  static properties = {
    enabled: { type: Boolean },
    seconds: { type: Number },
    _enabled: { state: true },
    _seconds: { state: true },
  };

  createRenderRoot() {
    const portal = document.createElement('div');
    portal.className = 'eds-portal';
    document.body.appendChild(portal);
    this._portal = portal;
    return portal;
  }

  connectedCallback() {
    super.connectedCallback();
    // Seed the editable draft from the current settings passed down.
    this._enabled = this.enabled !== false;
    this._seconds = Number.isFinite(this.seconds) ? this.seconds : DEFAULT_SECONDS;
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
    this.renderRoot.querySelector('.eds-btn.primary')?.focus();
  }

  _close = () => {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  };

  // Clamp to a sane range; a blank / non-numeric field falls back to the default.
  _clampSeconds(v) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return DEFAULT_SECONDS;
    return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
  }

  _save = () => {
    const seconds = this._clampSeconds(this._seconds);
    this.dispatchEvent(new CustomEvent('ed-settings', { detail: { enabled: !!this._enabled, seconds }, bubbles: true, composed: true }));
    this._close();
  };

  render() {
    return html`
      <style>
        .eds-overlay {
          position: fixed; inset: 0; z-index: 2200; padding: 1rem;
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
        .eds-modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; box-sizing: border-box; }
        .eds-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; }
        .eds-close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
        .eds-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; font-size: 0.85rem; }
        .eds-row + .eds-row { border-top: 1px solid var(--border); }
        .eds-row .lbl { font-weight: 500; }
        .eds-row .hint { font-size: 0.72rem; color: var(--muted); margin-top: 2px; font-weight: 400; }
        .eds-num { font: inherit; font-size: 0.85rem; width: 5rem; text-align: right; color: var(--text); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; }
        .eds-num:focus { outline: none; border-color: var(--accent); }
        .eds-num:disabled { opacity: 0.5; }
        .eds-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem; }
        .eds-btn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
        .eds-btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
        /* Switch */
        .eds-switch { position: relative; width: 40px; height: 22px; flex: none; }
        .eds-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
        .eds-track { position: absolute; inset: 0; border-radius: 999px; background: var(--border); transition: background 0.15s; }
        .eds-switch input:checked + .eds-track { background: var(--accent); }
        .eds-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
        .eds-switch input:checked ~ .eds-knob { transform: translateX(18px); }
      </style>
      <div class="eds-overlay" @click=${this._close}>
        <div class="eds-modal" role="dialog" aria-modal="true" aria-label="Settings" @click=${(e) => e.stopPropagation()}>
          <div class="eds-head">
            <span>Settings</span>
            <button class="eds-close" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <form @submit=${(e) => { e.preventDefault(); this._save(); }}>
            <div class="eds-row">
              <div>
                <div class="lbl">Autosave to GitHub</div>
                <div class="hint">Save automatically after a pause in changes.</div>
              </div>
              <label class="eds-switch">
                <input type="checkbox" .checked=${this._enabled} aria-label="Enable autosave" @change=${(e) => (this._enabled = e.target.checked)} />
                <span class="eds-track"></span><span class="eds-knob"></span>
              </label>
            </div>
            <div class="eds-row">
              <div>
                <div class="lbl">Idle interval</div>
                <div class="hint">Seconds of no changes before an autosave (10–3600).</div>
              </div>
              <input class="eds-num" type="number" min=${MIN_SECONDS} max=${MAX_SECONDS} step="5" .value=${String(this._seconds)} ?disabled=${!this._enabled} aria-label="Autosave idle interval in seconds" @input=${(e) => (this._seconds = e.target.value)} />
            </div>
            <div class="eds-actions">
              <button type="button" class="eds-btn" @click=${this._close}>Cancel</button>
              <button type="submit" class="eds-btn primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-settings', EdSettings);
