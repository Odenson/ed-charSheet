// ui/ed-homebrew.js — a pill that shows whenever a homebrew rule is enabled, and
// a modal listing the active rules. The pill sits beside the version badge in
// the footer; the modal shows each rule's name, summary, and the plain-English
// formula notes from rules/homebrew.json (docs/HOMEBREW-RULES.md — notes are
// documentation only, the engine ignores them). Renders nothing when no rule is
// enabled. Escape / backdrop / ✕ close it, matching the app's other modals
// (UI-GUIDELINES §7); theme-aware (light + dark); 400/500 weights only.
import { LitElement, html, css } from 'lit';
import { ModalController } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

class EdHomebrew extends LitElement {
  static properties = {
    rules: { attribute: false },
    _open: { state: true },
  };

  static styles = [modalCss, css`
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
      font-weight: 500; font-size: var(--fs-fine); line-height: 1.4; font-family: system-ui, sans-serif;
      letter-spacing: 0.03em;
      cursor: pointer;
    }
    .badge:hover { filter: brightness(1.06); }
    .rule { margin-bottom: 1rem; }
    .rule:last-child { margin-bottom: 0; }
    .rname { font-size: var(--fs-value); font-weight: 500; }
    .rover { font-size: var(--fs-fine); color: var(--muted); margin-top: 1px; }
    .rsum { font-size: var(--fs-body); line-height: 1.5; margin: 6px 0 8px; }
    .frm { border-top: 1px solid var(--border); padding-top: 6px; }
    .fhead {
      font-size: var(--fs-eyebrow); font-weight: 500; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.06em; margin: 2px 0 4px;
    }
    .rating { margin: 4px 0; }
    .rt {
      font-size: var(--fs-small); font-weight: 500; color: var(--accent);
      text-transform: capitalize;
    }
    .note { font-size: var(--fs-small); line-height: 1.45; color: var(--muted); }
    .term {
      display: flex; gap: 6px; font-size: var(--fs-small); line-height: 1.45;
      color: var(--muted); margin: 1px 0 1px 8px;
    }
    .term .dot { color: var(--accent); flex: none; }
  `];

  constructor() {
    super();
    this.rules = [];
    this._open = false;
    this._ctl = new ModalController(this, { kind: 'info', onClose: () => { this._open = false; } });
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
      <button class="badge" title="Active homebrew rules — click to view" @click=${(e) => { this._open = true; this._ctl.opened(e.currentTarget); }}>
        ${label}
      </button>
      ${this._open
        ? modalFrame(this._ctl, {
            title: 'Active homebrew rules',
            layer: 2000,
            width: '32rem',
            scroll: true,
            body: html`${this.rules.map((r) => this._rule(r))}`,
          })
        : ''}
    `;
  }
}

customElements.define('ed-homebrew', EdHomebrew);
