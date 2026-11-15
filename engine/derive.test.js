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

// --- knackRoll (plans/roll-knacks) ---------------------------------------------
// Step math is expressed with talentStep / the provided inputs, never with literal
// Earthdawn values. Rules: R1 (own Rank+ATTR, parent rank), R2/R5 (house rulings:
// karma + parent mods carry), R3 (knack strain replaces parent), R4 (no step => null).

import { knackRoll } from './derive.js';

const diceForStep = (s) => `D${s}`;
const mk = (over = {}) => ({
  knack: { attribute: 'Perception', detail: { strain: '1' } },
  parent: { rank: 4, step: 10, attribute: 'Perception', karma: { grants: [] }, resultMods: [], rollMods: [] },
  parentAttrStep: 6,
  knackAttrStep: 6,
  catalogStep: 'Rank+PER',
  diceForStep,
  ...over,
});

test('knackRoll: same attribute as parent gives the parent step; dice via diceForStep', () => {
  const r = knackRoll(mk());
  assert.equal(r.step, 10);
  assert.equal(r.dice, 'D10');
  assert.equal(r.strain, 1);
});

test('knackRoll: step = parent.step - parentAttrStep + knackAttrStep (own attribute)', () => {
  const r = knackRoll(mk({ knackAttrStep: 9, knack: { attribute: 'Dexterity', detail: { strain: '0' } } }));
  assert.equal(r.step, 10 - 6 + 9);
});

test('knackRoll: parent step-mod / rank-grant already in parent.step carries over', () => {
  const r = knackRoll(mk({ parent: { ...mk().parent, step: 13 } })); // folded +3
  assert.equal(r.step, 13);
});

test('knackRoll: parent with no attribute uses talentStep(knackAttr, rank) + step rollMods', () => {
  const parent = {
    rank: 4,
    step: 99,
    attribute: null,
    karma: null,
    resultMods: [],
    rollMods: [
      { measure: 'step', value: 2 },
      { measure: 'result', value: 5 },
    ],
  };
  const r = knackRoll(mk({ parent, parentAttrStep: undefined, knackAttrStep: 7 }));
  assert.equal(r.step, talentStep(7, 4) + 2);
});

test('knackRoll: step floors at 1', () => {
  const r = knackRoll(mk({ parent: { ...mk().parent, step: 2 }, knackAttrStep: 1, parentAttrStep: 6 }));
  assert.equal(r.step, 1);
});

test('knackRoll: null for N/A, NA and null catalog step', () => {
  for (const catalogStep of ['N/A', 'NA', null]) assert.equal(knackRoll(mk({ catalogStep })), null, String(catalogStep));
});

test('knackRoll: null when attribute missing, parent missing, or attribute step not finite', () => {
  assert.equal(knackRoll(mk({ knack: { attribute: null, detail: { strain: '1' } } })), null);
  assert.equal(knackRoll(mk({ parent: null })), null);
  assert.equal(knackRoll(mk({ knackAttrStep: undefined })), null);
  assert.equal(knackRoll(mk({ knackAttrStep: NaN })), null);
});

test('knackRoll: knack strain replaces the parent strain (Strain-0 knack under Strain-1 parent => 0)', () => {
  const r = knackRoll(mk({ knack: { attribute: 'Perception', detail: { strain: '0' } }, parent: { ...mk().parent, detail: { strain: 1 } } }));
  assert.equal(r.strain, 0);
});

test('knackRoll: numeric strain accepted; non-numeric/empty/missing strain gives 0', () => {
  const s = (strain) => knackRoll(mk({ knack: { attribute: 'Perception', detail: { strain } } })).strain;
  assert.equal(s(2), 2);
  assert.equal(s('3'), 3);
  assert.equal(s('N/A'), 0);
  assert.equal(s('1 per minute'), 0);
  assert.equal(s(''), 0);
  assert.equal(s(null), 0);
  assert.equal(s(undefined), 0);
});

test('knackRoll: karma follows the parent; null parent karma (Versatility) or skill parent gives null', () => {
  const k = { grants: [{ summary: 'x' }] };
  assert.deepEqual(knackRoll(mk({ parent: { ...mk().parent, karma: k } })).karma, k);
  assert.equal(knackRoll(mk({ parent: { ...mk().parent, karma: null } })).karma, null);
  const { karma: _k, ...skillParent } = mk().parent;
  assert.equal(knackRoll(mk({ parent: skillParent })).karma, null);
});

test('knackRoll: parent resultMods carried; defaults to []', () => {
  const rm = [{ label: 'Boost', value: 2 }];
  assert.deepEqual(knackRoll(mk({ parent: { ...mk().parent, resultMods: rm } })).resultMods, rm);
  const { resultMods: _r, ...noRm } = mk().parent;
  assert.deepEqual(knackRoll(mk({ parent: noRm })).resultMods, []);
});
