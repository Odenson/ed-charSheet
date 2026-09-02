// engine/weight.test.js — run with `npm test` (node --test, no deps).
// Covers resolving the catalog's structured weights into pounds and totalling an
// owned-items list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightPounds, carriedWeight } from './weight.js';

test('weightPounds: pounds and the unit table', () => {
  assert.equal(weightPounds({ amount: 5, unit: 'lb' }), 5);
  assert.equal(weightPounds({ amount: 12, unit: 'lb' }), 12);
  assert.equal(weightPounds({ amount: 1, unit: 'lb' }), 1);
  assert.equal(weightPounds({ amount: 2, unit: 'lb' }), 2);
});

test('weightPounds: ounces convert to pounds', () => {
  assert.equal(weightPounds({ amount: 8, unit: 'oz' }), 0.5);
  assert.equal(weightPounds({ amount: 4, unit: 'oz' }), 0.25);
  assert.equal(weightPounds({ amount: 14, unit: 'oz' }), 0.88); // 14/16 = 0.875 → rounded
  assert.equal(weightPounds({ amount: 1, unit: 'oz' }), 0.06);
  assert.equal(weightPounds({ amount: 2, unit: 'oz' }), 0.13);
});

test('weightPounds: a bare number is not a valid ed-items/3 weight (unknown, never pounds)', () => {
  assert.equal(weightPounds(0.1), null);
  assert.equal(weightPounds(5), null);
});

test('weightPounds: a pre-midpointed amount (ranges were collapsed at migration)', () => {
  assert.equal(weightPounds({ amount: 9, unit: 'lb' }), 9); // "8-10 lb" → amount 9
});

test('weightPounds: negligible and unknown values', () => {
  assert.equal(weightPounds({ negligible: true }), 0);
  assert.equal(weightPounds(null), null);
  assert.equal(weightPounds(undefined), null);
  // Anything unrecognised is treated as unknown, never fabricated.
  assert.equal(weightPounds({ amount: 'gargantuan', unit: 'lb' }), null);
  assert.equal(weightPounds({ amount: 5, unit: 'stone' }), null);
  assert.equal(weightPounds('5 lb'), null); // legacy string — no longer parsed
  assert.equal(weightPounds({ negligible: false }), null);
});

test('carriedWeight: sums every owned item (equipped and stored) and counts the unweighed', () => {
  const items = [
    { name: 'Broadsword', ref: { weight: { amount: 10, unit: 'lb' } }, equipped: true },
    { name: 'Rations', ref: { weight: { amount: 8, unit: 'oz' } }, equipped: false },
    { name: 'Hand Axe', ref: { weight: { amount: 9, unit: 'lb' } } }, // migrated "8-10 lb" → 9
    { name: 'Mystery Charm', ref: { weight: null } }, // unrecorded
    { name: 'Woven Blade', ref: {} }, // thread item / unknown — no weight recorded
    { name: 'Feather', ref: { weight: { negligible: true } } },
  ];
  const w = carriedWeight(items);
  assert.equal(w.carried, 19.5); // 10 + 0.5 (8 oz) + 9 (midpoint range) + 0 (negligible) — null/unrecorded skipped
  assert.equal(w.unweighed, 2); // the unrecorded and the no-weight item
  // unweighedItems names each null-weight row so the UI can list them.
  assert.deepEqual(w.unweighedItems, [
    { name: 'Mystery Charm', qty: 1 },
    { name: 'Woven Blade', qty: 1 },
  ]);
});

test('carriedWeight: empty and missing inputs are safe', () => {
  assert.deepEqual(carriedWeight([]), { carried: 0, unweighed: 0, unweighedItems: [] });
  assert.deepEqual(carriedWeight(undefined), { carried: 0, unweighed: 0, unweighedItems: [] });
});

test('carriedWeight: quantity multiplies both the weight and the unweighed count', () => {
  const items = [
    { ref: { weight: { amount: 2, unit: 'lb' } }, qty: 3 }, // 2 × 3 = 6
    { ref: { weight: { amount: 10, unit: 'lb' } } }, // no qty → defaults to 1
    { name: 'Unlabelled Potion', ref: { weight: null }, qty: 4 }, // 4 unknowns, not 1
  ];
  const w = carriedWeight(items);
  assert.equal(w.carried, 16); // 6 + 10
  assert.equal(w.unweighed, 4); // the null stack counts per dose
  // The unweighed row carries its full quantity, not one per dose.
  assert.deepEqual(w.unweighedItems, [{ name: 'Unlabelled Potion', qty: 4 }]);
});

test('carriedWeight: a non-finite or zero quantity is safe', () => {
  const w = carriedWeight([
    { ref: { weight: { amount: 5, unit: 'lb' } }, qty: undefined }, // defaults to 1
    { ref: { weight: { amount: 5, unit: 'lb' } }, qty: 0 }, // contributes nothing
  ]);
  assert.equal(w.carried, 5);
});
