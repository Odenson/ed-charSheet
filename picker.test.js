// picker.test.js — regression tests for the pure add-picker selection
// (ui/picker.js). The D3 bug (plans/PLAN-CUSTOM-ITEMS.md §6.6 P8.4): the merged
// itemCatalog appends custom items after ~179 canon entries and the picker caps
// results at 50 — a freshly saved custom item never appeared in the browse list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickItemKeys, groupItemKeys, ITEM_CHIPS, PICKER_CAP, PICKER_LABELS } from './ui/picker.js';
import { ITEM_KIND_ORDER, itemChipMatches } from './ui/item-filter.js';

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

const mixed = {
  Sword: { kind: 'weapon' }, Dagger: { kind: 'weapon' }, Mail: { kind: 'armor' },
  Rope: gear, Mine: { kind: 'weapon' }, Aras: { kind: 'thread-item', tier: 'Journeyman', threadRanks: [] },
};

test('groupItemKeys sections by kind in order, custom first, uncapped', () => {
  const g = groupItemKeys({ catalog: mixed, customNames: ['Mine'] });
  assert.deepEqual(g.map((s) => s.id), ['custom', 'weapon', 'armor', 'gear', 'thread-item']);
  assert.deepEqual(g[0].keys, ['Mine']);
  assert.deepEqual(g[1].keys, ['Sword', 'Dagger'], 'a custom item is not repeated in its kind section');
  const big = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`Item ${i}`, gear]));
  assert.equal(groupItemKeys({ catalog: big })[0].keys.length, 60, 'no 50-item cap');
});

test('groupItemKeys: every thread item in the real catalog is reachable', () => {
  const { items } = JSON.parse(readFileSync(new URL('./rules/thread-items.json', import.meta.url), 'utf8'));
  const canon = JSON.parse(readFileSync(new URL('./rules/items.json', import.meta.url), 'utf8')).items;
  const g = groupItemKeys({ catalog: { ...canon, ...items } });
  assert.equal(g.find((s) => s.id === 'thread-item').keys.length, Object.keys(items).length);
});

test('groupItemKeys chip filters by kind or custom; query narrows within', () => {
  const kinds = (o) => groupItemKeys({ catalog: mixed, customNames: ['Mine'], ...o }).map((s) => s.id);
  assert.deepEqual(kinds({ chip: 'weapon' }), ['weapon'], 'kind chip: custom weapon sits in its kind section');
  assert.deepEqual(groupItemKeys({ catalog: mixed, customNames: ['Mine'], chip: 'weapon' })[0].keys, ['Sword', 'Dagger', 'Mine']);
  assert.deepEqual(kinds({ chip: 'custom' }), ['custom']);
  assert.deepEqual(kinds({ chip: 'thread-item' }), ['thread-item']);
  assert.deepEqual(kinds({ query: 'dag' }), ['weapon']);
  assert.deepEqual(kinds({ chip: 'armor', query: 'sword' }), []);
});

test('ITEM_CHIPS: All, Custom, then one chip per kind with labels', () => {
  assert.deepEqual(ITEM_CHIPS.slice(0, 2), [{ id: 'all', label: 'All' }, { id: 'custom', label: 'Custom' }]);
  assert.equal(ITEM_CHIPS.length, 2 + ITEM_KIND_ORDER.length);
  assert.ok(ITEM_CHIPS.every((c) => c.label));
});

test('itemChipMatches', () => {
  assert.ok(itemChipMatches('all', { kind: 'gear' }));
  assert.ok(itemChipMatches('custom', { kind: 'gear', custom: true }));
  assert.ok(!itemChipMatches('custom', { kind: 'gear' }));
  assert.ok(itemChipMatches('gear', { kind: 'gear' }));
  assert.ok(!itemChipMatches('weapon', { kind: 'gear' }));
});

test('PICKER_LABELS covers every kind the add-picker shows', () => {
  const kinds = ['weapon', 'armor', 'shield', 'ammunition', 'gear', 'magic-item', 'blood-charm', 'healing-aid', 'thread-item'];
  for (const k of kinds) assert.ok(PICKER_LABELS[k], `label for ${k}`);
});
