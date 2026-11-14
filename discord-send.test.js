// discord-send.test.js — run with `npm test`. postWebhook with a stub fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postWebhook } from './discord-send.js';

const URL_ = 'https://discord.com/api/webhooks/123456/SECRET-token_xyz';
const payload = { username: 'Chakka', content: 'hi', allowed_mentions: { parse: [] } };

const stub = (status) => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
  f.calls = calls;
  return f;
};

test('2xx resolves ok and POSTs JSON', async () => {
  const f = stub(204);
  const r = await postWebhook(URL_, payload, f);
  assert.deepEqual(r, { ok: true });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, URL_);
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(f.calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(f.calls[0].init.body, JSON.stringify(payload));
});

test('429 and 404 give fixed HTTP messages', async () => {
  assert.deepEqual(await postWebhook(URL_, payload, stub(429)), { ok: false, message: 'HTTP 429' });
  assert.deepEqual(await postWebhook(URL_, payload, stub(404)), { ok: false, message: 'HTTP 404' });
});

test('rejection gives Network error and never throws', async () => {
  const f = async () => {
    throw new TypeError(`Failed to fetch ${URL_}`);
  };
  const r = await postWebhook(URL_, payload, f);
  assert.deepEqual(r, { ok: false, message: 'Network error' });
});

test('missing fetch gives Network error', async () => {
  const r = await postWebhook(URL_, payload, null);
  assert.equal(r.ok, false);
  assert.equal(r.message, 'Network error');
});

test('error messages never contain the URL or token, and nothing is logged', async () => {
  const logged = [];
  const orig = {};
  for (const k of ['log', 'warn', 'error', 'info', 'debug']) {
    orig[k] = console[k];
    console[k] = (...a) => logged.push(a.join(' '));
  }
  try {
    const rs = [
      await postWebhook(URL_, payload, stub(500)),
      await postWebhook(URL_, payload, stub(204)),
      await postWebhook(URL_, payload, async () => {
        throw new Error(URL_);
      }),
    ];
    for (const r of rs) {
      assert.ok(!JSON.stringify(r).includes('SECRET'));
      assert.ok(!JSON.stringify(r).includes('discord.com'));
    }
  } finally {
    Object.assign(console, orig);
  }
  assert.deepEqual(logged, []);
});
