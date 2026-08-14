// ui/ed-changelog.js — a small version badge that opens a changelog modal.
//
// Reads data/changelog.json (the authored source of truth; see WORKFLOW.md). The
// badge shows the latest released version; clicking it opens a read-only modal
// listing each release's changes (and any Unreleased notes, which only appear on
// the /dev/ instance where they exist). Escape / backdrop / ✕ close it, matching
// the app's other modals (UI-GUIDELINES §7).
import { LitElement, html, css } from 'lit';

const TYPE_LABEL = {
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  removed: 'Removed',
  deprecated: 'Deprecated',
  security: 'Security',
};

class EdChangelog extends LitElement {
  static properties = {
    _data: { state: true },
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
      font-weight: 500; font-size: var(--fs-fine); line-height: 1.4; font-family: system-ui, sans-serif;
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
      gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem;
    }
    .mclose {
      background: none; border: none; color: var(--muted);
      font-size: var(--fs-value); line-height: 1; cursor: pointer;
    }
    .rel { margin-bottom: 1rem; }
    .rel:last-child { margin-bottom: 0; }
    .relhead { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.35rem; }
    .relver { font-weight: 500; color: var(--fg); font-size: var(--fs-value); }
    .reldate { font-size: var(--fs-fine); color: var(--muted); }
    ul { margin: 0; padding: 0; list-style: none; }
    li {
      display: flex; gap: 0.5rem; align-items: baseline;
      font-size: var(--fs-body); line-height: 1.5; color: var(--muted);
      margin-bottom: 0.25rem;
    }
    .tag {
      flex: none; min-width: 4.2em; text-align: center;
      font-size: var(--fs-eyebrow); font-weight: 500;
      text-transform: uppercase; letter-spacing: 0.04em;
      padding: 1px 6px; border-radius: 999px;
      background: var(--accent-bg); color: var(--accent);
    }
  `;

  constructor() {
    super();
    this._data = null;
    this._open = false;
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this._open = false;
    };
  }

  async connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
    try {
      const res = await fetch('./data/changelog.json');
      if (res.ok) this._data = await res.json();
    } catch {
      /* If the changelog can't load, the badge simply doesn't render. */
    }
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  get _latest() {
    return this._data?.releases?.[0] ?? null;
  }

  _changeList(changes) {
    return html`<ul>
      ${(changes ?? []).map(
        (c) => html`<li>
          <span class="tag">${TYPE_LABEL[c.type] ?? c.type}</span><span>${c.text}</span>
        </li>`,
      )}
    </ul>`;
  }

  render() {
    const latest = this._latest;
    if (!latest) return html``;
    const unreleased = this._data?.unreleased?.changes ?? [];
    return html`
      <button class="badge" title="What's new — view the changelog" @click=${() => (this._open = true)}>
        v${latest.version}
      </button>
      ${this._open
        ? html`
            <div class="overlay" @click=${() => (this._open = false)}>
              <div class="modal" @click=${(e) => e.stopPropagation()}>
                <div class="mhead">
                  <span>What's new</span>
                  <button class="mclose" aria-label="Close" @click=${() => (this._open = false)}>✕</button>
                </div>
                ${unreleased.length
                  ? html`<div class="rel">
                      <div class="relhead"><span class="relver">Unreleased</span></div>
                      ${this._changeList(unreleased)}
                    </div>`
                  : ''}
                ${(this._data.releases ?? []).map(
                  (r) => html`
                    <div class="rel">
                      <div class="relhead">
                        <span class="relver">v${r.version}</span>
                        <span class="reldate">${r.date}</span>
                      </div>
                      ${this._changeList(r.changes)}
                    </div>
                  `,
                )}
              </div>
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('ed-changelog', EdChangelog);
