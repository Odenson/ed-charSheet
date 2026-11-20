// ui/kit/dirty.test.js — run with `npm test`. Pure helper; spec: plans/ui-kit-modal-migration-2/spec.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDirty } from './dirty.js';

test('equal objects are clean', () => {
  assert.equal(isDirty({ a: 'x' }, { a: 'x' }), false);
  assert.equal(isDirty({}, {}), false);
});

test('a changed value is dirty', () => {
  assert.equal(isDirty({ a: 'x' }, { a: 'y' }), true);
});

test('null, undefined and empty string are equal', () => {
  assert.equal(isDirty({ a: null }, { a: '' }), false);
  assert.equal(isDirty({ a: undefined }, { a: '' }), false);
  assert.equal(isDirty({ a: null }, { a: undefined }), false);
  assert.equal(isDirty({ a: '' }, { a: 'x' }), true);
});

test('numbers and booleans compare by their string form', () => {
  assert.equal(isDirty({ a: 5 }, { a: '5' }), false);
  assert.equal(isDirty({ a: 5 }, { a: 6 }), true);
  assert.equal(isDirty({ a: true }, { a: 'true' }), false);
  assert.equal(isDirty({ a: false }, { a: true }), true);
  assert.equal(isDirty({ a: 0 }, { a: '' }), true);
});

test('objects and arrays compare by JSON', () => {
  assert.equal(isDirty({ a: [1, 2] }, { a: [1, 2] }), false);
  assert.equal(isDirty({ a: [1, 2] }, { a: [2, 1] }), true);
  assert.equal(isDirty({ a: { k: 1 } }, { a: { k: 1 } }), false);
  assert.equal(isDirty({ a: { k: 1 } }, { a: { k: 2 } }), true);
});

test('no trimming: a trailing space is a change', () => {
  assert.equal(isDirty({ a: 'x' }, { a: 'x ' }), true);
  assert.equal(isDirty({ a: '' }, { a: ' ' }), true);
});

test('keys on either side count (union of keys)', () => {
  assert.equal(isDirty({ a: 'x' }, { a: 'x', b: 'y' }), true);
  assert.equal(isDirty({ a: 'x', b: 'y' }, { a: 'x' }), true);
  assert.equal(isDirty({ a: 'x' }, { a: 'x', b: '' }), false);
  assert.equal(isDirty({ a: 'x', b: null }, { a: 'x' }), false);
});

test('typing a change then reverting is clean; inputs are not mutated', () => {
  const snap = { date: '2026-01-01', text: 'hi' };
  const draft = { ...snap, text: 'hi there' };
  assert.equal(isDirty(snap, draft), true);
  draft.text = 'hi';
  assert.equal(isDirty(snap, draft), false);
  assert.deepEqual(snap, { date: '2026-01-01', text: 'hi' });
});
