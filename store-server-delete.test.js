// store-server-delete.test.js — run with `npm test`.
// plans/delete-character I3a: store-server.js `deleteCharacterServer({id, base, deleteImage},
// {endpoint, saveKey})` and DEFAULT_DELETE_ENDPOINT. No Earthdawn rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteCharacterServer, SaveError, SaveConflictError, DEFAULT_ENDPOINT, DEFAULT_DELETE_ENDPOINT } from './store-server.js';

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
const OK = { ok: true, deleted: true, indexUpdated: true, imageDeleted: true };

test('DEFAULT_DELETE_ENDPOINT is the save endpoint host with /delete-character', () => {
  assert.equal(DEFAULT_DELETE_ENDPOINT, DEFAULT_ENDPOINT.replace(/\/save$/, '/delete-character'));
});

test('POSTs { id, base, deleteImage } with the key header and returns the result fields', async () => {
  const mock = mockFetch(() => ({ body: OK }));
  try {
    const out = await deleteCharacterServer({ id: 'chakka', base: 'sha1', deleteImage: 'data/x.jpg' }, { saveKey: 'k' });
    const { url, options } = mock.calls[0];
    assert.equal(url, DEFAULT_DELETE_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-save-key'], 'k');
    const sent = JSON.parse(options.body);
    assert.equal(sent.id, 'chakka');
    assert.equal(sent.base, 'sha1');
    assert.equal(sent.deleteImage, 'data/x.jpg');
    assert.equal(out.deleted, true);
    assert.equal(out.indexUpdated, true);
    assert.equal(out.imageDeleted, true);
  } finally {
    mock.restore();
  }
});

test('deleteImage omitted is not sent; a null base is sent as null or omitted (local dev)', async () => {
  const mock = mockFetch(() => ({ body: { ok: true, deleted: true, indexUpdated: true } }));
  try {
    await deleteCharacterServer({ id: 'chakka', base: null }, { saveKey: 'k' });
    const sent = JSON.parse(mock.calls[0].options.body);
    assert.ok(sent.deleteImage === undefined);
    assert.ok(sent.base === null || sent.base === undefined);
  } finally {
    mock.restore();
  }
});

test('surfaces imageSkipped from the worker', async () => {
  const mock = mockFetch(() => ({ body: { ok: true, deleted: true, indexUpdated: true, imageSkipped: 'shared' } }));
  try {
    const out = await deleteCharacterServer({ id: 'chakka', base: 's', deleteImage: 'data/x.jpg' }, { saveKey: 'k' });
    assert.equal(out.imageSkipped, 'shared');
  } finally {
    mock.restore();
  }
});

test('honors a custom endpoint', async () => {
  const mock = mockFetch(() => ({ body: OK }));
  try {
    await deleteCharacterServer({ id: 'chakka', base: 's' }, { saveKey: 'k', endpoint: 'https://example.test/delete-character' });
    assert.equal(mock.calls[0].url, 'https://example.test/delete-character');
  } finally {
    mock.restore();
  }
});

test('missing key throws SaveError(no_key) before any request', async () => {
  const mock = mockFetch(() => ({ body: OK }));
  try {
    await assert.rejects(deleteCharacterServer({ id: 'chakka', base: 's' }, {}), (e) => e instanceof SaveError && e.code === 'no_key');
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('401 -> SaveError(unauthorized)', async () => {
  const mock = mockFetch(() => ({ status: 401, body: { ok: false, error: { code: 'unauthorized', message: 'bad' } } }));
  try {
    await assert.rejects(deleteCharacterServer({ id: 'chakka', base: 's' }, { saveKey: 'w' }), (e) => e instanceof SaveError && e.code === 'unauthorized');
  } finally {
    mock.restore();
  }
});

test('network failure -> SaveError(offline)', async () => {
  const mock = mockFetch({ throws: true });
  try {
    await assert.rejects(deleteCharacterServer({ id: 'chakka', base: 's' }, { saveKey: 'k' }), (e) => e instanceof SaveError && e.code === 'offline');
  } finally {
    mock.restore();
  }
});

test('stale_base -> SaveConflictError carrying the current sha', async () => {
  const mock = mockFetch(() => ({ status: 409, body: { ok: false, error: { code: 'stale_base', message: 'changed', sha: 'cur' } } }));
  try {
    await assert.rejects(
      deleteCharacterServer({ id: 'chakka', base: 'old' }, { saveKey: 'k' }),
      (e) => e instanceof SaveConflictError && e.code === 'stale_base' && e.sha === 'cur',
    );
  } finally {
    mock.restore();
  }
});

test('other worker codes -> plain SaveError with that code and a non-empty message', async () => {
  for (const code of ['invalid_base', 'invalid_image', 'invalid_id']) {
    const mock = mockFetch(() => ({ status: 400, body: { ok: false, error: { code } } }));
    try {
      await assert.rejects(
        deleteCharacterServer({ id: 'chakka', base: 's' }, { saveKey: 'k' }),
        (e) => e instanceof SaveError && !(e instanceof SaveConflictError) && e.code === code && typeof e.message === 'string' && e.message.length > 0,
        code,
      );
    } finally {
      mock.restore();
    }
  }
});

test('non-JSON error response -> SaveError, never success', async () => {
  const mock = mockFetch(() => ({ status: 502, body: null }));
  try {
    await assert.rejects(deleteCharacterServer({ id: 'chakka', base: 's' }, { saveKey: 'k' }), (e) => e instanceof SaveError);
  } finally {
    mock.restore();
  }
});
