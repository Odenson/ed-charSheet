// ui/ed-day-reset.js — the new-day reset modal for the shared flow owned by
// ed-app (PLAN-END-OF-DAY-RESET.md). Presentational only: it renders the day
// reset offer — the remaining-recovery spend loop (decision F) or a plain
// confirm — and dispatches `roll` / `spend-wound` / `reset` / `roll-dismiss` /
// `close` up. It never mutates state or computes game values (Tier-1 golden
// rule).
//
// The plan (`plan`) is the pure engine's decision-support output
// (`endOfDayResetPlan`) pushed down from ed-app: remaining / damage / wounds /
// damageSpendable / woundSpendable. `canRoll` (whether the character has a
// Toughness step) gates the rolled damage-heal offer — a spend with no step can
// never roll.
//
// The whole spend loop lives in THIS modal: clicking "Roll a Recovery test"
// mounts an embedded `<ed-roll-modal>` (inline, no overlay) inside the dialog,
// so the remaining-recoveries / Damage / Wounds readout stays on screen while
// the roll lands. Each roll's "Heal this amount" applies up to ed-app, which
// clears the roll and re-renders this modal from the updated plan — the next
// recovery is one click away.
//
// Tier-1 modal rules: Escape / backdrop / ✕ close (= cancel); Escape while a
// roll is showing dismisses just the roll (back to the stats + dice again);
// Enter confirms (the primary button is autofocused); theme-aware.
import { LitElement, html, css } from 'lit';
import './ed-roll-modal.js';

export class EdDayReset extends LitElement {
  static properties = {
    plan: { type: Object },
    canRoll: { type: Boolean },
    roll: { type: Object }, // the embedded recovery roll config (from ed-app) | null
  };

  static styles = css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#3d6b4a, #82c39a);
      --accent-bg: light-dark(#e8f2ea, #23362a);
      --text: light-dark(#111418, #f0f3f7);
    }
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--bg-chip); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.5rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    .msg { font-size: var(--fs-body); line-height: 1.5; color: var(--text); margin: 0 0 0.75rem; }
    .stats { display: flex; gap: 8px; margin: 0 0 1rem; }
    .stat { flex: 1; text-align: center; border: 1px solid var(--border); border-radius: 8px; padding: 6px 4px; background: var(--accent-bg); }
    .stat .lbl { display: block; font-size: var(--fs-fine); color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .stat .val { display: block; font-size: var(--fs-value); font-weight: 500; color: var(--text); }
    .rollarea { border-top: 1px solid var(--border); padding-top: 0.75rem; margin-bottom: 0.5rem; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    button.btn { font: inherit; font-size: var(--fs-body); padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: var(--bg-chip); color: var(--text); }
    button.btn.accent { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    button.btn[disabled] { opacity: 0.4; cursor: not-allowed; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._onKeydown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (this.roll) this._dismissRoll();
        else this._close();
      }
    };
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  // Focus the primary action so Enter confirms: the spend/roll button in the
  // stats state, or the embedded roll's Heal action while a roll is showing.
  firstUpdated() {
    this._focusPrimary();
  }

  updated(changed) {
    if (changed.has('roll')) this._focusPrimary();
  }

  _focusPrimary() {
    const primary = this.roll
      ? (this.renderRoot.querySelector('ed-roll-modal')?.renderRoot.querySelector('.appbtn, .ok') ?? null)
      : (this.renderRoot.querySelector('.btn.accent') ?? this.renderRoot.querySelector('.btn'));
    primary?.focus();
  }

  _dispatch(name) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  _close() {
    this._dispatch('close');
  }

  _dismissRoll() {
    this._dispatch('roll-dismiss');
  }

  // The embedded roll's ✕ / OK without applying — drop back to the stats view.
  _rollClosed(e) {
    e.stopPropagation();
    this._dismissRoll();
  }

  render() {
    const p = this.plan ?? {};
    const remaining = p.remaining;
    const plural = remaining === 1 ? 'Recovery test' : 'Recovery tests';
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="A new day begins" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>A new day begins</span>
            <button class="mclose" aria-label="Close" @click=${() => this._close()}>✕</button>
          </div>
          <div class="stats">
            <div class="stat"><span class="lbl">Recoveries left</span><span class="val">${remaining ?? '—'}</span></div>
            <div class="stat"><span class="lbl">Damage</span><span class="val">${p.damage ?? 0}</span></div>
            <div class="stat"><span class="lbl">Wounds</span><span class="val">${p.wounds ?? 0}</span></div>
          </div>
          ${this.roll
            ? html`
                <p class="msg">Roll this Recovery test to heal Damage — the result is the heal. Repeat while Damage remains and ${plural.toLowerCase()} are left.</p>
                <div class="rollarea">
                  <ed-roll-modal
                    .embedded=${true}
                    .rollId=${this.roll.rollId}
                    .label=${this.roll.label}
                    .stepRow=${this.roll.stepRow}
                    .karma=${this.roll.karma}
                    .apply=${this.roll.apply}
                    .difficulty=${this.roll.difficulty}
                    .mods=${this.roll.mods}
                    .strain=${this.roll.strain}
                    .aim=${this.roll.aim}
                    @close=${(e) => this._rollClosed(e)}
                  ></ed-roll-modal>
                </div>
              `
            : html`
                ${this._prompt(p, remaining, plural)}
                <div class="actions">
                  <button type="button" class="btn" @click=${() => this._close()}>Cancel</button>
                  ${(p.damageSpendable && this.canRoll) || p.woundSpendable
                    ? html`<button type="button" class="btn" @click=${() => this._dispatch('reset')}>Skip spend & reset</button>
                      <button type="button" class="btn accent" @click=${() => this._dispatch(p.woundSpendable ? 'spend-wound' : 'roll')}>${p.woundSpendable ? 'Spend 1 (heal a Wound)' : 'Roll a Recovery test (heal Damage)'}</button>`
                    : html`<button type="button" class="btn accent" @click=${() => this._dispatch('reset')}>Reset the day</button>`}
                </div>
              `}
        </div>
      </div>
    `;
  }

  _prompt(p, remaining, plural) {
    const offerDamage = Boolean(p.damageSpendable && this.canRoll);
    const spendable = Boolean(remaining != null && remaining > 0);
    if (spendable) {
      if (offerDamage) {
        return html`<p class="msg">You have ${remaining} ${plural} left. Roll each one to heal Damage while it remains; once Damage is 0, each spend heals one Wound. You can also skip the spend and reset now.</p>`;
      }
      if (p.woundSpendable) {
        return html`<p class="msg">You have ${remaining} ${plural} left and no Damage. Spend them to heal one Wound each before the day resets.</p>`;
      }
      if (p.damage > 0) {
        return html`<p class="msg">You have ${remaining} ${plural} left, but this character has no Toughness step to roll the heal with.</p>`;
      }
      return html`<p class="msg">You have ${remaining} ${plural} left, but no Damage or Wounds to spend them on.</p>`;
    }
    return html`<p class="msg">This resets your Recovery tests to 0 and clears the day's combat options (armed options, situations, blood charms, aim and target). Damage and Wounds carry into the new day.</p>`;
  }
}

customElements.define('ed-day-reset', EdDayReset);