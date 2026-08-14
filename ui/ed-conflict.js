// ui/ed-conflict.js — the keep-mine / take-theirs modal for a `stale_base`
// conflict (plans/PLAN-SAVE-CONCURRENCY Phase C1).
//
// The worker rejected a save because the character changed on the branch since
// this client last read or saved it. The overlay still holds the local draft;
// nothing was lost. The player picks how to resolve the divergence:
//   Keep mine   (primary, Enter) — overwrite the branch with the local version.
//   Take theirs — discard the local draft and reload the branch version.
//   Cancel      — close; the local draft stays in this browser, nothing written.
//
// Rendered as a **light-DOM portal on `<body>`** (same pattern as `ed-save-key`),
// deliberately outside `<ed-app>`'s shadow tree. Architecture (Tier-1 golden
// rule): this view NEVER mutates state or persists anything. On a choice it
// dispatches `ed-conflict` up with `{ choice }` and closes via `close`
// (Escape / Cancel / backdrop). Enter confirms (the primary action is the form's
// submit). Theme-aware via the document's color-scheme (light-dark()); two font
// weights only (400/500). Handlers are arrow fields so `this` is always the
// component — the dispatched events must originate on the element (which lives in
// ed-app's shadow) to reach ed-app's listeners, even though the DOM is portaled.
import { LitElement, html } from 'lit';

export class EdConflict extends LitElement {
  // Render into a fresh <body>-level container instead of a shadow root, so the
  // modal always sits above everything. No shadow root means `static styles`
  // won't apply, so styles ship inline in the template.
  createRenderRoot() {
    const portal = document.createElement('div');
    portal.className = 'edc-portal';
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
    // Focus the primary action so Enter confirms immediately.
    this.renderRoot.querySelector('.edc-btn.primary')?.focus();
  }

  _close = () => {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  };

  _choose = (choice) => {
    // Dispatch up — ed-app routes the choice (keep-mine / take-theirs). Then close.
    this.dispatchEvent(new CustomEvent('ed-conflict', { detail: { choice }, bubbles: true, composed: true }));
    this._close();
  };

  render() {
    return html`
      <style>
        .edc-overlay {
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
        .edc-modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; box-sizing: border-box; }
        .edc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; }
        .edc-close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
        .edc-body { font-size: 0.82rem; color: var(--muted); margin: 0 0 1rem; line-height: 1.5; }
        .edc-body strong { color: var(--text); font-weight: 500; }
        .edc-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .edc-btn { font: inherit; font-size: 0.82rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
        .edc-btn.primary { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
      </style>
      <div class="edc-overlay" @click=${this._close}>
        <div class="edc-modal" role="dialog" aria-modal="true" aria-label="This character changed elsewhere" @click=${(e) => e.stopPropagation()}>
          <div class="edc-head">
            <span>This character changed elsewhere</span>
            <button class="edc-close" aria-label="Close" @click=${this._close}>✕</button>
          </div>
          <p class="edc-body">This character changed on another device or player since you last loaded it. Your unsaved edits are safe here — how do you want to resolve the difference?</p>
          <form class="edc-actions" @submit=${(e) => { e.preventDefault(); this._choose('keep-mine'); }}>
            <button type="button" class="edc-btn" @click=${() => this._choose('cancel')}>Cancel</button>
            <button type="button" class="edc-btn" @click=${() => this._choose('take-theirs')}>Take theirs</button>
            <button type="submit" class="edc-btn primary">Keep mine</button>
          </form>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-conflict', EdConflict);
