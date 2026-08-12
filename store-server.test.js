// store-server.test.js — run with `npm test` (node --test, no deps).
// Verifies the GitHub save target: request shape (character + id + base
// concurrency token), success unwrap, the typed SaveConflictError for
// `stale_base`, and the SaveError mapping for the other failure modes the UI
// feeds back to the player.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveServer, SaveError, SaveConflictError, DEFAULT_ENDPOINT } from './store-server.js';

const CHAR = { schema: 'ed-character/1', meta: { name: 'Chakka' } };

// Install a one-shot global fetch. `impl(url, options)` returns { status, body }
// (body already an object), or set `throws` to simulate a network failure.
function mockFetch(impl) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (impl.throws) throw new TypeError('Failed to fetch');
    const { status = 200, body = {} } = impl(String(url), options);
    return new Response(body === null ? 'not json{' : JSON.stringify(body), { status });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('happy path: POSTs { character, id, base } with the key header, returns the commit', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'abc', url: 'https://gh/commit/abc' } } }));
  try {
    const commit = await saveServer(CHAR, { saveKey: 'k', id: 'chakka', base: 'base-sha' });
    assert.deepEqual(commit, { sha: 'abc', url: 'https://gh/commit/abc' });
    const { url, options } = mock.calls[0];
    assert.equal(url, DEFAULT_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-save-key'], 'k');
    assert.deepEqual(JSON.parse(options.body), { character: CHAR, id: 'chakka', base: 'base-sha' });
  } finally {
    mock.restore();
  }
});

test('no base → envelope still carries base: null (legacy overwrite path)', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'abc', url: 'u' } } }));
  try {
    await saveServer(CHAR, { saveKey: 'k', id: 'chakka' });
    assert.deepEqual(JSON.parse(mock.calls[0].options.body), { character: CHAR, id: 'chakka', base: null });
  } finally {
    mock.restore();
  }
});

test('success returns the new commit sha (the caller\'s next base)', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'new-blob-sha', url: 'u' } } }));
  try {
    const commit = await saveServer(CHAR, { saveKey: 'k', id: 'chakka' });
    assert.equal(commit.sha, 'new-blob-sha');
  } finally {
    mock.restore();
  }
});

test('stale_base → SaveConflictError with the current sha (routes to the modal)', async () => {
  const mock = mockFetch(() => ({ status: 409, body: { ok: false, error: { code: 'stale_base', message: 'changed', sha: 'current-sha' } } }));
  try {
    await assert.rejects(
      saveServer(CHAR, { saveKey: 'k', id: 'chakka', base: 'old-sha' }),
      (e) => e instanceof SaveConflictError && e instanceof SaveError && e.code === 'stale_base' && e.sha === 'current-sha',
    );
  } finally {
    mock.restore();
  }
});

test('stale_base without a sha in the payload → SaveConflictError with sha null (no fabricated base)', async () => {
  const mock = mockFetch(() => ({ status: 409, body: { ok: false, error: { code: 'stale_base' } } }));
  try {
    await assert.rejects(saveServer(CHAR, { saveKey: 'k', id: 'chakka', base: 'old-sha' }), (e) => e instanceof SaveConflictError && e.sha === null);
  } finally {
    mock.restore();
  }
});

test('exhausted no-base retry (code conflict) stays a plain SaveError → generic toast', async () => {
  const mock = mockFetch(() => ({ status: 409, body: { ok: false, error: { code: 'conflict', message: 'sha kept moving' } } }));
  try {
    await assert.rejects(
      saveServer(CHAR, { saveKey: 'k', id: 'chakka' }),
      (e) => e instanceof SaveError && !(e instanceof SaveConflictError) && e.code === 'conflict',
    );
  } finally {
    mock.restore();
  }
});

test('missing key throws no_key before any request', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: {} } }));
  try {
    await assert.rejects(saveServer(CHAR, {}), (e) => e instanceof SaveError && e.code === 'no_key');
    assert.equal(mock.calls.length, 0, 'no request made without a key');
  } finally {
    mock.restore();
  }
});

test('401 maps to a SaveError with code "unauthorized"', async () => {
  const mock = mockFetch(() => ({ status: 401, body: { ok: false, error: { code: 'unauthorized', message: 'bad key' } } }));
  try {
    await assert.rejects(saveServer(CHAR, { saveKey: 'wrong' }), (e) => e instanceof SaveError && e.code === 'unauthorized');
  } finally {
    mock.restore();
  }
});

test('network failure maps to code "offline"', async () => {
  const mock = mockFetch({ throws: true });
  try {
    await assert.rejects(saveServer(CHAR, { saveKey: 'k' }), (e) => e instanceof SaveError && e.code === 'offline');
  } finally {
    mock.restore();
  }
});

test('non-JSON / opaque error falls back to http_<status>', async () => {
  const mock = mockFetch(() => ({ status: 502, body: null })); // body:null => invalid JSON
  try {
    await assert.rejects(saveServer(CHAR, { saveKey: 'k' }), (e) => e instanceof SaveError && e.code === 'http_502');
  } finally {
    mock.restore();
  }
});

test('honors a custom endpoint', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 's', url: 'u' } } }));
  try {
    await saveServer(CHAR, { saveKey: 'k', endpoint: 'https://example.test/save' });
    assert.equal(mock.calls[0].url, 'https://example.test/save');
  } finally {
    mock.restore();
  }
});
