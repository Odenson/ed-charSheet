// ui/ed-disciplines.js — the Disciplines tab: a toggle between the character's
// disciplines, each showing its detail, talents (with step/dice) and per-circle
// abilities. Talents live here (there is no separate Talents tab).
//
// Each talent carries one merged control: a small circle that shows whether the
// talent is a required Discipline Talent (filled) or a chosen Talent Option
// (outline) AND is the info button — clicking it opens a paraphrased detail
// modal. A terse Effect column summarises what the talent does (hidden on mobile,
// where the detail is a tap away). All talent wording is our own generic
// paraphrase (rules/talents.json), never verbatim rulebook prose.
import { LitElement, html, css } from 'lit';

export class EdDisciplines extends LitElement {
  static properties = {
    model: { attribute: false },
    _sel: { state: true },
    _modal: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
      display: block;
    }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
    .seg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
    .seg button { border: none; background: none; padding: 6px 16px; border-radius: 999px; font: inherit; font-size: 0.85rem; color: var(--muted); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); }
    .circle { font-size: 0.72rem; padding: 2px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); }
    /* Durability fits its label, Half-magic grows into the freed space, Artisan
       keeps its natural content width. */
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .mcell { background: var(--bg-card); border-radius: 8px; padding: 6px 9px; }
    .mcell.dur { flex: 0 0 auto; }
    .mcell.half { flex: 1 1 200px; min-width: 0; }
    .mcell.art { flex: 0 0 auto; }
    .mcell .k { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .mcell .v { font-size: 0.8rem; margin-top: 1px; }
    .card { background: var(--bg-card); border-radius: 8px; padding: 8px 10px; }
    h4 { margin: 0 0 6px; font-size: 0.62rem; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .trow { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.3fr) 44px 100px 76px 24px; gap: 8px; align-items: center; font-size: 0.8rem; padding: 5px 0; border-bottom: 1px solid var(--border); }
    .trow:last-child { border-bottom: none; }
    .trow.h { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sd { font-size: 0.72rem; color: var(--muted); }
    .eff { font-size: 0.74rem; color: light-dark(#3a4250, #cbd3de); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tname { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
    .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .thpad { padding-left: 22px; }
    /* One control per talent: shows required (filled) vs optional (outline) AND is
       the info button that opens the detail modal. */
    .tinfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font: 500 italic 0.5rem/1 system-ui, sans-serif;
      transition: filter 0.12s ease, border-color 0.12s ease; }
    .tinfo.req { background: var(--accent); border: 1px solid var(--accent); color: var(--accent-bg); }
    .tinfo.opt { background: transparent; border: 1.5px solid var(--muted); color: var(--muted); box-sizing: border-box; }
    .tinfo:hover { filter: brightness(1.12); }
    .tinfo.opt:hover { border-color: var(--accent); color: var(--fg); }
    .tinfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
    .trow.opt .lbl, .trow.opt .num, .trow.opt .sd, .trow.opt .eff { color: var(--muted); }
    .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin: 0 0 6px; font-size: 0.62rem; color: var(--muted); }
    .legend .li { display: inline-flex; align-items: center; gap: 7px; }
    .legend .tinfo { cursor: default; }
    .roll { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.7rem; padding: 0; }
    .roll:disabled { opacity: 0.35; cursor: default; border-color: var(--border); background: none; color: var(--muted); }
    .abil { display: flex; gap: 10px; padding: 5px 0; font-size: 0.8rem; align-items: baseline; }
    .cbadge { font-size: 0.62rem; padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); flex: none; }
    .section-gap { margin-top: 14px; }

    /* Detail modal (Escape / backdrop / ✕ close), theme-aware. */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; max-width: 30rem; width: 100%; max-height: 85vh; overflow: auto; padding: 14px 16px; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
    .mtitle { display: inline-flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 500; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1rem; line-height: 1; cursor: pointer; }
    .mchips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { font-size: 0.62rem; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 2px 9px; }
    .chip.effc { color: var(--accent); background: var(--accent-bg); border-color: transparent; }
    .mtext { font-size: 0.82rem; line-height: 1.5; margin: 6px 0; }
    .mnote { font-size: 0.76rem; color: var(--karma); background: var(--karma-bg); border-radius: 6px; padding: 6px 9px; margin-top: 8px; }

    @media (max-width: 620px) {
      .trow { grid-template-columns: minmax(0, 1fr) 40px 92px 24px; }
      .trow .action, .effcol { display: none; }
      .meta { flex-direction: column; }
      .mcell.dur, .mcell.half, .mcell.art { flex: 1 1 auto; }
    }
  `;

  constructor() {
    super();
    this._sel = 0;
    this._modal = null;
    this._onKeydown = (e) => {
      if (e.key === 'Escape' && this._modal) { e.stopPropagation(); this._modal = null; }
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  _talentRow(t) {
    // Karma context for the roll modal: talents are Karma-eligible by default, so
    // t.karma carries the grant. Pull the pool's amount/die step from the derived
    // Karma characteristic, exactly like the Overview.
    const karmaCtx = t.karma?.grants?.length
      ? {
          grants: t.karma.grants,
          available: this.model?.characteristics?.karma?.available ?? null,
          step: this.model?.characteristics?.karma?.step ?? null,
        }
      : null;
    const status = t.required ? 'required Discipline talent' : 'chosen Talent option';
    return html`
      <div class="trow ${t.required ? '' : 'opt'}">
        <span class="tname">
          <button
            class="tinfo ${t.required ? 'req' : 'opt'}"
            aria-label="${t.name} — ${status}, view details"
            title="${t.name} — ${status}. Click for details."
            @click=${() => (this._modal = t)}
          >i</button>
          <span class="lbl">${t.name}</span>
        </span>
        <span class="effcol eff" title=${t.brief ?? ''}>${t.brief ?? ''}</span>
        <span class="num">${t.rank}</span>
        <span class="sd">${t.step != null ? `${t.step} · ${t.dice}` : '—'}</span>
        <span class="action sd">${t.action ?? ''}</span>
        <button
          class="roll"
          ?disabled=${t.step == null}
          title=${t.step == null ? 'No step to roll' : `Roll ${t.name}${karmaCtx ? ' (Karma available)' : ''}`}
          aria-label="Roll ${t.name}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('ed-roll', { detail: { label: t.name, step: t.step, karma: karmaCtx }, bubbles: true, composed: true }),
            )}
        >⚄</button>
      </div>
    `;
  }

  _talentModal(t) {
    const dt = t.detail ?? {};
    const chips = [
      t.brief ? { c: 'effc', v: t.brief } : null,
      { v: t.required ? 'Required' : 'Optional' },
      t.action ? { v: `${t.action} action` } : null,
      t.attribute ? { v: t.attribute } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
      dt.tier ? { v: dt.tier } : null,
      dt.skillUse && dt.skillUse.allowed === false ? { v: 'No skill use' } : null,
      dt.versus ? { v: `vs ${dt.versus}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => (this._modal = null)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${t.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="tinfo ${t.required ? 'req' : 'opt'}" aria-hidden="true">i</span>${t.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._modal = null)}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip ${c.c ?? ''}">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Full details coming.</div>`}
          ${(dt.notes ?? []).map((n) => html`<div class="mnote">${n}</div>`)}
        </div>
      </div>
    `;
  }

  render() {
    const list = this.model?.disciplines ?? [];
    if (!list.length) return html`<p>No disciplines.</p>`;
    const d = list[Math.min(this._sel, list.length - 1)];
    const meta = [
      d.durability != null ? { k: 'Durability', v: d.durability, cls: 'dur' } : null,
      d.halfMagic ? { k: 'Half-magic', v: d.halfMagic, cls: 'half' } : null,
      d.artisanSkills?.length ? { k: 'Artisan', v: d.artisanSkills.join(' · '), cls: 'art' } : null,
    ].filter(Boolean);

    return html`
      <div class="top">
        <div class="seg">
          ${list.map(
            (x, i) => html`<button aria-pressed=${i === this._sel} @click=${() => (this._sel = i)}>${x.name}</button>`,
          )}
        </div>
        <span class="circle">Circle ${d.circle}</span>
      </div>

      <div class="meta">
        ${meta.map((m) => html`<div class="mcell ${m.cls}"><div class="k">${m.k}</div><div class="v">${m.v}</div></div>`)}
      </div>

      <div class="legend">
        <span class="li"><span class="tinfo req" aria-hidden="true">i</span>required</span>
        <span class="li"><span class="tinfo opt" aria-hidden="true">i</span>optional</span>
        <span class="li">click a circle for details</span>
      </div>
      <div class="card">
        <div class="trow h">
          <span class="thpad">Talent</span>
          <span class="effcol">Effect</span>
          <span class="num">Rank</span>
          <span>Step</span>
          <span class="action">Action</span>
          <span></span>
        </div>
        ${d.talents.map((t) => this._talentRow(t))}
      </div>

      ${d.abilities?.length
        ? html`
            <h4 class="section-gap">Discipline abilities by circle</h4>
            <div class="card">
              ${d.abilities.map(
                (a) => html`<div class="abil"><span class="cbadge">C${a.circle}</span><span>${a.summary}</span></div>`,
              )}
            </div>
          `
        : ''}
      ${this._modal ? this._talentModal(this._modal) : ''}
    `;
  }
}

customElements.define('ed-disciplines', EdDisciplines);
