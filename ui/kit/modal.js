// ui/kit/modal.js — the shared modal frame (overlay, dialog, header, body,
// footer) rendered in the HOST's own shadow root, plus `modalCss`. The frame
// only wires clicks to the ModalController (`requestClose` / `confirm`); it
// never dispatches game events or touches state. See docs/MODALS.md.
//
// Footers follow the owner's decisions: input/confirm get [Cancel] [Primary]
// and a muted keyboard hint (V4); an info modal has no footer unless the host
// asks for an `ack` button (only the roll modal does); pickers have none.
import { html, css, nothing } from 'lit';
import { buttonCss } from './button-css.js';
import { footerHint } from './modal-stack.js';
import { scopeCss } from './scope-css.js';

const TONE_CLASS = { accent: '', danger: 'danger', spell: 'spell', karma: 'karma', heal: 'heal' };

export const modalCss = [
  buttonCss,
  css`
    .overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: var(--kit-layer, 2000); padding: 1rem;
    }
    .modal {
      background: var(--bg-chip, light-dark(#ffffff, #232833));
      color: var(--text, var(--fg, var(--txt, light-dark(#111418, #f0f3f7))));
      border: 1px solid var(--border, light-dark(#e2e5ea, #2c313b));
      border-radius: 12px;
      width: var(--kit-width, 26rem); max-width: calc(100% - 2.5rem);
      padding: 1rem 1.25rem 1.25rem;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .modal.scroll { max-height: 85vh; overflow-y: auto; }
    .modal:focus { outline: none; }
    .mhead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-bottom: 0.5rem; }
    .mtitle { display: inline-flex; align-items: center; gap: 8px; font-size: var(--fs-title); font-weight: 500; min-width: 0; }
    .mclose {
      margin-left: auto; background: none; border: none;
      color: var(--muted, light-dark(#5a6472, #93a0b3));
      font-size: var(--fs-title); line-height: 1; padding: 0; cursor: pointer;
    }
    .mfoot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px 8px; margin-top: 1rem; }
    .mhint { margin-right: auto; font-size: var(--fs-fine); color: var(--muted, light-dark(#5a6472, #93a0b3)); }
    .mbtns { display: flex; gap: 8px; margin-left: auto; }
  `,
];

/**
 * Render the modal frame.
 * @param {import('./modal-controller.js').ModalController} ctl
 * @param {object} opts  title, label, titleExtra, body, layer, width, scroll,
 *   variant, primary { label, tone, disabled, type, form, title, className },
 *   extra, ack { label, className }, hasTextarea, cancelLabel, focusCancel. See docs/MODALS.md.
 */
export function modalFrame(ctl, opts) {
  const {
    title, titleExtra, body, layer = 2000, width = '26rem', scroll = false,
    variant, primary, extra, ack, hasTextarea = false, cancelLabel = 'Cancel', focusCancel = false,
  } = opts;
  const label = opts.label ?? (typeof title === 'string' ? title : undefined);
  const kind = ctl.kind;
  let footer = nothing;
  if ((kind === 'input' || kind === 'confirm') && primary) {
    const { label: pl, tone = 'accent', disabled = false, type = 'button', form, title: ptitle, className = '' } = primary;
    const cls = `btn primary ${TONE_CLASS[tone] ?? ''} ${className}`.replace(/\s+/g, ' ').trim();
    footer = html`
      <div class="mfoot">
        <span class="mhint">${footerHint({ hasTextarea })}</span>
        <span class="mbtns">
          ${extra ?? nothing}
          <button type="button" class="btn" data-cancel ?autofocus=${focusCancel} @click=${() => ctl.requestClose()}>${cancelLabel}</button>
          <button type=${type} form=${form ?? nothing} class=${cls} data-primary ?disabled=${disabled} title=${ptitle || nothing}
            @click=${() => { if (type !== 'submit') ctl.confirm(); }}>${pl}</button>
        </span>
      </div>`;
  } else if (kind === 'info' && ack) {
    const { label: al = 'OK', className = '' } = ack;
    footer = html`
      <div class="mfoot">
        <span class="mbtns">
          <button type="button" class=${`btn ${className}`.trim()} data-primary @click=${() => ctl.confirm()}>${al}</button>
        </span>
      </div>`;
  }
  return html`
    <div class="overlay" style="--kit-layer:${layer}" @click=${() => ctl.requestClose()}>
      <div class="modal ${scroll ? 'scroll' : ''}" style="--kit-width:${width}" role="dialog" aria-modal="true"
        aria-label=${label ?? nothing} data-modal=${ctl.id} data-variant=${variant ?? nothing} tabindex="-1"
        @click=${(e) => e.stopPropagation()}>
        <div class="mhead">
          <span class="mtitle">${title}</span>
          ${titleExtra ?? nothing}
          <button type="button" class="mclose" aria-label="Close" @click=${() => ctl.requestClose()}>✕</button>
        </div>
        <div class="mbody">${body}</div>
        ${footer}
      </div>
    </div>`;
}

let _lightStyled = false;
/** Light-DOM hosts (ed-save-key): adopt the kit CSS once, scoped under `.kit-portal`. */
export function ensureLightStyles() {
  if (_lightStyled) return;
  _lightStyled = true;
  const text = modalCss.map((c) => c.cssText).join('\n');
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(scopeCss(text, '.kit-portal'));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
