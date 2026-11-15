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

/**
 * Derive a knack's roll (plans/roll-knacks). Pure; the caller gathers the inputs.
 * `catalogStep` is the raw catalog step, used ONLY to check that the knack is
 * rollable (never parsed); the attribute comes from the structured `knack.attribute`.
 * Step = the knack's own Rank+ATTR with the governing parent's rank: the parent's
 * folded step swaps its attribute step for the knack's, so step mods and rank grants
 * carry. Returns null when there is nothing to roll.
 * @returns {{step:number, dice:string, strain:number, karma:object|null, resultMods:Array}|null}
 */
export function knackRoll({ knack, parent, parentAttrStep, knackAttrStep, catalogStep, diceForStep }) {
  if (!knack?.attribute || !parent) return null;
  if (catalogStep == null || catalogStep === 'N/A' || catalogStep === 'NA') return null;
  if (!Number.isFinite(knackAttrStep)) return null;
  let step;
  if (Number.isFinite(parentAttrStep)) {
    step = parent.step - parentAttrStep + knackAttrStep;
  } else {
    const mods = (parent.rollMods ?? []).filter((m) => m?.measure === 'step').reduce((s, m) => s + (Number(m.value) || 0), 0);
    step = talentStep(knackAttrStep, parent.rank) + mods;
  }
  step = Math.max(1, step);
  const raw = knack.detail?.strain;
  const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  return {
    step,
    dice: diceForStep(step),
    strain: Number.isFinite(n) ? n : 0,
    karma: parent.karma ?? null,
    resultMods: parent.resultMods ?? [],
  };
}
