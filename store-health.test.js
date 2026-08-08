// store-health.test.js — run with `npm test` (node --test, no deps).
// Covers the health slice of the edits overlay: saving Current Damage / Wounds /
// Recovery-tests-used to localStorage, the overlay merge back onto the character
// (applyEdits), and that deriveModel exposes the derived characteristics the
// Overview renders (woundThreshold + healthState) without storing them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel, saveHealthEdits, hasPendingEdits, reconcileOverlay, applyEdits } from './store.js';

// Node has no localStorage; the store reads/writes the global. A tiny in-memory
// stub is enough — the store only uses get/set/removeItem.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const rules = {
  steps: read('steps.json').steps,
  talentsFile: read('talents.json'),
  disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'),
  characteristicsFile: read('characteristics.json'),
  itemsFile: read('items.json'),
  legendFile: read('legend.json'),
  skillsFile: read('skills.json'),
  knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'),
};

const baseCharacter = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Test' },
  attributes: {},
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [],
});

test('saveHealthEdits round-trips and applyEdits merges health into resources.health', () => {
  memory.clear();
  const edits = saveHealthEdits({ damage: 7, wounds: 1, recoveriesUsed: 2 }, 'c1');
  const character = baseCharacter();
  const next = applyEdits(character, edits);
  assert.deepEqual(next.resources.health, { damage: 7, wounds: 1, recoveriesUsed: 2 });
  assert.equal(character.resources.health.damage, 0); // original untouched
  assert.notEqual(next, character); // overlay builds a fresh character
});

test('applyEdits health overlay preserves the other stored inputs', () => {
  memory.clear();
  const edits = saveHealthEdits({ damage: 4 }, 'c1');
  const character = {
    ...baseCharacter(),
    meta: { name: 'Rook', race: 'Dwarf' },
    items: [{ name: 'Bracers of Aras', equipped: true }],
    resources: { legend: { totalEarnt: 100 }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  };
  const next = applyEdits(character, edits);
  assert.equal(next.resources.health.damage, 4);
  assert.equal(next.meta.name, 'Rook'); // untouched
  assert.equal(next.items.length, 1); // untouched
  assert.equal(next.resources.legend.totalEarnt, 100); // untouched
});

test('hasPendingEdits: false before, true after a health edit, false after reconcile', () => {
  memory.clear();
  assert.equal(hasPendingEdits('c2'), false);
  saveHealthEdits({ damage: 3 }, 'c2');
  assert.equal(hasPendingEdits('c2'), true);
  reconcileOverlay(undefined, 'c2');
  assert.equal(hasPendingEdits('c2'), false);
});

test('a later health save replaces the whole health object (stored as-is, not merged)', () => {
  memory.clear();
  saveHealthEdits({ damage: 5 }, 'c3');
  saveHealthEdits({ damage: 9 }, 'c3');
  const edits = saveHealthEdits({ damage: 2, wounds: 1, recoveriesUsed: 1 }, 'c3');
  assert.deepEqual(edits.health, { damage: 2, wounds: 1, recoveriesUsed: 1 });
});

test('deriveModel exposes woundThreshold and healthState from stored inputs only', () => {
  memory.clear();
  const character = {
    ...baseCharacter(),
    attributes: { Toughness: { base: 17 } },
    resources: { health: { damage: 4, wounds: 0, recoveriesUsed: 0 } },
  };
  const model = deriveModel(character, rules);
  // Derived ratings (Tou 17 -> wound 11, uncon 34, death 41) — never stored.
  assert.equal(model.characteristics.woundThreshold.value, 11);
  assert.equal(model.characteristics.unconsciousness.value, 34);
  assert.equal(model.characteristics.death.value, 41);
  assert.equal(model.characteristics.recoveries.value, 3);
  assert.equal(model.healthState.state, 'conscious');
  assert.equal(model.healthState.damage, 4);
  assert.equal(model.healthState.toUnconscious, 30);
  assert.equal(model.healthState.toDeath, 37);
  // The stored inputs themselves are untouched — the sheet stores only inputs.
  assert.deepEqual(character.resources.health, { damage: 4, wounds: 0, recoveriesUsed: 0 });
});
