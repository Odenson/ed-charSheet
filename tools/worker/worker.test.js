// worker.test.js — run with `npm test` (node --test, no deps).
//
// Exercises the serverless save handler (worker.js) with a mocked GitHub fetch.
// Covers runbook Phase 4 / design §4.6: auth (fail-closed SAVE_KEY), routing,
// body/schema/size validation, the per-character-file upsert contract
// (PLAN-SAVE-CONCURRENCY: write `data/characters/<id>.json` as the raw
// ed-character/1 entry, base-check → `stale_base` conflict or PUT, create-only
// index maintenance, no-base bounded 409 retry), cross-character isolation, and
// upstream-failure mapping. Plus the /save-items route (PLAN-CUSTOM-ITEMS P3):
// the custom-items catalog upsert (merge + delete + PUT whole ed-items/2 file),
// validation via the shared engine/validate-item.js gate, size/count caps, and
// the same retry/failure map.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

// --- env & request helpers ---------------------------------------------------

const ENV = {
  SAVE_KEY: 'secret-key',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'odenson',
  GITHUB_REPO: 'ed-charSheet',
  GITHUB_CHARS_DIR: 'data/characters',
  GITHUB_BRANCH: 'character-data',
};

const CHAR = { schema: 'ed-character/1', meta: { name: 'Test' } };

function req(body, { method = 'POST', path = '/save', key = ENV.SAVE_KEY } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== null) headers['x-save-key'] = key;
  return new Request(`https://worker.test${path}`, {
    method,
    headers,
    body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

// Install a scripted globalThis.fetch. `routes` maps "METHOD path-fragment" to a
// handler returning { status, body }. Records every call for assertions.
function mockGitHub(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const u = String(url);
    const pathname = new URL(u).pathname; // ignore the ?ref= query
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
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

// Branch already exists → ensureBranch is a no-op after one GET.
const branchExists = { 'GET /git/ref/heads/character-data': () => ({ status: 200, body: { ref: 'ok' } }) };

// --- per-character-file fixtures (PLAN-SAVE-CONCURRENCY) ---------------------

const fileB64 = (file) => Buffer.from(JSON.stringify(file), 'utf8').toString('base64');
const CHAR_PATH = 'data/characters/chakka.json';
const INDEX_PATH = 'data/characters/index.json';

// GET one character file: the worker only reads its sha (the blob sha / ETag).
const readsCharFile = (path, sha) => ({
  [`GET /contents/${path}`]: () => ({ status: 200, body: { sha } }),
});
const readsChar404 = (path) => ({
  [`GET /contents/${path}`]: () => ({ status: 404, body: {} }),
});
const putCharOk = (path, commitSha = 'char-commit') => ({
  [`PUT /contents/${path}`]: () => ({
    status: 200,
    body: { content: { sha: commitSha }, html_url: `https://github.com/commit/${commitSha}` },
  }),
});

// The discovery index (create-only maintenance; never a save target).
const INDEX = { schema: 'ed-characters-index/1', characters: {} };
const readsIndex = (file = INDEX, sha = 'index-sha') => ({
  [`GET /contents/${INDEX_PATH}`]: () => ({ status: 200, body: { sha, content: fileB64(file), encoding: 'base64' } }),
});
const readsIndex404 = () => ({
  [`GET /contents/${INDEX_PATH}`]: () => ({ status: 404, body: {} }),
});
const putIndexOk = () => ({
  [`PUT /contents/${INDEX_PATH}`]: () => ({
    status: 200,
    body: { content: { sha: 'index-commit' }, html_url: 'https://github.com/commit/index-commit' },
  }),
});

// --- custom-items fixtures ----------------------------------------------------

const ITEM = {
  kind: 'gear',
  effects: [{ type: 'note', summary: 'A lantern that sheds light for 30 yards.' }],
};
const ITEM2 = {
  kind: 'magic-item',
  effects: [
    { type: 'test-modifier', operation: 'add', value: 1, measure: 'step', target: { domain: 'test', name: 'Search' }, summary: '+1 step on Search tests' },
  ],
};
const ITEMS = {
  schema: 'ed-items/2',
  effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
  source: 'custom',
  notes: 'Player-created items.',
  items: { Lantern: ITEM, 'Ring of Searching': ITEM2 },
};
const itemsB64 = (file) => Buffer.from(JSON.stringify(file), 'utf8').toString('base64');
const readsItems = (file, sha = 'items-sha') => ({
  'GET /contents/data/custom-items.json': () => ({ status: 200, body: { sha, content: itemsB64(file), encoding: 'base64' } }),
});
const putItemsOk = (commitSha = 'items-commit') => ({
  'PUT /contents/data/custom-items.json': () => ({
    status: 200,
    body: { content: { sha: commitSha }, html_url: `https://github.com/commit/${commitSha}` },
  }),
});

async function call(request, env = ENV) {
  const res = await worker.fetch(request, env);
  const json = await res.json();
  return { status: res.status, json };
}

// --- auth (fail closed) ------------------------------------------------------

test('missing save key → 401', async () => {
  const { status, json } = await call(req(CHAR, { key: null }));
  assert.equal(status, 401);
  assert.equal(json.error.code, 'unauthorized');
});

test('wrong save key → 401', async () => {
  const { status } = await call(req(CHAR, { key: 'nope' }));
  assert.equal(status, 401);
});

test('SAVE_KEY unconfigured → 401 (fail closed, even with correct-looking request)', async () => {
  const { status } = await call(req(CHAR), { ...ENV, SAVE_KEY: undefined });
  assert.equal(status, 401);
});

// --- routing -----------------------------------------------------------------

test('wrong path → 404', async () => {
  const { status } = await call(req(CHAR, { path: '/nope' }));
  assert.equal(status, 404);
});

test('wrong method → 404', async () => {
  const { status } = await call(req(undefined, { method: 'GET' }));
  assert.equal(status, 404);
});

test('OPTIONS preflight → 204 with CORS headers', async () => {
  const res = await worker.fetch(req(undefined, { method: 'OPTIONS' }), ENV);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
});

// --- validation --------------------------------------------------------------

test('non-JSON body → 400', async () => {
  const { status, json } = await call(req('this is not json{'));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_json');
});

test('bare file without the { character, id } envelope → 400', async () => {
  const { status, json } = await call(req(CHAR));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

test('missing id → 400 invalid_id', async () => {
  const { status, json } = await call(req({ character: CHAR }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_id');
});

test('invalid id (path traversal / bad chars) → 400 invalid_id', async () => {
  for (const bad of ['../evil', 'A/b', 'a b', '..', 'a.b', 'É', 42, '']) {
    const { status, json } = await call(req({ character: CHAR, id: bad }));
    assert.equal(status, 400, `id ${JSON.stringify(bad)} → 400`);
    assert.equal(json.error.code, 'invalid_id');
  }
});

test('wrong schema → 400', async () => {
  const { status, json } = await call(req({ schema: 'ed-character/999', id: 'chakka' }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

test('oversized character → 400', async () => {
  const big = { character: { schema: 'ed-character/1', blob: 'x'.repeat(600 * 1024) }, id: 'chakka' };
  const { status, json } = await call(req(big));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

test('non-string base → 400 invalid_base', async () => {
  for (const bad of [42, true, { sha: 'x' }, ['x']]) {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka', base: bad }));
    assert.equal(status, 400, `base ${JSON.stringify(bad)} → 400`);
    assert.equal(json.error.code, 'invalid_base');
  }
});

// --- per-character-file upsert (PLAN-SAVE-CONCURRENCY) -----------------------

test('save with id → writes the raw ed-character/1 file, no grouped wrapper', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsCharFile(CHAR_PATH, 'char-sha'), ...putCharOk(CHAR_PATH) });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.commit.sha, 'char-commit', "commit.sha = new file blob sha (the client's next base)");
    assert.equal(json.commit.url, 'https://github.com/commit/char-commit');

    const put = mock.calls.find((c) => c.method === 'PUT');
    assert.ok(put.url.endsWith(`/contents/${CHAR_PATH}`), 'writes only its own file');
    const sent = JSON.parse(put.options.body);
    assert.equal(sent.sha, 'char-sha', 'PUT carries the file sha from the GET');
    assert.equal(sent.branch, 'character-data', 'branch is env-pinned, not from request');
    // Byte-identical to the local file save: the raw character, pretty + newline.
    const expected = JSON.stringify(CHAR, null, 2) + '\n';
    assert.equal(Buffer.from(sent.content, 'base64').toString('utf8'), expected);
    assert.ok(!mock.calls.some((c) => c.url.includes('index.json')), 'ordinary save never touches the index');
  } finally {
    mock.restore();
  }
});

test('save with a matching base → PUT carries the file sha, 200', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsCharFile(CHAR_PATH, 'char-sha'), ...putCharOk(CHAR_PATH) });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka', base: 'char-sha' }));
    assert.equal(status, 200);
    assert.equal(json.commit.sha, 'char-commit');
    const sent = JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body);
    assert.equal(sent.sha, 'char-sha', 'matching base is written through as the PUT sha');
  } finally {
    mock.restore();
  }
});

test('save with a stale base → 409 stale_base + current sha, no PUT', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsCharFile(CHAR_PATH, 'current-sha') });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka', base: 'old-sha' }));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'stale_base');
    assert.equal(json.error.sha, 'current-sha', 'stale_base carries the current file sha');
    assert.ok(!mock.calls.some((c) => c.method === 'PUT'), 'stale base never reaches a PUT');
  } finally {
    mock.restore();
  }
});

test('raced 409 (base matched the read, PUT 409s) → 409 stale_base with the fresh sha', async () => {
  let reads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/characters/chakka.json': () => {
      reads += 1;
      return { status: 200, body: { sha: reads === 1 ? 'char-sha' : 'newer-sha' } };
    },
    'PUT /contents/data/characters/chakka.json': () => {
      puts += 1;
      return { status: 409, body: {} };
    },
  });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka', base: 'char-sha' }));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'stale_base');
    assert.equal(json.error.sha, 'newer-sha', 're-reads the current sha for keep-mine');
    assert.equal(puts, 1, 'base-caller never retries a stale PUT');
  } finally {
    mock.restore();
  }
});

test('save with a base but no file (404) → creates; base ignored', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsChar404(CHAR_PATH),
    ...readsIndex404(),
    ...putCharOk(CHAR_PATH),
    ...putIndexOk(),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka', base: 'whatever-sha' }));
    assert.equal(status, 200);
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(puts.length, 2, 'file create + index ensure');
    const filePut = JSON.parse(puts[0].options.body);
    assert.equal(filePut.sha, undefined, 'create carries no sha (base ignored)');
    assert.deepEqual(JSON.parse(Buffer.from(filePut.content, 'base64').toString('utf8')), CHAR);
  } finally {
    mock.restore();
  }
});

test('missing file (404) → creates the file and indexes it (creating the index if absent)', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsChar404(CHAR_PATH),
    ...readsIndex404(),
    ...putCharOk(CHAR_PATH),
    ...putIndexOk(),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(puts.length, 2, 'file create + index ensure');
    const indexPut = JSON.parse(puts[1].options.body);
    assert.ok(puts[1].url.endsWith(`/contents/${INDEX_PATH}`), 'second PUT is the index');
    assert.equal(indexPut.sha, undefined, 'index create carries no sha');
    assert.deepEqual(JSON.parse(Buffer.from(indexPut.content, 'base64').toString('utf8')), {
      schema: 'ed-characters-index/1',
      characters: { chakka: { name: 'Test', portrait: null } },
    });
  } finally {
    mock.restore();
  }
});

test('create does not rewrite the index when the entry already exists', async () => {
  const existing = { schema: 'ed-characters-index/1', characters: { chakka: { name: 'Chakka' } } };
  const mock = mockGitHub({
    ...branchExists,
    ...readsChar404(CHAR_PATH),
    ...readsIndex(existing),
    ...putCharOk(CHAR_PATH),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    const indexCalls = mock.calls.filter((c) => c.url.includes('index.json'));
    assert.equal(indexCalls.length, 1, 'one index GET, no index PUT');
    assert.equal(indexCalls[0].method, 'GET');
  } finally {
    mock.restore();
  }
});

test('create indexes the portrait so the picker keeps its §6a thumbnails', async () => {
  const withPortrait = { ...CHAR, meta: { name: 'Chakka', portrait: 'data/chakka.jpg' } };
  const mock = mockGitHub({
    ...branchExists,
    ...readsChar404(CHAR_PATH),
    ...readsIndex404(),
    ...putCharOk(CHAR_PATH),
    ...putIndexOk(),
  });
  try {
    const { status } = await call(req({ character: withPortrait, id: 'chakka' }));
    assert.equal(status, 200);
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    const indexPut = JSON.parse(puts[1].options.body);
    const written = JSON.parse(Buffer.from(indexPut.content, 'base64').toString('utf8'));
    assert.deepEqual(written.characters.chakka, { name: 'Chakka', portrait: 'data/chakka.jpg' });
  } finally {
    mock.restore();
  }
});

test('failed index write on create is tolerated (save still 200)', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsChar404(CHAR_PATH),
    ...readsIndex(),
    'PUT /contents/data/characters/index.json': () => ({ status: 409, body: {} }),
    ...putCharOk(CHAR_PATH),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200, 'a failed index write never fails the save');
  } finally {
    mock.restore();
  }
});

test('a rename save (existing file, new meta.name) touches only the character file', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsCharFile(CHAR_PATH, 'char-sha'),
    ...putCharOk(CHAR_PATH),
  });
  try {
    const renamed = { ...CHAR, meta: { name: 'Chakka II' } };
    const { status } = await call(req({ character: renamed, id: 'chakka' }));
    assert.equal(status, 200);
    assert.ok(!mock.calls.some((c) => c.url.includes('index.json')), 'rename never touches the index (entry goes stale)');
    const written = JSON.parse(Buffer.from(JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body).content, 'base64').toString('utf8'));
    assert.equal(written.meta.name, 'Chakka II');
  } finally {
    mock.restore();
  }
});

test('non-Latin1 content (em-dash, ✦ star) encodes as UTF-8 base64, not btoa-throws', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsCharFile(CHAR_PATH, 'char-sha'), ...putCharOk(CHAR_PATH) });
  try {
    // Real character data has em-dashes in the background; magic items use ✦.
    const unicodeChar = { schema: 'ed-character/1', meta: { name: 'Chakka' }, note: 'freedom — at last ✦' };
    const { status, json } = await call(req({ character: unicodeChar, id: 'chakka' }));
    assert.equal(status, 200, 'must not 502 on btoa InvalidCharacterError');
    assert.equal(json.ok, true);
    const written = Buffer.from(JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body).content, 'base64').toString('utf8');
    assert.ok(written.includes('freedom — at last ✦'), 'UTF-8 round-trips through the file write');
  } finally {
    mock.restore();
  }
});

test('every GitHub request carries a User-Agent (GitHub 403s without one)', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsCharFile(CHAR_PATH, 'char-sha'), ...putCharOk(CHAR_PATH) });
  try {
    await call(req({ character: CHAR, id: 'chakka' }));
    const ghCalls = mock.calls.filter((c) => c.url.includes('api.github.com'));
    assert.ok(ghCalls.length > 0, 'made at least one GitHub call');
    for (const c of ghCalls) {
      assert.ok(c.options.headers['User-Agent'], `missing User-Agent on ${c.method} ${c.url}`);
    }
  } finally {
    mock.restore();
  }
});

test('missing branch is created before the first write', async () => {
  let branchCreated = false;
  const mock = mockGitHub({
    'GET /git/ref/heads/character-data': () => ({ status: 404, body: {} }),
    'GET /repos/odenson/ed-charSheet': () => ({ status: 200, body: { default_branch: 'main' } }),
    'GET /git/ref/heads/main': () => ({ status: 200, body: { object: { sha: 'base-sha' } } }),
    'POST /git/refs': () => {
      branchCreated = true;
      return { status: 201, body: { ref: 'refs/heads/character-data' } };
    },
    ...readsCharFile(CHAR_PATH, 'char-sha'),
    ...putCharOk(CHAR_PATH),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    assert.ok(branchCreated, 'ensureBranch POSTed a new ref');
  } finally {
    mock.restore();
  }
});

// --- no-base legacy overwrite (bounded 409 retry) -----------------------------

test('no-base save 409 then 200 → retry re-reads the moved file sha', async () => {
  let reads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/characters/chakka.json': () => {
      reads += 1;
      return { status: 200, body: { sha: `s${reads}` } };
    },
    'PUT /contents/data/characters/chakka.json': () => {
      puts += 1;
      if (puts === 1) return { status: 409, body: {} };
      return { status: 200, body: { content: { sha: 'ok', html_url: 'u' } } };
    },
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    assert.equal(puts, 2, 'retried once');
    const putsArr = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(putsArr[1].options.body).sha, 's2', 'retry re-reads the moved sha');
  } finally {
    mock.restore();
  }
});

test('no-base persistent 409 → 409 conflict after MAX_RETRIES', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsCharFile(CHAR_PATH, 'char-sha'),
    'PUT /contents/data/characters/chakka.json': () => ({ status: 409, body: {} }),
  });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'conflict');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 3);
  } finally {
    mock.restore();
  }
});

// --- cross-character isolation -----------------------------------------------

test('two characters save to two separate files with no false conflict', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsCharFile('data/characters/chakka.json', 'a-sha'),
    ...readsCharFile('data/characters/sarn.json', 'b-sha'),
    ...putCharOk('data/characters/chakka.json', 'a-commit'),
    ...putCharOk('data/characters/sarn.json', 'b-commit'),
  });
  try {
    const a = await call(req({ character: CHAR, id: 'chakka', base: 'a-sha' }));
    const b = await call(req({ character: { ...CHAR, meta: { name: 'Sarn' } }, id: 'sarn', base: 'b-sha' }));
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(puts.length, 2);
    assert.ok(puts.some((c) => c.url.endsWith('/contents/data/characters/chakka.json')));
    assert.ok(puts.some((c) => c.url.endsWith('/contents/data/characters/sarn.json')));
    const gets = mock.calls.filter((c) => c.method === 'GET' && c.url.includes('/contents/'));
    assert.ok(!gets.some((c) => c.url.includes('index.json')), 'no index traffic on ordinary saves');
  } finally {
    mock.restore();
  }
});

// --- upstream failure --------------------------------------------------------

test('non-409 GitHub failure (403) → 502 upstream', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsCharFile(CHAR_PATH, 'char-sha'),
    'PUT /contents/data/characters/chakka.json': () => ({ status: 403, body: {} }),
  });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 502);
    assert.equal(json.error.code, 'upstream');
  } finally {
    mock.restore();
  }
});

// --- custom-items catalog (/save-items) --------------------------------------

test('save-items upserts new items and PUTs the whole catalog', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    const { status, json } = await call(req({ items: { 'New Item': ITEM } }, { path: '/save-items' }));
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.commit.sha, 'items-commit');

    const put = mock.calls.find((c) => c.method === 'PUT');
    assert.ok(put.url.endsWith('/contents/data/custom-items.json'), 'writes the catalog file');
    const sent = JSON.parse(put.options.body);
    assert.equal(sent.sha, 'items-sha', 'PUT carries the sha from the GET');
    assert.equal(sent.branch, 'character-data', 'branch is env-pinned, not from request');
    assert.equal(sent.message, 'Save custom items (serverless)');
    // Byte-identical to the local file save: pretty JSON + trailing newline.
    const expected = JSON.stringify({ ...ITEMS, items: { ...ITEMS.items, 'New Item': ITEM } }, null, 2) + '\n';
    assert.equal(Buffer.from(sent.content, 'base64').toString('utf8'), expected);
  } finally {
    mock.restore();
  }
});

test('save-items custom item wins over a canon-name collision', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    await call(req({ items: { Lantern: ITEM2 } }, { path: '/save-items' }));
    const written = JSON.parse(Buffer.from(JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body).content, 'base64').toString('utf8'));
    assert.deepEqual(written.items.Lantern, ITEM2, 'posted item replaces the existing entry');
  } finally {
    mock.restore();
  }
});

test('save-items delete removes the named item', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    await call(req({ delete: ['Lantern'] }, { path: '/save-items' }));
    const written = JSON.parse(Buffer.from(JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body).content, 'base64').toString('utf8'));
    assert.deepEqual(written.items, { 'Ring of Searching': ITEM2 });
  } finally {
    mock.restore();
  }
});

test('missing catalog (404) → creates a fresh ed-items/2 file', async () => {
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/custom-items.json': () => ({ status: 404, body: {} }),
    ...putItemsOk(),
  });
  try {
    const { status } = await call(req({ items: { Lantern: ITEM } }, { path: '/save-items' }));
    assert.equal(status, 200);
    const sent = JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body);
    assert.equal(sent.sha, undefined, 'no sha on a create');
    const written = JSON.parse(Buffer.from(sent.content, 'base64').toString('utf8'));
    assert.equal(written.schema, 'ed-items/2');
    assert.deepEqual(written.items, { Lantern: ITEM });
  } finally {
    mock.restore();
  }
});

test('invalid item delta → 400 invalid_items, no PUT', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    ...readsItems(ITEMS),
    'PUT /contents/data/custom-items.json': () => {
      puts += 1;
      return { status: 200, body: {} };
    },
  });
  try {
    const cases = [
      { items: { Broken: { kind: 'spaceship', effects: [] } } }, // unknown kind
      { items: { Broken: { kind: 'gear', effects: [{ type: 'note' }] } } }, // note needs a summary
      { items: { Broken: { kind: 'gear', effects: [{ type: 'defense-modifier', operation: 'add', value: 1, target: { domain: 'attribute', name: 'Dexterity' }, summary: 'x' }] } } }, // domain mismatch
      { items: { Bad: 'not an item' } },
      { items: { Bad: null } },
      { delete: [''] },
      { items: 'nope' },
    ];
    for (const body of cases) {
      const { status, json } = await call(req(body, { path: '/save-items' }));
      assert.equal(status, 400, `delta ${JSON.stringify(body)} → 400`);
      assert.equal(json.error.code, 'invalid_items');
    }
    assert.equal(puts, 0, 'invalid delta never reaches a PUT');
  } finally {
    mock.restore();
  }
});

test('oversized single item (over 4096 bytes) → 400 invalid_items', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    const big = { kind: 'gear', effects: [{ type: 'note', summary: 'x'.repeat(5000) }] };
    const { status, json } = await call(req({ items: { Huge: big } }, { path: '/save-items' }));
    assert.equal(status, 400);
    assert.equal(json.error.code, 'invalid_items');
  } finally {
    mock.restore();
  }
});

test('merged catalog over the caps (200 items) → 400 invalid_items, no PUT', async () => {
  const many = {};
  for (let i = 0; i < 200; i++) many[`item-${i}`] = ITEM;
  const bigFile = { schema: 'ed-items/2', effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)', source: 'custom', notes: '', items: many };
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    ...readsItems(bigFile),
    'PUT /contents/data/custom-items.json': () => {
      puts += 1;
      return { status: 200, body: {} };
    },
  });
  try {
    const { status, json } = await call(req({ items: { overflow: ITEM } }, { path: '/save-items' }));
    assert.equal(status, 400);
    assert.equal(json.error.code, 'invalid_items');
    assert.equal(puts, 0, 'over-cap merged file never reaches a PUT');
  } finally {
    mock.restore();
  }
});

test('save-items keeps UTF-8 content (em-dash, ✦ star) through the catalog merge', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    const unicodeItem = { kind: 'gear', effects: [{ type: 'note', summary: 'freedom — at last ✦' }] };
    const { status } = await call(req({ items: { Relic: unicodeItem } }, { path: '/save-items' }));
    assert.equal(status, 200);
    const written = Buffer.from(JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body).content, 'base64').toString('utf8');
    assert.ok(written.includes('freedom — at last ✦'), 'UTF-8 round-trips through the catalog merge');
  } finally {
    mock.restore();
  }
});

test('save-items fails closed on auth (wrong key → 401)', async () => {
  const { status } = await call(req({ items: {} }, { path: '/save-items', key: 'nope' }));
  assert.equal(status, 401);
});

test('a /save-items request must carry the items envelope (character-shaped body → 400)', async () => {
  const { status, json } = await call(req({ character: CHAR, id: 'chakka' }, { path: '/save-items' }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_items');
});

test('a /save request still rejects items-shaped bodies', async () => {
  const { status, json } = await call(req({ items: { x: ITEM } }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

test('save-items target is env-pinned to GITHUB_ITEMS_PATH', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsItems(ITEMS), ...putItemsOk() });
  try {
    const env = { ...ENV, GITHUB_ITEMS_PATH: 'data/custom-items.json' };
    const { status } = await call(req({ items: { x: ITEM } }, { path: '/save-items' }), env);
    assert.equal(status, 200);
    assert.ok(mock.calls.find((c) => c.method === 'PUT').url.endsWith('/contents/data/custom-items.json'));
  } finally {
    mock.restore();
  }
});

test('save-items 409 then 200 → retry re-reads the moved sha', async () => {
  let reads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/custom-items.json': () => {
      reads += 1;
      return { status: 200, body: { sha: `s${reads}`, content: itemsB64(ITEMS) } };
    },
    'PUT /contents/data/custom-items.json': () => {
      puts += 1;
      return puts === 1 ? { status: 409, body: {} } : { status: 200, body: { content: { sha: 'ok', html_url: 'u' } } };
    },
  });
  try {
    const { status } = await call(req({ items: { x: ITEM } }, { path: '/save-items' }));
    assert.equal(status, 200);
    assert.equal(puts, 2, 'retried once');
    const putsArr = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(putsArr[1].options.body).sha, 's2', 'retry re-reads the moved sha');
  } finally {
    mock.restore();
  }
});

test('save-items persistent 409 → 409 conflict after MAX_RETRIES', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsItems(ITEMS),
    'PUT /contents/data/custom-items.json': () => ({ status: 409, body: {} }),
  });
  try {
    const { status, json } = await call(req({ items: { x: ITEM } }, { path: '/save-items' }));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'conflict');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 3);
  } finally {
    mock.restore();
  }
});

test('save-items non-409 GitHub failure (403) → 502 upstream', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsItems(ITEMS),
    'PUT /contents/data/custom-items.json': () => ({ status: 403, body: {} }),
  });
  try {
    const { status, json } = await call(req({ items: { x: ITEM } }, { path: '/save-items' }));
    assert.equal(status, 502);
    assert.equal(json.error.code, 'upstream');
  } finally {
    mock.restore();
  }
});
