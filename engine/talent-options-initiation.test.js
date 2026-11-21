// engine/talent-options-initiation.test.js — start-new-discipline I1 (pure quote).
// Contract: spec.md "Modules & functions" 3. Rules values: rules.md R1-R4, R6.
// Prices come from rules/legend.json (R2 table); the 100 sp/Circle fee is R3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initiationQuote, addableDisciplines, NEW_DISCIPLINE_FEE_PER_CIRCLE } from './talent-options.js';
import { auditLegendSpent } from './legend-spent.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../rules/${p}`, import.meta.url)));
const costs = load('legend.json').costs;
const refs = load('disciplines.json').disciplines;
const ref = (name) => refs.find((d) => d.name === name);

const WARRIOR_DTS = ['Avoid Blow', 'Melee Weapon', 'Thread Weaving (Warrior)', 'Tiger Spring', 'Wood Skin'];
const t1 = (name) => ({ name, rank: 1, circle: 1 });
const thief4 = () => ({ name: 'Thief', circle: 4, talents: [t1('Lock Picking'), t1('Thread Weaving (Thief)')] });
// Spec allows legendTotal/defaultSilver as small functions of withOption.
const call = (q, k, withOption) => (typeof q[k] === 'function' ? q[k](withOption) : q[k]);

test('NEW_DISCIPLINE_FEE_PER_CIRCLE is 100 sp (R3)', () => {
  assert.equal(NEW_DISCIPLINE_FEE_PER_CIRCLE, 100);
});

test('fresh 2nd Discipline: Kolon Thief 4 -> Warrior = 5 DTs x 300, silver 100 x 4 x 5 (R1,R2,R3)', () => {
  const q = initiationQuote(ref('Warrior'), [thief4()], costs, { tierShift: 0 });
  assert.equal(q.mode, 'new');
  assert.equal(q.discipline, 'Warrior');
  assert.equal(q.ordinal, 2);
  assert.equal(q.lowestCircleBefore, 4);
  assert.equal(q.feeBase, 4);
  assert.deepEqual([...q.grants].sort(), [...WARRIOR_DTS].sort());
  assert.equal(q.perTalentLegend, 300);
  assert.equal(call(q, 'legendTotal', false), 1500);
  assert.equal(call(q, 'defaultSilver', false), 2000);
});

test('option picked adds one talent to Legend and fee (R4); skipping does not', () => {
  const q = initiationQuote(ref('Warrior'), [thief4()], costs, { tierShift: 0 });
  assert.equal(q.optionSlotOpen, true);
  assert.equal(q.optionPool.available, true);
  assert.ok(q.optionPool.items.length > 0);
  assert.ok(!q.optionPool.items.includes('Tiger Spring')); // a DT is not an option
  assert.equal(call(q, 'legendTotal', true), 1800);
  assert.equal(call(q, 'defaultSilver', true), 2400);
  assert.equal(call(q, 'legendTotal', false), 1500);
});

test('3rd Discipline: ordinal 3, row = lowest of earlier Disciplines, column 3; fee base sums all Circles (R2,R3)', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 2, talents: [] }];
  const q = initiationQuote(ref('Archer'), ds, costs, { tierShift: 0 });
  assert.equal(q.mode, 'new');
  assert.equal(q.ordinal, 3);
  assert.equal(q.lowestCircleBefore, 2);
  assert.equal(q.feeBase, 6);
  assert.equal(q.perTalentLegend, costs.newDisciplineRank1['3']['2']);
  assert.equal(call(q, 'defaultSilver', false), 100 * 6 * q.grants.length);
});

test("Thread Weaving is a per-Discipline variant: another Discipline's variant is not known (R6)", () => {
  const q = initiationQuote(ref('Warrior'), [thief4()], costs, { tierShift: 0 });
  assert.ok(q.grants.includes('Thread Weaving (Warrior)'));
  assert.ok(!q.grants.includes('Thread Weaving (Thief)'));
});

test('grants never include universals or free talents (R6)', () => {
  const q = initiationQuote(ref('Archer'), [thief4()], costs, { tierShift: 0 });
  assert.ok(!q.grants.includes('Durability'));
  assert.ok(!q.grants.includes('Karma Ritual'));
  assert.ok(!q.grants.includes('Call Missile')); // Archer free talent
});

test('seed empty Warrior (index 1, Circle 1): ordinal 2, row from earlier, fee base from OTHER Disciplines', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [] }];
  const q = initiationQuote(ref('Warrior'), ds, costs, { tierShift: 0 });
  assert.equal(q.mode, 'seed');
  assert.equal(q.ordinal, 2);
  assert.equal(q.lowestCircleBefore, 4);
  assert.equal(q.feeBase, 4);
  assert.equal(q.grants.length, 5);
  assert.equal(q.perTalentLegend, 300);
  assert.equal(call(q, 'defaultSilver', false), 2000);
});

test('partially seeded Discipline grants and prices only the missing Circle-1 DTs', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [t1('Avoid Blow'), t1('Melee Weapon')] }];
  const q = initiationQuote(ref('Warrior'), ds, costs, { tierShift: 0 });
  assert.equal(q.mode, 'seed');
  assert.deepEqual([...q.grants].sort(), ['Thread Weaving (Warrior)', 'Tiger Spring', 'Wood Skin']);
  assert.equal(call(q, 'legendTotal', false), 3 * 300);
  assert.equal(call(q, 'defaultSilver', false), 100 * 4 * 3);
});

test('seed with its Circle-1 option slot already filled: empty pool, option not in fee/Legend', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [t1('Maneuver')] }]; // Maneuver = Warrior novice option
  const q = initiationQuote(ref('Warrior'), ds, costs, { tierShift: 0 });
  assert.equal(q.mode, 'seed');
  assert.equal(q.optionSlotOpen, false);
  assert.deepEqual(q.optionPool, { available: true, items: [] });
  assert.equal(call(q, 'legendTotal', true), call(q, 'legendTotal', false));
  assert.equal(call(q, 'defaultSilver', true), call(q, 'defaultSilver', false));
});

test('non-last seed prices from EARLIER Disciplines only (Thief 4, Warrior 1, Archer 1: Warrior stays 300)', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [] }, { name: 'Archer', circle: 1, talents: [] }];
  const q = initiationQuote(ref('Warrior'), ds, costs, { tierShift: 0 });
  assert.equal(q.ordinal, 2);
  assert.equal(q.lowestCircleBefore, 4);
  assert.equal(q.perTalentLegend, 300);
  assert.equal(q.feeBase, 4 + 1); // OTHER Disciplines: Thief 4 + Archer 1
});

test('excluded: ordinal-1 Discipline at Circle 1 with missing DTs is not a candidate', () => {
  const ds = [{ name: 'Thief', circle: 1, talents: [] }];
  assert.ok(!initiationQuote(ref('Thief'), ds, costs, { tierShift: 0 }));
  assert.ok(!addableDisciplines(refs, ds, costs, { tierShift: 0 }).some((c) => c.discipline === 'Thief'));
});

test('excluded: Discipline at Circle > 1, or Circle 1 with every Circle-1 DT known', () => {
  const dsHigh = [thief4(), { name: 'Warrior', circle: 2, talents: [] }];
  assert.ok(!initiationQuote(ref('Warrior'), dsHigh, costs, { tierShift: 0 }));
  const dsFull = [thief4(), { name: 'Warrior', circle: 1, talents: WARRIOR_DTS.map(t1) }];
  assert.ok(!initiationQuote(ref('Warrior'), dsFull, costs, { tierShift: 0 }));
});

test('addableDisciplines lists fresh and seed candidates; omits ineligible ones', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [] }];
  const list = addableDisciplines(refs, ds, costs, { tierShift: 0 });
  const by = Object.fromEntries(list.map((c) => [c.discipline, c]));
  assert.equal(by.Warrior.mode, 'seed');
  assert.equal(by.Archer.mode, 'new');
  assert.equal(by.Nethermancer.mode, 'new');
  assert.equal(by.Archer.ordinal, 3);
  assert.ok(!by.Thief); // ordinal 1 / Circle 4
});

test('no Discipline left to add -> empty list', () => {
  const full = refs.map((r, i) => ({ name: r.name, circle: i === 0 ? 4 : 2, talents: [] }));
  assert.deepEqual(addableDisciplines(refs, full, costs, { tierShift: 0 }), []);
});

test('unpriceable price is null, never 0 (missing New-Discipline table)', () => {
  const noTable = { ...costs, newDisciplineRank1: undefined };
  const q = initiationQuote(ref('Warrior'), [thief4()], noTable, { tierShift: 0 });
  assert.equal(q.perTalentLegend, null);
  assert.equal(call(q, 'legendTotal', false), null);
  assert.equal(typeof call(q, 'defaultSilver', false), 'number'); // silver does not depend on the table
});

test('tierShift > 0: quote equals the audit delta for the seeded talents', () => {
  const before = [thief4(), { name: 'Warrior', circle: 1, talents: [] }];
  const after = [thief4(), { name: 'Warrior', circle: 1, talents: WARRIOR_DTS.map(t1) }];
  const audit = (disciplines) =>
    auditLegendSpent({ attributes: {}, disciplines, skills: [], resources: { legend: { totalEarnt: 99999 } } }, costs, { tierShift: 1 }).total;
  const q = initiationQuote(ref('Warrior'), before, costs, { tierShift: 1 });
  assert.equal(call(q, 'legendTotal', false), audit(after) - audit(before));
});

test('standard model: quote equals the audit delta for a fresh Discipline', () => {
  const before = [thief4()];
  const after = [thief4(), { name: 'Warrior', circle: 1, talents: WARRIOR_DTS.map(t1) }];
  const audit = (disciplines) =>
    auditLegendSpent({ attributes: {}, disciplines, skills: [], resources: { legend: { totalEarnt: 99999 } } }, costs).total;
  const q = initiationQuote(ref('Warrior'), before, costs, { tierShift: 0 });
  assert.equal(call(q, 'legendTotal', false), audit(after) - audit(before));
});

test('quote is derived only: inputs are not mutated', () => {
  const ds = [thief4(), { name: 'Warrior', circle: 1, talents: [] }];
  const snap = JSON.stringify(ds);
  initiationQuote(ref('Warrior'), ds, costs, { tierShift: 0 });
  addableDisciplines(refs, ds, costs, { tierShift: 0 });
  assert.equal(JSON.stringify(ds), snap);
});
