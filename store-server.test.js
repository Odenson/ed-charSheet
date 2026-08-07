// store-server.test.js — run with `npm test` (node --test, no deps).
// Verifies the GitHub save target: request shape, success unwrap, and the typed
// SaveError mapping for the failure modes the UI feeds back to the player.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveServer, SaveError, DEFAULT_ENDPOINT } from './store-server.js';

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

test('happy path: POSTs { character, id } with the key header, returns the commit', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'abc', url: 'https://gh/commit/abc' } } }));
  try {
    const commit = await saveServer(CHAR, { saveKey: 'k', id: 'chakka' });
    assert.deepEqual(commit, { sha: 'abc', url: 'https://gh/commit/abc' });
    const { url, options } = mock.calls[0];
    assert.equal(url, DEFAULT_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-save-key'], 'k');
    assert.deepEqual(JSON.parse(options.body), { character: CHAR, id: 'chakka' });
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
