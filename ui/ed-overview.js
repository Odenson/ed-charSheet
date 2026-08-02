// ui/ed-overview.js — the Overview tab: hero portrait + header, attributes,
// and the Defences/Armour/Movement/Health/Combat panels. Fit-to-viewport,
// collapses to one column on mobile. Derived stats show as placeholder pills
// until the engine computes them (see docs/UI-GUIDELINES.md).
import { LitElement, html, css, nothing } from 'lit';

const ABBR = { Dexterity: 'DEX', Strength: 'STR', Toughness: 'TOU', Perception: 'PER', Willpower: 'WIL', Charisma: 'CHA' };

export class EdOverview extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { attribute: false },
    _modal: { state: true },
    _lightbox: { state: true },
    _edit: { state: true },
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
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
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

  connectedCallback() {
    super.connectedCallback();
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
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

  // Modal body listing all character metadata (any field added to meta shows up).
  _metaBody() {
    const meta = this.model?.meta ?? {};
    const HIDE = new Set(['name', 'portrait', 'sourceSheetVersion']);
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
            ${portrait
              ? html`<img class="avatar" src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} title="View portrait" @click=${() => (this._lightbox = true)} />`
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
                      ${this._rollBtn(a.name, a.step, a.karma)}
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
                <h4>Health</h4>
                <div class="line"><span>Damage</span><span class="val">${h.damage ?? 0}</span></div>
                <div class="line"><span>Unconscious</span>${this._char('unconsciousness')}</div>
                <div class="line"><span>Death</span>${this._char('death')}</div>
                <div class="line"><span>Wounds</span><span class="val">${h.wounds ?? 0}</span></div>
                <div class="line"><span>Recoveries</span>${this._char('recoveries')}</div>
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
            <img class="lightbox-img" src=${portrait} alt=${`Portrait of ${meta.name ?? 'the character'}`} />
          </div>`
        : ''}
      ${this._edit
        ? html`<ed-edit-meta .meta=${meta} @close=${() => (this._edit = false)}></ed-edit-meta>`
        : ''}
    `;
  }
}

customElements.define('ed-overview', EdOverview);
