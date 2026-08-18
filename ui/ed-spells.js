// ui/ed-spells.js — the Spells tab (PLAN-SPELLS.md §6). Presentational only:
// renders the Grimoire and (phase 8.6a) the cast workspace from the pushed-down
// `model.spells` SpellsContext, and dispatches edits/rolls UP. It never mutates
// state or computes game values — engine/spells.js does the derivation, ed-app
// owns the save + roll (data-down / dispatch-up golden rule).
//
// Phase 8.5 scope: the seg (Cast | Grimoire), the Grimoire list grouped by
// Discipline + Circle, the detail modal, matrix place/release (any time), and
// remove (edit mode). Learn (a roll) and the cast flow land in 8.6a.
import { LitElement, html, css } from 'lit';
import { knownByDisciplineCircle, castTypeList, matrixFor } from '../engine/spells.js';

export class EdSpells extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    arming: { attribute: false },
    _view: { state: true },
    _modal: { state: true },
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
      --danger: light-dark(#a63a2b, #e0846f);
      display: block;
    }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .seg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
    .seg button { border: none; background: none; padding: 6px 16px; border-radius: 999px; font: inherit; font-size: var(--fs-body); color: var(--muted); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .kchip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
    .kchip b { color: var(--karma); font-weight: 500; }

    .empty { color: var(--muted); font-size: var(--fs-body); background: var(--bg-card); border-radius: 8px; padding: 18px; text-align: center; }

    .circlelbl { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 12px 0 3px; }
    .card { background: var(--bg-card); border-radius: 8px; overflow: hidden; }
    .srow { display: grid; grid-template-columns: 16px minmax(0, 1.4fr) 42px 44px 62px 84px 22px; gap: 8px; align-items: center; font-size: var(--fs-small); padding: 6px 10px; border-bottom: 1px solid var(--border); }
    .srow:last-child { border-bottom: none; }
    .srow.h { font-size: var(--fs-eyebrow); color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info { width: 15px; height: 15px; border-radius: 50%; border: 1.5px solid var(--muted); color: var(--muted); font-size: var(--fs-eyebrow); font-style: italic; font-family: system-ui, sans-serif; display: inline-flex; align-items: center; justify-content: center; background: none; cursor: pointer; padding: 0; box-sizing: border-box; }
    .info:hover { border-color: var(--spell); color: var(--spell); }
    .attn { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); background: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
    .attn.on { border-color: var(--spell); background: var(--spell-bg); color: var(--spell); }
    .attn:disabled { opacity: 0.35; cursor: default; }
    .rm { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--border); background: none; color: var(--muted); font-size: 13px; cursor: pointer; padding: 0; line-height: 1; }
    .rm:hover { border-color: var(--danger); color: var(--danger); }
    .mx { font-size: var(--fs-eyebrow); color: var(--spell); }

    /* detail modal (Escape closes / Enter confirms; theme-aware) */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; width: 30rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; }
    .mhead { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 4px; }
    .mhead .nm { font-size: var(--fs-title); font-weight: 500; }
    .mhead .cr { font-size: var(--fs-small); color: var(--spell); background: var(--spell-bg); border-radius: 999px; padding: 1px 9px; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    .msum { font-size: var(--fs-body); line-height: 1.55; margin: 6px 0 12px; }
    .grid { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 5px 12px; font-size: var(--fs-small); }
    .grid .k { color: var(--muted); font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.03em; align-self: center; }
    .grid .full { grid-column: 2 / -1; }
    .sub { grid-column: 1 / -1; height: 1px; background: var(--border); margin: 4px 0; }
    .actions { display: flex; justify-content: flex-end; margin-top: 14px; }
    button.btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--fg); }
  `;

  constructor() {
    super();
    this._view = 'grimoire';
    this._modal = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKey = (e) => {
      if (e.key === 'Escape' && this._modal) { e.stopPropagation(); this._modal = null; }
      else if (e.key === 'Enter' && this._modal) { e.stopPropagation(); this._modal = null; }
    };
    document.addEventListener('keydown', this._onKey);
  }
  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKey);
    super.disconnectedCallback();
  }

  get ctx() { return this.model?.spells ?? null; }

  // Build the next spells block (pure inputs) and dispatch it up for saving.
  _emit(known, matrices) {
    this.dispatchEvent(new CustomEvent('ed-edit-spells', {
      detail: { spells: { known, matrices } }, bubbles: true, composed: true,
    }));
  }

  // Place into the first empty matrix, or release the matrix holding this spell.
  _toggleMatrix(name) {
    const ctx = this.ctx;
    const matrices = ctx.matrices.map((m) => ({ ...m }));
    const held = matrices.find((m) => m.spell === name);
    if (held) { held.spell = null; }
    else {
      const free = matrices.find((m) => !m.spell);
      if (!free) return; // no open matrix — no-op (v1)
      free.spell = name;
    }
    this._emit(ctx.known, matrices);
  }

  _remove(name) {
    const ctx = this.ctx;
    const known = ctx.known.filter((k) => k.name !== name);
    // releasing any matrix that held the removed spell keeps inputs consistent
    const matrices = ctx.matrices.map((m) => (m.spell === name ? { ...m, spell: null } : m));
    this._emit(known, matrices);
  }

  _openDetail(spell) { this._modal = spell; }

  render() {
    const ctx = this.ctx;
    const karma = this.model?.characteristics?.karma?.available;
    return html`
      <div class="top">
        <div class="seg">
          <button aria-pressed=${this._view === 'cast'} @click=${() => (this._view = 'cast')}>Cast</button>
          <button aria-pressed=${this._view === 'grimoire'} @click=${() => (this._view = 'grimoire')}>Grimoire</button>
        </div>
        ${karma != null ? html`<div class="kchip">Available Karma <b>${karma}</b></div>` : ''}
      </div>
      ${!ctx
        ? html`<div class="empty">This character has no spells — the Spells tab is for spellcasting Disciplines.</div>`
        : this._view === 'grimoire' ? this._grimoire(ctx) : this._castStub(ctx)}
      ${this._modal ? this._detailModal(this._modal) : ''}
    `;
  }

  _grimoire(ctx) {
    const grouped = knownByDisciplineCircle(ctx);
    const discs = Object.keys(grouped);
    if (!discs.length) return html`<div class="empty">No spells learnt yet.${this.editMode ? '' : ' Enter edit mode to learn spells.'}</div>`;
    return html`
      ${discs.map((disc) => html`
        <h4 class="circlelbl" style="color:var(--spell); font-size:var(--fs-small); letter-spacing:0.02em; margin-top:14px;">${disc}</h4>
        ${Object.keys(grouped[disc]).sort((a, b) => a - b).map((circle) => html`
          <div class="circlelbl">Circle ${circle}</div>
          <div class="card">
            <div class="srow h"><span></span><span>Spell</span><span class="num">Thr</span><span class="num">Weave</span><span>Cast</span><span>Matrix</span><span></span></div>
            ${grouped[disc][circle].map((s) => this._row(ctx, s))}
          </div>
        `)}
      `)}
    `;
  }

  _row(ctx, s) {
    const placed = !!matrixFor(ctx, s.name);
    const noFreeMatrix = !placed && !ctx.matrices.some((m) => !m.spell);
    return html`
      <div class="srow">
        <button class="info" title="Spell details" aria-label="Details for ${s.name}" @click=${() => this._openDetail(s)}>i</button>
        <span class="sname" title=${s.name}>${s.name}</span>
        <span class="num">${s.threadsToWeave}</span>
        <span class="num">${s.weavingDifficulty?.value ?? '—'}</span>
        <span class="mx">${this._castLabel(s.castingTarget)}</span>
        <button class="attn ${placed ? 'on' : ''}" ?disabled=${noFreeMatrix}
          title=${placed ? 'Release from matrix' : noFreeMatrix ? 'No open matrix' : 'Place in a matrix'}
          aria-label=${placed ? `Release ${s.name} from its matrix` : `Place ${s.name} in a matrix`}
          @click=${() => this._toggleMatrix(s.name)}>✦</button>
        ${this.editMode
          ? html`<button class="rm" title="Remove from grimoire" aria-label="Remove ${s.name}" @click=${() => this._remove(s.name)}>✕</button>`
          : html`<span></span>`}
      </div>`;
  }

  // Compact cast-target label for the tight column: TMD / a fixed number.
  _castLabel(target) {
    if (!target) return '—';
    if (/Mystic Defense/i.test(target)) return 'TMD';
    const n = target.match(/\d+/);
    return n ? n[0] : target;
  }

  _detailModal(s) {
    return html`
      <div class="overlay" @click=${() => (this._modal = null)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${s.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="nm">${s.name}</span>
            <span class="cr">${s.discipline} · Circle ${s.circle}</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._modal = null)}>✕</button>
          </div>
          ${s.summary ? html`<p class="msum">${s.summary}</p>` : ''}
          <div class="grid">
            <span class="k">Threads</span><span>${s.threadsToWeave}</span>
            <span class="k">Weaving</span><span>${s.weavingDifficulty?.value ?? '—'}${s.weavingDifficulty?.reattune ? ` / ${s.weavingDifficulty.reattune}` : ''}</span>
            <span class="k">Casting</span><span>${s.castingTarget ?? '—'}</span>
            <span class="k">Range</span><span>${s.range ?? '—'}</span>
            <span class="k">Duration</span><span>${s.duration ?? '—'}</span>
            <span class="k">Area</span><span>${s.area ?? '—'}</span>
            ${s.successes?.length ? html`<div class="sub"></div><span class="k">Success</span><span class="full">${s.successes.map((x) => x.label).join('; ')}</span>` : ''}
            ${s.extraThreads?.length ? html`<span class="k">Extra</span><span class="full">${s.extraThreads.map((x) => x.label).join('; ')}</span>` : ''}
          </div>
          <div class="actions"><button class="btn" @click=${() => (this._modal = null)}>Close</button></div>
        </div>
      </div>`;
  }

  // Cast workspace lands in phase 8.6a.
  _castStub(ctx) {
    const attuned = castTypeList(ctx, 'matrix');
    return html`
      <div class="empty">
        Cast workspace arrives next.
        ${attuned.length
          ? html`<br />Attuned &amp; ready: ${attuned.map((s) => s.name).join(', ')}.`
          : html`<br />No spells placed in a matrix yet — use the ✦ toggle in the Grimoire.`}
      </div>`;
  }
}

customElements.define('ed-spells', EdSpells);
