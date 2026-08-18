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
import { knownByDisciplineCircle, castTypeList, matrixFor, castPlan } from '../engine/spells.js';

export class EdSpells extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    arming: { attribute: false },
    _view: { state: true },
    _modal: { state: true },
    _castType: { state: true },
    _selSpell: { state: true },
    _castMode: { state: true },
    _target: { state: true },
    _subject: { state: true },
    _castErr: { state: true },
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

    /* cast workspace */
    .ctseg { display: flex; gap: 4px; flex-wrap: wrap; margin: 0 0 10px; }
    .ctseg button { border: 1px solid var(--border); background: var(--bg-chip); color: var(--muted); border-radius: 999px; padding: 4px 12px; font: inherit; font-size: var(--fs-small); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .ctseg button.on { border-color: var(--spell); background: var(--spell-bg); color: var(--spell); font-weight: 500; }
    .ctseg button.soon { opacity: 0.5; cursor: not-allowed; }
    .soontag { font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid var(--muted); border-radius: 999px; padding: 0 4px; }
    .cthint { font-size: var(--fs-fine); color: var(--muted); margin: 0 0 8px; min-height: 1.3em; }
    .layout { display: grid; grid-template-columns: 0.82fr 1fr; gap: 14px; align-items: start; }
    @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } .pipe { grid-template-columns: 1fr; } }
    .slist2 { background: var(--bg-card); border-radius: 8px; overflow: hidden; }
    .sitem { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; width: 100%; padding: 8px 11px; border: none; border-bottom: 1px solid var(--border); background: none; color: var(--fg); font: inherit; font-size: var(--fs-small); cursor: pointer; text-align: left; }
    .sitem:last-child { border-bottom: none; }
    .sitem:hover { background: var(--bg-chip); }
    .sitem.on { background: var(--spell-bg); }
    .sitem .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--spell); opacity: 0; }
    .sitem.att .dot { opacity: 1; }
    .sitem .cr { font-size: var(--fs-eyebrow); color: var(--muted); }
    .desc { margin-top: 12px; }
    .desc .body { background: var(--bg-card); border-radius: 8px; padding: 10px 12px; font-size: var(--fs-small); line-height: 1.5; min-height: 72px; }
    .casthead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
    .casthead .nm { font-size: var(--fs-title); font-weight: 500; }
    .modeseg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; margin: 0 0 10px; }
    .modeseg button { border: none; background: none; padding: 5px 12px; border-radius: 999px; font: inherit; font-size: var(--fs-small); color: var(--muted); cursor: pointer; }
    .modeseg button.on { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .subrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--fs-small); color: var(--muted); margin-bottom: 8px; }
    .subseg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
    .subseg button { border: none; background: var(--bg-chip); color: var(--muted); font: inherit; font-size: var(--fs-fine); padding: 3px 10px; cursor: pointer; }
    .subseg button.on { background: var(--spell-bg); color: var(--spell); font-weight: 500; }
    .tgt { width: 52px; font: inherit; font-size: var(--fs-value); font-weight: 500; text-align: center; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 3px 4px; }
    .err { color: var(--danger); font-size: var(--fs-fine); margin: 2px 0 0; }
    .pipe { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0 2px; }
    .step { background: var(--bg-card); border-radius: 8px; padding: 9px 10px; display: flex; flex-direction: column; gap: 7px; }
    .step .lab { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: flex; justify-content: space-between; gap: 6px; }
    .step .req { color: var(--spell); }
    .step.skip { opacity: 0.5; }
    .rollbtn { align-self: flex-start; font: inherit; font-size: var(--fs-small); font-weight: 500; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--karma); background: var(--karma-bg); color: var(--karma); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .rollbtn:disabled { opacity: 0.4; cursor: default; border-color: var(--border); background: none; color: var(--muted); }
    .stepnum { font-size: var(--fs-fine); color: var(--spell); }
    .readout { font-size: var(--fs-value); font-weight: 500; color: var(--fg); }
    .stepnote { font-size: var(--fs-fine); color: var(--muted); }
    .fold { font-size: var(--fs-fine); color: var(--spell); margin-top: 8px; display: flex; gap: 6px; align-items: baseline; }
  `;

  constructor() {
    super();
    this._view = 'grimoire';
    this._modal = null;
    this._castType = 'matrix';
    this._selSpell = null;
    this._castMode = 'guided';
    this._target = null;
    this._subject = 'self';
    this._castErr = '';
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
        : this._view === 'grimoire' ? this._grimoire(ctx) : this._castView(ctx)}
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

  // --- Cast workspace (phase 8.6a) ------------------------------------------

  get _list() { return castTypeList(this.ctx, this._castType); }

  _selected() {
    const list = this._list;
    if (!list.length) return null;
    const found = list.find((s) => s.name === this._selSpell);
    return found ?? list[0];
  }

  _pickType(t) { this._castType = t; this._selSpell = null; this._target = null; this._castErr = ''; }
  _pickSpell(name) { this._selSpell = name; this._target = null; this._castErr = ''; }

  // Default target number from a fixed castingTarget ("Fixed 6" / "6 or …"); a
  // TMD spell is entered at cast time (A7).
  _defaultTarget(plan) {
    const m = (plan?.castingTarget || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  // Build the shared roll modal's karma context from a derived talent (mirrors
  // ed-combat._karmaCtx) so Karma is offered pre-roll (A6).
  _karmaCtx(talentKarma) {
    const kc = this.model?.characteristics?.karma;
    if (!talentKarma?.grants?.length) return null;
    return { grants: talentKarma.grants, available: kc?.available ?? null, step: kc?.step ?? null };
  }

  _casterDisc(discipline) {
    return (this.model?.disciplines ?? []).find((d) => d.name === discipline) ?? null;
  }

  _dispatchRoll(label, step, karma, extra = {}) {
    if (step == null) return;
    this.dispatchEvent(new CustomEvent('ed-roll', {
      detail: { label, step, karma, ...extra }, bubbles: true, composed: true,
    }));
  }

  _rollWeave(plan) {
    const disc = this._casterDisc(plan.discipline);
    const tw = disc?.talents?.find((t) => t.name === `Thread Weaving (${plan.discipline})`);
    this._dispatchRoll(`Weave — ${plan.name}`, plan.weavingStep, this._karmaCtx(tw?.karma), {
      difficulty: { value: plan.weavingDifficulty, win: 'Woven', lose: 'Failed' },
    });
  }

  _rollCast(plan) {
    const target = this._target ?? this._defaultTarget(plan);
    if (target == null || Number.isNaN(Number(target))) {
      this._castErr = 'Enter a target number first';
      return;
    }
    this._castErr = '';
    const disc = this._casterDisc(plan.discipline);
    const sc = disc?.talents?.find((t) => t.name === 'Spellcasting');
    const who = this._subject === 'self' ? ' (on self)' : '';
    this._dispatchRoll(`Cast — ${plan.name}${who}`, plan.castingStep, this._karmaCtx(sc?.karma), {
      difficulty: { value: Number(target), win: 'Success', lose: 'Miss' },
    });
  }

  _rollEffect(plan) {
    if (plan.effect.kind !== 'step' || plan.effect.step == null) return;
    this._dispatchRoll(`${plan.name} — Effect`, plan.effect.step, null, {});
  }

  _castView(ctx) {
    const TYPES = [
      { id: 'matrix', label: 'Matrix', hint: 'Spells placed in a Standard matrix — the matrix holds no threads, so the weave still happens on cast.' },
      { id: 'grimoire', label: 'Grimoire', hint: 'Any spell learnt in your grimoire.' },
      { id: 'raw', label: 'Raw', hint: 'Raw magic — any spell in your Disciplines’ lists, no matrix buffer.' },
    ];
    const list = this._list;
    const sel = this._selected();
    const plan = sel ? castPlan(ctx, sel.name, this._castType) : null;
    const hint = TYPES.find((t) => t.id === this._castType)?.hint ?? '';
    return html`
      <div class="ctseg">
        ${TYPES.map((t) => html`<button class=${this._castType === t.id ? 'on' : ''} @click=${() => this._pickType(t.id)}>${t.label}</button>`)}
        <button class="soon" disabled title="Cast from a magic item’s built-in matrix — planned">Item <span class="soontag">soon</span></button>
      </div>
      <p class="cthint">${hint}</p>
      <div class="layout">
        <div>
          <h4 class="circlelbl">${this._castType === 'matrix' ? 'Attuned spells' : 'Spells'}</h4>
          ${list.length
            ? html`<div class="slist2">
                ${list.map((s) => html`
                  <button class="sitem ${s.name === (sel?.name) ? 'on' : ''} ${matrixFor(ctx, s.name) ? 'att' : ''}" @click=${() => this._pickSpell(s.name)}>
                    <span class="dot"></span><span class="sname">${s.name}</span><span class="cr">C${s.circle}</span>
                  </button>`)}
              </div>`
            : html`<div class="empty">${this._castType === 'matrix' ? 'No spells placed in a matrix — use the ✦ toggle in the Grimoire.' : 'No spells available for this cast type.'}</div>`}
          ${sel ? html`<div class="desc"><h4 class="circlelbl">Description</h4><div class="body">${sel.summary ?? '—'}</div></div>` : ''}
        </div>
        <div>${plan ? this._castPanel(plan) : html`<div class="empty">Pick a spell to cast.</div>`}</div>
      </div>
    `;
  }

  _castPanel(plan) {
    const target = this._target ?? this._defaultTarget(plan);
    const forge = plan.threadsToWeave > 0;
    const guided = this._castMode === 'guided';
    return html`
      <div class="casthead">
        <span class="nm">${plan.name}</span>
        <span class="cr" style="font-size:var(--fs-small);background:var(--spell-bg);color:var(--spell);border-radius:999px;padding:1px 9px;">Circle ${plan.circle} · ${this._castType}</span>
      </div>
      <div class="modeseg">
        <button class=${guided ? 'on' : ''} @click=${() => (this._castMode = 'guided')}>Guided</button>
        <button class=${!guided ? 'on' : ''} @click=${() => (this._castMode = 'steps')}>Step-by-step</button>
      </div>

      <div class="subrow">
        <span>Cast on</span>
        <span class="subseg">
          <button class=${this._subject === 'self' ? 'on' : ''} @click=${() => (this._subject = 'self')}>This character</button>
          <button class=${this._subject === 'other' ? 'on' : ''} @click=${() => (this._subject = 'other')}>Other</button>
        </span>
        <span>vs</span>
        <input class="tgt" type="number" min="1" .value=${target ?? ''} placeholder="TMD"
          aria-label="Target number" @input=${(e) => { this._target = e.target.value === '' ? null : Number(e.target.value); this._castErr = ''; }}>
        <span>${/Mystic Defense/i.test(plan.castingTarget || '') ? "target’s Mystic Defense" : plan.castingTarget}</span>
      </div>
      ${this._castErr ? html`<p class="err">${this._castErr}</p>` : ''}

      <div class="pipe">
        <div class="step ${forge ? '' : 'skip'}">
          <span class="lab">${guided ? html`<span class="stepnum">1</span> ` : ''}Weave ${forge ? html`<span class="req">${plan.threadsToWeave}</span>` : ''}</span>
          ${forge
            ? html`<button class="rollbtn" @click=${() => this._rollWeave(plan)}>⚄ Roll</button>
                   <span class="stepnote">Step ${plan.weavingStep ?? '—'} vs ${plan.weavingDifficulty ?? '—'}</span>`
            : html`<span class="readout">—</span><span class="stepnote">No threads to forge</span>`}
        </div>
        <div class="step">
          <span class="lab">${guided ? html`<span class="stepnum">2</span> ` : ''}Cast</span>
          <button class="rollbtn" @click=${() => this._rollCast(plan)}>⚄ Roll</button>
          <span class="stepnote">Step ${plan.castingStep ?? '—'} vs ${target ?? 'TMD'}</span>
        </div>
        <div class="step ${plan.effect.kind === 'step' ? '' : 'skip'}">
          <span class="lab">${guided ? html`<span class="stepnum">3</span> ` : ''}Effect</span>
          ${plan.effect.kind === 'step'
            ? html`<button class="rollbtn" @click=${() => this._rollEffect(plan)}>⚄ Roll</button>
                   <span class="stepnote">Step ${plan.effect.step ?? '—'}</span>`
            : plan.effect.kind === 'static'
              ? html`<span class="readout">+${plan.effect.value}</span><span class="stepnote">${plan.effect.label}</span>`
              : html`<span class="readout">—</span><span class="stepnote">See description</span>`}
        </div>
      </div>

      ${plan.foldsOnSelf && this._subject === 'self'
        ? html`<p class="fold"><span>✦</span> On a success this sustained effect applies to this character while active. (Live fold + countdown lands in a follow-up.)</p>`
        : ''}

      <div class="grid" style="margin-top:12px;">
        <span class="k">Effect</span><span>${plan.effect.kind === 'static' ? `+${plan.effect.value} ${plan.effect.label}` : plan.effect.kind === 'step' ? `Step ${plan.effect.step ?? '—'}` : '—'}</span>
        <span class="k">Threads</span><span>${plan.threadsRequired}</span>
        <span class="k">Duration</span><span>${plan.duration ?? '—'}</span>
        <span class="k">Range</span><span>${plan.range ?? '—'}</span>
        <span class="k">Area</span><span>${plan.area ?? '—'}</span>
        <span class="k">Extra cap</span><span>${plan.extraThreadCap}</span>
        ${plan.successes?.length ? html`<div class="sub"></div><span class="k">Success</span><span class="full">${plan.successes.map((x) => x.label).join('; ')}</span>` : ''}
        ${plan.extraThreads?.length ? html`<span class="k">Extra</span><span class="full">${plan.extraThreads.map((x) => x.label).join('; ')}</span>` : ''}
      </div>
    `;
  }
}

customElements.define('ed-spells', EdSpells);
