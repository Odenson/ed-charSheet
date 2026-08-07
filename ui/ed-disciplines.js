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

    /* Skills tab: reuses the .trow grid so the columns line up with the talent
       table. Knacks derive from a skill or talent and render as an indented child
       row beneath the row that governs them. */
    .knrow { display: flex; align-items: center; padding: 3px 0 3px 24px; font-size: 0.76rem; color: var(--muted); border-bottom: 1px solid var(--border); }
    .knrow:last-child { border-bottom: none; }
    .knrow .arr { color: var(--accent); margin-right: 6px; }
    .kninfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font: 500 italic 0.5rem/1 system-ui, sans-serif; box-sizing: border-box;
      background: transparent; border: 1.5px solid var(--muted); color: var(--muted);
      margin-right: 7px; transition: border-color 0.12s ease, color 0.12s ease; }
    .kninfo:hover { border-color: var(--accent); color: var(--fg); }
    .kninfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }
    .knlbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ktag { font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 6px; margin-left: 7px; }
    /* Neutral info control per skill (skills have no required/optional split). Opens
       a detail modal — mirrors the talent info button. */
    .sinfo { width: 14px; height: 14px; border-radius: 50%; flex: none; cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font: 500 italic 0.5rem/1 system-ui, sans-serif; box-sizing: border-box;
      background: transparent; border: 1.5px solid var(--muted); color: var(--muted);
      transition: border-color 0.12s ease, color 0.12s ease; }
    .sinfo:hover { border-color: var(--accent); color: var(--fg); }
    .sinfo:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-bg); }

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

  // One skill row, using the same .trow grid as talents so the columns line up.
  // Skills carry name/rank/tier today; Effect/Step/Action stay empty (— for step)
  // until that data is added, and the roll enables once a skill has a step. Tier
  // lives in the detail modal, matching how talents show their tier.
  _skillRow(s) {
    return html`
      <div class="trow">
        <span class="tname">
          <button
            class="sinfo"
            aria-label="${s.name} — view details"
            title="${s.name} — click for details"
            @click=${() => (this._modal = { type: 'skill', skill: s })}
          >i</button>
          <span class="lbl">${s.name}</span>
        </span>
        <span class="effcol eff" title=${s.brief ?? ''}>${s.brief ?? ''}</span>
        <span class="num">${s.rank}</span>
        <span class="sd">${s.step != null ? `${s.step} · ${s.dice}` : '—'}</span>
        <span class="action sd">${s.action ?? ''}</span>
        <button
          class="roll"
          ?disabled=${s.step == null}
          title=${s.step == null ? 'No step to roll' : `Roll ${s.name}`}
          aria-label="Roll ${s.name}"
          @click=${() =>
            this.dispatchEvent(
              new CustomEvent('ed-roll', { detail: { label: s.name, step: s.step, karma: null }, bubbles: true, composed: true }),
            )}
        >⚄</button>
      </div>
    `;
  }

  // Skills tab: the character's skills in the same table shape as the talent list,
  // with any knacks nested under the skill they derive from. Knacks arrive already
  // resolved from the store ({ name, parent:{type,name} }) — only knacks whose parent
  // is a skill belong here, nested under that skill's row; a knack whose parent is a
  // talent renders on the discipline talent tables instead. No stray knacks at the end.
  _skillsView(skills, knacks) {
    const byParent = new Map();
    for (const k of knacks ?? []) {
      if (k.parent?.type !== 'skill') continue;
      const parent = k.parent?.name ?? null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(k);
    }
    return html`
      <div class="card">
        <div class="trow h">
          <span class="thpad">Skill</span>
          <span class="effcol">Effect</span>
          <span class="num">Rank</span>
          <span>Step</span>
          <span class="action">Action</span>
          <span></span>
        </div>
        ${skills.map(
          (s) => html`
            ${this._skillRow(s)}
            ${(byParent.get(s.name) ?? []).map((k) => this._knackRow(k))}
          `,
        )}
      </div>
    `;
  }

  // One indented child row for a knack nested under the skill/talent it derives from.
  // Carries the same info control as skills/talents, opening a knack detail modal.
  _knackRow(k) {
    return html`
      <div class="knrow">
        <span class="arr">↳</span>
        <button
          class="kninfo"
          aria-label="${k.name} — view details"
          title="${k.name} — click for details"
          @click=${() => (this._modal = { type: 'knack', knack: k })}
        >i</button>
        <span class="knlbl">${k.name}</span>
        <span class="ktag">knack</span>
      </div>
    `;
  }

  // Knack detail modal. Shows what governs the knack (skill/talent + required rank),
  // its action/strain, and the paraphrased description. Placeholder when the knack has
  // no catalog detail yet.
  _knackModal(k) {
    const dt = k.detail ?? {};
    const chips = [
      k.parent ? { v: `${k.parent.type === 'talent' ? 'Talent' : 'Skill'}: ${k.parent.name}` } : null,
      k.requiredRank ? { v: `Req. rank ${k.requiredRank}` } : null,
      k.action ? { v: `${k.action} action` } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => (this._modal = null)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${k.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="kninfo" aria-hidden="true">i</span>${k.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._modal = null)}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip ${c.c ?? ''}">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Knack details not yet recorded.</div>`}
        </div>
      </div>
    `;
  }

  // Skill detail modal. Mirrors the talent modal: chips summarise the mechanics
  // (rank/tier/action/attribute/strain), the body shows the paraphrased summary, and
  // a note carries the test's target. Falls back to a placeholder when a skill has no
  // catalog detail (unknown/unenriched skill).
  _skillModal(s) {
    const dt = s.detail ?? {};
    const chips = [
      { v: `Rank ${s.rank}` },
      s.tier ? { v: s.tier } : null,
      s.action ? { v: `${s.action} action` } : null,
      s.attribute ? { v: s.attribute } : null,
      dt.strain ? { v: `Strain ${dt.strain}` } : null,
    ].filter(Boolean);
    return html`
      <div class="overlay" @click=${() => (this._modal = null)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label=${s.name} @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span class="mtitle"><span class="sinfo" aria-hidden="true">i</span>${s.name}</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._modal = null)}>✕</button>
          </div>
          <div class="mchips">${chips.map((c) => html`<span class="chip">${c.v}</span>`)}</div>
          ${dt.summary
            ? html`<div class="mtext">${dt.summary}</div>`
            : html`<div class="mtext" style="color: var(--muted)">Skill description not yet recorded.</div>`}
          ${dt.versus ? html`<div class="mnote">Tested against ${dt.versus}.</div>` : ''}
        </div>
      </div>
    `;
  }

  render() {
    const list = this.model?.disciplines ?? [];
    if (!list.length) return html`<p>No disciplines.</p>`;
    const skills = this.model?.skills ?? [];
    const showSkills = skills.length > 0 && this._sel === list.length;
    const d = list[Math.min(this._sel, list.length - 1)];
    // Knacks governed by a talent render beneath that talent's row (skill-governed
    // knacks already nest under their skill on the Skills tab).
    const knacksByTalent = new Map();
    for (const k of this.model?.knacks ?? []) {
      if (k.parent?.type !== 'talent') continue;
      const parent = k.parent?.name ?? null;
      if (!knacksByTalent.has(parent)) knacksByTalent.set(parent, []);
      knacksByTalent.get(parent).push(k);
    }
    const meta = [
      d.durability != null ? { k: 'Durability', v: d.durability, cls: 'dur' } : null,
      d.halfMagic ? { k: 'Half-magic', v: d.halfMagic, cls: 'half' } : null,
      d.artisanSkills?.length ? { k: 'Artisan', v: d.artisanSkills.join(' · '), cls: 'art' } : null,
    ].filter(Boolean);

    return html`
      <div class="top">
        <div class="seg">
          ${list.map(
            (x, i) => html`<button aria-pressed=${!showSkills && i === this._sel} @click=${() => (this._sel = i)}>${x.name}</button>`,
          )}
          ${skills.length
            ? html`<button aria-pressed=${showSkills} @click=${() => (this._sel = list.length)}>Skills</button>`
            : ''}
        </div>
        <span class="circle">${showSkills ? `${skills.length} skill${skills.length === 1 ? '' : 's'}` : `Circle ${d.circle}`}</span>
      </div>

      ${showSkills
        ? this._skillsView(skills, this.model?.knacks ?? [])
        : html`
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
              ${d.talents.map(
                (t) => html`
                  ${this._talentRow(t)}
                  ${(knacksByTalent.get(t.name) ?? []).map((k) => this._knackRow(k))}
                `,
              )}
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
          `}
      ${this._modal
        ? this._modal.type === 'skill'
          ? this._skillModal(this._modal.skill)
          : this._modal.type === 'knack'
            ? this._knackModal(this._modal.knack)
            : this._talentModal(this._modal)
        : ''}
    `;
  }
}

customElements.define('ed-disciplines', EdDisciplines);
