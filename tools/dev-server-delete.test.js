// tools/dev-server-delete.test.js — run with `npm test` (node --test, no deps).
// plans/delete-character I2: the local dev server mirrors the worker's
// POST /delete-character. Temp docroot; no GitHub. `base` may be omitted or null
// (shape-checked only when supplied); no stale detection. No Earthdawn rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevServer } from './dev-server.mjs';

const IMG = 'data/chakka-1700000000000.jpg';
const OTHER_IMG = 'data/sarn-1700000000000.jpg';
const charFile = (name, portrait = null) => JSON.stringify({ schema: 'ed-character/2', meta: { name, portrait } }, null, 2);
const indexFile = (characters) => JSON.stringify({ schema: 'ed-characters-index/1', characters }, null, 2);

function makeDocroot(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ed-dev-delete-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><ed-app></ed-app>');
  mkdirSync(join(root, 'data', 'characters'), { recursive: true });
  const files = {
    'data/characters/chakka.json': charFile('Chakka', IMG),
    'data/characters/sarn.json': charFile('Sarn', OTHER_IMG),
    'data/characters/index.json': indexFile({ chakka: { name: 'Chakka', portrait: IMG }, sarn: { name: 'Sarn', portrait: OTHER_IMG } }),
    [IMG]: 'IMG',
    [OTHER_IMG]: 'SARNIMG',
    ...extra,
  };
  for (const [p, text] of Object.entries(files)) {
    if (text === null) continue;
    writeFileSync(join(root, p), text);
  }
  return root;
}

async function withServer(fn, extra) {
  const root = makeDocroot(extra);
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

const exists = (root, p) => existsSync(join(root, p));
const readIdx = (root) => JSON.parse(readFileSync(join(root, 'data/characters/index.json'), 'utf8'));
const post = (srv, body) => srv.request('POST', '/delete-character', body);

test('deletes the character file and its index row; other files untouched', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.equal(res.body.deleted, true);
    assert.equal(res.body.indexUpdated, true);
    assert.equal(exists(root, 'data/characters/chakka.json'), false);
    assert.deepEqual(Object.keys(readIdx(root).characters), ['sarn']);
    assert.ok(exists(root, 'data/characters/sarn.json') && exists(root, IMG));
  });
});

test('base omitted, null, or any string is accepted (no stale detection)', async () => {
  for (const body of [{ id: 'chakka' }, { id: 'chakka', base: null }, { id: 'chakka', base: 'some-old-sha' }]) {
    await withServer(async (srv, root) => {
      const res = await post(srv, body);
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(exists(root, 'data/characters/chakka.json'), false);
    });
  }
});

test('a non-string base (number/object) -> 400 invalid_base, nothing deleted', async () => {
  await withServer(async (srv, root) => {
    for (const base of [5, {}, []]) {
      const res = await post(srv, { id: 'chakka', base });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'invalid_base');
    }
    assert.ok(exists(root, 'data/characters/chakka.json'));
  });
});

test('invalid id -> 400 invalid_id, nothing deleted', async () => {
  await withServer(async (srv, root) => {
    for (const id of [undefined, null, '', '../x', 'Chakka', 'a/b', 5, 'a'.repeat(65)]) {
      const res = await post(srv, { id });
      assert.equal(res.status, 400, String(id));
      assert.equal(res.body.error.code, 'invalid_id');
    }
    assert.ok(exists(root, 'data/characters/chakka.json') && exists(root, 'data/characters/sarn.json'));
  });
});

test('invalid deleteImage -> 400 invalid_image, nothing deleted', async () => {
  await withServer(async (srv, root) => {
    for (const deleteImage of [null, 5, {}, '', '../data/x.jpg', 'data/../x.jpg', 'data/sub/x.jpg', 'data/x.gif', 'other/x.jpg', '/data/x.jpg', 'data/characters/chakka.json']) {
      const res = await post(srv, { id: 'chakka', deleteImage });
      assert.equal(res.status, 400, JSON.stringify(deleteImage));
      assert.equal(res.body.error.code, 'invalid_image');
    }
    assert.ok(exists(root, 'data/characters/chakka.json') && exists(root, IMG));
  });
});

test('non-JSON body -> 400, nothing deleted', async () => {
  await withServer(async (srv, root) => {
    const res = await fetch(`${srv.base}/delete-character`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json{' });
    assert.equal(res.status, 400);
    assert.ok(exists(root, 'data/characters/chakka.json'));
  });
});

test('missing file is idempotent: ok, deleted:false, stale index row still removed', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'ghost' });
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, false);
  });
  await withServer(async (srv, root) => {
    rmSync(join(root, 'data/characters/chakka.json'));
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.deleted, false);
    assert.equal(res.body.imageSkipped, 'unknown');
    assert.deepEqual(Object.keys(readIdx(root).characters), ['sarn']);
    assert.ok(exists(root, IMG));
  });
});

test('absent index file is a no-op', async () => {
  await withServer(async (srv, root) => {
    rmSync(join(root, 'data/characters/index.json'));
    const res = await post(srv, { id: 'chakka' });
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal(exists(root, 'data/characters/index.json'), false);
  });
});

test('image: requested, equals meta.portrait, unshared -> image deleted', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.status, 200);
    assert.equal(res.body.imageDeleted, true);
    assert.equal(exists(root, IMG), false);
    assert.ok(exists(root, OTHER_IMG));
  });
});

test('image: not requested -> image kept', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka' });
    assert.ok(!res.body.imageDeleted);
    assert.ok(exists(root, IMG));
  });
});

test('image: differs from meta.portrait (incl. catalog image) -> mismatch, image kept, character deleted', async () => {
  for (const other of [OTHER_IMG, 'data/catalog.png']) {
    await withServer(async (srv, root) => {
      const res = await post(srv, { id: 'chakka', deleteImage: other });
      assert.equal(res.status, 200);
      assert.equal(res.body.deleted, true);
      assert.equal(res.body.imageSkipped, 'mismatch');
      assert.ok(exists(root, other));
      assert.ok(exists(root, IMG));
      assert.equal(exists(root, 'data/characters/chakka.json'), false);
    }, { 'data/catalog.png': 'CAT' });
  }
});

test('image: file without meta.portrait -> imageSkipped:none', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.body.imageSkipped, 'none');
    assert.ok(exists(root, IMG));
  }, { 'data/characters/chakka.json': charFile('Chakka', null) });
});

test('image: shared with another character FILE (index row missing) -> shared, image kept', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal(res.body.imageSkipped, 'shared');
    assert.ok(exists(root, IMG));
  }, {
    'data/characters/sarn.json': charFile('Sarn', IMG),
    'data/characters/index.json': indexFile({ chakka: { name: 'Chakka', portrait: IMG } }),
  });
});

test('image: another character file unparseable -> unverified, image kept, character deleted', async () => {
  await withServer(async (srv, root) => {
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal(res.body.imageSkipped, 'unverified');
    assert.ok(exists(root, IMG));
  }, { 'data/characters/sarn.json': '{ not json' });
});

test('image: already gone on disk counts as imageDeleted:true', async () => {
  await withServer(async (srv, root) => {
    rmSync(join(root, IMG));
    const res = await post(srv, { id: 'chakka', deleteImage: IMG });
    assert.equal(res.status, 200);
    assert.equal(res.body.imageDeleted, true);
  });
});

test('GET /delete-character is not a route; unknown POST 404 text names /delete-character', async () => {
  await withServer(async (srv) => {
    const unknown = await srv.request('POST', '/nope', {});
    assert.equal(unknown.status, 404);
    assert.match(JSON.stringify(unknown.body), /delete-character/);
  });
});
