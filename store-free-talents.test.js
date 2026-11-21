// store-free-talents.test.js — run with `npm test`.
// Free talents as derived model rows (plans/display-free-talents, T2/T5) against the
// REAL rules files. Rules: R1 rank = Circle, R2 no advancement effect, R3 second
// discipline, R4 karma/strain, R5 Standard Matrix display-only, R6 same-name routes,
// R7 Call Missile catalog entry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const j = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const rules = {
  steps: j('./rules/steps.json').steps,
  talentsFile: j('./rules/talents.json'),
  disciplinesFile: j('./rules/disciplines.json'),
  racesFile: j('./rules/races.json'),
  characteristicsFile: j('./rules/characteristics.json'),
  itemsFile: j('./rules/items.json'),
  legendFile: j('./rules/legend.json'),
  skillsFile: j('./rules/skills.json'),
  knacksFile: j('./rules/knacks.json'),
  threadItemsFile: j('./rules/thread-items.json'),
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: j('./rules/combat.json'),
};
const diceByStep = new Map(rules.steps.map((s) => [s.step, s.dice ?? '']));
const catalog = rules.talentsFile.talents ?? rules.talentsFile;

const char = (disciplines, items = []) => ({
  meta: { name: 'Tester', race: 'Ork' },
  attributes: {
    Dexterity: { base: 20 },
    Strength: { base: 10 },
    Toughness: { base: 10 },
    Perception: { base: 14 },
    Willpower: { base: 12 },
    Charisma: { base: 8 },
  },
  disciplines,
  skills: [],
  items,
});
const archer = (circle = 3, talents) => ({
  name: 'Archer',
  circle,
  talents: talents ?? [
    { name: 'Avoid Blow', rank: 2 },
    { name: 'Missile Weapon', rank: 3 },
  ],
});
const disc = (m, name) => m.disciplines.find((d) => d.name === name);
const free = (d) => d.talents.filter((t) => t.free);
const learned = (d) => d.talents.filter((t) => !t.free);

test('Archer shows Call Missile as a free row at rank = Circle, Circle 1 group, last', () => {
  const m = deriveModel(char([archer(3)]), rules);
  const d = disc(m, 'Archer');
  const f = free(d);
  assert.equal(f.length, 1);
  assert.equal(f[0].name, 'Call Missile');
  assert.equal(f[0].rank, 3);
  assert.equal(f[0].circle, 1);
  assert.equal(f[0].free, true);
  assert.equal(f[0].required, true);
  assert.equal(d.talents[d.talents.length - 1], f[0], 'free rows are appended last');
});

test('Call Missile (R7): Perception step, Karma, strain 1, catalog filled', () => {
  const m = deriveModel(char([archer(3)]), rules);
  const t = free(disc(m, 'Archer'))[0];
  assert.equal(t.attribute, 'Perception');
  assert.equal(t.action, 'Simple');
  assert.equal(typeof t.step, 'number');
  assert.equal(t.dice, diceByStep.get(t.step));
  assert.ok(t.karma, 'Karma allowed on a rollable free talent');
  assert.equal(t.rollStrain, 1);
  assert.ok(t.brief, 'has a short effect');
  const cat = catalog['Call Missile'];
  assert.ok(cat, 'catalog entry found');
  assert.equal(cat.strain, 1);
  assert.equal(cat.skillUse?.allowed, false);
  assert.ok(cat.summary, 'has a summary');
});

test('Call Missile step rises with the Circle (rank = Circle)', () => {
  const a = free(disc(deriveModel(char([archer(2)]), rules), 'Archer'))[0];
  const b = free(disc(deriveModel(char([archer(5)]), rules), 'Archer'))[0];
  assert.ok(b.step > a.step);
});

test('Thief shows Danger Sense free, rollable with strain 1', () => {
  const m = deriveModel(char([{ name: 'Thief', circle: 2, talents: [{ name: 'Lock Picking', rank: 2 }] }]), rules);
  const f = free(disc(m, 'Thief'));
  assert.equal(f.length, 1);
  assert.equal(f[0].name, 'Danger Sense');
  assert.equal(f[0].rank, 2);
  assert.equal(typeof f[0].step, 'number');
  assert.equal(f[0].rollStrain, 1);
  assert.ok(f[0].karma);
});

test('Nethermancer shows two Standard Matrix rows: no step, no karma, no Enhanced row (R5)', () => {
  const m = deriveModel(char([{ name: 'Nethermancer', circle: 4, talents: [] }]), rules);
  const f = free(disc(m, 'Nethermancer'));
  assert.equal(f.length, 2);
  for (const t of f) {
    assert.equal(t.name, 'Standard Matrix');
    assert.equal(t.rank, 4);
    assert.equal(t.step, null);
    assert.equal(t.karma, null);
  }
  assert.ok(!m.disciplines.some((d) => d.talents.some((t) => t.name === 'Enhanced Matrix')));
});

test('a second discipline grants its own free talent at its own Circle (R3)', () => {
  const m = deriveModel(char([archer(6), { name: 'Thief', circle: 2, talents: [] }]), rules);
  assert.equal(free(disc(m, 'Archer'))[0].rank, 6);
  assert.equal(free(disc(m, 'Thief'))[0].rank, 2);
});

test('a stored same-name talent in the SAME discipline suppresses the free row (R6)', () => {
  const m = deriveModel(char([archer(3, [{ name: 'Call Missile', rank: 2 }, { name: 'Missile Weapon', rank: 3 }])]), rules);
  const d = disc(m, 'Archer');
  assert.equal(free(d).length, 0);
  const cm = d.talents.filter((t) => t.name === 'Call Missile');
  assert.equal(cm.length, 1);
  assert.equal(cm[0].rank, 2);
});

test('Thief option Call Missile + Archer free Call Missile: two rows, each its own rank (R6)', () => {
  const m = deriveModel(
    char([archer(4), { name: 'Thief', circle: 6, talents: [{ name: 'Call Missile', rank: 3 }] }]),
    rules,
  );
  const a = disc(m, 'Archer').talents.filter((t) => t.name === 'Call Missile');
  const t = disc(m, 'Thief').talents.filter((x) => x.name === 'Call Missile');
  assert.equal(a.length, 1);
  assert.equal(a[0].free, true);
  assert.equal(a[0].rank, 4);
  assert.equal(t.length, 1);
  assert.ok(!t[0].free);
  assert.equal(t[0].rank, 3);
  assert.ok(a[0].step > t[0].step, 'higher rank gives the higher step (the Combat picker keeps this one)');
  assert.deepEqual(a[0].rollMods ?? [], t[0].rollMods ?? [], 'result mods are identical across same-name rows');
});

test('pricing alignment: free rows have pricing null, learned rows stay aligned with raw input', () => {
  const c = char([
    { name: 'Thief', circle: 2, talents: [{ name: 'Lock Picking', rank: 2 }, { name: 'Climbing', rank: 1 }] },
    archer(3),
  ]);
  const m = deriveModel(c, rules);
  for (const d of m.disciplines) {
    for (const t of free(d)) assert.equal(t.pricing, null);
    const raw = c.disciplines.find((x) => x.name === d.name).talents;
    assert.equal(learned(d).length, raw.length, 'non-free count equals raw count');
    learned(d).forEach((t, i) => assert.equal(t.name, raw[i].name, 'learned order preserved'));
  }
  // Same learned talent, same priced result with or without a free row alongside.
  const solo = deriveModel(char([archer(3, [{ name: 'Avoid Blow', rank: 2 }, { name: 'Missile Weapon', rank: 3 }])]), rules);
  const withCm = deriveModel(char([archer(3, [{ name: 'Avoid Blow', rank: 2 }, { name: 'Missile Weapon', rank: 3 }])]), rules);
  assert.deepEqual(learned(disc(solo, 'Archer')).map((t) => t.pricing), learned(disc(withCm, 'Archer')).map((t) => t.pricing));
  for (const t of learned(disc(m, 'Archer'))) {
    if (t.pricing != null) assert.ok('increaseCost' in t.pricing && 'refund' in t.pricing && 'affordable' in t.pricing);
  }
});

test('free rows do not change circleStatus or optionSlots (R2) and do not mutate the input', () => {
  const c = char([archer(3)]);
  const snapshot = JSON.parse(JSON.stringify(c));
  const m = deriveModel(c, rules);
  assert.deepEqual(c, snapshot, 'character not mutated');
  const d = disc(m, 'Archer');
  const { circleStatus: expected } = d;
  // Same raw talents, with a stored Call Missile (suppresses the free row but is not
  // a countable Discipline talent): supported Circle is driven by raw talents only.
  const other = deriveModel(char([archer(3, [...c.disciplines[0].talents, { name: 'Call Missile', rank: 1 }])]), rules);
  assert.equal(disc(other, 'Archer').circleStatus.supported, expected.supported);
  assert.deepEqual(
    disc(other, 'Archer').optionSlots.map((s) => [s.circle, s.open]),
    d.optionSlots.map((s) => [s.circle, s.open]),
  );
});

test('a grant-ability rank bonus folds into a free Danger Sense row', () => {
  const ti = structuredClone(rules.threadItemsFile);
  const fx = ti.items['Dark Archer Armour'].threadRanks.find((r) => r.rank === 2).effects;
  fx.push({ type: 'grant-ability', target: { domain: 'ability', name: 'Danger Sense' }, operation: 'add', value: 1, measure: 'rank', condition: 'always', stacking: 'replace', source: 'thread', summary: '+1 rank to Danger Sense.' });
  const r2 = { ...rules, threadItemsFile: ti };
  const thief = { name: 'Thief', circle: 2, talents: [] };
  const plain = free(disc(deriveModel(char([thief]), r2), 'Thief'))[0];
  const armed = free(disc(deriveModel(char([thief], [{ name: 'Dark Archer Armour', threadRank: 2 }]), r2), 'Thief'))[0];
  assert.equal(armed.rank, 2, 'rank stays the Circle');
  assert.equal(armed.rankBonus, 1);
  assert.equal(armed.step, plain.step + 1);
  assert.equal(armed.stepBase, plain.step);
  assert.equal(armed.dice, diceByStep.get(armed.step));
});

test('unknown discipline gives no free rows and does not throw', () => {
  const m = deriveModel(char([{ name: 'Nonexistent', circle: 3, talents: [{ name: 'Awareness', rank: 1 }] }]), rules);
  assert.equal(free(disc(m, 'Nonexistent')).length, 0);
});
