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
