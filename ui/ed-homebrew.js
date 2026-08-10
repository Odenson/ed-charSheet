// ui/ed-homebrew.js — a pill that shows whenever a homebrew rule is enabled, and
// a modal listing the active rules. The pill sits beside the version badge in
// the footer; the modal shows each rule's name, summary, and the plain-English
// formula notes from rules/homebrew.json (docs/HOMEBREW-RULES.md — notes are
// documentation only, the engine ignores them). Renders nothing when no rule is
// enabled. Escape / backdrop / ✕ close it, matching the app's other modals
// (UI-GUIDELINES §7); theme-aware (light + dark); 400/500 weights only.
import { LitElement, html, css } from 'lit';

class EdHomebrew extends LitElement {
  static properties = {
    rules: { attribute: false },
    _open: { state: true },
  };

  static styles = css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --fg: light-dark(#111418, #f0f3f7);
    }
    .badge {
      display: inline-block;
      margin-left: 0.5rem;
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent);
      font: 500 0.7rem/1.4 system-ui, sans-serif;
      letter-spacing: 0.03em;
      cursor: pointer;
    }
    .badge:hover { filter: brightness(1.06); }
    .overlay {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-chip); color: var(--fg);
      border: 1px solid var(--border); border-radius: 12px;
      max-width: 32rem; width: 100%; max-height: 80vh; overflow: auto;
      padding: 1rem 1.25rem;
    }
    .mhead {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem;
    }
    .mclose {
      background: none; border: none; color: var(--muted);
      font-size: 1rem; line-height: 1; cursor: pointer;
    }
    .rule { margin-bottom: 1rem; }
    .rule:last-child { margin-bottom: 0; }
    .rname { font-size: 0.92rem; font-weight: 500; }
    .rover { font-size: 0.68rem; color: var(--muted); margin-top: 1px; }
    .rsum { font-size: 0.82rem; line-height: 1.5; margin: 6px 0 8px; }
    .frm { border-top: 1px solid var(--border); padding-top: 6px; }
    .fhead {
      font-size: 0.6rem; font-weight: 500; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.06em; margin: 2px 0 4px;
    }
    .rating { margin: 4px 0; }
    .rt {
      font-size: 0.78rem; font-weight: 500; color: var(--accent);
      text-transform: capitalize;
    }
    .note { font-size: 0.78rem; line-height: 1.45; color: var(--muted); }
    .term {
      display: flex; gap: 6px; font-size: 0.78rem; line-height: 1.45;
      color: var(--muted); margin: 1px 0 1px 8px;
    }
    .term .dot { color: var(--accent); flex: none; }
  `;

  constructor() {
    super();
    this.rules = [];
    this._open = false;
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this._close();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  // Drop keyboard focus from the trigger pill so an Escape close ends the same
  // way a mouse close does — otherwise the pill keeps :focus-visible and a stray
  // Enter/Space would reopen the modal (same pattern as ed-overview/ed-equipment).
  _close() {
    this.renderRoot.activeElement?.blur();
    this._open = false;
  }

  // One rule block: name, the rulebook section it overrides, the summary, and the
  // plain-English formula notes (rating note + each term's note — documentation
  // only, straight from rules/homebrew.json).
  _rule(r) {
    return html`
      <div class="rule">
        <div class="rname">${r.name}</div>
        ${r.overrides ? html`<div class="rover">${r.overrides}</div>` : ''}
        ${r.summary ? html`<div class="rsum">${r.summary}</div>` : ''}
        ${r.formula
          ? html`<div class="frm">
              <div class="fhead">Formula notes</div>
              ${Object.entries(r.formula).map(
                ([rating, f]) => html`
                  <div class="rating">
                    <div class="rt">${rating}</div>
                    ${f.note ? html`<div class="note">${f.note}</div>` : ''}
                    ${(f.terms ?? [])
                      .filter((t) => t.note)
                      .map((t) => html`<div class="term"><span class="dot">·</span><span>${t.note}</span></div>`)}
                  </div>
                `,
              )}
            </div>`
          : ''}
      </div>
    `;
  }

  render() {
    if (!this.rules?.length) return html``;
    const label = this.rules.length > 1 ? `Homebrew ×${this.rules.length}` : 'Homebrew';
    return html`
      <button class="badge" title="Active homebrew rules — click to view" @click=${() => (this._open = true)}>
        ${label}
      </button>
      ${this._open
        ? html`
            <div class="overlay" @click=${() => this._close()}>
              <div class="modal" @click=${(e) => e.stopPropagation()}>
                <div class="mhead">
                  <span>Active homebrew rules</span>
                  <button class="mclose" aria-label="Close" @click=${() => this._close()}>✕</button>
                </div>
                ${this.rules.map((r) => this._rule(r))}
              </div>
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('ed-homebrew', EdHomebrew);
