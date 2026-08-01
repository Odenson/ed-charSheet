// engine/characteristics.js — pure, DOM-free derivation of Earthdawn's derived
// characteristics from the ED4 Characteristics Table (rules/characteristics.json).
//
// The TABLE is the rulebook artifact (Value -> Step, Defense, Carrying Capacity,
// Unconsciousness, Death, Wound, Recovery). This module holds the LOGIC only:
// which attribute drives which characteristic, and how taxonomy `effects`
// (docs/EFFECT-TAXONOMY.md) layer on top of the table's base value.
//
// Recompute-all model: every characteristic is a pure function of its inputs, so
// changing an attribute simply re-runs these functions — no dependency graph.
//
// Phase-3 vertical slice: only Physical Defense is wired end-to-end. The table,
// the effect applier, and the shape of the return value are all general, so the
// remaining characteristics are added by repeating the pattern, not new design.

/**
 * Index the Characteristics Table by attribute value.
 * Values above the table's max (30 in the core book) clamp to the last row.
 * @param {{rows: Array<object>}} table  parsed rules/characteristics.json
 * @returns {(value:number) => object|undefined} row lookup
 */
export function makeCharacteristics(table) {
  const rows = table?.rows ?? [];
  const byValue = new Map(rows.map((r) => [r.value, r]));
  const maxValue = rows.length ? rows[rows.length - 1].value : 0;
  return (value) => {
    if (byValue.has(value)) return byValue.get(value);
    if (value > maxValue && maxValue > 0) return byValue.get(maxValue); // clamp
    return undefined;
  };
}

const OPS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => (b === 0 ? a : a / b),
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  set: (_a, b) => b,
};

// Only unconditional, non-judgement modifiers auto-apply. Situational,
// triggered, or GM-discretion effects are surfaced elsewhere, never folded
// silently into a static rating.
function autoApplies(effect) {
  if ((effect.condition ?? 'always') !== 'always') return false;
  if (effect.gmDiscretion) return false;
  return true;
}

/**
 * Fold every matching, always-on modifier effect onto a base value.
 * `ref`-valued effects are skipped here (they arrive with the dependency work
 * in a later slice); only numeric `value`s apply for now.
 *
 * @param {number} base
 * @param {Array<object>} effects  candidate effects from all active sources
 * @param {(e:object)=>boolean} match  which effects target this characteristic
 * @returns {{base:number, value:number, modifiers:Array<object>}}
 */
export function applyModifiers(base, effects, match) {
  let value = base;
  const modifiers = [];
  for (const e of effects ?? []) {
    if (!match(e) || !autoApplies(e)) continue;
    const op = OPS[e.operation];
    if (!op || typeof e.value !== 'number') continue;
    value = op(value, e.value);
    modifiers.push({
      value: e.value,
      operation: e.operation,
      source: e.source ?? null,
      summary: e.summary ?? null,
    });
  }
  return { base, value, modifiers };
}

// Which attribute drives each Defense rating. This "attribute → characteristic"
// mapping is engine logic (§5), kept here so callers don't re-encode it.
export const DEFENSE_ATTRIBUTE = {
  Physical: 'Dexterity',
  Mystic: 'Perception',
  Social: 'Charisma',
};

/**
 * A Defense rating = the Defense column of the Characteristics Table at the
 * governing attribute's value, plus any always-on defense-modifier effects that
 * target this kind of defense (rating measure). Physical/Mystic/Social all share
 * the one Defense column; they differ only by governing attribute and effect
 * target — so one function serves all three.
 *
 * @param {'Physical'|'Mystic'|'Social'} kind
 * @param {number} attributeValue  value of DEFENSE_ATTRIBUTE[kind]
 * @param {Array<object>} effects  active effects from race/discipline/items/…
 * @param {(value:number)=>object|undefined} lookup  from makeCharacteristics()
 * @returns {{base:number, value:number, modifiers:Array<object>}|null} null if
 *          the value is off the table (renders as a placeholder pill upstream)
 */
export function defense(kind, attributeValue, effects, lookup) {
  const row = lookup(attributeValue);
  if (!row || typeof row.defense !== 'number') return null;
  const match = (e) =>
    e.type === 'defense-modifier' &&
    e.target?.domain === 'defense' &&
    e.target?.name === kind &&
    (e.measure ?? 'rating') === 'rating';
  return applyModifiers(row.defense, effects, match);
}
