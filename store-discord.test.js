// store-discord.test.js — run with `npm test`. Per-character Discord webhook
// config (device-local; never character data). Stub mirrors store-rolllog.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadDiscordConfig,
  saveDiscordConfig,
  clearDiscordConfig,
  isDiscordWebhookUrl,
  discordReady,
  normalizeFormat,
} from './store-discord.js';
import { hasPendingEdits } from './store.js';

const memory = new Map();
const stubStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
globalThis.localStorage = stubStorage;

const GOOD = 'https://discord.com/api/webhooks/123456789/abc_DEF-123';
const EMPTY = { url: '', enabled: false, format: 'plain' };

test('isDiscordWebhookUrl accepts the documented hosts', () => {
  for (const u of [
    GOOD,
    'https://discordapp.com/api/webhooks/1/a',
    'https://ptb.discord.com/api/webhooks/1/a',
    'https://canary.discord.com/api/webhooks/1/a',
    'https://canary.discordapp.com/api/webhooks/1/a',
    `${GOOD}?thread_id=55`,
  ]) {
    assert.equal(isDiscordWebhookUrl(u), true, u);
  }
});

test('isDiscordWebhookUrl rejects everything else', () => {
  for (const u of [
    '',
    'http://discord.com/api/webhooks/1/a',
    'https://discord.com/api/webhooks/abc/a',
    'https://discord.com/api/webhooks/1/',
    'https://discord.com/api/webhooks/1',
    'https://evil.com/api/webhooks/1/a',
    'https://discord.com.evil.com/api/webhooks/1/a',
    'https://evildiscord.com/api/webhooks/1/a',
    'https://discord.com/api/webhooks/1/a b',
    'not a url',
    null,
    undefined,
    42,
  ]) {
    assert.equal(isDiscordWebhookUrl(u), false, String(u));
  }
});

test('discordReady needs enabled AND a valid URL', () => {
  assert.equal(discordReady({ url: GOOD, enabled: true }), true);
  assert.equal(discordReady({ url: GOOD, enabled: false }), false);
  assert.equal(discordReady({ url: '', enabled: true }), false);
  assert.equal(discordReady({ url: 'nope', enabled: true }), false);
  assert.equal(discordReady(null), false);
  assert.equal(discordReady(undefined), false);
});

test('absent config loads as not configured', () => {
  memory.clear();
  assert.deepEqual(loadDiscordConfig('c1'), EMPTY);
});

test('round-trips per character under ed-discord:<id>', () => {
  memory.clear();
  assert.deepEqual(saveDiscordConfig('c1', { url: GOOD, enabled: true }), { ok: true });
  assert.deepEqual(loadDiscordConfig('c1'), { url: GOOD, enabled: true, format: 'plain' });
  assert.ok(memory.has('ed-discord:c1'));
});

test('one character never sees another character config', () => {
  memory.clear();
  const other = 'https://discord.com/api/webhooks/999/zzz';
  saveDiscordConfig('chakka', { url: GOOD, enabled: true });
  saveDiscordConfig('rook', { url: other, enabled: false });
  assert.deepEqual(loadDiscordConfig('chakka'), { url: GOOD, enabled: true, format: 'plain' });
  assert.deepEqual(loadDiscordConfig('rook'), { url: other, enabled: false, format: 'plain' });
  assert.deepEqual(loadDiscordConfig('nobody'), EMPTY);
});

test('invalid non-blank URL is rejected and nothing is written', () => {
  memory.clear();
  assert.deepEqual(saveDiscordConfig('c1', { url: 'https://evil.com/x', enabled: true }), {
    ok: false,
    error: 'invalid-url',
  });
  assert.equal(memory.size, 0);
  // an existing good config is not overwritten by a rejected save
  saveDiscordConfig('c1', { url: GOOD, enabled: true });
  saveDiscordConfig('c1', { url: 'bad', enabled: false });
  assert.deepEqual(loadDiscordConfig('c1'), { url: GOOD, enabled: true, format: 'plain' });
});

test('blank URL is allowed (means not configured); enabled is coerced to boolean', () => {
  memory.clear();
  assert.deepEqual(saveDiscordConfig('c1', { url: '', enabled: 1 }), { ok: true });
  assert.deepEqual(loadDiscordConfig('c1'), { url: '', enabled: true, format: 'plain' });
  saveDiscordConfig('c1', { url: GOOD, enabled: 0 });
  assert.strictEqual(loadDiscordConfig('c1').enabled, false);
  saveDiscordConfig('c1', { url: GOOD, enabled: 'yes' });
  assert.strictEqual(loadDiscordConfig('c1').enabled, true);
});

test('clearDiscordConfig removes only that character', () => {
  memory.clear();
  saveDiscordConfig('a', { url: GOOD, enabled: true });
  saveDiscordConfig('b', { url: GOOD, enabled: true });
  clearDiscordConfig('a');
  assert.deepEqual(loadDiscordConfig('a'), EMPTY);
  assert.equal(loadDiscordConfig('b').enabled, true);
  assert.ok(!memory.has('ed-discord:a'));
});

test('corrupt or wrong-shape JSON degrades to not configured', () => {
  memory.clear();
  localStorage.setItem('ed-discord:c1', '{not json!!');
  assert.deepEqual(loadDiscordConfig('c1'), EMPTY);
  localStorage.setItem('ed-discord:c1', 'null');
  assert.deepEqual(loadDiscordConfig('c1'), EMPTY);
  localStorage.setItem('ed-discord:c1', JSON.stringify({ url: 42, enabled: 'x' }));
  const c = loadDiscordConfig('c1');
  assert.equal(typeof c.url, 'string');
  assert.equal(typeof c.enabled, 'boolean');
  assert.equal(discordReady(c), false);
});

test('blocked / missing storage fails open and never throws', () => {
  const saved = globalThis.localStorage;
  try {
    globalThis.localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    assert.deepEqual(loadDiscordConfig('c1'), EMPTY);
    assert.doesNotThrow(() => saveDiscordConfig('c1', { url: GOOD, enabled: true }));
    assert.doesNotThrow(() => clearDiscordConfig('c1'));
    delete globalThis.localStorage;
    assert.deepEqual(loadDiscordConfig('c1'), EMPTY);
    assert.doesNotThrow(() => saveDiscordConfig('c1', { url: GOOD, enabled: true }));
  } finally {
    globalThis.localStorage = saved;
  }
});

test('config is device-local only: it never flags the Save button', () => {
  memory.clear();
  saveDiscordConfig('c1', { url: GOOD, enabled: true });
  assert.equal(hasPendingEdits('c1'), false);
  assert.deepEqual(
    [...memory.keys()].filter((k) => !k.startsWith('ed-discord:')),
    [],
  );
});

test('normalizeFormat: embed only for exactly "embed"', () => {
  assert.equal(normalizeFormat('embed'), 'embed');
  assert.equal(normalizeFormat('plain'), 'plain');
  for (const v of ['Embed', 'EMBED', ' embed', '', 'x', null, undefined, 1, true, {}, ['embed']]) {
    assert.equal(normalizeFormat(v), 'plain', String(v));
  }
});

test('format round-trips per character', () => {
  memory.clear();
  assert.deepEqual(saveDiscordConfig('a', { url: GOOD, enabled: true, format: 'embed' }), { ok: true });
  saveDiscordConfig('b', { url: GOOD, enabled: true, format: 'plain' });
  assert.equal(loadDiscordConfig('a').format, 'embed');
  assert.equal(loadDiscordConfig('b').format, 'plain');
  assert.equal(loadDiscordConfig('nobody').format, 'plain');
  assert.deepEqual(loadDiscordConfig('a'), { url: GOOD, enabled: true, format: 'embed' });
  assert.equal(JSON.parse(memory.get('ed-discord:a')).format, 'embed');
});

test('legacy {url, enabled} entries load as plain', () => {
  memory.clear();
  localStorage.setItem('ed-discord:old', JSON.stringify({ url: GOOD, enabled: true }));
  assert.deepEqual(loadDiscordConfig('old'), { url: GOOD, enabled: true, format: 'plain' });
});

test('invalid or absent format is stored and loaded as plain', () => {
  memory.clear();
  for (const f of ['bogus', 7, null, undefined, {}]) {
    saveDiscordConfig('c1', { url: GOOD, enabled: true, format: f });
    assert.equal(JSON.parse(memory.get('ed-discord:c1')).format, 'plain', String(f));
    assert.equal(loadDiscordConfig('c1').format, 'plain');
  }
  saveDiscordConfig('c1', { url: GOOD, enabled: true });
  assert.equal(loadDiscordConfig('c1').format, 'plain');
  localStorage.setItem('ed-discord:c1', JSON.stringify({ url: GOOD, enabled: true, format: 'weird' }));
  assert.equal(loadDiscordConfig('c1').format, 'plain');
});

test('rejected invalid-URL save does not change a stored format', () => {
  memory.clear();
  saveDiscordConfig('c1', { url: GOOD, enabled: true, format: 'embed' });
  assert.deepEqual(saveDiscordConfig('c1', { url: 'bad', enabled: true, format: 'plain' }), {
    ok: false,
    error: 'invalid-url',
  });
  assert.equal(loadDiscordConfig('c1').format, 'embed');
});

test('discordReady ignores format', () => {
  assert.equal(discordReady({ url: GOOD, enabled: true, format: 'embed' }), true);
  assert.equal(discordReady({ url: GOOD, enabled: false, format: 'embed' }), false);
});

test('normalizeFormat: embed only for exactly "embed"', () => {
  assert.equal(normalizeFormat('embed'), 'embed');
  assert.equal(normalizeFormat('plain'), 'plain');
  for (const v of ['Embed', 'EMBED', ' embed', '', 'x', null, undefined, 1, true, {}, ['embed']]) {
    assert.equal(normalizeFormat(v), 'plain', String(v));
  }
});

test('format round-trips per character', () => {
  memory.clear();
  assert.deepEqual(saveDiscordConfig('a', { url: GOOD, enabled: true, format: 'embed' }), { ok: true });
  saveDiscordConfig('b', { url: GOOD, enabled: true, format: 'plain' });
  assert.equal(loadDiscordConfig('a').format, 'embed');
  assert.equal(loadDiscordConfig('b').format, 'plain');
  assert.equal(loadDiscordConfig('nobody').format, 'plain');
  assert.deepEqual(loadDiscordConfig('a'), { url: GOOD, enabled: true, format: 'embed' });
  assert.equal(JSON.parse(memory.get('ed-discord:a')).format, 'embed');
});

test('legacy {url, enabled} entries load as plain', () => {
  memory.clear();
  localStorage.setItem('ed-discord:old', JSON.stringify({ url: GOOD, enabled: true }));
  assert.deepEqual(loadDiscordConfig('old'), { url: GOOD, enabled: true, format: 'plain' });
});

test('invalid or absent format is stored and loaded as plain', () => {
  memory.clear();
  for (const f of ['bogus', 7, null, undefined, {}]) {
    saveDiscordConfig('c1', { url: GOOD, enabled: true, format: f });
    assert.equal(JSON.parse(memory.get('ed-discord:c1')).format, 'plain', String(f));
    assert.equal(loadDiscordConfig('c1').format, 'plain');
  }
  saveDiscordConfig('c1', { url: GOOD, enabled: true });
  assert.equal(loadDiscordConfig('c1').format, 'plain');
  localStorage.setItem('ed-discord:c1', JSON.stringify({ url: GOOD, enabled: true, format: 'weird' }));
  assert.equal(loadDiscordConfig('c1').format, 'plain');
});

test('rejected invalid-URL save does not change a stored format', () => {
  memory.clear();
  saveDiscordConfig('c1', { url: GOOD, enabled: true, format: 'embed' });
  assert.deepEqual(saveDiscordConfig('c1', { url: 'bad', enabled: true, format: 'plain' }), {
    ok: false,
    error: 'invalid-url',
  });
  assert.equal(loadDiscordConfig('c1').format, 'embed');
});

test('discordReady ignores format', () => {
  assert.equal(discordReady({ url: GOOD, enabled: true, format: 'embed' }), true);
  assert.equal(discordReady({ url: GOOD, enabled: false, format: 'embed' }), false);
});
