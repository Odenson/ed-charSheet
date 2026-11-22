// ui/ed-save-key.js — the key-prompt for saving to GitHub.
//
// Rendered as a **light-DOM portal on `<body>`** — deliberately *outside*
// `<ed-app>`'s shadow tree — with proper credential autocomplete, so password
// managers can offer to save and fill the key: 1Password (which pierces open
// shadow DOM) and, crucially, Apple's iCloud Keychain / Safari native autofill,
// which does **not** pierce shadow DOM and so needs the field at document level.
// The field is `type=password` + `autocomplete="current-password"`; a hidden
// `username` field gives managers a login pair to store. The key is still held in
// memory only (dispatched up to ed-app); nothing is persisted by the app itself.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or persists
// anything. On submit it dispatches `ed-save-key` up; it closes via `close`
// (Escape / Cancel / backdrop). Enter confirms; theme-aware via the document's
// color-scheme (light-dark()). It uses the UI kit in light-DOM mode
// (`light: true` + `ensureLightStyles()`, docs/MODALS.md): the kit's frame CSS is
// adopted once, scoped under `.kit-portal`. Handlers are arrow fields so `this` is always the
// component — the dispatched events must originate on the element (which lives in
// ed-app's shadow) to reach ed-app's listeners, even though the DOM is portaled.
import { LitElement, html } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, ensureLightStyles } from './kit/modal.js';

export class EdSaveKey extends LitElement {
  // Render into a fresh <body>-level container instead of a shadow root, so the
  // credential field is visible to native password managers. With no shadow root,
  // `static styles` do not apply: the kit sheet comes from ensureLightStyles() and
  // the field CSS ships inline in the template, scoped under `.kit-portal`.
  createRenderRoot() {
    const portal = document.createElement('div');
    portal.className = 'kit-portal';
    document.body.appendChild(portal);
    this._portal = portal;
    return portal;
  }

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'input',
      light: true,
      // The primary is a real submit button (form attr), so password managers see
      // a submit event; Enter goes through the form too.
      onConfirm: () => document.getElementById('ed-savekey-form')?.requestSubmit(),
      initialFocus: '#ed-savekey',
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    ensureLightStyles();
    this._ctl.opened(deepActiveElement());
  }

  disconnectedCallback() {
    this._portal?.remove();
    super.disconnectedCallback();
  }

  _submit = (e) => {
    e.preventDefault();
    const key = (this.renderRoot.querySelector('#ed-savekey')?.value ?? '').trim();
    if (!key) return; // nothing to submit
    // Dispatch up — ed-app stores it in memory and retries the save. Then close.
    this.dispatchEvent(new CustomEvent('ed-save-key', { detail: { key }, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  };

  render() {
    return html`
      <style>
        .kit-portal .edk-form { display: flex; flex-direction: column; gap: 0.6rem; margin: 0; }
        .kit-portal .edk-label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: light-dark(#5a6472, #93a0b3); }
        .kit-portal .edk-input { font: inherit; font-size: var(--fs-body); color: light-dark(#111418, #f0f3f7); background: light-dark(#f7f8fa, #1b1f27); border: 1px solid light-dark(#e2e5ea, #2c313b); border-radius: 6px; padding: 7px 9px; width: 100%; box-sizing: border-box; }
        .kit-portal .edk-input:focus { outline: none; border-color: light-dark(#7a3e12, #d9944e); }
        /* Off-screen but present for managers (not display:none, they skip that). */
        .kit-portal .edk-user { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; opacity: 0; border: 0; pointer-events: none; }
        .kit-portal .edk-hint { font-size: var(--fs-fine); color: light-dark(#5a6472, #93a0b3); margin: 0; line-height: 1.4; }
      </style>
      ${modalFrame(this._ctl, {
        title: 'Save to GitHub',
        label: 'Enter your save key',
        layer: 2200,
        width: '26rem',
        primary: { label: 'Save', type: 'submit', form: 'ed-savekey-form' },
        body: html`
          <form class="edk-form" id="ed-savekey-form" @submit=${this._submit} autocomplete="on">
            <!-- Hidden username so managers store/fill a proper login pair. -->
            <input class="edk-user" type="text" name="username" autocomplete="username"
                   value="ed-charsheet" readonly tabindex="-1" aria-hidden="true" />
            <div>
              <label class="edk-label" for="ed-savekey">Save key</label>
              <input class="edk-input" id="ed-savekey" name="password" type="password"
                     autocomplete="current-password" spellcheck="false" autofocus
                     placeholder="Paste your save key" />
            </div>
            <p class="edk-hint">Kept only for this browser session — the app never stores it. Your password manager (1Password, iCloud Keychain, …) can save and fill it next time.</p>
          </form>`,
      })}
    `;
  }
}

customElements.define('ed-save-key', EdSaveKey);
