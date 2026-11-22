// ui/portrait-image.test.js — run with `npm test`.
// plans/add-char-portrait I3: pure helpers and `processImage` (decode/encode injected; no canvas in
// node). Limits are product decisions from qa-log/spec (no Earthdawn rules involved).
//
// processImage seam contract PINNED BY THIS TEST (the spec names the seams but not their shapes):
//   decode(file)                                   -> Promise<{ width, height, hasAlpha }>
//   encode(decoded, { width, height, mime, quality }) -> Promise<{ dataUrl, bytes }>   (bytes = encoded size)
//   processImage(file, { charId, now, decode, encode })  (charId is needed to build the filename)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImageFile,
  fitWithin,
  chooseOutput,
  portraitFilename,
  portraitPath,
  processImage,
} from './portrait-image.js';

test('validateImageFile: JPEG/PNG/WebP up to 10 MB are ok', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.deepEqual(validateImageFile({ type, size: 1000 }), { ok: true }, type);
    assert.deepEqual(validateImageFile({ type, size: 10 * 1024 * 1024 }), { ok: true }, `${type} at exactly 10 MB`);
  }
});

test('validateImageFile: over 10 MB is rejected with a message', () => {
  const r = validateImageFile({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 });
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, 'string');
  assert.ok(r.error.length > 0);
});

test('validateImageFile: other MIME types are rejected with a message', () => {
  for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain', '', undefined]) {
    const r = validateImageFile({ type, size: 100 });
    assert.equal(r.ok, false, String(type));
    assert.ok(r.error && r.error.length > 0);
  }
});

test('fitWithin: scales the longest side down to the max, preserving aspect', () => {
  assert.deepEqual(fitWithin(4000, 2000), { width: 1024, height: 512 });
  assert.deepEqual(fitWithin(2000, 4000), { width: 512, height: 1024 });
  assert.deepEqual(fitWithin(3000, 3000), { width: 1024, height: 1024 });
});

test('fitWithin: never upscales', () => {
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(1024, 1024), { width: 1024, height: 1024 });
  assert.deepEqual(fitWithin(1, 1), { width: 1, height: 1 });
});

test('fitWithin: rounds and never returns less than 1', () => {
  assert.deepEqual(fitWithin(3000, 1001), { width: 1024, height: 342 });
  assert.deepEqual(fitWithin(10000, 1), { width: 1024, height: 1 });
});

test('fitWithin: honors an explicit max', () => {
  assert.deepEqual(fitWithin(500, 500, 256), { width: 256, height: 256 });
  assert.deepEqual(fitWithin(2000, 1000, 768), { width: 768, height: 384 });
});

test('chooseOutput: PNG when there is alpha, else JPEG at 0.85', () => {
  const png = chooseOutput(true);
  assert.equal(png.mime, 'image/png');
  assert.equal(png.ext, 'png');
  const jpg = chooseOutput(false);
  assert.equal(jpg.mime, 'image/jpeg');
  assert.equal(jpg.ext, 'jpg');
  assert.equal(jpg.quality, 0.85);
});

test('portraitFilename / portraitPath', () => {
  assert.equal(portraitFilename('chakka', 1700000000000, 'jpg'), 'chakka-1700000000000.jpg');
  assert.equal(portraitFilename('sarn-the-bold', 1700000000123, 'png'), 'sarn-the-bold-1700000000123.png');
  assert.equal(portraitPath('chakka-1700000000000.jpg'), 'data/chakka-1700000000000.jpg');
});

// --- processImage (injected seams) --------------------------------------------------------

const FILE = { type: 'image/png', size: 5000, name: 'x.png' };
const NOW = 1700000000000;

// encode stub: records each call, returns the next scripted size.
function stubs({ width = 4000, height = 2000, hasAlpha = false, sizes = [200_000] } = {}) {
  const encodeCalls = [];
  const decodeCalls = [];
  let i = 0;
  return {
    encodeCalls,
    decodeCalls,
    decode: async (file) => {
      decodeCalls.push(file);
      return { width, height, hasAlpha };
    },
    encode: async (decoded, spec) => {
      encodeCalls.push(spec);
      const bytes = sizes[Math.min(i++, sizes.length - 1)];
      return { dataUrl: `data:${spec.mime};base64,AAAA${bytes}`, bytes };
    },
  };
}

test('processImage: no alpha -> JPEG q0.85 at <=1024, filename <charId>-<now>.jpg, fields filled', async () => {
  const s = stubs({ sizes: [123_456] });
  const out = await processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode });
  assert.equal(s.encodeCalls.length, 1);
  assert.equal(s.encodeCalls[0].mime, 'image/jpeg');
  assert.equal(s.encodeCalls[0].quality, 0.85);
  assert.equal(s.encodeCalls[0].width, 1024);
  assert.equal(s.encodeCalls[0].height, 512);
  assert.equal(out.filename, 'chakka-1700000000000.jpg');
  assert.equal(out.path, 'data/chakka-1700000000000.jpg');
  assert.equal(out.mime, 'image/jpeg');
  assert.equal(out.ext, 'jpg');
  assert.equal(out.width, 1024);
  assert.equal(out.height, 512);
  assert.equal(out.bytes, 123_456);
  assert.ok(out.dataUrl.startsWith('data:image/jpeg'));
});

test('processImage: alpha -> PNG output', async () => {
  const s = stubs({ hasAlpha: true, sizes: [300_000] });
  const out = await processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode });
  assert.equal(s.encodeCalls[0].mime, 'image/png');
  assert.equal(out.ext, 'png');
  assert.equal(out.filename, 'chakka-1700000000000.png');
});

test('processImage: never upscales a small source', async () => {
  const s = stubs({ width: 300, height: 200 });
  const out = await processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode });
  assert.equal(s.encodeCalls[0].width, 300);
  assert.equal(s.encodeCalls[0].height, 200);
  assert.equal(out.width, 300);
});

test('processImage: shrink ladder 1024 -> 768 -> 512 until the blob fits the stored cap', async () => {
  const s = stubs({ sizes: [2_000_000, 1_500_000, 900_000] });
  const out = await processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode });
  assert.deepEqual(s.encodeCalls.map((c) => c.width), [1024, 768, 512]);
  assert.deepEqual(s.encodeCalls.map((c) => c.height), [512, 384, 256]);
  assert.equal(out.width, 512);
  assert.equal(out.bytes, 900_000);
});

test('processImage: a result of exactly the cap (1,000,000) is accepted without shrinking', async () => {
  const s = stubs({ sizes: [1_000_000] });
  const out = await processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode });
  assert.equal(s.encodeCalls.length, 1);
  assert.equal(out.bytes, 1_000_000);
});

test('processImage: still over the cap at 512 -> rejects with a clear "too detailed" Error', async () => {
  const s = stubs({ sizes: [2_000_000, 1_900_000, 1_800_000] });
  await assert.rejects(
    processImage(FILE, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode }),
    (e) => e instanceof Error && /too detailed/i.test(e.message),
  );
  assert.equal(s.encodeCalls.length, 3, 'does not go below 512');
});

test('processImage: an invalid source is rejected BEFORE decode', async () => {
  const s = stubs();
  await assert.rejects(
    processImage({ type: 'image/gif', size: 100 }, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode }),
    (e) => e instanceof Error && e.message.length > 0,
  );
  await assert.rejects(
    processImage({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }, { charId: 'chakka', now: NOW, decode: s.decode, encode: s.encode }),
    (e) => e instanceof Error,
  );
  assert.equal(s.decodeCalls.length, 0);
});

test('processImage: a decode failure rejects with an Error carrying a user-facing message', async () => {
  await assert.rejects(
    processImage(FILE, {
      charId: 'chakka',
      now: NOW,
      decode: async () => { throw new Error('boom'); },
      encode: async () => ({ dataUrl: 'x', bytes: 1 }),
    }),
    (e) => e instanceof Error && e.message.length > 0,
  );
});
