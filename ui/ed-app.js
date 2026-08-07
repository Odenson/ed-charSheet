// ui/ed-app.js — root: loads the model, renders the tab shell, routes tabs.
import { LitElement, html, css } from 'lit';
import { loadCharacter, loadCharacters, deriveModel, saveMetaEdits, saveItemEdits, saveWealthEdits, reconcileOverlay, hasPendingEdits } from '../store.js';
import { saveServer, SaveError } from '../store-server.js';
import { exportCharacter } from '../store-export.js';
import './ed-overview.js';
import './ed-disciplines.js';
import './ed-equipment.js';
import './ed-roll-modal.js';
import './ed-changelog.js';
import './ed-edit-meta.js';
import './ed-save-key.js';
import './ed-confirm.js';
import './ed-character-picker.js';

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
    _dirty: { state: true },
    _saving: { state: true },
    _saveError: { state: true },
    _saveOk: { state: true },
    _keyPrompt: { state: true },
    _confirmDiscard: { state: true },
    _confirmSwitch: { state: true },
    _picker: { state: true },
    _noSelection: { state: true },
  };

  // Raw editable inputs (character.json + overlay) and the loaded rules. Edits
  // dispatched up from views mutate these here, then re-derive _model (data
  // flows back down). Not reactive state — _model is the render trigger.
  _character = null;
  _rules = null;
  // The selected character's map key in the grouped store (meta.id). Persisted
  // to localStorage 'ed-character' so the same character loads next session.
  _characterId = null;
  // The fetched grouped store ({ schema, characters: { id: entry } }) — the
  // character picker lists from it. Refreshed on each character load.
  _characterStore = null;
  // The SAVE_KEY for GitHub saves. Held in memory for the session only — never
  // localStorage (runbook §0). A plain field, not reactive state.
  _saveKey = null;

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
    /* Accent dot: local edits not yet committed to GitHub. */
    .icon-btn.save.dirty::after {
      content: ''; position: absolute; top: -2px; right: -2px;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent, #b26a00);
      border: 1.5px solid light-dark(#f4f5f7, #12151b);
    }
    .toast {
      position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%);
      z-index: 2200; max-width: 90vw;
      padding: 0.5rem 0.9rem; border-radius: 8px; font-size: 0.8rem;
      background: light-dark(#fff, #232833);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }
    .toast.error { color: #c0392b; border: 1px solid #c0392b; }
    .toast.ok { color: light-dark(#1a7a3e, #6ecb8f); border: 1px solid light-dark(#1a7a3e, #6ecb8f); }
    .toast a { color: inherit; font-weight: 500; }
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
      font: 500 0.7rem/1 system-ui, sans-serif; letter-spacing: 0.08em;
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
    // GitHub save state. _dirty = local edits not yet committed (survives reload
    // via the overlay); _saving = in-flight; _saveError / _saveOk = last result;
    // _keyPrompt = the key modal is open. Dirty is per-character and only known
    // after a character is selected, so it starts false and is set on load.
    this._dirty = false;
    this._saving = false;
    this._saveError = null;
    this._saveOk = null;
    this._keyPrompt = false;
    this._confirmDiscard = false;
    this._confirmSwitch = false;
    this._picker = false;
    this._noSelection = false;
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
    // The key-prompt modal supplies a SAVE_KEY; keep it in memory and retry.
    this.addEventListener('ed-save-key', (e) => {
      this._saveKey = e.detail?.key || null;
      this._keyPrompt = false;
      if (this._saveKey) this._save();
    });
    // The character picker dispatched a choice — load that character.
    this.addEventListener('load-character', (e) => {
      if (e.detail?.id) this._loadCharacter(e.detail.id);
    });
    try {
      const store = await loadCharacters();
      const ids = Object.keys(store?.characters ?? {});
      if (!ids.length) {
        this._error = 'No characters found in the character store.';
        return;
      }
      const id = this._initialId(ids, store);
      if (id) await this._loadCharacter(id, { store });
      else this._picker = true; // first run with no saved selection: ask
    } catch (e) {
      this._error = String(e);
    }
  }

  // Which character to load on startup: the saved 'ed-character' selection if
  // it still exists in the store; the single entry if there's only one (no real
  // choice); otherwise null — the picker asks the user (first run).
  _initialId(ids, store) {
    const saved = localStorage.getItem('ed-character');
    if (saved && store.characters?.[saved]) return saved;
    if (ids.length === 1) return ids[0];
    return null;
  }

  // Load a character by id: fetch the store (unless passed in), apply its per-id
  // overlay, derive the model. Persists the selection so the same character
  // loads next session. Sets _dirty from the id's own overlay.
  async _loadCharacter(id, { store } = {}) {
    try {
      const { character, rules, store: fresh } = await loadCharacter(id, store ? { store } : {});
      this._characterId = id;
      this._characterStore = fresh;
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
      this._dirty = hasPendingEdits(id);
      this._picker = false;
      this._noSelection = false;
      this._error = null;
      this._saveError = null;
      localStorage.setItem('ed-character', id);
    } catch (e) {
      this._saveError = `Couldn't load "${id}": ${e?.message ? String(e.message) : String(e)}`;
      this._picker = false;
    }
  }

  // Header icon: open the picker. A dirty character first confirms — the switch
  // proceeds without discarding the draft (overlays are per-id and survive).
  _pickCharacter() {
    if (this._dirty) this._confirmSwitch = true;
    else this._picker = true;
  }

  _editMeta(patch) {
    if (!this._character || !patch) return;
    this._character = { ...this._character, meta: { ...this._character.meta, ...patch } };
    saveMetaEdits(patch, this._characterId); // overlay: always-on autosave, instant, no permissions
    // Local edits are now ahead of the last GitHub commit until the next Save.
    this._dirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's item list. Same flow as meta: replace the
  // inputs, persist the overlay, mark the file dirty, and re-derive so armour /
  // defences / initiative recompute from the equipped items (data flows down).
  _editItems(items) {
    if (!this._character || !Array.isArray(items)) return;
    this._character = { ...this._character, items };
    saveItemEdits(items, this._characterId);
    this._dirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // A view changed the character's wealth (coin counts / gems). Same inputs-only
  // flow: replace the wealth input, persist the overlay, mark the file dirty, and
  // re-derive so the totals recompute (data flows down).
  _editWealth(wealth) {
    if (!this._character || !wealth) return;
    this._character = { ...this._character, wealth };
    saveWealthEdits(wealth, this._characterId);
    this._dirty = true;
    this._model = deriveModel(this._character, this._rules);
  }

  // Save to GitHub: POST the merged, inputs-only character to the worker, which
  // commits it to the character-data branch (store-server.js). Requires a
  // SAVE_KEY — if none is set for the session, open the key prompt first; the
  // overlay already holds the edits, so nothing is lost meanwhile. On success,
  // reconcile the overlay so the branch read becomes the source of truth (§4.5).
  async _save() {
    if (!this._character || this._saving) return;
    if (!this._saveKey) { this._keyPrompt = true; return; }
    this._saving = true;
    this._saveError = null;
    this._saveOk = null;
    try {
      const commit = await saveServer(this._character, { saveKey: this._saveKey, id: this._characterId });
      reconcileOverlay(undefined, this._characterId);
      this._dirty = false;
      this._saveOk = commit; // { sha, url }
    } catch (e) {
      // A rejected key: drop it so the next Save re-prompts.
      if (e instanceof SaveError && e.code === 'unauthorized') this._saveKey = null;
      this._saveError = e?.message ? String(e.message) : String(e);
    } finally {
      this._saving = false;
    }
  }

  // Export a local copy: a portable download of the same inputs-only bytes. A
  // backup, independent of the GitHub save — no key, no network, all browsers.
  _export() {
    if (!this._character) return;
    try {
      exportCharacter(this._character);
    } catch (e) {
      this._saveError = `Export failed: ${e?.message ? String(e.message) : String(e)}`;
    }
  }

  _saveTitle() {
    if (this._saving) return 'Saving to GitHub…';
    return this._dirty ? 'Save to GitHub (unsaved changes)' : 'Saved to GitHub';
  }

  // Discard the local autosave draft and reload the saved (GitHub) version of
  // the current character. Clears the overlay so it can't mask the branch, then
  // re-loads from source — the fix for a stale local draft leaking over a newer
  // GitHub save.
  async _discardLocal() {
    this._confirmDiscard = false;
    reconcileOverlay(undefined, this._characterId); // clear every saved category from the overlay
    try {
      const { character, rules } = await loadCharacter(this._characterId);
      this._character = character;
      this._rules = rules;
      this._model = deriveModel(character, rules);
      this._dirty = false;
      this._saveError = null;
    } catch (e) {
      this._saveError = `Couldn't reload the saved version: ${e?.message ? String(e.message) : String(e)}`;
    }
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
        ${this._editMode && this._dirty
          ? html`<button
                class="icon-btn revert"
                @click=${() => (this._confirmDiscard = true)}
                title="Discard local changes (reload the saved version)"
                aria-label="Discard local changes (reload the saved version)"
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3 -6.7l-3 2.7" />
                  <path d="M3 4v4h4" />
                </svg></button>`
          : ''}
        ${this._editMode
          ? html`<button
                class="icon-btn save ${this._dirty ? 'dirty' : ''}"
                @click=${this._save}
                ?disabled=${this._saving}
                title=${this._saveTitle()}
                aria-label=${this._saveTitle()}
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" />
                  <circle cx="12" cy="14" r="2" />
                  <path d="M14 4v4h-6v-4" />
                </svg></button>
              <button
                class="icon-btn export"
                @click=${this._export}
                title="Export a copy (download)"
                aria-label="Export a copy (download)"
              ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M8 11l4 4l4 -4" />
                  <path d="M5 19h14" />
                </svg></button>`
          : ''}
        <button
          class="icon-btn load"
          @click=${this._pickCharacter}
          title="Load a character"
          aria-label="Load a character"
        ><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20h16a2 2 0 0 0 2 -2v-9a2 2 0 0 0 -2 -2h-7l-2 -3h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2" />
            <path d="M9.5 10v5" /><path d="M7 12.5h5" />
          </svg></button>
        <button
          class="icon-btn theme"
          @click=${this._toggleTheme}
          title=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label=${this._dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >${this._dark ? '☀' : '☾'}</button>
      </div>
      ${this._model
        ? this._panel()
        : this._noSelection
          ? html`<div class="stub">
              <span class="big">▤</span>No character selected
              <div style="margin-top: 0.5rem">
                <button class="icon-btn" style="border-radius: 6px; padding: 6px 14px; width: auto; height: auto"
                        @click=${() => (this._picker = true)}>Choose a character</button>
              </div>
            </div>`
          : html`<p class="status">Loading character…</p>`}
      ${this._picker
        ? html`<ed-character-picker
            .characters=${this._characterStore?.characters ?? {}}
            .current=${this._characterId}
            @close=${() => {
              this._picker = false;
              if (!this._model) this._noSelection = true;
            }}
          ></ed-character-picker>`
        : ''}
      ${this._roll
        ? html`<ed-roll-modal
            .label=${this._roll.label}
            .stepRow=${this._roll.stepRow}
            .karma=${this._roll.karma}
            @close=${() => (this._roll = null)}
          ></ed-roll-modal>`
        : ''}
      ${this._keyPrompt ? html`<ed-save-key @close=${() => (this._keyPrompt = false)}></ed-save-key>` : ''}
      ${this._confirmDiscard
        ? html`<ed-confirm
            heading="Discard local changes?"
            message="This clears the unsaved edits stored in this browser and reloads the character saved on GitHub. It can't be undone."
            confirmLabel="Discard"
            @confirm=${this._discardLocal}
            @close=${() => (this._confirmDiscard = false)}
          ></ed-confirm>`
        : ''}
      ${this._confirmSwitch
        ? html`<ed-confirm
            heading="Load a different character?"
            message="Your unsaved edits for this character stay saved in this browser, and come back if you load it again."
            confirmLabel="Continue"
            @confirm=${() => {
              this._confirmSwitch = false;
              this._picker = true;
            }}
            @close=${() => (this._confirmSwitch = false)}
          ></ed-confirm>`
        : ''}
      <footer>Earthdawn Character Sheet : Created by Odenson : Inspired by ED4<ed-changelog></ed-changelog></footer>
      ${this._saveError
        ? html`<div class="toast error" role="alert" @click=${() => (this._saveError = null)}>
            Couldn't save: ${this._saveError}
          </div>`
        : ''}
      ${this._saveOk
        ? html`<div class="toast ok" role="status" @click=${() => (this._saveOk = null)}>
            Saved to GitHub ✓ ${this._saveOk.url ? html`— <a href=${this._saveOk.url} target="_blank" rel="noopener">view commit</a>` : ''}
          </div>`
        : ''}
    `;
  }
}

customElements.define('ed-app', EdApp);
