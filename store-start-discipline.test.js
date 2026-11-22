// store-start-discipline.test.js — start-new-discipline I2/I3/I4 store-level slice.
// Covers: model.addableDisciplines (derived, never saved), the stepper-vs-audit
// invariant after the prior-Circle pricing fix, persistence shape through the
// edits overlay, duplicate-dispatch (a completed Discipline stops being a
// candidate) and the standard log entry. The `_startDiscipline` handler itself
// lives in ui/ed-app.js (DOM component, not importable under node:test); its
// refusal/ordering behaviour is left to manual verification (see test-plan.md).
// Rules: rules.md R1-R4 (R2 table from rules/legend.json). Never touches
// data/characters/*.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel, saveAdvancementEdits, applyEdits, forSave } from './store.js';
import { logDisciplineStarted } from './store-log.js';
import { loadRollLog } from './store-rolllog.js';

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

const WARRIOR_DTS = ['Avoid Blow', 'Melee Weapon', 'Thread Weaving (Warrior)', 'Tiger Spring', 'Wood Skin'];
const t1 = (name, rank = 1) => ({ name, rank, circle: 1 });

const kolonLike = (disciplines) => ({
  schema: 'ed-character/2',
  meta: { name: 'Kolon' },
  attributes: {},
  resources: { legend: { totalEarnt: 50000 } },
  disciplines: disciplines ?? [
    { name: 'Thief', circle: 4, talents: [t1('Lock Picking', 5)] },
    { name: 'Warrior', circle: 1, talents: [] },
  ],
  skills: [],
  knacks: [],
  items: [],
});

const call = (q, k, withOption) => (typeof q[k] === 'function' ? q[k](withOption) : q[k]);

test('model.addableDisciplines: empty seed Warrior is mode seed, 5 grants at 300; others are new, ordinal 3', () => {
  memory.clear();
  const model = deriveModel(kolonLike(), rules);
  const by = Object.fromEntries(model.addableDisciplines.map((c) => [c.discipline, c]));
  assert.equal(by.Warrior.mode, 'seed');
  assert.equal(by.Warrior.grants.length, 5);
  assert.equal(by.Warrior.perTalentLegend, 300);
  assert.equal(call(by.Warrior, 'legendTotal', false), 1500);
  assert.equal(call(by.Warrior, 'defaultSilver', false), 2000);
  assert.equal(by.Archer.mode, 'new');
  assert.equal(by.Archer.ordinal, 3);
  assert.equal(by.Nethermancer.mode, 'new');
  assert.ok(!by.Thief);
});

test('model.addableDisciplines: option pool items carry a name and a brief slot', () => {
  memory.clear();
  const w = deriveModel(kolonLike(), rules).addableDisciplines.find((c) => c.discipline === 'Warrior');
  assert.ok(w.optionPool.items.length > 0);
  for (const it of w.optionPool.items) {
    assert.equal(typeof (typeof it === 'string' ? it : it.name), 'string');
    if (typeof it !== 'string') assert.ok('brief' in it || 'shortEffect' in it); // enrichment like `learnable`
  }
});

test('model.addableDisciplines is [] when no Discipline is left to add', () => {
  memory.clear();
  const char = kolonLike([
    { name: 'Air Sailor', circle: 2, talents: [] },
    { name: 'Archer', circle: 4, talents: [t1('Missile Weapon', 5)] },
    { name: 'Nethermancer', circle: 2, talents: [] },
    { name: 'Thief', circle: 2, talents: [] },
    { name: 'Warrior', circle: 2, talents: [] },
  ]);
  assert.deepEqual(deriveModel(char, rules).addableDisciplines, []);
});

test('addableDisciplines is derived only: never present in forSave()', () => {
  memory.clear();
  const char = kolonLike();
  deriveModel(char, rules);
  assert.ok(!('addableDisciplines' in forSave(char)));
  assert.ok(!('addableDisciplines' in char));
});

test('seed persists only {name, rank:1, circle:1} inputs: round-trip, no tier/derived fields, circle unchanged', () => {
  memory.clear();
  const base = kolonLike();
  const seeded = {
    disciplines: [base.disciplines[0], { name: 'Warrior', circle: 1, talents: WARRIOR_DTS.map((n) => t1(n)) }],
    skills: [],
  };
  const edits = saveAdvancementEdits(seeded, 'k1');
  const next = applyEdits(base, edits);
  const w = forSave(next).disciplines[1];
  assert.equal(w.circle, 1);
  assert.deepEqual(w.talents, WARRIOR_DTS.map((n) => ({ name: n, rank: 1, circle: 1 })));
  assert.equal(base.disciplines[1].talents.length, 0); // original untouched
});

test('after a completed seed the Discipline is no longer a candidate (duplicate dispatch is a no-op) and Legend spent rises by 1500', () => {
  memory.clear();
  const base = kolonLike();
  const before = deriveModel(base, rules);
  const after = deriveModel(
    kolonLike([base.disciplines[0], { name: 'Warrior', circle: 1, talents: WARRIOR_DTS.map((n) => t1(n)) }]),
    rules,
  );
  assert.ok(!after.addableDisciplines.some((c) => c.discipline === 'Warrior'));
  assert.equal(before.legend.available - after.legend.available, 1500); // R2: 5 x 300, same as the quote
});

test('stepper cost == audit(after) - audit(before) for a Circle-1 additional Discipline (I2)', () => {
  memory.clear();
  const mk = (rank) =>
    kolonLike([
      { name: 'Thief', circle: 4, talents: [t1('Lock Picking', 5)] },
      { name: 'Warrior', circle: 1, talents: [t1('Melee Weapon', rank)] },
    ]);
  const m1 = deriveModel(mk(1), rules);
  const m2 = deriveModel(mk(2), rules);
  const row = (m) => m.disciplines[1].talents.find((t) => t.name === 'Melee Weapon');
  assert.equal(row(m1).pricing.increaseCost, m1.legend.available - m2.legend.available);
  assert.equal(row(m2).pricing.refund, m1.legend.available - m2.legend.available);
});

test('Rank-1 Legend of a stored Circle-1 additional Discipline uses the prior row (Thief 4 -> 300 per DT)', () => {
  memory.clear();
  const none = deriveModel(kolonLike(), rules).legend.available;
  const one = deriveModel(
    kolonLike([
      { name: 'Thief', circle: 4, talents: [t1('Lock Picking', 5)] },
      { name: 'Warrior', circle: 1, talents: [t1('Melee Weapon')] },
    ]),
    rules,
  ).legend.available;
  assert.equal(none - one, 300); // not 1300 (row of the Discipline's own Circle 1)
});

test('logDisciplineStarted: new Discipline entry', () => {
  memory.clear();
  logDisciplineStarted('k2', {
    discipline: 'Warrior',
    mode: 'new',
    grants: [...WARRIOR_DTS, 'Maneuver'],
    legendCost: 1800,
    silverFee: 2400,
    beforeCoins: { silver: 3000 },
    afterCoins: { silver: 600 },
  });
  const e = loadRollLog('k2').entries[0];
  assert.equal(e.kind, 'system');
  assert.equal(e.label, 'Started Warrior');
  assert.equal(e.discipline, 'Warrior');
  assert.equal(e.circle, 1);
  assert.deepEqual(e.grants, [...WARRIOR_DTS, 'Maneuver']);
  assert.equal(e.legendCost, 1800);
  assert.equal(e.silverFee, 2400);
  assert.equal(typeof e.coinDelta, 'string');
  assert.ok('purseBefore' in e && 'purseAfter' in e);
});

test('logDisciplineStarted: seed entry label', () => {
  memory.clear();
  logDisciplineStarted('k3', {
    discipline: 'Warrior',
    mode: 'seed',
    grants: WARRIOR_DTS,
    legendCost: 1500,
    silverFee: 0,
    beforeCoins: {},
    afterCoins: {},
  });
  const e = loadRollLog('k3').entries[0];
  assert.equal(e.label, 'Seeded Warrior Circle 1');
  assert.equal(e.silverFee, 0);
});
