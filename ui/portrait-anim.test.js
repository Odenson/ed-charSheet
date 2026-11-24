// ui/portrait-anim.test.js — run with `npm test` (node --test, no deps).
// plans/simple-animate-portrait: pure prefs parsing + ember particle step.
// Expected to fail until ui/portrait-anim.js exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTRAIT_DRIFT_KEY, PORTRAIT_EMBERS_KEY, MAX_DT,
  readPortraitAnim, portraitAnimValue, emberCap, spawnEmber, stepEmbers,
} from './portrait-anim.js';

// Seeded deterministic PRNG (mulberry32).
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const W = 200, H = 300;
const OFF = { drift: false, embers: false };

test('keys and MAX_DT constants', () => {
  assert.equal(PORTRAIT_DRIFT_KEY, 'ed-portrait-drift');
  assert.equal(PORTRAIT_EMBERS_KEY, 'ed-portrait-embers');
  assert.equal(MAX_DT, 0.05);
});

test('readPortraitAnim: unset is off', () => {
  assert.deepEqual(readPortraitAnim(() => null), OFF);
  assert.deepEqual(readPortraitAnim(() => undefined), OFF);
});

test('readPortraitAnim: only literal "on" is on, per key', () => {
  const s1 = { 'ed-portrait-drift': 'on', 'ed-portrait-embers': 'off' };
  assert.deepEqual(readPortraitAnim(k => s1[k] ?? null), { drift: true, embers: false });
  const s2 = { 'ed-portrait-drift': 'off', 'ed-portrait-embers': 'on' };
  assert.deepEqual(readPortraitAnim(k => s2[k] ?? null), { drift: false, embers: true });
  assert.deepEqual(readPortraitAnim(() => 'on'), { drift: true, embers: true });
});

test('readPortraitAnim: garbage values read off', () => {
  for (const v of ['ON', 'true', '1', '', ' on', 'yes']) {
    assert.deepEqual(readPortraitAnim(() => v), OFF, JSON.stringify(v));
  }
});

test('readPortraitAnim: throwing getter reads off', () => {
  assert.deepEqual(readPortraitAnim(() => { throw new Error('denied'); }), OFF);
});

test('portraitAnimValue maps booleans to on/off', () => {
  assert.equal(portraitAnimValue(true), 'on');
  assert.equal(portraitAnimValue(false), 'off');
});

test('portraitAnimValue round-trips through readPortraitAnim', () => {
  const r = readPortraitAnim(k => portraitAnimValue(k === PORTRAIT_DRIFT_KEY));
  assert.deepEqual(r, { drift: true, embers: false });
});

test('emberCap: zero for non-positive size', () => {
  assert.equal(emberCap(0, 100), 0);
  assert.equal(emberCap(100, 0), 0);
  assert.equal(emberCap(-5, 100), 0);
  assert.equal(emberCap(100, -5), 0);
});

test('emberCap: positive integer for real sizes, monotonic in area, bounded', () => {
  const small = emberCap(40, 40), mid = emberCap(200, 300), big = emberCap(4000, 4000);
  for (const c of [small, mid, big]) {
    assert.ok(Number.isInteger(c));
    assert.ok(c > 0);
  }
  assert.ok(small <= mid);
  assert.ok(mid <= big);
  assert.ok(emberCap(1e6, 1e6) < 1000, 'max is bounded');
});

test('spawnEmber: inside frame, near bottom, valid shape', () => {
  const rand = seeded(7);
  for (let i = 0; i < 200; i++) {
    const p = spawnEmber(W, H, rand);
    assert.ok(p.x >= 0 && p.x <= W, `x ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= H, `y ${p.y}`);
    assert.ok(p.y >= H / 2, `spawns in lower half, got ${p.y}`);
    assert.ok(['spark', 'ash'].includes(p.kind));
    assert.ok(p.r > 0);
    assert.ok(p.maxLife > 0);
    assert.ok(p.life > 0 && p.life <= p.maxLife);
    assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy));
  }
});

test('spawnEmber: deterministic for same seed', () => {
  assert.deepEqual(spawnEmber(W, H, seeded(3)), spawnEmber(W, H, seeded(3)));
});

test('stepEmbers: zero or negative frame returns []', () => {
  const live = [spawnEmber(W, H, seeded(1))];
  assert.deepEqual(stepEmbers(live, 0.016, 0, H, seeded(2)), []);
  assert.deepEqual(stepEmbers(live, 0.016, W, 0, seeded(2)), []);
  assert.deepEqual(stepEmbers(live, 0.016, -1, H, seeded(2)), []);
  assert.deepEqual(stepEmbers([], 0.016, W, -1, seeded(2)), []);
});

test('stepEmbers: returns a new array and does not mutate input', () => {
  const p = { x: 100, y: 200, vx: 5, vy: -30, r: 2, life: 3, maxLife: 4, kind: 'spark' };
  const input = [p];
  const snap = JSON.stringify(input);
  const out = stepEmbers(input, 0.016, W, H, seeded(5));
  assert.notEqual(out, input);
  assert.equal(JSON.stringify(input), snap);
  assert.equal(input.length, 1);
});

// Tracked particle uses a distinctive r/maxLife so it can be found among top-ups.
const mk = (o = {}) => ({ x: 100, y: 200, vx: 0, vy: -30, r: 9, life: 3, maxLife: 4.5, kind: 'spark', ...o });
const find = out => out.filter(e => e.r === 9 && e.maxLife === 4.5);

test('stepEmbers: a live ember rises and loses life', () => {
  const mine = find(stepEmbers([mk()], 0.04, W, H, seeded(5)));
  assert.equal(mine.length, 1);
  assert.ok(mine[0].y < 200, 'y decreased');
  assert.ok(mine[0].life < 3, 'life decreased');
});

test('stepEmbers: dt=0 leaves positions unchanged and keeps live particles', () => {
  const mine = find(stepEmbers([mk({ vx: 5, kind: 'ash' })], 0, W, H, seeded(5)));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].x, 100);
  assert.equal(mine[0].y, 200);
  assert.equal(mine[0].life, 3);
});

test('stepEmbers: negative dt is clamped to 0', () => {
  const mine = find(stepEmbers([mk()], -1, W, H, seeded(5)));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].y, 200);
  assert.equal(mine[0].life, 3);
});

test('stepEmbers: large dt is clamped to MAX_DT', () => {
  const big = find(stepEmbers([mk({ y: 250 })], 10, W, H, seeded(5)));
  const cl = find(stepEmbers([mk({ y: 250 })], MAX_DT, W, H, seeded(5)));
  assert.equal(big.length, 1);
  assert.equal(cl.length, 1);
  assert.equal(big[0].y, cl[0].y);
  assert.equal(big[0].life, cl[0].life);
});

test('stepEmbers: culls dead particles', () => {
  const out = stepEmbers([mk({ life: 0.001 })], MAX_DT, W, H, seeded(5));
  assert.equal(find(out).length, 0);
});

test('stepEmbers: culls out-of-frame particles (rose off the top)', () => {
  const out = stepEmbers([mk({ y: -50 })], 0.016, W, H, seeded(5));
  assert.equal(find(out).length, 0);
});

test('stepEmbers: tops up from empty toward cap, never exceeds it', () => {
  const rand = seeded(11);
  const cap = emberCap(W, H);
  let ps = [];
  for (let i = 0; i < 600; i++) {
    ps = stepEmbers(ps, 0.016, W, H, rand);
    assert.ok(ps.length <= cap, `count ${ps.length} > cap ${cap}`);
  }
  assert.ok(ps.length > 0, 'population established');
});

test('stepEmbers: over-cap input is not grown', () => {
  const cap = emberCap(W, H);
  const rand = seeded(2);
  const many = Array.from({ length: cap + 20 }, () => spawnEmber(W, H, rand));
  const out = stepEmbers(many, 0.016, W, H, seeded(3));
  assert.ok(out.length <= many.length);
});

test('stepEmbers: live particles have life > 0 over a long run', () => {
  const rand = seeded(21);
  let ps = [];
  for (let i = 0; i < 1000; i++) {
    ps = stepEmbers(ps, 0.016, W, H, rand);
    for (const p of ps) assert.ok(p.life > 0, `life ${p.life}`);
  }
});

test('stepEmbers: deterministic with same seed', () => {
  const run = () => {
    const rand = seeded(99);
    let ps = [];
    for (let i = 0; i < 100; i++) ps = stepEmbers(ps, 0.016, W, H, rand);
    return ps;
  };
  assert.deepEqual(run(), run());
});
