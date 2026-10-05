// store-situations.test.js — run with `npm test`.
// Situational chips global: deriveModel takes session.situations and folds each
// active chip's Defence mods into derived Physical/Mystic Defence (never stored).

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
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: read('combat.json'),
};

const mk = (over = {}) => ({
  schema: 'ed-character/1',
  meta: { name: 'Tester', race: 'Ork' },
  attributes: { Dexterity: { base: 14 }, Strength: { base: 14 }, Toughness: { base: 14 }, Perception: { base: 13 }, Willpower: { base: 12 }, Charisma: { base: 12 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [],
  ...over,
});

const def = (m) => [m.characteristics.physicalDefense.value, m.characteristics.mysticDefense.value];
const char = mk();
const base = deriveModel(char, rules, {});
const [P, M] = def(base);
const delta = (session, c = char) => {
  const [p, m] = def(deriveModel(c, rules, session));
  return [p - P, m - M];
};

test('Blindsided gives -2 on Physical and Mystic Defence, Social untouched (R1)', () => {
  const m = deriveModel(char, rules, { situations: ['Blindsided'] });
  assert.deepEqual(delta({ situations: ['Blindsided'] }), [-2, -2]);
  assert.equal(m.characteristics.socialDefense.value, base.characteristics.socialDefense.value);
});

test('Surprised gives -3; Surprised + Blindsided sums to -5, no cap (R2, R6)', () => {
  assert.deepEqual(delta({ situations: ['Surprised'] }), [-3, -3]);
  assert.deepEqual(delta({ situations: ['Surprised', 'Blindsided'] }), [-5, -5]);
});

test('Partial Cover gives +2; Full Cover changes nothing numeric (R3)', () => {
  assert.deepEqual(delta({ situations: ['Partial Cover'] }), [2, 2]);
  assert.deepEqual(delta({ situations: ['Full Cover'] }), [0, 0]);
});

test('Blindsided + Harried + Knocked Down sum (R1, R7)', () => {
  assert.deepEqual(delta({ situations: ['Blindsided', 'Harried'], knockedDown: true }), [-7, -7]);
});

test('clearing restores derived Defence; unknown names are skipped', () => {
  assert.deepEqual(delta({ situations: [] }), [0, 0]);
  assert.deepEqual(delta({ situations: ['No Such Chip'] }), [0, 0]);
  assert.deepEqual(delta({ situations: ['Blindsided'] }).map((v) => v - -2), [0, 0]);
});

test('"Knocked Down" in situations is ignored: one -3 only, from session.knockedDown (R7)', () => {
  assert.deepEqual(delta({ situations: ['Knocked Down'] }), [0, 0]);
  assert.deepEqual(delta({ situations: ['Knocked Down'], knockedDown: true }), [-3, -3]);
  const m = deriveModel(char, rules, { situations: ['Knocked Down'], knockedDown: true });
  const kd = m.activeEffects.filter((e) => e.origin?.kind === 'condition' && e.origin.name === 'Knocked Down' && e.type === 'test-modifier');
  assert.equal(kd.length, 1);
});

test('active chips list as condition Active Effects rows named by the chip', () => {
  const m = deriveModel(char, rules, { situations: ['Blindsided', 'Full Darkness'] });
  const names = new Set(m.activeEffects.filter((e) => e.origin?.kind === 'condition').map((e) => e.origin.name));
  assert.ok(names.has('Blindsided'));
  assert.ok(names.has('Full Darkness'));
  assert.ok(!deriveModel(char, rules, {}).activeEffects.some((e) => e.origin?.kind === 'condition'));
});

test('model.combat.conditions.situations lists the active chip names', () => {
  const m = deriveModel(char, rules, { situations: ['Blindsided', 'Partial Cover'] });
  assert.ok(Array.isArray(m.combat.conditions.situations));
  assert.ok(m.combat.conditions.situations.includes('Blindsided'));
  assert.ok(m.combat.conditions.situations.includes('Partial Cover'));
  assert.deepEqual(base.combat.conditions.situations, []);
  assert.equal(m.combat.conditions.knockedDown, false);
});

test('Harried chip plus Burdened gives one -2, not two (R7)', () => {
  const burdened = mk({
    attributes: { Dexterity: { base: 14 }, Strength: { base: 4 }, Toughness: { base: 14 }, Perception: { base: 13 }, Willpower: { base: 12 }, Charisma: { base: 12 } },
    items: [{ name: 'Medium Crossbow' }, { name: 'Ork Dagger' }, { name: 'Hardened Leather' }, { name: 'Broadsword', equipped: false }],
  });
  const without = deriveModel(burdened, rules, {});
  assert.equal(without.combat.conditions.harried, true, 'fixture is Burdened');
  const withChip = deriveModel(burdened, rules, { situations: ['Harried'] });
  assert.deepEqual(def(withChip), def(without));
  const harriedAction = (m) => m.activeEffects.filter((e) => e.type === 'test-modifier' && e.target?.name === 'Action' && e.value === -2);
  assert.equal(harriedAction(withChip).length, harriedAction(without).length);
});

test('deriveModel does not mutate the character or the session, and stores nothing', () => {
  const c = mk();
  const before = JSON.stringify(c);
  const session = { situations: ['Blindsided', 'Harried'] };
  const sBefore = JSON.stringify(session);
  const m = deriveModel(c, rules, session);
  assert.equal(JSON.stringify(c), before);
  assert.equal(JSON.stringify(session), sBefore);
  assert.ok(!('situations' in c));
  assert.ok(!JSON.stringify(m.character ?? {}).includes('Blindsided'));
});
