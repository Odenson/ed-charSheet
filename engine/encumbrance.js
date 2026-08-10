// engine/encumbrance.js — the encumbrance stages and their synthesized effects.
// Pure and DOM-free (ARCHITECTURE §3/§5).
//
// Source: Players' Guide p.405, Encumbrance. A character's Carrying Capacity
// (the `carry` column of the Characteristics Table) is the weight they carry
// *without penalty*. Past it the penalties step up:
//
//   clear         carried ≤ capacity
//   burdened      capacity < carried ≤ 150% of capacity
//                    Movement Rate halved; considered Harried (PG p.405).
//   overburdened  150% < carried ≤ 200% of capacity
//                    Movement Rate reduced to 2; Physical & Mystic Defense
//                    reduced to 2; must drop the excess to do anything but move.
//   excess        carried > 200% of capacity (beyond lift-without-a-test)
//                    Same fold as overburdened; the character cannot carry the
//                    total — lifting it needs a Strength test (PG p.405: the
//                    difficulty is the minimum Strength needed to lift the
//                    weight, minus the character's Strength, plus 6; 1 Strain
//                    per round while lifting, and no moving while lifting).
//
// Harried (PG p.388 / Situation Modifiers Table): −2 to Action test Steps and
// −2 to Physical/Mystic Defense; the defense modifier also applies to Social
// Defense at the gamemaster's discretion — hence the `gmDiscretion` note, which
// the engine surfaces but never folds into a number (EFFECT-TAXONOMY §6).
//
// The effects use existing taxonomy v3 vocabulary — no taxonomy change (Tier 3).

export const ENCUMBRANCE = {
  CLEAR: 'clear',
  BURDENED: 'burdened',
  OVERBURDENED: 'overburdened',
  EXCESS: 'excess',
};

/** Display labels for the state chip (UI renders; engine supplies the word). */
export const STAGE_LABELS = {
  [ENCUMBRANCE.CLEAR]: 'Clear',
  [ENCUMBRANCE.BURDENED]: 'Burdened',
  [ENCUMBRANCE.OVERBURDENED]: 'Overburdened',
  [ENCUMBRANCE.EXCESS]: 'Exceeds lift',
};

/**
 * The encumbrance stage for a carried weight against a carrying capacity (both
 * in pounds). A missing capacity (character off the table) can never be judged,
 * so the stage stays `clear` — the UI renders the placeholder then.
 *
 * @param {number} carried  total carried weight in pounds
 * @param {number|null|undefined} capacity  carrying capacity in pounds
 * @returns {{stage: string, label: string, ratio: number|null}}
 */
export function encumbranceStage(carried, capacity) {
  if (capacity == null || !Number.isFinite(capacity) || capacity <= 0) {
    return { stage: ENCUMBRANCE.CLEAR, label: STAGE_LABELS[ENCUMBRANCE.CLEAR], ratio: null };
  }
  const ratio = carried / capacity;
  let stage;
  if (ratio > 2) stage = ENCUMBRANCE.EXCESS;
  else if (ratio > 1.5) stage = ENCUMBRANCE.OVERBURDENED;
  else if (ratio > 1) stage = ENCUMBRANCE.BURDENED;
  else stage = ENCUMBRANCE.CLEAR;
  return { stage, label: STAGE_LABELS[stage], ratio };
}

/**
 * The taxonomy effects a stage imposes, tagged `source: "condition"`. The store
 * stamps an `origin` ({ kind: "condition", name: "Burdened" | "Overburdened" })
 * so they surface in the Active Effects panel and fold into the derived ratings
 * — like the Knocked Down condition (engine/health.js). `condition: "always"`
 * because they are only ever *present* while the stage holds; they never leave
 * the fold while the sheet is over capacity.
 *
 * @param {string} stage  one of ENCUMBRANCE
 * @returns {Array<object>} empty for `clear`
 */
export function encumbranceEffects(stage) {
  switch (stage) {
    case ENCUMBRANCE.BURDENED:
      return [
        {
          type: 'characteristic-modifier',
          target: { domain: 'characteristic', name: 'Movement', property: 'Walk' },
          operation: 'multiply',
          value: 0.5,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Burdened — Movement Rate halved.',
        },
        {
          type: 'defense-modifier',
          target: { domain: 'defense', name: 'Physical' },
          operation: 'add',
          value: -2,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Burdened (Harried) — Physical Defense −2.',
        },
        {
          type: 'defense-modifier',
          target: { domain: 'defense', name: 'Mystic' },
          operation: 'add',
          value: -2,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Burdened (Harried) — Mystic Defense −2.',
        },
        {
          type: 'defense-modifier',
          target: { domain: 'defense', name: 'Social' },
          operation: 'add',
          value: -2,
          measure: 'rating',
          condition: 'always',
          gmDiscretion: true,
          source: 'condition',
          summary: 'Burdened (Harried) — Social Defense −2 (gamemaster’s discretion).',
        },
        {
          type: 'test-modifier',
          target: { domain: 'test', name: 'Action' },
          operation: 'add',
          value: -2,
          measure: 'step',
          condition: 'always',
          source: 'condition',
          summary: 'Burdened (Harried) — −2 to Action test Steps.',
        },
      ];
    case ENCUMBRANCE.OVERBURDENED:
      return [
        {
          type: 'characteristic-modifier',
          target: { domain: 'characteristic', name: 'Movement', property: 'Walk' },
          operation: 'min',
          value: 2,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Overburdened — Movement Rate reduced to 2.',
        },
        {
          type: 'defense-modifier',
          target: { domain: 'defense', name: 'Physical' },
          operation: 'min',
          value: 2,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Overburdened — Physical Defense reduced to 2.',
        },
        {
          type: 'defense-modifier',
          target: { domain: 'defense', name: 'Mystic' },
          operation: 'min',
          value: 2,
          measure: 'rating',
          condition: 'always',
          source: 'condition',
          summary: 'Overburdened — Mystic Defense reduced to 2.',
        },
        {
          type: 'note',
          summary: 'Overburdened — must drop the excess weight to do anything but move.',
        },
      ];
    case ENCUMBRANCE.EXCESS: {
      const base = encumbranceEffects(ENCUMBRANCE.OVERBURDENED);
      return [
        ...base,
        {
          type: 'note',
          summary:
            'Exceeds lift capacity (2× carry) — lifting this much needs a Strength test ' +
            '(difficulty = minimum Strength needed − Strength + 6), costs 1 Strain per round, and allows no movement.',
        },
      ];
    }
    default:
      return [];
  }
}
