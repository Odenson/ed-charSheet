// picker.test.js — regression tests for the pure add-picker selection
// (ui/picker.js). The D3 bug (docs/PLAN-CUSTOM-ITEMS.md §6.6 P8.4): the merged
// itemCatalog appends custom items after ~179 canon entries and the picker caps
// results at 50 — a freshly saved custom item never appeared in the browse list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickItemKeys, PICKER_CAP, PICKER_LABELS } from './ui/picker.js';

const gear = { kind: 'gear' };

test('a custom item surfaces within the cap despite 179 canon items', () => {
  const { items } = JSON.parse(readFileSync(new URL('./rules/items.json', import.meta.url), 'utf8'));
  const canonKeys = Object.keys(items);
  assert.ok(canonKeys.length > PICKER_CAP, `canon catalog (${canonKeys.length}) must exceed the picker cap (${PICKER_CAP})`);
  const custom = { 'Smoke Cloak': gear };
  const keys = pickItemKeys({ catalog: { ...items, ...custom }, customNames: Object.keys(custom), query: '' });
  assert.ok(keys.includes('Smoke Cloak'), 'custom item is within the first 50 browse results');
});

test('custom items sort ahead of canon items in browse results', () => {
  const catalog = { Alpha: gear, Zed: { kind: 'weapon' }, Mine: { kind: 'armor' } };
  const keys = pickItemKeys({ catalog, customNames: ['Mine'], query: '' });
  assert.equal(keys[0], 'Mine');
});

test('query filters by name, kind label and effect summaries', () => {
  const catalog = {
    Sword: { kind: 'weapon', effects: [{ summary: 'slashes deeply' }] },
    Cloak: gear,
    'Spirit Blade': {
      kind: 'thread-item',
      base: { effects: [{ summary: 'ethereal' }] },
      threadRanks: [{ rank: 1, effects: [{ summary: 'banes spirits' }] }],
    },
  };
  assert.deepEqual(pickItemKeys({ catalog, query: 'cloak' }), ['Cloak'], 'matches by name');
  assert.deepEqual(pickItemKeys({ catalog, query: 'weapon' }), ['Sword'], 'matches by kind label');
  assert.deepEqual(pickItemKeys({ catalog, query: 'slash' }), ['Sword'], 'matches by plain effect summary');
  assert.deepEqual(pickItemKeys({ catalog, query: 'bane' }), ['Spirit Blade'], 'matches by thread-rank effect summary');
  assert.deepEqual(pickItemKeys({ catalog, query: 'ethereal' }), ['Spirit Blade'], 'matches by base effect summary');
});

test('results are capped at PICKER_CAP', () => {
  const catalog = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`Item ${i}`, gear]));
  assert.equal(pickItemKeys({ catalog, query: '' }).length, PICKER_CAP);
});

test('PICKER_LABELS covers every kind the add-picker shows', () => {
  const kinds = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'magic-item', 'blood-charm', 'healing-aid', 'thread-item'];
  for (const k of kinds) assert.ok(PICKER_LABELS[k], `label for ${k}`);
});
