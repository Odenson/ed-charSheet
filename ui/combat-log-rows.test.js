// ui/combat-log-rows.test.js — run with `npm test` (node --test, no deps).
// Pins the roll-log entry -> table-cell mapping for the Combat tab's log table.
// UI mapping only (no Earthdawn rule). No DOM, no Lit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logRowCells } from './combat-log-rows.js';

test('system row with detail, legend, silver and coin', () => {
  const c = logRowCells({ kind: 'system', label: 'Advance', detail: 'Rank up', legendCost: 200, silverFee: 5, coinDelta: '-5 sp' });
  assert.deepEqual(c, {
    glyph: '✦', roll: 'Advance', step: '—', total: '—', vs: '—', outcome: null,
    detail: 'Rank up · 200 Legend · 5 sp · -5 sp',
  });
});

test('log and advancement kinds map like system', () => {
  for (const kind of ['log', 'advancement']) {
    const c = logRowCells({ kind, label: 'L', detail: 'd' });
    assert.equal(c.glyph, '✦');
    assert.equal(c.detail, 'd');
    assert.equal(c.outcome, null);
  }
});

test('system row without detail has no stray separator', () => {
  const c = logRowCells({ kind: 'system', label: 'X', legendCost: 100, silverFee: 3 });
  assert.equal(c.detail, '100 Legend · 3 sp');
  assert.ok(!c.detail.startsWith(' ') && !c.detail.endsWith(' ') && !c.detail.startsWith('·'));
});

test('system row with nothing extra has empty detail', () => {
  assert.equal(logRowCells({ kind: 'system', label: 'X' }).detail, '');
});

test('silverFee 0 omitted, legendCost 0 shown', () => {
  const c = logRowCells({ kind: 'system', label: 'X', legendCost: 0, silverFee: 0 });
  assert.equal(c.detail, '0 Legend');
});

test('system row missing label defaults to System', () => {
  assert.equal(logRowCells({ kind: 'system' }).roll, 'System');
});

test('action row', () => {
  assert.deepEqual(logRowCells({ kind: 'action', label: 'Stand up' }), {
    glyph: '↑', roll: 'Stand up', step: '—', total: '—', vs: '—', outcome: null, detail: '',
  });
});

test('action row missing label defaults to Action', () => {
  assert.equal(logRowCells({ kind: 'action' }).roll, 'Action');
});

test('roll row with full data', () => {
  const c = logRowCells({
    kind: 'roll', label: 'Attack', step: 7, total: 14, difficulty: 9,
    outcome: { word: 'Hit', ok: true }, mods: [{ label: 'Knocked Down', value: -3 }, { label: 'Aimed', value: 2 }], karma: { step: 4, dice: [3], total: 4 },
  });
  assert.equal(c.glyph, '⚔');
  assert.equal(c.roll, 'Attack');
  assert.equal(c.step, '7');
  assert.equal(c.total, '14');
  assert.equal(c.vs, '9');
  assert.deepEqual(c.outcome, { word: 'Hit', ok: true });
  assert.equal(c.detail, 'Karma +4 · Knocked Down −3 · Aimed +2');
});

test('roll row without difficulty, outcome or mods', () => {
  const c = logRowCells({ label: 'Spellcasting', step: 5, total: 11 });
  assert.equal(c.vs, '—');
  assert.equal(c.outcome, null);
  assert.equal(c.detail, '');
  assert.equal(c.glyph, '⚄');
});

test('roll row difficulty 0 still shows (!= null)', () => {
  assert.equal(logRowCells({ label: 'R', difficulty: 0 }).vs, '0');
});

test('detail: modifier without a value shows its label alone; karma alone; zero karma shown', () => {
  assert.equal(logRowCells({ label: 'R', mods: [{ label: 'Aimed' }] }).detail, 'Aimed');
  assert.equal(logRowCells({ label: 'R', karma: { total: 5 } }).detail, 'Karma +5');
  assert.equal(logRowCells({ label: 'R', karma: { total: 0 } }).detail, 'Karma +0');
  assert.equal(logRowCells({ label: 'R', karma: null, mods: [] }).detail, '');
});

test('roll row missing step, total and label never fabricates numbers', () => {
  const c = logRowCells({ kind: 'roll' });
  assert.equal(c.roll, 'Roll');
  assert.equal(c.step, '—');
  assert.equal(c.total, '—');
});

test('glyph is crossed swords for attack/damage labels (case-insensitive), dice otherwise', () => {
  assert.equal(logRowCells({ label: 'Attack' }).glyph, '⚔');
  assert.equal(logRowCells({ label: 'Damage' }).glyph, '⚔');
  assert.equal(logRowCells({ label: 'Sword DAMAGE roll' }).glyph, '⚔');
  assert.equal(logRowCells({ label: 'Initiative' }).glyph, '⚄');
  assert.equal(logRowCells({}).glyph, '⚄');
});

test('miss outcome preserved', () => {
  assert.deepEqual(logRowCells({ label: 'Attack', outcome: { word: 'Miss', ok: false } }).outcome, { word: 'Miss', ok: false });
});
