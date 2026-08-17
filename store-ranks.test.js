// store-ranks.test.js — run with `npm test` (node --test, no deps).
// Store integration for rank-grant folding (plans/PLAN-RANK-GRANTS.md D1–D5):
// `add`/`subtract` grants fold into the derived talent/skill step; `set` grants
// establish possession of un-learned abilities — all against the REAL rules files.

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
const diceByStep = new Map(rules.steps.map((s) => [s.step, s.dice ?? '']));

const base = (items = [], extra = {}) => ({
  meta: { name: 'Tester', race: extra.race ?? 'Ork' },
  attributes: {
    Dexterity: { base: 20 },
    Strength: { base: 10 },
    Toughness: { base: 10 },
    Perception: { base: 14 },
    Willpower: { base: 12 },
    Charisma: { base: 8 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 5,
      talents: extra.talents ?? [
        { name: 'Avoid Blow', rank: 4 },
        { name: 'Missile Weapon', rank: 5 },
        { name: 'Durability', rank: 1 },
        { name: 'Karma Ritual', rank: 1 },
      ],
    },
  ],
  skills: extra.skills ?? [],
  items,
});

const talentRow = (m, name) => {
  for (const d of m.disciplines) for (const t of d.talents) if (t.name === name) return t;
  return null;
};
const skillRow = (m, name) => (m.skills ?? []).find((s) => s.name === name) ?? null;

test('Dark Archer at thread rank 2 folds +1 into Avoid Blow step and dice', () => {
  const plain = deriveModel(base(), rules);
  const baseStep = talentRow(plain, 'Avoid Blow').step;
  const armed = deriveModel(base([{ name: 'Dark Archer Armour', threadRank: 2 }]), rules);
  const t = talentRow(armed, 'Avoid Blow');
  assert.equal(t.rank, 4, 'learned rank stays 4');
  assert.equal(t.rankBonus, 1);
  assert.equal(t.step, baseStep + 1, 'folded step = base + 1');
  assert.equal(t.stepBase, baseStep, 'pre-grant step is kept for the step audit');
  assert.equal(t.dice, diceByStep.get(t.step), 'dice follows the folded step');
  assert.equal(t.grantSources[0]?.origin?.name, 'Dark Archer Armour');
  assert.equal(t.grantSources[0]?.origin?.rank, 2);
});

test('thread rank 1 (no grant yet) and rank 0 leave the step unchanged', () => {
  for (const threadRank of [0, 1]) {
    const plain = deriveModel(base(), rules);
    const armed = deriveModel(base([{ name: 'Dark Archer Armour', threadRank }]), rules);
    const a = talentRow(plain, 'Avoid Blow');
    const b = talentRow(armed, 'Avoid Blow');
    assert.equal(b.rankBonus, undefined, `rank ${threadRank} grants nothing`);
    assert.equal(b.step, a.step);
  }
});

test('unequipping the armour restores the base step', () => {
  const armed = deriveModel(base([{ name: 'Dark Archer Armour', threadRank: 2, equipped: false }]), rules);
  const plain = deriveModel(base(), rules);
  const t = talentRow(armed, 'Avoid Blow');
  assert.equal(t.rankBonus, undefined);
  assert.equal(t.step, talentRow(plain, 'Avoid Blow').step);
});

test('two items granting the same ability stack (D3)', () => {
  // Dark Archer thread 2 (+1) + Espagra Boots thread 3 (+2) = +3 on Avoid Blow.
  const plain = deriveModel(base(), rules);
  const baseStep = talentRow(plain, 'Avoid Blow').step;
  const armed = deriveModel(
    base([
      { name: 'Dark Archer Armour', threadRank: 2 },
      { name: 'Espagra Boots', threadRank: 3 },
    ]),
    rules,
  );
  const t = talentRow(armed, 'Avoid Blow');
  assert.equal(t.rankBonus, 3, 'both progressions apply');
  assert.equal(t.step, baseStep + 3);
  assert.deepEqual(t.grantSources.map((s) => s.origin?.name).sort(), ['Dark Archer Armour', 'Espagra Boots']);
});

test('a skill with a grant folds the same way', () => {
  const skills = [{ name: 'Acrobatic Defense', rank: 3, tier: 'Novice' }];
  const charm = {
    name: 'Test Charm',
    qty: 1,
    effects: [
      { type: 'grant-ability', target: { domain: 'ability', name: 'Acrobatic Defense' }, operation: 'add', value: 1, measure: 'rank', condition: 'always', source: 'item', summary: '+1 rank to Acrobatic Defense.' },
    ],
  };
  const plain = deriveModel(base([], { skills }), rules);
  const baseStep = skillRow(plain, 'Acrobatic Defense').step;
  assert.ok(baseStep != null, 'skill has a step');
  const armed = deriveModel(base([charm], { skills }), rules);
  const s = skillRow(armed, 'Acrobatic Defense');
  assert.equal(s.rankBonus, 1);
  assert.equal(s.step, baseStep + 1);
  assert.equal(s.grantSources[0]?.origin?.name, 'Test Charm');
});

test('Astral-Sensitive Eye grants possession of an un-learned Astral Sight', () => {
  const armed = deriveModel(base([{ name: 'Astral-Sensitive Eye', qty: 1 }]), rules);
  assert.equal(armed.grantedAbilities.length, 1);
  const g = armed.grantedAbilities[0];
  assert.equal(g.name, 'Astral Sight');
  assert.equal(g.rank, 0, 'set:0 — unranked access');
  assert.equal(g.step, null, 'no step until ranked');
  assert.equal(g.grantSources[0]?.origin?.name, 'Astral-Sensitive Eye');
});

test('a learned Astral Sight is never duplicated by a set grant', () => {
  const learned = {
    talents: [
      { name: 'Avoid Blow', rank: 4 },
      { name: 'Astral Sight', rank: 2 },
      { name: 'Durability', rank: 1 },
      { name: 'Karma Ritual', rank: 1 },
    ],
  };
  const armed = deriveModel(base([{ name: 'Astral-Sensitive Eye', qty: 1 }], learned), rules);
  assert.equal(armed.grantedAbilities.length, 0, 'learned row wins, no granted row');
  const own = talentRow(armed, 'Astral Sight');
  assert.equal(own.rank, 2, 'set grant is not an adder');
  assert.equal(own.rankBonus, undefined);
});

test('Windling race and the gift assert one possession (no double row)', () => {
  const talents = [{ name: 'Durability', rank: 1 }, { name: 'Karma Ritual', rank: 1 }];
  const armed = deriveModel(base([{ name: 'Astral-Sensitive Eye', qty: 1 }], { race: 'Windling', talents }), rules);
  assert.equal(armed.grantedAbilities.length, 1, 'one row for Astral Sight, two sources');
  assert.equal(armed.grantedAbilities[0].name, 'Astral Sight');
});

test('a situational grant is listed in Active Effects, never folded', () => {
  const plain = deriveModel(base(), rules);
  const armed = deriveModel(base([{ name: 'Espagra Boots', threadRank: 5 }]), rules);
  const t = talentRow(armed, 'Avoid Blow');
  assert.equal(t.rankBonus, 2, 'only the always-on rank3 grant folds');
  assert.equal(t.step, talentRow(plain, 'Avoid Blow').step + 2);
  assert.equal(
    armed.grantedAbilities.find((g) => g.name === 'Great Leap'),
    undefined,
    'situational +3 Great Leap is surfaced, not folded',
  );
  assert.ok(armed.activeEffects.some((e) => e.type === 'grant-ability' && e.target?.name === 'Great Leap'));
});

test('invariant: Legend-spent total is byte-identical whether or not a fold applies', () => {
  const plain = deriveModel(base(), rules);
  const armed = deriveModel(base([{ name: 'Dark Archer Armour', threadRank: 2 }]), rules);
  assert.equal(JSON.stringify(armed.legend), JSON.stringify(plain.legend));
});