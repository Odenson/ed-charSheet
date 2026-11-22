// store-server-image.test.js — run with `npm test`.
// plans/add-char-portrait I5: store-server.js `saveImage(staged, { endpoint, saveKey, id })` and
// DEFAULT_IMAGE_ENDPOINT. Success ONLY on ok:true; `exists` is a hard failure. No Earthdawn rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveImage, SaveError, DEFAULT_ENDPOINT, DEFAULT_IMAGE_ENDPOINT } from './store-server.js';

const BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const STAGED = {
  path: 'data/chakka-1700000000000.jpg',
  mime: 'image/jpeg',
  dataUrl: `data:image/jpeg;base64,${BYTES.toString('base64')}`,
};

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

const OK = { ok: true, path: STAGED.path, sha: 'blob', url: 'u' };

test('DEFAULT_IMAGE_ENDPOINT is the save endpoint host with /save-image', () => {
  assert.equal(DEFAULT_IMAGE_ENDPOINT, DEFAULT_ENDPOINT.replace(/\/save$/, '/save-image'));
});

test('saveImage POSTs { id, filename, content } (base64, no data-URL prefix) with the key header', async () => {
  const mock = mockFetch(() => ({ status: 200, body: OK }));
  try {
    await saveImage(STAGED, { saveKey: 'k', id: 'chakka' });
    const { url, options } = mock.calls[0];
    assert.equal(url, DEFAULT_IMAGE_ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-save-key'], 'k');
    const sent = JSON.parse(options.body);
    assert.deepEqual(Object.keys(sent).sort(), ['content', 'filename', 'id']);
    assert.equal(sent.id, 'chakka');
    assert.equal(sent.filename, 'chakka-1700000000000.jpg', 'filename only, not the data/ path');
    assert.equal(sent.content, BYTES.toString('base64'));
    assert.ok(!sent.content.startsWith('data:'));
  } finally {
    mock.restore();
  }
});

test('saveImage honors a custom endpoint', async () => {
  const mock = mockFetch(() => ({ status: 200, body: OK }));
  try {
    await saveImage(STAGED, { saveKey: 'k', id: 'chakka', endpoint: 'https://example.test/save-image' });
    assert.equal(mock.calls[0].url, 'https://example.test/save-image');
  } finally {
    mock.restore();
  }
});

test('saveImage: missing key throws no_key before any request', async () => {
  const mock = mockFetch(() => ({ status: 200, body: OK }));
  try {
    await assert.rejects(saveImage(STAGED, { id: 'chakka' }), (e) => e instanceof SaveError && e.code === 'no_key');
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('saveImage: exists (409, different content) is a hard failure -> SaveError(exists)', async () => {
  const mock = mockFetch(() => ({ status: 409, body: { ok: false, error: { code: 'exists', message: 'different' } } }));
  try {
    await assert.rejects(saveImage(STAGED, { saveKey: 'k', id: 'chakka' }), (e) => e instanceof SaveError && e.code === 'exists');
  } finally {
    mock.restore();
  }
});

test('saveImage: 401 -> SaveError(unauthorized)', async () => {
  const mock = mockFetch(() => ({ status: 401, body: { ok: false, error: { code: 'unauthorized', message: 'bad key' } } }));
  try {
    await assert.rejects(saveImage(STAGED, { saveKey: 'w', id: 'chakka' }), (e) => e instanceof SaveError && e.code === 'unauthorized');
  } finally {
    mock.restore();
  }
});

test('saveImage: worker codes too_large / invalid_image / invalid_name surface as SaveError with that code', async () => {
  for (const code of ['too_large', 'invalid_image', 'invalid_name']) {
    const mock = mockFetch(() => ({ status: 400, body: { ok: false, error: { code, message: 'm' } } }));
    try {
      await assert.rejects(saveImage(STAGED, { saveKey: 'k', id: 'chakka' }), (e) => e instanceof SaveError && e.code === code);
    } finally {
      mock.restore();
    }
  }
});

test('saveImage: network failure -> SaveError(offline)', async () => {
  const mock = mockFetch({ throws: true });
  try {
    await assert.rejects(saveImage(STAGED, { saveKey: 'k', id: 'chakka' }), (e) => e instanceof SaveError && e.code === 'offline');
  } finally {
    mock.restore();
  }
});

test('saveImage: a 2xx without ok:true is NOT success', async () => {
  for (const body of [{}, { ok: false }, null]) {
    const mock = mockFetch(() => ({ status: 200, body }));
    try {
      await assert.rejects(saveImage(STAGED, { saveKey: 'k', id: 'chakka' }), (e) => e instanceof SaveError, JSON.stringify(body));
    } finally {
      mock.restore();
    }
  }
});

test('saveImage: opaque non-JSON error falls back to http_<status>', async () => {
  const mock = mockFetch(() => ({ status: 502, body: null }));
  try {
    await assert.rejects(saveImage(STAGED, { saveKey: 'k', id: 'chakka' }), (e) => e instanceof SaveError && e.code === 'http_502');
  } finally {
    mock.restore();
  }
});
