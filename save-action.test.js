// save-action.test.js — run with `npm test` (node --test, no deps).
// Pins the conflict-modal → next-save-step mapping (docs/PLAN-SAVE-CONCURRENCY
// Phase C2). ed-app routes a modal choice through nextSaveAction; this test is
// the only harness for that transition logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSaveAction } from './save-action.js';

test('keep-mine → resave with the conflict sha as the acknowledged base', () => {
  assert.deepEqual(nextSaveAction({ choice: 'keep-mine', conflictSha: 'abc123' }), { action: 'resave', base: 'abc123' });
});

test('keep-mine with a missing sha → resave with base null (legacy overwrite path)', () => {
  assert.deepEqual(nextSaveAction({ choice: 'keep-mine', conflictSha: null }), { action: 'resave', base: null });
  assert.deepEqual(nextSaveAction({ choice: 'keep-mine' }), { action: 'resave', base: undefined });
});

test('take-theirs → reload the branch version (discard the local draft)', () => {
  assert.deepEqual(nextSaveAction({ choice: 'take-theirs', conflictSha: 'abc123' }), { action: 'reload' });
});

test('cancel → do nothing; the overlay stays dirty and nothing is written', () => {
  assert.deepEqual(nextSaveAction({ choice: 'cancel', conflictSha: 'abc123' }), { action: 'none' });
});

test('an unknown choice degrades to cancel (nothing happens)', () => {
  assert.deepEqual(nextSaveAction({ choice: 'keep-both' }), { action: 'none' });
  assert.deepEqual(nextSaveAction({}), { action: 'none' });
});
