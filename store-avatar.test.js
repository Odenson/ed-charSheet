// store-avatar.test.js — run with `npm test`.
// plans/user-image-discord: discordAvatarUrl resolver (portrait only).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { discordAvatarUrl, discordThumbnailUrl } from './store.js';

const hadLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
function setLoc(loc) {
  Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true });
}
afterEach(() => {
  if (hadLoc) Object.defineProperty(globalThis, 'location', hadLoc);
  else delete globalThis.location;
});

const PAGES = { protocol: 'https:', hostname: 'odenson.github.io' };

test('Pages + portrait -> public raw.githubusercontent URL equal to the thumbnail portrait URL', () => {
  setLoc(PAGES);
  const u = discordAvatarUrl('data/chakka.jpg');
  assert.ok(u.startsWith('https://raw.githubusercontent.com/'), u);
  assert.ok(u.endsWith('/data/chakka.jpg'), u);
  assert.equal(u, discordThumbnailUrl('data/chakka.jpg'));
});

test('Pages + null/undefined/blank/non-string portrait -> null (no placeholder)', () => {
  setLoc(PAGES);
  for (const p of [null, undefined, '', '   ', 5, {}, []]) {
    assert.equal(discordAvatarUrl(p), null, JSON.stringify(p));
  }
});

test('local runs -> null even with a portrait', () => {
  const locs = [
    { protocol: 'http:', hostname: 'localhost' },
    { protocol: 'http:', hostname: '127.0.0.1' },
    { protocol: 'file:', hostname: '' },
    { protocol: 'https:', hostname: 'example.com' },
  ];
  for (const l of locs) {
    setLoc(l);
    for (const p of ['data/chakka.jpg', null, '']) {
      assert.equal(discordAvatarUrl(p), null, `${l.protocol}//${l.hostname} ${p}`);
    }
  }
});

test('missing location -> null, never throws', () => {
  delete globalThis.location;
  assert.equal(discordAvatarUrl('data/chakka.jpg'), null);
  assert.equal(discordAvatarUrl(null), null);
});

test('throwing location getter -> null, never throws', () => {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    get() { throw new Error('boom'); },
  });
  assert.equal(discordAvatarUrl('data/chakka.jpg'), null);
});
