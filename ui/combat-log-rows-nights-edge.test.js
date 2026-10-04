// ui/combat-log-rows-nights-edge.test.js — run with `npm test`.
// spell-nights-edge I5a/I6: the Combat log table tolerates the optional
// `bonusResult` group and the roll-less wasted-cast entry. No DOM, no rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logRowCells } from './combat-log-rows.js';
import { wastedCastLogEntry } from '../engine/spells.js';

test('wasted-cast entry: label + outcome word, dashes for the nulls, no NaN', () => {
  const c = logRowCells(wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'w1', at: 1 }));
  assert.equal(c.roll, 'Cast — Night’s Edge (wasted: no equipped weapon)');
  assert.equal(c.step, '—');
  assert.equal(c.total, '—');
  assert.deepEqual(c.outcome, { word: 'Wasted', ok: false });
  assert.ok(!/NaN|undefined|null/.test(JSON.stringify(c)));
});

test('a Damage roll with a bonus group still renders step/total and mentions the bonus total', () => {
  const entry = { label: 'Damage — Spear', step: 9, total: 20, difficulty: null, outcome: null, bonusResult: { dice: [{ sides: 4, rolls: [4, 2] }], total: 6 } };
  const c = logRowCells(entry);
  assert.equal(c.step, '9');
  assert.equal(c.total, '20');
  assert.ok(c.detail.includes('6'), `detail should record the bonus die total, got "${c.detail}"`);
  assert.ok(!/NaN|undefined/.test(c.detail));
});

test('old entries without bonusResult render exactly as before (no bonus text)', () => {
  const entry = { label: 'Damage — Spear', step: 9, total: 14, karma: { total: 3 }, mods: [{ label: 'Knocked Down', value: -3 }] };
  assert.equal(logRowCells(entry).detail, 'Karma +3 · Knocked Down −3');
  assert.equal(logRowCells({ label: 'X', step: 4, total: 5 }).detail, '');
});
