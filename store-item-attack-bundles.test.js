// store-item-attack-bundles.test.js — run with `npm test` (node --test, no deps).
// T-004: always-on attack/damage bonuses on worn NON-weapon items reach the combat
// pools. This pins the seam the Combat tab relies on: the model's equipped items
// (a weapon carries `ref.category`, a non-weapon does not) and the origin-tagged
// `activeEffects`, fed through the pure engine routing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import { activeItemBundlesFor, collectCombatEffects, damagePool } from './engine/combat.js';

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

const character = (items) => ({
  meta: { name: 'Test', race: 'Human' },
  attributes: { Dexterity: { base: 12 }, Strength: { base: 14 }, Toughness: { base: 12 }, Perception: { base: 12 }, Willpower: { base: 12 }, Charisma: { base: 12 } },
  resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items,
});

test('worn Bracers (rank 4) route a +2 close-combat Damage Step; a woven weapon is excluded', () => {
  const m = deriveModel(character([
    { name: 'Bracers of Obsidiman Strength', equipped: true, threadRank: 4 },
    { name: 'Orc Stinger', equipped: true, threadRank: 3 },
  ]), rules);
  const nonWeapon = m.items.filter((it) => it.equipped && it.ref?.category == null).map((it) => it.name);
  assert.deepEqual(nonWeapon, ['Bracers of Obsidiman Strength']);
  const bundles = activeItemBundlesFor(m.activeEffects, 'melee', nonWeapon);
  assert.deepEqual(bundles.map((b) => b.name), ['Bracers of Obsidiman Strength']);
  const { damageEffects } = collectCombatEffects({ activeItemBundles: bundles, rules: { options: [], situations: [] } });
  const dp = damagePool({ weaponDamageStep: 5, strengthStep: 6, effects: damageEffects });
  assert.deepEqual(dp.resultMods, []);
  assert.equal(dp.step, 13);
  assert.deepEqual(dp.unapplied, []);
});

test('an unequipped Bracers contributes nothing', () => {
  const m = deriveModel(character([{ name: 'Bracers of Obsidiman Strength', equipped: false, threadRank: 4 }]), rules);
  assert.deepEqual(activeItemBundlesFor(m.activeEffects, 'melee', ['Bracers of Obsidiman Strength']), []);
});
