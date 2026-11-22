// store-portrait-save.test.js — run with `npm test`.
// plans/add-char-portrait I5: `runPortraitSave` (store-portrait.js), the pinned save-ordering seam.
// No Earthdawn rules involved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPortraitSave } from './store-portrait.js';

const STAGED = { path: 'data/chakka-1700000000000.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' };

function harness({ uploadThrows, postThrows } = {}) {
  const log = [];
  return {
    log,
    args: {
      id: 'chakka',
      uploadImage: async (s) => {
        log.push(['upload', s]);
        if (uploadThrows) throw uploadThrows;
      },
      postCharacter: async () => {
        log.push(['post']);
        if (postThrows) throw postThrows;
        return 'posted';
      },
      clearStaged: (id) => log.push(['clear', id]),
    },
  };
}
const names = (log) => log.map((e) => e[0]);

test('staged + matching path: upload, then post, then clear (in that order); returns { skipped:false, result }', async () => {
  const h = harness();
  const out = await runPortraitSave({ ...h.args, portrait: STAGED.path, staged: STAGED, keepalive: false });
  assert.deepEqual(names(h.log), ['upload', 'post', 'clear']);
  assert.deepEqual(h.log[0][1], STAGED);
  assert.equal(h.log[2][1], 'chakka');
  assert.deepEqual(out, { skipped: false, result: 'posted' });
});

test('upload failure propagates; postCharacter is NOT called; staged is kept (no clear)', async () => {
  const boom = new Error('upload failed');
  const h = harness({ uploadThrows: boom });
  await assert.rejects(runPortraitSave({ ...h.args, portrait: STAGED.path, staged: STAGED, keepalive: false }), (e) => e === boom);
  assert.deepEqual(names(h.log), ['upload']);
});

test('postCharacter failure propagates and the staged image is kept (no clear)', async () => {
  const boom = new Error('post failed');
  const h = harness({ postThrows: boom });
  await assert.rejects(runPortraitSave({ ...h.args, portrait: STAGED.path, staged: STAGED, keepalive: false }), (e) => e === boom);
  assert.deepEqual(names(h.log), ['upload', 'post']);
});

test('keepalive with a staged image: returns { skipped:true } and makes NO calls at all', async () => {
  const h = harness();
  const out = await runPortraitSave({ ...h.args, portrait: STAGED.path, staged: STAGED, keepalive: true });
  assert.deepEqual(out, { skipped: true });
  assert.deepEqual(h.log, []);
});

test('keepalive with a staged image whose path mismatches still skips (staged takes precedence) with no calls', async () => {
  const h = harness();
  const out = await runPortraitSave({ ...h.args, portrait: 'data/other.jpg', staged: STAGED, keepalive: true });
  assert.deepEqual(out, { skipped: true });
  assert.deepEqual(h.log, []);
});

test('staged path mismatch: clears the stale staged image WITHOUT uploading, then posts', async () => {
  for (const portrait of ['data/other.jpg', null]) {
    const h = harness();
    const out = await runPortraitSave({ ...h.args, portrait, staged: STAGED, keepalive: false });
    assert.ok(!names(h.log).includes('upload'), String(portrait));
    assert.deepEqual(names(h.log).sort(), ['clear', 'post']);
    assert.deepEqual(out, { skipped: false, result: 'posted' });
  }
});

test('no staged image: just posts (no upload, no clear), keepalive or not', async () => {
  for (const keepalive of [false, true]) {
    const h = harness();
    const out = await runPortraitSave({ ...h.args, portrait: 'data/a.jpg', staged: null, keepalive });
    assert.deepEqual(names(h.log), ['post'], `keepalive=${keepalive}`);
    assert.deepEqual(out, { skipped: false, result: 'posted' });
  }
});

test('post failure with a mismatched staged image: error propagates (clear already happened, no upload)', async () => {
  const boom = new Error('post failed');
  const h = harness({ postThrows: boom });
  await assert.rejects(runPortraitSave({ ...h.args, portrait: null, staged: STAGED, keepalive: false }), (e) => e === boom);
  assert.ok(!names(h.log).includes('upload'));
});
