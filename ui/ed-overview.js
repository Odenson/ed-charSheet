// ui/ed-overview.js — the Overview tab: hero portrait + header, attributes,
// and the Defences/Armour/Movement/Health/Combat panels. Fit-to-viewport,
// collapses to one column on mobile. Derived stats show as placeholder pills
// until the engine computes them (see docs/UI-GUIDELINES.md).
import { LitElement, html, css } from 'lit';

const ABBR = { Dexterity: 'DEX', Strength: 'STR', Toughness: 'TOU', Perception: 'PER', Willpower: 'WIL', Charisma: 'CHA' };

export class EdOverview extends LitElement {
  static properties = {
    model: { attribute: false },
    _modal: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      display: block;
    }
    .grid { display: grid; grid-template-columns: 250px 1fr; gap: 12px; align-items: stretch; }
    .hero { display: flex; flex-direction: column; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .name { font-size: 1.25rem; font-weight: 500; line-height: 1.1; }
    .meta { font-size: 0.75rem; color: var(--muted); margin-top: 1px; }
    .discs { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
    .dtile { font-size: 0.72rem; font-weight: 500; padding: 3px 10px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); white-space: nowrap; }
    .blurb { font-size: 0.75rem; color: var(--muted); font-style: italic; margin-top: 6px; line-height: 1.35; }
    .portrait { flex: 1; min-height: 160px; margin-top: 8px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--bg-card); display: flex; align-items: center; justify-content: center; }
    .portrait img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .portrait .ph { color: var(--muted); font-size: 2rem; }
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
    .panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; flex: 1; }
    .stack { display: flex; flex-direction: column; gap: 8px; justify-content: space-between; }
    .line { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; font-size: 0.8rem; }
    .line .rl { display: flex; align-items: center; gap: 6px; }
    .pend { font-size: 0.68rem; color: var(--muted); background: var(--bg-chip); border: 1px dashed var(--muted); border-radius: 999px; padding: 1px 7px; }
    .val { font-weight: 500; }
    .feat { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; font-size: 0.72rem; }
    .feat .txt { flex: 1; min-width: 0; line-height: 1.35; }
    .ftag { flex: none; margin-top: 1px; font-size: 0.6rem; font-weight: 500; padding: 1px 6px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); }
    .ftag.race { background: var(--accent-bg); color: var(--accent); }
    .info { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 0.85rem; padding: 0 0 0 3px; line-height: 1; vertical-align: -1px; }
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
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      .portrait { min-height: 220px; }
    }
  `;

  _pend() { return html`<span class="pend">—</span>`; }
  _roll(label) {
    return html`<button class="roll" title="Roll ${label} (coming soon)" aria-label="Roll ${label}">⚄</button>`;
  }

  _openModal(title, body) { this._modal = { title, body }; }
  _closeModal() { this._modal = null; }

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
        .map((ab) => ({ tag: `${d.name.slice(0, 3)} ${ab.circle}`, summary: ab.summary })),
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
          (a) => html`<div class="feat"><span class="ftag">${a.tag}</span><span class="txt">${a.summary}</span></div>`,
        )}
      </div>
    `;
  }

  render() {
    const m = this.model;
    if (!m) return html``;
    const meta = m.meta ?? {};
    const h = m.resources?.health ?? {};
    const metaLine = [meta.race, meta.sex, meta.age ? `Age ${meta.age}` : null].filter(Boolean).join(' · ');
    const portrait = meta.portrait ? `./${meta.portrait}` : null;

    return html`
      <div class="grid">
        <div class="hero">
          <div class="head">
            <div>
              <div class="name">${meta.name ?? 'Unnamed'}</div>
              <div class="meta">${metaLine}</div>
            </div>
            <div class="discs">
              ${(m.disciplines ?? []).map((d) => html`<span class="dtile">${d.name} ${d.circle}</span>`)}
            </div>
          </div>
          ${meta.description ? html`<div class="blurb">${meta.description}</div>` : ''}
          <div class="portrait">
            ${portrait
              ? html`<img src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} />`
              : html`<span class="ph">▢</span>`}
          </div>
        </div>

        <div class="right">
          <div class="blk">
            <h4>Attributes</h4>
            <div class="agrid">
              ${(m.attributes ?? []).map(
                (a) => html`
                  <div class="acell">
                    <div class="an">${ABBR[a.name] ?? a.name.slice(0, 3).toUpperCase()}</div>
                    <div class="r">
                      <span class="av">${a.value}</span>
                      <span class="asd">s${a.step} ${a.dice}</span>
                      ${this._roll(a.name)}
                    </div>
                  </div>
                `,
              )}
            </div>
          </div>

          <div class="panels">
            <div class="stack">
              <div class="blk">
                <h4>Defences</h4>
                <div class="line"><span>Physical</span>${this._pend()}</div>
                <div class="line"><span>Mystic</span>${this._pend()}</div>
                <div class="line"><span>Social</span>${this._pend()}</div>
              </div>
              <div class="blk">
                <h4>Armour</h4>
                <div class="line"><span>Physical</span>${this._pend()}</div>
                <div class="line"><span>Mystic</span>${this._pend()}</div>
              </div>
              <div class="blk">
                <h4>Health</h4>
                <div class="line"><span>Damage</span><span class="val">${h.damage ?? 0}</span></div>
                <div class="line"><span>Unconscious</span>${this._pend()}</div>
                <div class="line"><span>Death</span>${this._pend()}</div>
                <div class="line"><span>Wounds</span><span class="val">${h.wounds ?? 0}</span></div>
                <div class="line"><span>Recoveries</span>${this._pend()}</div>
              </div>
              <div class="blk">
                <h4>Movement</h4>
                <div class="line"><span>Carry / Lift</span>${this._pend()}</div>
              </div>
            </div>
            <div class="stack" style="justify-content: flex-start">
              <div class="blk">
                <h4>Combat</h4>
                <div class="line"><span>Initiative</span><span class="rl">${this._pend()}${this._roll('Initiative')}</span></div>
                <div class="line"><span>Knockdown</span><span class="rl">${this._pend()}${this._roll('Knockdown')}</span></div>
                <div class="line"><span>Karma</span><span class="rl">${this._pend()}${this._roll('Karma')}</span></div>
              </div>
              ${this._specialFeatures()}
            </div>
          </div>
        </div>
      </div>
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
    `;
  }
}

customElements.define('ed-overview', EdOverview);
