// store-thumbnail.test.js — run with `npm test`.
// plans/thumbnail-in-roll: discordThumbnailUrl resolver + shipped placeholder PNGs.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { discordThumbnailUrl, LOCAL_TEST_IMAGE, NO_IMAGE_IMAGE } from './store.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://odenson.github.io/ed-charSheet/';
const NO_IMAGE_URL = BASE + 'data/discord-no-image.png';
const LOCAL_URL = BASE + 'data/discord-local-test.png';

const hadLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
function setLoc(loc) {
  Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true });
}
afterEach(() => {
  if (hadLoc) Object.defineProperty(globalThis, 'location', hadLoc);
  else delete globalThis.location;
});

const PAGES = { protocol: 'https:', hostname: 'odenson.github.io' };

test('constants point at data/ placeholders', () => {
  assert.equal(LOCAL_TEST_IMAGE, 'data/discord-local-test.png');
  assert.equal(NO_IMAGE_IMAGE, 'data/discord-no-image.png');
});

test('Pages + portrait -> public raw.githubusercontent portrait URL', () => {
  setLoc(PAGES);
  const u = discordThumbnailUrl('data/chakka.jpg');
  assert.ok(u.startsWith('https://raw.githubusercontent.com/'), u);
  assert.ok(u.endsWith('/data/chakka.jpg'), u);
});

test('Pages + no/blank/non-string portrait -> no-image placeholder', () => {
  setLoc(PAGES);
  for (const p of [null, undefined, '', '   ', 5, {}, []]) {
    assert.equal(discordThumbnailUrl(p), NO_IMAGE_URL, JSON.stringify(p));
  }
});

test('local runs -> local-test placeholder, with or without portrait', () => {
  const locs = [
    { protocol: 'http:', hostname: 'localhost' },
    { protocol: 'http:', hostname: '127.0.0.1' },
    { protocol: 'file:', hostname: '' },
    { protocol: 'https:', hostname: 'example.com' },
  ];
  for (const l of locs) {
    setLoc(l);
    for (const p of ['data/chakka.jpg', null, '']) {
      const u = discordThumbnailUrl(p);
      assert.equal(u, LOCAL_URL, `${l.protocol}//${l.hostname} ${p}`);
      assert.ok(!u.startsWith('./'));
    }
  }
});

test('missing location -> null, never throws', () => {
  delete globalThis.location;
  assert.equal(discordThumbnailUrl('data/chakka.jpg'), null);
  assert.equal(discordThumbnailUrl(null), null);
});

for (const [name, rel] of [['local-test', LOCAL_TEST_IMAGE], ['no-image', NO_IMAGE_IMAGE]]) {
  test(`${name} placeholder is a 256x256 PNG under 100 KB`, () => {
    const file = join(ROOT, rel);
    const buf = readFileSync(file);
    assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(buf.toString('ascii', 12, 16), 'IHDR');
    assert.equal(buf.readUInt32BE(16), 256);
    assert.equal(buf.readUInt32BE(20), 256);
    assert.ok(statSync(file).size < 100 * 1024);
  });
}
