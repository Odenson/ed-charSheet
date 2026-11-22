// worker-portrait.test.js — run with `npm test` (node --test, no deps).
//
// plans/add-char-portrait I1/I2: the worker's `POST /save-image` route (validate,
// create-only commit, identical-content retry, never overwrite) and the `/save`
// index portrait sync (`syncIndexEntry`: only `characters[id].portrait` changes,
// invalid portrait strings skip the index write, best-effort). GitHub is mocked.
// No Earthdawn rules are involved (rules.md: none).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from './worker.js';

const ENV = {
  SAVE_KEY: 'secret-key',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'odenson',
  GITHUB_REPO: 'ed-charSheet',
  GITHUB_CHARS_DIR: 'data/characters',
  GITHUB_BRANCH: 'character-data',
};

function req(body, { method = 'POST', path = '/save-image', key = ENV.SAVE_KEY } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== null) headers['x-save-key'] = key;
  return new Request(`https://worker.test${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockGitHub(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const u = String(url);
    const pathname = new URL(u).pathname;
    calls.push({ method, url: u, options });
    for (const [key, handler] of Object.entries(routes)) {
      const [m, frag] = key.split(' ');
      if (m === method && pathname.endsWith(frag)) {
        const { status = 200, body = {} } = handler(calls.length, { url: u, options });
        return new Response(JSON.stringify(body), { status });
      }
    }
    throw new Error(`unmocked fetch: ${method} ${u}`);
  };
  return { calls, restore() { globalThis.fetch = original; } };
}

async function call(request, env = ENV) {
  const res = await worker.fetch(request, env);
  const json = await res.json();
  return { status: res.status, json };
}

const branchExists = { 'GET /git/ref/heads/character-data': () => ({ status: 200, body: { ref: 'ok' } }) };

// --- image fixtures (bytes only; the worker checks magic bytes, not decodability) ---

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function webpBytes(n = 32) {
  const b = Buffer.alloc(n, 7);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  return b;
}
function withHead(head, n = 64) {
  const b = Buffer.alloc(n, 9);
  Buffer.from(head).copy(b, 0);
  return b;
}
const JPEG = withHead(JPEG_HEAD);
const PNG = withHead(PNG_HEAD);
const WEBP = webpBytes();
const b64 = (buf) => buf.toString('base64');
const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const NAME = 'chakka-1700000000000.jpg';
const IMG_PATH = `data/${NAME}`;
const IMG_GET = `GET /contents/${IMG_PATH}`;
const IMG_PUT = `PUT /contents/${IMG_PATH}`;
const absent = { [IMG_GET]: () => ({ status: 404, body: {} }) };
const putOk = (sha = 'img-blob-sha') => ({
  [IMG_PUT]: () => ({ status: 201, body: { content: { sha }, commit: { html_url: 'https://github.com/commit/c1' } } }),
});
const puts = (mock) => mock.calls.filter((c) => c.method === 'PUT');

const upload = (over = {}) => ({ id: 'chakka', filename: NAME, content: b64(JPEG), ...over });

// --- /save-image: happy paths --------------------------------------------------------

test('/save-image: valid JPEG commits one file at the env-pinned path and returns { ok, path, sha, url }', async () => {
  const mock = mockGitHub({ ...branchExists, ...absent, ...putOk('img-blob-sha') });
  try {
    const { status, json } = await call(req(upload()));
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.path, IMG_PATH);
    assert.equal(json.sha, 'img-blob-sha');
    assert.equal(typeof json.url, 'string');
    const p = puts(mock);
    assert.equal(p.length, 1, 'exactly one commit');
    assert.ok(p[0].url.endsWith(`/contents/${IMG_PATH}`));
    const sent = JSON.parse(p[0].options.body);
    assert.equal(sent.branch, 'character-data', 'branch is env-pinned');
    assert.equal(sent.sha, undefined, 'create-only: PUT carries no sha');
    assert.deepEqual(Buffer.from(sent.content, 'base64'), JPEG, 'the exact uploaded bytes');
  } finally {
    mock.restore();
  }
});

test('/save-image: PNG and WebP with matching magic bytes are accepted', async () => {
  for (const [ext, buf] of [['png', PNG], ['webp', WEBP]]) {
    const filename = `chakka-1700000000001.${ext}`;
    const path = `data/${filename}`;
    const mock = mockGitHub({
      ...branchExists,
      [`GET /contents/${path}`]: () => ({ status: 404, body: {} }),
      [`PUT /contents/${path}`]: () => ({ status: 201, body: { content: { sha: 's' }, commit: { html_url: 'u' } } }),
    });
    try {
      const { status, json } = await call(req(upload({ filename, content: b64(buf) })));
      assert.equal(status, 200, ext);
      assert.equal(json.path, path);
      assert.equal(puts(mock).length, 1, ext);
    } finally {
      mock.restore();
    }
  }
});

test('/save-image: GITHUB_IMAGES_DIR overrides the data dir; a request "path" field is ignored', async () => {
  const path = `pics/${NAME}`;
  const mock = mockGitHub({
    ...branchExists,
    [`GET /contents/${path}`]: () => ({ status: 404, body: {} }),
    [`PUT /contents/${path}`]: () => ({ status: 201, body: { content: { sha: 's' }, commit: { html_url: 'u' } } }),
  });
  try {
    const { status, json } = await call(req(upload({ path: 'evil/elsewhere.jpg' })), { ...ENV, GITHUB_IMAGES_DIR: 'pics' });
    assert.equal(status, 200);
    assert.equal(json.path, path);
    assert.ok(puts(mock)[0].url.endsWith(`/contents/${path}`));
    assert.ok(!mock.calls.some((c) => c.url.includes('evil')), 'client path never reaches GitHub');
  } finally {
    mock.restore();
  }
});

test('/save-image: size boundary - exactly 1,500,000 decoded bytes is accepted', async () => {
  const big = withHead(JPEG_HEAD, 1_500_000);
  const mock = mockGitHub({ ...branchExists, ...absent, ...putOk() });
  try {
    const { status } = await call(req(upload({ content: b64(big) })));
    assert.equal(status, 200);
  } finally {
    mock.restore();
  }
});

// --- /save-image: create-only / idempotence ------------------------------------------

test('/save-image: existing file with IDENTICAL content -> ok, NO PUT (retry-safe)', async () => {
  const mock = mockGitHub({
    ...branchExists,
    [IMG_GET]: () => ({ status: 200, body: { sha: blobSha(JPEG) } }),
  });
  try {
    const { status, json } = await call(req(upload()));
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.path, IMG_PATH);
    assert.equal(json.sha, blobSha(JPEG));
    assert.equal(puts(mock).length, 0);
  } finally {
    mock.restore();
  }
});

test('/save-image: existing file with DIFFERENT content -> 409 exists, NO PUT (never overwrites)', async () => {
  const mock = mockGitHub({
    ...branchExists,
    [IMG_GET]: () => ({ status: 200, body: { sha: blobSha(PNG) } }),
  });
  try {
    const { status, json } = await call(req(upload()));
    assert.equal(status, 409);
    assert.equal(json.ok, false);
    assert.equal(json.error.code, 'exists');
    assert.equal(puts(mock).length, 0);
  } finally {
    mock.restore();
  }
});

// --- /save-image: rejection (each with no GitHub PUT) --------------------------------

async function rejected(body, code, status = 400, env = ENV) {
  const mock = mockGitHub({ ...branchExists, ...absent, ...putOk() });
  try {
    const r = await call(req(body), env);
    assert.equal(r.status, status, JSON.stringify(r.json));
    assert.equal(r.json.ok, false);
    if (code) assert.equal(r.json.error.code, code);
    assert.equal(puts(mock).length, 0, 'no GitHub PUT on a rejected upload');
  } finally {
    mock.restore();
  }
}

test('/save-image: JPEG extension with PNG bytes (magic mismatch) -> invalid_image', async () => {
  await rejected(upload({ content: b64(PNG) }), 'invalid_image');
});

test('/save-image: PNG name with JPEG bytes -> invalid_image', async () => {
  await rejected(upload({ filename: 'chakka-1700000000000.png', content: b64(JPEG) }), 'invalid_image');
});

test('/save-image: RIFF without WEBP marker at offset 8 -> invalid_image', async () => {
  const bad = webpBytes();
  bad.write('WAVE', 8, 'ascii');
  await rejected(upload({ filename: 'chakka-1700000000000.webp', content: b64(bad) }), 'invalid_image');
});

test('/save-image: bytes with no known magic -> invalid_image', async () => {
  await rejected(upload({ content: b64(Buffer.from('just some text, not an image')) }), 'invalid_image');
});

test('/save-image: invalid base64 -> invalid_image', async () => {
  await rejected(upload({ content: '!!!not base64***' }), 'invalid_image');
});

test('/save-image: decoded size over 1,500,000 -> 400 too_large', async () => {
  const big = withHead(JPEG_HEAD, 1_500_001);
  await rejected(upload({ content: b64(big) }), 'too_large');
});

test('/save-image: bad filenames -> invalid_name', async () => {
  const bad = [
    'chakka.jpg',                       // no timestamp
    'chakka-123456789.jpg',             // 9 digits (< 10)
    'chakka-123456789012345678.jpg',    // 18 digits (> 17)
    'chakka-1700000000000.gif',         // unsupported ext
    'chakka-1700000000000.jpeg',        // only jpg|png|webp
    'sarn-1700000000000.jpg',           // another character's prefix
    '../chakka-1700000000000.jpg',      // traversal
    'a/chakka-1700000000000.jpg',       // nested
    'data/chakka-1700000000000.jpg',    // path, not a filename
    'chakka-1700000000000.jpg/../x.jpg',
    '',
  ];
  for (const filename of bad) await rejected(upload({ filename }), 'invalid_name');
});

test('/save-image: non-string filename -> 400, no PUT', async () => {
  for (const filename of [undefined, null, 5, {}, []]) await rejected(upload({ filename }), null);
});

test('/save-image: invalid or missing id -> 400, no PUT', async () => {
  for (const id of [undefined, '', '../x', 'Chakka', 'a/b', 5]) {
    await rejected({ id, filename: NAME, content: b64(JPEG) }, null);
  }
});

test('/save-image: missing content -> 400, no PUT', async () => {
  await rejected({ id: 'chakka', filename: NAME }, null);
});

test('/save-image: non-JSON body -> 400', async () => {
  const mock = mockGitHub({ ...branchExists });
  try {
    const { status } = await call(req('not json{'));
    assert.equal(status, 400);
    assert.equal(puts(mock).length, 0);
  } finally {
    mock.restore();
  }
});

// --- /save-image: auth + routing -------------------------------------------------------

test('/save-image: missing or wrong key -> 401 unauthorized, no GitHub traffic at all', async () => {
  for (const key of [null, 'wrong']) {
    const mock = mockGitHub({});
    try {
      const { status, json } = await call(req(upload(), { key }));
      assert.equal(status, 401);
      assert.equal(json.error.code, 'unauthorized');
      assert.equal(mock.calls.length, 0);
    } finally {
      mock.restore();
    }
  }
});

test('/save-image: unconfigured SAVE_KEY fails closed (401)', async () => {
  const { status } = await call(req(upload()), { ...ENV, SAVE_KEY: undefined });
  assert.equal(status, 401);
});

test('/save-image: GET is 404; OPTIONS preflight is 204 with CORS', async () => {
  const r = await worker.fetch(req(undefined, { method: 'GET' }), ENV);
  assert.equal(r.status, 404);
  const o = await worker.fetch(req(undefined, { method: 'OPTIONS' }), ENV);
  assert.equal(o.status, 204);
  assert.ok(o.headers.get('Access-Control-Allow-Origin'));
});

test('/save-image: upstream failure on the PUT maps to a non-2xx error, never ok', async () => {
  const mock = mockGitHub({ ...branchExists, ...absent, [IMG_PUT]: () => ({ status: 500, body: {} }) });
  try {
    const { status, json } = await call(req(upload()));
    assert.ok(status >= 400);
    assert.equal(json.ok, false);
  } finally {
    mock.restore();
  }
});

// --- /save: index portrait sync (syncIndexEntry) -------------------------------------

const CHAR_PATH = 'data/characters/chakka.json';
const INDEX_PATH = 'data/characters/index.json';
const NEW_PORTRAIT = 'data/chakka-1700000000000.jpg';
const charWith = (portrait, name = 'Chakka') => ({ schema: 'ed-character/1', meta: { name, portrait } });
const b64json = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const indexOf = (characters) => ({ schema: 'ed-characters-index/1', characters });
const readsIndex = (file, sha = 'index-sha') => ({
  [`GET /contents/${INDEX_PATH}`]: () => ({ status: 200, body: { sha, content: b64json(file), encoding: 'base64' } }),
});
const existingChar = {
  [`GET /contents/${CHAR_PATH}`]: () => ({ status: 200, body: { sha: 'char-sha' } }),
  [`PUT /contents/${CHAR_PATH}`]: () => ({ status: 200, body: { content: { sha: 'char-commit' }, html_url: 'u' } }),
};
const indexPuts = (mock) => mock.calls.filter((c) => c.method === 'PUT' && c.url.includes('index.json'));
const writtenIndex = (put) => JSON.parse(Buffer.from(JSON.parse(put.options.body).content, 'base64').toString('utf8'));
const putIndexOk = { [`PUT /contents/${INDEX_PATH}`]: () => ({ status: 200, body: { content: { sha: 'ic' }, html_url: 'u' } }) };
const save = (character, env = ENV) => call(req({ character, id: 'chakka' }, { path: '/save' }), env);

test('/save index sync: a changed portrait on an existing entry updates ONLY that portrait', async () => {
  const idx = indexOf({
    chakka: { name: 'Chakka', portrait: 'data/old.jpg' },
    sarn: { name: 'Sarn', portrait: 'data/sarn.jpg' },
  });
  const mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    const { status } = await save(charWith(NEW_PORTRAIT, 'Chakka Renamed'));
    assert.equal(status, 200);
    const p = indexPuts(mock);
    assert.equal(p.length, 1);
    assert.equal(JSON.parse(p[0].options.body).sha, 'index-sha', 'PUT carries the index sha it read');
    assert.deepEqual(writtenIndex(p[0]), indexOf({
      chakka: { name: 'Chakka', portrait: NEW_PORTRAIT }, // name left alone (create-only)
      sarn: { name: 'Sarn', portrait: 'data/sarn.jpg' },   // other ids untouched
    }));
  } finally {
    mock.restore();
  }
});

test('/save index sync: portrait removal (null) writes portrait: null', async () => {
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: 'data/old.jpg' } });
  const mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    const { status } = await save(charWith(null));
    assert.equal(status, 200);
    const p = indexPuts(mock);
    assert.equal(p.length, 1);
    assert.deepEqual(writtenIndex(p[0]).characters.chakka, { name: 'Chakka', portrait: null });
  } finally {
    mock.restore();
  }
});

test('/save index sync: unchanged portrait -> no index write', async () => {
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: NEW_PORTRAIT } });
  const mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    const { status } = await save(charWith(NEW_PORTRAIT));
    assert.equal(status, 200);
    assert.equal(indexPuts(mock).length, 0);
  } finally {
    mock.restore();
  }
});

test('/save index sync: runs on every 2xx character PUT (existing file), not only creates', async () => {
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: null } });
  const mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    await save(charWith(NEW_PORTRAIT));
    assert.ok(mock.calls.some((c) => c.method === 'GET' && c.url.includes('index.json')), 'index is read');
    assert.equal(indexPuts(mock).length, 1);
    const charPutIdx = mock.calls.findIndex((c) => c.method === 'PUT' && c.url.includes('chakka.json'));
    const indexPutIdx = mock.calls.findIndex((c) => c.method === 'PUT' && c.url.includes('index.json'));
    assert.ok(charPutIdx >= 0 && indexPutIdx > charPutIdx, 'index is written after the character file');
  } finally {
    mock.restore();
  }
});

const INVALID_PORTRAITS = [
  '../data/x.jpg',
  'data/../x.jpg',
  'data/sub/x.jpg',
  'data/x.gif',
  'data/x.jpg.exe',
  'data/x',
  'other/x.jpg',
  '/data/x.jpg',
  'https://evil.example/x.jpg',
  'data/',
  5,
  {},
  [],
];

test('/save index sync: invalid portrait values skip the index write; the character save still succeeds', async () => {
  for (const bad of INVALID_PORTRAITS) {
    const idx = indexOf({ chakka: { name: 'Chakka', portrait: 'data/old.jpg' } });
    const mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
    try {
      const { status } = await save(charWith(bad));
      assert.equal(status, 200, JSON.stringify(bad));
      assert.equal(indexPuts(mock).length, 0, `no index write for ${JSON.stringify(bad)}`);
      assert.ok(mock.calls.some((c) => c.method === 'PUT' && c.url.includes('chakka.json')), 'character was saved');
    } finally {
      mock.restore();
    }
  }
});

test('/save index sync: create case with an invalid portrait skips the index write; save still 200', async () => {
  const mock = mockGitHub({
    ...branchExists,
    [`GET /contents/${CHAR_PATH}`]: () => ({ status: 404, body: {} }),
    [`PUT /contents/${CHAR_PATH}`]: () => ({ status: 201, body: { content: { sha: 'c' }, html_url: 'u' } }),
    [`GET /contents/${INDEX_PATH}`]: () => ({ status: 404, body: {} }),
    ...putIndexOk,
  });
  try {
    const { status } = await save(charWith('data/sub/x.jpg'));
    assert.equal(status, 200);
    assert.equal(indexPuts(mock).length, 0);
  } finally {
    mock.restore();
  }
});

test('/save index sync: create case still writes name + portrait (unchanged behavior)', async () => {
  const mock = mockGitHub({
    ...branchExists,
    [`GET /contents/${CHAR_PATH}`]: () => ({ status: 404, body: {} }),
    [`PUT /contents/${CHAR_PATH}`]: () => ({ status: 201, body: { content: { sha: 'c' }, html_url: 'u' } }),
    [`GET /contents/${INDEX_PATH}`]: () => ({ status: 404, body: {} }),
    ...putIndexOk,
  });
  try {
    const { status } = await save(charWith(NEW_PORTRAIT));
    assert.equal(status, 200);
    assert.deepEqual(writtenIndex(indexPuts(mock)[0]).characters.chakka, { name: 'Chakka', portrait: NEW_PORTRAIT });
  } finally {
    mock.restore();
  }
});

test('/save index sync: GITHUB_IMAGES_DIR drives the accepted portrait prefix', async () => {
  const env = { ...ENV, GITHUB_IMAGES_DIR: 'pics' };
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: null } });
  let mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    await save(charWith('pics/x.jpg'), env);
    assert.equal(indexPuts(mock).length, 1, 'pics/ accepted');
  } finally {
    mock.restore();
  }
  mock = mockGitHub({ ...branchExists, ...existingChar, ...readsIndex(idx), ...putIndexOk });
  try {
    await save(charWith('data/x.jpg'), env);
    assert.equal(indexPuts(mock).length, 0, 'data/ rejected when the images dir is pics');
  } finally {
    mock.restore();
  }
});

test('/save index sync: index PUT 409 is re-read and retried; save still 200', async () => {
  let n = 0;
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: null } });
  const mock = mockGitHub({
    ...branchExists,
    ...existingChar,
    ...readsIndex(idx),
    [`PUT /contents/${INDEX_PATH}`]: () =>
      ++n === 1 ? { status: 409, body: {} } : { status: 200, body: { content: { sha: 'ic' }, html_url: 'u' } },
  });
  try {
    const { status } = await save(charWith(NEW_PORTRAIT));
    assert.equal(status, 200);
    assert.equal(n, 2);
    assert.equal(mock.calls.filter((c) => c.method === 'GET' && c.url.includes('index.json')).length, 2, 're-read before retry');
  } finally {
    mock.restore();
  }
});

test('/save index sync: a failed index write (500) or read (500) never fails the save', async () => {
  const idx = indexOf({ chakka: { name: 'Chakka', portrait: null } });
  let mock = mockGitHub({
    ...branchExists, ...existingChar, ...readsIndex(idx),
    [`PUT /contents/${INDEX_PATH}`]: () => ({ status: 500, body: {} }),
  });
  try {
    assert.equal((await save(charWith(NEW_PORTRAIT))).status, 200);
  } finally {
    mock.restore();
  }
  mock = mockGitHub({
    ...branchExists, ...existingChar,
    [`GET /contents/${INDEX_PATH}`]: () => ({ status: 500, body: {} }),
  });
  try {
    assert.equal((await save(charWith(NEW_PORTRAIT))).status, 200);
  } finally {
    mock.restore();
  }
});
