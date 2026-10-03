// store-action-modifier.test.js — taxonomy-on-action-type (I6, I9).
// deriveModel folds action-modifier effects onto talents and skills as the
// derived fields action / actionBase / actionSources (never persisted).
// Rules: plans/taxonomy-on-action-type/rules.md R1-R3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import { buildActiveSpell, tickActiveSpells } from './engine/spells.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const rules = {
  steps: read('./rules/steps.json').steps,
  talentsFile: read('./rules/talents.json'),
  disciplinesFile: read('./rules/disciplines.json'),
  racesFile: read('./rules/races.json'),
  characteristicsFile: read('./rules/characteristics.json'),
  itemsFile: read('./rules/items.json'),
  legendFile: read('./rules/legend.json'),
  skillsFile: read('./rules/skills.json'),
  knacksFile: read('./rules/knacks.json'),
  threadItemsFile: read('./rules/thread-items.json'),
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: read('./rules/combat.json'),
};
const spellsFile = read('./rules/spells.json');
const dh = spellsFile.spells['Death’s Head'];

const SKILL = 'Animal Handling';
const skillBase = Object.values(rules.skillsFile.skills).find((s) => s.name === SKILL).action; // from rules data, not memory
const otherSkillAction = ['Free', 'Simple', 'Standard'].find((a) => a !== skillBase);

const char = {
  meta: { name: 'Tester', race: 'Human' },
  attributes: {
    Dexterity: { base: 12 }, Strength: { base: 10 }, Toughness: { base: 10 },
    Perception: { base: 12 }, Willpower: { base: 14 }, Charisma: { base: 10 },
  },
  disciplines: [{
    name: 'Nethermancer',
    circle: 3,
    talents: [
      { name: 'Frighten', rank: 3 },
      { name: 'Spellcasting', rank: 3 },
    ],
  }],
  items: [],
  resources: { health: { damage: 0, wounds: 0 }, karma: { available: 3 } },
  skills: [{ name: SKILL, rank: 2 }],
  knacks: [],
  traits: [],
  wealth: {},
  notes: [],
  history: [],
};

const talent = (m, name) => m.disciplines.flatMap((d) => d.talents).find((t) => t.name === name);
const skill = (m, name) => m.skills.find((s) => s.name === name);
const fx = (value, name, extra = {}) => ({
  name: name ?? 'Test Spell',
  discipline: 'Nethermancer',
  roundsLeft: 5,
  roundsTotal: 5,
  effectLabel: 'x',
  effects: [{
    type: 'action-modifier',
    target: { domain: 'ability', name: extra.target ?? 'Frighten' },
    operation: 'set', measure: 'action', value, duration: 'sustained', source: 'spell',
    ...extra.fields,
  }],
});

test('Death’s Head data: base effects carry the Frighten action-modifier, extra thread unchanged (R3)', () => {
  const e = dh.effects.find((x) => x.type === 'action-modifier');
  assert.ok(e, 'Death’s Head has an action-modifier base effect');
  assert.deepEqual(e.target, { domain: 'ability', name: 'Frighten' });
  assert.equal(e.operation, 'set');
  assert.equal(e.measure, 'action');
  assert.equal(e.value, 'Simple');
  assert.equal(e.duration, 'sustained');
  assert.equal(e.source, 'spell');
  assert.ok(!e.condition && !e.gmDiscretion);
  assert.ok(dh.effects.some((x) => x.type === 'note'), 'existing note is kept');
  assert.equal(dh.extraThreads.length, 1);
});

test('no active spell: Frighten has no action fields', () => {
  const m = deriveModel(char, rules, {});
  const f = talent(m, 'Frighten');
  assert.ok(f, 'Frighten derived');
  assert.equal(f.action, 'Standard');
  for (const k of ['actionBase', 'actionSources']) assert.ok(!(k in f), `${k} absent`);
});

for (const picks of [0, 1]) {
  test(`Death’s Head active (${picks} extra picks): Frighten is Simple, base Standard (R3)`, () => {
    const label = dh.extraThreads[0].label;
    const a = buildActiveSpell(dh, 5, { extraPicks: picks ? [label] : [], successLevels: 0 });
    const m = deriveModel(char, rules, { activeSpells: [a] });
    const f = talent(m, 'Frighten');
    assert.equal(f.action, 'Simple');
    assert.equal(f.actionBase, 'Standard');
    assert.deepEqual(f.actionSources, [{ name: 'Death’s Head', action: 'Simple', applied: true }]);
  });
}

test('other talents are unchanged while Death’s Head is active', () => {
  const a = buildActiveSpell(dh, 5, { extraPicks: [], successLevels: 0 });
  const m = deriveModel(char, rules, { activeSpells: [a] });
  const sc = talent(m, 'Spellcasting');
  for (const k of ['actionBase', 'actionSources']) assert.ok(!(k in sc), `${k} absent`);
  assert.equal(sc.action, rules.talentsFile.talents.Spellcasting.action);
});

test('after the spell expires the next derive reverts Frighten', () => {
  const a = { ...buildActiveSpell(dh, 5, {}), roundsLeft: 1 };
  assert.equal(talent(deriveModel(char, rules, { activeSpells: [a] }), 'Frighten').action, 'Simple');
  const after = tickActiveSpells([a]);
  assert.equal(after.length, 0);
  const f = talent(deriveModel(char, rules, { activeSpells: after }), 'Frighten');
  assert.equal(f.action, 'Standard');
  assert.ok(!('actionBase' in f));
});

test('Death’s Head leaves the Frighten step unchanged at 0 picks and +2 per pick (R3 unchanged behavior)', () => {
  const label = dh.extraThreads[0].label;
  const step = (picks) => talent(deriveModel(char, rules, {
    activeSpells: [buildActiveSpell(dh, 5, { extraPicks: picks, successLevels: 0 })],
  }), 'Frighten').step;
  const base = talent(deriveModel(char, rules, {}), 'Frighten').step;
  assert.equal(step([]), base);
  assert.equal(step([label]), base + 2);
});

test('a synthetic skill effect folds the same fields onto a skill', () => {
  const m = deriveModel(char, rules, { activeSpells: [fx(otherSkillAction, 'Skill Spell', { target: SKILL })] });
  const s = skill(m, SKILL);
  assert.equal(s.action, otherSkillAction);
  assert.equal(s.actionBase, skillBase);
  assert.deepEqual(s.actionSources, [{ name: 'Skill Spell', action: otherSkillAction, applied: true }]);
});

test('two effects: Free applied, Simple overridden', () => {
  const m = deriveModel(char, rules, { activeSpells: [fx('Simple', 'Slow One'), fx('Free', 'Fast One')] });
  const f = talent(m, 'Frighten');
  assert.equal(f.action, 'Free');
  assert.equal(f.actionBase, 'Standard');
  assert.deepEqual(f.actionSources, [
    { name: 'Slow One', action: 'Simple', applied: false },
    { name: 'Fast One', action: 'Free', applied: true },
  ]);
});

test('an effect equal to the printed action adds no fields', () => {
  const f = talent(deriveModel(char, rules, { activeSpells: [fx('Standard')] }), 'Frighten');
  assert.equal(f.action, 'Standard');
  for (const k of ['actionBase', 'actionSources']) assert.ok(!(k in f));
});

test('invalid and gmDiscretion effects are ignored by the store fold', () => {
  const m = deriveModel(char, rules, { activeSpells: [fx('Sustained'), fx('Free', 'GM', { fields: { gmDiscretion: true } })] });
  const f = talent(m, 'Frighten');
  assert.equal(f.action, 'Standard');
  assert.ok(!('actionBase' in f));
});

test('nothing is persisted: the input character is not mutated', () => {
  const snap = JSON.stringify(char);
  deriveModel(char, rules, { activeSpells: [fx('Free')] });
  assert.equal(JSON.stringify(char), snap);
  assert.ok(!snap.includes('actionBase'));
});
