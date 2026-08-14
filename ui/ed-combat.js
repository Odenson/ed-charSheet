// ui/ed-combat.js — the Combat tab (PLAN-COMBAT-TAB Phases D–F).
//
// A per-encounter scratchpad over the derived model: pick an equipped weapon (or
// leave "None" for a free-action roll) and an attack talent, toggle combat-option
// / situational / blood-charm chips, and roll Attack / Damage / Initiative through
// the shared roll modal (Phase E). The engine (engine/combat.js) composes the
// pool; the view only dispatches `ed-roll` with the pool's `step` / `resultMods` /
// `difficulty` / `karma`.
//
// Golden rule (Tier 1): data flows down through render, events flow up through
// dispatch. The view never mutates state or computes game values — every number
// shown comes from the derived model or a pure engine call, and nothing about
// the encounter is persisted (decision #4 — this state dies on tab switch, which
// ed-app guarantees by rendering only the active tab).
//
// Applying a result (strain / incoming damage / a heal) dispatches `ed-edit-health`
// so ed-app persists the input and re-derives (Phase F). These writes are
// one-way — there is no Undo: damage taken and healing done are not reversible
// (owner decision). The Combat log is a view of the device-local Roll Log
// (store-rolllog.js, shared with the Notes tab): every roll lands here, and the
// round's non-roll actions (Stand up) are recorded too, marked `kind: 'action'`.
import { LitElement, html, css } from 'lit';
import { attackPool, damagePool, collectCombatEffects, foldCombatRatings, attackTalentNamesFor, attackSuccessLevels } from '../engine/combat.js';
import { applyHealth, woundsFromHit, knockdownTriggered, knockdownDifficulty, recoveriesRemaining } from '../engine/health.js';
import { armedRecoveryBonus, boostHasNoEffect } from '../engine/potions.js';
import { loadRollLog, clearRollLog, saveRollLog } from '../store-rolllog.js';
import { portraitUrlFor } from '../store.js';
import { unequipSpentCharms } from './item-equip-state.js';
import './ed-confirm.js';

// Per-character combat-tab scratchpad, kept in module memory so the player's
// picks survive a tab switch (ed-app renders only the active tab, so this element
// is destroyed and rebuilt each time). Keyed by characterId, so a character
// switch still starts fresh, and a full reload (module reload) clears it — the
// picks are session-only UI state, never persisted to the character (store-only-
// inputs holds). Only the selections are cached, not mid-action state (pending
// apply / open modals).
const SCRATCH = new Map();

// Collapsible chip sections default to EXPANDED on desktop, and to collapsed on
// narrow (mobile) screens — the same 720px breakpoint as the .top layout grid.
// Only the initial default is viewport-driven; the player's taps win afterwards,
// and the per-character scratchpad preserves them across tab switches.
const MOBILE_QUERY = '(max-width: 720px)';
const defaultCollapsed = () =>
  typeof matchMedia !== 'undefined' && matchMedia(MOBILE_QUERY).matches
    ? ['dab', 'opts', 'sits', 'charms']
    : [];

const MISSING_IMAGE = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9" r="1.5" />
    <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 16" />
  </svg>
`;

// A per-interaction log id (same shape ed-app uses for roll entries).
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export class EdCombat extends LitElement {
  static properties = {
    model: { attribute: false },
    editMode: { type: Boolean },
    characterId: { type: String },
    // Armed-potion session state from ed-app: { pending, potions } (data down).
    arming: { attribute: false },
    _potionSel: { state: true }, // selected potion name in the Drink dropdown
    _usePrompt: { state: true }, // potion name — Drink confirmation open
    // Ephemeral encounter state (decision #4) — cleared on character switch and
    // on every tab-switch re-mount (ed-app renders only the active tab).
    _weapon: { state: true },
    _talent: { state: true },
    _opts: { state: true },
    _sits: { state: true },
    _charmsOn: { state: true },
    _target: { state: true },
    _collapsed: { state: true },
    _damageModal: { state: true },
    _confirmClear: { state: true },
    _rolls: { state: true },
    // #7 success-level damage bonus: the last attack this pick rolled ({ total,
    // target }) and whether it's still "armed" (cleared when the weapon/talent
    // pick changes, so a stale attack never buffs an unrelated damage roll).
    _lastAttack: { state: true },
    _attackArmed: { state: true },
  };

  static styles = css`
    :host {
      --bg-card: light-dark(#f1f2f5, #1b1f27);
      --bg-chip: light-dark(#f7f8fa, #1b1f27);
      --card: light-dark(#ffffff, #232833);
      --border: light-dark(#e2e5ea, #2c313b);
      --muted: light-dark(#5a6472, #93a0b3);
      --fg: light-dark(#111418, #f0f3f7);
      --accent: light-dark(#7a3e12, #d9944e);
      --accent-bg: light-dark(#f6e9dc, #3a2a17);
      --karma: light-dark(#3d6b4a, #82c39a);
      --danger: light-dark(#c0392b, #e06557);
      --danger-bg: light-dark(#fbe9e7, #3a1f1c);
      --blood: light-dark(#a1352b, #e0736a);
      --blood-bg: light-dark(#f8e7e4, #3a201d);
      display: block;
    }
    /* Attack and Damage-taken share the top row so they stretch to the SAME
       height; Defence/Potions and Combat Modifiers stack under Attack, and the
       Combat log spans down the right column beside them. */
    .top {
      display: grid;
      grid-template-columns: 1fr 240px;
      grid-template-areas:
        "atk  dmg"
        "dab  log"
        "mods log";
      gap: 10px;
      align-items: stretch;
    }
    @media (max-width: 720px) {
      .top { grid-template-columns: 1fr; grid-template-areas: "atk" "dmg" "dab" "mods" "log"; }
    }
    .top > * { min-width: 0; } /* let grid children shrink instead of overflow */
    .top > .atkblk { grid-area: atk; }
    .top > .dtcol { grid-area: dmg; }
    .top > .dabpair { grid-area: dab; }
    .top > .mods { grid-area: mods; }
    .top > .logblk { grid-area: log; align-self: start; }

    .blk { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
    .h { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.62rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 6px; }
    .h .r { color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 6px; }
    .h .r b { color: var(--fg); font-weight: 500; }

    /* Weapon image: a square as tall as the pickers + statlines. Grid (not flex)
       so the auto column derives its width from the stretched height. The img is
       absolutely positioned — its intrinsic size can never feed the grid's
       content sizing (a wide/tall PNG must not inflate the row), and
       object-fit: contain shrinks it to fit (letterboxed) instead of cropping. */
    .attacktop { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: stretch; }
    .attackrows { min-width: 0; display: flex; flex-direction: column; }
    .artbox { position: relative; aspect-ratio: 1; height: 100%; min-height: 96px; border: 1px dashed var(--border); border-radius: 8px; background: var(--bg-card); display: flex; align-items: center; justify-content: center; color: var(--muted); overflow: hidden; }
    .artbox img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .artbox .missing { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
    .artbox svg { width: 30px; height: 30px; opacity: 0.6; }
    .artbox .cap { font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.05em; }

    select { font: inherit; font-size: 0.8rem; width: 100%; padding: 4px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-chip); color: inherit; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; }

    .statline { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 0.8rem; border-top: 1px solid var(--border); }
    .statline .k { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 54px; flex: none; }
    .statline .v { flex: 1; font-weight: 500; font-variant-numeric: tabular-nums; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .statline .v.ranged { font-size: 0.62rem; color: var(--muted); font-weight: 400; margin-left: 4px; }
    .dmgbonus { font-size: 0.6rem; font-weight: 500; color: var(--karma); background: var(--bg-chip); border: 1px solid var(--karma); border-radius: 999px; padding: 0 6px; margin-left: 6px; white-space: nowrap; }
    .roll { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.72rem; flex: none; padding: 0; line-height: 1; }
    .roll:disabled { opacity: 0.4; cursor: default; }

    .vs { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--muted); }
    .vs input { width: 46px; font: inherit; font-size: 0.8rem; font-weight: 500; text-align: right; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px; }
    .vs input:focus { outline: none; border-color: var(--accent); }
    .strain-k { margin-left: 14px; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); flex: none; }
    .strain { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--danger); flex: none; min-width: 14px; text-align: right; }

    /* Collapsible chip sections. */
    .sec { margin-top: 8px; }
    .sechead { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; cursor: pointer; font: 500 0.62rem/1.4 inherit; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); user-select: none; background: none; border: none; padding: 0; }
    .sechead .chev { font-size: 0.66rem; }
    .sechead .cnt { color: var(--accent); }
    .sec.collapsed .secbody { display: none; }
    .secbody { margin-top: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 0.72rem; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-chip); color: inherit; cursor: pointer; user-select: none; }
    .chip:hover { border-color: var(--accent); }
    .chip[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .chip.locked { opacity: 0.85; cursor: default; }
    .chip.locked:hover { border-color: var(--border); }
    .chip.charm[aria-pressed='true'] { border-color: var(--blood); background: var(--blood-bg); color: var(--blood); }
    .badge { font-size: 0.56rem; padding: 0 4px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
    .chip[aria-pressed='true'] .badge { border-color: currentColor; }
    .badge.pos { color: var(--karma); }
    .badge.neg { color: var(--danger); }
    .badge.strain { color: var(--danger); }
    .empty { background: var(--bg-card); border: 1px dashed var(--border); border-radius: 8px; padding: 8px 10px; text-align: center; font-size: 0.72rem; color: var(--muted); line-height: 1.45; }

    /* Live folded Defence/Armour figures (Overview-style): tinted with the
       danger colour while toggled session mods are active (signed delta badge). */
    .dval.cond { color: var(--danger); }
    .dval .delt { margin-left: 3px; font-size: 0.58rem; font-weight: 500; line-height: 1; padding: 1px 4px; border-radius: 999px; background: var(--danger-bg); color: var(--danger); vertical-align: 1px; white-space: nowrap; }

    /* Stand-up affordance — mirrors the Overview active-effect row (§2 Stand up). */
    .standrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 0.68rem; color: var(--danger); padding: 4px 8px; margin-bottom: 6px; background: var(--danger-bg); border-radius: 6px; }
    .stand { flex: none; font: inherit; font-size: 0.6rem; font-weight: 500; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--accent); background: none; color: var(--accent); cursor: pointer; }
    .stand:hover { background: var(--accent-bg); }

    /* Defence & Armour block: derived readouts only — a value the engine hasn't
       produced yet renders as a placeholder pill, never a fabricated number
       (UI-GUIDELINES §5). Collapsible like the chip sections; defaults to
       collapsed on narrow screens (owner decision), expanded on desktop. */
    .dabhead { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; cursor: pointer; font: 500 0.62rem/1.4 inherit; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); user-select: none; background: none; border: none; padding: 0; }
    .dabhead .chev { font-size: 0.66rem; }
    .dabrow { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; font-size: 0.72rem; padding: 2px 0; font-variant-numeric: tabular-nums; }
    .dabrow .k { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 52px; flex: none; }
    .dabrow .v { font-weight: 500; }
    .dabrow .v .sep { color: var(--muted); font-weight: 400; margin: 0 5px; }
    .dablk.collapsed .dabbody { display: none; }
    .dabbody { margin-top: 4px; }
    .mods { display: flex; flex-direction: column; }

    /* Defence & Armour and Potions share one row, side by side; they fold to two
       stacked cards on narrow screens (same 720px breakpoint as .top). */
    .dabpair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: stretch; }
    @media (max-width: 720px) { .dabpair { grid-template-columns: 1fr; } }
    .dabpair > .blk { height: 100%; box-sizing: border-box; }
    .potpick { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
    select.pot { font: inherit; font-size: 0.72rem; color: var(--fg); background: var(--card); border: 1px solid var(--border); border-radius: 7px; padding: 5px 7px; flex: 1; min-width: 0; }
    .drink { font: inherit; font-size: 0.66rem; font-weight: 500; border: 1px solid var(--accent); background: var(--accent); color: #fff; padding: 5px 12px; border-radius: 999px; cursor: pointer; flex: 0 0 auto; }
    .drink:disabled { opacity: 0.4; cursor: not-allowed; }
    .emptyhint { font-size: 0.66rem; color: var(--muted); padding: 2px 0; }
    .potpend { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; background: var(--accent-bg); border: 1px dashed var(--accent); margin-top: 6px; }
    .potpend .ptxt { flex: 1; font-size: 0.68rem; color: var(--fg); }
    .potpend .ptxt b { color: var(--accent); font-weight: 500; }
    .potpend .proll { flex: 0 0 auto; font: inherit; font-size: 0.6rem; font-weight: 500; white-space: nowrap; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--accent); background: none; color: var(--accent); cursor: pointer; }
    .potpend .proll:hover { background: var(--accent-bg); }
    .potpend .pclear { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; line-height: 1; padding: 2px 4px; }

    /* Placeholder pill (UI-GUIDELINES §5) — a derived value the engine hasn't
       produced yet renders dashed, never as a fabricated number. */
    .pend { font-weight: 400; color: var(--muted); border: 1px dashed var(--muted); border-radius: 999px; padding: 0 6px; font-size: 0.72rem; }

    /* Damage-taken rail. Flex column so, when the card stretches to match the
       Attack card's height, the take-damage/recovery buttons sink to the bottom. */
    .dtcol { display: flex; flex-direction: column; }
    .dtcol .cur { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
    .dtcol .cur .lab { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); white-space: nowrap; }
    .dtcol .curdmg { width: 46px; font: inherit; font-size: 0.95rem; font-weight: 500; text-align: right; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 8px; padding: 4px 6px; box-sizing: border-box; }
    .dtcol .curdmg.val { width: auto; min-width: 16px; border: none; background: none; padding-left: 0; font-variant-numeric: tabular-nums; }
    /* Wounds sits inline beside damage — same row, no extra height. */
    .dtcol .curwnd { color: var(--danger); }
    .dtcol .thr { font-size: 0.68rem; color: var(--muted); margin-top: 6px; line-height: 1.5; }
    .dtcol .dtbtns { display: flex; gap: 6px; margin-top: auto; padding-top: 9px; }
    .status { font-size: 0.6rem; font-weight: 500; padding: 1px 9px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); white-space: nowrap; border: 1px solid var(--border); }
    .status.warn { background: var(--danger-bg); color: var(--danger); border-color: transparent; }

    /* Combat log — a view of the device-local Roll Log (rolls + actions). */
    .clear { font: inherit; font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; }
    .clear:hover { color: var(--danger); border-color: var(--danger); }
    .clear:disabled { opacity: 0.4; cursor: default; }
    .log { display: flex; flex-direction: column; max-height: 320px; overflow: auto; }
    .logrow { display: flex; gap: 7px; align-items: baseline; font-size: 0.72rem; padding: 4px 0; border-top: 1px solid var(--border); }
    .logrow:first-child { border-top: none; }
    .logrow .lt { flex: none; width: 14px; text-align: center; color: var(--accent); font-size: 0.7rem; }
    .logrow .lx { min-width: 0; color: var(--muted); line-height: 1.35; }
    .logrow .lx b { color: var(--fg); font-weight: 500; }
    .logrow .lx .hit { color: var(--karma); font-weight: 500; }
    .logrow .lx .miss { color: var(--danger); font-weight: 500; }
    .logrow .lx .mods { color: var(--muted); }
    .logempty { font-size: 0.72rem; color: var(--muted); line-height: 1.4; }

    /* Take-damage modal (UI-GUIDELINES §7 — Escape closes, Enter confirms). */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--card); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; line-height: 1; padding: 0; }
    form { display: flex; flex-direction: column; gap: 0.6rem; }
    .hrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.8rem; }
    .hrow input { font: inherit; font-size: 0.85rem; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 6rem; text-align: right; }
    .hrow input:focus { outline: none; border-color: var(--accent); }
    .mpara { font-size: 0.78rem; line-height: 1.5; margin: 0; }
    .mpara b { font-weight: 500; }
    .mpara.hint { font-size: 0.68rem; color: var(--muted); }
    .hfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .hint { font-size: 0.68rem; color: var(--muted); }
    .hbtn { font: inherit; font-size: 0.82rem; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); }
  `;

  constructor() {
    super();
    this._weapon = null;
    this._talent = null;
    this._opts = [];
    this._sits = [];
    this._charmsOn = [];
    this._target = '';
    this._collapsed = defaultCollapsed();
    this._damageModal = false;
    this._confirmClear = false;
    this._rolls = [];
    this._lastAttack = null;
    this._attackArmed = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // Every modal/overlay here honors UI-GUIDELINES §7: Escape closes.
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
      if (this._damageModal) { this._damageModal = false; return; }
      if (this._confirmClear) { this._confirmClear = false; return; }
    };
    document.addEventListener('keydown', this._onKeydown);
    // Roll Log refreshes (device-local, shared with the Notes tab). The roll
    // modal is not a descendant, so observe its composed events at document
    // level — they still flow UP from the modal exactly once.
    this._onRollLogged = () => {
      this._loadRolls();
      // #7: once this pick has rolled an attack, track its final total + target
      // from the newest Attack log entry (authoritative merged total/difficulty).
      // Re-roll / Karma toggle upsert the same entry, so this stays current.
      if (this._attackArmed) {
        const atk = (this._rolls ?? []).find((r) => /^Attack/.test(r.label ?? ''));
        this._lastAttack = atk ? { total: atk.total ?? null, target: atk.difficulty ?? null } : null;
      }
    };
    document.addEventListener('ed-roll-logged', this._onRollLogged);
    this._loadRolls();
  }

  disconnectedCallback() {
    // Tab switch destroys this element — stash the picks so returning restores
    // them (ed-app renders only the active tab).
    this._saveScratch();
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('ed-roll-logged', this._onRollLogged);
    super.disconnectedCallback();
  }

  // Restore the cached picks on the first render (characterId is set by then).
  firstUpdated() {
    this._restoreScratch();
  }

  updated(changed) {
    if (changed.has('characterId')) {
      // Only a REAL character switch (a non-null previous id changing) resets the
      // scratchpad; the initial mount (undefined → id) must keep whatever
      // _restoreScratch brought back. Lit hands us the old value.
      const prev = changed.get('characterId');
      if (prev != null && prev !== this.characterId) {
        // Reset to defaults, then restore the incoming character's own cache if
        // it has one (prev's cache is left intact for a switch-back).
        this._resetSession();
        this._restoreScratch();
      }
      this._loadRolls();
    }
  }

  // The cacheable selections (not mid-action state: pending/undo/modals stay
  // local to a live element).
  _saveScratch() {
    if (!this.characterId) return;
    SCRATCH.set(this.characterId, {
      weapon: this._weapon,
      talent: this._talent,
      opts: [...(this._opts ?? [])],
      sits: [...(this._sits ?? [])],
      charmsOn: [...(this._charmsOn ?? [])],
      target: this._target,
      collapsed: [...(this._collapsed ?? [])],
    });
  }
  _restoreScratch() {
    const s = this.characterId ? SCRATCH.get(this.characterId) : null;
    if (!s) return;
    this._weapon = s.weapon;
    this._talent = s.talent;
    this._opts = [...s.opts];
    this._sits = [...s.sits];
    this._charmsOn = [...s.charmsOn];
    this._target = s.target;
    this._collapsed = [...s.collapsed];
  }

  _resetSession() {
    this._weapon = null;
    this._talent = null;
    this._opts = [];
    this._sits = [];
    this._charmsOn = [];
    this._target = '';
    this._collapsed = defaultCollapsed();
    this._damageModal = false;
    this._confirmClear = false;
    this._lastAttack = null;
    this._attackArmed = false;
  }

  _damageBonusBadge() {
    const n = this._damageBonus();
    if (!n) return '';
    return html`<span class="dmgbonus" title="Attack beat the target by ${n} success level${n > 1 ? 's' : ''} — +${n} to the Damage step">+${n} ✦ ${n} success${n > 1 ? 'es' : ''}</span>`;
  }
  _pend() { return html`<span class="pend">—</span>`; }
  _rating(n) { return n == null ? this._pend() : html`${n}`; }

  // --- picks (ephemeral state with model-derived defaults) ---
  // "None" (category null) is the default: no weapon, so the attack picker lists
  // *every* rollable talent/skill (a free-action / non-attack roll like Avoid
  // Blow). Picking a real weapon filters the list to that weapon's category.
  _weapons() {
    const equipped = this.model?.combat?.equippedWeapons ?? [];
    return [
      { name: 'None', category: null, damageStep: null, shortRange: null, longRange: null, image: null },
      ...equipped,
    ];
  }
  _selWeapon() {
    const list = this._weapons();
    const found = this._weapon ? list.find((w) => w.name === this._weapon) : null;
    return found ?? list[0];
  }

  // Every rollable talent + skill the character owns, deduped (talents win over a
  // same-named skill; a talent kept at its highest step). Skills carry no karma
  // context in the model, so they roll without a Karma toggle (karma: null).
  _allActions() {
    const byId = new Map();
    const push = (o) => {
      if (o.step == null) return; // unrollable → not offered
      const id = `${o.kind}:${o.name}`;
      const prev = byId.get(id);
      if (!prev || (o.step ?? -1) > (prev.step ?? -1)) byId.set(id, o);
    };
    for (const d of this.model?.disciplines ?? []) {
      for (const t of d.talents ?? []) {
        push({ id: `talent:${t.name}`, kind: 'talent', name: t.name, step: t.step, karma: t.karma ?? null, action: t.action ?? null });
      }
    }
    for (const s of this.model?.skills ?? []) {
      push({ id: `skill:${s.name}`, kind: 'skill', name: s.name, step: s.step, karma: null, action: s.action ?? null });
    }
    return [...byId.values()];
  }
  // The picker's options for the selected weapon: unfiltered for "None", else the
  // talents/skills whose name may wield the weapon's category (engine map).
  _attackOptions() {
    const all = this._allActions();
    const allowed = attackTalentNamesFor(this._selWeapon()?.category);
    const list = allowed == null ? all : all.filter((o) => allowed.includes(o.name));
    // Alphabetical by name (locale-aware).
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  _selTalent() {
    const list = this._attackOptions();
    return (this._talent ? list.find((o) => o.id === this._talent) : null) ?? list[0] ?? null;
  }

  _targetNum() {
    const t = String(this._target ?? '').trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  // --- pools (pure engine; the view never computes game values) ---
  _poolEffects() {
    return collectCombatEffects({
      selectedOptions: this._opts ?? [],
      selectedSituations: this._sits ?? [],
      selectedCharms: this._charmItems().filter((c) => (this._charmsOn ?? []).includes(c.name)),
      rules: this.model?.combatRules ?? { options: [], situations: [] },
      conditions: this.model?.combat?.conditions ?? {},
    });
  }
  _attackPool() {
    const t = this._selTalent();
    const { attackEffects } = this._poolEffects();
    return attackPool({ talentStep: t?.step ?? null, effects: attackEffects });
  }
  // #7: extra attack success levels → +steps to damage. Only while the current
  // pick's attack is armed and a target number was in play (engine clamps a miss
  // to 0). null total/target → 0.
  _damageBonus() {
    if (!this._attackArmed) return 0;
    return attackSuccessLevels(this._lastAttack?.total, this._lastAttack?.target);
  }
  _damagePool() {
    const w = this._selWeapon();
    const { damageEffects } = this._poolEffects();
    return damagePool({
      weaponDamageStep: w.damageStep ?? null,
      strengthStep: this.model?.combat?.strengthStep ?? null,
      effects: damageEffects,
      bonusSteps: this._damageBonus(),
    });
  }
  _dice(step) {
    if (step == null) return null;
    return this.model?.stepByNumber?.[step]?.dice ?? null;
  }
  _stepVal(step) {
    if (step == null) return this._pend();
    const d = this._dice(step);
    return html`Step ${step}${d ? html` · ${d}` : ''}`;
  }
  _karmaCtx(k) {
    const kc = this.model?.characteristics?.karma;
    return k?.grants?.length
      ? { grants: k.grants, available: kc?.available ?? null, step: kc?.step ?? null }
      : null;
  }

  // --- roll dispatch (Phase E — ed-app owns the modal + Roll Log) ---
  _roll(label, step, karma, kind, extra = {}) {
    if (step == null) return;
    this.dispatchEvent(new CustomEvent('ed-roll', { detail: { label, step, karma, kind, ...extra }, bubbles: true, composed: true }));
  }
  _activeNames() {
    const names = [...(this._opts ?? []), ...(this._sits ?? []), ...(this._charmsOn ?? [])];
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') : '';
  }
  _rollLabel(base, weapon) {
    const w = weapon ? ` — ${weapon}` : '';
    const names = this._activeNames();
    return names ? `${base}${w} · ${names}` : `${base}${w}`;
  }
  _rollAttack() {
    const ap = this._attackPool();
    const w = this._selWeapon();
    const opt = this._selTalent();
    if (ap.step == null) return;
    const target = this._targetNum();
    // "None" = a standalone talent/skill roll (free action), not a weapon attack:
    // label it by the talent/skill and do NOT arm the success-level damage bonus
    // (there is no weapon damage to buff). A real weapon labels "Attack — …" and
    // arms the bonus for the follow-up Damage roll (#7).
    const isNone = w?.category == null;
    this._attackArmed = !isNone;
    this._lastAttack = null;
    // Strain is charged on the roll itself (no Apply gate) — the option declares
    // the cost, so rolling the attack pays it immediately. It rides the roll's
    // label so the Combat log records it; the write is one-way (no undo).
    const base = isNone ? this._rollLabel(opt?.name ?? 'Action', null) : this._rollLabel('Attack', w.name);
    const label = ap.strain ? `${base} · ${ap.strain} strain` : base;
    this._chargeStrain(ap.strain);
    this._roll(
      label,
      ap.step,
      this._karmaCtx(opt?.karma),
      undefined,
      { difficulty: target != null ? { value: target, win: 'Hit', lose: 'Miss' } : null, mods: ap.resultMods },
    );
  }
  _rollDamage() {
    const dp = this._damagePool();
    const w = this._selWeapon();
    if (dp.step == null) return;
    this._roll(
      this._rollLabel('Damage', w.name),
      dp.step,
      this._karmaCtx(this.model?.combat?.damageKarma),
      undefined,
      { mods: dp.resultMods },
    );
  }
  _rollInitiative() {
    const c = this.model?.characteristics?.initiative;
    if (!c?.value) return;
    // Rolling Initiative signals the start of a new round: any blood charm that
    // was armed during the previous round is spent — deactivate it (chip off)
    // and unequip it (equipped:false persists; re-equip via the Equipment tab's
    // Equipped/Stored toggle once its Blood Magic Damage has healed). The spend
    // is an input write (ed-edit-items), never a game-value computation here.
    this._spendRoundCharms();
    this._roll('Initiative', c.value, this._karmaCtx(c.karma), 'initiative');
  }

  // A new round begins — store every armed blood charm (the pure state module
  // reshapes the model items; this view only dispatches the result up).
  _spendRoundCharms() {
    const armed = this._charmsOn ?? [];
    if (!armed.length) return;
    const items = unequipSpentCharms(this.model?.items ?? [], armed);
    this._charmsOn = [];
    this.dispatchEvent(new CustomEvent('ed-edit-items', { detail: items, bubbles: true, composed: true }));
  }

  // --- chips ---
  _badges(effects) {
    const out = [];
    for (const e of effects ?? []) {
      if (!e || typeof e !== 'object') continue;
      const v = e.operation === 'subtract' ? -(e.value ?? 0) : e.value ?? 0;
      const sign = v > 0 ? '+' : '';
      if (e.type === 'resource-modifier' && e.target?.domain === 'resource' && e.target?.name === 'Strain' && v) {
        out.push({ cls: 'strain', text: `${v}⚡`, title: 'Strain cost — charged once, on Apply' });
      } else if (e.type === 'test-modifier') {
        const t = e.target?.name ?? '';
        const tag = t === 'Attack' ? 'atk' : t === 'Damage' ? 'dmg' : t === 'Action' ? 'act' : t.toLowerCase();
        out.push({ cls: v >= 0 ? 'pos' : 'neg', text: `${sign}${v} ${tag}`, title: e.summary ?? '' });
      } else if (e.type === 'defense-modifier') {
        out.push({ cls: v >= 0 ? 'pos' : 'neg', text: `${sign}${v} def`, title: e.summary ?? '' });
      }
    }
    // Dedupe identical badges (e.g. −2 Physical & −2 Mystic → one "−2 def").
    return out.filter((b, i) => out.findIndex((x) => x.cls === b.cls && x.text === b.text) === i);
  }
  _chipTitle(o) {
    const parts = [];
    if (o.summary) parts.push(o.summary);
    if (o.locked) parts.push('Live condition — the sheet already applies this; it cannot be removed here.');
    return parts.join('\n');
  }
  _toggle(section, name) {
    const key = section === 'opts' ? '_opts' : section === 'sits' ? '_sits' : '_charmsOn';
    const list = [...(this[key] ?? [])];
    const i = list.indexOf(name);
    if (i >= 0) list.splice(i, 1);
    else {
      list.push(name);
      if (section === 'opts') {
        // Mutual exclusivity (A14): selecting an option clears anything it excludes.
        const bundle = (this.model?.combatRules?.options ?? []).find((o) => o.name === name);
        for (const excl of bundle?.excludes ?? []) {
          const j = list.indexOf(excl);
          if (j >= 0) list.splice(j, 1);
        }
      }
    }
    this[key] = list;
  }
  _chips(items, toggled, section, cls = '') {
    return html`<div class="chips">
      ${items.map((o) => {
        const on = o.locked || (toggled ?? []).includes(o.name);
        const badges = this._badges(o.effects ?? []);
        return html`<button
          class="chip ${cls}${o.locked ? ' locked' : ''}"
          aria-pressed=${on}
          ?disabled=${o.locked}
          title=${this._chipTitle(o)}
          @click=${() => this._toggle(section, o.name)}
        >${o.name}${badges.map((b) => html`<span class="badge ${b.cls}" title=${b.title}>${b.text}</span>`)}</button>`;
      })}
    </div>`;
  }
  _situations() {
    const cond = this.model?.combat?.conditions ?? {};
    return (this.model?.combatRules?.situations ?? []).map((b) => ({
      ...b,
      locked: (cond.knockedDown && b.name === 'Knocked Down') || (cond.harried && b.name === 'Harried'),
    }));
  }
  _charmItems() {
    return (this.model?.items ?? []).filter((it) => it.equipped && it.kind === 'blood-charm');
  }

  // Sections (collapsible, with live active-count headers).
  _sec(title, id, count, body) {
    const collapsed = (this._collapsed ?? []).includes(id);
    return html`
      <div class="sec ${collapsed ? 'collapsed' : ''}">
        <button class="sechead" aria-expanded=${!collapsed} @click=${() => this._toggleSec(id)}>
          <span>${title}${count ? html`<span class="cnt"> · ${count} on</span>` : ''}</span>
          <span class="chev" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
        </button>
        <div class="secbody">${body}</div>
      </div>`;
  }
  _toggleSec(id) {
    const c = this._collapsed ?? [];
    this._collapsed = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
  }

  // Live folded Defence/Armour figure (Overview-style, mirroring ed-overview's
  // `_char`): the derived rating + toggled session mods folded by the pure engine
  // (foldCombatRatings), tinted with a signed delta badge while mods are active.
  // Informational only (B7) — toggled mods never touch the derived Defence.
  _combatRating(r) {
    if (r.value == null) return this._pend();
    const title = `Base ${r.base}${r.mods.map((m) => ` ${m.value > 0 ? '+' : '-'}${Math.abs(m.value)} (${m.source})`).join('')}`;
    if (!r.mods.length) return html`<span class="dval" title=${title}>${r.value}</span>`;
    const net = r.delta || 0;
    const badge = net ? (net > 0 ? `+${net}` : `\u2212${Math.abs(net)}`) : '';
    const origins = r.mods.map((m) => `${m.source} ${m.value > 0 ? '+' : '-'}${Math.abs(m.value)}`).join('; ');
    return html`<span class="dval cond" title=${title}>${r.value}${badge ? html`<span class="delt" title=${`Toggled: ${origins}`}>${badge}</span>` : ''}</span>`;
  }

  _optSection() {
    const opts = this.model?.combatRules?.options ?? [];
    return this._sec('Combat options', 'opts', (this._opts ?? []).length, this._chips(opts, this._opts, 'opts'));
  }
  _sitSection() {
    const sits = this._situations();
    const locked = sits.filter((s) => s.locked).length;
    return this._sec(
      'Situational',
      'sits',
      (this._sits ?? []).length + locked,
      html`${this._standUpLine()}${this._chips(sits, this._sits, 'sits', 'sit')}`,
    );
  }
  // Knocked Down is a live condition already folded into the sheet — the Combat
  // tab can end it just like the Overview's active-effect row (both dispatch the
  // same ed-edit-health input; the engine re-derives the standing). Mirrors
  // ui/ed-overview.js "Stand up".
  _standUp() {
    this.dispatchEvent(new CustomEvent('ed-edit-health', { detail: { knockedDown: false }, bubbles: true, composed: true }));
    // Record the action in the device-local log (the same store the Combat log
    // and the Notes Roll Log read) so the round's events — not just its rolls —
    // show up. `kind: 'action'` marks it as a non-roll entry for the renderers.
    if (this.characterId) {
      saveRollLog({ rollId: uid(), at: new Date().toISOString(), kind: 'action', label: 'Stand up' }, this.characterId);
      this._loadRolls();
    }
  }
  _standUpLine() {
    if (!this.model?.combat?.conditions?.knockedDown) return '';
    return html`<div class="standrow">
      <span>Knocked Down — −3 to every test while prone.</span>
      <button class="stand" title="End the Knocked Down condition" @click=${this._standUp}>Stand up</button>
    </div>`;
  }
  _charmSection() {
    const charms = this._charmItems();
    const body = charms.length
      ? this._chips(charms, this._charmsOn, 'charms', 'charm')
      : html`<div class="empty">No blood charms equipped. Combat-relevant magic implants appear here when worn.</div>`;
    return this._sec('Blood charms', 'charms', (this._charmsOn ?? []).length, body);
  }

  // Defence & Armour block (owner-agreed Combat-UI change): the derived Defence
  // ratings and Armour values used in combat sit between the attack card and the
  // Combat Modifiers group. Purely informational (defence isn't rolled; armour is
  // a damage soak) — derived readouts only, placeholder pills until computed.
  // Toggled session mods fold into the shown figures as Overview-style delta
  // badges (foldCombatRatings) — never dispatched into the derived Defence (B7).
  // Collapsible; defaults collapsed on narrow screens.
  _defArmourSection() {
    const c = this.model?.characteristics ?? {};
    const { defenseMods, armorMods } = this._poolEffects();
    const r = foldCombatRatings(
      {
        physicalDefense: c.physicalDefense?.value,
        mysticDefense: c.mysticDefense?.value,
        socialDefense: c.socialDefense?.value,
        physicalArmor: c.physicalArmor?.value,
        mysticArmor: c.mysticArmor?.value,
      },
      defenseMods,
      armorMods,
    );
    const collapsed = (this._collapsed ?? []).includes('dab');
    return html`
      <div class="blk dablk ${collapsed ? 'collapsed' : ''}">
        <button class="dabhead" aria-expanded=${!collapsed} @click=${() => this._toggleSec('dab')}>
          <span>Defence &amp; Armour</span>
          <span class="chev" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>
        </button>
        <div class="dabbody">
          <div class="dabrow"><span class="k">Defence</span><span class="v">PD ${this._combatRating(r.defence.Physical)}<span class="sep">·</span>MD ${this._combatRating(r.defence.Mystic)}<span class="sep">·</span>SD ${this._combatRating(r.defence.Social)}</span></div>
          <div class="dabrow"><span class="k">Armour</span><span class="v">Phys ${this._combatRating(r.armour.Physical)}<span class="sep">·</span>Myst ${this._combatRating(r.armour.Mystic)}</span></div>
        </div>
      </div>
    `;
  }

  // The Potions card — sits beside Defence & Armour. Lists EVERY owned potion
  // (equipped or stored, from ed-app's arming.potions) with its ×N, and a Drink
  // button that arms a confirm then dispatches ed-use-potion. The armed one-shot
  // benefit renders as a dashed pill here too (session-only).
  _potionsSection() {
    const potions = this.arming?.potions ?? [];
    const sel = this._potionSel && potions.some((p) => p.name === this._potionSel)
      ? this._potionSel
      : potions[0]?.name ?? '';
    const p = this.arming?.pending ?? null;
    return html`
      <div class="blk dablk">
        <div class="dabhead" style="cursor: default"><span>Potions</span></div>
        <div class="dabbody">
          ${potions.length
            ? html`<div class="potpick">
                <select class="pot" aria-label="Choose a potion to drink" @change=${(e) => (this._potionSel = e.target.value)}>
                  ${potions.map((it) => html`<option value=${it.name} ?selected=${it.name === sel}>${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''}</option>`)}
                </select>
                <button class="drink" ?disabled=${!sel} @click=${() => this._askDrink(sel)}>Drink</button>
              </div>`
            : html`<div class="emptyhint">— no potions owned —</div>`}
          ${p ? this._potionPill(p) : ''}
        </div>
      </div>
    `;
  }
  _potionPill(p) {
    const emergency = p.kind === 'emergency-heal';
    const txt = emergency
      ? html`${p.name} — <b>Heal only (Step ${p.step})</b>`
      : html`${p.name} — <b>next Recovery +${p.value}</b>`;
    return html`<div class="potpend">
      <span class="ptxt">${txt}</span>
      ${emergency
        ? html`<button class="proll" title="Roll the Step ${p.step} heal — no Recovery test used" aria-label="Roll emergency heal"
            @click=${() => this._rollEmergency(p)}>⚄ Roll</button>`
        : ''}
      <button class="pclear" aria-label="Clear pending ${p.name}" title="Clear"
        @click=${() => this.dispatchEvent(new CustomEvent('ed-clear-pending-use', { bubbles: true, composed: true }))}>✕</button>
    </div>`;
  }
  // Trigger the budget-free emergency heal from the Potions pill (mirrors the
  // Overview Active Effects row) — ed-app applies it with no Recovery test used.
  _rollEmergency(p) {
    this.dispatchEvent(new CustomEvent('ed-roll', {
      detail: {
        label: `${p.name} — emergency heal`,
        step: p.step,
        apply: { action: 'emergency-recovery-heal', label: 'Heal this amount' },
      },
      bubbles: true,
      composed: true,
    }));
  }
  _askDrink(name) {
    if (name) this._usePrompt = name;
  }
  _closeDrink() {
    this.renderRoot.activeElement?.blur();
    this._usePrompt = null;
  }
  _confirmDrink() {
    const name = this._usePrompt;
    this._closeDrink();
    if (name) this.dispatchEvent(new CustomEvent('ed-use-potion', { detail: { name }, bubbles: true, composed: true }));
  }
  _useModal() {
    const name = this._usePrompt;
    if (!name) return '';
    const it = (this.arming?.potions ?? []).find((x) => x.name === name);
    const use = this.model?.itemCatalog?.[name]?.consumable?.use ?? {};
    const pending = this.arming?.pending ?? null;
    const willArm = !!(use.armNextRoll || use.emergencyHeal);
    const alreadyArmed = willArm && !!pending;
    const h = this.model?.resources?.health ?? {};
    const maxRec = this.model?.characteristics?.recoveries?.value ?? null;
    const remaining = recoveriesRemaining(h.recoveriesUsed, maxRec);
    const nothingToHeal = !!use.healWounds && (Number(h.wounds) || 0) <= 0 && (Number(h.damage) || 0) <= 0;
    const noEffectBoost = boostHasNoEffect(use, remaining);
    const emergencyDrink = !!use.emergencyHeal && remaining === 0 && !nothingToHeal;
    // Hard block when already armed or a pure boost with no Recovery test to use.
    const blocked = alreadyArmed || noEffectBoost;
    const warn = alreadyArmed
      ? 'A Recovery boost is already pending — use or clear it first. Potions don’t stack.'
      : noEffectBoost
        ? 'No Recovery tests left today — there is nothing to boost, so this potion would have no effect. Drinking it is blocked.'
        : emergencyDrink
          ? `No Recovery tests left — this heals a Wound now and arms an immediate Step ${use.emergencyHeal.step} heal (no Recovery test used). Roll it from the Potions pill or Active Effects.`
          : nothingToHeal
            ? 'No Wound and no damage to heal — the heal does nothing, but the dose will still be spent.'
            : '';
    return html`<ed-confirm
      tone="accent"
      heading="Drink ${name}?"
      message=${`Consumes one dose of ${name}${it && it.qty > 1 ? ` (×${it.qty} → ×${it.qty - 1})` : ''}.`}
      warn=${warn}
      ?disabled=${blocked}
      confirmLabel="Drink"
      @confirm=${this._confirmDrink}
      @close=${this._closeDrink}
    ></ed-confirm>`;
  }

  // Combat Modifiers group (owner-agreed Combat-UI change): the three collapsible
  // chip sections — Combat options, Situational, Blood charms — share one bordered
  // card, each keeping its own header, active count, and live chips.
  _modsGroup() {
    return html`
      <div class="blk mods">
        <div class="h"><span>Combat Modifiers</span></div>
        ${this._optSection()}
        ${this._sitSection()}
        ${this._charmSection()}
      </div>
    `;
  }

  // Charge attack Strain immediately (no Apply gate): add it to Health damage.
  // Called by _rollAttack when the pool has a strain cost. The write is one-way.
  _chargeStrain(amount) {
    if (!amount) return;
    const cur = this.model?.resources?.health ?? {};
    this._dispatchHealth({ damage: (cur.damage ?? 0) + amount });
  }

  // --- dispatch up ---
  _dispatchHealth(patch) {
    this.dispatchEvent(new CustomEvent('ed-edit-health', { detail: patch, bubbles: true, composed: true }));
  }

  // --- Damage-taken rail ---
  _statusPill() {
    const s = this.model?.healthState?.state;
    const labels = { unhurt: 'Unhurt', conscious: 'Conscious', unconscious: 'Unconscious', dead: 'Dead' };
    if (!s || !labels[s]) return '';
    return html`<span class="status ${s === 'unconscious' || s === 'dead' ? 'warn' : ''}">${labels[s]}</span>`;
  }
  _curDmg() {
    const h = this.model?.resources?.health ?? {};
    if (this.editMode) {
      return html`<input class="curdmg" type="number" min="0" step="1" .value=${String(h.damage ?? 0)} aria-label="Current damage" @change=${(e) => this._dispatchHealth({ damage: Math.max(0, Number(e.target.value) || 0) })} />`;
    }
    return html`<span class="curdmg val">${h.damage ?? 0}</span>`;
  }
  _curWounds() {
    const h = this.model?.resources?.health ?? {};
    if (this.editMode) {
      return html`<input class="curdmg curwnd" type="number" min="0" step="1" .value=${String(h.wounds ?? 0)} aria-label="Current wounds" @change=${(e) => this._dispatchHealth({ wounds: Math.max(0, Number(e.target.value) || 0) })} />`;
    }
    return html`<span class="curdmg curwnd val">${h.wounds ?? 0}</span>`;
  }
  _damageTbl() {
    const u = this.model?.characteristics?.unconsciousness?.value;
    const d = this.model?.characteristics?.death?.value;
    const h = this.model?.resources?.health ?? {};
    const maxRec = this.model?.characteristics?.recoveries?.value ?? null;
    const remaining = recoveriesRemaining(h?.recoveriesUsed, maxRec);
    const noRecoveries = remaining != null && remaining <= 0;
    // A step-boost armed from a potion bumps the next Recovery test — surface the
    // +N on the button so the player knows before rolling (the bump lives in ed-app).
    const boost = armedRecoveryBonus(this.arming?.pending).stepBonus;
    const recTitle = noRecoveries
      ? 'No Recovery Tests left today — reset for a new day'
      : boost
        ? `Recovery test (+${boost} step armed) — heals the Toughness Effect result, uses one`
        : 'Recovery test — heals the Toughness Effect result, uses one';
    return html`
      <div class="blk dtcol">
        <div class="h"><span>Damage taken</span>${this._statusPill()}</div>
        <div class="cur"><span class="lab">Current</span>${this._curDmg()}<span class="lab">Wounds</span>${this._curWounds()}</div>
        <div class="thr">${this._rating(u)} unconscious<br />${this._rating(d)} death</div>
        <div class="dtbtns">
          <button class="roll" @click=${this._openDamage} title="Take damage — wounds and Knockdown resolve via the engine" aria-label="Take damage">✚</button>
          <button class="roll ${boost ? 'boosted' : ''}" ?disabled=${noRecoveries} @click=${this._recoveryTest}
            title=${recTitle}
            aria-label=${boost ? `Recovery test, plus ${boost} step armed` : 'Recovery test'}>⚄</button>
        </div>
      </div>`;
  }
  _openDamage() {
    this._damageDraft = { take: 0, heal: 0 };
    this._damageModal = true;
  }
  _applyDamage() {
    const d = this._damageDraft ?? {};
    const cur = this.model?.resources?.health ?? {};
    const take = d.take ?? 0;
    const heal = d.heal ?? 0;
    const wt = this.model?.characteristics?.woundThreshold?.value;
    // The Wound is derived from the hit vs. the Wound Threshold — never typed
    // in (store only inputs), and the engine decides it like the Overview tab.
    const wound = take > 0 ? woundsFromHit(take, wt) : 0;
    const next = applyHealth(cur, { damage: take - heal, wounds: wound, recoveriesUsed: 0 });
    this._dispatchHealth(next);
    this._damageModal = false;
    // A hit five or more over the Wound Threshold forces a Knockdown test.
    const kd = this.model?.characteristics?.knockdown;
    if (take > 0 && kd?.value != null && knockdownTriggered(take, wt)) {
      this._roll(
        'Knockdown test',
        kd.value,
        null,
        'knockdown',
        { difficulty: { value: knockdownDifficulty(take, wt) }, apply: { action: 'knockdown-result' } },
      );
    }
  }
  _recoveryTest() {
    const tou = (this.model?.attributes ?? []).find((a) => a.name === 'Toughness');
    if (tou?.step == null) return;
    // Defence-in-depth: the button is disabled at 0, but never roll a test the
    // character has no budget for (the apply site refuses it anyway).
    const h = this.model?.resources?.health ?? {};
    const maxRec = this.model?.characteristics?.recoveries?.value ?? null;
    const remaining = recoveriesRemaining(h?.recoveriesUsed, maxRec);
    if (remaining != null && remaining <= 0) return;
    this._roll('Recovery test', tou.step, null, undefined, { apply: { action: 'recovery-heal', label: 'Heal this amount' } });
  }

  // --- Combat log (device-local Roll Log view: rolls + actions) ---
  _loadRolls() {
    if (!this.characterId) { this._rolls = []; return; }
    this._rolls = loadRollLog(this.characterId).entries;
  }
  _clearLog() {
    this._confirmClear = false;
    if (this.characterId) { clearRollLog(this.characterId); this._loadRolls(); }
  }
  _logRow(r) {
    // Non-roll entries (e.g. Stand up) render as a plain action line — no
    // fabricated step or total (UI-GUIDELINES §5).
    if (r.kind === 'action') {
      return html`<div class="logrow">
        <span class="lt" aria-hidden="true">↑</span>
        <span class="lx"><b>${r.label ?? 'Action'}</b></span>
      </div>`;
    }
    const mods = r.mods ?? [];
    const glyph = /attack|damage/i.test(r.label ?? '') ? '⚔' : '⚄';
    const outcome = r.outcome
      ? html` — <span class="${r.outcome.ok ? 'hit' : 'miss'}">${r.outcome.word}</span>`
      : '';
    const modsText = mods.length
      ? html` · <span class="mods">${mods.map((m) => m.label).join(', ')}</span>`
      : '';
    return html`<div class="logrow">
      <span class="lt" aria-hidden="true">${glyph}</span>
      <span class="lx">
        <b>${r.label ?? 'Roll'}</b> Step ${r.step ?? '—'} → <b>${r.total ?? '—'}</b>
        ${r.difficulty != null ? html` vs D${r.difficulty}` : ''}
        ${outcome}${modsText}
      </span>
    </div>`;
  }
  _logBlock() {
    return html`
      <div class="blk logblk">
        <div class="h"><span>Combat log</span>
          <button class="clear" @click=${() => (this._confirmClear = true)} ?disabled=${!this._rolls.length}>clear</button>
        </div>
        ${this._rolls.length
          ? html`<div class="log">${this._rolls.map((r) => this._logRow(r))}</div>`
          : html`<div class="logempty">No rolls yet — roll to begin. This log lives in this browser only (the Notes Roll Log).</div>`}
      </div>`;
  }

  // --- weapon image (repo-image pattern, UI-GUIDELINES §6; missing-image fallback) ---
  _artBox() {
    const w = this._selWeapon();
    const url = w?.image ? portraitUrlFor(w.image) : null;
    return html`<div class="artbox" title=${w?.name ?? ''}>
      ${url && this._artOk !== false
        ? html`<img src=${url} alt=${w?.name ?? 'weapon'} @error=${() => (this._artOk = false)} />`
        : html`<div class="missing">${MISSING_IMAGE}<span class="cap">no image</span></div>`}
    </div>`;
  }

  render() {
    const ap = this._attackPool();
    const dp = this._damagePool();
    const w = this._selWeapon();
    const talent = this._selTalent();
    const init = this.model?.characteristics?.initiative;
    const range = w?.category !== 'melee' && w?.shortRange
      ? html` <span class="v ranged">${w.shortRange}${w.longRange ? ` / ${w.longRange}` : ''} yd</span>`
      : '';
    return html`
      <div class="top">
          <div class="blk atkblk">
            <div class="h">
              <span>Your attack</span>
              <span class="r">Initiative <b>${init?.value ?? this._pend()}</b>
                <button class="roll" ?disabled=${!init?.value} title="Roll initiative" aria-label="Roll initiative" @click=${this._rollInitiative}>⚄</button>
              </span>
            </div>

            <div class="attacktop">
              ${this._artBox()}
              <div class="attackrows">
                <div class="row2">
                  <select aria-label="Weapon" .value=${w.name} @change=${(e) => { this._weapon = e.target.value; this._talent = null; this._artOk = true; }}>
                    ${this._weapons().map((x) => html`<option value=${x.name}>${x.name}${x.damageStep != null ? html` · dmg ${x.damageStep}` : ''}</option>`)}
                  </select>
                  <select aria-label="Attack talent or skill" .value=${talent?.id ?? ''} @change=${(e) => { this._talent = e.target.value; this._attackArmed = false; this._lastAttack = null; }}>
                    ${this._attackOptions().length
                      ? this._attackOptions().map((o) => html`<option value=${o.id}>${o.name}${o.kind === 'skill' ? ' · Skill' : ' · Talent'}${o.action ? ` · ${o.action}` : ''} · ${o.step}</option>`)
                      : html`<option value="">${w.category == null ? 'No talents or skills' : 'No matching talent/skill'}</option>`}
                  </select>
                </div>
                <div class="statline">
                  <span class="k">Attack</span>
                  <span class="v">${this._stepVal(ap.step)}</span>
                  <span class="vs">vs <input type="number" placeholder="#" .value=${this._target ?? ''} aria-label="Target number to beat (empty = GM adjudicates)" @input=${(e) => (this._target = e.target.value)} /></span>
                  <button class="roll" ?disabled=${ap.step == null} title="Roll attack" aria-label="Roll attack" @click=${this._rollAttack}>⚄</button>
                </div>
                <div class="statline">
                  <span class="k">Damage</span>
                  <span class="v">${this._stepVal(dp.step)}${range}${this._damageBonusBadge()}</span>
                  <button class="roll" ?disabled=${dp.step == null} title="Roll damage" aria-label="Roll damage" @click=${this._rollDamage}>⚄</button>
                  <span class="strain-k">Strain</span><span class="strain">${ap.strain}</span>
                </div>
              </div>
            </div>
          </div>

          ${this._damageTbl()}

          <div class="dabpair">
            ${this._defArmourSection()}
            ${this._potionsSection()}
          </div>
          ${this._modsGroup()}
          ${this._logBlock()}
      </div>

      ${this._damageModal
        ? this._damageModalTpl()
        : ''}
      ${this._confirmClear
        ? html`<ed-confirm
            heading="Clear the Combat log?"
            message="This clears the Roll Log for this character in this browser — it also clears the Notes-tab Roll Log. It can't be undone."
            confirmLabel="Clear"
            @confirm=${this._clearLog}
            @close=${() => (this._confirmClear = false)}
          ></ed-confirm>`
        : ''}
      ${this._useModal()}
    `;
  }

  _damageModalTpl() {
    const h = this.model?.resources?.health ?? {};
    const st = this.model?.healthState;
    const d = this._damageDraft ?? {};
    const stateWord =
      st?.state && st.state !== 'unhurt'
        ? html` · <b>${st.state === 'dead' ? 'Dead' : st.state === 'unconscious' ? 'Unconscious' : 'Conscious'}</b>`
        : '';
    const wt = this.model?.characteristics?.woundThreshold?.value;
    return html`
      <div class="overlay" @click=${() => (this._damageModal = false)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Take damage" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>Take damage</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._damageModal = false)}>✕</button>
          </div>
          <p class="mpara">Current damage <b>${h.damage ?? 0}</b>${stateWord} — Unconscious ${this._rating(this.model?.characteristics?.unconsciousness?.value)} · Death ${this._rating(this.model?.characteristics?.death?.value)}</p>
          <form @submit=${(e) => { e.preventDefault(); this._applyDamage(); }}>
            <div class="hrow"><span>Take damage</span><input type="number" min="0" step="1" .value=${d.take ?? 0} aria-label="Damage to take" @input=${(e) => (d.take = Math.max(0, Number(e.target.value) || 0))} /></div>
            <div class="hrow"><span>Heal</span><input type="number" min="0" step="1" .value=${d.heal ?? 0} aria-label="Damage to heal" @input=${(e) => (d.heal = Math.max(0, Number(e.target.value) || 0))} /></div>
            <p class="mpara hint">A hit at or above the Wound Threshold ${this._rating(wt)} records one Wound; a hit five or more over it triggers a Knockdown test.</p>
            <div class="hfoot">
              <span class="hint">Enter applies · Escape closes</span>
              <button type="submit" class="hbtn">Apply</button>
            </div>
          </form>
        </div>
      </div>`;
  }
}

customElements.define('ed-combat', EdCombat);
