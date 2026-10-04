// engine/dice-bonus.test.js — run with `npm test` (node --test, no deps).
// spell-nights-edge I4/I5a: the pure dice-string parser and the bonus-dice
// roller. Rule: rules.md R5 (the Bonus Die explodes on its maximum, repeating,
// and is rolled as a SEPARATE group from step dice and the Karma die).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollDiceList, rollStep } from './dice.js';

// Yields the given values in order; throws if a roll needs more (catches a
// runaway or missing explosion).
const seq = (values) => {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng exhausted');
    return values[i++];
  };
};
const MAX = 0.999; // maximum face on any die
const MIN = 0; // face 1

// ---- parseDice ----

test('parseDice: "D4" is one four-sided die (optional leading count)', () => {
  assert.deepEqual(parseDice('D4'), [{ count: 1, sides: 4 }]);
});

test('parseDice: "2D6" is a count of two six-sided dice', () => {
  assert.deepEqual(parseDice('2D6'), [{ count: 2, sides: 6 }]);
});

test('parseDice: "D4+D6" joins groups with +', () => {
  assert.deepEqual(parseDice('D4+D6'), [{ count: 1, sides: 4 }, { count: 1, sides: 6 }]);
  assert.deepEqual(parseDice('2D8+D20'), [{ count: 2, sides: 8 }, { count: 1, sides: 20 }]);
});

test('parseDice: every engine die size parses', () => {
  for (const s of [4, 6, 8, 10, 12, 20]) assert.deepEqual(parseDice(`D${s}`), [{ count: 1, sides: s }]);
});

test('parseDice: junk returns null (never throws, never NaN)', () => {
  for (const junk of ['', 'banana', 'D7', 'D', '2D', 'D4+', '+D4', 'D4++D6', 'D4 D6', 'D100', '4', 'D4-D6', null, undefined, 4, {}, []]) {
    assert.equal(parseDice(junk), null, `junk ${JSON.stringify(junk)}`);
  }
});

// ---- rollDiceList ----

test('rollDiceList: a D4 that rolls 4 explodes into another D4, repeating (R5)', () => {
  const r = rollDiceList(parseDice('D4'), seq([MAX, MAX, MIN]));
  assert.equal(r.total, 4 + 4 + 1);
  assert.equal(r.dice.length, 1);
  assert.equal(r.dice[0].sides, 4);
  assert.deepEqual(r.dice[0].rolls, [4, 4, 1]);
});

test('rollDiceList: a non-maximum roll does not explode (R5)', () => {
  const r = rollDiceList(parseDice('D4'), seq([0.5])); // face 3
  assert.equal(r.total, 3);
  assert.deepEqual(r.dice[0].rolls, [3]);
});

test('rollDiceList: each die of a count explodes independently', () => {
  // 2D6: first die 6 then 1; second die 4.
  const r = rollDiceList(parseDice('2D6'), seq([MAX, MIN, 3 / 6]));
  assert.equal(r.dice.length, 2);
  assert.deepEqual(r.dice[0].rolls, [6, 1]);
  assert.deepEqual(r.dice[1].rolls, [4]);
  assert.equal(r.total, 6 + 1 + 4);
});

test('rollDiceList: multiple groups total together; empty list is a zero group', () => {
  const r = rollDiceList(parseDice('D4+D6'), seq([0.5, 0.5])); // 3 + 4
  assert.equal(r.total, 3 + 4);
  assert.deepEqual(rollDiceList([], seq([])), { dice: [], total: 0 });
});

test('rollDiceList is a separate group: it does not alter or consume the step dice result', () => {
  const stepRow = { step: 4, dice: 'D6', breakdown: { D6: 1 }, modifier: 0 };
  const step = rollStep(stepRow, seq([0.5])); // face 4
  const bonus = rollDiceList(parseDice('D4'), seq([MAX, MIN]));
  assert.equal(step.total, 4, 'step dice total is untouched by the bonus group');
  assert.equal(bonus.total, 5);
});
