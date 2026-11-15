// store-traits.test.js — run with `npm test` (node --test, no deps).
// Covers the edit-gahad-trigger store slice: the `traits` overlay category
// (save / apply / pending / reconcile) and the pure helpers applyGahadTrigger
// and gahadTriggerChanged. Gahad trigger is free-text, no mechanical effect
// (rules.md R1); editable at any time, single trigger scope (R2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveTraitsEdits, hasPendingEdits, reconcileOverlay, applyEdits, applyGahadTrigger, gahadTriggerChanged } from './store.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

const GAHAD = { type: 'ability', name: 'Gahad' };
const trig = (extra = {}) => ({ name: 'Gahad - Cats', type: 'trigger', relatedTo: { ...GAHAD }, ...extra });
const other = () => ({ name: 'Scar', type: 'quirk', relatedTo: { type: 'ability', name: 'Other' } });
const baseChar = () => ({ schema: 'ed-character/2', meta: { name: 'Kolon', race: 'Ork' }, items: [], traits: [] });

// --- overlay ------------------------------------------------------------------

test('saveTraitsEdits stores whole array; applyEdits yields it', () => {
  memory.clear();
  const traits = [trig({ summary: 'Hates cats' }), other()];
  const edits = saveTraitsEdits(traits, 't1');
  assert.deepEqual(edits.traits, traits);
  const next = applyEdits(baseChar(), edits);
  assert.deepEqual(next.traits, traits);
  assert.equal(next.meta.name, 'Kolon');
});

test('traits overlay is pending until reconcileOverlay clears it', () => {
  memory.clear();
  assert.equal(hasPendingEdits('t2'), false);
  saveTraitsEdits([trig()], 't2');
  assert.equal(hasPendingEdits('t2'), true);
  reconcileOverlay(undefined, 't2');
  assert.equal(hasPendingEdits('t2'), false);
});

test('an empty traits array is still an applied overlay (removal persists)', () => {
  memory.clear();
  const edits = saveTraitsEdits([], 't3');
  const char = { ...baseChar(), traits: [trig({ summary: 'x' })] };
  assert.deepEqual(applyEdits(char, edits).traits, []);
  assert.equal(hasPendingEdits('t3'), true);
});

// --- applyGahadTrigger --------------------------------------------------------

test('update: replaces summary/description, preserves name, type, relatedTo', () => {
  const out = applyGahadTrigger([trig({ summary: 'old' })], { summary: 'New', description: 'Long text' });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Gahad - Cats');
  assert.equal(out[0].type, 'trigger');
  assert.deepEqual(out[0].relatedTo, GAHAD);
  assert.equal(out[0].summary, 'New');
  assert.equal(out[0].description, 'Long text');
});

test('update: preserves other keys on the trait', () => {
  const out = applyGahadTrigger([trig({ summary: 'a', note: 'keep' })], { summary: 'b', description: '' });
  assert.equal(out[0].note, 'keep');
});

test('update: inputs are trimmed', () => {
  const out = applyGahadTrigger([trig()], { summary: '  S  ', description: '\n D \n' });
  assert.equal(out[0].summary, 'S');
  assert.equal(out[0].description, 'D');
});

test('update: blank keys are omitted, never ""', () => {
  const out = applyGahadTrigger([trig({ summary: 'old', description: 'old d' })], { summary: 'only', description: '   ' });
  assert.equal(out[0].summary, 'only');
  assert.equal('description' in out[0], false);
  const out2 = applyGahadTrigger([trig({ summary: 'old' })], { summary: '', description: 'd' });
  assert.equal('summary' in out2[0], false);
  assert.equal(out2[0].description, 'd');
});

test('update: undefined fields are treated as blank', () => {
  const out = applyGahadTrigger([trig({ summary: 'old' })], { description: 'd' });
  assert.equal('summary' in out[0], false);
  assert.equal(out[0].description, 'd');
});

test('create: no trigger + non-blank appends default "Gahad trigger"', () => {
  const out = applyGahadTrigger([other()], { summary: 'Loud noises', description: '' });
  assert.equal(out.length, 2);
  assert.deepEqual(out[1], { name: 'Gahad trigger', type: 'trigger', relatedTo: GAHAD, summary: 'Loud noises' });
  assert.deepEqual(out[0], other());
});

test('create: from empty array, description only', () => {
  const out = applyGahadTrigger([], { summary: '', description: 'Detail' });
  assert.deepEqual(out, [{ name: 'Gahad trigger', type: 'trigger', relatedTo: GAHAD, description: 'Detail' }]);
});

test('remove: both blank removes only the matching trigger', () => {
  const a = other();
  const b = { ...other(), name: 'Another' };
  const out = applyGahadTrigger([a, trig({ summary: 'x' }), b], { summary: ' ', description: '' });
  assert.deepEqual(out, [a, b]);
});

test('both blank with no trigger creates nothing and returns an equal copy', () => {
  const input = [other()];
  const out = applyGahadTrigger(input, { summary: '', description: '  ' });
  assert.deepEqual(out, input);
  assert.notEqual(out, input);
  assert.deepEqual(applyGahadTrigger([], { summary: '', description: '' }), []);
});

test('non-Gahad traits and non-trigger traits linked to Gahad are never touched', () => {
  const linkedOther = { name: 'Gahad quirk', type: 'quirk', relatedTo: { ...GAHAD }, summary: 'q' };
  const input = [other(), linkedOther];
  const out = applyGahadTrigger(input, { summary: 'New', description: '' });
  assert.equal(out.length, 3); // none matched, so a new one is appended
  assert.deepEqual(out[0], other());
  assert.deepEqual(out[1], linkedOther);
  assert.equal(out[2].name, 'Gahad trigger');
  const removed = applyGahadTrigger([linkedOther, trig({ summary: 'x' })], { summary: '', description: '' });
  assert.deepEqual(removed, [linkedOther]);
});

test('a trigger linked to a different ability is not matched', () => {
  const t = { name: 'Other trig', type: 'trigger', relatedTo: { type: 'ability', name: 'Elsewhere' }, summary: 'z' };
  const out = applyGahadTrigger([t], { summary: 'g', description: '' });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], t);
});

test('multiple Gahad triggers: only the first is edited; order preserved', () => {
  const t1 = trig({ summary: 'one' });
  const t2 = { ...trig({ summary: 'two' }), name: 'Second' };
  const out = applyGahadTrigger([other(), t1, t2], { summary: 'edited', description: '' });
  assert.equal(out.length, 3);
  assert.equal(out[1].summary, 'edited');
  assert.deepEqual(out[2], t2);
  const removed = applyGahadTrigger([t1, t2], { summary: '', description: '' });
  assert.deepEqual(removed, [t2]);
});

test('does not mutate input array or trait objects', () => {
  const t = trig({ summary: 'old', description: 'od' });
  const input = [t, other()];
  const snapshot = JSON.parse(JSON.stringify(input));
  applyGahadTrigger(input, { summary: 'new', description: '' });
  applyGahadTrigger(input, { summary: '', description: '' });
  applyGahadTrigger(input, { summary: 'a', description: 'b' });
  assert.deepEqual(input, snapshot);
  assert.equal(input[0], t);
  const noMatch = [other()];
  const snap2 = JSON.parse(JSON.stringify(noMatch));
  applyGahadTrigger(noMatch, { summary: 'x', description: '' });
  assert.deepEqual(noMatch, snap2);
});

// --- gahadTriggerChanged ------------------------------------------------------

test('gahadTriggerChanged: identical is unchanged', () => {
  assert.equal(gahadTriggerChanged({ summary: 'a', description: 'b' }, { summary: 'a', description: 'b' }), false);
});

test('gahadTriggerChanged: whitespace-only difference is unchanged (both sides trimmed)', () => {
  assert.equal(gahadTriggerChanged({ summary: 'a', description: 'b' }, { summary: ' a ', description: 'b\n' }), false);
  assert.equal(gahadTriggerChanged({ summary: ' a ', description: 'b' }, { summary: 'a', description: ' b' }), false);
});

test('gahadTriggerChanged: undefined vs "" is unchanged', () => {
  assert.equal(gahadTriggerChanged({}, { summary: '', description: '' }), false);
  assert.equal(gahadTriggerChanged({ summary: 'a' }, { summary: 'a', description: '' }), false);
  assert.equal(gahadTriggerChanged({ summary: 'a', description: 'b' }, { summary: 'a' }), true);
});

test('gahadTriggerChanged: null prefill with blank inputs is unchanged', () => {
  assert.equal(gahadTriggerChanged(null, { summary: '', description: '' }), false);
  assert.equal(gahadTriggerChanged(null, { summary: '  ', description: '' }), false);
  assert.equal(gahadTriggerChanged(undefined, { summary: '', description: '' }), false);
});

test('gahadTriggerChanged: real changes are detected', () => {
  assert.equal(gahadTriggerChanged({ summary: 'a', description: 'b' }, { summary: 'a2', description: 'b' }), true);
  assert.equal(gahadTriggerChanged({ summary: 'a', description: 'b' }, { summary: 'a', description: 'c' }), true);
  assert.equal(gahadTriggerChanged(null, { summary: 'new', description: '' }), true);
  assert.equal(gahadTriggerChanged({ summary: 'a' }, { summary: '', description: '' }), true);
});
