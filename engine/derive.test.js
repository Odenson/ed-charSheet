// engine/derive.test.js — run with `npm test` (node --test, no deps).
// Covers the pure derivation helpers that drive the store (store.js:8): attribute
// value/step, talent step, and the step→dice lookup over the real rules/steps.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attributeValue, valueToStep, talentStep, makeDiceForStep } from './derive.js';

// --- attributeValue -----------------------------------------------------------

test('attributeValue sums base + points + increases (Chakka anchors)', () => {
  assert.equal(attributeValue({ base: 10, points: 8, increases: 2 }), 20); // Dexterity
  assert.equal(attributeValue({ base: 13, points: 5, increases: 2 }), 20); // Strength
  assert.equal(attributeValue({ base: 10, points: 3, increases: 1 }), 14); // Perception
  assert.equal(attributeValue({ base: 9, points: 2, increases: 2 }), 13); //  Charisma
});

test('attributeValue guards missing fields', () => {
  assert.equal(attributeValue({ base: 10 }), 10);
  assert.equal(attributeValue({}), 0);
  assert.equal(attributeValue(undefined), 0);
  assert.equal(attributeValue(null), 0);
});

// --- valueToStep --------------------------------------------------------------

test('valueToStep matches the Earthdawn table (ceil(v/3) + 1)', () => {
  assert.equal(valueToStep(1), 2);
  assert.equal(valueToStep(2), 2);
  assert.equal(valueToStep(3), 2);
  assert.equal(valueToStep(4), 3);
  assert.equal(valueToStep(6), 3);
  assert.equal(valueToStep(7), 4);
  assert.equal(valueToStep(13), 6);
  assert.equal(valueToStep(14), 6);
  assert.equal(valueToStep(17), 7);
  assert.equal(valueToStep(20), 8);
  assert.equal(valueToStep(30), 11);
});

test('valueToStep returns 0 for non-positive values', () => {
  assert.equal(valueToStep(0), 0);
  assert.equal(valueToStep(-3), 0);
  assert.equal(valueToStep(Number.NEGATIVE_INFINITY), 0);
});

test('valueToStep matches Chakka\'s six attribute steps', () => {
  const attrs = {
    Dexterity: 20, Strength: 20, Toughness: 17,
    Perception: 14, Willpower: 13, Charisma: 13,
  };
  assert.deepEqual(Object.fromEntries(Object.entries(attrs).map(([n, v]) => [n, valueToStep(v)])), {
    Dexterity: 8, Strength: 8, Toughness: 7,
    Perception: 6, Willpower: 6, Charisma: 6,
  });
});

// --- talentStep ---------------------------------------------------------------

test('talentStep = attribute step + rank', () => {
  assert.equal(talentStep(8, 5), 13);
  assert.equal(talentStep(6, 0), 6);
});

test('talentStep guards missing inputs', () => {
  assert.equal(talentStep(undefined, 5), 5);
  assert.equal(talentStep(8, undefined), 8);
  assert.equal(talentStep(undefined, undefined), 0);
});

// --- makeDiceForStep (over the real rules/steps.json) -------------------------

const stepsFile = JSON.parse(readFileSync(new URL('../rules/steps.json', import.meta.url)));

test('steps.json is the wrapped { schema, steps } shape', () => {
  assert.equal(stepsFile.schema, 'ed-steps/1');
  assert.equal(stepsFile.steps.length, 41);
});

test('makeDiceForStep returns the table dice for the working steps', () => {
  const diceForStep = makeDiceForStep(stepsFile.steps);
  assert.equal(diceForStep(1), 'D4 (-2)');
  assert.equal(diceForStep(8), '2D6');
  assert.equal(diceForStep(13), 'D12+D10');
  assert.equal(diceForStep(20), 'D20+D8+D6');
  assert.equal(diceForStep(40), '2D20+D12+D10+D8');
});

test('makeDiceForStep round-trips every row in the table', () => {
  const diceForStep = makeDiceForStep(stepsFile.steps);
  for (const row of stepsFile.steps) {
    assert.equal(diceForStep(row.step), row.dice ?? '');
  }
});

test('makeDiceForStep returns "" for unknown steps and step 0', () => {
  const diceForStep = makeDiceForStep(stepsFile.steps);
  assert.equal(diceForStep(0), ''); // dice null
  assert.equal(diceForStep(41), '');
  assert.equal(diceForStep(-1), '');
  assert.equal(diceForStep(2.5), '');
  assert.equal(diceForStep(undefined), '');
});

test('makeDiceForStep tolerates a missing table', () => {
  const diceForStep = makeDiceForStep(undefined);
  assert.equal(diceForStep(8), '');
});
