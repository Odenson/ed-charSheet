// <ed-active-effects> — the unified Active effects window (Combat + Spells tabs).
// Renders the engine-built, grouped list from `.effects` only; computes nothing
// (grouping/labels/pct/low come from engine/active-effects.js + active-effects-state.js).
// Events up: `ed-end-effect` {kind, id}. plans/active-condition-window.
import { LitElement, html, css } from 'lit';
import { viewGroups, roundsPillText, endButtonLabel } from './active-effects-state.js';

export class EdActiveEffects extends LitElement {
  static properties = {
    effects: { attribute: false },
    layout: { type: String },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --spell: light-dark(#5b3fa6, #a99cf0);
      --spell-bg: light-dark(#efeafc, #2b2547);
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
      --amber: light-dark(#8a5a12, #e0a94e);
      --amber-bg: light-dark(#f6ecd9, #3a2f17);
      display: block;
    }
    .aehead { margin: 14px 0 6px; font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
    .cols { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .col { min-width: 0; }
    .grp { font-size: var(--fs-eyebrow); color: var(--muted); margin: 6px 0 2px; font-weight: 500; }
    .aecard { background: var(--bg-card); border-radius: 8px; padding: 4px 11px; }
    .aeempty { font-size: var(--fs-fine); color: var(--muted); padding: 8px 2px; }
    .aerow { display: flex; align-items: center; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--border); }
    .aerow:last-child { border-bottom: none; }
    .aemark { color: var(--spell); font-size: var(--fs-small); flex: none; }
    .aemid { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .aename { font-size: var(--fs-small); font-weight: 500; overflow-wrap: anywhere; }
    .aename .aefx { font-weight: 400; color: var(--muted); }
    .aetext { font-size: var(--fs-fine); color: var(--muted); overflow-wrap: anywhere; }
    .aebar { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
    .aebar > i { display: block; height: 100%; border-radius: 999px; background: var(--karma); }
    .aebar.low > i { background: var(--amber); }
    .aeopts { display: flex; flex-wrap: wrap; gap: 4px; }
    .pickchip { font-size: var(--fs-eyebrow); color: var(--spell); background: var(--spell-bg); border-radius: 999px; padding: 1px 8px; }
    .succchip { font-size: var(--fs-eyebrow); color: var(--karma); background: var(--karma-bg); border-radius: 999px; padding: 1px 8px; }
    .aedetail summary { font-size: var(--fs-eyebrow); color: var(--muted); cursor: pointer; }
    .tepend { font-size: var(--fs-eyebrow); color: var(--muted); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 8px; }
    .aerounds { flex: none; font-size: var(--fs-eyebrow); font-weight: 500; font-variant-numeric: tabular-nums; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
    .aerounds.ok { color: var(--karma); background: var(--karma-bg); }
    .aerounds.low { color: var(--amber); background: var(--amber-bg); }
    .aeend { flex: none; font: inherit; font-size: var(--fs-small); line-height: 1; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 999px; width: 22px; height: 22px; cursor: pointer; padding: 0; }
    .aeend:hover { color: var(--fg); background: var(--bg-chip); }
    .aeend:focus-visible { outline: 2px solid var(--spell); outline-offset: 1px; }
  `;

  constructor() {
    super();
    this.effects = [];
    this.layout = 'stack';
  }

  _end(e) {
    if (!e.endAction) return;
    this.dispatchEvent(new CustomEvent('ed-end-effect', {
      detail: { kind: e.endAction.kind, id: e.endAction.id }, bubbles: true, composed: true,
    }));
  }

  _row(e) {
    const label = e.effectLabel === null && e.kind === 'spell' ? null : e.effectLabel;
    return html`
      <div class="aerow">
        <span class="aemark">✦</span>
        <div class="aemid">
          <span class="aename">${e.name}${label ? html` <span class="aefx">· ${label}${e.targetNamed ? ` against ${e.targetName}` : ''}</span>` : (e.side === 'tgt' && e.kind === 'spell' ? html` <span class="tepend">Effect —</span>` : '')}</span>
          ${e.roundsLeft != null ? html`<div class="aebar ${e.low ? 'low' : ''}"><i style="width:${e.pct}%"></i></div>` : ''}
          ${e.successes || e.chips?.length ? html`<div class="aeopts">${e.successes ? html`<span class="succchip">${e.successes} success${e.successes === 1 ? '' : 'es'}</span>` : ''}${(e.chips ?? []).map((c) => html`<span class="pickchip">${c.label}${c.count > 1 ? ` ×${c.count}` : ''}</span>`)}</div>` : ''}
          ${e.text ? html`<details class="aedetail"><summary>Details</summary><span class="aetext">${e.text}</span></details>` : ''}
        </div>
        <span class="aerounds ${e.low ? 'low' : 'ok'}">${roundsPillText(e)}</span>
        ${e.endable ? html`<button class="aeend" type="button" aria-label=${endButtonLabel(e)} title=${endButtonLabel(e)} @click=${() => this._end(e)}>×</button>` : ''}
      </div>`;
  }

  render() {
    const list = this.effects ?? [];
    const groups = viewGroups(list, this.layout);
    const head = html`<h4 class="aehead">Active effects${list.length ? ` · ${list.length}` : ''}</h4>`;
    if (this.layout === 'columns') {
      return html`${head}<div class="cols">${groups.map((g) => html`
        <div class="col"><div class="grp">${g.label}</div>
          <div class="aecard">${g.items.length ? g.items.map((e) => this._row(e)) : html`<div class="aeempty">None</div>`}</div>
        </div>`)}</div>`;
    }
    return html`${head}<div class="aecard">${groups.length
      ? groups.map((g) => html`<div class="grp">${g.label}</div>${g.items.map((e) => this._row(e))}`)
      : html`<div class="aeempty">No active effects. A spell with a duration cast on this character will appear here with its rounds remaining.</div>`}</div>`;
  }
}

customElements.define('ed-active-effects', EdActiveEffects);
