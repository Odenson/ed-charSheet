// ui/ed-delete-character.js — the "delete this character" modal (plans/delete-character):
// type the character's name to confirm, with an optional "also delete the portrait image".
//
// Presentational only (Tier-1 golden rule): it never calls the network or stores anything.
// The pure `nameMatches` (delete-action.js) gates the Delete button; the modal dispatches up
//   `delete-character { id, deleteImage }`  (composed, bubbling)
// and ed-app performs the work, passing `busy` / `error` back down. The modal stays open
// while busy and on error (the error shows inline, `role="alert"`); the host removes it once
// the row is gone or the player cancels.
//
// Built on the UI kit (ui/kit/, docs/MODALS.md), kind `input`, layer 2150 (above the picker's
// 2100). Escape / backdrop / Cancel / ✕ close with a `close` event; Enter confirms only when
// the typed name matches and nothing is in flight. Theme-aware via light-dark(); weights
// 400/500; `--fs-*` sizes only.
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { nameMatches } from '../delete-action.js';

export class EdDeleteCharacter extends LitElement {
  static properties = {
    characterId: { type: String },
    name: { type: String },
    draft: { type: Boolean }, // an unsaved local draft (nothing on GitHub)
    hasPortrait: { type: Boolean }, // the index says the character has a portrait image
    hasPendingEdits: { type: Boolean }, // local edits not yet saved
    busy: { type: Boolean }, // a delete is in flight
    error: { type: String }, // inline error from the last attempt
    _typed: { state: true },
    _deleteImage: { state: true },
  };

  static styles = [modalCss, css`
    :host {
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --danger: light-dark(#c0392b, #e06557);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --text: light-dark(#111418, #f0f3f7);
    }
    form { display: flex; flex-direction: column; gap: 0.7rem; }
    .fld { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    label.cap { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    input[type='text'] {
      font: inherit; font-size: var(--fs-body); color: var(--text);
      background: light-dark(#f7f8fa, #1b1f27); border: 1px solid var(--border); border-radius: 6px;
      padding: 6px 8px; width: 100%; box-sizing: border-box;
    }
    input[type='text']:focus { outline: none; border-color: var(--danger); }
    .msg { margin: 0; font-size: var(--fs-body); line-height: 1.5; color: var(--text); }
    .hint { font-size: var(--fs-fine); color: var(--muted); margin: 0; line-height: 1.4; }
    .warn {
      margin: 0; padding: 6px 10px; border-radius: 8px; line-height: 1.4;
      font-size: var(--fs-small); color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger);
    }
    .chk { display: flex; align-items: flex-start; gap: 8px; font-size: var(--fs-body); color: var(--text); cursor: pointer; }
    .chk input { margin-top: 3px; }
  `];

  constructor() {
    super();
    this.characterId = '';
    this.name = '';
    this.draft = false;
    this.hasPortrait = false;
    this.hasPendingEdits = false;
    this.busy = false;
    this.error = '';
    this._typed = '';
    this._deleteImage = false;
    this._ctl = new ModalController(this, {
      kind: 'input',
      onConfirm: () => this._confirm(),
      canConfirm: () => this._enabled(),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  _enabled() {
    return nameMatches(this._typed, this.name) && !this.busy;
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // Dispatch the domain event only; the modal stays open (busy / inline error) until the host
  // removes it. A refused confirm (name mismatch or busy) does nothing.
  _confirm() {
    if (!this._enabled()) return;
    this.dispatchEvent(new CustomEvent('delete-character', {
      detail: { id: this.characterId, deleteImage: this.hasPortrait && this._deleteImage },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return modalFrame(this._ctl, {
      title: `Delete ${this.name || this.characterId}?`,
      label: 'Delete character',
      layer: 2150,
      width: '26rem',
      cancelLabel: 'Cancel',
      primary: { label: this.busy ? 'Deleting…' : 'Delete', tone: 'danger', disabled: !this._enabled() },
      body: html`
        <form @submit=${(e) => e.preventDefault()}>
          <p class="msg">
            ${this.draft
              ? 'This permanently removes the unsaved draft from this browser. It cannot be undone.'
              : 'This permanently deletes the character from GitHub. Recovery is only possible through the git history of the character-data branch.'}
          </p>
          ${this.draft
            ? html`<p class="warn">This draft was never saved, so nothing can be recovered.</p>`
            : this.hasPendingEdits
              ? html`<p class="warn">This character has unsaved local edits; they are discarded too.</p>`
              : ''}
          <div class="fld">
            <label class="cap" for="dc-name">Type the character's name to confirm</label>
            <input id="dc-name" name="confirm-name" type="text" autocomplete="off" spellcheck="false" autofocus
              placeholder=${this.name} .value=${this._typed} ?disabled=${this.busy}
              @input=${(e) => { this._typed = e.target.value; }} />
          </div>
          ${this.hasPortrait && !this.draft
            ? html`
                <label class="chk">
                  <input type="checkbox" .checked=${this._deleteImage} ?disabled=${this.busy}
                    @change=${(e) => { this._deleteImage = e.target.checked; }} />
                  <span>Also delete the portrait image</span>
                </label>
                <p class="hint">Kept by default. It is never removed while another character uses the same image.</p>`
            : ''}
          ${this.error ? html`<p class="warn" role="alert">${this.error}</p>` : ''}
        </form>`,
    });
  }
}

customElements.define('ed-delete-character', EdDeleteCharacter);
