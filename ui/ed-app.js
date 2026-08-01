// ui/ed-app.js — root: loads the model, renders the tab shell, routes tabs.
import { LitElement, html, css } from 'lit';
import { loadCharacter, deriveModel, saveMetaEdits } from '../store.js';
import './ed-overview.js';
import './ed-disciplines.js';
import './ed-roll-modal.js';
import './ed-changelog.js';
import './ed-edit-meta.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '▤' },
  { id: 'disciplines', label: 'Disciplines', icon: '◈' },
  { id: 'spells', label: 'Spells', icon: '✦' },
  { id: 'equipment', label: 'Equipment', icon: '⚔' },
  { id: 'notes', label: 'Notes', icon: '❋' },
];

export class EdApp extends LitElement {
  static properties = {
    _model: { state: true },
    _error: { state: true },
    _tab: { state: true },
    _dark: { state: true },
    _roll: { state: true },
    _editMode: { state: true },
  };

  // Raw editable inputs (character.json + overlay) and the loaded rules. Edits
  // dispatched up from views mutate these here, then re-derive _model (data
  // flows back down). Not reactive state — _model is the render trigger.
  _character = null;
  _rules = null;

  static styles = css`
    :host {
      display: block;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem 1rem 1.5rem;
      color: light-dark(#111418, #f0f3f7);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .tabbar {
      display: flex;
      align-items: center;
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
    .tab[aria-selected='true'] { color: light-dark(#111418, #f0f3f7); border-bottom-color: var(--accent, #b26a00); }
    .tab .ico { font-size: 0.8rem; opacity: 0.8; }
    .edit-btn {
      margin-left: auto; display: flex; align-items: center; gap: 5px;
      padding: 5px 12px; border-radius: 999px; font: inherit; font-size: 0.8rem;
      background: none; border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      color: var(--muted, #6b7280); cursor: pointer; line-height: 1;
    }
    .edit-btn:hover { color: light-dark(#111418, #f0f3f7); }
    .edit-btn.active {
      background: var(--accent, #b26a00); border-color: var(--accent, #b26a00); color: #fff;
    }
    .theme-btn {
      margin-left: 6px; width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      color: var(--muted, #6b7280); cursor: pointer; font-size: 0.9rem; line-height: 1;
    }
    .theme-btn:hover { color: light-dark(#111418, #f0f3f7); }
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
    // Editing is a transient, global mode: read mode stays clean (no per-field
    // affordances); flip this on to reveal editable regions. Not persisted —
    // the sheet always opens in read mode.
    this._editMode = false;
    // Theme: honour a saved preference, else follow the system setting.
    const saved = localStorage.getItem('ed-theme');
    this._dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    this._applyTheme();
  }

  async connectedCallback() {
    super.connectedCallback();
    // Any roll button in a child view bubbles an 'ed-roll' event up to here.
    this.addEventListener('ed-roll', (e) => {
      const { label, step, karma } = e.detail;
      const stepRow = this._model?.stepByNumber?.[step];
      if (!stepRow) return;
      // Resolve the Karma die's step row (D6) so the modal can offer +D6.
      const karmaCtx =
        karma?.step != null && this._model?.stepByNumber?.[karma.step]
          ? { grants: karma.grants, available: karma.available, stepRow: this._model.stepByNumber[karma.step] }
          : null;
      this._roll = { label, stepRow, karma: karmaCtx };
    });
    // A view edited character inputs. Apply the patch, persist the overlay, and
    // re-derive the model from inputs — the UI never mutates derived state.
    this.addEventListener('ed-edit-meta', (e) => this._editMeta(e.detail));
    try {
      const { character, rules } = await loadCharacter();
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
    } catch (e) {
      this._error = String(e);
    }
  }

  _editMeta(patch) {
    if (!this._character || !patch) return;
    this._character = { ...this._character, meta: { ...this._character.meta, ...patch } };
    saveMetaEdits(patch);
    this._model = deriveModel(this._character, this._rules);
  }

  _applyTheme() {
    // Force the color-scheme on the document root so light-dark() everywhere follows it.
    document.documentElement.style.colorScheme = this._dark ? 'dark' : 'light';
  }

  _toggleTheme() {
    this._dark = !this._dark;
    localStorage.setItem('ed-theme', this._dark ? 'dark' : 'light');
    this._applyTheme();
  }

  _panel() {
    const m = this._model;
    switch (this._tab) {
      case 'overview':
        return html`<ed-overview .model=${m} .editMode=${this._editMode}></ed-overview>`;
      case 'disciplines':
        return html`<ed-disciplines .model=${m}></ed-disciplines>`;
      case 'spells':
        return html`<div class="stub"><span class="big">✦</span>Spellbook — matrices and spells by circle. Coming soon.</div>`;
      case 'equipment':
        return html`<div class="stub"><span class="big">⚔</span>Equipment — weapons, armour, thread items, kit. Coming soon.</div>`;
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
        <button
          class="edit-btn ${this._editMode ? 'active' : ''}"
          role="switch"
          aria-checked=${this._editMode}
          @click=${() => (this._editMode = !this._editMode)}
          title=${this._editMode ? 'Finish editing' : 'Edit character details'}
        ><span aria-hidden="true">✎</span>${this._editMode ? 'Done' : 'Edit'}</button>
        <button
          class="theme-btn"
          @click=${this._toggleTheme}
          title=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >${this._dark ? '☀' : '☾'}</button>
      </div>
      ${this._panel()}
      ${this._roll
        ? html`<ed-roll-modal
            .label=${this._roll.label}
            .stepRow=${this._roll.stepRow}
            .karma=${this._roll.karma}
            @close=${() => (this._roll = null)}
          ></ed-roll-modal>`
        : ''}
      <footer>Earthdawn Character Sheet : Created by Odenson : Inspired by ED4<ed-changelog></ed-changelog></footer>
    `;
  }
}

customElements.define('ed-app', EdApp);
