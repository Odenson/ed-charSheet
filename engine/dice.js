// engine/dice.js — pure Earthdawn dice roller. DOM-free and testable.
//
// Earthdawn rolls a step's dice expression; any die that rolls its maximum
// "explodes": it is rerolled and added, and the reroll can explode again.

const SIZES = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20 };
// Largest die first, matching the usual "D12+D10" notation.
const ORDER = ['D20', 'D12', 'D10', 'D8', 'D6', 'D4'];

/** Roll a single die with exploding. Returns the chain of rolls, e.g. [12, 7]. */
export function rollDie(sides, rng = Math.random) {
  const rolls = [];
  let v;
  do {
    v = 1 + Math.floor(rng() * sides);
    rolls.push(v);
  } while (v === sides);
  return rolls;
}

/**
 * Roll a step from its steps.json row: { step, dice, breakdown:{D6:2,…}, modifier }.
 * Returns { step, dice, groups:[{label, die, rolls[], subtotal, exploded}], modifier, total }.
 */
export function rollStep(stepRow, rng = Math.random) {
  const groups = [];
  let total = 0;
  for (const label of ORDER) {
    const count = stepRow.breakdown?.[label] ?? 0;
    for (let i = 0; i < count; i++) {
      const die = SIZES[label];
      const rolls = rollDie(die, rng);
      const subtotal = rolls.reduce((a, b) => a + b, 0);
      total += subtotal;
      groups.push({ label, die, rolls, subtotal, exploded: rolls.length > 1 });
    }
  }
  const modifier = stepRow.modifier ?? 0;
  total += modifier;
  return { step: stepRow.step, dice: stepRow.dice, groups, modifier, total };
}
