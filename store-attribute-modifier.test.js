// store-attribute-modifier.test.js — run with `npm test` (node --test, no deps).
// T-002 (docs/TAXONOMY-AUDIT.md): always-on `attribute-modifier` effects fold into
// the derived attribute Value/Step, and everything downstream of the attribute
// (carrying capacity, defences) reads the folded Value. Stored inputs are never
// touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

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

const character = (threadRank, equipped = true) => ({
  meta: { name: 'Test', race: 'Human' },
  attributes: {
    Dexterity: { base: 12 },
    Strength: { base: 14 },
    Toughness: { base: 12 },
    Perception: { base: 12 },
    Willpower: { base: 12 },
    Charisma: { base: 12 },
  },
  resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [{ name: 'Bracers of Obsidiman Strength', equipped, threadRank }],
});

const str = (m) => m.attributes.find((a) => a.name === 'Strength');

test('Bracers of Obsidiman Strength rank 6 adds +2 Strength Value, Step and carrying capacity', () => {
  const plain = deriveModel(character(0), rules);
  const woven = deriveModel(character(6), rules);
  assert.equal(str(plain).value, 14);
  assert.equal(str(woven).value, 16);
  assert.equal(str(woven).base, 14, 'stored input untouched');
  assert.ok(str(woven).step >= str(plain).step);
  assert.equal(str(woven).modifiers.length, 1);
  assert.equal(str(woven).valueDelta, 2, 'net change for the Overview badge');
  assert.equal(str(woven).rawValue, 14);
  assert.equal(str(plain).valueDelta, 0);
  assert.equal(str(woven).modifiers[0].measure, 'value');
  assert.ok(
    woven.characteristics.carryingCapacity.value > plain.characteristics.carryingCapacity.value,
    'carrying capacity reads the folded Strength',
  );
});

test('an unequipped or unwoven item contributes nothing', () => {
  assert.equal(str(deriveModel(character(6, false), rules)).value, 14);
  assert.equal(str(deriveModel(character(3), rules)).value, 14);
});
