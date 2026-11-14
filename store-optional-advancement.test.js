// store-optional-advancement.test.js — run with `npm test` (node --test, no deps).
// deriveModel wiring for the homebrew optional Circle-advancement gate
// (plans/homebrew-circle-adv): flag strictness, fail-safe fallback, raw d.talents.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const baseRules = {
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
const homebrew = (value = true, enabled = true) => ({
  schema: 'ed-homebrew/3',
  rules: [{ id: 'hb-optional-circle-advancement', name: 'Optional advancement', summary: 'x', enabled, set: { 'advancement.optionalTable': value } }],
});
const rulesWith = (hb, legendFile = baseRules.legendFile) => ({ ...baseRules, legendFile, homebrewFile: hb });

// Archer at Circle 2 (Thread Weaving (Archer) unlearned, so the standard gate fails).
// Row 3: 6 talents at rank 3, one from Circle 2.
const archer = ({ optionExtra = {}, circleOf = (c) => c } = {}) => ({
  schema: 'ed-character/1',
  meta: { name: 'Test' },
  attributes: {},
  resources: { legend: { totalEarnt: 10000 } },
  disciplines: [{
    name: 'Archer',
    circle: 2,
    talents: [
      { name: 'Avoid Blow', rank: 3, circle: circleOf(1) },
      { name: 'Missile Weapon', rank: 3, circle: circleOf(1) },
      { name: 'Mystic Aim', rank: 3, circle: circleOf(1) },
      { name: 'True Shot', rank: 3, circle: circleOf(1) },
      { name: 'Mystic Pursuit', rank: 3, circle: circleOf(2) },
      { name: 'Awareness', rank: 3, circle: circleOf(2), ...optionExtra },
    ],
  }],
  skills: [], knacks: [], items: [],
});
const status = (model) => model.disciplines.find((d) => d.name === 'Archer').circleStatus;

test('rule on: optional gate applies (eligible where the standard gate is not)', () => {
  const on = deriveModel(archer(), rulesWith(homebrew()));
  assert.equal(on.advancement.optional, true);
  assert.equal(status(on).eligible, true);
  assert.equal(status(on).nextRequirement.rule, 'optional');
  const off = deriveModel(archer(), rulesWith(homebrew(true, false)));
  assert.equal(status(off).eligible, false);
});

test('rule off / no homebrew: model.advancement.optional is false, standard shape', () => {
  for (const hb of [homebrew(true, false), { schema: 'ed-homebrew/3', rules: [] }]) {
    const m = deriveModel(archer(), rulesWith(hb));
    assert.equal(m.advancement.optional, false);
    assert.notEqual(status(m).nextRequirement.rule, 'optional');
  }
});

test('(a)(e) viaVersatility (raw d.talents) is excluded, a Talent Option is counted; rule off ignores the flag', () => {
  const flagged = deriveModel(archer({ optionExtra: { viaVersatility: true } }), rulesWith(homebrew()));
  assert.equal(status(flagged).eligible, false); // only 5 counted
  assert.equal(status(flagged).nextRequirement.met, 5);
  const plain = deriveModel(archer(), rulesWith(homebrew()));
  assert.equal(status(plain).nextRequirement.met, 6);
  const offA = status(deriveModel(archer({ optionExtra: { viaVersatility: true } }), rulesWith(homebrew(true, false))));
  const offB = status(deriveModel(archer(), rulesWith(homebrew(true, false))));
  assert.deepEqual(offA, offB);
});

test('(b) null circle on every talent: no false inconsistency, from-Circle clause unmet', () => {
  const m = deriveModel(archer({ circleOf: () => null }), rulesWith(homebrew()));
  const s = status(m);
  assert.equal(s.consistent, true);
  assert.equal(s.eligible, false);
  assert.equal(s.nextRequirement.hasFromCircle, false);
  assert.equal(s.nextRequirement.countMet, true);
});

test('(c) rule on but costs.optionalAdvancement absent: standard gate, optional false', () => {
  const legend = read('legend.json');
  const costs = { ...legend.costs };
  delete costs.optionalAdvancement;
  const m = deriveModel(archer(), rulesWith(homebrew(), { ...legend, costs }));
  assert.equal(m.advancement.optional, false);
  assert.deepEqual(status(m), status(deriveModel(archer(), rulesWith(homebrew(true, false)))));
});

test('(c2) rule on with an invalid table: standard gate', () => {
  const legend = read('legend.json');
  const bad = { ...legend, costs: { ...legend.costs, optionalAdvancement: { 2: { minTalents: 0, minRank: 2, fromCircle: 1 } } } };
  const m = deriveModel(archer(), rulesWith(homebrew(), bad));
  assert.equal(m.advancement.optional, false);
  assert.notEqual(status(m).nextRequirement.rule, 'optional');
});

test('(d) non-boolean flag value (1, "true") uses the standard gate', () => {
  for (const v of [1, 'true']) {
    const m = deriveModel(archer(), rulesWith(homebrew(v)));
    assert.equal(m.advancement.optional, false, String(v));
    assert.deepEqual(status(m), status(deriveModel(archer(), rulesWith(homebrew(true, false)))));
  }
});

test('the table is derived, never written onto the character', () => {
  const ch = archer();
  deriveModel(ch, rulesWith(homebrew()));
  assert.equal(JSON.stringify(ch).includes('optionalAdvancement'), false);
  assert.equal(JSON.stringify(ch).includes('minTalents'), false);
});
