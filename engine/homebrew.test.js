// engine/homebrew.test.js — run with `npm test` (node --test, no deps).
// Covers the homebrew formula evaluator (engine/formula.js) and the formula
// override on the health ratings (engine/characteristics.js). The store-level
// wiring lives in store-homebrew.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalFormula, evalTerm } from './formula.js';
import { makeCharacteristics, unconsciousnessRating, deathRating } from './characteristics.js';

const resolve = (ref) =>
  ({
    'attribute|Toughness|Step': 7,
    'attribute|Toughness|Value': 17,
    'talent|Durability|Rank': 3,
    'characteristics|uncon': 34,
    'characteristics|death': 41,
  })[ref];

const table = () => makeCharacteristics({ rows: [{ value: 17, uncon: 34, death: 41, recovery: 3 }] });

test('evalFormula sums signed monomial terms', () => {
  const formula = {
    terms: [
      { times: ['attribute|Toughness|Step', 'talent|Durability|Rank'], note: 'Rank × Step' },
      { ref: 'characteristics|uncon' },
    ],
  };
  assert.equal(evalFormula(formula, resolve), 7 * 3 + 34);
});

test('evalTerm applies coef, subtract sign and the over divisor', () => {
  assert.equal(evalTerm({ ref: 'attribute|Toughness|Step', coef: 2 }, resolve), 14);
  assert.equal(evalTerm({ ref: 'characteristics|uncon', sign: 'subtract' }, resolve), -34);
  assert.equal(
    evalTerm(
      { times: ['attribute|Toughness|Value', 'talent|Durability|Rank'], over: ['attribute|Toughness|Step'] },
      resolve,
    ),
    (17 * 3) / 7,
  );
});

test('evalTerm defaults: coef 1, sign add, an empty over is the identity', () => {
  assert.equal(evalTerm({ ref: 'characteristics|death' }, resolve), 41);
  assert.equal(evalTerm({ times: ['talent|Durability|Rank', 'attribute|Toughness|Step'], over: [] }, resolve), 21);
});

test('an unresolvable ref makes the whole formula null', () => {
  assert.equal(evalFormula({ terms: [{ ref: 'attribute|Nope|Step' }, { ref: 'characteristics|uncon' }] }, resolve), null);
  assert.equal(evalFormula({ terms: [{ ref: 'characteristics|uncon' }, { times: ['attribute|Nope|Step'] }] }, resolve), null);
  assert.equal(evalTerm({ ref: 'attribute|Nope|Step' }, resolve), null);
});

test('a zero denominator makes the term null', () => {
  assert.equal(evalTerm({ times: ['a'], over: ['b'] }, () => 0), null);
});

test('a constant term is just its coef', () => {
  assert.equal(evalTerm({ coef: 5 }, resolve), 5);
  assert.equal(evalTerm({ coef: 3, sign: 'subtract' }, resolve), -3);
});

test('an empty formula evaluates to zero', () => {
  assert.equal(evalFormula({ terms: [] }, resolve), 0);
});

test('unconsciousnessRating: a formula override replaces the table base', () => {
  const formula = {
    terms: [
      { times: ['attribute|Toughness|Step', 'talent|Durability|Rank'] },
      { ref: 'characteristics|uncon' },
    ],
  };
  const result = unconsciousnessRating(17, [], table(), formula, resolve);
  assert.deepEqual(result, { base: 55, value: 55, modifiers: [] });
  // Without an override the table base stands.
  assert.equal(unconsciousnessRating(17, [], table()).base, 34);
});

test('deathRating: a formula override replaces the table base', () => {
  // (Rank × Step) + Step + table death = 3×7 + 7 + 41 = 69.
  const formula = {
    terms: [
      { times: ['attribute|Toughness|Step', 'talent|Durability|Rank'] },
      { ref: 'attribute|Toughness|Step' },
      { ref: 'characteristics|death' },
    ],
  };
  assert.deepEqual(deathRating(17, [], table(), formula, resolve), { base: 69, value: 69, modifiers: [] });
  assert.equal(deathRating(17, [], table()).base, 41);
});

test('effects still fold onto a formula base', () => {
  const effect = {
    type: 'characteristic-modifier',
    target: { domain: 'characteristic', name: 'UnconsciousnessRating' },
    operation: 'subtract',
    value: 3,
    measure: 'rating',
    condition: 'always',
  };
  const formula = {
    terms: [
      { times: ['attribute|Toughness|Step', 'talent|Durability|Rank'] },
      { ref: 'characteristics|uncon' },
    ],
  };
  const result = unconsciousnessRating(17, [effect], table(), formula, resolve);
  assert.equal(result.base, 55);
  assert.equal(result.value, 52);
  assert.equal(result.modifiers.length, 1);
});

test('an unresolvable formula ref makes the rating null (placeholder pill)', () => {
  const formula = { terms: [{ times: ['attribute|Toughness|Step', 'talent|Durability|Rank'] }] };
  assert.equal(unconsciousnessRating(17, [], table(), formula, () => undefined), null);
  assert.equal(deathRating(17, [], table(), formula, () => undefined), null);
});
