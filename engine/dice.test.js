// engine/dice.test.js — run with `npm test` (node --test, no deps).
// Covers the pure Earthdawn dice roller that powers the roll modal
// (ui/ed-roll-modal.js): single-die exploding rolls and step-row rolls, all
// deterministic via an injected RNG.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollDie, rollStep } from './dice.js';

// Deterministic RNG: yields the given values in order; throws if a roll needs
// more than provided (catches an unexpected/runaway explosion).
const seq = (values) => {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++];
  };
};

// --- rollDie ------------------------------------------------------------------

test('rollDie stays within 1..sides and never explodes on a non-max roll', () => {
  assert.deepEqual(rollDie(6, () => 0), [1]);
  assert.deepEqual(rollDie(20, () => 0.9), [19]);
  assert.deepEqual(rollDie(20, () => 0.499), [10]);
});

test('rollDie explodes when a die rolls its maximum', () => {
  assert.deepEqual(rollDie(6, seq([5 / 6, 0])), [6, 1]); // 6 then 1
});

test('rollDie chains multiple explosions', () => {
  assert.deepEqual(rollDie(6, seq([5 / 6, 5 / 6, 0])), [6, 6, 1]); // subtotal 13
  assert.deepEqual(rollDie(4, seq([0.75, 0.75, 0.75, 0])), [4, 4, 4, 1]);
});

// --- rollStep -----------------------------------------------------------------

const stepsFile = JSON.parse(readFileSync(new URL('../rules/steps.json', import.meta.url)));
const row = (step) => stepsFile.steps.find((s) => s.step === step);

test('rollStep rolls each die once on all-minimum rolls (no explosion)', () => {
  const r = rollStep(row(8), () => 0); // 2D6
  assert.equal(r.step, 8);
  assert.equal(r.dice, '2D6');
  assert.equal(r.groups.length, 2);
  assert.deepEqual(r.groups.map((g) => ({ label: g.label, die: g.die, rolls: g.rolls, exploded: g.exploded })), [
    { label: 'D6', die: 6, rolls: [1], exploded: false },
    { label: 'D6', die: 6, rolls: [1], exploded: false },
  ]);
  assert.equal(r.modifier, 0);
  assert.equal(r.total, 2);
});

test('rollStep adds exploded chains into the total', () => {
  const r = rollStep(row(8), seq([5 / 6, 0, 5 / 6, 0])); // two exploding D6s
  assert.deepEqual(r.groups.map((g) => g.rolls), [[6, 1], [6, 1]]);
  assert.ok(r.groups.every((g) => g.exploded));
  assert.equal(r.groups.reduce((n, g) => n + g.subtotal, 0), 14);
  assert.equal(r.total, 14);
});

test('rollStep applies the row modifier to the total', () => {
  const r = rollStep(row(1), () => 0); // D4 (-2)
  assert.equal(r.dice, 'D4 (-2)');
  assert.equal(r.modifier, -2);
  assert.equal(r.total, 1 - 2);
});

test('rollStep orders groups largest-die-first', () => {
  const r = rollStep(row(13), () => 0); // D12+D10
  assert.deepEqual(r.groups.map((g) => g.label), ['D12', 'D10']);
});

test('rollStep builds one group per die in a mixed breakdown', () => {
  const r = rollStep(row(40), () => 0); // 2D20+D12+D10+D8
  assert.deepEqual(r.groups.map((g) => g.label), ['D20', 'D20', 'D12', 'D10', 'D8']);
  assert.equal(r.total, 5); // five dice each rolling 1, no modifier
});

test('rollStep total equals sum of subtotals plus modifier across the table', () => {
  for (const step of [1, 8, 13, 20, 40]) {
    const r = rollStep(row(step), () => 0);
    const subtotals = r.groups.reduce((n, g) => n + g.subtotal, 0);
    assert.equal(r.total, subtotals + r.modifier, `step ${step}`);
  }
});

test('rollStep tolerates an empty or missing breakdown', () => {
  const empty = rollStep({ step: 1, dice: '', breakdown: {}, modifier: 0 }, () => 0);
  assert.equal(empty.groups.length, 0);
  assert.equal(empty.total, 0);
  const missing = rollStep({ step: 1, dice: '', modifier: 0 }, () => 0);
  assert.equal(missing.groups.length, 0);
  assert.equal(missing.total, 0);
});
