// ui/ed-stats-view.js — read-only character sheet (Phase 1).
// Presentational: takes a derived model (see store.js) and renders it.

import { LitElement, html, css } from 'lit';

export class EdStatsView extends LitElement {
  static properties = {
    model: { attribute: false },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#ffffff, #1b1f27);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --value: light-dark(#111418, #f0f3f7);
      display: block;
      color: var(--value);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    :host { color-scheme: light dark; }

    header.sheet { margin-bottom: 1.5rem; }
    header.sheet h1 {
      margin: 0;
      font-size: clamp(1.6rem, 4vw, 2.2rem);
      letter-spacing: -0.01em;
    }
    .meta-line {
      color: var(--muted);
      font-size: 0.95rem;
      margin: 0.35rem 0 0;
    }
    .meta-line span + span::before { content: ' • '; }
    .desc {
      margin: 0.6rem 0 0;
      font-style: italic;
      color: var(--muted);
      font-size: 0.9rem;
    }

    h2.section {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.35rem;
      margin: 2rem 0 0.9rem;
    }

    .attr-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      gap: 0.75rem;
    }
    .attr {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.75rem 0.9rem;
    }
    .attr .name {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .attr .value { font-size: 2rem; font-weight: 700; line-height: 1.1; }
    .attr .step { font-size: 0.85rem; color: var(--accent); font-weight: 600; }
    .attr .step .dice { color: var(--muted); font-weight: 400; }

    .vitals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 0.75rem;
    }
    .vital {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      padding: 0.75rem 0.9rem;
    }
    .vital .name {
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); margin-bottom: 0.4rem;
    }
    .vital .row { display: flex; justify-content: space-between; font-size: 0.9rem; }
    .vital .row span:last-child { font-weight: 600; }

    .disc-head {
      display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.5rem;
    }
    .disc-head h3 { margin: 0; font-size: 1.1rem; }
    .circle {
      background: var(--accent); color: #fff; border-radius: 1rem;
      padding: 0.05rem 0.6rem; font-size: 0.75rem; font-weight: 700;
    }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); }
    th {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); font-weight: 600;
    }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .dice { color: var(--muted); }
    .missing { color: var(--muted); font-style: italic; }

    .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 1rem; padding: 0.2rem 0.7rem; font-size: 0.85rem;
    }
    .trait {
      background: var(--bg-card); border: 1px solid var(--border);
      border-left: 3px solid var(--accent); border-radius: 0.4rem;
      padding: 0.6rem 0.8rem; white-space: pre-wrap; font-size: 0.88rem;
    }
  `;

  _stepCell(step, dice) {
    if (step == null) return html`<span class="missing">—</span>`;
    return html`${step} <span class="dice">${dice ? `(${dice})` : ''}</span>`;
  }

  render() {
    const m = this.model;
    if (!m) return html``;
    const meta = m.meta;
    const r = m.resources;

    return html`
      <header class="sheet">
        <h1>${meta.name ?? 'Unnamed'}</h1>
        <p class="meta-line">
          ${[meta.race, meta.sex, meta.age ? `Age ${meta.age}` : null, meta.height, meta.weight]
            .filter(Boolean)
            .map((x) => html`<span>${x}</span>`)}
        </p>
        ${meta.description ? html`<p class="desc">${meta.description}</p>` : ''}
      </header>

      <h2 class="section">Attributes</h2>
      <div class="attr-grid">
        ${m.attributes.map(
          (a) => html`
            <div class="attr">
              <div class="name">${a.name}</div>
              <div class="value">${a.value}</div>
              <div class="step">Step ${a.step}
                <span class="dice">${a.dice ? `(${a.dice})` : ''}</span>
              </div>
            </div>
          `,
        )}
      </div>

      <h2 class="section">Vitals</h2>
      <div class="vitals">
        <div class="vital">
          <div class="name">Health</div>
          <div class="row"><span>Damage</span><span>${r.health?.damage ?? 0}</span></div>
          <div class="row"><span>Wounds</span><span>${r.health?.wounds ?? 0}</span></div>
          <div class="row"><span>Recoveries used</span><span>${r.health?.recoveriesUsed ?? 0}</span></div>
        </div>
        <div class="vital">
          <div class="name">Karma</div>
          <div class="row"><span>Available</span><span>${r.karma?.available ?? 0}</span></div>
          <div class="row"><span>Spent</span><span>${r.karma?.spent ?? 0}</span></div>
        </div>
        <div class="vital">
          <div class="name">Legend</div>
          <div class="row"><span>Available</span><span>${r.legend?.available ?? 0}</span></div>
          <div class="row"><span>Total earnt</span><span>${r.legend?.totalEarnt ?? 0}</span></div>
        </div>
      </div>

      <h2 class="section">Disciplines &amp; Talents</h2>
      ${m.disciplines.map(
        (d) => html`
          <div style="margin-bottom:1.5rem">
            <div class="disc-head">
              <h3>${d.name}</h3>
              <span class="circle">Circle ${d.circle}</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Talent</th><th class="num">Rank</th><th>Attribute</th>
                    <th class="num">Step</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.talents.map(
                    (t) => html`
                      <tr>
                        <td>${t.name}</td>
                        <td class="num">${t.rank}</td>
                        <td>${t.attribute ?? html`<span class="missing">—</span>`}</td>
                        <td class="num">${this._stepCell(t.step, t.dice)}</td>
                        <td>${t.action ?? ''}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          </div>
        `,
      )}

      ${m.skills.length
        ? html`
            <h2 class="section">Skills</h2>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Skill</th><th class="num">Rank</th></tr></thead>
                <tbody>
                  ${m.skills.map(
                    (s) => html`<tr><td>${s.name}</td><td class="num">${s.rank}</td></tr>`,
                  )}
                </tbody>
              </table>
            </div>
          `
        : ''}

      ${m.knacks.length
        ? html`
            <h2 class="section">Knacks</h2>
            <div class="chips">${m.knacks.map((k) => html`<span class="chip">${k.name}</span>`)}</div>
          `
        : ''}

      ${m.extraTraits.length
        ? html`
            <h2 class="section">Extra Traits</h2>
            ${m.extraTraits.map((t) => html`<div class="trait">${t}</div>`)}
          `
        : ''}
    `;
  }
}

customElements.define('ed-stats-view', EdStatsView);
