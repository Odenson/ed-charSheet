// ui/ed-custom-skill.js — the "Create custom skill" form modal (plans/gen-skill-other I8).
// Opened from a per-section header button in the skill pickers (Knowledge / Artisan /
// General) when the homebrew rule `skills.allowCustom` is on.
//
// Architecture (Tier-1 golden rule): this view NEVER mutates state or computes game values.
// Form state and validation are the pure ui/custom-skill-state.js + engine/validate-skill.js;
// Create dispatches `ed-create-custom-skill` { name, skill } up (ed-app writes the overlay and
// saves), then closes. Props are data-down: `kind`, `attributes` (names), `templateAttribute`
// (the generic template entry's attribute from data), `coreNames`, `customNames`.
// Built on the UI kit (ui/kit/, docs/MODALS.md): Escape closes only this form (the picker
// beneath stays), Enter = Create from inputs/selects (Ctrl/⌘+Enter in the description
// textarea), focus returns to the opening button; theme-aware via light-dark().

import { LitElement, html, css } from 'lit';
import { initialForm, setField, formErrors, toSkill } from './custom-skill-state.js';
import { MAX_TEXT } from '../engine/skill-options.js';
import { MAX_DESCRIPTION } from '../engine/validate-skill.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

const KIND_LABEL = { knowledge: 'Knowledge', artisan: 'Artisan', general: 'General' };

export class EdCustomSkill extends LitElement {
  static properties = {
    kind: {},
    attributes: { attribute: false },        // attribute names (rules/attributes.json order)
    templateAttribute: { attribute: false }, // the generic template entry's attribute (data)
    coreNames: { attribute: false },
    customNames: { attribute: false },
    _form: { state: true },
    _touched: { state: true },
  };

  constructor() {
    super();
    this.kind = 'knowledge';
    this.attributes = [];
    this.templateAttribute = null;
    this.coreNames = [];
    this.customNames = [];
    this._form = null;
    this._touched = false;
    this._ctl = new ModalController(this, {
      kind: 'input',
      isDirty: () => false, // Escape / Cancel / backdrop close the form straight away
      onConfirm: () => this._create(),
      canConfirm: () => this._errors().length === 0,
      onClose: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  willUpdate() {
    if (!this._form) this._form = initialForm(this.kind, { attributes: this.attributes, templateAttribute: this.templateAttribute });
  }

  _opts() {
    return { coreNames: this.coreNames ?? [], attributeNames: this.attributes ?? [], customNames: this.customNames ?? [] };
  }

  _errors() {
    return this._form ? formErrors(this._form, this._opts()) : [];
  }

  _set(field, value) {
    this._form = setField(this._form, field, value);
    this._touched = true;
  }

  _create() {
    if (this._errors().length) return;
    const skill = toSkill(this._form);
    this.dispatchEvent(new CustomEvent('ed-create-custom-skill', { detail: { name: skill.name, skill }, bubbles: true, composed: true }));
    this._ctl.close({ reason: 'confirm' });
  }

  render() {
    const f = this._form;
    if (!f) return html``;
    const errors = this._errors();
    const general = f.kind === 'general';
    return html`
      ${modalFrame(this._ctl, {
        title: `Create ${KIND_LABEL[f.kind] ?? ''} skill`,
        label: 'Create custom skill',
        layer: 2200,
        width: '30rem',
        scroll: true,
        hasTextarea: true,
        body: html`
          <div class="form">
            <p class="sub">Custom skills are shared by every character, tagged Custom, and need your GM's approval at the table.</p>
            <div class="fld">
              <label for="cs-name">Name</label>
              <input id="cs-name" type="text" maxlength=${MAX_TEXT} autocomplete="off" autofocus .value=${f.name}
                @input=${(e) => this._set('name', e.target.value)} />
            </div>
            <div class="fld">
              <label for="cs-attr">Attribute</label>
              <select id="cs-attr" .value=${f.attribute} @change=${(e) => this._set('attribute', e.target.value)}>
                <option value="" ?selected=${!f.attribute}>Choose…</option>
                ${(this.attributes ?? []).map((a) => html`<option value=${a} ?selected=${a === f.attribute}>${a}</option>`)}
              </select>
            </div>
            <div class="fld">
              <label for="cs-tier">Tier</label>
              ${general
                ? html`<select id="cs-tier" .value=${String(f.tier)} @change=${(e) => this._set('tier', Number(e.target.value))}>
                    <option value="1" ?selected=${f.tier !== 2}>Novice</option>
                    <option value="2" ?selected=${f.tier === 2}>Journeyman</option>
                  </select>`
                : html`<span id="cs-tier" class="fixed">Novice</span>`}
            </div>
            <div class="fld">
              <label for="cs-desc">Description (optional)</label>
              <textarea id="cs-desc" rows="4" maxlength=${MAX_DESCRIPTION} .value=${f.summary}
                @input=${(e) => this._set('summary', e.target.value)}></textarea>
            </div>
            ${this._touched && errors.length
              ? html`<ul class="errors" role="alert">${errors.map((e) => html`<li>${e}</li>`)}</ul>`
              : ''}
          </div>`,
        primary: { label: 'Create skill', disabled: errors.length > 0 },
      })}
    `;
  }

  static styles = [modalCss, css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --accent: light-dark(#7a3e12, #d9944e);
      --danger: light-dark(#c0392b, #e57373);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .form { display: flex; flex-direction: column; gap: 10px; }
    .sub { font-size: var(--fs-small); color: var(--muted); line-height: 1.5; margin: 0; }
    .fld { display: flex; flex-direction: column; gap: 3px; }
    .fld label { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 500; }
    .fld input, .fld select, .fld textarea { font: inherit; font-size: var(--fs-body); color: var(--fg); background: var(--bg-card); border: 1px solid var(--border); border-radius: 7px; padding: 6px 8px; outline: none; min-width: 0; }
    .fld input:focus, .fld select:focus, .fld textarea:focus { border-color: var(--accent); }
    .fld textarea { resize: vertical; }
    .fixed { font-size: var(--fs-body); color: var(--fg); padding: 6px 0; }
    .errors { margin: 0; padding-left: 18px; color: var(--danger); font-size: var(--fs-small); }
  `];
}
customElements.define('ed-custom-skill', EdCustomSkill);
