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
// Enter confirms (the primary button); theme-aware. Built on the UI kit
// (docs/MODALS.md): while a roll shows, the dirty hook turns the cancel path into
// "dismiss the roll" and Enter belongs to the embedded roll's own buttons.
import { LitElement, html, css } from 'lit';
import './ed-roll-modal.js';
import { ModalController, deepActiveElement } from './kit/modal-controller.js';
import { modalFrame, modalCss } from './kit/modal.js';

export class EdDayReset extends LitElement {
  static properties = {
    plan: { type: Object },
    canRoll: { type: Boolean },
    roll: { type: Object }, // the embedded recovery roll config (from ed-app) | null
  };

  static styles = [modalCss, css`
    :host {
      --bg-chip: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --accent: light-dark(#3d6b4a, #82c39a);
      --accent-bg: light-dark(#e8f2ea, #23362a);
      --text: light-dark(#111418, #f0f3f7);
    }
    .msg { font-size: var(--fs-body); line-height: 1.5; color: var(--text); margin: 0 0 0.75rem; }
    .stats { display: flex; gap: 8px; margin: 0 0 1rem; }
    .stat { flex: 1; text-align: center; border: 1px solid var(--border); border-radius: 8px; padding: 6px 4px; background: var(--accent-bg); }
    .stat .lbl { display: block; font-size: var(--fs-fine); color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .stat .val { display: block; font-size: var(--fs-value); font-weight: 500; color: var(--text); }
    .rollarea { border-top: 1px solid var(--border); padding-top: 0.75rem; margin-bottom: 0.5rem; }
  `];

  constructor() {
    super();
    this._ctl = new ModalController(this, {
      kind: 'confirm',
      canConfirm: () => !this.roll,
      // While a roll shows, Escape/✕/backdrop dismiss just the roll.
      isDirty: () => !!this.roll,
      onDiscardPrompt: () => this._dismissRoll(),
      onConfirm: () => this._dispatch(this._primaryEvent()),
      onClose: () => this._close(),
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this._ctl.opened(deepActiveElement());
  }

  // Focus the embedded roll's Heal action while a roll is showing (the kit's
  // initial focus covers the stats state).
  updated(changed) {
    if (changed.has('roll') && this.roll) this._focusPrimary();
    if (changed.has('roll') && !this.roll && changed.get('roll') !== undefined) this._ctl.refocus();
  }

  _focusPrimary() {
    this.renderRoot.querySelector('ed-roll-modal')?.renderRoot.querySelector('.appbtn, .ok')?.focus();
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
    const spend = (p.damageSpendable && this.canRoll) || p.woundSpendable;
    return modalFrame(this._ctl, {
      title: 'A new day begins',
      layer: 2100,
      width: '26rem',
      // No footer while a roll shows: the embedded roll owns its buttons.
      primary: this.roll ? undefined : {
        tone: 'heal',
        label: spend ? (p.woundSpendable ? 'Spend 1 (heal a Wound)' : 'Roll a Recovery test (heal Damage)') : 'Reset the day',
      },
      extra: !this.roll && spend
        ? html`<button type="button" class="btn" @click=${() => this._dispatch('reset')}>Skip spend & reset</button>`
        : undefined,
      body: html`
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
                  .stepMods=${this.roll.stepMods}
                  .optionalMods=${this.roll.optionalMods}
                  .baseStep=${this.roll.baseStep}
                  .stepByNumber=${this.roll.stepByNumber}
                  .strain=${this.roll.strain}
                  .aim=${this.roll.aim}
                  @close=${(e) => this._rollClosed(e)}
                ></ed-roll-modal>
              </div>`
          : this._prompt(p, remaining, plural)}`,
    });
  }

  // The event the primary button dispatches (also what Enter runs).
  _primaryEvent() {
    const p = this.plan ?? {};
    if (!((p.damageSpendable && this.canRoll) || p.woundSpendable)) return 'reset';
    return p.woundSpendable ? 'spend-wound' : 'roll';
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