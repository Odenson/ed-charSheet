// ui/ed-app.js — root: loads the model, renders the tab shell, routes tabs.
import { LitElement, html, css } from 'lit';
import { loadCharacter, deriveModel, saveMetaEdits, saveItemEdits, saveWealthEdits } from '../store.js';
import { isFileSaveSupported, restoreFileHandle, saveToFile } from '../store-file.js';
import './ed-overview.js';
import './ed-disciplines.js';
import './ed-equipment.js';
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
    _fileName: { state: true },
    _fileDirty: { state: true },
    _fileBusy: { state: true },
    _fileError: { state: true },
  };

  // Raw editable inputs (character.json + overlay) and the loaded rules. Edits
  // dispatched up from views mutate these here, then re-derive _model (data
  // flows back down). Not reactive state — _model is the render trigger.
  _character = null;
  _rules = null;
  // Whether this browser can write a user-picked file (Chromium only). Fixed for
  // the session, so a plain field — not reactive state.
  _fileSupported = isFileSaveSupported();

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
    /* Edit / Save / Theme: uniform round icon-only buttons. */
    .icon-btn {
      position: relative; width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      color: var(--muted, #6b7280); cursor: pointer; font-size: 0.9rem; line-height: 1;
    }
    .icon-btn + .icon-btn { margin-left: 6px; }
    .icon-btn:hover { color: light-dark(#111418, #f0f3f7); }
    .icon-btn[disabled] { opacity: 0.5; cursor: default; }
    .ico-svg { width: 15px; height: 15px; display: block; }
    .icon-btn.edit { margin-left: auto; }
    .icon-btn.edit.active {
      background: var(--accent, #b26a00); border-color: var(--accent, #b26a00); color: #fff;
    }
    /* Accent dot: edits in the web store not yet flushed to the file. */
    .icon-btn.save.dirty::after {
      content: ''; position: absolute; top: -2px; right: -2px;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent, #b26a00);
      border: 1.5px solid light-dark(#f4f5f7, #12151b);
    }
    .file-toast {
      position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%);
      z-index: 2200; max-width: 90vw;
      padding: 0.5rem 0.9rem; border-radius: 8px; font-size: 0.8rem;
      background: light-dark(#fff, #232833); color: #c0392b;
      border: 1px solid #c0392b; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
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
    // File persistence (Chromium): the connected file's name, whether the web
    // store has unsaved-to-file edits, and transient save state.
    this._fileName = null;
    this._fileDirty = false;
    this._fileBusy = false;
    this._fileError = null;
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
    this.addEventListener('ed-edit-items', (e) => this._editItems(e.detail));
    this.addEventListener('ed-edit-wealth', (e) => this._editWealth(e.detail));
    try {
      const { character, rules } = await loadCharacter();
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
    } catch (e) {
      this._error = String(e);
    }
    // Reconnect a previously-picked file (name only; write permission is
    // re-requested lazily on the next Save). Never blocks the character load.
    if (this._fileSupported) {
      const f = await restoreFileHandle();
      if (f) this._fileName = f.name;
    }
  }

  _editMeta(patch) {
    if (!this._character || !patch) return;
    this._character = { ...this._character, meta: { ...this._character.meta, ...patch } };
    saveMetaEdits(patch); // web store: always-on, instant, no permissions
    // The file (if connected) is now behind the web store until the next Save.
    this._fileDirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's item list. Same flow as meta: replace the
  // inputs, persist the overlay, mark the file dirty, and re-derive so armour /
  // defences / initiative recompute from the equipped items (data flows down).
  _editItems(items) {
    if (!this._character || !Array.isArray(items)) return;
    this._character = { ...this._character, items };
    saveItemEdits(items);
    this._fileDirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's wealth (coin counts / gems). Same inputs-only
  // flow: replace the wealth input, persist the overlay, mark the file dirty, and
  // re-derive so the totals recompute (data flows down).
  _editWealth(wealth) {
    if (!this._character || !wealth) return;
    this._character = { ...this._character, wealth };
    saveWealthEdits(wealth);
    this._fileDirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // Dual-write the merged, inputs-only character to the connected file (picking
  // one on first use). The web store already holds these edits, so afterwards
  // memory ↔ web store ↔ file are identical. Cancelling the picker is a no-op.
  async _saveFile() {
    if (!this._character || this._fileBusy) return;
    this._fileBusy = true;
    this._fileError = null;
    try {
      const { name } = await saveToFile(this._character);
      this._fileName = name;
      this._fileDirty = false;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // user dismissed the picker
      this._fileError = e?.message ? String(e.message) : String(e);
    } finally {
      this._fileBusy = false;
    }
  }

  _saveTitle() {
    if (this._fileBusy) return 'Saving…';
    if (this._fileName) return this._fileDirty ? `Save changes to ${this._fileName}` : `Saved to ${this._fileName}`;
    return 'Save to a character file…';
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
        return html`<ed-equipment .model=${m} .editMode=${this._editMode}></ed-equipment>`;
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
          class="icon-btn edit ${this._editMode ? 'active' : ''}"
          role="switch"
          aria-checked=${this._editMode}
          @click=${() => (this._editMode = !this._editMode)}
          title=${this._editMode ? 'Finish editing' : 'Edit character details'}
          aria-label=${this._editMode ? 'Finish editing' : 'Edit character details'}
        ><span aria-hidden="true">✎</span></button>
        ${this._editMode && this._fileSupported
          ? html`<button
              class="icon-btn save ${this._fileDirty ? 'dirty' : ''}"
              @click=${this._saveFile}
              ?disabled=${this._fileBusy}
              title=${this._saveTitle()}
              aria-label=${this._saveTitle()}
            ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
                <circle cx="12" cy="14" r="2" />
                <path d="M14 4v4h-6v-4" />
              </svg></button>`
          : ''}
        <button
          class="icon-btn theme"
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
      ${this._fileError
        ? html`<div class="file-toast" role="alert" @click=${() => (this._fileError = null)}>
            Couldn't save the file: ${this._fileError}
          </div>`
        : ''}
    `;
  }
}

customElements.define('ed-app', EdApp);
