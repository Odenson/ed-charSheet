// store-health-danger.test.js — model.healthDanger (update-health-overview).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

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
const mk = (health) => ({
  schema: 'ed-character/1',
  meta: { name: 'Test' },
  attributes: { Toughness: { base: 17 } },
  resources: { health },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [],
});

test('model.healthDanger is derived from stored inputs and the model ratings', () => {
  memory.clear();
  const character = mk({ damage: 4, wounds: 0, recoveriesUsed: 0 });
  const m = deriveModel(character, rules);
  const unc = m.characteristics.unconsciousness.value;
  const death = m.characteristics.death.value;
  assert.deepEqual(m.healthDanger, { damage: 'none', wounds: 'none', fill: 4 / death, tick: unc / death });
  assert.deepEqual(character.resources.health, { damage: 4, wounds: 0, recoveriesUsed: 0 });
});

test('model.healthDanger follows damage and wounds (warn, bad, wounds bad)', () => {
  memory.clear();
  const probe = deriveModel(mk({ damage: 0, wounds: 0, recoveriesUsed: 0 }), rules);
  const unc = probe.characteristics.unconsciousness.value;
  const warn = deriveModel(mk({ damage: unc - 1, wounds: 1, recoveriesUsed: 0 }), rules);
  assert.equal(warn.healthDanger.damage, 'warn');
  assert.equal(warn.healthDanger.wounds, 'bad');
  const bad = deriveModel(mk({ damage: unc, wounds: 0, recoveriesUsed: 0 }), rules);
  assert.equal(bad.healthDanger.damage, 'bad');
});

test('model.healthDanger exists with no health resources stored', () => {
  memory.clear();
  const c = mk({});
  delete c.resources;
  const m = deriveModel(c, rules);
  assert.equal(m.healthDanger.wounds, 'none');
  assert.equal(m.healthDanger.damage, 'none');
});
