// worker.test.js — run with `npm test` (node --test, no deps).
//
// Exercises the serverless save handler (worker.js) with a mocked GitHub fetch.
// Covers runbook Phase 4 / design §4.6: auth (fail-closed SAVE_KEY), routing,
// body/schema/size validation, the happy-path GET-sha → PUT contract, the
// bounded 409 retry, and upstream-failure mapping.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

// --- env & request helpers ---------------------------------------------------

const ENV = {
  SAVE_KEY: 'secret-key',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'odenson',
  GITHUB_REPO: 'ed-charSheet',
  GITHUB_PATH: 'data/character.json',
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
const readsSha = (sha) => ({ 'GET /contents/data/character.json': () => ({ status: 200, body: { sha } }) });
const putOk = (commitSha = 'new-commit-sha') => ({
  'PUT /contents/data/character.json': () => ({
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

test('wrong schema → 400', async () => {
  const { status, json } = await call(req({ schema: 'ed-character/999' }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

test('oversized character → 400', async () => {
  const big = { schema: 'ed-character/1', blob: 'x'.repeat(600 * 1024) };
  const { status, json } = await call(req(big));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_character');
});

// --- happy path --------------------------------------------------------------

test('happy path → 200; PUT carries GET sha, pinned branch/path, byte-identical content', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSha('sha-123'), ...putOk('commit-abc') });
  try {
    const { status, json } = await call(req(CHAR));
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.commit.sha, 'commit-abc');
    assert.equal(json.commit.url, 'https://github.com/commit/commit-abc');

    const put = mock.calls.find((c) => c.method === 'PUT');
    const sent = JSON.parse(put.options.body);
    assert.equal(sent.sha, 'sha-123', 'PUT reuses the sha from the GET');
    assert.equal(sent.branch, 'character-data', 'branch is env-pinned, not from request');
    assert.ok(put.url.endsWith('/contents/data/character.json'), 'path is env-pinned');
    // Byte-identical to what the file save writes: pretty JSON + trailing newline.
    const expected = Buffer.from(JSON.stringify(CHAR, null, 2) + '\n').toString('base64');
    assert.equal(sent.content, expected);
  } finally {
    mock.restore();
  }
});

test('non-Latin1 content (em-dash, ✦ star) encodes as UTF-8 base64, not btoa-throws', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSha('s'), ...putOk() });
  try {
    // Real character.json has em-dashes in the background; magic items use ✦.
    const unicodeChar = { schema: 'ed-character/1', meta: { name: 'Chakka' }, note: 'freedom — at last ✦' };
    const { status, json } = await call(req(unicodeChar));
    assert.equal(status, 200, 'must not 502 on btoa InvalidCharacterError');
    assert.equal(json.ok, true);
    const put = mock.calls.find((c) => c.method === 'PUT');
    const sent = JSON.parse(put.options.body);
    // base64 of the UTF-8 bytes — what GitHub stores and what the file save writes.
    const expected = Buffer.from(JSON.stringify(unicodeChar, null, 2) + '\n', 'utf8').toString('base64');
    assert.equal(sent.content, expected);
    // Round-trips back to the exact bytes (multi-byte chars intact).
    assert.equal(Buffer.from(sent.content, 'base64').toString('utf8'), JSON.stringify(unicodeChar, null, 2) + '\n');
  } finally {
    mock.restore();
  }
});

test('every GitHub request carries a User-Agent (GitHub 403s without one)', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSha('s'), ...putOk() });
  try {
    await call(req(CHAR));
    const ghCalls = mock.calls.filter((c) => c.url.includes('api.github.com'));
    assert.ok(ghCalls.length > 0, 'made at least one GitHub call');
    for (const c of ghCalls) {
      assert.ok(c.options.headers['User-Agent'], `missing User-Agent on ${c.method} ${c.url}`);
    }
  } finally {
    mock.restore();
  }
});

test('accepts { character } envelope as well as the bare file', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSha('s'), ...putOk() });
  try {
    const { status } = await call(req({ character: CHAR }));
    assert.equal(status, 200);
  } finally {
    mock.restore();
  }
});

// --- grouped store (save with id) -------------------------------------------

const STORE = {
  schema: 'ed-characters/1',
  characters: { chakka: { schema: 'ed-character/1', meta: { name: 'Chakka' } } },
};
const storeB64 = (store) => Buffer.from(JSON.stringify(store), 'utf8').toString('base64');
const readsStore = (store, sha = 'store-sha') => ({
  'GET /contents/data/characters.json': () => ({ status: 200, body: { sha, content: storeB64(store), encoding: 'base64' } }),
});
const putStoreOk = (commitSha = 'store-commit') => ({
  'PUT /contents/data/characters.json': () => ({
    status: 200,
    body: { content: { sha: commitSha }, html_url: `https://github.com/commit/${commitSha}` },
  }),
});

test('save with id → replaces characters[id] in the grouped store and PUTs it whole', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsStore(STORE), ...putStoreOk() });
  try {
    const { status, json } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    assert.equal(json.commit.sha, 'store-commit');

    const put = mock.calls.find((c) => c.method === 'PUT');
    assert.ok(put.url.endsWith('/contents/data/characters.json'), 'writes the grouped store, not character.json');
    const sent = JSON.parse(put.options.body);
    assert.equal(sent.sha, 'store-sha', 'PUT carries the store sha from the GET');
    assert.equal(sent.branch, 'character-data', 'branch is env-pinned');
    const written = JSON.parse(Buffer.from(sent.content, 'base64').toString('utf8'));
    assert.equal(written.schema, 'ed-characters/1');
    assert.deepEqual(written.characters.chakka, CHAR, 'posted entry replaces characters[chakka]');
  } finally {
    mock.restore();
  }
});

test('save with id preserves the other entries in the store', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsStore(STORE), ...putStoreOk() });
  try {
    await call(req({ character: { ...CHAR, meta: { name: 'Other' } }, id: 'other' }));
    const put = mock.calls.find((c) => c.method === 'PUT');
    const written = JSON.parse(Buffer.from(JSON.parse(put.options.body).content, 'base64').toString('utf8'));
    assert.ok(written.characters.chakka, 'chakka still present');
    assert.equal(written.characters.other.meta.name, 'Other');
  } finally {
    mock.restore();
  }
});

test('missing store (404) → creates a fresh ed-characters/1 store', async () => {
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/characters.json': () => ({ status: 404, body: {} }),
    ...putStoreOk(),
  });
  try {
    const { status } = await call(req({ character: CHAR, id: 'chakka' }));
    assert.equal(status, 200);
    const sent = JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body);
    assert.equal(sent.sha, undefined, 'no sha on a create');
    const written = JSON.parse(Buffer.from(sent.content, 'base64').toString('utf8'));
    assert.deepEqual(written, { schema: 'ed-characters/1', characters: { chakka: CHAR } });
  } finally {
    mock.restore();
  }
});

test('invalid id (path traversal / bad chars) → 400 invalid_id', async () => {
  for (const bad of ['../evil', 'A/b', 'a b', '..', 'a.b', 'É', 42, '']) {
    const { status, json } = await call(req({ character: CHAR, id: bad }));
    assert.equal(status, 400, `id ${JSON.stringify(bad)} → 400`);
    assert.equal(json.error.code, 'invalid_id');
  }
});

test('grouped-store 409 then 200 → retry re-reads the moved store sha', async () => {
  let reads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/characters.json': () => {
      reads += 1;
      return { status: 200, body: { sha: `s${reads}`, content: storeB64(STORE) } };
    },
    'PUT /contents/data/characters.json': () => {
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
    ...readsSha('s'),
    ...putOk(),
  });
  try {
    const { status } = await call(req(CHAR));
    assert.equal(status, 200);
    assert.ok(branchCreated, 'ensureBranch POSTed a new ref');
  } finally {
    mock.restore();
  }
});

// --- conflict retry ----------------------------------------------------------

test('409 then 200 → second PUT carries the freshly re-read sha', async () => {
  let shaReads = 0;
  let putAttempts = 0;
  const mock = mockGitHub({
    ...branchExists,
    'GET /contents/data/character.json': () => {
      shaReads += 1;
      return { status: 200, body: { sha: `sha-${shaReads}` } };
    },
    'PUT /contents/data/character.json': () => {
      putAttempts += 1;
      if (putAttempts === 1) return { status: 409, body: {} };
      return { status: 200, body: { content: { sha: 'ok' }, html_url: 'u' } };
    },
  });
  try {
    const { status } = await call(req(CHAR));
    assert.equal(status, 200);
    assert.equal(putAttempts, 2, 'retried once');
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(puts[1].options.body).sha, 'sha-2', 'retry re-reads the moved sha');
  } finally {
    mock.restore();
  }
});

test('persistent 409 → 409 conflict after MAX_RETRIES', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsSha('s'),
    'PUT /contents/data/character.json': () => ({ status: 409, body: {} }),
  });
  try {
    const { status, json } = await call(req(CHAR));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'conflict');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 3);
  } finally {
    mock.restore();
  }
});

// --- upstream failure --------------------------------------------------------

test('non-409 GitHub failure (403) → 502 upstream', async () => {
  const mock = mockGitHub({
    ...branchExists,
    ...readsSha('s'),
    'PUT /contents/data/character.json': () => ({ status: 403, body: {} }),
  });
  try {
    const { status, json } = await call(req(CHAR));
    assert.equal(status, 502);
    assert.equal(json.error.code, 'upstream');
  } finally {
    mock.restore();
  }
});
