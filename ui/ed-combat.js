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
// (owner decision). The Combat log is a view of the device-local Log
// (store-rolllog.js, shared with the Notes tab): every roll lands here, and the
// round's non-roll actions (Stand up) are recorded too, marked `kind: 'action'`.
import { LitElement, html, css } from 'lit';
import { attackPool, damagePool, auditPool, collectCombatEffects, foldCombatRatings, attackTalentNamesFor, attackSuccessLevels, successCount } from '../engine/combat.js';
import { applyHealth, woundsFromHit, knockdownTriggered, knockdownDifficulty, recoveriesRemaining } from '../engine/health.js';
import { armedRecoveryBonus, boostHasNoEffect } from '../engine/potions.js';
import { loadRollLog, clearRollLog, saveRollLog } from '../store-rolllog.js';
import { itemImageUrl } from '../store.js';
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

export function clearCombatScratch(id, mountedEl = null) {
  if (!id) return;
  // Decision D: the cache keeps the day-scoped fields clear while preserving the
  // picks (weapon / talent / collapsed) so an unmounted Combat tab restores them.
  const cached = SCRATCH.get(id);
  if (cached) SCRATCH.set(id, { ...cached, opts: [], sits: [], charmsOn: [], target: '' });
  // The mounted Combat tab lives under ed-app's shadow root, so callers pass the
  // current element explicitly when available.
  if (mountedEl?.characterId === id && typeof mountedEl._clearDayState === 'function') {
    mountedEl._clearDayState();
  }
}

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
    // The step-audit modal: which pool's breakdown to show ('attack' | 'damage'
    // | null). And the manually-entered success count used to buff the Damage
    // step when an attack was rolled with no target number (GM adjudicates).
    _stepAudit: { state: true },
    _manualSuccesses: { state: true },
    _confirmClear: { state: true },
    _rolls: { state: true },
    // #7 success-level damage bonus: the last attack this pick rolled ({ total,
    // target }) and whether it's still "armed" (cleared when the weapon/talent
    // pick changes, so a stale attack never buffs an unrelated damage roll).
    _lastAttack: { state: true },
    _attackArmed: { state: true },
    // Aim options (Mystic Aim): the success count of the armed aim test (0 =
    // not armed — not rolled, missed, or consumed). Each success arms +2 steps to
    // the Attack test. `_aimConsumed` marks that a buffed Attack has been rolled,
    // so the persistent aim Roll-Log entry does not re-arm until a fresh aim.
    // Both clear on a new round (Initiative), a pick change, or deselect.
    _aimSuccesses: { state: true },
    _aimConsumed: { state: true },
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
      /* Stacked on mobile: the log is its own row again, capped so it never runs long. */
      .logblk .log { max-height: 320px; flex: none; }
    }
    .top > * { min-width: 0; } /* let grid children shrink instead of overflow */
    .top > .atkblk { grid-area: atk; }
    .top > .dtcol { grid-area: dmg; }
    .top > .dabpair { grid-area: dab; }
    .top > .mods { grid-area: mods; }
    /* The log spans the dab+mods rows and STRETCHES to fill them, so its bottom
       lines up with the Combat Modifiers card. min-height:0 keeps its content from
       inflating the grid rows; the inner .log scrolls instead. */
    .top > .logblk { grid-area: log; min-height: 0; }
    .logblk { display: flex; flex-direction: column; }

    .blk { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
    .h { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: var(--fs-eyebrow); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 6px; }
    .h .r { color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0; font-size: var(--fs-small); display: inline-flex; align-items: center; gap: 6px; }
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
    .artbox .cap { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.05em; }

    select { font: inherit; font-size: var(--fs-body); width: 100%; padding: 4px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-chip); color: inherit; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; }

    .statline { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: var(--fs-body); border-top: 1px solid var(--border); }
    .statline .k { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 54px; flex: none; }
    .statline .v { flex: 1; font-weight: 500; font-variant-numeric: tabular-nums; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .statline .v.ranged { font-size: var(--fs-eyebrow); color: var(--muted); font-weight: 400; margin-left: 4px; }
    .dmgbonus { flex: none; font-size: var(--fs-eyebrow); font-weight: 500; color: var(--karma); background: var(--bg-chip); border: 1px solid var(--karma); border-radius: 999px; padding: 0 6px; white-space: nowrap; }
    .roll { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--fs-small); flex: none; padding: 0; line-height: 1; }
    .roll:disabled { opacity: 0.4; cursor: default; }
    .roll.reset { border-color: var(--karma); background: light-dark(#e7f0ea, #223029); color: var(--karma); }
    /* Take-damage carries the emergency (danger) tone to read apart from the rolls. */
    .roll.dmg { border-color: var(--danger); background: var(--danger-bg); color: var(--danger); }

    .vs { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-fine); color: var(--muted); }
    .vs input { width: 46px; font: inherit; font-size: var(--fs-body); font-weight: 500; text-align: right; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px; }
    .vs input:focus { outline: none; border-color: var(--accent); }
    .strain-k { margin-left: 14px; font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); flex: none; }
    .strain { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--danger); flex: none; min-width: 14px; text-align: right; }

    /* Collapsible chip sections. */
    .sec { margin-top: 8px; }
    .sechead { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; cursor: pointer; font-weight: 500; font-size: var(--fs-eyebrow); line-height: 1.4; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); user-select: none; background: none; border: none; padding: 0; }
    .sechead .chev { font-size: var(--fs-fine); }
    .sechead .cnt { color: var(--accent); }
    .sec.collapsed .secbody { display: none; }
    .secbody { margin-top: 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: var(--fs-small); padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-chip); color: inherit; cursor: pointer; user-select: none; }
    .chip:hover { border-color: var(--accent); }
    .chip[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
    .chip.locked { opacity: 0.85; cursor: default; }
    .chip.locked:hover { border-color: var(--border); }
    .chip.spent { opacity: 0.4; cursor: default; }
    .chip.spent:hover { border-color: var(--border); }
    .chip.aimed[aria-pressed='true'] { border-color: var(--good, #3d6b4a); background: var(--good-bg, light-dark(#e7f0ea, #223029)); color: var(--good, light-dark(#3d6b4a, #82c39a)); }
    .chip.charm[aria-pressed='true'] { border-color: var(--blood); background: var(--blood-bg); color: var(--blood); }
    .badge { font-size: var(--fs-eyebrow); padding: 0 4px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
    .chip[aria-pressed='true'] .badge { border-color: currentColor; }
    .badge.pos { color: var(--karma); }
    .badge.neg { color: var(--danger); }
    .badge.strain { color: var(--danger); }
    .empty { background: var(--bg-card); border: 1px dashed var(--border); border-radius: 8px; padding: 8px 10px; text-align: center; font-size: var(--fs-small); color: var(--muted); line-height: 1.45; }

    /* Live folded Defence/Armour figures (Overview-style): tinted with the
       danger colour while toggled session mods are active (signed delta badge). */
    .dval.cond { color: var(--danger); }
    .dval .delt { margin-left: 3px; font-size: var(--fs-eyebrow); font-weight: 500; line-height: 1; padding: 1px 4px; border-radius: 999px; background: var(--danger-bg); color: var(--danger); vertical-align: 1px; white-space: nowrap; }

    /* Stand-up affordance — mirrors the Overview active-effect row (§2 Stand up). */
    .standrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: var(--fs-fine); color: var(--danger); padding: 4px 8px; margin-bottom: 6px; background: var(--danger-bg); border-radius: 6px; }
    .stand { flex: none; font: inherit; font-size: var(--fs-eyebrow); font-weight: 500; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--accent); background: none; color: var(--accent); cursor: pointer; }
    .stand:hover { background: var(--accent-bg); }

    /* Defence & Armour block: derived readouts only — a value the engine hasn't
       produced yet renders as a placeholder pill, never a fabricated number
       (UI-GUIDELINES §5). Collapsible like the chip sections; defaults to
       collapsed on narrow screens (owner decision), expanded on desktop. */
    .dabhead { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; cursor: pointer; font-weight: 500; font-size: var(--fs-eyebrow); line-height: 1.4; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); user-select: none; background: none; border: none; padding: 0; }
    .dabhead .chev { font-size: var(--fs-fine); }
    .dabrow { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; font-size: var(--fs-small); padding: 2px 0; font-variant-numeric: tabular-nums; }
    .dabrow .k { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 52px; flex: none; }
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
    select.pot { font: inherit; font-size: var(--fs-small); color: var(--fg); background: var(--card); border: 1px solid var(--border); border-radius: 7px; padding: 5px 7px; flex: 1; min-width: 0; }
    .drink { font: inherit; font-size: var(--fs-fine); font-weight: 500; border: 1px solid var(--accent); background: var(--accent); color: #fff; padding: 5px 12px; border-radius: 999px; cursor: pointer; flex: 0 0 auto; }
    .drink:disabled { opacity: 0.4; cursor: not-allowed; }
    .emptyhint { font-size: var(--fs-fine); color: var(--muted); padding: 2px 0; }
    .potpend { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; background: var(--accent-bg); border: 1px dashed var(--accent); margin-top: 6px; }
    .potpend .ptxt { flex: 1; font-size: var(--fs-fine); color: var(--fg); }
    .potpend .ptxt b { color: var(--accent); font-weight: 500; }
    .potpend .proll { flex: 0 0 auto; font: inherit; font-size: var(--fs-eyebrow); font-weight: 500; white-space: nowrap; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--accent); background: none; color: var(--accent); cursor: pointer; }
    .potpend .proll:hover { background: var(--accent-bg); }
    .potpend .pclear { background: none; border: none; color: var(--muted); cursor: pointer; font-size: var(--fs-body); line-height: 1; padding: 2px 4px; }

    /* Placeholder pill (UI-GUIDELINES §5) — a derived value the engine hasn't
       produced yet renders dashed, never as a fabricated number. */
    .pend { font-weight: 400; color: var(--muted); border: 1px dashed var(--muted); border-radius: 999px; padding: 0 6px; font-size: var(--fs-small); }

    /* Damage-taken rail. Flex column so, when the card stretches to match the
       Attack card's height, the take-damage/recovery buttons sink to the bottom. */
    .dtcol { display: flex; flex-direction: column; }
    .dtcol .cur { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
    .dtcol .cur .lab { font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); white-space: nowrap; }
    .dtcol .curdmg { width: 46px; font: inherit; font-size: var(--fs-value); font-weight: 500; text-align: right; color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 8px; padding: 4px 6px; box-sizing: border-box; }
    .dtcol .curdmg.val { width: auto; min-width: 16px; border: none; background: none; padding-left: 0; font-variant-numeric: tabular-nums; }
    /* Wounds sits inline beside damage — same row, no extra height. */
    .dtcol .curwnd { color: var(--danger); }
    .dtcol .thr { font-size: var(--fs-fine); color: var(--muted); margin-top: 6px; line-height: 1.5; }
    .dtcol .thr.rec { margin-top: 3px; }
    .dtcol .thr.rec b { color: var(--fg); font-weight: 500; }
    .dtcol .dtbtns { display: flex; gap: 6px; margin-top: auto; padding-top: 9px; }
    .status { font-size: var(--fs-eyebrow); font-weight: 500; padding: 1px 9px; border-radius: 999px; background: var(--bg-chip); color: var(--muted); white-space: nowrap; border: 1px solid var(--border); }
    .status.warn { background: var(--danger-bg); color: var(--danger); border-color: transparent; }

    /* Combat log — a view of the device-local Log (rolls + actions). */
    .clear { font: inherit; font-size: var(--fs-eyebrow); text-transform: uppercase; letter-spacing: 0.04em; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; }
    .clear:hover { color: var(--danger); border-color: var(--danger); }
    .clear:disabled { opacity: 0.4; cursor: default; }
    .log { display: flex; flex-direction: column; flex: 1 1 0; min-height: 0; overflow: auto; }
    .logrow { display: flex; gap: 7px; align-items: baseline; font-size: var(--fs-small); padding: 4px 0; border-top: 1px solid var(--border); }
    .logrow:first-child { border-top: none; }
    .logrow .lt { flex: none; width: 14px; text-align: center; color: var(--accent); font-size: var(--fs-fine); }
    .logrow .lx { min-width: 0; color: var(--muted); line-height: 1.35; }
    .logrow .lx b { color: var(--fg); font-weight: 500; }
    .logrow .lx .hit { color: var(--karma); font-weight: 500; }
    .logrow .lx .miss { color: var(--danger); font-weight: 500; }
    .logrow .lx .mods { color: var(--muted); }
    .logempty { font-size: var(--fs-small); color: var(--muted); line-height: 1.4; }

    /* Take-damage modal (UI-GUIDELINES §7 — Escape closes, Enter confirms). */
    .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 1rem; }
    .modal { background: var(--card); color: var(--fg); border: 1px solid var(--border); border-radius: 12px; width: 26rem; max-width: 100%; padding: 1rem 1.25rem 1.25rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .mhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: var(--fs-value); font-weight: 500; margin-bottom: 0.75rem; }
    .mclose { background: none; border: none; color: var(--muted); font-size: var(--fs-title); cursor: pointer; line-height: 1; padding: 0; }
    form { display: flex; flex-direction: column; gap: 0.6rem; }
    .hrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--fs-body); }
    .hrow input { font: inherit; font-size: var(--fs-body); color: var(--fg); background: var(--bg-chip); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; width: 6rem; text-align: right; }
    .hrow input:focus { outline: none; border-color: var(--accent); }
    .mpara { font-size: var(--fs-small); line-height: 1.5; margin: 0; }
    .mpara b { font-weight: 500; }
    .mpara.hint { font-size: var(--fs-fine); color: var(--muted); }
    .hfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
    .hint { font-size: var(--fs-fine); color: var(--muted); }
    .hbtn { font: inherit; font-size: var(--fs-body); font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1px solid var(--accent); background: var(--accent-bg); color: var(--accent); }
    /* Step-audit: a small info button on the Attack/Damage rows + its modal. */
    .info { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border); background: none; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--fs-fine); flex: none; padding: 0; line-height: 1; }
    .info:hover { border-color: var(--accent); color: var(--accent); }
    .audit { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-body); }
    .arow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 3px 0; }
    .arow .al { color: var(--fg); }
    .arow .av { font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .arow .av.neg { color: var(--danger, #a63a2b); }
    .arow.total { border-top: 1px solid var(--border); margin-top: 3px; padding-top: 6px; }
    .asec { font-size: var(--fs-fine); color: var(--muted); margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border); line-height: 1.5; }
    .aempty { font-size: var(--fs-small); color: var(--muted); }
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
    this._stepAudit = null;
    this._manualSuccesses = '';
    this._confirmClear = false;
    this._rolls = [];
    this._lastAttack = null;
    this._attackArmed = false;
    this._aimSuccesses = 0;
    this._aimConsumed = false;
    this._aimSince = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // Every modal/overlay here honors UI-GUIDELINES §7: Escape closes.
    this._onKeydown = (e) => {
      if (e.key !== 'Escape') return;
      if (this._stepAudit) { this._stepAudit = null; return; }
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
      // Aim options (Mystic Aim): reflect the latest aim test's success count. The
      // log is newest-first, so the first entry whose label starts with the toggled
      // aim option's name is that test — arm `2 × successes` steps only when it HIT
      // *and* the entry is newer than this option's last selection (`_aimSince`,
      // stops a stale prior-round entry re-arming). Once a buffed Attack has been
      // rolled (`_aimConsumed`), stay disarmed until the next aim roll. MA4/MA6.
      const aimOpt = this._aimOption();
      if (aimOpt && !this._aimConsumed) {
        const entry = (this._rolls ?? []).find((r) => (r.label ?? '').startsWith(aimOpt.name));
        const fresh = entry && this._aimSince != null && Date.parse(entry.at ?? '') >= this._aimSince;
        this._aimSuccesses = fresh && entry.outcome?.ok ? successCount(entry.total, entry.difficulty) : 0;
        // Consume: an Attack logged AFTER this aim spends the bonus (one buffed
        // attack, then re-aim). The buffed Attack already baked the steps into its
        // rolled step at dispatch; this only stops the NEXT attack re-using them.
        if (this._aimSuccesses > 0 && entry) {
          const atk = (this._rolls ?? []).find((r) => /^Attack/.test(r.label ?? ''));
          if (atk && Date.parse(atk.at ?? '') > Date.parse(entry.at ?? '')) {
            this._aimConsumed = true;
            this._aimSuccesses = 0;
          }
        }
      } else if (!aimOpt) {
        this._aimSuccesses = 0;
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
    if (changed.has('model')) {
      // Global blood-charm activation (session.activeCharms) is the engine-level
      // source of truth — keep the local SCRATCH `_charmsOn` in sync so the chip
      // state, the pool, and the persisted scratch all converge. The union read in
      // `_activeCharmNames()` tolerates a stale local until this sync lands.
      const global = this.model?.activeCharms;
      if (Array.isArray(global) && JSON.stringify(global) !== JSON.stringify(this._charmsOn ?? [])) {
        this._charmsOn = [...global];
      }
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
    this._stepAudit = null;
    this._manualSuccesses = '';
    this._confirmClear = false;
    this._lastAttack = null;
    this._attackArmed = false;
    this._aimSuccesses = 0;
    this._aimConsumed = false;
  }

  _clearDayState() {
    this._opts = [];
    this._sits = [];
    this._charmsOn = [];
    this._target = '';
    this._damageModal = false;
    this._stepAudit = null;
    this._manualSuccesses = '';
    this._confirmClear = false;
    this._lastAttack = null;
    this._attackArmed = false;
    this._aimSuccesses = 0;
    this._aimConsumed = false;
  }

  _damageBonusBadge() {
    const n = this._damageBonus();
    if (!n) return '';
    // Compact: just the +N; the hover explains it is the attack's success levels.
    return html`<span class="dmgbonus" title="${n} success level${n > 1 ? 's' : ''} on the attack — +${n} to the Damage step">+${n}</span>`;
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

  // Every combat-option bundle the player may toggle: the global rules/combat.json
  // options plus any offered by the selected weapon itself (its `combatOptions`,
  // folded by names like a rules bundle — the engine reads `rules.options` so the
  // merged list keeps the collection pure and unchanged). Weapon-scoped bundles
  // render first so they sit next to the thing they act on.
  // Bundles that declare `appliesTo` (engine weapon-category tags) or `restricted`
  // (an exact rules/races.json race name) are filtered to the current pick: a
  // scoped option only renders while the selected roll is one of the attack types
  // it may drive and the character's race permits it. Toggled names that fall out
  // of scope are simply not folded (collectCombatEffects ignores names absent from
  // the list), so switching to an applicable pick re-shows the same chips.
  _allOptions() {
    const global = this.model?.combatRules?.options ?? [];
    // Item-scoped bundles come from two places: the selected weapon (offered only
    // while it is picked) and equipped non-weapon thread items (`combat.itemOptions`
    // — armour/trinkets, always offered while equipped, e.g. Dark Archer Armour's
    // Horror-ward). Talent-scoped bundles (`combat.talentOptions`, e.g. True Shot)
    // are offered while the granting talent is owned. All render before the global
    // rules bundles; `appliesTo`/`restricted` scope-filtering below applies to all.
    const itemOpts = this.model?.combat?.itemOptions ?? [];
    const talentOpts = this.model?.combat?.talentOptions ?? [];
    const list = [...(this._selWeapon()?.combatOptions ?? []), ...itemOpts, ...talentOpts, ...global];
    const scopes = this._attackScopes();
    const race = this.model?.meta?.race;
    return list.filter((o) => {
      if (o.appliesTo && !scopes.some((s) => o.appliesTo.includes(s))) return false;
      if (o.restricted && o.restricted !== race) return false;
      return true;
    });
  }
  // The attack types the current pick can roll, as weapon-category tags. A real
  // weapon fixes its scope from its category; with "None" the scope resolves from
  // the selected talent/skill name through the engine's category map, so e.g.
  // Unarmed Combat → 'unarmed'. Non-attack picks (skills, defenses, free actions)
  // yield no scope, hiding every scoped option.
  _attackScopes() {
    const w = this._selWeapon();
    if (w?.category) return [w.category];
    const name = this._selTalent()?.name;
    if (!name) return [];
    return ['melee', 'missile', 'throwing', 'unarmed'].filter((c) => attackTalentNamesFor(c).includes(name));
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
        push({
          id: `talent:${t.name}`,
          kind: 'talent',
          name: t.name,
          step: t.step,
          karma: t.karma ?? null,
          action: t.action ?? null,
          // Rank-grant data (PLAN-RANK-GRANTS.md): the step audit itemises the
          // pre-grant base and the folded grant source instead of hiding it.
          stepBase: t.stepBase,
          rankBonus: t.rankBonus,
          grantSources: t.grantSources ?? [],
          // Active test-modifiers folded onto this talent (a sustained spell's +N
          // step, etc.) — the step audit itemises them off the pre-modifier base.
          rollMods: t.rollMods ?? [],
        });
      }
    }
    for (const s of this.model?.skills ?? []) {
      push({
        id: `skill:${s.name}`,
        kind: 'skill',
        name: s.name,
        step: s.step,
        karma: null,
        action: s.action ?? null,
        stepBase: s.stepBase,
        rankBonus: s.rankBonus,
        grantSources: s.grantSources ?? [],
        rollMods: s.rollMods ?? [],
      });
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
  // The globally activated blood-charms (session.activeCharms, folded by the
  // engine so the effect is an effect regardless of tab). The Combat tab's local
  // SCRATCH `_charmsOn` is the legacy per-tab toggle; the model `activeCharms`
  // is the engine-level source when present (ed-app dispatches `ed-toggle-charm`).
  // We read the union so a toggle in either layer is honoured during migration.
  _activeCharmNames() {
    const fromModel = this.model?.activeCharms ?? [];
    const fromScratch = this._charmsOn ?? [];
    return [...new Set([...fromModel, ...fromScratch])];
  }
  _poolEffects() {
    const charmNames = this._activeCharmNames();
    return collectCombatEffects({
      selectedOptions: this._opts ?? [],
      selectedSituations: this._sits ?? [],
      selectedCharms: this._charmItems().filter((c) => charmNames.includes(c.name)),
      selectedWeaponEffects: this._selWeapon()?.effects ?? [],
      rules: this.model?.combatRules
        ? { options: this._allOptions(), situations: this.model.combatRules.situations ?? [] }
        : { options: [], situations: [] },
      conditions: this.model?.combat?.conditions ?? {},
      // A hit aim test arms its option's on-success effect, scaled by the success
      // count (Mystic Aim: +2 steps × successes). Map: { optionName: successCount }.
      armedOptions: this._aimSuccesses > 0 && this._aimOption() ? { [this._aimOption().name]: this._aimSuccesses } : {},
    });
  }
  _attackPool() {
    const t = this._selTalent();
    const { attackEffects } = this._poolEffects();
    const ap = attackPool({ talentStep: t?.step ?? null, effects: attackEffects, activeTalent: t?.name });
    // A selected TALENT may carry active test-modifier result mods (e.g. a
    // sustained spell's +4 Stealthy Stride) folded onto the model by the engine.
    // The combat attack builder gathers only combat-scoped effects, so merge the
    // talent's result mods here — same universal data the Disciplines tab uses.
    // Activated blood-charms are already in `attackEffects` via `selectedCharms`
    // above, so exclude them from the talent-merge to avoid double-counting the
    // same +6 (global activeEffects + combat selectedCharms). Other active mods
    // (sustained spells) still merge.
    const charmSet = new Set(this._activeCharmNames());
    const testMods = this._talentResultMods(t?.name).filter((m) => !charmSet.has(m.source));
    return testMods.length ? { ...ap, resultMods: [...ap.resultMods, ...testMods] } : ap;
  }

  // The active test-modifier result mods on a model talent by name (empty for a
  // weapon attack or a talent with none).
  _talentResultMods(name) {
    if (!name) return [];
    for (const d of this.model?.disciplines ?? [])
      for (const tl of d.talents ?? [])
        if (tl.name === name) return tl.resultMods ?? [];
    return [];
  }
  // #7: extra attack success levels → +steps to damage. Only while the current
  // pick's attack is armed. With a target number in play the levels come from the
  // rolled total vs the target (engine clamps a miss to 0); with NO target the GM
  // adjudicates, so the player types the success count (`_manualSuccesses`).
  _damageBonus() {
    if (!this._attackArmed) return 0;
    if (this._targetNum() != null) return attackSuccessLevels(this._lastAttack?.total, this._lastAttack?.target);
    const n = Number(this._manualSuccesses);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  // The manual success input is offered after a no-target attack roll (GM
  // adjudicates the successes that buff the Damage step).
  _showManualSuccesses() {
    return this._attackArmed && this._targetNum() == null;
  }
  _damagePool() {
    const w = this._selWeapon();
    const { damageEffects } = this._poolEffects();
    const t = this._selTalent();
    return damagePool({
      weaponDamageStep: w.damageStep ?? null,
      strengthStep: this.model?.combat?.strengthStep ?? null,
      effects: damageEffects,
      bonusSteps: this._damageBonus(),
      activeTalent: t?.name,
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
  _karmaCtx(k, kd = null) {
    const kc = this.model?.characteristics?.karma;
    if (!k?.grants?.length) return null;
    const ctx = { grants: k.grants, available: kc?.available ?? null, step: kc?.step ?? null };
    // A toggled karmaDice option (e.g. True Shot) turns the single Karma die into
    // a set-dice roll: `rank` caps the total dice, `maxDice` is that rank clamped
    // by the Karma the character can actually pay. Only attach when at least one
    // die is affordable — otherwise the roll stays a normal single-die roll.
    if (kd?.karmaDice) {
      const rank = kd.karmaDice.max ?? 1;
      const maxDice = Math.min(rank, kc?.available ?? 0);
      if (maxDice >= 1) {
        ctx.rank = rank;
        ctx.maxDice = maxDice;
      }
    }
    return ctx;
  }
  // The armed combat option that turns this attack into a set-dice (extra Karma
  // dice) roll — the first toggled option carrying `karmaDice` that survives the
  // current pick's scope filter (True Shot on a missile/throwing weapon). null
  // when none is armed (an ordinary roll).
  _armedKarmaDiceOption() {
    return this._allOptions().find((o) => o.karmaDice && (this._opts ?? []).includes(o.name)) ?? null;
  }
  // The toggled option that runs a precursor aim test (Mystic Aim). null when no
  // aim option is armed for the current pick.
  _aimOption() {
    return this._allOptions().find((o) => o.aimRoll && (this._opts ?? []).includes(o.name)) ?? null;
  }
  // Selecting an aim option fires its test immediately (the workflow: pick Mystic
  // Aim → the modal pops up to roll vs the target's Mystic Defence). The result
  // arms/disarms the +2 via `_onRollLogged`; nothing is armed until it HITS.
  _rollAim(opt) {
    const step = opt?.aimRoll?.step;
    if (step == null) return; // no derived step (rank 0) — option wouldn't be offered
    this._aimSuccesses = 0; // pending until the test resolves
    this._aimConsumed = false; // a fresh aim can arm again
    // Freshness anchor: only a log entry newer than this moment arms the bonus,
    // so a stale entry from a previous round can't re-arm on re-selection.
    this._aimSince = Date.now();
    this.dispatchEvent(
      new CustomEvent('ed-roll', {
        detail: {
          label: `${opt.name} — vs Mystic Defence`,
          step,
          // The aim test is Karma-eligible (MA8) — offer the talent's Karma die.
          karma: opt.aimRoll.karma ?? null,
          aim: { vs: opt.aimRoll.vs ?? 'Mystic', strain: opt.aimRoll.strain ?? 0 },
        },
        bubbles: true,
        composed: true,
      }),
    );
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
    this._manualSuccesses = ''; // a fresh attack starts with no adjudicated successes
    // A set-dice option (True Shot) defers the whole roll to the modal: the player
    // picks the Karma dice there, and the Strain is charged at that commit — not
    // here — so Escaping before commit costs nothing (D-strain). An ordinary
    // attack still pays its Strain immediately (no Apply gate); the option
    // declares the cost, and the write is one-way (no undo).
    const kd = this._armedKarmaDiceOption();
    const karma = this._karmaCtx(opt?.karma, kd);
    const setDice = karma?.maxDice > 1 || (karma?.maxDice === 1 && kd != null);
    const base = isNone ? this._rollLabel(opt?.name ?? 'Action', null) : this._rollLabel('Attack', w.name);
    const label = ap.strain ? `${base} · ${ap.strain} strain` : base;
    if (!setDice) this._chargeStrain(ap.strain);
    this._roll(
      label,
      ap.step,
      karma,
      undefined,
      {
        difficulty: target != null ? { value: target, win: 'Hit', lose: 'Miss' } : null,
        mods: ap.resultMods,
        // Deferred Strain: charged at the modal's commit for a set-dice roll (0
        // otherwise — an ordinary roll already paid it above).
        strain: setDice ? ap.strain : 0,
      },
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
    // A new round also clears the round's declared Combat options (they are
    // chosen fresh each round; a Mystic Aim from last round is no longer armed);
    // situational modifiers persist.
    this._opts = [];
    this._aimSuccesses = 0;
    this._aimConsumed = false;
    // A new round: no attack has been rolled yet, so clear the armed attack and
    // the manually-adjudicated successes (the manual input hides until the next
    // attack is rolled).
    this._attackArmed = false;
    this._lastAttack = null;
    this._manualSuccesses = '';
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
    // Blood-charms are global activation (engine-level, not tab-local). Dispatch to
    // ed-app's session activeCharms so the effect is an effect regardless of tab
    // (Combat attack/damage, Spells casting/effect, Disciplines badge when armed).
    // Also keep the local SCRATCH `_charmsOn` in sync for backward compat while
    // the model `activeCharms` is the source of truth when present.
    if (section === 'charms') {
      this.dispatchEvent(new CustomEvent('ed-toggle-charm', { detail: { name }, bubbles: true, composed: true }));
      // Optimistic local toggle so the chip flips before the re-derive lands.
      const cur = [...(this._charmsOn ?? [])];
      const i = cur.indexOf(name);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(name);
      this._charmsOn = cur;
      return;
    }
    const key = section === 'opts' ? '_opts' : '_sits';
    const list = [...(this[key] ?? [])];
    const i = list.indexOf(name);
    const turningOn = i < 0;
    if (i >= 0) list.splice(i, 1);
    else {
      list.push(name);
      if (section === 'opts') {
        // Mutual exclusivity (A14): selecting an option clears anything it excludes.
        const bundle = this._allOptions().find((o) => o.name === name);
        for (const excl of bundle?.excludes ?? []) {
          const j = list.indexOf(excl);
          if (j >= 0) list.splice(j, 1);
        }
      }
    }
    this[key] = list;
    // Aim options (Mystic Aim): selecting one fires its test at once; deselecting
    // disarms any bonus it had armed.
    if (section === 'opts') {
      const opt = this._allOptions().find((o) => o.name === name);
      if (opt?.aimRoll) {
        if (turningOn) this._rollAim(opt);
        else { this._aimSuccesses = 0; this._aimConsumed = false; }
      }
    }
  }
  _chips(items, toggled, section, cls = '') {
    const karmaAvail = this.model?.characteristics?.karma?.available ?? 0;
    return html`<div class="chips">
      ${items.map((o) => {
        // A set-dice option (karmaDice) can't be armed with no Karma to spend
        // (D-gate): disable it and say why. Rank is always ≥ 1, so this only
        // bites at a 0 Karma balance.
        const noKarma = o.karmaDice != null && Math.min(o.karmaDice.max ?? 0, karmaAvail) < 1;
        const disabled = o.locked || noKarma;
        const on = o.locked || (toggled ?? []).includes(o.name);
        const badges = this._badges(o.effects ?? []);
        // Aim options show the armed step bonus (+2 × successes) once the test hit.
        const aimArmed = o.aimRoll != null && (toggled ?? []).includes(o.name) && this._aimSuccesses > 0;
        const aimBonus = aimArmed ? 2 * this._aimSuccesses : 0;
        return html`<button
          class="chip ${cls}${o.locked ? ' locked' : ''}${noKarma ? ' spent' : ''}${aimArmed ? ' aimed' : ''}"
          aria-pressed=${on}
          ?disabled=${disabled}
          title=${noKarma ? 'No Karma left to spend' : this._chipTitle(o)}
          @click=${() => this._toggle(section, o.name)}
        >${o.name}${badges.map((b) => html`<span class="badge ${b.cls}" title=${b.title}>${b.text}</span>`)}${aimArmed ? html`<span class="badge pos" title="Aim hit — ${this._aimSuccesses} success${this._aimSuccesses > 1 ? 'es' : ''}, +${aimBonus} steps armed for the Attack roll">✓ +${aimBonus}</span>` : ''}</button>`;
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
    const opts = this._allOptions();
    const active = opts.filter((o) => (this._opts ?? []).includes(o.name)).length;
    return this._sec('Combat options', 'opts', active, this._chips(opts, this._opts, 'opts'));
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
  // same ed-edit-knockdown session event; the engine re-derives the standing).
  // Mirrors ui/ed-overview.js "Stand up". Session-only, never persisted.
  _standUp() {
    this.dispatchEvent(new CustomEvent('ed-edit-knockdown', { detail: { knockedDown: false }, bubbles: true, composed: true }));
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
    const active = this._activeCharmNames();
    const body = charms.length
      ? this._chips(charms, active, 'charms', 'charm')
      : html`<div class="empty">No blood charms equipped. Combat-relevant magic implants appear here when worn.</div>`;
    return this._sec('Blood charms', 'charms', active.length, body);
  }

  // Defence & Armour block (owner-agreed Combat-UI change): the derived Defence
  // ratings and Armour values used in combat sit between the attack card and the
  // Combat Modifiers group. Purely informational (defence isn't rolled; armour is
  // a damage soak) — derived readouts only, placeholder pills until computed.
  // Toggled session mods fold into the shown figures as Overview-style delta
  // badges (foldCombatRatings) — never dispatched into the derived Defence (B7).
  // Collapsible; defaults collapsed on narrow screens.
  // Active self-cast spells (PLAN-SPELLS 6b) fold into the DERIVED defence/armour
  // by the engine, so their contribution is already inside the base value. To
  // surface it as a signed badge (like a toggled mod) without double-counting, we
  // pull each spell's defence/armour delta OUT of the base and re-add it as a mod
  // — the total is unchanged, but the source now shows.
  _spellRatingMods() {
    const def = [];
    const arm = [];
    for (const sp of this.model?.spells?.active ?? []) {
      for (const e of sp.effects ?? []) {
        if (!e?.target?.name) continue;
        const v = (e.operation === 'subtract' ? -1 : 1) * (Number(e.value) || 0);
        if (!v) continue;
        if (e.type === 'armor-modifier' && e.target.domain === 'armor') arm.push({ name: e.target.name, value: v, source: sp.name });
        else if (e.type === 'defense-modifier' && e.target.domain === 'defense') def.push({ name: e.target.name, value: v, source: sp.name });
      }
    }
    return { def, arm };
  }

  _defArmourSection() {
    const c = this.model?.characteristics ?? {};
    const { defenseMods, armorMods } = this._poolEffects();
    const { def: spellDef, arm: spellArm } = this._spellRatingMods();
    const sub = (val, mods, name) =>
      val == null ? val : val - mods.filter((m) => m.name === name).reduce((s, m) => s + m.value, 0);
    const r = foldCombatRatings(
      {
        physicalDefense: sub(c.physicalDefense?.value, spellDef, 'Physical'),
        mysticDefense: sub(c.mysticDefense?.value, spellDef, 'Mystic'),
        socialDefense: sub(c.socialDefense?.value, spellDef, 'Social'),
        physicalArmor: sub(c.physicalArmor?.value, spellArm, 'Physical'),
        mysticArmor: sub(c.mysticArmor?.value, spellArm, 'Mystic'),
      },
      [...defenseMods, ...spellDef],
      [...armorMods, ...spellArm],
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
        <div class="thr rec">Recoveries <b>${h.recoveriesUsed ?? 0} / ${maxRec ?? this._rating(maxRec)}</b> used</div>
        <div class="dtbtns">
          <button class="roll dmg" @click=${this._openDamage} title="Take damage — wounds and Knockdown resolve via the engine" aria-label="Take damage">✗</button>
          <button class="roll ${boost ? 'boosted' : ''}" ?disabled=${noRecoveries} @click=${this._recoveryTest}
            title=${recTitle}
            aria-label=${boost ? `Recovery test, plus ${boost} step armed` : 'Recovery test'}>⚄</button>
          <button class="roll reset" style="margin-left:auto" @click=${() => this.dispatchEvent(new CustomEvent('ed-day-reset', { detail: { source: 'combat' }, bubbles: true, composed: true }))} title="Start a new day — reset recoveries, clear combat state, and spend any remaining recoveries" aria-label="Reset the day"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16h18"/><path d="M8 16a4 4 0 0 1 8 0"/><path d="M12 3.5v2"/><path d="M5.2 6.7l1.4 1.4"/><path d="M18.8 6.7l-1.4 1.4"/><path d="M12 20l-2-2h4z" fill="currentColor" stroke="none"/></svg></button>
        </div>
      </div>`;
  }
  _openDamage() {
    this._damageDraft = { take: 0 };
    this._damageModal = true;
  }
  _applyDamage() {
    const d = this._damageDraft ?? {};
    const cur = this.model?.resources?.health ?? {};
    const take = d.take ?? 0;
    const wt = this.model?.characteristics?.woundThreshold?.value;
    // The Wound is derived from the hit vs. the Wound Threshold — never typed
    // in (store only inputs), and the engine decides it like the Overview tab.
    // Healing is done through a Recovery test, not here.
    const wound = take > 0 ? woundsFromHit(take, wt) : 0;
    const next = applyHealth(cur, { damage: take, wounds: wound, recoveriesUsed: 0 });
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

  // --- Combat log (device-local Log view: rolls + actions) ---
  _loadRolls() {
    if (!this.characterId) { this._rolls = []; return; }
    this._rolls = loadRollLog(this.characterId).entries;
  }
  _clearLog() {
    this._confirmClear = false;
    if (this.characterId) { clearRollLog(this.characterId); this._loadRolls(); }
  }
  _logRow(r) {
    if (r.kind === 'system' || r.kind === 'log' || r.kind === 'advancement') {
      return html`<div class="logrow">
        <span class="lt" aria-hidden="true">✦</span>
        <span class="lx"><b>${r.label ?? 'System'}</b>${r.detail ? html` — ${r.detail}` : ''}${r.legendCost != null ? html` · ${r.legendCost} Legend` : ''}${r.silverFee != null && r.silverFee > 0 ? html` · ${r.silverFee} sp` : ''}${r.coinDelta ? html` · ${r.coinDelta}` : ''}</span>
      </div>`;
    }
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
          : html`<div class="logempty">No rolls yet — roll to begin. This log lives in this browser only (the Notes Log).</div>`}
      </div>`;
  }

  // --- weapon image (repo-image pattern, UI-GUIDELINES §6; missing-image fallback) ---
  _artBox() {
    const w = this._selWeapon();
    const url = w?.image ? itemImageUrl(w.image) : null;
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
                  <select aria-label="Weapon" .value=${w.name} @change=${(e) => { this._weapon = e.target.value; this._talent = null; this._opts = null; this._aimSuccesses = 0; this._aimConsumed = false; this._artOk = true; }}>
                    ${this._weapons().map((x) => html`<option value=${x.name}>${x.name}${x.damageStep != null ? html` · dmg ${x.damageStep}` : ''}</option>`)}
                  </select>
                  <select aria-label="Attack talent or skill" .value=${talent?.id ?? ''} @change=${(e) => { this._talent = e.target.value; this._attackArmed = false; this._lastAttack = null; }}>
                    ${this._attackOptions().length
                      ? this._attackOptions().map((o) => html`<option value=${o.id}>${o.name}${o.kind === 'skill' ? ' · Skill' : ' · Talent'}${o.action ? ` · ${o.action}` : ''} · ${o.step}</option>`)
                      : html`<option value="">${w.category == null ? 'No talents or skills' : 'No matching talent/skill'}</option>`}
                  </select>
                </div>
                <div class="statline">
                  <button class="info" title="Attack step breakdown" aria-label="Attack step breakdown" @click=${() => (this._stepAudit = 'attack')}>ⓘ</button>
                  <span class="k">Attack</span>
                  <span class="v">${this._stepVal(ap.step)}</span>
                  <span class="vs">vs <input type="number" placeholder="#" .value=${this._target ?? ''} aria-label="Target number to beat (empty = GM adjudicates)" @input=${(e) => (this._target = e.target.value)} /></span>
                  <button class="roll" ?disabled=${ap.step == null} title="Roll attack" aria-label="Roll attack" @click=${this._rollAttack}>⚄</button>
                </div>
                <div class="statline">
                  <button class="info" title="Damage step breakdown" aria-label="Damage step breakdown" @click=${() => (this._stepAudit = 'damage')}>ⓘ</button>
                  <span class="k">Damage</span>
                  <span class="v">${this._stepVal(dp.step)}${range}</span>
                  ${this._damageBonusBadge()}
                  ${this._showManualSuccesses()
                    ? html`<span class="vs" title="No target was set — enter the GM-adjudicated successes to buff the Damage step">succ <input type="number" min="0" step="1" placeholder="0" .value=${this._manualSuccesses ?? ''} aria-label="Successes (GM-adjudicated, no target set)" @input=${(e) => (this._manualSuccesses = e.target.value)} /></span>`
                    : ''}
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

      ${this._stepAudit ? this._stepAuditTpl() : ''}
      ${this._damageModal
        ? this._damageModalTpl()
        : ''}
      ${this._confirmClear
        ? html`<ed-confirm
            heading="Clear the Combat log?"
            message="This clears the Log for this character in this browser — it also clears the Notes-tab Log. It can't be undone."
            confirmLabel="Clear"
            @confirm=${this._clearLog}
            @close=${() => (this._confirmClear = false)}
          ></ed-confirm>`
        : ''}
      ${this._useModal()}
    `;
  }

  // --- step audit (info modal) ---
  // The itemised breakdown of the Attack / Damage Step, computed by the pure
  // engine (auditPool) from the same bases + effects the pools fold — the view
  // only renders it, never re-derives. A rank grant (PLAN-RANK-GRANTS.md) is
  // itemised as its own base line off the model's pre-grant `stepBase`, so any
  // talent or skill with a grant (not just one name) shows what built its step.
  _attackAudit() {
    const t = this._selTalent();
    const { attackEffects } = this._poolEffects();
    const baseParts = [{ label: `${t?.name ?? 'Talent'} step`, value: t?.stepBase ?? t?.step ?? null }];
    if (t?.rankBonus != null && t.rankBonus !== 0) {
      baseParts.push({ label: `Rank grant (${this._grantLabel(t.grantSources)})`, value: t.rankBonus });
    }
    // The talent's own active test-modifiers (a sustained spell's +N step, etc.)
    // are itemised off the pre-modifier base so the audit sums back to its step.
    return auditPool(baseParts, attackEffects, { testKind: 'attack' }, 0, t?.rollMods ?? []);
  }
  _grantLabel(sources) {
    return (sources ?? [])
      .map((s) => {
        const o = s.origin ?? {};
        if (o.kind === 'thread') return `${o.name} · Thread Rank ${o.rank ?? '?'}`;
        if (o.name) return o.name;
        return s.source ?? s.summary ?? 'grant';
      })
      .join(', ');
  }
  _damageAudit() {
    const w = this._selWeapon();
    const { damageEffects } = this._poolEffects();
    return auditPool(
      [
        { label: 'Strength step', value: this.model?.combat?.strengthStep ?? null },
        { label: `${w?.name && w.name !== 'None' ? w.name : 'Weapon'} Damage Step`, value: w?.damageStep ?? null },
      ],
      damageEffects,
      { testKind: 'damage' },
      this._damageBonus(),
    );
  }
  _auditRow(p) {
    const signed = p.kind === 'base' ? `${p.value}` : `${p.value >= 0 ? '+' : ''}${p.value}`;
    return html`<div class="arow"><span class="al">${p.label}</span><span class="av ${p.value < 0 ? 'neg' : ''}">${signed}</span></div>`;
  }
  _stepAuditTpl() {
    const which = this._stepAudit;
    const audit = which === 'damage' ? this._damageAudit() : this._attackAudit();
    const title = which === 'damage' ? 'Damage step' : 'Attack step';
    const stepParts = audit.parts.filter((p) => p.kind !== 'result');
    const resultParts = audit.parts.filter((p) => p.kind === 'result');
    return html`
      <div class="overlay" @click=${() => (this._stepAudit = null)}>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${title} breakdown" @click=${(e) => e.stopPropagation()}>
          <div class="mhead">
            <span>${title} breakdown</span>
            <button class="mclose" aria-label="Close" @click=${() => (this._stepAudit = null)}>✕</button>
          </div>
          <div class="audit">
            ${stepParts.length ? stepParts.map((p) => this._auditRow(p)) : html`<div class="aempty">No base step yet — pick a ${which === 'damage' ? 'weapon' : 'talent or skill'}.</div>`}
            <div class="arow total"><span class="al">Step</span><span class="av">${audit.step == null ? this._pend() : audit.step}</span></div>
            ${resultParts.length
              ? html`<div class="asec">Applied to the roll total (not the Step):</div>${resultParts.map((p) => this._auditRow(p))}`
              : ''}
          </div>
          <div class="hfoot"><span class="hint">Escape closes</span></div>
        </div>
      </div>`;
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
            <p class="mpara hint">A hit at or above the Wound Threshold ${this._rating(wt)} records one Wound; a hit five or more over it triggers a Knockdown test. Healing is done through a Recovery test.</p>
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
