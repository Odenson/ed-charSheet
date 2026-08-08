// ui/ed-roll-modal.js — modal showing a step dice roll: the dice used, each
// die's result, exploding dice chained as the same die again, and the total.
import { LitElement, html, css } from 'lit';
import { rollStep } from '../engine/dice.js';

export class EdRollModal extends LitElement {
  static properties = {
    label: {},
    stepRow: { attribute: false },
    karma: { attribute: false }, // { grants:[{scope,via,summary}], available, stepRow } | null
    apply: { attribute: false }, // { action, label } | undefined — show an "Apply" button
    _result: { state: true },
    _karmaResult: { state: true },
    _karmaOn: { state: true },
  };

  static styles = css`
    :host {
      color-scheme: light dark;
      /* Karma semantic colour (Sage) — distinct from the amber general accent. */
      --karma: light-dark(#3d6b4a, #82c39a);
      --karma-bg: light-dark(#e7f0ea, #223029);
    }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 1rem; }
    .dm {
      width: 340px; max-width: 100%;
      background: light-dark(#ffffff, #232833); color: light-dark(#111418, #f0f3f7);
      border: 1px solid light-dark(#e2e5ea, #2c313b); border-radius: 12px; padding: 14px 16px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .head { display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 1rem; font-weight: 500; }
    .sub { font-size: 0.75rem; color: light-dark(#5a6472, #93a0b3); }
    .x { background: none; border: none; color: light-dark(#5a6472, #93a0b3); cursor: pointer; font-size: 1rem; line-height: 1; padding: 2px; }
    .grp { display: flex; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid light-dark(#e2e5ea, #2c313b); }
    .glbl { width: 34px; font-size: 0.75rem; color: light-dark(#5a6472, #93a0b3); flex: none; }
    .chain { display: flex; align-items: center; gap: 4px; flex: 1; flex-wrap: wrap; }
    .die { width: 32px; height: 32px; border: 1px solid light-dark(#c9ccd3, #3a4150); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: 500; font-size: 0.9rem; background: light-dark(#f1f2f5, #1b1f27); }
    .die.max { border: 1.5px solid light-dark(#d9944e, #d9944e); color: var(--accent, #b26a00); background: light-dark(#f6e9dc, #3a2a17); }
    .die.kdie { border: 1.5px solid var(--karma); color: var(--karma); background: var(--karma-bg); }
    .arrow { color: var(--accent, #b26a00); font-size: 0.8rem; }
    .gsub { font-size: 0.85rem; font-weight: 500; min-width: 26px; text-align: right; }
    .boom { font-size: 0.62rem; color: var(--accent, #b26a00); background: light-dark(#f6e9dc, #3a2a17); border-radius: 999px; padding: 1px 6px; }
    .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; }
    .total .n { font-size: 1.6rem; font-weight: 500; }
    .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
    .hint { font-size: 0.68rem; color: light-dark(#8a93a3, #6b7688); }
    button.again { font: inherit; font-size: 0.8rem; padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#c9ccd3, #3a4150); background: none; color: inherit; cursor: pointer; }
    button.appbtn { font: inherit; font-size: 0.8rem; font-weight: 500; padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#d9944e, #d9944e); background: light-dark(#f6e9dc, #3a2a17); color: var(--accent, #b26a00); cursor: pointer; }
    .appfoot { display: flex; align-items: center; gap: 8px; }
    .karma-grp .glbl { color: var(--karma); }
    .karma-ctl { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .kbtn { font: inherit; font-size: 0.78rem; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--karma); background: none; color: var(--karma); cursor: pointer; }
    .kbtn.on { background: var(--karma-bg); font-weight: 500; }
    .kavail { font-size: 0.7rem; color: light-dark(#8a93a3, #6b7688); }
  `;

  connectedCallback() {
    super.connectedCallback();
    // The modal only exists in the DOM while open, so bind/unbind Escape here.
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this._close();
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  updated(changed) {
    // A new roll target resets any spent Karma, then rolls.
    if (changed.has('stepRow') && this.stepRow) {
      this._karmaOn = false;
      this._karmaResult = null;
      this._roll();
    }
  }

  _roll() {
    this._result = rollStep(this.stepRow);
    // Re-roll the Karma die too if it's currently spent.
    this._karmaResult = this._karmaOn && this.karma?.stepRow ? rollStep(this.karma.stepRow) : null;
  }

  _toggleKarma() {
    this._karmaOn = !this._karmaOn;
    this._karmaResult = this._karmaOn && this.karma?.stepRow ? rollStep(this.karma.stepRow) : null;
  }

  // "Spend Karma" for unscoped grants; "Spend Karma (if …)" when every grant is
  // scoped, so the player decides whether this roll qualifies.
  _karmaLabel() {
    const grants = this.karma?.grants ?? [];
    if (grants.some((g) => !g.scope)) return 'Spend Karma';
    const scopes = [...new Set(grants.map((g) => g.scope).filter(Boolean))].join(' / ');
    return scopes ? `Spend Karma (if ${scopes})` : 'Spend Karma';
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  // When the roll carries an apply context (e.g. a Recovery test), hand the
  // total result back up with that action so the app can apply it.
  _apply() {
    const r = this._result;
    this.dispatchEvent(
      new CustomEvent('ed-roll-apply', {
        detail: { action: this.apply?.action ?? null, result: r.total + (this._karmaResult?.total ?? 0) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const r = this._result;
    if (!this.stepRow || !r) return html``;
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dm" @click=${(e) => e.stopPropagation()}>
          <div class="head">
            <div>
              <div class="title">⚄ ${this.label}</div>
              <div class="sub">Step ${r.step} · ${r.dice ?? ''} · exploding</div>
            </div>
            <button class="x" @click=${this._close} aria-label="Close">✕</button>
          </div>
          <div>
            ${r.groups.map(
              (g) => html`
                <div class="grp">
                  <span class="glbl">${g.label}</span>
                  <span class="chain">
                    ${g.rolls.map(
                      (v, i) => html`<span class="die ${v === g.die ? 'max' : ''}">${v}</span>${i < g.rolls.length - 1
                          ? html`<span class="arrow" aria-hidden="true">↦</span>`
                          : ''}`,
                    )}
                    ${g.exploded ? html`<span class="boom">exploded</span>` : ''}
                  </span>
                  <span class="gsub">${g.subtotal}</span>
                </div>
              `,
            )}
            ${r.modifier
              ? html`<div class="grp"><span class="glbl">Mod</span><span class="chain"></span><span class="gsub">${r.modifier > 0 ? '+' : ''}${r.modifier}</span></div>`
              : ''}
            ${this._karmaResult
              ? html`<div class="grp karma-grp">
                  <span class="glbl" title="Karma die (D6)">✦</span>
                  <span class="chain">
                    ${this._karmaResult.groups
                      .flatMap((g) => g.rolls)
                      .map(
                        (v, i, arr) => html`<span class="die kdie">${v}</span>${i < arr.length - 1
                            ? html`<span class="arrow" aria-hidden="true">↦</span>`
                            : ''}`,
                      )}
                  </span>
                  <span class="gsub">${this._karmaResult.total}</span>
                </div>`
              : ''}
          </div>
          <div class="total">
            <span class="sub">Total</span>
            <span class="n">${r.total + (this._karmaResult?.total ?? 0)}</span>
          </div>
          ${this.karma?.grants?.length
            ? html`<div class="karma-ctl">
                <button
                  class="kbtn ${this._karmaOn ? 'on' : ''}"
                  title=${this.karma.grants.map((g) => g.summary).filter(Boolean).join(' · ')}
                  @click=${this._toggleKarma}
                >✦ ${this._karmaLabel()}${this._karmaOn ? '' : ' (+D6)'}</button>
                <span class="kavail">${this.karma.available ?? '—'} Karma</span>
              </div>`
            : ''}
          <div class="foot">
            <span class="hint">Max on a die explodes: reroll and add.</span>
            ${this.apply
              ? html`<span class="appfoot">
                  <button class="appbtn" @click=${this._apply}>${this.apply.label ?? 'Apply result'}</button>
                  <button class="again" @click=${this._roll}>Roll again</button>
                </span>`
              : html`<button class="again" @click=${this._roll}>Roll again</button>`}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ed-roll-modal', EdRollModal);
