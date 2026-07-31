// ui/ed-disciplines.js — the Disciplines tab: a toggle between the character's
// disciplines, each showing its detail, talents (with step/dice) and per-circle
// abilities. Talents live here (there is no separate Talents tab).
import { LitElement, html, css } from 'lit';

export class EdDisciplines extends LitElement {
  static properties = {
    model: { attribute: false },
    _sel: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      display: block; color-scheme: light dark;
    }
    .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
    .seg { display: inline-flex; background: var(--bg-card); border-radius: 999px; padding: 3px; gap: 2px; }
    .seg button { border: none; background: none; padding: 6px 16px; border-radius: 999px; font: inherit; font-size: 0.85rem; color: var(--muted); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--bg-chip); color: var(--value, #111); border: 1px solid var(--border); }
    .circle { font-size: 0.72rem; padding: 2px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; margin-bottom: 12px; }
    .mcell { background: var(--bg-card); border-radius: 8px; padding: 6px 9px; }
    .mcell .k { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .mcell .v { font-size: 0.8rem; margin-top: 1px; }
    .card { background: var(--bg-card); border-radius: 8px; padding: 8px 10px; }
    h4 { margin: 0 0 6px; font-size: 0.62rem; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .trow { display: grid; grid-template-columns: 1fr 44px 108px 84px 24px; gap: 8px; align-items: center; font-size: 0.8rem; padding: 5px 0; border-bottom: 1px solid var(--border); }
    .trow:last-child { border-bottom: none; }
    .trow.h { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .sd { font-size: 0.72rem; color: var(--muted); }
    .roll { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.7rem; padding: 0; }
    .abil { display: flex; gap: 10px; padding: 5px 0; font-size: 0.8rem; align-items: baseline; }
    .cbadge { font-size: 0.62rem; padding: 1px 7px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); flex: none; }
    .section-gap { margin-top: 14px; }
    @media (max-width: 620px) {
      .trow { grid-template-columns: 1fr 40px 96px 22px; }
      .trow .action { display: none; }
    }
  `;

  constructor() {
    super();
    this._sel = 0;
  }

  render() {
    const list = this.model?.disciplines ?? [];
    if (!list.length) return html`<p>No disciplines.</p>`;
    const d = list[Math.min(this._sel, list.length - 1)];
    const meta = [
      d.durability != null ? ['Durability', d.durability] : null,
      d.halfMagic ? ['Half-magic', d.halfMagic] : null,
      d.artisanSkills?.length ? ['Artisan', d.artisanSkills.join(' · ')] : null,
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
        ${meta.map(([k, v]) => html`<div class="mcell"><div class="k">${k}</div><div class="v">${v}</div></div>`)}
      </div>

      <div class="card">
        <div class="trow h"><span>Talent</span><span class="num">Rank</span><span>Step</span><span class="action">Action</span><span></span></div>
        ${d.talents.map(
          (t) => html`
            <div class="trow">
              <span>${t.name}</span>
              <span class="num">${t.rank}</span>
              <span class="sd">${t.step != null ? `${t.step} · ${t.dice}` : '—'}</span>
              <span class="action sd">${t.action ?? ''}</span>
              <button class="roll" title="Roll ${t.name} (coming soon)" aria-label="Roll ${t.name}">⚄</button>
            </div>
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
    `;
  }
}

customElements.define('ed-disciplines', EdDisciplines);
