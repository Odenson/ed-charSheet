// store-combat.test.js — run with `npm test` (node --test, no deps).
// Covers the Phase C Combat model surface in deriveModel (PLAN-COMBAT-TAB):
// attack talents, equipped weapons, Strength step, live combat conditions, and
// the Damage-test karma grant — derived against the REAL rules files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const rules = {
  steps: JSON.parse(readFileSync(new URL('./rules/steps.json', import.meta.url))).steps,
  talentsFile: JSON.parse(readFileSync(new URL('./rules/talents.json', import.meta.url))),
  disciplinesFile: JSON.parse(readFileSync(new URL('./rules/disciplines.json', import.meta.url))),
  racesFile: JSON.parse(readFileSync(new URL('./rules/races.json', import.meta.url))),
  characteristicsFile: JSON.parse(readFileSync(new URL('./rules/characteristics.json', import.meta.url))),
  itemsFile: JSON.parse(readFileSync(new URL('./rules/items.json', import.meta.url))),
  legendFile: JSON.parse(readFileSync(new URL('./rules/legend.json', import.meta.url))),
  skillsFile: JSON.parse(readFileSync(new URL('./rules/skills.json', import.meta.url))),
  knacksFile: JSON.parse(readFileSync(new URL('./rules/knacks.json', import.meta.url))),
  threadItemsFile: JSON.parse(readFileSync(new URL('./rules/thread-items.json', import.meta.url))),
  customItemsFile: { schema: 'ed-items/2', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/2', items: {} },
  homebrewFile: { rules: [] },
  combatFile: JSON.parse(readFileSync(new URL('./rules/combat.json', import.meta.url))),
};

// A low-Strength (STR 4 → carry 25 lb) Archer circle 5. Carried load: Medium
// Crossbow 7 lb + Ork Dagger 1 lb + Hardened Leather 20 lb + stored Broadsword
// 4 lb = 32 lb → past the 25 lb capacity (within 1.5×) → Burdened/Harried. The
// Archer circle-5 grant makes Damage-test karma available for ranged weapons.
const charA = {
  meta: { name: 'Tester', race: 'Ork' },
  attributes: {
    Dexterity: { base: 20 },
    Strength: { base: 4 },
    Toughness: { base: 10 },
    Perception: { base: 14 },
    Willpower: { base: 12 },
    Charisma: { base: 8 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 5,
      talents: [
        { name: 'Missile Weapon', rank: 5 },
        { name: 'Throwing Weapon', rank: 3 },
        { name: 'Durability', rank: 1 },
        { name: 'Karma Ritual', rank: 1 },
      ],
    },
  ],
  items: [
    { name: 'Medium Crossbow' },
    { name: 'Ork Dagger' },
    { name: 'Hardened Leather' },
    { name: 'Broadsword', equipped: false },
  ],
  resources: { health: { knockedDown: true, damage: 5, wounds: 0 }, karma: { available: 3 } },
  skills: [],
  knacks: [],
  traits: [],
  wealth: {},
  notes: [],
  history: [],
};

const modelA = deriveModel(charA, rules);

test('attack talents: canonical order, owned ones carry rank/step/dice/karma', () => {
  const names = modelA.combat.attackTalents.map((t) => t.name);
  assert.deepEqual(names, ['Melee Weapon', 'Missile Weapon', 'Unarmed Combat', 'Throwing Weapon']);

  const missile = modelA.combat.attackTalents.find((t) => t.name === 'Missile Weapon');
  assert.equal(missile.known, true);
  assert.equal(missile.rank, 5);
  assert.equal(missile.step, 13); // DEX step 8 + rank 5
  assert.equal(missile.dice, 'D12+D10');
  assert.equal(missile.karma.grants.length, 1); // talent tests are karma-eligible by default

  const throwing = modelA.combat.attackTalents.find((t) => t.name === 'Throwing Weapon');
  assert.equal(throwing.known, true);
  assert.equal(throwing.rank, 3);
  assert.equal(throwing.step, 11); // DEX step 8 + rank 3
  assert.equal(throwing.dice, 'D10+D8');
});

test('attack talents: unowned talents derive null step (placeholder pill), never a number', () => {
  for (const name of ['Melee Weapon', 'Unarmed Combat']) {
    const t = modelA.combat.attackTalents.find((x) => x.name === name);
    assert.equal(t.known, false, name);
    assert.equal(t.rank, null, name);
    assert.equal(t.step, null, name);
    assert.equal(t.dice, '', name);
    assert.equal(t.karma, null, name);
  }
});

test('equipped weapons: only the equipped weapon kind, with category/damage/range/image', () => {
  const names = modelA.combat.equippedWeapons.map((w) => w.name);
  assert.deepEqual(names, ['Medium Crossbow', 'Ork Dagger']); // stored Broadsword excluded

  const crossbow = modelA.combat.equippedWeapons.find((w) => w.name === 'Medium Crossbow');
  assert.deepEqual(
    { category: crossbow.category, damageStep: crossbow.damageStep, shortRange: crossbow.shortRange, longRange: crossbow.longRange, image: crossbow.image },
    { category: 'missile', damageStep: 5, shortRange: '2-40', longRange: '41-80', image: 'data/medium-crossbow.png' },
  );

  // Ork Dagger is a melee dagger (rules/items.json) — a melee weapon carries no
  // range, so shortRange/longRange derive null (the missile crossbow above covers
  // the ranged case). Its repo image still resolves.
  const dagger = modelA.combat.equippedWeapons.find((w) => w.name === 'Ork Dagger');
  assert.equal(dagger.category, 'melee');
  assert.equal(dagger.damageStep, 2);
  assert.equal(dagger.shortRange, null);
  assert.equal(dagger.longRange, null);
  assert.equal(dagger.image, 'data/Std-ork-dagger.png');
});

test('strength step, live conditions and the Damage-test karma grant are exposed', () => {
  assert.equal(modelA.combat.strengthStep, 3); // STR 4 → step 3

  assert.deepEqual(modelA.combat.conditions, { knockedDown: true, harried: true });

  const dmg = modelA.combat.damageKarma;
  assert.ok(dmg, 'Archer circle 5 grants Damage-test karma');
  assert.equal(dmg.grants[0].scope, 'ranged weapons');
  assert.equal(dmg.grants[0].via.name, 'Archer');
});

test('the tab pieces already derived elsewhere stay real numbers (never pills)', () => {
  const c = modelA.characteristics;
  assert.equal(typeof c.physicalDefense.value, 'number');
  assert.equal(typeof c.mysticDefense.value, 'number');
  assert.equal(typeof c.physicalArmor.value, 'number');
  assert.equal(typeof c.initiative.value, 'number');
  assert.ok(modelA.healthState.state === 'conscious' || modelA.healthState.state === 'unhurt');
});

test('clear load: conditions both false, only light weapons equipped', () => {
  const charB = {
    ...charA,
    items: [{ name: 'Ork Dagger' }],
    resources: { health: { knockedDown: false, damage: 0, wounds: 0 }, karma: { available: 3 } },
  };
  const modelB = deriveModel(charB, rules);
  assert.deepEqual(modelB.combat.conditions, { knockedDown: false, harried: false });
  assert.deepEqual(modelB.combat.equippedWeapons.map((w) => w.name), ['Ork Dagger']);
});

test('combatRules exposes the rule bundles the chips render from (ed-combat/1)', () => {
  assert.equal(modelA.combatRules.options.length, 10);
  assert.equal(modelA.combatRules.situations.length, 12);
  assert.equal(modelA.combatRules.options[0].name, 'Aggressive Attack');
  const harried = modelA.combatRules.situations.find((s) => s.name === 'Harried');
  assert.equal(harried.mapsToCondition, 'harried');
  assert.ok(harried.effects.some((e) => e.type === 'test-modifier'));
});
