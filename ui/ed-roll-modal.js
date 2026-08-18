// ui/ed-roll-modal.js — modal showing a step dice roll: the dice used, each
// die's result, exploding dice chained as the same die again, and the total.
import { LitElement, html, css } from 'lit';
import { rollStep, rollKarmaDice } from '../engine/dice.js';
import { knockdownOutcome } from '../engine/health.js';
import { successCount } from '../engine/combat.js';

export class EdRollModal extends LitElement {
  static properties = {
    rollId: {}, // per-interaction id (PLAN-NOTES-TAB decision #5) — ed-app's, for the log upsert
    label: {},
    stepRow: { attribute: false },
    karma: { attribute: false }, // { grants:[{scope,via,summary}], available, stepRow, maxDice?, rank? } | null
    apply: { attribute: false }, // { action, label } | undefined — show an "Apply" button
    difficulty: { attribute: false }, // { value, win?, lose? } | null — "vs Difficulty N" comparison; win/lose override the default Success/Failure words (e.g. Hit/Miss)
    mods: { attribute: false }, // [{ label, value }] | null — roll-time modifiers
    strain: { attribute: false }, // number | 0 — Strain charged at commit for a set-dice/aim roll; 0 otherwise (already paid)
    aim: { attribute: false }, // { vs:'Mystic'|'Physical'|'Social', strain } | null — aim roll: enter the target's defence, roll vs it, resolve Hit/Miss (Mystic Aim)
    _result: { state: true },
    _karmaResult: { state: true },
    _karmaOn: { state: true },
    _committed: { state: true }, // set-dice: has the initial batch been rolled/charged?
    _diceCount: { state: true }, // set-dice: chosen initial Karma-dice count (pre-commit)
    _diceUsed: { state: true }, // set-dice: Karma dice rolled so far (batch + top-ups)
    _aimTarget: { state: true }, // aim: the entered target defence (string input)
    _aimRolled: { state: true }, // aim: has the aim test been rolled/charged?
    embedded: { type: Boolean }, // render the panel inline (no full-screen overlay) — used inside the day-reset spend modal
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
    .title { font-size: var(--fs-value); font-weight: 500; }
    .sub { font-size: var(--fs-small); color: light-dark(#5a6472, #93a0b3); }
    .x { background: none; border: none; color: light-dark(#5a6472, #93a0b3); cursor: pointer; font-size: var(--fs-value); line-height: 1; padding: 2px; }
    .grp { display: flex; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid light-dark(#e2e5ea, #2c313b); }
    .glbl { width: 34px; font-size: var(--fs-small); color: light-dark(#5a6472, #93a0b3); flex: none; }
    .chain { display: flex; align-items: center; gap: 4px; flex: 1; flex-wrap: wrap; }
    .die { width: 32px; height: 32px; border: 1px solid light-dark(#c9ccd3, #3a4150); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: 500; font-size: var(--fs-value); background: light-dark(#f1f2f5, #1b1f27); }
    .die.max { border: 1.5px solid light-dark(#d9944e, #d9944e); color: var(--accent, #b26a00); background: light-dark(#f6e9dc, #3a2a17); }
    .die.kdie { border: 1.5px solid var(--karma); color: var(--karma); background: var(--karma-bg); }
    .arrow { color: var(--accent, #b26a00); font-size: var(--fs-body); }
    .gsub { font-size: var(--fs-body); font-weight: 500; min-width: 26px; text-align: right; }
    .boom { font-size: var(--fs-eyebrow); color: var(--accent, #b26a00); background: light-dark(#f6e9dc, #3a2a17); border-radius: 999px; padding: 1px 6px; }
    .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; }
    .total .n { font-size: var(--fs-hero); font-weight: 500; }
    .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
    .hint { font-size: var(--fs-fine); color: light-dark(#8a93a3, #6b7688); }
    button.ok { font: inherit; font-size: var(--fs-body); padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#c9ccd3, #3a4150); background: none; color: inherit; cursor: pointer; }
    button.appbtn { font: inherit; font-size: var(--fs-body); font-weight: 500; padding: 6px 12px; border-radius: 8px; border: 1px solid light-dark(#d9944e, #d9944e); background: light-dark(#f6e9dc, #3a2a17); color: var(--accent, #b26a00); cursor: pointer; }
    .appfoot { display: flex; align-items: center; gap: 8px; }
    .karma-grp .glbl { color: var(--karma); }
    .karma-ctl { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .kbtn { font: inherit; font-size: var(--fs-small); padding: 5px 11px; border-radius: 999px; border: 1px solid var(--karma); background: none; color: var(--karma); cursor: pointer; }
    .kbtn.on { background: var(--karma-bg); font-weight: 500; }
    .kbtn:disabled { opacity: 0.4; cursor: default; }
    .kavail { font-size: var(--fs-fine); color: light-dark(#8a93a3, #6b7688); }
    /* Set-dice (True Shot) chooser: a small Karma stepper + a commit action. */
    .kdice { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
    .kstep { display: flex; align-items: center; gap: 6px; }
    .kstep button { font: inherit; font-size: var(--fs-value); line-height: 1; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--karma); background: none; color: var(--karma); cursor: pointer; }
    .kstep button:disabled { opacity: 0.4; cursor: default; }
    .kstep .cnt { min-width: 20px; text-align: center; font-weight: 500; }
    .kstep .cap { font-size: var(--fs-fine); color: light-dark(#8a93a3, #6b7688); }
    button.commit { font: inherit; font-size: var(--fs-body); font-weight: 500; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--karma); background: var(--karma-bg); color: var(--karma); cursor: pointer; }
    button.adddie { font: inherit; font-size: var(--fs-small); padding: 5px 11px; border-radius: 999px; border: 1px solid var(--karma); background: none; color: var(--karma); cursor: pointer; }
    button.adddie:disabled { opacity: 0.4; cursor: default; }
    .aimlbl { display: flex; align-items: center; gap: 8px; font-size: var(--fs-small); color: light-dark(#5a6472, #93a0b3); }
    .aimlbl input { width: 72px; font: inherit; font-size: var(--fs-value); padding: 5px 8px; border-radius: 8px; border: 1px solid light-dark(#c9ccd3, #3a4150); background: light-dark(#f1f2f5, #1b1f27); color: inherit; }
    button.commit:disabled { opacity: 0.4; cursor: default; }
    .modchip { font-size: var(--fs-fine); font-weight: 500; color: light-dark(#5a6472, #93a0b3); background: light-dark(#f1f2f5, #1b1f27); border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
    .outcome { margin-top: 8px; font-size: var(--fs-small); font-weight: 500; text-align: right; }
    .outcome.ok { color: light-dark(#3d6b4a, #82c39a); }
    .outcome.fail { color: light-dark(#a63a2b, #e0846f); }
  `;

  connectedCallback() {
    super.connectedCallback();
    // The modal only exists in the DOM while open, so bind/unbind Escape here.
    // In embedded mode (the day-reset spend modal) the host owns Escape; the
    // roll panel just auto-rolls and hands results up via its events.
    this._onKeydown = (e) => {
      if (this.embedded) return;
      if (e.key === 'Escape') this._close();
      // Enter confirms the deferred choosers (Tier-1 modal contract): commit the
      // chosen Karma dice, or roll the aim once a target defence is entered.
      else if (e.key === 'Enter' && this._isSetDice() && !this._committed) this._commit();
      else if (e.key === 'Enter' && this._isAim() && !this._aimRolled && this._aimTargetNum() != null) this._commitAim();
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
      // A fresh roll interaction may spend Karma once (see _toggleKarma);
      // toggling Karma off then on within the same interaction never re-charges.
      this._karmaCharged = false;
      if (this._isSetDice()) {
        // Set-dice (True Shot): DO NOT auto-roll. Open in a chooser state — the
        // player picks the initial Karma dice, and the roll + all charges happen
        // on commit (so Escape before commit costs nothing). D4/D-strain.
        this._committed = false;
        this._diceUsed = 0;
        this._diceCount = 1; // owner: pick the count first; start at the minimum
        this._result = null;
      } else if (this._isAim()) {
        // Aim (Mystic Aim): DO NOT auto-roll. Open with an input for the target's
        // defence; the roll + Strain happen when the player commits (Roll).
        this._aimRolled = false;
        this._aimTarget = '';
        this._result = null;
      } else {
        this._roll();
      }
    }
  }

  // Aim roll (Mystic Aim): enter the target's defence, roll the talent vs it.
  _isAim() {
    return this.aim != null;
  }
  // The defence label the player is rolling against, e.g. "Mystic Defence".
  _aimVsLabel() {
    return `${this.aim?.vs ?? 'Mystic'} Defence`;
  }
  // The entered target number, or null when blank/invalid (guards the Roll).
  _aimTargetNum() {
    const t = String(this._aimTarget ?? '').trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  // A set-dice roll adds up to `rank` Karma dice (True Shot); `karma.rank` is the
  // signal (only present when a karmaDice option is armed and affordable).
  _isSetDice() {
    return this.karma?.rank != null;
  }
  // The initial-batch stepper ceiling: rank clamped by the Karma balance.
  _maxDice() {
    return Math.max(1, this.karma?.maxDice ?? 1);
  }

  // Whether the character has a Karma point left to spend on this roll.
  _canSpendKarma() {
    const a = this.karma?.available;
    return typeof a === 'number' && Number.isFinite(a) && a > 0;
  }

  _roll() {
    this._result = rollStep(this.stepRow);
    // Re-roll the Karma die too if it's currently spent.
    this._karmaResult = this._karmaOn && this.karma?.stepRow ? rollStep(this.karma.stepRow) : null;
    // A Knockdown test resolves itself: the moment the dice land, the outcome
    // is decided and applied — there is no verify button. A failed test knocks
    // the character down; the app re-derives that state from this result.
    if (this.apply?.action === 'knockdown-result') this._apply();
    this._log();
  }

  _toggleKarma() {
    const turningOn = !this._karmaOn;
    // Block turning Karma on with no point to spend (guards a null/0 balance).
    if (turningOn && !this._karmaCharged && !this._canSpendKarma()) return;
    this._karmaOn = turningOn;
    this._karmaResult = this._karmaOn && this.karma?.stepRow ? rollStep(this.karma.stepRow) : null;
    // Persist the spend ONCE per roll interaction (owner: charge, no refund) —
    // toggling off then on again does not re-charge. One Karma die = −1 Karma,
    // applied app-wide via ed-app.
    if (turningOn && !this._karmaCharged) {
      this._karmaCharged = true;
      this.dispatchEvent(new CustomEvent('ed-edit-karma', { detail: { spend: 1 }, bubbles: true, composed: true }));
    }
    this._log();
  }

  // --- set-dice (True Shot): choose an initial batch, commit, then top up ------

  // Change the pre-commit dice count within 1 … maxDice.
  _setCount(n) {
    if (this._committed) return;
    this._diceCount = Math.max(1, Math.min(this._maxDice(), n));
  }

  // Commit the chosen batch: roll the Attack step + `_diceCount` Karma dice, and
  // charge — once — that many Karma points plus the deferred option Strain. This
  // is the only commit point, so Escape/✕ before it charges nothing (D3/D-strain).
  _commit() {
    if (this._committed) return;
    const c = this._diceCount;
    this._result = rollStep(this.stepRow);
    this._karmaResult = this.karma?.stepRow ? rollKarmaDice(this.karma.stepRow, c) : null;
    this._diceUsed = c;
    this._committed = true;
    this.dispatchEvent(new CustomEvent('ed-edit-karma', { detail: { spend: c }, bubbles: true, composed: true }));
    if (this.strain) this.dispatchEvent(new CustomEvent('ed-strain', { detail: { amount: this.strain }, bubbles: true, composed: true }));
    this._log();
  }

  // The top-up rule (D9): after commit, the player may add Karma dice one at a
  // time while dice used < rank, Karma remains, and — if a target number is set —
  // the total is still below it (don't waste Karma once the attack succeeds).
  _canAddDie() {
    if (!this._committed) return false;
    const rank = this.karma?.rank ?? 0;
    const remaining = (this.karma?.available ?? 0) - this._diceUsed;
    if (this._diceUsed >= rank || remaining <= 0) return false;
    const target = this.difficulty?.value;
    if (target != null && this._grandTotal() >= target) return false;
    return true;
  }
  // Add one Karma die: roll it, fold it into the existing result (same shape),
  // charge 1 Karma. No refund.
  _addDie() {
    if (!this._canAddDie()) return;
    const one = rollStep(this.karma.stepRow);
    const prev = this._karmaResult ?? { step: this.karma.stepRow?.step ?? null, dice: this.karma.stepRow?.dice ?? '', groups: [], total: 0 };
    this._karmaResult = { step: prev.step, dice: prev.dice, groups: [...prev.groups, ...one.groups], total: prev.total + one.total };
    this._diceUsed += 1;
    this.dispatchEvent(new CustomEvent('ed-edit-karma', { detail: { spend: 1 }, bubbles: true, composed: true }));
    this._log();
  }

  // --- aim (Mystic Aim): roll the talent vs the entered target defence ---------

  _commitAim() {
    if (this._aimRolled || this._aimTargetNum() == null) return;
    this._result = rollStep(this.stepRow);
    this._aimRolled = true;
    // Charge the aim's Strain once, at the roll (not at option-select) — Escape
    // before this costs nothing.
    if (this.aim?.strain) this.dispatchEvent(new CustomEvent('ed-strain', { detail: { amount: this.aim.strain }, bubbles: true, composed: true }));
    this._log();
  }

  // Log this completed roll interaction (PLAN-NOTES-TAB, decision #5): fire on
  // every landing — initial roll, Karma on/off, and the auto-resolved
  // Knockdown/Recovery tests. The event carries ONLY the dice
  // result the modal just computed (`_result`, the resolved `_karmaResult`,
  // the derived outcome) plus the ed-app-owned `rollId`; ed-app merges those
  // with the roll config it already holds (label/step/difficulty/mods) and
  // upserts one Roll Log entry per interaction. The modal never writes storage.
  _log() {
    if (this.rollId == null || !this._result) return;
    this.dispatchEvent(
      new CustomEvent('ed-roll-logged', {
        detail: {
          rollId: this.rollId,
          result: this._result,
          karmaResult: this._karmaResult,
          outcome: this._outcome(),
          // Aim rolls carry their in-modal target so the log (and the Combat tab's
          // arm check) records the difficulty; other rolls carry it on the config.
          difficulty: this._isAim() ? this._aimTargetNum() : undefined,
        },
        bubbles: true,
        composed: true,
      }),
    );
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
  // total result back up with that action so the app can apply it. The result
  // is the full total including any roll-time modifiers; the difficulty (when
  // the roll is against one) rides along so the app re-derives the outcome
  // through the engine — the view never decides game state.
  _apply() {
    this.dispatchEvent(
      new CustomEvent('ed-roll-apply', {
        detail: {
          action: this.apply?.action ?? null,
          result: this._grandTotal(),
          difficulty: this.difficulty?.value ?? null,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // The full total: dice + Karma die + any roll-time modifiers.
  _grandTotal() {
    const r = this._result;
    if (!r) return 0;
    const modSum = (this.mods ?? []).reduce((s, m) => s + (Number(m.value) || 0), 0);
    return r.total + (this._karmaResult?.total ?? 0) + modSum;
  }

  // The comparison against a difficulty, when one is set. For a Knockdown test
  // it uses the engine's outcome wording (Stayed up / Knocked down); any other
  // difficulty roll honours the view's win/lose words (e.g. Hit/Miss), defaulting
  // to Success / Failure. Display only — the app re-derives the real outcome from
  // the apply event.
  _outcome() {
    // Aim roll: resolve against the target defence entered in the modal, in
    // success levels — each success arms +2 steps for the Attack roll (MA7).
    if (this._isAim()) {
      const d = this._aimTargetNum();
      if (d == null || !this._result) return null;
      const s = successCount(this._grandTotal(), d);
      return s > 0
        ? { word: `Aim hit — ${s} success${s > 1 ? 'es' : ''}, +${2 * s} steps`, ok: true }
        : { word: 'Aim missed', ok: false };
    }
    const d = this.difficulty?.value;
    if (d == null || !this._result) return null;
    const total = this._grandTotal();
    if (this.apply?.action === 'knockdown-result') {
      return knockdownOutcome(total, d) === 'down' ? { word: 'Knocked down', ok: false } : { word: 'Stayed up', ok: true };
    }
    return total >= d
      ? { word: this.difficulty?.win ?? 'Success', ok: true }
      : { word: this.difficulty?.lose ?? 'Failure', ok: false };
  }

  _applyLabel() {
    const o = this._outcome();
    if (this.apply?.action === 'knockdown-result' && o) return o.word;
    return this.apply?.label ?? 'Apply result';
  }
  // The "vs …" comparison label — an aim roll names the defence it targets; other
  // rolls name their Difficulty. null when the roll has no comparison at all.
  _difficultyLabel() {
    if (this._isAim()) return this._aimTargetNum() != null ? `vs ${this._aimVsLabel()} ${this._aimTargetNum()}` : null;
    return this.difficulty?.value != null ? `vs Difficulty ${this.difficulty.value}` : null;
  }

  // Set-dice chooser (True Shot): pick the initial Karma dice, then commit. No
  // dice are rolled and nothing is charged until "Roll" — Escape/✕ costs nothing.
  _renderChooser() {
    const max = this._maxDice();
    const rank = this.karma?.rank ?? max;
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dm" @click=${(e) => e.stopPropagation()}>
          <div class="head">
            <div>
              <div class="title">⚄ ${this.label}</div>
              <div class="sub">Step ${this.stepRow.step} · ${this.stepRow.dice ?? ''} · exploding${this.difficulty?.value != null ? html` · vs Difficulty ${this.difficulty.value}` : ''}</div>
            </div>
            <button class="x" @click=${this._close} aria-label="Close">✕</button>
          </div>
          <div class="kdice">
            <div class="kstep">
              <button ?disabled=${this._diceCount <= 1} @click=${() => this._setCount(this._diceCount - 1)} aria-label="Fewer Karma dice">−</button>
              <span class="cnt">✦ ${this._diceCount}</span>
              <button ?disabled=${this._diceCount >= max} @click=${() => this._setCount(this._diceCount + 1)} aria-label="More Karma dice">+</button>
              <span class="cap">of up to ${rank}${max < rank ? html` (${this.karma?.available ?? 0} Karma)` : ''}</span>
            </div>
          </div>
          <div class="foot">
            <span class="hint">${this.strain ? html`${this.strain} Strain on roll.` : ''}${this.strain && this.difficulty?.value == null ? ' ' : ''}${this.difficulty?.value == null ? '' : 'Add dice one at a time after the roll to reach the target.'}</span>
            <button class="commit" @click=${this._commit}>Roll ✦ ${this._diceCount}</button>
          </div>
        </div>
      </div>
    `;
  }

  // Aim chooser (Mystic Aim): enter the target's defence, then roll. Deferred —
  // nothing rolls or is charged until "Roll".
  _renderAimChooser() {
    const ready = this._aimTargetNum() != null;
    return html`
      <div class="overlay" @click=${this._close}>
        <div class="dm" @click=${(e) => e.stopPropagation()}>
          <div class="head">
            <div>
              <div class="title">⚄ ${this.label}</div>
              <div class="sub">Step ${this.stepRow.step} · ${this.stepRow.dice ?? ''} · exploding · vs the target's ${this._aimVsLabel()}</div>
            </div>
            <button class="x" @click=${this._close} aria-label="Close">✕</button>
          </div>
          <div class="kdice">
            <label class="aimlbl">Target's ${this._aimVsLabel()}
              <input type="number" inputmode="numeric" .value=${this._aimTarget ?? ''} @input=${(e) => (this._aimTarget = e.target.value)} aria-label="Target's ${this._aimVsLabel()}" />
            </label>
          </div>
          <div class="foot">
            <span class="hint">${this.aim?.strain ? html`${this.aim.strain} Strain on roll.` : ''} +2 steps per success arm for the Attack roll.</span>
            <button class="commit" ?disabled=${!ready} @click=${this._commitAim}>Roll</button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.stepRow) return html``;
    if (this._isSetDice() && !this._committed) return this._renderChooser();
    if (this._isAim() && !this._aimRolled) return this._renderAimChooser();
    const r = this._result;
    if (!r) return html``;
    const dm = html`
        <div class="dm" @click=${(e) => e.stopPropagation()}>
          <div class="head">
            <div>
              <div class="title">⚄ ${this.label}</div>
              <div class="sub">Step ${r.step} · ${r.dice ?? ''} · exploding${this._difficultyLabel() ? html` · ${this._difficultyLabel()}` : ''}</div>
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
            ${(this.mods ?? []).length
              ? html`<div class="grp">
                  <span class="glbl">Mods</span>
                  <span class="chain">
                    ${(this.mods ?? []).map(
                      (m) => html`<span class="modchip" title=${m.label}>${m.label} ${Number(m.value) > 0 ? '+' : ''}${m.value}</span>`,
                    )}
                  </span>
                  <span class="gsub">${(this.mods ?? []).reduce((s, m) => s + (Number(m.value) || 0), 0)}</span>
                </div>`
              : ''}
          </div>
          <div class="total">
            <span class="sub">Total</span>
            <span class="n">${this._grandTotal()}</span>
          </div>
          ${this._outcome() ? html`<div class="outcome ${this._outcome().ok ? 'ok' : 'fail'}">${this._difficultyLabel() ? html`${this._difficultyLabel()} — ` : ''}${this._outcome().word}</div>` : ''}
          ${this._isSetDice()
            ? html`<div class="karma-ctl">
                <button class="adddie" ?disabled=${!this._canAddDie()} @click=${this._addDie}
                  title=${this._canAddDie() ? 'Spend 1 more Karma to add a die' : 'No more dice can be added'}
                >✦ Add 1 Karma die</button>
                <span class="kavail">${this._diceUsed} of ${this.karma?.rank ?? '—'} dice · ${Math.max(0, (this.karma?.available ?? 0) - this._diceUsed)} Karma left</span>
              </div>`
            : this.karma?.grants?.length
            ? html`<div class="karma-ctl">
                <button
                  class="kbtn ${this._karmaOn ? 'on' : ''}"
                  ?disabled=${!this._karmaOn && !this._canSpendKarma()}
                  title=${!this._karmaOn && !this._canSpendKarma() ? 'No Karma left to spend' : this.karma.grants.map((g) => g.summary).filter(Boolean).join(' · ')}
                  @click=${this._toggleKarma}
                >✦ ${this._karmaLabel()}${this._karmaOn ? '' : ' (+D6)'}</button>
                <span class="kavail">${this.karma.available ?? '—'} Karma</span>
              </div>`
            : ''}
          <div class="foot">
            <span class="hint">Max on a die explodes: reroll and add.</span>
            ${this.apply && this.apply.action !== 'knockdown-result'
              ? html`<span class="appfoot">
                  <button class="appbtn" @click=${this._apply}>${this._applyLabel()}</button>
                  <button class="ok" @click=${this._close}>OK</button>
                </span>`
              : html`<button class="ok" @click=${this._close}>OK</button>`}
          </div>
        </div>
    `;
    return this.embedded ? dm : html`<div class="overlay" @click=${this._close}>${dm}</div>`;
  }
}

customElements.define('ed-roll-modal', EdRollModal);
