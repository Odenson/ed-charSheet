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
import { knownByDisciplineCircle, castTypeList, matrixFor, castPlan, effectStepBonus } from '../engine/spells.js';
import { successCount } from '../engine/combat.js';

// Per-character cast-workspace scratchpad, kept in module memory so the in-flight
// cast (selection, target, subject, weave/cast/effect progress) survives a tab
// switch — ed-app renders only the active tab, so this element is destroyed and
// rebuilt each time. Keyed by characterId; a character switch starts fresh and a
// full reload clears it. Session-only UI state, never persisted to the character.
const SCRATCH = new Map();

export class EdSpells extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    arming: { attribute: false },
    characterId: { type: String },
    _view: { state: true },
    _modal: { state: true },
    _castType: { state: true },
    _selSpell: { state: true },
    _target: { state: true },
    _subject: { state: true },
    _castErr: { state: true },
    _prog: { state: true },
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
      --danger: light-dark(#a63a2b, #e0846f);
      --amber: light-dark(#8a5a12, #e0a94e);
      --amber-bg: light-dark(#f6ecd9, #3a2f17);
      display: block;
    }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .seg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
    .seg button { border: none; background: none; padding: 6px 16px; border-radius: 999px; font: inherit; font-size: var(--fs-body); color: var(--muted); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .kchip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
    .kchip b { color: var(--karma); font-weight: 500; }
    .initpill { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-fine); color: var(--muted); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 999px; padding: 3px 6px 3px 10px; }
    .initpill b { color: var(--fg); font-weight: 500; font-variant-numeric: tabular-nums; }
    .initbtn { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--karma); background: var(--karma-bg); color: var(--karma); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--fs-fine); padding: 0; flex: none; }
    .initbtn:disabled { opacity: 0.4; cursor: default; }

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
    /* Fixed-height, internally-scrolling list — the Raw list is ~123 spells, so
       it must not grow the page (UI-GUIDELINES: no runaway vertical scroll). */
    .slist2 { background: var(--bg-card); border-radius: 8px; overflow-y: auto; max-height: 340px; }
    .sitem { display: grid; grid-template-columns: 10px 1fr auto; gap: 8px; align-items: center; width: 100%; padding: 8px 11px; border: none; border-bottom: 1px solid var(--border); background: none; color: var(--fg); font: inherit; font-size: var(--fs-small); cursor: pointer; text-align: left; }
    .sitem:last-child { border-bottom: none; }
    .sitem:hover { background: var(--bg-chip); }
    .sitem.on { background: var(--spell-bg); }
    .sitem .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--spell); opacity: 0; }
    .sitem.learnt .dot { opacity: 1; }
    .sitem .cr { font-size: var(--fs-eyebrow); color: var(--muted); }
    .listlegend { font-size: var(--fs-eyebrow); color: var(--muted); display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; }
    .listlegend .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--spell); display: inline-block; }
    .desc { margin-top: 12px; }
    .desc .body { background: var(--bg-card); border-radius: 8px; padding: 10px 12px; font-size: var(--fs-small); line-height: 1.5; min-height: 72px; }
    .casthead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 0 0 8px; }
    .casthead .nm { font-size: var(--fs-title); font-weight: 500; }
    .modeline { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
    .modeseg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
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
    .threads { font-size: var(--fs-eyebrow); font-weight: 500; color: var(--spell); background: var(--spell-bg); border-radius: 999px; padding: 0 7px; font-variant-numeric: tabular-nums; }
    .rollres { align-self: flex-end; text-align: right; font-size: var(--fs-eyebrow); color: var(--muted); font-variant-numeric: tabular-nums; }
    .modeseg button.soon { opacity: 0.5; cursor: not-allowed; }
    .modeseg .soontag { font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid var(--muted); border-radius: 999px; padding: 0 4px; margin-left: 4px; }
    .fold { font-size: var(--fs-fine); color: var(--spell); margin-top: 8px; display: flex; gap: 6px; align-items: baseline; }
    /* Active effects (Option A) — long-running self-cast effects with rounds left.
       Static now; phase 6b fills the list and the countdown. */
    .aehead { margin-top: 14px; }
    .aecard { background: var(--bg-card); border-radius: 8px; padding: 4px 11px; }
    .aeempty { font-size: var(--fs-fine); color: var(--muted); padding: 8px 2px; }
    .aerow { display: flex; align-items: center; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--border); }
    .aerow:last-child { border-bottom: none; }
    .aemark { color: var(--spell); font-size: var(--fs-small); flex: none; }
    .aemid { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .aename { font-size: var(--fs-small); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .aename .aefx { font-weight: 400; color: var(--muted); }
    .aebar { height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
    .aebar > i { display: block; height: 100%; border-radius: 999px; }
    .aerounds { flex: none; font-size: var(--fs-eyebrow); font-weight: 500; font-variant-numeric: tabular-nums; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
    .aerounds.ok { color: var(--karma); background: var(--karma-bg); }
    .aerounds.low { color: var(--amber); background: var(--amber-bg); }
    .pickrow { margin-top: 8px; background: var(--spell-bg); border: 1px solid var(--spell); border-radius: 8px; padding: 8px 10px; }
    .pickrow .plbl { font-size: var(--fs-fine); color: var(--spell); font-weight: 500; margin-bottom: 6px; }
    .pickopts { display: flex; gap: 6px; flex-wrap: wrap; }
    .pickbtn { font: inherit; font-size: var(--fs-fine); font-weight: 500; border: 1px solid var(--spell); background: var(--bg-chip); color: var(--spell); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
    .pickbtn:hover { background: var(--spell-bg); }
    .picksum { margin-top: 8px; font-size: var(--fs-fine); color: var(--muted); display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
    .pickchip { font-size: var(--fs-eyebrow); color: var(--spell); background: var(--spell-bg); border-radius: 999px; padding: 1px 8px; }
    .succrow { margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: var(--fs-fine); }
    .succn { font-size: var(--fs-eyebrow); font-weight: 500; color: var(--karma); background: var(--karma-bg); border-radius: 999px; padding: 1px 9px; font-variant-numeric: tabular-nums; }
    .succn.miss { color: var(--danger); background: light-dark(#f6e4e0, #3a2320); }
    .succfx { color: var(--spell); }
    .succfx b { font-weight: 500; }
    .succnone { color: var(--muted); }
  `;

  constructor() {
    super();
    this._view = 'cast';
    this._modal = null;
    this._castType = 'matrix';
    this._selSpell = null;
    this._target = null;
    this._subject = 'self';
    this._castErr = '';
    this._prog = this._blankProg();
    this._pendingStep = null; // which cast step a pending roll belongs to
    this._maxThreads = 0;     // weave cap for the in-flight cast
    this._lastRollId = null;  // dedupe Karma re-rolls of the same roll
  }

  // Per-cast progress: threads woven so far, the greying flags, and each step's
  // last roll result. Reset when the spell/cast-type changes or the Effect lands.
  _blankProg() {
    return { threadsWoven: 0, castDone: false, weave: null, cast: null, effect: null,
      extraPicks: [], pendingPick: false };
  }
  _resetProg() { this._prog = this._blankProg(); }

  connectedCallback() {
    super.connectedCallback();
    this._onKey = (e) => {
      if (e.key === 'Escape' && this._modal) { e.stopPropagation(); this._modal = null; }
      else if (e.key === 'Enter' && this._modal) { e.stopPropagation(); this._modal = null; }
    };
    document.addEventListener('keydown', this._onKey);
    // The shared roll modal reports each completed roll via ed-roll-logged
    // (composed → reaches document). We tag the step we just dispatched
    // (`_pendingStep`) so the result lands on the right cast step.
    this._onRollLogged = (e) => this._onRoll(e.detail);
    document.addEventListener('ed-roll-logged', this._onRollLogged);
  }
  disconnectedCallback() {
    // Tab switch destroys this element — stash the cast workspace so returning
    // restores it (ed-app renders only the active tab).
    this._saveScratch();
    document.removeEventListener('keydown', this._onKey);
    document.removeEventListener('ed-roll-logged', this._onRollLogged);
    super.disconnectedCallback();
  }

  // Restore the cached workspace on first render (characterId is set by then).
  firstUpdated() {
    this._restoreScratch();
  }

  updated(changed) {
    // A real character switch (non-null previous id changing) resets the
    // workspace, then restores the incoming character's own cache if any.
    if (changed.has('characterId')) {
      const prev = changed.get('characterId');
      if (prev != null && prev !== this.characterId) {
        this._resetWorkspace();
        this._restoreScratch();
      }
    }
  }

  _cloneProg(p) {
    return {
      ...p,
      extraPicks: [...(p.extraPicks ?? [])],
      weave: p.weave ? { ...p.weave } : null,
      cast: p.cast ? { ...p.cast } : null,
      effect: p.effect ? { ...p.effect } : null,
    };
  }

  _saveScratch() {
    if (!this.characterId) return;
    SCRATCH.set(this.characterId, {
      view: this._view,
      castType: this._castType,
      selSpell: this._selSpell,
      target: this._target,
      subject: this._subject,
      prog: this._cloneProg(this._prog),
    });
  }

  _restoreScratch() {
    const s = this.characterId ? SCRATCH.get(this.characterId) : null;
    if (!s) return;
    this._view = s.view;
    this._castType = s.castType;
    this._selSpell = s.selSpell;
    this._target = s.target;
    this._subject = s.subject;
    this._prog = this._cloneProg(s.prog);
  }

  _resetWorkspace() {
    this._view = 'cast';
    this._castType = 'matrix';
    this._selSpell = null;
    this._target = null;
    this._subject = 'self';
    this._prog = this._blankProg();
  }

  // Fold a completed roll into the cast progress for the step that dispatched it.
  // The modal re-fires ed-roll-logged for the SAME roll on a Karma re-roll
  // (same rollId, upserted) — so a thread is only counted on the first event of
  // a rollId; later events for that id just refresh the shown result.
  _onRoll(detail) {
    const step = this._pendingStep;
    if (!step || !detail?.result) return;
    const total = (detail.result.total ?? 0) + (detail.karmaResult?.total ?? 0);
    const res = { total, outcome: detail.outcome ?? null };
    const firstOfRoll = detail.rollId !== this._lastRollId;
    this._lastRollId = detail.rollId;
    if (step === 'weave') {
      if (!firstOfRoll) { this._prog = { ...this._prog, weave: res }; return; } // Karma re-roll
      const isExtra = this._prog.threadsWoven >= (this._reqThreads ?? 0);
      if (isExtra) {
        // An extra thread only counts on a SUCCESSFUL weave, and then must be
        // assigned one of the spell's Extra Thread options (§3.2 #2). A single
        // option auto-assigns; multiple options prompt a pick.
        if (!res.outcome?.ok) { this._prog = { ...this._prog, weave: res }; return; }
        const woven = Math.min(this._prog.threadsWoven + 1, this._maxThreads);
        const opts = this._weaveOptions ?? [];
        if (opts.length === 1) {
          this._prog = { ...this._prog, threadsWoven: woven, weave: res,
            extraPicks: [...this._prog.extraPicks, opts[0].label] };
        } else if (opts.length > 1) {
          this._prog = { ...this._prog, threadsWoven: woven, weave: res, pendingPick: true };
        } else {
          // No listed options — the thread still counts, nothing to assign.
          this._prog = { ...this._prog, threadsWoven: woven, weave: res };
        }
      } else {
        // A required thread powers the cast — a FAILED weave forges no thread,
        // so it never counts; only a successful weave advances the count.
        if (!res.outcome?.ok) { this._prog = { ...this._prog, weave: res }; return; }
        const woven = Math.min(this._prog.threadsWoven + 1, this._maxThreads);
        this._prog = { ...this._prog, threadsWoven: woven, weave: res };
      }
    } else if (step === 'cast') {
      // Success levels vs the target: 1 at the number, +1 per 5 over. Extra
      // successes (levels − 1) activate the spell's Success Levels effect (§3.2 #3).
      const levels = successCount(total, this._castTarget);
      this._prog = { ...this._prog, castDone: true, cast: { ...res, levels } };
      // A successful self-cast of a sustained spell activates it (6b): ed-app
      // adds it to the session active-effect set (fold + round countdown).
      if (levels >= 1 && this._castFoldsSelf) {
        this.dispatchEvent(new CustomEvent('ed-spell-activate', {
          detail: { name: this._castName, extraPicks: [...this._prog.extraPicks], successLevels: levels },
          bubbles: true, composed: true,
        }));
      }
    } else if (step === 'effect') {
      // Effect landing un-greys Weave + Cast for the next cast (owner rule).
      this._prog = { ...this._blankProg(), effect: res };
    }
  }

  // Assign the just-woven extra thread to one of the spell's Extra Thread options.
  _pickExtra(label) {
    this._prog = { ...this._prog, extraPicks: [...this._prog.extraPicks, label], pendingPick: false };
  }

  // Active effects (Option A): long-running self-cast effects with rounds left.
  // Reads model.spells.active — an array phase 6b will populate and count down
  // per Initiative roll: [{ name, effectLabel, roundsLeft, roundsTotal }]. Until
  // then the list is empty and the card shows its resting state.
  _activeEffects() {
    const active = this.ctx?.active ?? [];
    return html`
      <h4 class="circlelbl aehead">Active effects${active.length ? ` · ${active.length}` : ''}</h4>
      <div class="aecard">
        ${active.length
          ? active.map((e) => this._activeRow(e))
          : html`<div class="aeempty">No active effects. A sustained spell cast on this character will appear here with its rounds remaining.</div>`}
      </div>`;
  }

  _activeRow(e) {
    const counted = e.roundsLeft != null;
    const total = e.roundsTotal || e.roundsLeft || 1;
    const pct = counted ? Math.max(0, Math.min(100, Math.round((e.roundsLeft / total) * 100))) : 100;
    const low = counted && e.roundsLeft <= 3;
    return html`
      <div class="aerow">
        <span class="aemark">✦</span>
        <div class="aemid">
          <span class="aename">${e.name}${e.effectLabel ? html` <span class="aefx">· ${e.effectLabel}</span>` : ''}</span>
          <div class="aebar"><i style="width:${pct}%; background:${low ? 'var(--amber)' : 'var(--karma)'}"></i></div>
        </div>
        <span class="aerounds ${low ? 'low' : 'ok'}">${counted ? `${e.roundsLeft} rds` : 'active'}</span>
      </div>`;
  }

  // Cast-success visual: the number of success levels, and the Success Levels
  // effect the EXTRA successes activate (levels − 1, applied per §3.2 #3).
  _successBanner(plan, levels) {
    if (levels <= 0) {
      return html`<div class="succrow"><span class="succn miss">Miss</span><span class="succnone">no successes</span></div>`;
    }
    const extra = levels - 1;
    const fx = plan.successes?.[0]?.label ?? null;
    return html`
      <div class="succrow">
        <span class="succn">${levels} success${levels === 1 ? '' : 'es'}</span>
        ${extra > 0
          ? fx
            ? html`<span class="succfx">activates <b>${fx}</b>${extra > 1 ? html` ×${extra}` : ''}</span>`
            : html`<span class="succnone">+${extra} extra success${extra === 1 ? '' : 'es'} (no listed effect)</span>`
          : html`<span class="succnone">no extra successes</span>`}
      </div>`;
  }

  // Collapse the assigned extra-thread picks into { label, count } (stacks 1:1).
  _pickSummary(picks) {
    const counts = new Map();
    for (const l of picks) counts.set(l, (counts.get(l) ?? 0) + 1);
    return [...counts].map(([label, count]) => ({ label, count }));
  }

  get ctx() { return this.model?.spells ?? null; }

  get _initiative() { return this.model?.characteristics?.initiative ?? null; }

  // Roll Initiative — the round start/end signal (same action as the Combat tab).
  // ed-app treats an initiative roll as advancing the round (the trigger the
  // sustained self-cast countdown will consume, phase 6b).
  _rollInitiative() {
    const c = this._initiative;
    if (!c?.value) return;
    this.dispatchEvent(new CustomEvent('ed-roll', {
      detail: { label: 'Initiative', step: c.value, karma: this._karmaCtx(c.karma), kind: 'initiative' },
      bubbles: true, composed: true,
    }));
  }

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
          ${s.description || s.summary ? html`<p class="msum">${s.description ?? s.summary}</p>` : ''}
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

  // Learnt-spell names, for the Raw list's "learnt" marker.
  get _known() { return new Set((this.ctx?.known ?? []).map((k) => k.name)); }

  _selected() {
    const list = this._list;
    if (!list.length) return null;
    const found = list.find((s) => s.name === this._selSpell);
    return found ?? list[0];
  }

  _pickType(t) { this._castType = t; this._selSpell = null; this._target = null; this._castErr = ''; this._resetProg(); }
  _pickSpell(name) { this._selSpell = name; this._target = null; this._castErr = ''; this._resetProg(); }

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

  // Weave forges the required threads PLUS up to extraThreadCap extra threads
  // (§3.1) — Soul Armor (1 required, cap 1) can reach 2/1 before greying.
  _weaveMax(plan) { return plan.threadsToWeave + plan.extraThreadCap; }

  _rollWeave(plan) {
    if (this._prog.threadsWoven >= this._weaveMax(plan)) return; // at max (required + extra cap)
    if (this._prog.pendingPick) return; // must assign the last extra thread first
    this._pendingStep = 'weave';
    this._maxThreads = this._weaveMax(plan);
    this._reqThreads = plan.threadsToWeave;         // for the extra-thread test in _onRoll
    this._weaveOptions = plan.extraThreads ?? [];
    const disc = this._casterDisc(plan.discipline);
    const tw = disc?.talents?.find((t) => t.name === `Thread Weaving (${plan.discipline})`);
    this._dispatchRoll(`Weave — ${plan.name}`, plan.weavingStep, this._karmaCtx(tw?.karma), {
      difficulty: { value: plan.weavingDifficulty, win: 'Woven', lose: 'Failed' },
    });
  }

  _rollCast(plan) {
    if (this._prog.castDone) return; // already cast
    if (this._prog.threadsWoven < plan.threadsToWeave) return; // required threads not forged
    const target = this._target ?? this._defaultTarget(plan);
    if (target == null || Number.isNaN(Number(target))) {
      this._castErr = 'Enter a target number first';
      return;
    }
    this._castErr = '';
    this._pendingStep = 'cast';
    this._castTarget = Number(target); // for the success-level count in _onRoll
    this._castName = plan.name;        // for the self-cast activation in _onRoll
    this._castFoldsSelf = plan.foldsOnSelf && this._subject === 'self';
    const disc = this._casterDisc(plan.discipline);
    const sc = disc?.talents?.find((t) => t.name === 'Spellcasting');
    const who = this._subject === 'self' ? ' (on self)' : '';
    this._dispatchRoll(`Cast — ${plan.name}${who}`, plan.castingStep, this._karmaCtx(sc?.karma), {
      difficulty: { value: Number(target), win: 'Success', lose: 'Miss' },
    });
  }

  // Effect-step bonus from assigned extra threads + extra cast successes (the
  // engine computes it — the view only supplies the picks and success levels).
  _effectBonus(plan) {
    return effectStepBonus(plan, this._prog.extraPicks, this._prog.cast?.levels ?? 0);
  }

  // The Effect step resolves the cast and un-greys Weave + Cast for the next one
  // (owner rule). A step effect rolls the dice; a static/none effect just resets.
  _doEffect(plan) {
    if (!this._prog.castDone) return; // Effect waits for a completed cast
    if (plan.effect.kind === 'step' && plan.effect.step != null) {
      this._pendingStep = 'effect';
      this._dispatchRoll(`${plan.name} — Effect`, plan.effect.step + this._effectBonus(plan), null, {});
    } else {
      const total = plan.effect.kind === 'static' ? plan.effect.value : null;
      this._prog = { ...this._blankProg(),
        effect: { total, outcome: { word: plan.effect.kind === 'static' ? 'Applied' : 'Done', ok: true } } };
    }
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
          <h4 class="circlelbl">${this._castType === 'matrix' ? 'Attuned spells' : 'Spells'}${this._castType === 'raw' ? html`<span class="listlegend"><span class="dot"></span>learnt</span>` : ''}</h4>
          ${list.length
            ? html`<div class="slist2">
                ${list.map((s) => html`
                  <button class="sitem ${s.name === (sel?.name) ? 'on' : ''} ${this._known.has(s.name) ? 'learnt' : ''}" @click=${() => this._pickSpell(s.name)}>
                    <span class="dot" title=${this._known.has(s.name) ? 'Learnt' : ''}></span><span class="sname">${s.name}</span><span class="cr">C${s.circle}</span>
                  </button>`)}
              </div>`
            : html`<div class="empty">${this._castType === 'matrix' ? 'No spells placed in a matrix — use the ✦ toggle in the Grimoire.' : 'No spells available for this cast type.'}</div>`}
          ${sel ? html`<div class="desc"><h4 class="circlelbl">Description</h4><div class="body">${sel.description ?? sel.summary ?? '—'}</div></div>` : ''}
        </div>
        <div>${plan ? this._castPanel(plan) : html`<div class="empty">Pick a spell to cast.</div>`}</div>
      </div>
    `;
  }

  // A step's last-roll readout (bottom-right): "rolled N", at label font size.
  _rollRes(res) {
    if (!res || res.total == null) return '';
    return html`<span class="rollres">rolled ${res.total}</span>`;
  }

  _castPanel(plan) {
    const target = this._target ?? this._defaultTarget(plan);
    const forge = plan.threadsToWeave > 0;
    const prog = this._prog;
    const weaveMaxed = prog.threadsWoven >= this._weaveMax(plan);
    // The cast is gated on the REQUIRED threads being forged (plan.threadsToWeave
    // is already net of any Enhanced/Armoured matrix hold, so a 0-thread or
    // matrix-held spell is met immediately). Effect waits for a completed cast.
    const threadsMet = prog.threadsWoven >= plan.threadsToWeave;
    const effBonus = this._effectBonus(plan);
    const effectLabel = plan.effect.kind === 'step' ? '⚄ Roll' : plan.effect.kind === 'static' ? `Apply +${plan.effect.value}` : 'Done';
    return html`
      <div class="casthead">
        <span class="nm">${plan.name}</span>
        <span class="cr" style="font-size:var(--fs-small);background:var(--spell-bg);color:var(--spell);border-radius:999px;padding:1px 9px;">Circle ${plan.circle} · ${this._castType}</span>
      </div>
      <div class="modeline">
        <div class="modeseg">
          <button class="on">Step-by-step</button>
          <button class="soon" disabled title="Guided auto-chaining — coming soon">Guided <span class="soontag">soon</span></button>
        </div>
        ${this._initiative
          ? html`<div class="initpill">Initiative <b>${this._initiative.value ?? '—'}</b>
              <button class="initbtn" ?disabled=${!this._initiative.value} title="Roll initiative — starts a new round" aria-label="Roll initiative" @click=${this._rollInitiative}>⚄</button>
            </div>`
          : ''}
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
          <span class="lab">Weave ${forge ? html`<span class="threads" title="Threads woven / required">${prog.threadsWoven}/${plan.threadsToWeave}</span>` : ''}</span>
          ${forge
            ? html`<button class="rollbtn" ?disabled=${weaveMaxed || prog.pendingPick} @click=${() => this._rollWeave(plan)}>⚄ Roll</button>
                   <span class="stepnote">Step ${plan.weavingStep ?? '—'} vs ${plan.weavingDifficulty ?? '—'}</span>
                   ${this._rollRes(prog.weave)}`
            : html`<span class="readout">—</span><span class="stepnote">No threads to forge</span>`}
        </div>
        <div class="step ${!threadsMet ? 'skip' : ''}">
          <span class="lab">Cast</span>
          <button class="rollbtn" ?disabled=${prog.castDone || !threadsMet} @click=${() => this._rollCast(plan)}>⚄ Roll</button>
          <span class="stepnote">${!threadsMet ? 'Weave the thread first' : `Step ${plan.castingStep ?? '—'} vs ${target ?? 'TMD'}`}</span>
          ${this._rollRes(prog.cast)}
        </div>
        <div class="step ${!prog.castDone ? 'skip' : ''}">
          <span class="lab">Effect</span>
          <button class="rollbtn" ?disabled=${!prog.castDone} @click=${() => this._doEffect(plan)}>${effectLabel}</button>
          <span class="stepnote">${plan.effect.kind === 'step'
            ? (effBonus > 0 ? `Step ${plan.effect.step} +${effBonus} = ${plan.effect.step + effBonus}` : `Step ${plan.effect.step ?? '—'}`)
            : plan.effect.kind === 'static' ? plan.effect.label : 'See description'}</span>
          ${this._rollRes(prog.effect)}
        </div>
      </div>

      ${prog.cast && prog.cast.levels != null ? this._successBanner(plan, prog.cast.levels) : ''}

      ${prog.pendingPick
        ? html`<div class="pickrow">
            <div class="plbl">Extra thread woven — assign it to an effect:</div>
            <div class="pickopts">
              ${(plan.extraThreads ?? []).map((o) => html`<button class="pickbtn" @click=${() => this._pickExtra(o.label)}>${o.label}</button>`)}
            </div>
          </div>`
        : ''}
      ${prog.extraPicks.length
        ? html`<div class="picksum"><span>Extra threads:</span>${this._pickSummary(prog.extraPicks).map((p) => html`<span class="pickchip">${p.label}${p.count > 1 ? ` ×${p.count}` : ''}</span>`)}</div>`
        : ''}

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

      ${this._activeEffects()}
    `;
  }
}

customElements.define('ed-spells', EdSpells);
