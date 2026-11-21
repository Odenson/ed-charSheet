// ui/ed-new-character.js — the "new character" modal (create-new-adept, slice B1): a name
// field and a race select for the Discipline the player clicked in the loader, and the same
// modal in `rename` mode (name only) when the first Save finds the draft's id taken on the
// character-data branch.
//
// Presentational only (Tier-1 golden rule): it never builds a character or stores anything.
// It asks the pure `validateNewName` (engine/new-character.js) whether the typed name's id is
// free, composes the wording from the returned reason code, and dispatches up:
//   create mode  -> `create-character { name, race, discipline }`  (name trimmed)
//   rename mode  -> `rename-draft { name }`
// ed-app does the work and re-checks (it is the authority; this modal only saves a round trip).
// A clash is a BLOCKING inline warning (`role="alert"`) that also disables the primary; the id
// is never suffixed (owner decision, plans/create-new-adept/qa-log.md).
//
// Built on the UI kit (ui/kit/, docs/MODALS.md), kind `input`, layer 2150 (above the picker's
// 2100). Escape / backdrop / Cancel / ✕ close with no domain event; Enter confirms the primary
// when it is enabled (the name field is autofocused). Every close path ends in a `close` event
// (separate-component modal contract, docs/MODALS.md §8); the loader and ed-app clear their
// mount state in `@close`. Theme-aware via light-dark(); weights 400/500; `--fs-*` sizes only.
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { validateNewName } from '../engine/new-character.js';

/**
 * The wording for a `validateNewName` result (the engine returns codes only). `id` names the
 * clashing id so "Kolon" and "kolon!" are explained. Shared by this modal and ed-app's notice
 * so the two never drift. Returns '' for an acceptable name.
 */
export function nameProblemText({ reason, id } = {}) {
  if (reason === 'taken') return `A character with this name already exists (id "${id}") — choose a different name.`;
  if (reason === 'empty') return 'Enter a name for the character.';
  return '';
}

export class EdNewCharacter extends LitElement {
  static properties = {
    mode: { type: String }, // 'create' (default) | 'rename'
    discipline: { type: String }, // create mode: the Discipline whose "+" was clicked
    races: { attribute: false }, // race names, from rules/races.json (data down)
    takenIds: { attribute: false }, // ids already in use (index rows + drafts)
    name: { type: String }, // rename mode: the name the field starts with
    clashId: { type: String }, // rename mode: the id the branch already holds (always taken)
    _name: { state: true },
    _race: { state: true },
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --danger: light-dark(#c0392b, #e06557);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --text: light-dark(#111418, #f0f3f7);
    }
    form { display: flex; flex-direction: column; gap: 0.7rem; }
    .fld { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input, select {
      font: inherit; font-size: var(--fs-body); color: var(--text);
      background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px;
      padding: 6px 8px; width: 100%; box-sizing: border-box;
    }
    input:focus, select:focus { outline: none; border-color: var(--accent); }
    .hint { font-size: var(--fs-fine); color: var(--muted); margin: 0; line-height: 1.4; }
    .warn {
      margin: 0; padding: 6px 10px; border-radius: 8px; line-height: 1.4;
      font-size: var(--fs-small); color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger);
    }
  `];

  constructor() {
    super();
    this.mode = 'create';
    this.discipline = '';
    this.races = [];
    this.takenIds = [];
    this.name = '';
    this.clashId = '';
    this._name = '';
    this._race = '';
    this._ctl = new ModalController(this, {
      kind: 'input',
      onConfirm: () => this._confirm(),
      canConfirm: () => this._valid(),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  // Rename mode starts with the draft's current name in the field (so the clash warning shows at
  // once); create mode starts empty.
  willUpdate(changed) {
    if (changed.has('name')) this._name = this.name ?? '';
  }

  get _rename() {
    return this.mode === 'rename';
  }

  // The pure id check. The clashing id the branch reported is always taken, even when the local
  // rows (loaded at startup) have not seen it yet.
  _check() {
    const taken = [...(this.takenIds ?? []), ...(this.clashId ? [this.clashId] : [])];
    return validateNewName(this._name, taken);
  }

  _valid() {
    if (!this._check().ok) return false;
    return this._rename || !!this._race;
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // Dispatch the domain event, then close (the kit restores focus to the trigger). A refused
  // confirm (invalid) does nothing.
  _confirm() {
    if (!this._valid()) return;
    const name = this._name.trim();
    const detail = this._rename ? { name } : { name, race: this._race, discipline: this.discipline };
    this.dispatchEvent(new CustomEvent(this._rename ? 'rename-draft' : 'create-character', { detail, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  }

  render() {
    const rename = this._rename;
    const check = this._check();
    const problem = check.reason === 'taken' ? nameProblemText(check) : '';
    return modalFrame(this._ctl, {
      title: rename ? 'Rename this character' : `Start a new ${this.discipline || 'character'}`,
      layer: 2150,
      width: '24rem',
      primary: { label: rename ? 'Rename' : 'Create', disabled: !this._valid() },
      body: html`
        <form @submit=${(e) => e.preventDefault()}>
          <div class="fld">
            <label for="nc-name">Name</label>
            <input id="nc-name" name="name" type="text" autocomplete="off" spellcheck="false" autofocus
              .value=${this._name} @input=${(e) => { this._name = e.target.value; }} />
          </div>
          ${rename
            ? ''
            : html`
                <div class="fld">
                  <label for="nc-race">Race</label>
                  <select id="nc-race" name="race" @change=${(e) => { this._race = e.target.value; }}>
                    <option value="" disabled ?selected=${!this._race}>Choose a race</option>
                    ${(this.races ?? []).map((r) => html`<option value=${r} ?selected=${r === this._race}>${r}</option>`)}
                  </select>
                </div>`}
          ${problem ? html`<p class="warn" role="alert">${problem}</p>` : ''}
          <p class="hint">
            ${rename
              ? "The name becomes the character's id when it is first saved to GitHub."
              : 'The character is kept in this browser as a draft until your first Save.'}
          </p>
        </form>`,
    });
  }
}

customElements.define('ed-new-character', EdNewCharacter);
