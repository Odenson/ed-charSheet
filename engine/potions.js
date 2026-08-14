// engine/potions.js — pure, DOM-free helpers for consumable potions (healing
// aids). The engine decides *what a consume does* from the catalog data; ed-app
// owns the session-only pending state and performs the persistence/roll wiring.
//
// Nothing here is stored: the item decrement and any wound heal are inputs the
// caller persists; the armed bonus is derived at roll time from the pending
// entry + the item's catalog data (never a hardcoded view literal). No stacking
// — one armed entry at a time; the caller (ed-app) blocks a second arm.

const RECOVERY = 'Recovery';

/**
 * Decrement a potion's quantity in the item *input* list, removing the entry
 * when the last dose is spent (qty reaches 0). Pure reshape — mirrors
 * ui/item-equip-state.bumpQuantity(-1), duplicated here so the engine keeps no
 * upward dependency on the ui layer.
 *
 * @param {{items: Array<{name:string, qty?:number}>, name: string}} args
 * @returns {Array<{name:string, qty?:number}>} the next input list
 */
export function consumePotion({ items, name }) {
  const out = [];
  for (const it of items ?? []) {
    if (it.name !== name) {
      out.push(it);
      continue;
    }
    const qty = (Number.isFinite(it.qty) ? it.qty : 1) - 1;
    if (qty > 0) out.push({ ...it, qty });
    // qty <= 0 drops the entry (last dose spent).
  }
  return out;
}

/**
 * The +N *step* a potion arms on the next Recovery test, read from its Recovery
 * `test-modifier` (measure: step) in the catalog entry. `null` when it arms no
 * Recovery step (a consume-only aid). Booster / Healing → 8.
 *
 * @param {object} entry  the resolved catalog entry (rules/items.json value)
 * @returns {number|null}
 */
export function recoveryStepBonus(entry) {
  const eff = (entry?.effects ?? []).find(
    (e) =>
      e?.type === 'test-modifier' &&
      e?.target?.name === RECOVERY &&
      e?.measure === 'step' &&
      e?.operation === 'add',
  );
  return eff ? Number(eff.value) || 0 : null;
}

/** The immediate wound heal a consume applies now (Healing Potion → 1), else 0. */
export function immediateWoundHeal(entry) {
  return Number(entry?.consumable?.use?.healWounds) || 0;
}

/**
 * Decide what a consume arms, given the catalog entry and the *confirmed*
 * recoveries remaining at drink time. Returns the session pending entry, or
 * `null` for a consume-only aid (Cure Disease / Halt Illness — logged, no arm).
 *
 * - `emergency-heal`: a Healing-style aid drunk at a **confirmed 0** remaining
 *   arms an immediate, budget-free Recovery test at the data's step.
 * - `step-boost`: otherwise (incl. unknown/`null` remaining) arm the +N step on
 *   the next Recovery test, N read from the catalog (never a view literal).
 * - **nothing** when a pure step-boost aid (no emergency branch, e.g. Booster) is
 *   drunk at a **confirmed 0** remaining — there is no Recovery test to boost, so
 *   arming would leave a useless pending pill. The caller warns first; the dose is
 *   still spent, but no benefit is armed.
 *
 * @param {{name:string, entry:object, recoveriesRemaining:number|null}} args
 * @returns {{name:string, kind:'step-boost'|'emergency-heal', value?:number, step?:number, at:number}|null}
 */
export function armPotion({ name, entry, recoveriesRemaining }) {
  const use = entry?.consumable?.use ?? null;
  if (!use) return null;
  if (use.emergencyHeal && recoveriesRemaining === 0) {
    return { name, kind: 'emergency-heal', step: Number(use.emergencyHeal.step) || 0, at: Date.now() };
  }
  if (use.armNextRoll) {
    // No Recovery test to boost → nothing to arm (Booster at 0 remaining).
    if (recoveriesRemaining === 0) return null;
    return { name, kind: 'step-boost', value: recoveryStepBonus(entry) ?? 0, at: Date.now() };
  }
  return null; // consume-only
}

/**
 * True when drinking this potion would arm nothing useful because it is a pure
 * step-boost (arms the next Recovery test, no emergency branch) and there are no
 * Recovery tests left — the UI warns the boost will have no effect. Healing (with
 * its emergency branch) and consume-only aids are never "no-effect" here.
 *
 * @param {object} use  the `consumable.use` block
 * @param {number|null} recoveriesRemaining
 * @returns {boolean}
 */
export function boostHasNoEffect(use, recoveriesRemaining) {
  return !!(use && use.armNextRoll && !use.emergencyHeal && recoveriesRemaining === 0);
}

/**
 * The armed recovery bonus for the roll assembly and the UI, from the single
 * pending entry. No summing — one entry at a time (no stacking).
 *
 * @param {object|null} pending  the session pending entry (or null)
 * @returns {{stepBonus:number|null, emergency:{step:number}|null}}
 */
export function armedRecoveryBonus(pending) {
  if (!pending) return { stepBonus: null, emergency: null };
  if (pending.kind === 'step-boost') return { stepBonus: pending.value ?? 0, emergency: null };
  if (pending.kind === 'emergency-heal') return { stepBonus: null, emergency: { step: pending.step ?? 0 } };
  return { stepBonus: null, emergency: null };
}
