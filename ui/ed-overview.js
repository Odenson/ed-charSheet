// ui/ed-overview.js — the Overview tab: hero portrait + header, attributes,
// and the Defences/Armour/Movement/Health/Combat panels. Fit-to-viewport,
// collapses to one column on mobile. Derived stats show as placeholder pills
// until the engine computes them (see docs/UI-GUIDELINES.md).
import { LitElement, html, css, nothing } from 'lit';
import { applyHealth } from '../engine/health.js';

const ABBR = { Dexterity: 'DEX', Strength: 'STR', Toughness: 'TOU', Perception: 'PER', Willpower: 'WIL', Charisma: 'CHA' };

export class EdOverview extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { attribute: false },
    _modal: { state: true },
    _lightbox: { state: true },
    _edit: { state: true },
    _portraitBroken: { state: true },
    _healthModal: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      /* Karma semantic colour (Sage) — distinct from the amber general accent. */
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
      display: block;
    }
    .grid { display: grid; grid-template-columns: 250px 1fr; gap: 12px; align-items: stretch; }
    .hero { display: flex; flex-direction: column; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .details { flex: 1; border-radius: 6px; }
    /* Edit mode: the details block (name/meta) and the blurb become click-to-edit
       regions. A faint dashed outline signals "editable"; it brightens on hover/
       focus. Outline never reflows, so read-mode layout is untouched. */
    .editable { cursor: pointer; outline: 1px dashed var(--border); outline-offset: 3px; transition: outline-color 0.15s ease, background 0.15s ease; }
    .editable:hover, .editable:focus-visible { outline-color: var(--accent); background: var(--accent-bg); }
    .name { font-size: 1.25rem; font-weight: 500; line-height: 1.1; }
    .meta { font-size: 0.75rem; color: var(--muted); margin-top: 1px; }
    .discs { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
    .dtile { font-size: 0.72rem; font-weight: 500; padding: 3px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); white-space: nowrap; }
    .blurb { font-size: 0.75rem; color: var(--muted); font-style: italic; margin-top: 6px; line-height: 1.35; }
    .portrait { flex: 1; min-height: 160px; margin-top: 8px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--bg-card); display: flex; align-items: center; justify-content: center; }
    .portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .portrait .ph { color: var(--muted); font-size: 2rem; }
    /* Mobile-only avatar in the header (desktop uses the large .portrait). */
    .avatar { display: none; flex: none; width: 52px; height: 52px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; }
    .lightbox-img { max-width: 92vw; max-height: 88vh; border-radius: 12px; object-fit: contain; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); }
    .right { display: flex; flex-direction: column; gap: 8px; }
    .blk { background: var(--bg-card); border-radius: 8px; padding: 8px 10px; }
    .blk h4 { margin: 0 0 6px; font-size: 0.62rem; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .agrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .acell { background: var(--bg-chip); border-radius: 8px; padding: 5px 8px; }
    .acell .an { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; }
    .acell .r { display: flex; align-items: center; gap: 5px; margin-top: 1px; }
    .acell .av { font-size: 1rem; font-weight: 500; line-height: 1; }
    .acell .asd { font-size: 0.62rem; color: var(--muted); }
    .roll { margin-left: auto; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.7rem; flex: none; padding: 0; }
    .roll.km { border-color: var(--karma); background: var(--karma-bg); color: var(--karma); }
    .kmark { color: var(--karma); }
    .roll:disabled { opacity: 0.35; cursor: default; border-color: var(--border); background: none; color: var(--muted); }
    /* Top row: attributes (compacted) beside the Legend panel, sharing one height. */
    .toprow { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 8px; align-items: stretch; }
    .legend { display: flex; flex-direction: column; }
    /* Sized so the Attributes/Legend row keeps its original ~130px height — the
       total's font and the panel's internal spacing are tuned to fit, not grow. */
    .legend h4 { margin-bottom: 3px; }
    .ltotal { text-align: center; padding: 1px 0 2px; }
    .ltotal .lnum { display: block; font-size: 1.25rem; font-weight: 500; line-height: 1; }
    .ltotal .lsub { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .llines { border-top: 1px solid var(--border); padding-top: 4px; margin-top: auto; }
    .legend .line { padding: 0; }
    .lstatus { font-size: 0.72rem; font-weight: 500; padding: 1px 9px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); }
    .panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; flex: 1; }
    .stack { display: flex; flex-direction: column; gap: 8px; justify-content: space-between; }
    .line { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 0.8rem; }
    .line .rl { display: flex; align-items: center; gap: 6px; }
    .pend { font-size: 0.68rem; color: var(--muted); background: var(--bg-chip); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 7px; }
    /* Health panel: the heading carries the standing chip + the take-damage/hurt
       affordance; edit-mode rows swap to small number fields. */
    .hhead { display: flex; align-items: center; gap: 6px; }
    .hstate { font-size: 0.6rem; font-weight: 500; padding: 1px 8px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); white-space: nowrap; }
    .hstate.warn { background: var(--accent-bg); color: var(--accent); }
    .hstate.bad { background: light-dark(#f6e4e0, #3a2320); color: light-dark(#a63a2b, #e0846f); }
    .hfield { width: 46px; font: inherit; font-size: 0.8rem; font-weight: 500; color: light-dark(#111418, #f0f3f7); background: transparent; border: none; border-bottom: 1px solid var(--border); padding: 1px 0; outline: none; text-align: right; }
    .hfield:focus { border-bottom-color: var(--accent); }
    .hrow { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; }
    .hnum { width: 72px; font: inherit; font-size: 0.85rem; font-weight: 500; color: light-dark(#111418, #f0f3f7); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 8px; padding: 5px 9px; outline: none; text-align: right; }
    .hnum:focus { border-color: var(--accent); }
    .hbtn { font: inherit; font-size: 0.78rem; font-weight: 500; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); cursor: pointer; }
    .hbtn.plain { border-color: var(--border); background: none; color: var(--muted); }
    .hrec { margin-top: 9px; border-top: 1px solid var(--border); padding-top: 9px; width: 100%; }
    .hfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; gap: 8px; }
    .hint { font-size: 0.68rem; color: var(--muted); }
    .val { font-weight: 500; }
    .feat { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; font-size: 0.72rem; }
    .feat .txt { flex: 1; min-width: 0; line-height: 1.35; }
    .ftag { flex: none; margin-top: 1px; font-size: 0.6rem; font-weight: 500; padding: 1px 6px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); }
    .ftag.race { background: var(--accent-bg); color: var(--accent); }
    .info { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 0.85rem; padding: 0 0 0 3px; line-height: 1; vertical-align: -1px; opacity: 0; transition: opacity 0.15s ease; }
    /* Universal hover-reveal: ANY info icon stays hidden until you hover (or
       keyboard-focus) the element it sits in, so it never clutters the read view.
       The icon is placed as a child of the label it annotates, so hovering that
       label reveals it. Touch has no hover, so icons are always shown there
       (UI-GUIDELINES: mobile must work). */
    *:hover > .info, *:focus-within > .info, .info:focus-visible { opacity: 1; }
    @media (hover: none) { .info { opacity: 1; } }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
    .modal { background: var(--bg-chip); color: light-dark(#111418, #f0f3f7); border: 1px solid var(--border); border-radius: 12px; max-width: 32rem; max-height: 80vh; overflow: auto; padding: 1rem 1.25rem; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.5rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; }
    .mbody { font-size: 0.85rem; line-height: 1.5; color: var(--muted); }
    .mpara { margin: 0 0 0.6rem; }
    .mtrigger { border-top: 1px solid var(--border); padding-top: 0.6rem; margin-top: 0.2rem; }
    .mtlabel { font-weight: 500; color: light-dark(#111418, #f0f3f7); margin-bottom: 0.25rem; }
    .mtsummary { color: var(--accent); margin-bottom: 0.3rem; }
    .mtdesc { line-height: 1.5; }
    .meta-dl { margin: 0; }
    .meta-item { padding: 6px 0; border-bottom: 1px solid var(--border); }
    .meta-item:last-child { border-bottom: none; }
    .meta-item dt { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .meta-item dd { margin: 2px 0 0; font-size: 0.88rem; line-height: 1.45; color: light-dark(#111418, #f0f3f7); }
    /* Legend-spent modal: collapsible per-section breakdown + reconciliation footer. */
    .lspent-sec { border-bottom: 1px solid var(--border); }
    .lspent-sec > summary { display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; color: light-dark(#111418, #f0f3f7); padding: 6px 0; list-style: none; }
    .lspent-sec > summary::-webkit-details-marker { display: none; }
    .lspent-sec .sleft { display: flex; align-items: center; gap: 7px; }
    .lspent-sec .sleft::before { content: '▸'; color: var(--muted); font-size: 0.8em; transition: transform 0.12s ease; }
    .lspent-sec[open] > summary .sleft::before { transform: rotate(90deg); }
    .lspent-sec.additional > summary { color: var(--accent); }
    .sbadge { font-size: 0.6rem; font-weight: 500; padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); white-space: nowrap; }
    .sbadge.add { background: var(--accent-bg); color: var(--accent); }
    .lspent-sec .lines { padding: 0 0 6px 14px; }
    .lspent-sec .ldetail { color: var(--muted); font-size: 0.9em; }
    .lspent-recon { border-top: 2px solid var(--border); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 500; color: light-dark(#111418, #f0f3f7); }
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      .toprow { grid-template-columns: 1fr; }
      .portrait { display: none; }
      .avatar { display: block; }
    }
  `;

  _pend() { return html`<span class="pend">—</span>`; }

  // Wrap content as a click-to-edit region. Only interactive in edit mode; in
  // read mode it's an inert container (no outline, no focus, no handler effect),
  // so the read view stays clean. Opens the details form (Enter/Space too).
  _editRegion(cls, content) {
    const on = this.editMode;
    return html`<div
      class="${cls}${on ? ' editable' : ''}"
      role=${on ? 'button' : nothing}
      tabindex=${on ? '0' : nothing}
      aria-label=${on ? 'Edit character details' : nothing}
      title=${on ? 'Edit character details' : nothing}
      @click=${() => { if (this.editMode) this._edit = true; }}
      @keydown=${(e) => {
        if (this.editMode && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this._edit = true; }
      }}
    >${content}</div>`;
  }

  // Label a modifier by its exact source: an abbreviated discipline + circle
  // ("Arc 4", "Net 2" — matching the Special Features tags) or a race name, so
  // two same-value bonuses from different disciplines are distinguishable.
  _modLabel(m) {
    const o = m.origin;
    if (o?.kind === 'discipline') return `${o.name.slice(0, 3)} ${o.circle}`;
    if (o?.kind === 'race') return o.name ?? 'race';
    return m.source ?? '';
  }

  // The " +1 (Arc 4) +1 (Net 2)" fragment shared by every value tooltip.
  _modSummary(modifiers) {
    return (modifiers ?? [])
      .map((m) => {
        const sign = m.operation === 'subtract' ? '−' : m.operation === 'add' ? '+' : `${m.operation} `;
        const label = this._modLabel(m);
        return ` ${sign}${m.value}${label ? ` (${label})` : ''}`;
      })
      .join('');
  }

  // Render an engine-derived characteristic as a real number, or fall back to the
  // placeholder pill if the engine hasn't computed it (UI-GUIDELINES §5: never a
  // fabricated number). Hovering shows how the value was built (base + modifiers).
  _char(key) {
    const c = this.model?.characteristics?.[key];
    if (!c || c.value == null) return this._pend();
    const title = `Base ${c.base}${this._modSummary(c.modifiers)}`;
    return html`<span class="val" title=${title}>${c.value}</span>`;
  }

  // Carry / Lift: the carrying capacity, and the most that can be lifted without a
  // Strength test (2× carry − 1). Both are engine-derived; the view only renders.
  _carryLift() {
    const c = this.model?.characteristics?.carryingCapacity;
    if (!c || c.value == null) return this._pend();
    const title = `Carry ${c.value} lb (base ${c.base}${this._modSummary(c.modifiers)}); lift up to ${c.lift} lb without a test (2× carry − 1)`;
    return html`<span class="val" title=${title}>${c.value} / ${c.lift}</span>`;
  }

  // A rollable combat step (Initiative, Knockdown): shows the engine-derived Step
  // and enables its roll button; falls back to the placeholder pill + disabled roll.
  _combatStep(key, label) {
    const c = this.model?.characteristics?.[key];
    if (!c || c.value == null) return html`${this._pend()}${this._rollBtn(label, null)}`;
    const title = `Step ${c.value} (base ${c.base}${this._modSummary(c.modifiers)})`;
    return html`<span class="val" title=${title}>${c.value}</span>${this._rollBtn(label, c.value, c.karma)}`;
  }

  // Karma: available points (max in the tooltip); the roll button rolls the D6 Karma die.
  _karma(label) {
    const k = this.model?.characteristics?.karma;
    if (!k) return html`${this._pend()}${this._rollBtn(label, null)}`;
    const title = `${k.available ?? '—'} of ${k.max ?? '—'} Karma · die D6`;
    return html`<span class="val" title=${title}>${k.available ?? k.max ?? '—'}</span>${this._rollBtn(label, k.step, null, true)}`;
  }
  // A roll button. Dispatches 'ed-roll' (caught by ed-app) with the step to roll.
  // Disabled when there's no step yet (e.g. engine-derived combat stats). If the
  // test is karma-eligible (`karma` grants present), passes a karma context so the
  // roll modal can offer an optional +D6 Karma die.
  _rollBtn(label, step, karma, km = false) {
    const disabled = step == null;
    const karmaCtx =
      karma?.grants?.length
        ? {
            grants: karma.grants,
            available: this.model?.characteristics?.karma?.available ?? null,
            step: this.model?.characteristics?.karma?.step ?? null,
          }
        : null;
    return html`<button
      class="roll ${km ? 'km' : ''}"
      ?disabled=${disabled}
      title=${disabled ? 'Step not yet available' : `Roll ${label}${karmaCtx ? ' (Karma available)' : ''}`}
      aria-label="Roll ${label}"
      @click=${(e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('ed-roll', { detail: { label, step, karma: karmaCtx }, bubbles: true, composed: true }));
      }}
    >⚄</button>`;
  }

  // --- Health (damage / wounds / recovery) ------------------------------------

  // The standing chip on the Health heading: "Conscious" (damaged but up),
  // "Unconscious", or "Dead". Nothing when unhurt or when ratings are missing
  // (no fabricated state — the chip would be a placeholder pill, not a guess).
  _healthChip() {
    const s = this.model?.healthState?.state;
    if (!s || s === 'unhurt') return '';
    const labels = { conscious: 'Conscious', unconscious: 'Unconscious', dead: 'Dead' };
    const cls = s === 'unconscious' ? 'warn' : s === 'dead' ? 'bad' : '';
    return html`<span class="hstate ${cls}" title=${this._healthTitle()}>${labels[s]}</span>`;
  }

  // Tooltip for the chip/Damage row: where the derived thresholds sit.
  _healthTitle() {
    const u = this.model?.characteristics?.unconsciousness?.value;
    const d = this.model?.characteristics?.death?.value;
    const parts = [];
    if (u != null) parts.push(`Unconscious at ${u}`);
    if (d != null) parts.push(`Death at ${d}`);
    return parts.join(' · ');
  }

  // Damage / Wounds rows: a number input in edit mode, the stored input otherwise.
  _healthField(key, current, label) {
    if (!this.editMode) return html`<span class="val">${current ?? 0}</span>`;
    return html`<input
      class="hfield"
      type="number"
      min="0"
      step="1"
      .value=${String(current ?? 0)}
      aria-label=${label}
      @change=${(e) => this._setHealth(key, Number(e.target.value))}
    />`;
  }

  // One health input changed (edit mode) — dispatch the input upward. The view
  // only clamps the bare input; everything else stays with the engine.
  _setHealth(key, v) {
    const n = Number.isFinite(v) ? Math.max(0, v) : 0;
    this.dispatchEvent(new CustomEvent('ed-edit-health', { detail: { [key]: n }, bubbles: true, composed: true }));
  }

  // Recoveries row: "used / max" — used is an input, max is the engine-derived
  // per-day Recovery Tests rating (a placeholder pill until the engine computes it).
  _recoveries(h) {
    const used = h.recoveriesUsed ?? 0;
    const max = this.model?.characteristics?.recoveries?.value;
    if (this.editMode) {
      return html`<span class="rl">
        <input
          class="hfield"
          type="number"
          min="0"
          step="1"
          .value=${String(used)}
          aria-label="Recovery tests used today"
          @change=${(e) => this._setHealth('recoveriesUsed', Number(e.target.value))}
        />
        <span>/ ${max ?? this._pend()}</span>
      </span>`;
    }
    return html`<span class="val" title="Recovery tests used today, of ${max ?? '?'} per day">${used} / ${max ?? this._pend()}</span>`;
  }

  // --- Damage modal (mid-session take/heal) -----------------------------------

  _openHealth() {
    const h = this.model?.resources?.health ?? {};
    // Draft carries the signed actions (take/heal) plus the absolute current
    // wounds and recovery-tests-used; open fresh each time.
    this._healthDraft = { take: 0, heal: 0, wounds: h.wounds ?? 0, used: h.recoveriesUsed ?? 0 };
    this._healthModal = true;
  }

  _applyHealthDraft() {
    const d = this._healthDraft ?? {};
    const cur = this.model?.resources?.health ?? {};
    const next = applyHealth(cur, {
      damage: (d.take ?? 0) - (d.heal ?? 0),
      wounds: (d.wounds ?? 0) - (cur.wounds ?? 0),
      recoveriesUsed: (d.used ?? 0) - (cur.recoveriesUsed ?? 0),
    });
    this.dispatchEvent(new CustomEvent('ed-edit-health', { detail: next, bubbles: true, composed: true }));
    this._healthModal = false;
  }

  // One-tap Recovery test: roll the open-ended Effect test at Toughness step
  // (reusing the roll modal) with an apply context; the app applies the result
  // to damage and records +1 Recovery test used. Close this modal to show the roll.
  _recoveryTest() {
    const tou = (this.model?.attributes ?? []).find((a) => a.name === 'Toughness');
    if (tou?.step == null) return;
    this.dispatchEvent(
      new CustomEvent('ed-roll', {
        detail: { label: 'Recovery test', step: tou.step, apply: { action: 'recovery-heal', label: 'Heal this amount' } },
        bubbles: true,
        composed: true,
      }),
    );
    this._healthModal = false;
  }

  _healthModalBody() {
    const h = this.model?.resources?.health ?? {};
    const st = this.model?.healthState;
    const d = this._healthDraft ?? {};
    const rating = (n) => (n == null ? this._pend() : html`${n}`);
    const stateWord =
      st?.state && st.state !== 'unhurt' ? html` · <b>${st.state === 'dead' ? 'Dead' : st.state === 'unconscious' ? 'Unconscious' : 'Conscious'}</b>` : '';
    const set = (k) => (e) => {
      d[k] = Math.max(0, Number(e.target.value) || 0);
    };
    return html`
      <p class="mpara">
        Current damage <b>${h.damage ?? 0}</b>${stateWord} — Unconscious
        ${rating(this.model?.characteristics?.unconsciousness?.value)} · Death
        ${rating(this.model?.characteristics?.death?.value)}
      </p>
      <div class="hrow"><span>Take damage</span><input class="hnum" type="number" min="0" step="1" .value=${d.take} aria-label="Damage to take" @input=${set('take')} /></div>
      <div class="hrow"><span>Heal</span><input class="hnum" type="number" min="0" step="1" .value=${d.heal} aria-label="Damage to heal" @input=${set('heal')} /></div>
      <div class="hrow"><span>Wounds</span><input class="hnum" type="number" min="0" step="1" .value=${d.wounds} aria-label="Current wounds" @input=${set('wounds')} /></div>
      <div class="hrow"><span>Recovery tests used</span><input class="hnum" type="number" min="0" step="1" .value=${d.used} aria-label="Recovery tests used today" @input=${set('used')} /></div>
      <button class="hbtn hrec" @click=${this._recoveryTest}>⚄ Recovery test — heals the result, uses one</button>
      <div class="hfoot">
        <span class="hint">Enter applies · Escape closes</span>
        <button class="hbtn" @click=${this._applyHealthDraft}>Apply</button>
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
      if (this._healthModal) this._closeHealthModal();
      if (this._modal) this._closeModal();
      if (this._lightbox) this._lightbox = false;
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  _openModal(title, body) { this._modal = { title, body }; }
  _closeModal() {
    // Drop keyboard focus from the trigger (the ⓘ button) so an Escape close ends
    // the same way a mouse close does. Otherwise the ⓘ keeps :focus-visible (the
    // blue ring) and stays hover-revealed after the modal is gone.
    this.renderRoot.activeElement?.blur();
    this._modal = null;
  }

  // The damage modal closes the same way as any other: drop focus from the ✚
  // trigger so an Escape close doesn't leave its :focus-visible ring behind.
  _closeHealthModal() {
    this.renderRoot.activeElement?.blur();
    this._healthModal = false;
  }

  // Modal body listing all character metadata (any field added to meta shows up).
  _metaBody() {
    const meta = this.model?.meta ?? {};
    const HIDE = new Set(['id', 'name', 'portrait', 'sourceSheetVersion']);
    const humanize = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
    const entries = Object.entries(meta).filter(([k, v]) => !HIDE.has(k) && v != null && v !== '');
    return html`
      <dl class="meta-dl">
        ${entries.map(
          ([k, v]) => html`<div class="meta-item"><dt>${humanize(k)}</dt><dd>${v}</dd></div>`,
        )}
      </dl>
    `;
  }

  // Character-specific traits related to a given ability (e.g. Gahad triggers).
  // A trait links via relatedTo: { type: 'ability', name }.
  _traitsFor(abilityName) {
    return (this.model.traits ?? []).filter(
      (t) => t.relatedTo?.type === 'ability' && t.relatedTo?.name === abilityName,
    );
  }

  // Modal body for a racial ability: the generic description plus any of this
  // character's linked traits (e.g. their particular Gahad trigger(s)).
  _abilityModalBody(a) {
    const traits = this._traitsFor(a.name);
    return html`
      ${a.summary ? html`<p class="mpara">${a.summary}</p>` : ''}
      ${traits.map(
        (t) => html`
          <div class="mtrigger">
            <div class="mtlabel">${t.name ?? "This character's trait"}</div>
            ${t.summary ? html`<div class="mtsummary">${t.summary}</div>` : ''}
            ${t.description ? html`<div class="mtdesc">${t.description}</div>` : ''}
          </div>
        `,
      )}
    `;
  }

  // Special features: racial abilities + discipline circle abilities that are
  // genuine features. Plain stat increases (defence/armour/health/attribute/test)
  // are omitted — the engine will surface those on the stats themselves.
  _specialFeatures() {
    const m = this.model;
    const race = m.meta?.race;
    const racial = m.racialAbilities ?? [];
    const STAT_INCREASE = new Set([
      'attribute-modifier',
      'defense-modifier',
      'armor-modifier',
      'characteristic-modifier',
      'test-modifier',
    ]);
    const discAbilities = (m.disciplines ?? []).flatMap((d) =>
      (d.abilities ?? [])
        .filter((ab) => !STAT_INCREASE.has(ab.type))
        .map((ab) => ({ tag: `${d.name.slice(0, 3)} ${ab.circle}`, summary: ab.summary, type: ab.type })),
    );
    if (!racial.length && !discAbilities.length) return html``;
    return html`
      <div class="blk">
        <h4>Special Features</h4>
        ${racial.map(
          (a) => html`
            <div class="feat">
              <span class="ftag race">${race}</span>
              <span class="txt"
                >${a.name}${a.summary || this._traitsFor(a.name).length
                  ? html`<button class="info" aria-label="About ${a.name}" title="Details" @click=${() => this._openModal(a.name, this._abilityModalBody(a))}>ⓘ</button>`
                  : ''}</span
              >
            </div>
          `,
        )}
        ${discAbilities.map(
          (a) => html`<div class="feat"><span class="ftag">${a.tag}</span><span class="txt">${a.type === 'grant-karma-use' ? html`<span class="kmark" title="Karma use">✦</span> ` : ''}${a.summary}</span></div>`,
        )}
      </div>
    `;
  }

  // Legend panel: total Legend earned (a stored input), the Legendary Status it
  // maps to (Renown + Reputation, engine-derived from rules/legend.json), and the
  // available points to spend (derived: totalEarnt − totalSpent). Anything not yet
  // available falls back to the placeholder pill (UI-GUIDELINES §5).
  _legend() {
    const l = this.model?.legend;
    const num = (n) => (n == null ? this._pend() : html`<span class="val">${n.toLocaleString()}</span>`);
    const status = l?.status;
    return html`
      <div class="blk legend">
        <h4>
          Legend${status
            ? html`<button class="info" aria-label="About Legendary Status" title="Legendary Status" @click=${() => this._openModal('Legendary Status', this._legendModalBody(l))}>ⓘ</button>`
            : ''}
        </h4>
        <div class="ltotal">
          ${l?.totalEarnt != null
            ? html`<span class="lnum" title="Total Legend Points earned">${l.totalEarnt.toLocaleString()}</span>`
            : html`<span class="lnum">${this._pend()}</span>`}
          <span class="lsub">total earned</span>
        </div>
        <div class="llines">
          <div class="line">
            <span>Status</span>
            ${status ? html`<span class="lstatus">${status.label}</span>` : this._pend()}
          </div>
          <div class="line">
            <span>Renown / Rep</span>
            ${status
              ? html`<span class="val" title="Renown ${status.renown}, Reputation bonus ${status.reputation >= 0 ? '+' : ''}${status.reputation}">${status.renown} / ${status.reputation >= 0 ? '+' : ''}${status.reputation}</span>`
              : this._pend()}
          </div>
          <div class="line">
            <span>Available${l?.spent
              ? html`<button class="info" aria-label="Legend spent breakdown" title="Legend spent" @click=${() => this._openModal('Legend spent', this._legendSpentModalBody(l.spent))}>ⓘ</button>`
              : ''}</span>
            ${num(l?.available)}
          </div>
        </div>
      </div>
    `;
  }

  // Modal body: the Legend-spent audit — each advancement priced against the ED4
  // cost tables, grouped into sections, with a reconciliation footer comparing the
  // modeled total to the recorded figure. Each section is a collapsible <details>
  // (default closed — the summaries give a compact overview of a long list), and
  // talents are grouped per Discipline so the additional-Discipline surcharge stands
  // out (an accent "Nth Discipline" badge on the 2nd+ Discipline sections).
  _legendSpentModalBody(spent) {
    const fmt = (n) => (n == null ? '—' : n.toLocaleString());
    return html`
      <p class="mpara">
        Legend spent, reconstructed from the sheet by pricing each advancement against
        the cost tables — attributes, talents (2nd+ Discipline talents cost more), skills,
        knacks, and woven thread items. Spells arrive in a later phase — the delta below
        is what this audit does not yet account for.
      </p>
      ${spent.sections.map(
        (sec) => html`
          <details class="lspent-sec${sec.additional ? ' additional' : ''}">
            <summary class="sechead">
              <span class="sleft"
                >${sec.label}${sec.kind === 'talents'
                  ? html`<span class="sbadge ${sec.additional ? 'add' : ''}">${sec.ordinalLabel} Discipline</span>`
                  : ''}</span
              >
              <span class="sval">${fmt(sec.total)}</span>
            </summary>
            <div class="lines">
              ${sec.lines.length
                ? sec.lines.map(
                    (li) => html`<div class="line"><span>${li.name} <span class="ldetail">${li.detail}</span></span><span>${fmt(li.cost)}</span></div>`,
                  )
                : html`<div class="line"><span class="ldetail">Nothing purchased</span><span>0</span></div>`}
            </div>
          </details>
        `,
      )}
      <div class="lspent-recon">
        <div class="line"><span>Modeled total</span><span>${fmt(spent.total)}</span></div>
        <div class="line"><span>Recorded</span><span>${fmt(spent.recorded)}</span></div>
        <div class="line"><span>Unmodeled (delta)</span><span>${fmt(spent.delta)}</span></div>
      </div>
    `;
  }

  // Modal body: the four Legendary Status bands with the character's current band
  // highlighted, so the reader sees the whole ladder and where they stand.
  _legendModalBody(l) {
    const cur = l?.status?.label;
    return html`
      <p class="mpara">
        A character's total Legend earned places them in one band, which sets how the
        wider world regards them — a Renown value and a Reputation bonus.
      </p>
      ${(l?.bands ?? []).map(
        (b) => html`
          <div class="mtrigger">
            <div class="mtlabel">
              ${b.label === cur ? html`<span class="lstatus">${b.label}</span>` : b.label}
              — Renown ${b.renown}, Rep ${b.reputation >= 0 ? '+' : ''}${b.reputation}
            </div>
            <div class="mtdesc">
              ${b.maxLegend == null ? html`over ${(1000000).toLocaleString()} Legend` : html`up to ${b.maxLegend.toLocaleString()} Legend`}
              — ${b.definition}
            </div>
          </div>
        `,
      )}
    `;
  }

  // A fresh model may point at a working portrait URL again, so reset the
  // broken-image flag whenever the character changes.
  update(changedProperties) {
    if (changedProperties.has('model')) this._portraitBroken = false;
    super.update(changedProperties);
  }

  _portraitError() {
    // The branch image failed to load (offline, missing on the branch, …) —
    // fall back to the placeholder icon (docs/UI-GUIDELINES.md §6).
    this._portraitBroken = true;
  }

  render() {
    const m = this.model;
    if (!m) return html``;
    const meta = m.meta ?? {};
    const h = m.resources?.health ?? {};
    const metaLine = [meta.race, meta.sex, meta.age ? `Age ${meta.age}` : null].filter(Boolean).join(' · ');
    const portrait = m.portraitUrl && !this._portraitBroken ? m.portraitUrl : null;

    return html`
      <div class="grid">
        <div class="hero">
          <div class="head">
            ${portrait
              ? html`<img class="avatar" src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} title="View portrait" @error=${this._portraitError} @click=${() => (this._lightbox = true)} />`
              : ''}
            ${this._editRegion(
              'details',
              html`
                <div class="name">
                  ${meta.name ?? 'Unnamed'}${this.editMode
                    ? nothing
                    : html`<button
                        class="info"
                        title="Character details"
                        aria-label="Character details"
                        @click=${(e) => {
                          e.stopPropagation();
                          this._openModal(meta.name ?? 'Character details', this._metaBody());
                        }}
                      >ⓘ</button>`}
                </div>
                <div class="meta">${metaLine}</div>
              `,
            )}
            <div class="discs">
              ${(m.disciplines ?? []).map((d) => html`<span class="dtile">${d.name} ${d.circle}</span>`)}
            </div>
          </div>
          ${meta.description ? this._editRegion('blurb', meta.description) : ''}
          <div class="portrait">
            ${portrait
              ? html`<img src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} @error=${this._portraitError} />`
              : html`<span class="ph">▢</span>`}
          </div>
        </div>

        <div class="right">
          <div class="toprow">
            <div class="blk">
              <h4>Attributes</h4>
              <div class="agrid">
                ${(m.attributes ?? []).map(
                  (a) => html`
                    <div class="acell">
                      <div class="an">${ABBR[a.name] ?? a.name.slice(0, 3).toUpperCase()}</div>
                      <div class="r">
                        <span class="av">${a.value}</span>
                        <span class="asd">${a.step} · ${a.dice}</span>
                        ${this._rollBtn(a.name, a.step, a.karma)}
                      </div>
                    </div>
                  `,
                )}
              </div>
            </div>
            ${this._legend()}
          </div>

          <div class="panels">
            <div class="stack">
              <div class="blk">
                <h4>Defences</h4>
                <div class="line"><span>Physical</span>${this._char('physicalDefense')}</div>
                <div class="line"><span>Mystic</span>${this._char('mysticDefense')}</div>
                <div class="line"><span>Social</span>${this._char('socialDefense')}</div>
              </div>
              <div class="blk">
                <h4>Armour</h4>
                <div class="line"><span>Physical</span>${this._char('physicalArmor')}</div>
                <div class="line"><span>Mystic</span>${this._char('mysticArmor')}</div>
              </div>
              <div class="blk">
                <h4 class="hhead">
                  <span>Health</span>
                  ${this._healthChip()}
                  <button class="info" title="Take damage or heal" aria-label="Take damage or heal" @click=${() => this._openHealth()}>✚</button>
                </h4>
                <div class="line"><span>Damage</span>${this._healthField('damage', h.damage, 'Current damage')}</div>
                <div class="line"><span>Unconscious</span>${this._char('unconsciousness')}</div>
                <div class="line"><span>Death</span>${this._char('death')}</div>
                <div class="line"><span>Wound Threshold</span>${this._char('woundThreshold')}</div>
                <div class="line"><span>Wounds</span>${this._healthField('wounds', h.wounds, 'Current wounds')}</div>
                <div class="line"><span>Recoveries</span>${this._recoveries(h)}</div>
              </div>
              <div class="blk">
                <h4>Movement</h4>
                <div class="line"><span>Carry / Lift</span>${this._carryLift()}</div>
              </div>
            </div>
            <div class="stack" style="justify-content: flex-start">
              <div class="blk">
                <h4>Combat</h4>
                <div class="line"><span>Initiative</span><span class="rl">${this._combatStep('initiative', 'Initiative')}</span></div>
                <div class="line"><span>Knockdown</span><span class="rl">${this._combatStep('knockdown', 'Knockdown')}</span></div>
                <div class="line"><span>Karma</span><span class="rl">${this._karma('Karma')}</span></div>
              </div>
              ${this._specialFeatures()}
            </div>
          </div>
        </div>
      </div>
      ${this._healthModal
        ? html`
            <div class="overlay" @click=${this._closeHealthModal} @keydown=${(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this._applyHealthDraft();
              }
            }}>
              <div class="modal" @click=${(e) => e.stopPropagation()}>
                <div class="mhead">
                  <span>Damage</span>
                  <button class="mclose" aria-label="Close" @click=${this._closeHealthModal}>✕</button>
                </div>
                <div class="mbody">${this._healthModalBody()}</div>
              </div>
            </div>
          `
        : ''}
      ${this._modal
        ? html`
            <div class="overlay" @click=${this._closeModal}>
              <div class="modal" @click=${(e) => e.stopPropagation()}>
                <div class="mhead">
                  <span>${this._modal.title}</span>
                  <button class="mclose" aria-label="Close" @click=${this._closeModal}>✕</button>
                </div>
                <div class="mbody">${this._modal.body}</div>
              </div>
            </div>
          `
        : ''}
      ${this._lightbox && portrait
        ? html`<div class="overlay" @click=${() => (this._lightbox = false)}>
            <img class="lightbox-img" src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} @error=${this._portraitError} />
          </div>`
        : ''}
      ${this._edit
        ? html`<ed-edit-meta .meta=${meta} @close=${() => (this._edit = false)}></ed-edit-meta>`
        : ''}
    `;
  }
}

customElements.define('ed-overview', EdOverview);
