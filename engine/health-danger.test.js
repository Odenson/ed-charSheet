// engine/health-danger.test.js — healthDanger + resolveHit (update-health-overview).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthDanger, resolveHit } from './health.js';

const R = { unconsciousness: { value: 58 }, death: { value: 72 } };
const hd = (damage, wounds = 0, ratings = R) => healthDanger({ damage, wounds }, ratings);

test('healthDanger: spec fixture 3/58/72 is calm with fill and tick', () => {
  const r = hd(3);
  assert.equal(r.damage, 'none');
  assert.equal(r.wounds, 'none');
  assert.equal(r.fill, 3 / 72);
  assert.equal(r.tick, 58 / 72);
});

test('healthDanger: amber/red boundaries (47 none, 48 warn, 57 warn, 58 bad)', () => {
  assert.equal(hd(47).damage, 'none');
  assert.equal(hd(48).damage, 'warn');
  assert.equal(hd(57).damage, 'warn');
  assert.equal(hd(58).damage, 'bad');
});

test('healthDanger: damage beyond Death clamps fill to 1 and is bad', () => {
  const r = hd(100);
  assert.equal(r.fill, 1);
  assert.equal(r.damage, 'bad');
});

test('healthDanger: wounds 0 none, 1 and 2 bad', () => {
  assert.equal(hd(0, 0).wounds, 'none');
  assert.equal(hd(0, 1).wounds, 'bad');
  assert.equal(hd(0, 2).wounds, 'bad');
});

test('healthDanger: zero damage with Unconscious <= 10 is none, not warn', () => {
  const r = healthDanger({ damage: 0, wounds: 0 }, { unconsciousness: 8, death: 12 });
  assert.equal(r.damage, 'none');
});

test('healthDanger: both ratings missing -> nulls, wounds still computed', () => {
  const r = healthDanger({ damage: 5, wounds: 1 }, {});
  assert.deepEqual(r, { damage: null, wounds: 'bad', fill: null, tick: null });
});

test('healthDanger: only Unconscious missing -> fill set, damage/tick null', () => {
  const r = healthDanger({ damage: 36, wounds: 0 }, { death: { value: 72 } });
  assert.equal(r.damage, null);
  assert.equal(r.tick, null);
  assert.equal(r.fill, 0.5);
});

test('healthDanger: only Death missing or <= 0 -> damage set, fill/tick null', () => {
  for (const death of [undefined, { value: 0 }]) {
    const r = healthDanger({ damage: 50, wounds: 0 }, { unconsciousness: { value: 58 }, death });
    assert.equal(r.damage, 'warn');
    assert.equal(r.fill, null);
    assert.equal(r.tick, null);
  }
});

test('healthDanger: accepts bare numeric ratings', () => {
  const r = healthDanger({ damage: 58, wounds: 0 }, { unconsciousness: 58, death: 72 });
  assert.equal(r.damage, 'bad');
});

test('healthDanger: non-numeric/negative inputs clamp to 0; inputs not mutated', () => {
  const inputs = { damage: -5, wounds: 'x' };
  const snap = structuredClone(inputs);
  const r = healthDanger(inputs, R);
  assert.equal(r.damage, 'none');
  assert.equal(r.wounds, 'none');
  assert.equal(r.fill, 0);
  assert.deepEqual(inputs, snap);
  assert.doesNotThrow(() => healthDanger(undefined, R));
});

test('resolveHit: WT-1 / WT / WT+4 / WT+5 wounds and knockdown', () => {
  const h = { damage: 10, wounds: 0, recoveriesUsed: 1 };
  const wt = 11;
  const cases = [
    [wt - 1, 0, null],
    [wt, 1, null],
    [wt + 4, 1, null],
    [wt + 5, 1, { difficulty: 5 }],
  ];
  for (const [take, wounds, kd] of cases) {
    const r = resolveHit(h, take, wt);
    assert.deepEqual(r.next, { damage: 10 + take, wounds, recoveriesUsed: 1 }, `take ${take}`);
    assert.deepEqual(r.knockdown, kd, `take ${take}`);
  }
});

test('resolveHit: knockdown difficulty is take minus WT', () => {
  assert.deepEqual(resolveHit({ damage: 0 }, 20, 11).knockdown, { difficulty: 9 });
});

test('resolveHit: null Wound Threshold -> damage only, no Wound, no Knockdown', () => {
  const r = resolveHit({ damage: 2, wounds: 1, recoveriesUsed: 0 }, 30, null);
  assert.deepEqual(r.next, { damage: 32, wounds: 1, recoveriesUsed: 0 });
  assert.equal(r.knockdown, null);
});

test('resolveHit: take 0 or negative changes nothing', () => {
  const h = { damage: 4, wounds: 1, recoveriesUsed: 2 };
  for (const take of [0, -7]) {
    const r = resolveHit(h, take, 11);
    assert.deepEqual(r.next, { damage: 4, wounds: 1, recoveriesUsed: 2 });
    assert.equal(r.knockdown, null);
  }
});

test('resolveHit: does not mutate the health input', () => {
  const h = { damage: 4, wounds: 0, recoveriesUsed: 0 };
  const snap = structuredClone(h);
  resolveHit(h, 20, 11);
  assert.deepEqual(h, snap);
});
