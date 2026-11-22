// ui/portrait-modal-state.test.js — run with `npm test`.
// plans/add-char-portrait I6: the pure selection-state helpers behind ui/ed-edit-portrait.js.
// No Earthdawn rules involved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectExisting, selectNew, selectRemove, isDirty, toDetail } from './portrait-modal-state.js';

const PROCESSED = {
  path: 'data/chakka-1700000000000.jpg',
  filename: 'chakka-1700000000000.jpg',
  mime: 'image/jpeg',
  ext: 'jpg',
  dataUrl: 'data:image/jpeg;base64,AAAA',
  width: 10,
  height: 10,
  bytes: 3,
};

test('selection constructors build the documented shapes', () => {
  assert.deepEqual(selectExisting('data/a.jpg'), { kind: 'existing', path: 'data/a.jpg' });
  assert.deepEqual(selectNew(PROCESSED), { kind: 'new', processed: PROCESSED });
  assert.deepEqual(selectRemove(), { kind: 'remove' });
});

test('isDirty: no selection is clean', () => {
  assert.equal(isDirty('data/a.jpg', null), false);
  assert.equal(isDirty(null, null), false);
});

test('isDirty: choosing a different existing image is dirty; re-choosing the current one is clean', () => {
  assert.equal(isDirty('data/a.jpg', selectExisting('data/b.jpg')), true);
  assert.equal(isDirty('data/a.jpg', selectExisting('data/a.jpg')), false);
  assert.equal(isDirty(null, selectExisting('data/a.jpg')), true);
});

test('isDirty: a new upload is dirty; removing an existing portrait is dirty', () => {
  assert.equal(isDirty('data/a.jpg', selectNew(PROCESSED)), true);
  assert.equal(isDirty(null, selectNew(PROCESSED)), true);
  assert.equal(isDirty('data/a.jpg', selectRemove()), true);
});

test('toDetail: existing -> { portrait: path } with no staged payload', () => {
  const d = toDetail(selectExisting('data/a.jpg'));
  assert.equal(d.portrait, 'data/a.jpg');
  assert.ok(!('staged' in d) || d.staged == null);
});

test('toDetail: new -> { portrait: path, staged: { path, mime, dataUrl } }', () => {
  assert.deepEqual(toDetail(selectNew(PROCESSED)), {
    portrait: PROCESSED.path,
    staged: { path: PROCESSED.path, mime: PROCESSED.mime, dataUrl: PROCESSED.dataUrl },
  });
});

test('toDetail: remove -> { portrait: null } with no staged payload', () => {
  const d = toDetail(selectRemove());
  assert.equal(d.portrait, null);
  assert.ok(!('staged' in d) || d.staged == null);
});
