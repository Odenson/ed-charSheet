// store-list-characters.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A4: `listCharacters()` in store.js tolerates a MISSING index (spec A4 "store.js"):
//  - a 404 from the index returns [] on every path (the Pages contents API, the raw CDN, and the local
//    ./data/characters/index.json working copy) so an empty store opens the picker instead of an error;
//  - ANY other failure (500, network error) still throws - `loadJSON` attaches `err.status = res.status`;
//  - a parsed index without an object `characters` throws Error('Character index is malformed');
//  - the "no legacy grouped-store fallback" decision is untouched: no legacy file is ever read.
// Stubs globalThis.fetch and globalThis.location (the Pages/local switch), as the spec's Testability notes say.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { listCharacters } from './store.js';

let originalFetch;
let originalLocation;
let calls;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalLocation = globalThis.location;
  calls = [];
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.location = originalLocation;
});

const local = () => {
  globalThis.location = { protocol: 'http:', hostname: 'localhost' };
};
const pages = () => {
  globalThis.location = { protocol: 'https:', hostname: 'odenson.github.io' };
};

// responder(url, init) -> { status, body } | 'network-error'. `body` is serialised unless it is a string.
function stub(responder) {
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const r = responder(String(url), init);
    if (r === 'network-error') throw new TypeError('Failed to fetch');
    const { status = 200, body = {} } = r;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
}

const INDEX = {
  schema: 'ed-characters-index/1',
  characters: {
    kolon: { name: 'Kolon', portrait: 'data/kolon.jpeg' },
    chakka: { name: 'Chakka', portrait: 'data/chakka.jpg' },
    newbie: {},
  },
};
const ROWS = [
  { id: 'chakka', name: 'Chakka', portrait: 'data/chakka.jpg' },
  { id: 'kolon', name: 'Kolon', portrait: 'data/kolon.jpeg' },
  { id: 'newbie', name: 'newbie', portrait: null },
];
const isApi = (u) => u.includes('api.github.com');
const isCdn = (u) => u.includes('raw.githubusercontent.com');
const MALFORMED = [
  ['an empty object', '{}'],
  ['characters: null', '{"characters":null}'],
  ['characters: a string', '{"characters":"nope"}'],
  ['a top-level array', '[]'],
  ['a top-level null', 'null'],
  ['a top-level number', '42'],
];

describe('local working copy (./data/characters/index.json)', () => {
  test('a valid index returns the picker rows sorted by id (name falls back to the id, a missing portrait is null)', async () => {
    local();
    stub(() => ({ body: INDEX }));
    assert.deepEqual(await listCharacters(), ROWS);
    assert.deepEqual(calls, ['./data/characters/index.json']);
  });

  test('an index with no characters yet ({ characters: {} }) is an empty list, not an error', async () => {
    local();
    stub(() => ({ body: { schema: 'ed-characters-index/1', characters: {} } }));
    assert.deepEqual(await listCharacters(), []);
  });

  test('404 -> [] (a missing index is an empty store), and no legacy grouped-store file is tried', async () => {
    local();
    stub(() => ({ status: 404, body: 'not found' }));
    assert.deepEqual(await listCharacters(), []);
    assert.deepEqual(calls, ['./data/characters/index.json'], 'exactly one request: no legacy data/characters.json fallback');
  });

  test('500 still throws, and the error carries status 500', async () => {
    local();
    stub(() => ({ status: 500, body: 'boom' }));
    await assert.rejects(listCharacters(), (e) => e instanceof Error && e.status === 500);
  });

  test('other HTTP failures (403) still throw', async () => {
    local();
    stub(() => ({ status: 403, body: 'forbidden' }));
    await assert.rejects(listCharacters(), (e) => e.status === 403);
  });

  test('a network error still throws (it is not a missing index)', async () => {
    local();
    stub(() => 'network-error');
    await assert.rejects(listCharacters());
  });

  for (const [what, body] of MALFORMED) {
    test(`a malformed index (${what}) throws "Character index is malformed"`, async () => {
      local();
      stub(() => ({ body }));
      await assert.rejects(listCharacters(), /Character index is malformed/);
    });
  }
});

describe('Pages site (GitHub contents API first, raw CDN fallback)', () => {
  test('API ok -> rows, and the CDN is not consulted', async () => {
    pages();
    stub((u) => (isApi(u) ? { body: INDEX } : { status: 500, body: 'unexpected' }));
    assert.deepEqual(await listCharacters(), ROWS);
    assert.equal(calls.length, 1);
    assert.ok(isApi(calls[0]));
    assert.match(calls[0], /contents\/data\/characters\/index\.json\?ref=character-data/);
  });

  test('API unusable (500) then the CDN has it -> rows (the existing fallback is kept)', async () => {
    pages();
    stub((u) => (isApi(u) ? { status: 500, body: 'x' } : { body: INDEX }));
    assert.deepEqual(await listCharacters(), ROWS);
    assert.equal(calls.length, 2);
    assert.ok(isCdn(calls[1]));
  });

  test('API network/CORS hiccup then the CDN has it -> rows', async () => {
    pages();
    stub((u) => (isApi(u) ? 'network-error' : { body: INDEX }));
    assert.deepEqual(await listCharacters(), ROWS);
  });

  test('API 404 and CDN 404 -> [] (a missing index on the branch is an empty store)', async () => {
    pages();
    stub(() => ({ status: 404, body: 'not found' }));
    assert.deepEqual(await listCharacters(), []);
    assert.ok(calls.every((u) => isApi(u) || isCdn(u)), 'only the index locations were read: no legacy file');
  });

  test('API unusable and the CDN 404s -> []', async () => {
    pages();
    stub((u) => (isApi(u) ? 'network-error' : { status: 404, body: 'nope' }));
    assert.deepEqual(await listCharacters(), []);
  });

  test('CDN 500 after an API miss still throws', async () => {
    pages();
    stub((u) => (isApi(u) ? { status: 404, body: 'nope' } : { status: 500, body: 'boom' }));
    await assert.rejects(listCharacters(), (e) => e.status === 500);
  });

  test('API 500 and CDN 500 -> throws', async () => {
    pages();
    stub(() => ({ status: 500, body: 'boom' }));
    await assert.rejects(listCharacters());
  });

  test('both locations unreachable (network errors) -> throws', async () => {
    pages();
    stub(() => 'network-error');
    await assert.rejects(listCharacters());
  });

  for (const [what, body] of MALFORMED) {
    test(`a malformed index (${what}) served by both Pages locations throws "Character index is malformed"`, async () => {
      pages();
      stub(() => ({ body }));
      await assert.rejects(listCharacters(), /Character index is malformed/);
    });
  }

  test('a malformed index from the CDN throws too', async () => {
    pages();
    stub((u) => (isApi(u) ? { status: 500, body: 'x' } : { body: '{}' }));
    await assert.rejects(listCharacters(), /Character index is malformed/);
  });
});
