// engine/weight.test.js — run with `npm test` (node --test, no deps).
// Covers parsing the catalog's inconsistent weight strings into pounds and
// totalling an owned-items list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeight, carriedWeight } from './weight.js';

test('parseWeight: pounds and their spellings', () => {
  assert.equal(parseWeight('5 lb'), 5);
  assert.equal(parseWeight('12 lbs'), 12);
  assert.equal(parseWeight('1 pound'), 1);
  assert.equal(parseWeight('2 pounds'), 2);
});

test('parseWeight: ounces convert to pounds', () => {
  assert.equal(parseWeight('8 oz'), 0.5);
  assert.equal(parseWeight('4 oz'), 0.25);
  assert.equal(parseWeight('14 oz'), 0.88); // 14/16 = 0.875 → rounded
  assert.equal(parseWeight('1 ounce'), 0.06);
  assert.equal(parseWeight('2 ounces'), 0.13);
});

test('parseWeight: a bare number reads as pounds (the catalog unit-less weights)', () => {
  assert.equal(parseWeight('0.1'), 0.1);
  assert.equal(parseWeight(5), 5);
});

test('parseWeight: a range uses the midpoint', () => {
  assert.equal(parseWeight('8-10 lb'), 9);
});

test('parseWeight: negligible and unknown values', () => {
  assert.equal(parseWeight('Neg.'), 0);
  assert.equal(parseWeight('—'), 0);
  assert.equal(parseWeight('NA'), null);
  assert.equal(parseWeight(null), null);
  assert.equal(parseWeight(undefined), null);
  assert.equal(parseWeight(''), null);
  // Anything unrecognised is treated as unknown, never fabricated.
  assert.equal(parseWeight('gargantuan'), null);
});

test('parseWeight: survives surrounding whitespace and case', () => {
  assert.equal(parseWeight('  10 LB  '), 10);
  assert.equal(parseWeight('NA'), null);
});

test('carriedWeight: sums every owned item (equipped and stored) and counts the unweighed', () => {
  const items = [
    { ref: { weight: '10 lb' }, equipped: true },
    { ref: { weight: '8 oz' }, equipped: false },
    { ref: { weight: '8-10 lb' } },
    { ref: { weight: 'NA' } },
    { ref: {} }, // thread item / unknown — no weight recorded
    { ref: { weight: 'Neg.' } },
  ];
  const w = carriedWeight(items);
  assert.equal(w.carried, 19.5); // 10 + 0.5 (8 oz) + 9 (midpoint range) + 0 (Neg.) — NA/unrecorded skipped
  assert.equal(w.unweighed, 2); // the NA and the unrecorded
});

test('carriedWeight: empty and missing inputs are safe', () => {
  assert.deepEqual(carriedWeight([]), { carried: 0, unweighed: 0 });
  assert.deepEqual(carriedWeight(undefined), { carried: 0, unweighed: 0 });
});
