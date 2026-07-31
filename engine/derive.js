// engine/derive.js — pure, DOM-free derivation helpers.
//
// Phase 1 needs only enough of the rules to DISPLAY derived values (Value, Step,
// dice). The full dependency-graph resolver arrives in Phase 3; these functions
// are the seeds of the engine layer and stay framework-agnostic.

/** Attribute Value = base + points + increases (+ future modifiers). */
export function attributeValue(attr) {
  return (attr?.base ?? 0) + (attr?.points ?? 0) + (attr?.increases ?? 0);
}

/**
 * Earthdawn value -> step: Step = ceil(Value / 3) + 1 for Value >= 1.
 * (Verified against Chakka: DEX 20 -> 8, TOU 17 -> 7, PER 14 -> 6, etc.)
 */
export function valueToStep(value) {
  if (value <= 0) return 0;
  return Math.ceil(value / 3) + 1;
}

/** talentStep = attributeStep + rank (+ future talent modifiers). */
export function talentStep(attributeStep, rank) {
  return (attributeStep ?? 0) + (rank ?? 0);
}

/**
 * Build a step -> dice-expression lookup from rules/steps.json.
 * @param {Array<{step:number, dice:string|null}>} stepsTable
 * @returns {(step:number)=>string} dice expression for a step ("" if unknown)
 */
export function makeDiceForStep(stepsTable) {
  const map = new Map();
  for (const row of stepsTable ?? []) map.set(row.step, row.dice ?? '');
  return (step) => map.get(step) ?? '';
}
