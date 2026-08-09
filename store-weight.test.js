// store-weight.test.js — run with `npm test` (node --test, no deps).
// Covers the carried-weight + encumbrance slice of deriveModel: the engine
// derives the pound total from every owned item, judges it against Carrying
// Capacity, folds the stage's effects (Movement/Defences) into the derived
// character, and surfaces the condition in activeEffects — all from stored
// inputs, never stored itself.

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

// A Dwarf (walk 10, Strong Back is situational so capacity stays raw) with
// Strength 13 → carrying capacity 125 lb, Dexterity 13 → PD 8, Perception 12 → MD 7.
const baseCharacter = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Test', race: 'Dwarf' },
  attributes: { Strength: { base: 13 }, Dexterity: { base: 13 }, Perception: { base: 12 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [],
});

// Real catalog items with their recorded weights (rules/items.json).
const ITEMS = {
  dagger: { name: 'Dagger', equipped: true }, // 1 lb
  club: { name: 'Club', equipped: true }, // 3 lb
  shortSword: { name: 'Short Sword', equipped: true }, // 3 lb
  poleArm: { name: 'Pole Arm', equipped: false }, // 8-10 lb → 9
  chain: { name: 'Chain Mail', equipped: false }, // 40 lb
  plate: { name: 'Plate Armor', equipped: false }, // 60 lb
  tent: { name: 'Tent', equipped: false }, // 20 lb
  crystalPlate: { name: 'Crystal Plate', equipped: false }, // 90 lb
  hide: { name: 'Hide Armor', equipped: false }, // 25 lb
  fishing: { name: 'Fishing Net (30 sq ft)', equipped: false }, // 10 lb
};

test('clear: at/under capacity — engine totals every owned item, no fold, per-item weight exposed', () => {
  memory.clear();
  const model = deriveModel(
    { ...baseCharacter(), items: [ITEMS.dagger, ITEMS.club, ITEMS.shortSword, ITEMS.poleArm] },
    rules,
  );
  // 1 + 3 + 3 + 9 (range midpoint) = 16 lb against capacity 125.
  assert.equal(model.weight.carried, 16);
  assert.equal(model.weight.unweighed, 0);
  assert.equal(model.weight.capacity, 125);
  assert.equal(model.weight.stage, 'clear');
  assert.equal(model.weight.label, 'Clear');
  assert.equal(model.characteristics.movementRate.value, 10);
  assert.equal(model.characteristics.physicalDefense.value, 8);
  assert.equal(model.characteristics.mysticDefense.value, 7);
  assert.ok(!model.activeEffects.some((e) => e.origin?.kind === 'condition'));
  // Per-item parsed weights feed the section totals (all owned, equipped or stored).
  assert.equal(model.items.find((it) => it.name === 'Dagger').weight, 1);
  assert.equal(model.items.find((it) => it.name === 'Pole Arm').weight, 9);
  // The stored inputs are untouched — the sheet stores only inputs.
  assert.deepEqual(model.characteristics.carryingCapacity.value, 125);
});

test('burdened: over capacity up to 150% halves Movement and folds Harried −2 into the Defences', () => {
  memory.clear();
  const model = deriveModel(
    { ...baseCharacter(), items: [ITEMS.chain, ITEMS.plate, ITEMS.tent, ITEMS.poleArm, ITEMS.dagger] },
    rules,
  );
  assert.equal(model.weight.carried, 130); // 40 + 60 + 20 + 9 + 1
  assert.equal(model.weight.stage, 'burdened');
  assert.equal(model.characteristics.movementRate.base, 10);
  assert.equal(model.characteristics.movementRate.value, 5); // halved
  assert.equal(model.characteristics.physicalDefense.value, 6); // 8 − 2
  assert.equal(model.characteristics.mysticDefense.value, 5); // 7 − 2
  const cond = model.activeEffects.filter((e) => e.origin?.kind === 'condition');
  assert.ok(cond.every((e) => e.origin.name === 'Burdened'));
  assert.ok(cond.some((e) => e.type === 'test-modifier' && e.value === -2), 'Harried −2 Action test Steps surfaces');
  assert.ok(cond.some((e) => e.type === 'defense-modifier' && e.gmDiscretion === true), 'Social Defense −2 is surfaced, not folded');
});

test('overburdened: 150%–200% caps Movement and Physical/Mystic Defense at 2', () => {
  memory.clear();
  const model = deriveModel(
    {
      ...baseCharacter(),
      items: [ITEMS.chain, ITEMS.plate, ITEMS.crystalPlate, ITEMS.tent, ITEMS.poleArm, ITEMS.dagger],
    },
    rules,
  );
  assert.equal(model.weight.carried, 220); // 40 + 60 + 90 + 20 + 9 + 1
  assert.equal(model.weight.stage, 'overburdened');
  assert.equal(model.characteristics.movementRate.value, 2);
  assert.equal(model.characteristics.physicalDefense.value, 2);
  assert.equal(model.characteristics.mysticDefense.value, 2);
  const cond = model.activeEffects.filter((e) => e.origin?.kind === 'condition');
  assert.ok(cond.some((e) => e.target?.name === 'Movement' && e.operation === 'min' && e.value === 2));
  assert.ok(cond.some((e) => e.type === 'note' && /drop the excess/.test(e.summary)));
});

test('excess: beyond 2× capacity reuses the overburdened fold and warns on the lift test', () => {
  memory.clear();
  const model = deriveModel(
    {
      ...baseCharacter(),
      items: [ITEMS.chain, ITEMS.plate, ITEMS.crystalPlate, ITEMS.tent, ITEMS.hide, ITEMS.fishing, ITEMS.poleArm, ITEMS.dagger],
    },
    rules,
  );
  assert.equal(model.weight.carried, 255); // 40 + 60 + 90 + 20 + 25 + 10 + 9 + 1 > 2×125
  assert.equal(model.weight.stage, 'excess');
  assert.equal(model.characteristics.movementRate.value, 2);
  assert.ok(model.activeEffects.some((e) => e.type === 'note' && /Strength test/.test(e.summary)));
});

test('unknown weights count as unweighed instead of fabricating pounds', () => {
  memory.clear();
  const model = deriveModel(
    {
      ...baseCharacter(),
      items: [ITEMS.dagger, { name: 'Season Lamp', equipped: false }, { name: 'Not in Catalog', equipped: false }],
    },
    rules,
  );
  assert.equal(model.weight.carried, 1); // only the Dagger weighs something
  assert.equal(model.weight.unweighed, 2); // NA item + unknown catalog entry
  assert.equal(model.weight.stage, 'clear');
});

test('moving items never mutates the derived weight — it recomputes from inputs', () => {
  memory.clear();
  const light = deriveModel({ ...baseCharacter(), items: [ITEMS.dagger, ITEMS.poleArm] }, rules);
  assert.equal(light.weight.carried, 10);
  const heavier = deriveModel({ ...baseCharacter(), items: [ITEMS.chain, ITEMS.plate] }, rules);
  assert.equal(heavier.weight.carried, 100);
  assert.equal(light.weight.carried, 10, 'the first model is untouched');
});
