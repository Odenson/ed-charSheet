// delete-action.test.js — run with `npm test`.
// plans/delete-character I3a/I4: pure `delete-action.js` — nameMatches, planDelete,
// noticeForResult. No Earthdawn rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameMatches, planDelete, noticeForResult } from './delete-action.js';

test('nameMatches: exact match, trimmed typed text, case-sensitive', () => {
  assert.equal(nameMatches('Chakka', 'Chakka'), true);
  assert.equal(nameMatches('  Chakka  ', 'Chakka'), true);
  assert.equal(nameMatches('chakka', 'Chakka'), false);
  assert.equal(nameMatches('Chakk', 'Chakka'), false);
  assert.equal(nameMatches('Chakkaa', 'Chakka'), false);
  assert.equal(nameMatches('', 'Chakka'), false);
  assert.equal(nameMatches('   ', 'Chakka'), false);
});

test('nameMatches: an empty name never matches (empty typed included)', () => {
  assert.equal(nameMatches('', ''), false);
  assert.equal(nameMatches('   ', ''), false);
  assert.equal(nameMatches('x', ''), false);
  assert.equal(nameMatches('x', undefined), false);
  assert.equal(nameMatches(undefined, 'Chakka'), false);
});

test('planDelete: a draft is a local-only plan (no network)', () => {
  assert.deepEqual(planDelete({ draft: true }), { kind: 'draft' });
  assert.equal(planDelete({ draft: true, isOpen: true, baseSha: 's', onPages: true }).kind, 'draft');
});

test('planDelete: open saved character uses baseSha', () => {
  const p = planDelete({ draft: false, isOpen: true, baseSha: 'open-sha', fileBase: 'read-sha', onPages: true });
  assert.equal(p.kind, 'server');
  assert.equal(p.body.base, 'open-sha');
});

test('planDelete: non-open saved character uses the confirm-time fileBase', () => {
  const p = planDelete({ draft: false, isOpen: false, baseSha: 'stale-open', fileBase: 'read-sha', onPages: true });
  assert.equal(p.kind, 'server');
  assert.equal(p.body.base, 'read-sha');
});

test('planDelete: null base on Pages is blocked (no_base)', () => {
  for (const args of [
    { draft: false, isOpen: true, baseSha: null, onPages: true },
    { draft: false, isOpen: false, fileBase: null, onPages: true },
  ]) {
    assert.deepEqual(planDelete(args), { kind: 'block', reason: 'no_base' });
  }
});

test('planDelete: null base off Pages (local dev) proceeds with a null/absent base', () => {
  const p = planDelete({ draft: false, isOpen: false, fileBase: null, onPages: false });
  assert.equal(p.kind, 'server');
  assert.ok(p.body.base === null || p.body.base === undefined);
});

test('planDelete: deleteImage requested -> body carries the committed portrait path; otherwise omitted', () => {
  const on = planDelete({ draft: false, isOpen: true, baseSha: 's', onPages: true, portrait: 'data/x.jpg', deleteImage: true });
  assert.equal(on.body.deleteImage, 'data/x.jpg');
  const off = planDelete({ draft: false, isOpen: true, baseSha: 's', onPages: true, portrait: 'data/x.jpg', deleteImage: false });
  assert.ok(off.body.deleteImage === undefined);
});

test('noticeForResult: every skipped-image outcome and deleted:false yields a non-empty message; key outcomes differ', () => {
  const by = {};
  for (const imageSkipped of ['shared', 'unverified', 'mismatch', 'none', 'unknown', 'error']) {
    by[imageSkipped] = noticeForResult({ deleted: true, indexUpdated: true, imageDeleted: false, imageSkipped });
    assert.ok(typeof by[imageSkipped] === 'string' && by[imageSkipped].length > 0, imageSkipped);
  }
  assert.equal(new Set([by.shared, by.unverified, by.error]).size, 3, 'shared / unverified / error differ');
  const gone = noticeForResult({ deleted: false, indexUpdated: true });
  assert.ok(typeof gone === 'string' && gone.length > 0);
});

test('noticeForResult: shared mentions another character still using the image', () => {
  assert.match(noticeForResult({ deleted: true, imageDeleted: false, imageSkipped: 'shared' }), /another character|shared/i);
});
