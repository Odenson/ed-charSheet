// worker-delete.test.js — run with `npm test` (node --test, no deps).
//
// plans/delete-character I1a/I1b: the worker's `POST /delete-character` route
// { id, base, deleteImage? }: validation, auth, idempotent missing file, stale base
// (zero writes), file + index-row delete, image pinning/sharing/failure handling.
// GitHub is an in-memory fake. No Earthdawn rules involved (rules.md: none).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const ENV = {
  SAVE_KEY: 'secret-key',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'odenson',
  GITHUB_REPO: 'ed-charSheet',
  GITHUB_CHARS_DIR: 'data/characters',
  GITHUB_BRANCH: 'character-data',
};

const REPO = '/repos/odenson/ed-charSheet/contents/';
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8');

// In-memory GitHub contents API. files: path -> { text, v }. sha = `${path}@${v}`.
// opts.fail: { 'GET path' | 'PUT path' | 'DELETE path' | 'LIST dir': status | fn(n) -> status|undefined }
function fakeGitHub(initial = {}, { fail = {}, onBefore } = {}) {
  const files = new Map();
  for (const [p, text] of Object.entries(initial)) files.set(p, { text, v: 1 });
  const calls = [];
  const counts = {};
  const original = globalThis.fetch;
  const sha = (p) => `${p}@${files.get(p).v}`;
  const forced = (key) => {
    const f = fail[key];
    if (f === undefined) return undefined;
    counts[key] = (counts[key] ?? 0) + 1;
    return typeof f === 'function' ? f(counts[key]) : f;
  };
  const reply = (status, body = {}) => new Response(JSON.stringify(body), { status });
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const u = new URL(String(url));
    calls.push({ method, url: String(url), options });
    if (u.pathname.endsWith('/git/ref/heads/character-data')) return reply(200, { ref: 'ok' });
    const i = u.pathname.indexOf(REPO);
    if (i < 0) throw new Error(`unmocked fetch: ${method} ${url}`);
    const path = decodeURIComponent(u.pathname.slice(i + REPO.length));
    if (onBefore) onBefore({ method, path, files });
    const isDir = [...files.keys()].some((k) => k.startsWith(`${path}/`));
    if (method === 'GET') {
      const f = forced(isDir ? `LIST ${path}` : `GET ${path}`) ?? (isDir ? undefined : undefined);
      if (f) return reply(f);
      if (isDir) {
        const entries = [...files.keys()]
          .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
          .map((k) => ({ name: k.split('/').pop(), path: k, type: 'file', sha: sha(k) }));
        return reply(200, entries);
      }
      if (!files.has(path)) return reply(404);
      return reply(200, { sha: sha(path), content: b64(files.get(path).text), encoding: 'base64' });
    }
    const f = forced(`${method} ${path}`);
    if (f) return reply(f);
    const body = JSON.parse(options.body ?? '{}');
    if (method === 'PUT') {
      const cur = files.get(path);
      if (cur && body.sha !== sha(path)) return reply(409);
      files.set(path, { text: unb64(body.content), v: (cur?.v ?? 0) + 1 });
      return reply(cur ? 200 : 201, { content: { sha: sha(path) }, commit: { html_url: 'u' } });
    }
    if (method === 'DELETE') {
      if (!files.has(path)) return reply(404);
      if (body.sha !== sha(path)) return reply(409);
      files.delete(path);
      return reply(200, { commit: { sha: 'c' } });
    }
    throw new Error(`unmocked fetch: ${method} ${url}`);
  };
  return {
    calls,
    files,
    sha,
    restore() { globalThis.fetch = original; },
    writes: () => calls.filter((c) => c.method === 'PUT' || c.method === 'DELETE'),
    deletes: () => calls.filter((c) => c.method === 'DELETE'),
    json: (p) => JSON.parse(files.get(p).text),
  };
}

function req(body, { path = '/delete-character', key = ENV.SAVE_KEY, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== null) headers['x-save-key'] = key;
  return new Request(`https://worker.test${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
async function call(request, env = ENV) {
  const res = await worker.fetch(request, env);
  return { status: res.status, json: await res.json().catch(() => null) };
}

const CHARS = 'data/characters';
const P = (id) => `${CHARS}/${id}.json`;
const INDEX = `${CHARS}/index.json`;
const IMG = 'data/chakka-1700000000000.jpg';
const OTHER_IMG = 'data/sarn-1700000000000.jpg';
const charFile = (name, portrait = null) => JSON.stringify({ schema: 'ed-character/2', meta: { name, portrait } }, null, 2);
const indexFile = (characters) => JSON.stringify({ schema: 'ed-characters-index/1', characters }, null, 2);

// A standard roster: chakka (with IMG) + sarn (own image), index lists both.
function roster(extra = {}) {
  return {
    [P('chakka')]: charFile('Chakka', IMG),
    [P('sarn')]: charFile('Sarn', OTHER_IMG),
    [INDEX]: indexFile({ chakka: { name: 'Chakka', portrait: IMG }, sarn: { name: 'Sarn', portrait: OTHER_IMG } }),
    [IMG]: 'IMGBYTES',
    [OTHER_IMG]: 'SARNIMG',
    ...extra,
  };
}
const del = (gh, over = {}) => call(req({ id: 'chakka', base: gh.sha(P('chakka')), ...over }));

// --- happy path ----------------------------------------------------------------------

test('/delete-character: removes the character file and its index row only', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.equal(json.deleted, true);
    assert.equal(json.indexUpdated, true);
    assert.equal(gh.files.has(P('chakka')), false);
    assert.deepEqual(Object.keys(gh.json(INDEX).characters), ['sarn']);
    assert.ok(gh.files.has(P('sarn')) && gh.files.has(IMG), 'other files and the image are untouched');
    const d = gh.deletes()[0];
    const sent = JSON.parse(d.options.body);
    assert.equal(sent.sha, 'data/characters/chakka.json@1');
    assert.equal(sent.branch, 'character-data');
    assert.equal(typeof sent.message, 'string');
  } finally {
    gh.restore();
  }
});

test('/delete-character: without deleteImage the image is never touched, even when unshared', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { json } = await del(gh);
    assert.equal(json.imageDeleted ?? false, false);
    assert.ok(gh.files.has(IMG));
    assert.ok(!gh.deletes().some((c) => c.url.includes('chakka-1700')));
  } finally {
    gh.restore();
  }
});

test('/delete-character: absent index file is a no-op (deleted true, no index write)', async () => {
  const init = roster();
  delete init[INDEX];
  const gh = fakeGitHub(init);
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
    assert.ok(!gh.writes().some((c) => c.url.includes('index.json')));
  } finally {
    gh.restore();
  }
});

test('/delete-character: index with no row for the id is a no-op (no index write)', async () => {
  const init = roster({ [INDEX]: indexFile({ sarn: { name: 'Sarn', portrait: OTHER_IMG } }) });
  const gh = fakeGitHub(init);
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
    assert.ok(!gh.writes().some((c) => c.url.includes('index.json')));
  } finally {
    gh.restore();
  }
});

test('/delete-character: index PUT 409 is re-read and retried', async () => {
  const gh = fakeGitHub(roster(), { fail: { [`PUT ${INDEX}`]: (n) => (n === 1 ? 409 : undefined) } });
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 200);
    assert.equal(json.indexUpdated, true);
    assert.deepEqual(Object.keys(gh.json(INDEX).characters), ['sarn']);
  } finally {
    gh.restore();
  }
});

test('/delete-character: a failed index write still returns 200 with indexUpdated:false (file already gone)', async () => {
  const gh = fakeGitHub(roster(), { fail: { [`PUT ${INDEX}`]: 500 } });
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.deleted, true);
    assert.equal(json.indexUpdated, false);
    assert.equal(gh.files.has(P('chakka')), false);
  } finally {
    gh.restore();
  }
});

// --- missing file (idempotent) --------------------------------------------------------

test('/delete-character: missing file -> ok, deleted:false, stale index row still removed, no file DELETE', async () => {
  const init = roster();
  delete init[P('chakka')];
  const gh = fakeGitHub(init);
  try {
    const { status, json } = await call(req({ id: 'chakka', base: 'whatever' }));
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.equal(json.deleted, false);
    assert.equal(gh.deletes().length, 0);
    assert.deepEqual(Object.keys(gh.json(INDEX).characters), ['sarn']);
  } finally {
    gh.restore();
  }
});

test('/delete-character: missing file + deleteImage -> imageSkipped:unknown, image untouched', async () => {
  const init = roster();
  delete init[P('chakka')];
  const gh = fakeGitHub(init);
  try {
    const { json } = await call(req({ id: 'chakka', base: 'whatever', deleteImage: IMG }));
    assert.equal(json.deleted, false);
    assert.equal(json.imageSkipped, 'unknown');
    assert.ok(gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

// --- stale base -----------------------------------------------------------------------

test('/delete-character: stale base -> 409 stale_base with the current sha, ZERO writes (image untouched)', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { status, json } = await call(req({ id: 'chakka', base: 'old-sha', deleteImage: IMG }));
    assert.equal(status, 409);
    assert.equal(json.ok, false);
    assert.equal(json.error.code, 'stale_base');
    assert.equal(json.error.sha, gh.sha(P('chakka')));
    assert.equal(gh.writes().length, 0);
    assert.ok(gh.files.has(P('chakka')) && gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

test('/delete-character: file DELETE 409 (sha moved in the window) -> stale_base with a freshly read sha', async () => {
  let bumped = false;
  const gh = fakeGitHub(roster(), {
    onBefore: ({ method, path, files }) => {
      // Move the sha right before the DELETE lands.
      if (method === 'DELETE' && path === P('chakka') && !bumped) {
        bumped = true;
        files.get(path).v += 1;
      }
    },
  });
  try {
    const { status, json } = await del(gh);
    assert.equal(status, 409);
    assert.equal(json.error.code, 'stale_base');
    assert.equal(json.error.sha, 'data/characters/chakka.json@2');
    assert.ok(gh.files.has(P('chakka')));
    assert.ok(Object.keys(gh.json(INDEX).characters).includes('chakka'), 'index row kept');
  } finally {
    gh.restore();
  }
});

// --- validation (rejected before any GitHub call) -------------------------------------

async function rejected(body, code) {
  const gh = fakeGitHub(roster());
  try {
    const { status, json } = await call(req(body));
    assert.equal(status, 400, JSON.stringify(json));
    assert.equal(json.ok, false);
    if (code) assert.equal(json.error.code, code);
    assert.equal(gh.calls.length, 0, 'no GitHub call on a rejected request');
  } finally {
    gh.restore();
  }
}

test('/delete-character: invalid or missing id -> 400 invalid_id', async () => {
  for (const id of [undefined, null, '', '../x', 'Chakka', 'a/b', '-x', 5, {}, 'a'.repeat(65)]) {
    await rejected({ id, base: 'b' }, 'invalid_id');
  }
});

test('/delete-character: base must be a non-empty string -> 400 invalid_base', async () => {
  for (const base of [undefined, null, '', 5, {}, []]) {
    await rejected({ id: 'chakka', base }, 'invalid_base');
  }
});

test('/delete-character: invalid deleteImage -> 400 invalid_image (traversal, wrong dir, ext, null, non-string)', async () => {
  for (const deleteImage of [
    null, 5, {}, [], '', '../data/x.jpg', 'data/../x.jpg', 'data/sub/x.jpg', 'data/x.gif', 'data/x',
    'other/x.jpg', '/data/x.jpg', 'https://evil.example/x.jpg', 'data/characters/chakka.json',
  ]) {
    await rejected({ id: 'chakka', base: 'b', deleteImage }, 'invalid_image');
  }
});

test('/delete-character: non-JSON body -> 400', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { status } = await call(req('not json{'));
    assert.equal(status, 400);
    assert.equal(gh.writes().length, 0);
  } finally {
    gh.restore();
  }
});

// --- auth + routing -------------------------------------------------------------------

test('/delete-character: missing or wrong key -> 401, no GitHub traffic', async () => {
  for (const key of [null, 'wrong']) {
    const gh = fakeGitHub(roster());
    try {
      const { status, json } = await call(req({ id: 'chakka', base: 'b' }, { key }));
      assert.equal(status, 401);
      assert.equal(json.error.code, 'unauthorized');
      assert.equal(gh.calls.length, 0);
    } finally {
      gh.restore();
    }
  }
});

test('/delete-character: unconfigured SAVE_KEY fails closed (401)', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { status } = await call(req({ id: 'chakka', base: 'b' }), { ...ENV, SAVE_KEY: undefined });
    assert.equal(status, 401);
    assert.equal(gh.writes().length, 0);
  } finally {
    gh.restore();
  }
});

test('routing: GET /delete-character is 404; OPTIONS preflight 204 with CORS; unknown POST 404 names the route', async () => {
  const r = await worker.fetch(req(undefined, { method: 'GET' }), ENV);
  assert.equal(r.status, 404);
  const o = await worker.fetch(req(undefined, { method: 'OPTIONS' }), ENV);
  assert.equal(o.status, 204);
  assert.ok(o.headers.get('Access-Control-Allow-Origin'));
  const unknown = await worker.fetch(req({}, { path: '/nope' }), ENV);
  assert.equal(unknown.status, 404);
  assert.match(JSON.stringify(await unknown.json()), /delete-character/);
});

test('/delete-character: upstream DELETE failure (500) maps to a non-2xx error, never ok', async () => {
  const gh = fakeGitHub(roster(), { fail: { [`DELETE ${P('chakka')}`]: 500 } });
  try {
    const { status, json } = await del(gh);
    assert.ok(status >= 400);
    assert.equal(json.ok, false);
    assert.ok(gh.files.has(P('chakka')));
  } finally {
    gh.restore();
  }
});

// --- image handling (I1b) -------------------------------------------------------------

test('image: requested, equals meta.portrait, unshared -> file, index row and image deleted', async () => {
  const gh = fakeGitHub(roster());
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.deleted, true);
    assert.equal(json.imageDeleted, true);
    assert.equal(gh.files.has(IMG), false);
    assert.equal(gh.files.has(P('chakka')), false);
    assert.ok(gh.files.has(OTHER_IMG), 'other character image untouched');
    const imgDel = gh.deletes().find((c) => c.url.includes('chakka-1700'));
    assert.equal(JSON.parse(imgDel.options.body).sha, 'data/chakka-1700000000000.jpg@1');
  } finally {
    gh.restore();
  }
});

test('image: deleteImage differs from the target meta.portrait (incl. a catalog image) -> mismatch, image untouched, character still deleted', async () => {
  for (const other of [OTHER_IMG, 'data/catalog-image.png']) {
    const gh = fakeGitHub(roster({ 'data/catalog-image.png': 'CAT' }));
    try {
      const { status, json } = await del(gh, { deleteImage: other });
      assert.equal(status, 200);
      assert.equal(json.deleted, true);
      assert.equal(json.imageSkipped, 'mismatch');
      assert.ok(!json.imageDeleted);
      assert.ok(gh.files.has(other), other);
      assert.equal(gh.files.has(P('chakka')), false);
    } finally {
      gh.restore();
    }
  }
});

test('image: target file has no meta.portrait -> imageSkipped:none, nothing image-related deleted', async () => {
  const gh = fakeGitHub(roster({ [P('chakka')]: charFile('Chakka', null) }));
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
    assert.equal(json.imageSkipped, 'none');
    assert.ok(gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

test("image: shared via another character's index row -> imageSkipped:shared, image kept", async () => {
  const init = roster({
    [P('sarn')]: charFile('Sarn', OTHER_IMG), // file says otherwise; the index alone shows sharing
    [INDEX]: indexFile({ chakka: { name: 'Chakka', portrait: IMG }, sarn: { name: 'Sarn', portrait: IMG } }),
  });
  const gh = fakeGitHub(init);
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
    assert.equal(json.imageSkipped, 'shared');
    assert.ok(!json.imageDeleted);
    assert.ok(gh.files.has(IMG));
    assert.equal(gh.files.has(P('chakka')), false);
  } finally {
    gh.restore();
  }
});

test('image: shared via another character FILE whose index row is missing -> shared, image kept', async () => {
  const init = roster({
    [P('sarn')]: charFile('Sarn', IMG),
    [INDEX]: indexFile({ chakka: { name: 'Chakka', portrait: IMG } }), // no sarn row
  });
  const gh = fakeGitHub(init);
  try {
    const { json } = await del(gh, { deleteImage: IMG });
    assert.equal(json.imageSkipped, 'shared');
    assert.ok(gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

test('image: sharing is checked even when the index file is absent (files are the truth)', async () => {
  const init = roster({ [P('sarn')]: charFile('Sarn', IMG) });
  delete init[INDEX];
  const gh = fakeGitHub(init);
  try {
    const { json } = await del(gh, { deleteImage: IMG });
    assert.equal(json.imageSkipped, 'shared');
    assert.ok(gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

test('image: the target itself (and index.json) never count as "another" character', async () => {
  const init = roster();
  delete init[P('sarn')];
  init[INDEX] = indexFile({ chakka: { name: 'Chakka', portrait: IMG } });
  const gh = fakeGitHub(init);
  try {
    const { json } = await del(gh, { deleteImage: IMG });
    assert.equal(json.imageDeleted, true);
    assert.equal(gh.files.has(IMG), false);
  } finally {
    gh.restore();
  }
});

test('image: another file unreadable or unparseable -> imageSkipped:unverified, NO image delete (character still deleted)', async () => {
  const cases = {
    'read 500': () => fakeGitHub(roster(), { fail: { [`GET ${P('sarn')}`]: 500 } }),
    unparseable: () => fakeGitHub(roster({ [P('sarn')]: '{ not json' })),
  };
  for (const [label, make] of Object.entries(cases)) {
    const gh = make(); // construct per iteration: each fake patches globalThis.fetch
    try {
      const { status, json } = await del(gh, { deleteImage: IMG });
      assert.equal(status, 200, label);
      assert.equal(json.deleted, true, label);
      assert.equal(json.imageSkipped, 'unverified', label);
      assert.ok(!json.imageDeleted, label);
      assert.ok(gh.files.has(IMG), label);
    } finally {
      gh.restore();
    }
  }
});

test('image: directory listing failure -> unverified, no image delete', async () => {
  const gh = fakeGitHub(roster(), { fail: { [`LIST ${CHARS}`]: 500 } });
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200);
    assert.equal(json.imageSkipped, 'unverified');
    assert.ok(gh.files.has(IMG));
  } finally {
    gh.restore();
  }
});

test('image: already gone (404) counts as imageDeleted:true', async () => {
  const init = roster();
  delete init[IMG];
  const gh = fakeGitHub(init);
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
    assert.equal(json.imageDeleted, true);
  } finally {
    gh.restore();
  }
});

test('image: image DELETE failure never fails the call -> 200 ok, imageDeleted:false, imageSkipped:error', async () => {
  const gh = fakeGitHub(roster(), { fail: { [`DELETE ${IMG}`]: 500 } });
  try {
    const { status, json } = await del(gh, { deleteImage: IMG });
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.deleted, true);
    assert.equal(json.imageDeleted, false);
    assert.equal(json.imageSkipped, 'error');
    assert.equal(gh.files.has(P('chakka')), false);
  } finally {
    gh.restore();
  }
});

test('image: GITHUB_IMAGES_DIR pins the accepted image dir', async () => {
  const env = { ...ENV, GITHUB_IMAGES_DIR: 'pics' };
  const pimg = 'pics/chakka-1700000000000.jpg';
  const gh = fakeGitHub(roster({ [P('chakka')]: charFile('Chakka', pimg), [pimg]: 'X' }));
  try {
    const bad = await call(req({ id: 'chakka', base: gh.sha(P('chakka')), deleteImage: IMG }), env);
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'invalid_image');
    assert.equal(gh.writes().length, 0);
    const good = await call(req({ id: 'chakka', base: gh.sha(P('chakka')), deleteImage: pimg }), env);
    assert.equal(good.status, 200);
    assert.equal(good.json.imageDeleted, true);
    assert.equal(gh.files.has(pimg), false);
  } finally {
    gh.restore();
  }
});
