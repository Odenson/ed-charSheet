// ui/saving-overlay-state.test.js — run with `npm test`.
// Pure visibility decision for the manual-save overlay (plans/save-spinner I1). No rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showSavingOverlay } from './saving-overlay-state.js';

test('shows while a manual save is in flight', () => {
  assert.equal(showSavingOverlay({ saving: true, dismissed: false, handoff: false }), true);
});

test('hidden when not saving', () => {
  assert.equal(showSavingOverlay({ saving: false, dismissed: false, handoff: false }), false);
});

test('hidden when dismissed while saving', () => {
  assert.equal(showSavingOverlay({ saving: true, dismissed: true, handoff: false }), false);
});

test('hidden during hand-off to conflict/rename modal', () => {
  assert.equal(showSavingOverlay({ saving: true, dismissed: false, handoff: true }), false);
});

test('hidden when dismissed and hand-off both true', () => {
  assert.equal(showSavingOverlay({ saving: true, dismissed: true, handoff: true }), false);
});

test('undefined inputs coerce to hidden and return a strict boolean', () => {
  assert.equal(showSavingOverlay({}), false);
  assert.equal(showSavingOverlay({ saving: true }), true);
  assert.equal(showSavingOverlay({ saving: undefined, dismissed: undefined, handoff: undefined }), false);
});
