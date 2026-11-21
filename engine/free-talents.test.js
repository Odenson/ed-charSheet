// engine/free-talents.test.js — run with `npm test`.
// Pure derivation of a discipline's free-talent rows (plans/display-free-talents, T1).
// Rules: R1 rank = Circle, R3 each discipline at its own Circle, R5 two Standard
// Matrix rows, R6 same-discipline stored copy suppresses the free row.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freeTalentRows } from './free-talents.js';

const file = JSON.parse(readFileSync(new URL('../rules/disciplines.json', import.meta.url)));
const ref = (name) => file.disciplines.find((d) => d.name === name);

test('Archer gets Call Missile at rank = Circle for every Circle', () => {
  for (const c of [1, 2, 5, 8]) {
    const rows = freeTalentRows(ref('Archer'), c);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Call Missile');
    assert.equal(rows[0].rank, c);
    assert.equal(rows[0].free, true);
    assert.equal(rows[0].circle, 1, 'circle is the GRANTING circle');
  }
});

test('Thief gets Danger Sense at rank = Circle', () => {
  const rows = freeTalentRows(ref('Thief'), 3);
  assert.deepEqual(rows.map((r) => [r.name, r.rank, r.free]), [['Danger Sense', 3, true]]);
});

test('Nethermancer gets two separate Standard Matrix rows at rank = Circle', () => {
  const rows = freeTalentRows(ref('Nethermancer'), 4);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.name), ['Standard Matrix', 'Standard Matrix']);
  assert.deepEqual(rows.map((r) => r.rank), [4, 4]);
  assert.notEqual(rows[0], rows[1], 'distinct row objects');
});

test('each discipline uses its own Circle', () => {
  assert.equal(freeTalentRows(ref('Archer'), 6)[0].rank, 6);
  assert.equal(freeTalentRows(ref('Thief'), 2)[0].rank, 2);
});

test('same-discipline stored talent suppresses the free row; others do not', () => {
  assert.deepEqual(freeTalentRows(ref('Archer'), 3, new Set(['Call Missile'])), []);
  assert.equal(freeTalentRows(ref('Archer'), 3, new Set(['Danger Sense'])).length, 1);
  assert.deepEqual(freeTalentRows(ref('Nethermancer'), 3, new Set(['Standard Matrix'])), []);
});

test('Circle 0, null, NaN, negative, non-numeric and missing ref give no rows', () => {
  for (const c of [0, null, undefined, NaN, -1, 'x']) assert.deepEqual(freeTalentRows(ref('Archer'), c), []);
  assert.deepEqual(freeTalentRows(undefined, 3), []);
  assert.deepEqual(freeTalentRows(null, 3), []);
});

test('only circle entries <= Circle contribute; order and duplicates follow data order', () => {
  const fake = {
    circles: [
      { circle: 3, freeTalents: ['C'] },
      { circle: 1, freeTalents: ['A', 'A', 'B'] },
      { circle: 2 },
    ],
  };
  assert.deepEqual(freeTalentRows(fake, 1).map((r) => r.name), ['A', 'A', 'B']);
  const all = freeTalentRows(fake, 3);
  assert.deepEqual(all.map((r) => r.name), ['A', 'A', 'B', 'C']);
  assert.deepEqual(all.map((r) => r.circle), [1, 1, 1, 3]);
  assert.deepEqual(all.map((r) => r.rank), [3, 3, 3, 3]);
});

test('does not mutate the rule data or the stored-names set', () => {
  const before = JSON.stringify(ref('Nethermancer'));
  const names = new Set(['X']);
  freeTalentRows(ref('Nethermancer'), 5, names);
  assert.equal(JSON.stringify(ref('Nethermancer')), before);
  assert.deepEqual([...names], ['X']);
});
