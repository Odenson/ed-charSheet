// engine/frighten-data.test.js — run with `npm test` (node --test, no deps).
// plans/frighten-uplift: Frighten gains an opponent arm (explicit arms.opponent),
// the store derives perSuccess from its on-success per-success test-modifier,
// and the effect never folds into the adept's pools.
// Rules: R1 stat block, R2 -2 per success / Rank rounds, R3 end-test note, R4 fear-immune note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from '../store.js';
import { collectCombatEffects } from './combat.js';
import { armOpponent } from './active-effects.js';

const rd = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const talentsFile = rd('talents.json');
const rules = {
  steps: rd('steps.json').steps,
  talentsFile,
  disciplinesFile: rd('disciplines.json'),
  racesFile: rd('races.json'),
  characteristicsFile: rd('characteristics.json'),
  itemsFile: rd('items.json'),
  legendFile: rd('legend.json'),
  skillsFile: rd('skills.json'),
  knacksFile: rd('knacks.json'),
  threadItemsFile: rd('thread-items.json'),
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: rd('combat.json'),
};
const attrs = {
  Dexterity: { base: 20 }, Strength: { base: 12 }, Toughness: { base: 10 },
  Perception: { base: 14 }, Willpower: { base: 12 }, Charisma: { base: 14 },
};
const base = {
  meta: { name: 'Tester', race: 'Ork' },
  attributes: attrs,
  disciplines: [],
  items: [],
  resources: { health: { damage: 0, wounds: 0 }, karma: { available: 3 } },
  skills: [], knacks: [], traits: [], wealth: {}, notes: [], history: [],
};
const withTalents = (talents) => ({ ...base, disciplines: [{ name: 'Nethermancer', circle: 3, talents }] });
const FR_RANK = 4;
const mixed = withTalents([
  { name: 'Frighten', rank: FR_RANK },
  { name: 'Taunt', rank: 3 },
  { name: 'Mystic Aim', rank: 2 },
]);
const node = (char, name) => deriveModel(char, rules).disciplines[0].talents.find((t) => t.name === name);

// ---- data ---------------------------------------------------------------------

test('Frighten data: opponent arm vs Mystic, rounds "rank" (R1, R2)', () => {
  const a = talentsFile.talents.Frighten.arms;
  assert.ok(a, 'Frighten has arms');
  assert.equal(a.opponent, true);
  assert.equal(a.rounds, 'rank');
  assert.equal(a.roll.vs, 'Mystic');
});

test('Frighten data: keeps the on-success per-success test-modifier and gains a note effect (R2, R3, R4)', () => {
  const fx = talentsFile.talents.Frighten.effects;
  const tm = fx.find((e) => e.type === 'test-modifier');
  assert.ok(tm);
  assert.equal(tm.condition, 'on-success');
  assert.equal(tm.perSuccess, true);
  assert.equal(tm.operation, 'subtract');
  assert.equal(tm.value, 2);
  assert.equal(tm.target.name, 'Action');
  const note = fx.find((e) => e.type === 'note');
  assert.ok(note, 'note effect present');
  assert.equal(typeof note.summary, 'string');
  assert.ok(note.summary.length > 0);
});

test('Mystic Aim has no opponent flag in data', () => {
  assert.ok(!talentsFile.talents['Mystic Aim'].arms.opponent);
});

test('effectTaxonomy reference still v6 (no vocabulary bump)', () => {
  assert.match(talentsFile.effectTaxonomy, /\(v6\)/);
});

// ---- store derivation ------------------------------------------------------------

test('Frighten model arms: opponent, perSuccess -2/allTests, rank rounds, no payload, note as text', () => {
  const a = node(mixed, 'Frighten').arms;
  const note = talentsFile.talents.Frighten.effects.find((e) => e.type === 'note');
  assert.equal(a.opponent, true);
  assert.deepEqual(a.perSuccess, { delta: -2, allTests: true });
  assert.equal(a.rounds, FR_RANK);
  assert.deepEqual(a.effects, []);
  assert.equal(a.text, note.summary);
  assert.equal(a.roll.vs, 'Mystic');
  assert.equal(typeof a.roll.step, 'number');
});

test('Taunt model arms: opponent, perSuccess null, static note text', () => {
  const a = node(mixed, 'Taunt').arms;
  const note = talentsFile.talents.Taunt.effects.find((e) => e.type === 'note');
  assert.equal(a.opponent, true);
  assert.equal(a.perSuccess ?? null, null);
  assert.equal(a.text, note.summary);
  assert.deepEqual(a.effects, []);
});

test('Mystic Aim model arms stays a self-arm: opponent false, no perSuccess, text null, payload kept', () => {
  const a = node(mixed, 'Mystic Aim').arms;
  assert.equal(a.opponent, false);
  assert.equal(a.perSuccess ?? null, null);
  assert.equal(a.text ?? null, null);
  assert.ok(a.effects.length > 0);
});

test('model arms for non-arming talents stay null', () => {
  const m = deriveModel(withTalents([{ name: 'Spellcasting', rank: 5 }]), rules);
  assert.equal(m.disciplines[0].talents.find((t) => t.name === 'Spellcasting').arms, null);
});

test('end to end: model arms -> armOpponent yields the Frighten entry text', () => {
  const a = node(mixed, 'Frighten').arms;
  const desc = { ...a, name: 'Frighten', perSuccess: a.perSuccess ?? null, step: a.roll?.step ?? null };
  const r = armOpponent({ arms: desc, successes: 3, targetName: 'Bob', seq: 1 });
  assert.ok(r.text.includes('-2 x 3 = -6 to all tests'), r.text);
  assert.ok(r.text.includes(`Frighten Step ${a.roll.step}`), r.text);
  assert.equal(r.roundsLeft, FR_RANK);
});

// ---- pools unaffected ------------------------------------------------------------

test('Frighten test-modifier from an opponent record never folds into combat pools', () => {
  const fx = talentsFile.talents.Frighten.effects.filter((e) => e.type === 'test-modifier');
  const r = collectCombatEffects({
    armedTalents: [{ name: 'Frighten', opponent: true, successes: 3, effects: fx }],
    rules: { options: [], situations: [] },
  });
  assert.equal(r.attackEffects.length, 0);
  assert.equal(r.defenseMods.length, 0);
});

test('learning Frighten (and an opponent entry) leaves model pools/active effects unchanged', () => {
  const without = withTalents([{ name: 'Spellcasting', rank: 5 }]);
  const withF = withTalents([{ name: 'Spellcasting', rank: 5 }, { name: 'Frighten', rank: 4 }]);
  const rec = { id: 'opp:1', kind: 'talent', name: 'Frighten', effectLabel: '3 successes', text: 'x', targetName: 'Bob', roundsLeft: 4, roundsTotal: 4 };
  const a = deriveModel(without, rules);
  const b = deriveModel(withF, rules, { opponentEffects: [rec] });
  assert.deepEqual(b.activeEffects, a.activeEffects);
  assert.deepEqual(b.combat, a.combat);
  assert.deepEqual(b.spells?.castingArmed, a.spells?.castingArmed);
  assert.ok(b.effectWindow.some((e) => e.id === 'opp:1' && e.side === 'tgt'));
});
