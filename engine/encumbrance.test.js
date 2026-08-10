// engine/encumbrance.test.js — run with `npm test` (node --test, no deps).
// Covers the capacity thresholds (PG p.405) and the taxonomy-shaped effects each
// stage folds into the derived character.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encumbranceStage, encumbranceEffects, ENCUMBRANCE } from './encumbrance.js';

test('encumbranceStage: at or under capacity is clear', () => {
  assert.equal(encumbranceStage(125, 125).stage, ENCUMBRANCE.CLEAR);
  assert.equal(encumbranceStage(100, 125).stage, ENCUMBRANCE.CLEAR);
});

test('encumbranceStage: over capacity up to 150% is burdened', () => {
  assert.equal(encumbranceStage(126, 125).stage, ENCUMBRANCE.BURDENED);
  assert.equal(encumbranceStage(187.5, 125).stage, ENCUMBRANCE.BURDENED);
});

test('encumbranceStage: 150% to 200% is overburdened', () => {
  assert.equal(encumbranceStage(188, 125).stage, ENCUMBRANCE.OVERBURDENED);
  assert.equal(encumbranceStage(250, 125).stage, ENCUMBRANCE.OVERBURDENED);
});

test('encumbranceStage: beyond 200% exceeds lift capacity', () => {
  const e = encumbranceStage(251, 125);
  assert.equal(e.stage, ENCUMBRANCE.EXCESS);
  assert.equal(e.ratio, 2.008);
});

test('encumbranceStage: a missing capacity is judged clear (UI shows the placeholder)', () => {
  assert.equal(encumbranceStage(10, null).stage, ENCUMBRANCE.CLEAR);
  assert.equal(encumbranceStage(10, undefined).ratio, null);
});

test('encumbranceStage: labels read for the chip', () => {
  assert.equal(encumbranceStage(100, 125).label, 'Clear');
  assert.equal(encumbranceStage(130, 125).label, 'Burdened');
  assert.equal(encumbranceStage(200, 125).label, 'Overburdened');
  assert.equal(encumbranceStage(300, 125).label, 'Exceeds lift');
});

test('encumbranceEffects: clear produces nothing', () => {
  assert.deepEqual(encumbranceEffects(ENCUMBRANCE.CLEAR), []);
});

test('encumbranceEffects: burdened halves Movement, folds Harried −2 into the defences, and rolls −2 on Action tests', () => {
  const eff = encumbranceEffects(ENCUMBRANCE.BURDENED);
  const movement = eff.find((e) => e.target?.name === 'Movement');
  assert.equal(movement.operation, 'multiply');
  assert.equal(movement.value, 0.5);
  assert.equal(movement.measure, 'rating');

  const pd = eff.find((e) => e.type === 'defense-modifier' && e.target?.name === 'Physical');
  const md = eff.find((e) => e.type === 'defense-modifier' && e.target?.name === 'Mystic');
  assert.equal(pd.operation, 'add');
  assert.equal(pd.value, -2);
  assert.deepEqual(pd, { ...md, target: { domain: 'defense', name: 'Physical' }, summary: 'Burdened (Harried) — Physical Defense −2.' });

  // Social Defense is the gamemaster's call — surfaced, never auto-folded.
  const social = eff.find((e) => e.type === 'defense-modifier' && e.target?.name === 'Social');
  assert.equal(social.gmDiscretion, true);

  // The −2 Action-test Step penalty (Harried) rides as a roll-time test-modifier.
  const action = eff.find((e) => e.type === 'test-modifier' && e.target?.name === 'Action');
  assert.equal(action.operation, 'add');
  assert.equal(action.value, -2);
  assert.equal(action.measure, 'step');

  assert.ok(eff.every((e) => e.condition === 'always' && e.source === 'condition'), 'all condition-shaped');
});

test('encumbranceEffects: overburdened caps Movement and Physical/Mystic Defense at 2 and notes the drop requirement', () => {
  const eff = encumbranceEffects(ENCUMBRANCE.OVERBURDENED);
  for (const name of ['Movement', 'Physical', 'Mystic']) {
    const e = eff.find((x) => x.target?.name === name);
    assert.equal(e.operation, 'min', `${name} caps at 2`);
    assert.equal(e.value, 2);
  }
  const note = eff.find((e) => e.type === 'note');
  assert.match(note.summary, /drop the excess/);
});

test('encumbranceEffects: excess reuses the overburdened fold and adds the lift-test note', () => {
  const over = encumbranceEffects(ENCUMBRANCE.OVERBURDENED);
  const excess = encumbranceEffects(ENCUMBRANCE.EXCESS);
  assert.ok(excess.length > over.length, 'excess extends the overburdened penalties');
  const note = excess.filter((e) => e.type === 'note').at(-1);
  assert.match(note.summary, /Strength test/);
  assert.match(note.summary, /1 Strain per round/);
});

test('encumbranceEffects: unknown stages degrade to nothing', () => {
  assert.deepEqual(encumbranceEffects('??'), []);
});
