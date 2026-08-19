// tools/dev-server.test.js — run with `npm test` (node --test, no deps).
// Covers the file-backed local dev server (tools/dev-server.mjs): static
// serving (MIME, traversal, the /dev symlink) and the two save routes
// (/save upsert, /save-items merge+delete) mirroring the worker's validation
// and error codes, against a temp docroot with no GitHub/Cloudflare in sight.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevServer } from './dev-server.mjs';

const LANTERN = { kind: 'gear', effects: [{ type: 'note', summary: 'A lantern.' }] };
const CHARACTER = (name, extra = {}) => ({ schema: 'ed-character/1', meta: { name, ...extra } });

function makeDocroot() {
  const root = mkdtempSync(join(tmpdir(), 'ed-dev-server-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><ed-app></ed-app>');
  mkdirSync(join(root, 'ui'), { recursive: true });
  writeFileSync(join(root, 'ui', 'ed-app.js'), 'export const x = 1;');
  // Mirror the repo's /dev self-symlink (README → Simulating the dev instance).
  symlinkSync(root, join(root, 'dev'), 'dir');
  return root;
}

async function boot({ root, lag } = {}) {
  const server = createDevServer({ root, lag });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  return {
    base,
    request: async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, type: res.headers.get('content-type'), body: await res.json().catch(() => null) };
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

async function withServer(fn, opts = {}) {
  const root = makeDocroot();
  const srv = await boot({ root, ...opts });
  try {
    await fn(srv, root);
  } finally {
    await srv.close();
    rmSync(root, { recursive: true, force: true });
  }
}

// --- static serving -----------------------------------------------------------

test('static serving returns files with correct content types', async () => {
  await withServer(async (srv) => {
    const index = await fetch(srv.base + '/');
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.match(await index.text(), /<ed-app>/);

    const js = await fetch(srv.base + '/ui/ed-app.js');
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /text\/javascript/);
    assert.match(await js.text(), /export const x/);
  });
});

test('the /dev self-symlink serves the same app (DEV-pill simulation)', async () => {
  await withServer(async (srv) => {
    const dev = await fetch(srv.base + '/dev/');
    assert.equal(dev.status, 200);
    assert.match(await dev.text(), /<ed-app>/);
  });
});

test('path traversal is rejected — the docroot is never escaped', async () => {
  await withServer(async (srv) => {
    // Note: WHATWG URL parsing already collapses some encoded dots (`/%2e%2e/`
    // → `/`), so a 404 there is fine too — the guarantee is that host files are
    // never served and `/etc/passwd`-style leaks never get through.
    for (const path of ['/..%2F..%2Fetc%2Fpasswd', '/%2e%2e/package.json', '/dev/..%2F..%2Fetc%2Fpasswd']) {
      const res = await fetch(srv.base + path);
      assert.ok([403, 404].includes(res.status), `traversal ${path} → 403/404, got ${res.status}`);
      const text = await res.text();
      assert.ok(!/root:/i.test(text), `traversal ${path} must not leak host content`);
    }
    assert.equal((await fetch(srv.base + '/missing-file.json')).status, 404);
  });
});

// --- POST /save ---------------------------------------------------------------

test('/save writes the raw ed-character/1 file and indexes it; both read back', async () => {
  await withServer(async (srv) => {
    const res = await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Chakka') });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.commit.sha, 'local');
    assert.equal(res.body.commit.url, '', 'no link — the toast hides it');

    const file = await srv.request('GET', '/data/characters/chakka.json');
    assert.equal(file.status, 200);
    assert.deepEqual(file.body, CHARACTER('Chakka'), 'the file holds the RAW character, no wrapper');

    const index = await srv.request('GET', '/data/characters/index.json');
    assert.equal(index.status, 200);
    assert.equal(index.body.schema, 'ed-characters-index/1');
    assert.deepEqual(index.body.characters.chakka, { name: 'Chakka', portrait: null });
  });
});

test('/save preserves other characters and accepts any/missing save key', async () => {
  await withServer(async (srv) => {
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Chakka') });
    const res = await srv.request('POST', '/save', { id: 'test-orc', character: CHARACTER('Test Orc') });
    assert.equal(res.status, 200, 'no x-save-key header is required locally');
    const index = await srv.request('GET', '/data/characters/index.json');
    assert.deepEqual(Object.keys(index.body.characters).sort(), ['chakka', 'test-orc']);
    const chakka = await srv.request('GET', '/data/characters/test-orc.json');
    assert.deepEqual(chakka.body, CHARACTER('Test Orc'));
  });
});

test('the index is create-only: re-saving an indexed character never rewrites it', async () => {
  await withServer(async (srv) => {
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Chakka') });
    const before = await srv.request('GET', '/data/characters/index.json');
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Renamed') });
    const after = await srv.request('GET', '/data/characters/index.json');
    assert.deepEqual(before.body, after.body, 'entry stays stale — the file is authoritative');
  });
});

test('/save re-validates: missing id, bad id, wrong schema, malformed JSON, bad base → 400', async () => {
  await withServer(async (srv) => {
    const noId = await srv.request('POST', '/save', { character: CHARACTER('X') });
    assert.equal(noId.status, 400);
    assert.equal(noId.body.error.code, 'invalid_id');

    const badId = await srv.request('POST', '/save', { id: '../evil', character: CHARACTER('X') });
    assert.equal(badId.status, 400);
    assert.equal(badId.body.error.code, 'invalid_id');

    const wrongSchema = await srv.request('POST', '/save', { id: 'chakka', character: { schema: 'ed-items/3', items: {} } });
    assert.equal(wrongSchema.status, 400);
    assert.equal(wrongSchema.body.error.code, 'invalid_character');

    const badJson = await fetch(srv.base + '/save', { method: 'POST', body: '{not json' });
    assert.equal(badJson.status, 400);
    assert.equal((await badJson.json()).error.code, 'invalid_json');

    const badBase = await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('X'), base: { not: 'a sha' } });
    assert.equal(badBase.status, 400);
    assert.equal(badBase.body.error.code, 'invalid_base', 'base must be a string or omitted — mirror-shape');
  });
});

test('a non-POST to /save is a 404, exactly like the worker', async () => {
  await withServer(async (srv) => {
    const res = await fetch(srv.base + '/save');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'not_found');
  });
});

// --- POST /save-items ---------------------------------------------------------

test('/save-items creates the catalog (header + item) and applies deletes', async () => {
  await withServer(async (srv) => {
    const res = await srv.request('POST', '/save-items', { items: { Lantern: LANTERN } });
    assert.equal(res.status, 200);
    const read = await srv.request('GET', '/data/custom-items.json');
    assert.equal(read.status, 200);
    assert.equal(read.body.schema, 'ed-items/3');
    assert.equal(read.body.effectTaxonomy, 'docs/EFFECT-TAXONOMY.md (v3)');
    assert.deepEqual(read.body.items.Lantern, LANTERN);

    const del = await srv.request('POST', '/save-items', { delete: ['Lantern'] });
    assert.equal(del.status, 200);
    const after = await srv.request('GET', '/data/custom-items.json');
    assert.deepEqual(after.body.items, {}, 'delete applied');
  });
});

test('/save-items merges new items onto an existing catalog without losing others', async () => {
  await withServer(async (srv) => {
    await srv.request('POST', '/save-items', { items: { A: LANTERN } });
    await srv.request('POST', '/save-items', { items: { B: LANTERN } });
    const read = await srv.request('GET', '/data/custom-items.json');
    assert.deepEqual(Object.keys(read.body.items).sort(), ['A', 'B']);
  });
});

test('/save-items rejects an invalid item and leaves the catalog untouched', async () => {
  await withServer(async (srv) => {
    await srv.request('POST', '/save-items', { items: { Keep: LANTERN } });
    const bad = await srv.request('POST', '/save-items', { items: { Junk: { kind: 'nope', effects: [] } } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'invalid_items');
    const read = await srv.request('GET', '/data/custom-items.json');
    assert.deepEqual(Object.keys(read.body.items), ['Keep'], 'a failed merge never lands');
  });
});

test('/save-items requires items and/or delete', async () => {
  await withServer(async (srv) => {
    const res = await srv.request('POST', '/save-items', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'invalid_items');
  });
});

// --- concurrency + OPTIONS + lag ---------------------------------------------

test('concurrent /save POSTs all land (serialized write queue)', async () => {
  await withServer(async (srv) => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const results = await Promise.all(ids.map((id) => srv.request('POST', '/save', { id, character: CHARACTER(id) })));
    assert.ok(results.every((r) => r.status === 200));
    const index = await srv.request('GET', '/data/characters/index.json');
    assert.deepEqual(Object.keys(index.body.characters).sort(), ids);
  });
});

test('OPTIONS preflight answers 204 with CORS headers (cross-origin override)', async () => {
  await withServer(async (srv) => {
    const res = await fetch(srv.base + '/save', { method: 'OPTIONS', headers: { 'x-save-key': 'k' } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-headers'), /x-save-key/);
  });
});

test('--lag serves the previous file content on the first read after a write', async () => {
  await withServer(async (srv) => {
    // First write creates the file (no prior to lag against).
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Chakka', { lag: 1 }) });
    // Second write overwrites it; within the lag window the next read returns
    // the PREVIOUS content — the one-shot stale-read the Pages flow races.
    await srv.request('POST', '/save', { id: 'chakka', character: CHARACTER('Chakka', { lag: 2 }) });

    const lagged = await srv.request('GET', '/data/characters/chakka.json');
    assert.equal(lagged.body.meta.lag, 1, 'lagged read returns the prior content');

    const fresh = await srv.request('GET', '/data/characters/chakka.json');
    assert.equal(fresh.body.meta.lag, 2, 'the next read is fresh again');
  }, { lag: 5000 });
});
