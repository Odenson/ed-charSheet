// store-shared-talents.test.js — shared Discipline Talents (rules.md R6; Q038 (5)):
// a Circle-1 DT already known through another Discipline counts for this Discipline's
// Circle gate and shows as a read-only row; it is never re-granted on training.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import { sharedDisciplineTalents } from './engine/talent-options.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k), clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
};
const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const rules = {
  steps: read('steps.json').steps, talentsFile: read('talents.json'), disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'), characteristicsFile: read('characteristics.json'), itemsFile: read('items.json'),
  legendFile: read('legend.json'), skillsFile: read('skills.json'), knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'),
};
const thiefRef = rules.disciplinesFile.disciplines.find((d) => d.name === 'Thief');
const t1 = (name, rank = 1) => ({ name, rank, circle: 1 });
const char = () => ({
  schema: 'ed-character/2', meta: { name: 'T' }, attributes: {}, resources: { legend: { totalEarnt: 50000 } },
  disciplines: [
    { name: 'Archer', circle: 3, talents: [t1('Awareness', 4), t1('Stealthy Stride', 3)] },
    { name: 'Thief', circle: 1, talents: [t1('Lock Picking', 2), t1('Picking Pockets', 2), t1('Thread Weaving (Thief)', 2)] },
  ],
  skills: [], knacks: [], items: [],
});

test('sharedDisciplineTalents: Archer-known Thief DTs, highest rank, free/own excluded', () => {
  const c = char();
  const s = sharedDisciplineTalents(thiefRef, 1, c.disciplines[1].talents, [c.disciplines[0]]);
  assert.deepEqual(s.map((x) => [x.name, x.rank, x.circle, x.from]), [['Awareness', 4, 1, 'Archer'], ['Stealthy Stride', 3, 1, 'Archer']]);
});

test('model: shared talents satisfy the Circle 2 gate at the required rank only', () => {
  const c = char();
  let th = deriveModel(c, rules).disciplines.find((d) => d.name === 'Thief');
  assert.equal(th.sharedTalents.length, 2);
  assert.equal(th.circleStatus.nextRequirement.total, 5);
  assert.equal(th.circleStatus.nextRequirement.met, 5); // Awareness 4 and Stealthy Stride 3 are >= 2
  assert.equal(th.circleStatus.eligible, true);
  c.disciplines[0].talents[1].rank = 1; // Stealthy Stride below the gate
  th = deriveModel(c, rules).disciplines.find((d) => d.name === 'Thief');
  assert.equal(th.circleStatus.nextRequirement.met, 4);
  assert.equal(th.circleStatus.eligible, false);
});

test('model: shared rows are read-only extras (not in talents[]); the Archer card has none', () => {
  const m = deriveModel(char(), rules);
  const th = m.disciplines.find((d) => d.name === 'Thief');
  assert.ok(th.sharedTalents.every((r) => r.shared === true && r.sharedFrom === 'Archer'));
  assert.ok(!th.talents.some((r) => r.name === 'Awareness'));
  assert.deepEqual(m.disciplines.find((d) => d.name === 'Archer').sharedTalents, []);
});

test('model: a shared talent is not re-granted when training to the next Circle', () => {
  const c = char();
  c.disciplines[0].talents.push({ name: 'Disarm Trap', rank: 2, circle: 2 }); // Thief's Circle 2 DT, known via Archer
  const th = deriveModel(c, rules).disciplines.find((d) => d.name === 'Thief');
  assert.ok(!th.nextGrant.includes('Disarm Trap'));
});
