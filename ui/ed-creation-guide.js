// ui/ed-creation-guide.js — the one-off "how character creation works" pop-up shown right
// after a new character is created (name and race chosen). Presentational only: it renders the
// steps from creation-text.js and dispatches `close` when dismissed; it stores nothing.
//
// Built on the UI kit (ui/kit/, docs/MODALS.md), kind `info`: Escape / ✕ / backdrop / "Got it"
// / Enter all close it. Layer 2150. Theme-aware via light-dark(); weights 400/500 only.
import { LitElement, html, css } from 'lit';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';
import { guideIntro, guideSteps } from './creation-text.js';

export class EdCreationGuide extends LitElement {
  static properties = {
    magician: { type: Boolean }, // adds the spell-picking step
    name: { type: String },
  };

  static styles = [modalCss, css`
    .lead { font-size: var(--fs-body); line-height: 1.5; margin: 0 0 0.6rem; color: var(--muted, light-dark(#5a6472, #93a0b3)); }
    ol { margin: 0; padding-left: 1.25rem; display: grid; gap: 0.55rem; }
    li { font-size: var(--fs-body); line-height: 1.45; }
    li b { font-weight: 500; color: var(--accent, light-dark(#7a3e12, #d9944e)); }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'info',
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  render() {
    return modalFrame(this._ctl, {
      title: 'Creating your character',
      layer: 2150,
      width: '30rem',
      scroll: true,
      ack: { label: 'Got it' },
      body: html`
        <p class="lead">${guideIntro(this.name)}</p>
        <ol>
          ${guideSteps({ magician: !!this.magician }).map((s) => html`<li><b>${s.where}.</b> ${s.text}</li>`)}
        </ol>`,
    });
  }
}

customElements.define('ed-creation-guide', EdCreationGuide);
