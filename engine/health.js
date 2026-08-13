// engine/health.js — pure, DOM-free session health state for the Overview.
// Given the stored damage/wounds inputs and the engine-derived health ratings,
// derive the character's standing (conscious / unconscious / dead) and the
// headroom left before each threshold. The engine computes; the view renders.
//
// Recompute-all model, like characteristics.js: a pure function of its inputs,
// so editing Current Damage simply re-runs it — no mutation, no hidden state.
//
// Health state rules (PG, Health section):
//   - Current Damage ≥ Unconsciousness Rating  -> unconscious
//   - Current Damage ≥ Death Rating            -> dead
//   - Wounds are tracked here but their action penalty is a later slice.

/** Human-readable states, from best to worst. `null` when ratings are absent. */
export const HEALTH_STATES = ['unhurt', 'conscious', 'unconscious', 'dead'];

// Read a rating argument that may arrive as the engine's {base, value,
// modifiers} object or as a bare number. Returns null when it can't be read.
const ratingValue = (r) =>
  typeof r === 'object' && r !== null ? (Number.isFinite(r.value) ? r.value : null) : Number.isFinite(r) ? r : null;

/**
 * Derive the character's health state from the stored inputs and the derived
 * ratings. Pure: never mutates, never clamps the inputs it is handed.
 *
 * @param {object} inputs  `{ damage, wounds }` — the stored `resources.health` inputs.
 * @param {object} ratings `{ unconsciousness, death }` — the derived rating
 *   objects (or numbers) from store.js `characteristics`.
 * @returns {{damage:number, wounds:number, state:string|null,
 *   toUnconscious:number|null, toDeath:number|null}}
 *   `state` is null (and the headrooms null) when a rating is missing — the UI
 *   must show a placeholder pill, never a fabricated readout (UI-GUIDELINES §5).
 */
export function damageState(inputs, ratings) {
  const damage = Math.max(0, Number(inputs?.damage) || 0);
  const wounds = Math.max(0, Number(inputs?.wounds) || 0);
  const uncon = ratingValue(ratings?.unconsciousness);
  const death = ratingValue(ratings?.death);
  if (uncon == null || death == null) {
    return { damage, wounds, state: null, toUnconscious: null, toDeath: null };
  }
  let state = damage > 0 ? 'conscious' : 'unhurt';
  if (damage >= uncon) state = 'unconscious';
  if (damage >= death) state = 'dead';
  return {
    damage,
    wounds,
    state,
    toUnconscious: Math.max(0, uncon - damage),
    toDeath: Math.max(0, death - damage),
  };
}

const clampInt = (n) => Math.max(0, Number.isFinite(n) ? n : 0);

/**
 * Apply a signed change to the stored health inputs, returning a NEW inputs
 * object clamped at 0 (a character's damage/wounds can't go negative). Pure —
 * never mutates the inputs it is handed; the caller persists the result.
 *
 * @param {object} health current `resources.health` inputs
 * @param {object} change signed deltas: `{ damage, wounds, recoveriesUsed }`
 *   (omit the ones you don't want to touch; a Recovery test is
 *   `{ damage: -result, recoveriesUsed: 1 }`).
 * @returns {{damage:number, wounds:number, recoveriesUsed:number}}
 */
export function applyHealth(health, change) {
  const delta = (n) => (Number.isFinite(n) ? n : 0);
  return {
    damage: Math.max(0, (health?.damage ?? 0) + delta(change?.damage)),
    wounds: Math.max(0, (health?.wounds ?? 0) + delta(change?.wounds)),
    recoveriesUsed: Math.max(0, (health?.recoveriesUsed ?? 0) + delta(change?.recoveriesUsed)),
  };
}

/**
 * How many Recovery Tests the character has left today: the derived per-day max
 * minus the stored `recoveriesUsed` input, never below 0. `null` when the max
 * isn't known yet (no derived rating) — the guard then stands aside and lets the
 * roll through rather than guess. The single decision point both the buttons
 * (disable themselves at 0) and the apply site (refuse a heal) read from, so a
 * Recovery test can never be used with none left.
 * @param {number} used the stored `resources.health.recoveriesUsed` input
 * @param {number|null} max the derived `characteristics.recoveries.value`
 * @returns {number|null}
 */
export function recoveriesRemaining(used, max) {
  if (max == null || !Number.isFinite(max)) return null;
  return Math.max(0, max - (Number(used) || 0));
}

// --- Wounds & knockdown (a wounding hit) --------------------------------------
//
// Owner-stated rules (plan docs/PLAN-WOUNDS-KNOCKDOWN.md):
//   - Wound: a single hit with damage >= Wound Threshold inflicts one Wound.
//   - Knockdown: only when that hit is 5 or more over the Wound Threshold. The
//     character rolls an open-ended Strength test (the Knockdown step) against
//     a Difficulty Number equal to the hit's damage minus the Wound Threshold.
//     Result >= Difficulty -> stays up; below -> knocked down.
// All helpers are null-safe: with no computed Wound Threshold they return the
// safe default (0 / false / null) so the UI never invents a threshold.

/**
 * How many Wounds a single hit inflicts: 1 when its damage is at or above the
 * Wound Threshold, else 0. (4E: a wound when a single attack's damage meets the
 * threshold — binary per hit, not per threshold multiple.)
 * @param {number} take the hit's damage (as recorded in the damage modal)
 * @param {number|null} woundThreshold the derived Wound Threshold value
 * @returns {number} 1 | 0
 */
export function woundsFromHit(take, woundThreshold) {
  return woundThreshold != null && Number.isFinite(take) && take >= woundThreshold ? 1 : 0;
}

/**
 * Does this hit trigger a Knockdown test? Only when the damage is five or more
 * over the Wound Threshold (per the owner-stated rule).
 * @returns {boolean}
 */
export function knockdownTriggered(take, woundThreshold) {
  return woundThreshold != null && Number.isFinite(take) && take >= woundThreshold + 5;
}

/**
 * The Knockdown test's Difficulty Number = the hit's damage minus the Wound
 * Threshold. Only meaningful when `knockdownTriggered` (so >= 5); null otherwise.
 * @returns {number|null}
 */
export function knockdownDifficulty(take, woundThreshold) {
  if (!knockdownTriggered(take, woundThreshold)) return null;
  return take - woundThreshold;
}

/**
 * The outcome of a Knockdown test, once the open-ended Strength test is rolled:
 * `'up'` when the result is at or above the Difficulty (not knocked down),
 * `'down'` when it falls short. Null when the comparison can't be made.
 * @returns {'up'|'down'|null}
 */
export function knockdownOutcome(result, difficulty) {
  if (difficulty == null || !Number.isFinite(result)) return null;
  return result >= difficulty ? 'up' : 'down';
}

/**
 * The synthesized effect for the Knocked Down condition's test penalty, so one
 * source serves both the Active Effects panel and the roll-time penalty.
 * `measure: "result"` — a flat penalty to the rolled test, applied at roll time
 * (the book's general rule applies modifiers to the Step; a result modifier is
 * the explicitly-sanctioned GM-discretion alternative — PG "Bonuses and
 * Penalties"). Per the PG p.389 the penalty hits *every* test while prone
 * ("suffers a –3 penalty to his tests" — the worked example includes the next
 * Initiative test), not just Action tests. `test-modifier`, `condition` and
 * `measure` are taxonomy v3 vocabulary — no taxonomy change.
 */
export const KNOCKED_DOWN_EFFECT = {
  type: 'test-modifier',
  target: { domain: 'test', name: 'Action' },
  operation: 'add',
  value: -3,
  measure: 'result',
  condition: 'always',
  source: 'condition',
  summary: '−3 to all tests while knocked down.',
};

/**
 * The Knocked Down condition also subtracts 3 from Physical and Mystic Defense
 * (PG p.389; Social Defense only at the gamemaster's discretion, so it is not
 * folded here). Two `defense-modifier` effects — one per defense — so they fold
 * into the derived ratings while the condition input is set and drop back out
 * when it is cleared. Same taxonomy vocabulary as the rules' own defense
 * modifiers (rules/disciplines.json).
 */
export const KNOCKED_DOWN_DEFENSE_EFFECTS = [
  {
    type: 'defense-modifier',
    target: { domain: 'defense', name: 'Physical' },
    operation: 'add',
    value: -3,
    measure: 'rating',
    condition: 'always',
    source: 'condition',
    summary: '−3 Physical Defense while knocked down.',
  },
  {
    type: 'defense-modifier',
    target: { domain: 'defense', name: 'Mystic' },
    operation: 'add',
    value: -3,
    measure: 'rating',
    condition: 'always',
    source: 'condition',
    summary: '−3 Mystic Defense while knocked down.',
  },
];
