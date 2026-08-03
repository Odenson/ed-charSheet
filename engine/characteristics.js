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
 * **Fold order (the `set`-as-base rule).** `set` establishes the base a value
 * grows from (EFFECT-TAXONOMY §4: "override target to value (acts as a
 * base/floor)"), so all `set` effects are applied *first* — regardless of their
 * position in the array — and only then do `add`/`subtract`/… layer on top.
 * This is what makes obsidiman Natural Armor (`set` 3) a floor that worn
 * "living" armor adds onto, independent of the order the sources were gathered.
 * With no `set` in play (the common case — defenses, mystic-armor table base)
 * the behaviour is unchanged: additive ops fold in array order.
 *
 * @param {number} base
 * @param {Array<object>} effects  candidate effects from all active sources
 * @param {(e:object)=>boolean} match  which effects target this characteristic
 * @returns {{base:number, value:number, modifiers:Array<object>}}
 */
export function applyModifiers(base, effects, match) {
  const applicable = (effects ?? []).filter(
    (e) => match(e) && autoApplies(e) && OPS[e.operation] && typeof e.value === 'number',
  );
  // Pass 1: `set` effects establish the base (later `set` overrides earlier).
  // Pass 2: everything else folds onto that base, in array order.
  const sets = applicable.filter((e) => e.operation === 'set');
  const rest = applicable.filter((e) => e.operation !== 'set');
  let value = base;
  for (const e of sets) value = OPS.set(value, e.value);
  for (const e of rest) value = OPS[e.operation](value, e.value);
  const modifiers = [...sets, ...rest].map((e) => ({
    value: e.value,
    operation: e.operation,
    source: e.source ?? null,
    origin: e.origin ?? null,
    summary: e.summary ?? null,
  }));
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

// --- Armor ratings (damage reducers, not target numbers) ----------------------

/**
 * An Armor rating reduces incoming damage of its kind (Physical Armor reduces
 * physical damage; Mystic Armor reduces mystic damage). Unlike a Defense, an
 * armor rating is *not* on the Characteristics Table — the `base` is supplied by
 * the caller (§ below), and worn armor / racial Natural Armor arrive as
 * `armor-modifier` effects. There is **no Social Armor** (EFFECT-TAXONOMY §3).
 *
 * @param {'Physical'|'Mystic'} kind
 * @param {number} base  the starting rating before worn armor (see helpers)
 * @param {Array<object>} effects  active effects from race/items/…
 * @returns {{base:number, value:number, modifiers:Array<object>}}
 */
export function armor(kind, base, effects) {
  const match = (e) =>
    e.type === 'armor-modifier' &&
    e.target?.domain === 'armor' &&
    e.target?.name === kind &&
    (e.measure ?? 'rating') === 'rating';
  return applyModifiers(base, effects, match);
}

/**
 * Physical Armor = 0 by default (it is not attribute-based), plus worn armor and
 * any racial Natural Armor, which arrive as `armor-modifier` effects. Obsidiman
 * Natural Armor is a `set` effect, so it establishes the base that "living"
 * armor adds onto (see applyModifiers' fold order). (PG, Armor Ratings.)
 *
 * @param {Array<object>} effects  active effects (race + equipped items)
 */
export function physicalArmor(effects) {
  return armor('Physical', 0, effects);
}

/**
 * Mystic Armor = the natural rating from the character's Willpower value (the
 * Mystic Armor Table, shipped as the `mysticArmor` column of the Characteristics
 * Table) plus any equipment/racial bonuses. (PG, Armor Ratings.)
 *
 * @param {number} willpowerValue  Willpower attribute value
 * @param {Array<object>} effects  active effects (race + equipped items)
 * @param {(value:number)=>object|undefined} lookup  from makeCharacteristics()
 * @returns {{base:number, value:number, modifiers:Array<object>}|null} null if
 *          the value is off the table (renders as a placeholder pill upstream)
 */
export function mysticArmor(willpowerValue, effects, lookup) {
  const row = lookup(willpowerValue);
  if (!row || typeof row.mysticArmor !== 'number') return null;
  return armor('Mystic', row.mysticArmor, effects);
}

// --- Health ratings (Toughness-driven, plus adept bonuses) --------------------

// Toughness drives every health rating (Unconsciousness, Death, Recovery Tests).
export const HEALTH_ATTRIBUTE = 'Toughness';

/**
 * Synthesize the adept health bonuses as `characteristic-modifier` effects, so
 * they fold through the same applier as every other modifier (and surface in
 * value tooltips) instead of being special-cased inside the rating functions.
 *
 * Two rulebook bonuses (PG, Health Ratings & Durability):
 *  - **Durability** — at each rank the adept permanently adds their Discipline's
 *    Durability value to BOTH the Unconsciousness and Death Ratings. The total is
 *    `durability × rank`, summed over each Discipline that actually has the
 *    Durability talent (a Discipline's `durability` value alone does nothing
 *    without ranks in the talent).
 *  - **Circle** — the Death Rating (only) also gains the adept's Circle. A
 *    multi-Discipline adept uses the single **highest** Circle.
 *
 * @param {Array<{name:string, circle:number, durability:number, durabilityRank:number}>} disciplines
 * @returns {Array<object>} synthesized characteristic-modifier effects
 */
export function adeptHealthEffects(disciplines) {
  const effects = [];
  let highestCircle = 0;
  for (const d of disciplines ?? []) {
    highestCircle = Math.max(highestCircle, d.circle ?? 0);
    const bonus = (d.durability ?? 0) * (d.durabilityRank ?? 0);
    if (bonus <= 0) continue;
    for (const name of ['UnconsciousnessRating', 'DeathRating']) {
      effects.push({
        type: 'characteristic-modifier',
        target: { domain: 'characteristic', name },
        operation: 'add',
        value: bonus,
        measure: 'rating',
        condition: 'always',
        source: 'talent',
        origin: { kind: 'discipline', name: d.name, circle: d.circle },
        summary: `Durability ${d.durability} × rank ${d.durabilityRank}`,
      });
    }
  }
  if (highestCircle > 0) {
    effects.push({
      type: 'characteristic-modifier',
      target: { domain: 'characteristic', name: 'DeathRating' },
      operation: 'add',
      value: highestCircle,
      measure: 'rating',
      condition: 'always',
      source: 'Circle',
      summary: `+${highestCircle} from Circle`,
    });
  }
  return effects;
}

/**
 * Fold always-on `characteristic-modifier` effects (adept bonuses + any future
 * item/spell health boosts) onto a table base for a named health rating.
 */
function healthRating(name, base, effects) {
  const match = (e) =>
    e.type === 'characteristic-modifier' &&
    e.target?.domain === 'characteristic' &&
    e.target?.name === name &&
    (e.measure ?? 'rating') === 'rating';
  return applyModifiers(base, effects, match);
}

/**
 * Unconsciousness Rating = 2 × Toughness value (the table `uncon` column) plus
 * Durability. (PG, Health Ratings.)
 * @returns {{base,value,modifiers}|null} null if Toughness is off the table.
 */
export function unconsciousnessRating(toughnessValue, effects, lookup) {
  const row = lookup(toughnessValue);
  if (!row || typeof row.uncon !== 'number') return null;
  return healthRating('UnconsciousnessRating', row.uncon, effects);
}

/**
 * Death Rating = Unconsciousness + Toughness Step (the table `death` column) plus
 * Durability plus the adept's highest Circle. (PG, Health Ratings.)
 * @returns {{base,value,modifiers}|null} null if Toughness is off the table.
 */
export function deathRating(toughnessValue, effects, lookup) {
  const row = lookup(toughnessValue);
  if (!row || typeof row.death !== 'number') return null;
  return healthRating('DeathRating', row.death, effects);
}

/**
 * Recovery Tests per day (the table `recovery` column), from Toughness. No adept
 * bonus in the core rules; effects can still adjust it (taxonomy `RecoveryTests`).
 * @returns {{base,value,modifiers}|null} null if Toughness is off the table.
 */
export function recoveryTests(toughnessValue, effects, lookup) {
  const row = lookup(toughnessValue);
  if (!row || typeof row.recovery !== 'number') return null;
  return healthRating('RecoveryTests', row.recovery, effects);
}

// --- Carrying Capacity (Strength-driven) --------------------------------------

// Strength drives Carrying Capacity.
export const CARRY_ATTRIBUTE = 'Strength';

/**
 * Carrying Capacity in pounds = the Strength row's `carry` column, plus any
 * always-on CarryingCapacity effects. This is the table's one non-linear column
 * (no closed formula), which is why the whole table ships as data. A single value
 * covers both carrying and lifting. (PG, Carrying Capacity: "carry or lift
 * weight… the number of pounds a character may carry without penalty.")
 *
 * Note: the Dwarf *Strong Back* pattern (+Strength for carrying only) is a
 * situational, gmDiscretion effect, so it does not auto-apply here — it is
 * surfaced separately rather than baked into the displayed number.
 *
 * **Lift** is a derived companion: a character can lift more than they can carry,
 * and only needs a Strength test to lift *more than double* their Carrying
 * Capacity — so the most they can lift without a test is `2 × carry − 1`. It is
 * returned as `lift` alongside the carrying `value`.
 *
 * @returns {{base,value,lift,modifiers}|null} null if Strength is off the table.
 */
export function carryingCapacity(strengthValue, effects, lookup) {
  const row = lookup(strengthValue);
  if (!row || typeof row.carry !== 'number') return null;
  const match = (e) =>
    e.type === 'characteristic-modifier' &&
    e.target?.domain === 'characteristic' &&
    e.target?.name === 'CarryingCapacity' &&
    (e.measure ?? 'rating') === 'rating';
  const result = applyModifiers(row.carry, effects, match);
  return { ...result, lift: result.value * 2 - 1 };
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
 * Talent tests are Karma-eligible **by default** — the core rule (PG, Karma:
 * "Unless noted otherwise, spending a Karma Point on a talent allows the adept to
 * roll an additional D6"). This is universal, not Discipline-specific, so it lives
 * as engine logic rather than a per-talent grant. Returns the same grant shape as
 * `karmaUse` (so rollables treat it identically), or `null` when a talent opts out:
 *
 *  - `talent.karma === false` — a talent that "notes otherwise" (data flag in
 *    rules/talents.json; the rare exception).
 *  - `talent.viaVersatility === true` — Versatility-learned talents can *never*
 *    have Karma spent on them (PG, Versatility), a per-character instance flag.
 *
 * @param {{karma?:boolean, viaVersatility?:boolean}|null} talent
 * @returns {{grants: Array<{scope:null, via:null, summary:string}>}|null}
 */
export function talentKarmaUse(talent) {
  if (!talent) return null;
  if (talent.karma === false) return null;
  if (talent.viaVersatility) return null;
  return { grants: [{ scope: null, via: null, summary: 'Talent — Karma may be spent on the test (core rule).' }] };
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
