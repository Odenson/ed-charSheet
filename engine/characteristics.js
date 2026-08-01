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
      origin: e.origin ?? null,
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

// --- Combat characteristics (step-based; rolled, not static ratings) ----------

/**
 * A step-based characteristic (Initiative, Knockdown): a base attribute Step
 * plus any always-on characteristic-modifier effects that add/subtract steps to
 * it. Returns { base, value, modifiers } where `value` is the final Step.
 *
 * @param {'Initiative'|'Knockdown'} name  the characteristic being modified
 * @param {number} baseStep  the governing attribute's Step
 * @param {Array<object>} effects  active effects from race/discipline/items/…
 */
export function stepCharacteristic(name, baseStep, effects) {
  if (typeof baseStep !== 'number') return null;
  const match = (e) =>
    e.type === 'characteristic-modifier' &&
    e.target?.domain === 'characteristic' &&
    e.target?.name === name &&
    (e.measure ?? 'step') === 'step';
  return applyModifiers(baseStep, effects, match);
}

/**
 * Initiative Step = Dexterity Step − armour penalty (armour arrives with
 * equipment), plus any step-adding Initiative effects. (PG, Creating a Character:
 * "The Initiative Step is equal to the character's Dexterity Step, minus any
 * modifiers for armor.")
 */
export function initiative(dexterityStep, effects) {
  return stepCharacteristic('Initiative', dexterityStep, effects);
}

/**
 * Knockdown Step = Strength Step (Knockdown tests are Strength-based). No effect
 * targets Knockdown yet; when one does, add "Knockdown" to the EFFECT-TAXONOMY
 * `characteristic` vocabulary (a Tier-2 change). Base computation needs no
 * taxonomy entry, so it is supported now.
 */
export function knockdown(strengthStep, effects) {
  return stepCharacteristic('Knockdown', strengthStep, effects);
}

// The Karma die is an extra D6 = Step 4 (may grow later via effects/grants).
export const KARMA_STEP = 4;

/**
 * Karma-use permissions for a test. An adept may spend a Karma Point (an extra
 * exploding D6) only on tests their race/Discipline grants via `grant-karma-use`
 * effects. Scoped grants ("sight-based", "vs Horrors") are contextual, so they
 * are surfaced with their scope rather than auto-decided. (Talent tests are
 * karma-eligible by the core rule, applied where talents roll.)
 *
 * @param {string} testName  e.g. 'Initiative', 'Perception', 'Damage'
 * @param {Array<object>} effects  active effects (each may carry an `origin`)
 * @returns {{grants: Array<{scope:string|null, via:object|null, summary:string|null}>}|null}
 */
export function karmaUse(testName, effects) {
  const grants = (effects ?? [])
    .filter(
      (e) =>
        e.type === 'grant-karma-use' &&
        e.target?.domain === 'test' &&
        e.target?.name === testName,
    )
    .map((e) => ({ scope: e.scope ?? null, via: e.origin ?? null, summary: e.summary ?? null }));
  return grants.length ? { grants } : null;
}

/**
 * Maximum Karma = race Karma Modifier × Circle (+ leftover attribute points,
 * which we do not track). For a multi-Discipline adept, `circle` is the highest
 * Discipline Circle. (PG, Creating a Character.)
 *
 * @returns {number|null}
 */
export function maxKarma(karmaModifier, circle) {
  if (typeof karmaModifier !== 'number' || typeof circle !== 'number') return null;
  return karmaModifier * circle;
}
