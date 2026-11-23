// store-attribute-improve.test.js — run with `npm test` (node --test, no deps).
// Persistence path of improve-attributes using existing store functions plus the new engine:
// apply -> saveAttributeEdits -> applyEdits; undo to baseline -> reconcileOverlay(['attributes'])
// -> no pending edits. Fails until engine/attribute-improve.js exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from './store.js';
import { applyAttributeIncrease, undoAttributeIncrease } from './engine/attribute-improve.js';
import { valueToStep } from './engine/derive.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};
const TABLE = { 1: 800, 2: 1300, 3: 2100 };
const ctx = { costTable: TABLE, available: 5000, stepOf: valueToStep };
const attrs = () => ({
  Dexterity: { base: 10, points: 4, increases: 1 },
  Strength: { base: 9, points: 2, increases: 0 },
});
const file = () => ({ schema: 'ed-character/2', meta: { id: 'x', name: 'X' }, attributes: attrs() });

test('apply -> saveAttributeEdits -> applyEdits: the file attribute is replaced with the raised one', () => {
  memory.clear();
  const saved = attrs();
  const r = applyAttributeIncrease(saved, saved, 'Dexterity', ctx);
  assert.equal(r.ok, true);
  store.saveAttributeEdits(r.attributes, 'x');
  assert.equal(store.hasPendingEdits('x'), true);
  const merged = store.applyEdits(file(), JSON.parse(localStorage.getItem('ed-character-edits:x')));
  assert.equal(merged.attributes.Dexterity.increases, 2);
  assert.equal(merged.attributes.Strength.increases, 0);
});

test('undo to baseline -> reconcileOverlay([attributes]) clears the overlay', () => {
  memory.clear();
  const saved = attrs();
  const up = applyAttributeIncrease(saved, saved, 'Strength', ctx);
  store.saveAttributeEdits(up.attributes, 'x');
  const down = undoAttributeIncrease(up.attributes, saved, 'Strength');
  assert.deepEqual(down.attributes, saved);
  store.reconcileOverlay(['attributes'], 'x');
  assert.equal(store.hasPendingEdits('x'), false);
});
