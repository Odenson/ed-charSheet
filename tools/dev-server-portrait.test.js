// tools/dev-server-portrait.test.js — run with `npm test` (node --test, no deps).
// plans/add-char-portrait I9: the local dev server mirrors the worker's
// POST /save-image, the index portrait rule on /save, and adds GET /list-images.
// Temp docroot, no GitHub/Cloudflare. No Earthdawn rules involved.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevServer } from './dev-server.mjs';

function makeDocroot() {
  const root = mkdtempSync(join(tmpdir(), 'ed-dev-portrait-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><ed-app></ed-app>');
  mkdirSync(join(root, 'data', 'characters'), { recursive: true });
  return root;
}

async function withServer(fn) {
  const root = makeDocroot();
  const server = createDevServer({ root });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const request = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    await fn({ request, base }, root);
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(root, { recursive: true, force: true });
  }
}

const head = (bytes, n = 64) => {
  const b = Buffer.alloc(n, 9);
  Buffer.from(bytes).copy(b, 0);
  return b;
};
const JPEG = head([0xff, 0xd8, 0xff, 0xe0]);
const PNG = head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const b = Buffer.alloc(32, 7);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  return b;
})();
const b64 = (b) => b.toString('base64');

const NAME = 'chakka-1700000000000.jpg';
const upload = (over = {}) => ({ id: 'chakka', filename: NAME, content: b64(JPEG), ...over });
const CHARACTER = (portrait, name = 'Chakka') => ({ schema: 'ed-character/1', meta: { name, portrait } });

// --- POST /save-image ------------------------------------------------------------------

test('/save-image writes the bytes to data/<filename> and returns { ok, path, sha, url }', async () => {
  await withServer(async (srv, root) => {
    const res = await srv.request('POST', '/save-image', upload());
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.path, `data/${NAME}`);
    assert.equal(typeof res.body.sha, 'string');
    assert.deepEqual(readFileSync(join(root, 'data', NAME)), JPEG);
  });
});

test('/save-image accepts PNG and WebP with matching magic bytes', async () => {
  await withServer(async (srv, root) => {
    for (const [ext, buf] of [['png', PNG], ['webp', WEBP]]) {
      const filename = `chakka-1700000000001.${ext}`;
      const res = await srv.request('POST', '/save-image', upload({ filename, content: b64(buf) }));
      assert.equal(res.status, 200, ext);
      assert.deepEqual(readFileSync(join(root, 'data', filename)), buf);
    }
  });
});

test('/save-image: identical content at an existing path -> ok (retry-safe)', async () => {
  await withServer(async (srv) => {
    assert.equal((await srv.request('POST', '/save-image', upload())).status, 200);
    const again = await srv.request('POST', '/save-image', upload());
    assert.equal(again.status, 200);
    assert.equal(again.body.ok, true);
  });
});

test('/save-image: different content at an existing path -> 409 exists; the file is not changed', async () => {
  await withServer(async (srv, root) => {
    assert.equal((await srv.request('POST', '/save-image', upload())).status, 200);
    const res = await srv.request('POST', '/save-image', upload({ content: b64(head([0xff, 0xd8, 0xff, 0xdb], 80)) }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'exists');
    assert.deepEqual(readFileSync(join(root, 'data', NAME)), JPEG);
  });
});

test('/save-image rejections write nothing', async () => {
  await withServer(async (srv, root) => {
    const cases = [
      [upload({ content: b64(PNG) }), 'invalid_image'],
      [upload({ filename: 'chakka-1700000000000.png' }), 'invalid_image'],
      [upload({ content: '!!!not base64***' }), 'invalid_image'],
      [upload({ content: b64(head([0xff, 0xd8, 0xff], 1_500_001)) }), 'too_large'],
      [upload({ filename: 'sarn-1700000000000.jpg' }), 'invalid_name'],
      [upload({ filename: '../chakka-1700000000000.jpg' }), 'invalid_name'],
      [upload({ filename: 'a/chakka-1700000000000.jpg' }), 'invalid_name'],
      [upload({ filename: 'chakka-1700000000000.gif' }), 'invalid_name'],
      [upload({ filename: 'chakka-123.jpg' }), 'invalid_name'],
    ];
    for (const [body, code] of cases) {
      const res = await srv.request('POST', '/save-image', body);
      assert.equal(res.status, code === 'invalid_image' || code === 'too_large' || code === 'invalid_name' ? 400 : res.status, JSON.stringify(res.body));
      assert.equal(res.body.ok, false);
      assert.equal(res.body.error.code, code);
    }
    const bad = await srv.request('POST', '/save-image', { id: '../x', filename: NAME, content: b64(JPEG) });
    assert.equal(bad.status, 400);
    assert.equal(existsSync(join(root, 'data', NAME)), false);
    assert.equal(existsSync(join(root, '..', 'chakka-1700000000000.jpg')), false);
  });
});

test('/save-image: size boundary - exactly 1,500,000 bytes is accepted', async () => {
  await withServer(async (srv) => {
    const res = await srv.request('POST', '/save-image', upload({ content: b64(head([0xff, 0xd8, 0xff], 1_500_000)) }));
    assert.equal(res.status, 200);
  });
});

// --- GET /list-images ------------------------------------------------------------------

test('GET /list-images returns jpg/jpeg/png/webp files directly in data/, filtering the rest', async () => {
  await withServer(async (srv, root) => {
    const d = join(root, 'data');
    for (const f of ['a.jpg', 'b.jpeg', 'c.png', 'd.webp', 'notes.txt', 'e.gif', 'custom-items.json']) writeFileSync(join(d, f), 'x');
    mkdirSync(join(d, 'sub'));
    writeFileSync(join(d, 'sub', 'nested.jpg'), 'x'); // subdir content excluded
    mkdirSync(join(d, 'folder.png')); // a directory named like an image excluded
    writeFileSync(join(d, 'characters', 'inchars.jpg'), 'x'); // data/characters/ excluded

    const res = await srv.request('GET', '/list-images');
    assert.equal(res.status, 200);
    assert.deepEqual([...res.body.images].sort(), ['a.jpg', 'b.jpeg', 'c.png', 'd.webp']);
  });
});

test('GET /list-images -> { images: [] } when data/ has no images', async () => {
  await withServer(async (srv) => {
    const res = await srv.request('GET', '/list-images');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { images: [] });
  });
});

test('GET /list-images includes an image just uploaded via /save-image', async () => {
  await withServer(async (srv) => {
    await srv.request('POST', '/save-image', upload());
    const res = await srv.request('GET', '/list-images');
    assert.ok(res.body.images.includes(NAME));
  });
});

// --- /save index portrait rule ----------------------------------------------------------

const readIndex = async (srv) => (await srv.request('GET', '/data/characters/index.json')).body;
const seed = async (srv, portrait) => {
  await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER(portrait) });
  await srv.request('POST', '/save', { id: 'sarn', character: CHARACTER('data/sarn.jpg', 'Sarn') });
};

test('/save index: a changed portrait on an existing entry updates only that portrait; name and other ids untouched', async () => {
  await withServer(async (srv) => {
    await seed(srv, 'data/old.jpg');
    const res = await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER(`data/${NAME}`, 'Renamed') });
    assert.equal(res.status, 200);
    const idx = await readIndex(srv);
    assert.deepEqual(idx.characters.chakka, { name: 'Chakka', portrait: `data/${NAME}` });
    assert.deepEqual(idx.characters.sarn, { name: 'Sarn', portrait: 'data/sarn.jpg' });
    assert.equal(idx.schema, 'ed-characters-index/1');
  });
});

test('/save index: removal (null) writes portrait: null', async () => {
  await withServer(async (srv) => {
    await seed(srv, 'data/old.jpg');
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER(null) });
    assert.deepEqual((await readIndex(srv)).characters.chakka, { name: 'Chakka', portrait: null });
  });
});

test('/save index: invalid portrait values never reach the index; the save still succeeds', async () => {
  await withServer(async (srv) => {
    await seed(srv, 'data/old.jpg');
    for (const bad of ['../data/x.jpg', 'data/sub/x.jpg', 'data/x.gif', 'other/x.jpg', 'https://evil.example/x.jpg', 5, {}, []]) {
      const res = await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER(bad) });
      assert.equal(res.status, 200, JSON.stringify(bad));
      assert.equal((await readIndex(srv)).characters.chakka.portrait, 'data/old.jpg', JSON.stringify(bad));
    }
  });
});

test('/save index: create case with an invalid portrait writes no index entry; file still saved', async () => {
  await withServer(async (srv, root) => {
    const res = await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('data/sub/x.jpg') });
    assert.equal(res.status, 200);
    assert.ok(existsSync(join(root, 'data', 'characters', 'chakka.json')));
    const idx = existsSync(join(root, 'data', 'characters', 'index.json')) ? await readIndex(srv) : { characters: {} };
    assert.equal(idx.characters?.chakka, undefined);
  });
});
