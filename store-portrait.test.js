// store-portrait.test.js — run with `npm test`.
// plans/add-char-portrait I4: staged-portrait overlay (`ed-character-image:<id>`), branch-image listing
// (parse + fetch, [] on any failure), and portrait URL resolution (`portraitUrlFor(portrait, id)` in
// store.js: staged data URL only for the staged path; Discord helpers never see a data URL).
// No Earthdawn rules involved.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  stagePortraitImage,
  loadStagedPortrait,
  clearStagedPortrait,
  hasStagedPortrait,
  parseImageListing,
  parseLocalListing,
  listBranchImages,
} from './store-portrait.js';
import { portraitUrlFor, discordAvatarUrl, discordThumbnailUrl } from './store.js';

const memory = new Map();
let failSet = false;
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => {
    if (failSet) throw new DOMException('quota', 'QuotaExceededError');
    memory.set(k, String(v));
  },
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
const KEY = (id) => `ed-character-image:${id}`;

const hadLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
function setLoc(loc) {
  Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true });
}
const PAGES = { protocol: 'https:', hostname: 'odenson.github.io' };
const LOCAL = { protocol: 'http:', hostname: 'localhost' };

beforeEach(() => {
  memory.clear();
  failSet = false;
});
afterEach(() => {
  if (hadLoc) Object.defineProperty(globalThis, 'location', hadLoc);
  else delete globalThis.location;
});

const STAGED = { path: 'data/chakka-1700000000000.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' };

// --- stage / load / clear / has ------------------------------------------------------------

test('stage -> load round trip; stored under ed-character-image:<id> as { path, mime, dataUrl }', () => {
  assert.deepEqual(stagePortraitImage('chakka', STAGED), { ok: true });
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY('chakka'))), STAGED);
  assert.deepEqual(loadStagedPortrait('chakka'), STAGED);
  assert.equal(hasStagedPortrait('chakka'), true);
});

test('nothing staged -> load is null, has is false', () => {
  assert.equal(loadStagedPortrait('chakka'), null);
  assert.equal(hasStagedPortrait('chakka'), false);
});

test('staging again replaces the previous staged image (one per character)', () => {
  stagePortraitImage('chakka', STAGED);
  const next = { ...STAGED, path: 'data/chakka-1700000000999.png', mime: 'image/png' };
  stagePortraitImage('chakka', next);
  assert.deepEqual(loadStagedPortrait('chakka'), next);
});

test('staged images are per character', () => {
  stagePortraitImage('chakka', STAGED);
  assert.equal(loadStagedPortrait('sarn'), null);
  clearStagedPortrait('sarn');
  assert.deepEqual(loadStagedPortrait('chakka'), STAGED);
});

test('clearStagedPortrait removes it; clearing when absent is a no-op', () => {
  stagePortraitImage('chakka', STAGED);
  clearStagedPortrait('chakka');
  assert.equal(loadStagedPortrait('chakka'), null);
  assert.equal(hasStagedPortrait('chakka'), false);
  assert.equal(localStorage.getItem(KEY('chakka')), null);
  assert.doesNotThrow(() => clearStagedPortrait('chakka'));
});

test('corrupt or incomplete stored values are treated as none', () => {
  for (const v of ['{oops', 'null', '5', '[]', JSON.stringify({ path: 'data/a.jpg', mime: 'image/jpeg' }), JSON.stringify({ mime: 'image/jpeg', dataUrl: 'd' }), JSON.stringify({ path: 'data/a.jpg', dataUrl: 'd' })]) {
    localStorage.setItem(KEY('chakka'), v);
    assert.equal(loadStagedPortrait('chakka'), null, v);
    assert.equal(hasStagedPortrait('chakka'), false, v);
  }
});

test('quota failure -> { ok:false, error:"quota" }, nothing half-staged, no throw', () => {
  failSet = true;
  let r;
  assert.doesNotThrow(() => { r = stagePortraitImage('chakka', STAGED); });
  assert.deepEqual(r, { ok: false, error: 'quota' });
  failSet = false;
  assert.notEqual(loadStagedPortrait('chakka')?.path, STAGED.path, 'the failed image is not staged');
});

test('the staged key is NOT part of the character edits overlay', () => {
  stagePortraitImage('chakka', STAGED);
  assert.equal(localStorage.getItem('ed-character-edits:chakka'), null);
});

// --- listing parse ---------------------------------------------------------------------------

const item = (name, extra = {}) => ({ name, path: `data/${name}`, type: 'file', download_url: `https://raw.example/data/${name}`, ...extra });

test('parseImageListing keeps image files only, newest first by name desc', () => {
  const rows = parseImageListing([
    item('chakka-1700000000001.jpg'),
    item('sarn-1700000000009.png'),
    item('a.webp'),
    item('b.jpeg'),
    item('notes.txt'),
    item('custom-items.json'),
    item('icon.gif'),
    { name: 'characters', path: 'data/characters', type: 'dir' },
    item('folder.png', { type: 'dir' }),
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['sarn-1700000000009.png', 'chakka-1700000000001.jpg', 'b.jpeg', 'a.webp']);
  for (const r of rows) {
    assert.equal(r.path, `data/${r.name}`);
    assert.equal(typeof r.url, 'string');
  }
});

test('parseImageListing tolerates garbage input -> []', () => {
  for (const bad of [null, undefined, {}, 'x', 5, [null, 5, 'x', {}]]) {
    assert.deepEqual(parseImageListing(bad), [], JSON.stringify(bad));
  }
});

test('parseLocalListing maps the dev-server shape to rows with path data/<name>, images only', () => {
  const rows = parseLocalListing({ images: ['b.png', 'a.jpg', 'c.webp', 'readme.txt', 'd.jpeg'] });
  assert.deepEqual(rows.map((r) => r.name).sort(), ['a.jpg', 'b.png', 'c.webp', 'd.jpeg']);
  for (const r of rows) {
    assert.equal(r.path, `data/${r.name}`);
    assert.equal(typeof r.url, 'string');
  }
  for (const bad of [null, undefined, {}, { images: 'x' }]) assert.deepEqual(parseLocalListing(bad), []);
});

// --- listBranchImages (fetch stubbed; unique owner/repo/branch per test dodges the session cache) ---

const resp = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

test('Pages: GETs the contents API for data/ on the branch and returns parsed rows', async () => {
  const calls = [];
  const rows = await listBranchImages({
    fetchFn: async (url, opts) => { calls.push(String(url)); return resp([item('x-1700000000001.jpg'), item('t.txt')]); },
    pages: true,
    owner: 'o1',
    repo: 'r1',
    branch: 'b1',
  });
  assert.deepEqual(calls, ['https://api.github.com/repos/o1/r1/contents/data?ref=b1']);
  assert.deepEqual(rows.map((r) => r.name), ['x-1700000000001.jpg']);
});

test('local: GETs ./list-images and returns parsed rows', async () => {
  const calls = [];
  const rows = await listBranchImages({
    fetchFn: async (url) => { calls.push(String(url)); return resp({ images: ['a.jpg', 'n.txt'] }); },
    pages: false,
    owner: 'o2',
    repo: 'r2',
    branch: 'b2',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /list-images$/);
  assert.deepEqual(rows.map((r) => r.name), ['a.jpg']);
});

test('any failure -> [] (network throw, non-ok status, bad JSON, wrong shape)', async () => {
  const cases = [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => resp({ message: 'rate limited' }, 403),
    async () => resp('not json{'),
    async () => resp({ not: 'an array' }),
  ];
  let n = 0;
  for (const fetchFn of cases) {
    n += 1;
    for (const pages of [true, false]) {
      const rows = await listBranchImages({ fetchFn, pages, owner: `o-fail-${n}`, repo: `r${pages}`, branch: 'b' });
      assert.deepEqual(rows, [], `case ${n} pages=${pages}`);
    }
  }
});

// --- URL resolution -----------------------------------------------------------------------------

test('portraitUrlFor: the staged path resolves to the staged data URL (before any commit)', () => {
  setLoc(PAGES);
  stagePortraitImage('chakka', STAGED);
  assert.equal(portraitUrlFor(STAGED.path, 'chakka'), STAGED.dataUrl);
  setLoc(LOCAL);
  assert.equal(portraitUrlFor(STAGED.path, 'chakka'), STAGED.dataUrl);
});

test('portraitUrlFor: a different path, another character, or nothing staged -> the committed URL', () => {
  setLoc(PAGES);
  stagePortraitImage('chakka', STAGED);
  const raw = (p) => `https://raw.githubusercontent.com/odenson/ed-charSheet/character-data/${p}`;
  assert.equal(portraitUrlFor('data/other.jpg', 'chakka'), raw('data/other.jpg'));
  assert.equal(portraitUrlFor(STAGED.path, 'sarn'), raw(STAGED.path));
  clearStagedPortrait('chakka');
  assert.equal(portraitUrlFor(STAGED.path, 'chakka'), raw(STAGED.path));
  setLoc(LOCAL);
  assert.equal(portraitUrlFor('data/other.jpg', 'chakka'), './data/other.jpg');
});

test('portraitUrlFor: null/empty portrait -> null; id omitted keeps the old behavior', () => {
  setLoc(PAGES);
  assert.equal(portraitUrlFor(null, 'chakka'), null);
  assert.equal(portraitUrlFor('', 'chakka'), null);
  assert.equal(portraitUrlFor('data/a.jpg'), 'https://raw.githubusercontent.com/odenson/ed-charSheet/character-data/data/a.jpg');
});

test('Discord helpers never return a data URL, even for a staged path', () => {
  setLoc(PAGES);
  stagePortraitImage('chakka', STAGED);
  const avatar = discordAvatarUrl(STAGED.path);
  const thumb = discordThumbnailUrl(STAGED.path);
  assert.ok(avatar === null || avatar.startsWith('https://'), String(avatar));
  assert.ok(thumb === null || thumb.startsWith('https://'), String(thumb));
  assert.ok(!String(avatar).startsWith('data:') && !String(thumb).startsWith('data:'));
  assert.equal(avatar, 'https://raw.githubusercontent.com/odenson/ed-charSheet/character-data/' + STAGED.path);
});
