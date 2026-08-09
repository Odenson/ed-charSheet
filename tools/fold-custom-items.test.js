// fold-custom-items.test.js — run with `node --test` (no deps).
//
// Exercises the CI fold job (tools/fold-custom-items.mjs, PLAN-CUSTOM-ITEMS P6)
// with a mocked GitHub fetch: the six plan cases — create / update /
// skip-identical / validation-abort / 409-retry / missing-branch-file no-op —
// plus env guard, upstream-failure issue, and issue-open failure resilience.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldCustomItems } from './fold-custom-items.mjs';

const ENV = {
  GITHUB_TOKEN: 'ephemeral-token',
  GITHUB_OWNER: 'Odenson',
  GITHUB_REPO: 'ed-charSheet',
};

// One valid catalog (source on character-data, mirror target on dev).
const CATALOG = {
  schema: 'ed-items/2',
  effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
  source: 'custom',
  notes: 'Player-created items.',
  items: {
    'Lantern of Hours': {
      kind: 'gear',
      effects: [{ type: 'note', summary: 'Sheds light for 30 yards.' }],
    },
  },
};
// Canonical bytes: pretty JSON + trailing newline (what the worker commits).
const canon = (file) => JSON.stringify(file, null, 2) + '\n';
const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

// Install a scripted globalThis.fetch, worker.test.js style. Routes map
// "METHOD path-fragment" → handler returning { status, body }. Records calls.
function mockGitHub(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const u = String(url);
    const pathname = new URL(u).pathname;
    calls.push({ method, url: u, options });
    for (const [key, handler] of Object.entries(routes)) {
      const [m, frag] = key.split(' ');
      if (m === method && pathname.endsWith(frag)) {
        const { status = 200, body = {} } = handler(calls.length, { url: u, options });
        return new Response(JSON.stringify(body), { status });
      }
    }
    throw new Error(`unmocked fetch: ${method} ${u}`);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const readsContents = (path, text, sha = 'sha-1') => ({
  [`GET /contents/${path}`]: () => ({ status: 200, body: { sha, content: b64(text), encoding: 'base64' } }),
});
const notFound = (path) => ({ [`GET /contents/${path}`]: () => ({ status: 404, body: {} }) });
const putOk = (path, commitSha = 'fold-commit') => ({
  [`PUT /contents/${path}`]: () => ({ status: 200, body: { content: { sha: commitSha } } }),
});
const issueOk = () => ({
  'POST /issues': () => ({ status: 201, body: { html_url: 'https://github.com/Odenson/ed-charSheet/issues/1' } }),
});

async function run(env = ENV) {
  return foldCustomItems(env);
}

// --- missing-branch-file no-op -------------------------------------------------

test('source catalog missing (404) → no-op success, nothing written, no issue', async () => {
  let issues = 0;
  const mock = mockGitHub({
    ...notFound('data/custom-items.json'),
    'POST /issues': () => {
      issues += 1;
      return { status: 201, body: {} };
    },
  });
  try {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.status, 'no-op');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 0);
    assert.equal(issues, 0);
  } finally {
    mock.restore();
  }
});

// --- create -------------------------------------------------------------------

test('target missing (404) → creates rules/custom-items.json on dev with no sha', async () => {
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    ...notFound('rules/custom-items.json'),
    ...putOk('rules/custom-items.json'),
  });
  try {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.status, 'folded');

    const put = mock.calls.find((c) => c.method === 'PUT');
    assert.ok(put.url.endsWith('/contents/rules/custom-items.json'), 'writes the rules copy');
    const sent = JSON.parse(put.options.body);
    assert.equal(sent.sha, undefined, 'no sha on a create');
    assert.equal(sent.branch, 'dev', 'fold target is env-pinned dev');
    assert.equal(sent.message, 'Fold custom items (CI)');
    assert.equal(Buffer.from(sent.content, 'base64').toString('utf8'), canon(CATALOG));
  } finally {
    mock.restore();
  }
});

// --- update -------------------------------------------------------------------

test('target differs → updates rules/custom-items.json carrying the current dev sha', async () => {
  const stale = { ...CATALOG, notes: 'An older copy.' };
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    ...readsContents('rules/custom-items.json', canon(stale), 'dev-sha'),
    ...putOk('rules/custom-items.json'),
  });
  try {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.status, 'folded');
    const sent = JSON.parse(mock.calls.find((c) => c.method === 'PUT').options.body);
    assert.equal(sent.sha, 'dev-sha', 'PUT carries the dev sha from the GET');
    assert.equal(Buffer.from(sent.content, 'base64').toString('utf8'), canon(CATALOG));
  } finally {
    mock.restore();
  }
});

// --- skip-identical -------------------------------------------------------------

test('target already identical → no-op, no PUT (diff-guard)', async () => {
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    ...readsContents('rules/custom-items.json', canon(CATALOG), 'dev-sha'),
  });
  try {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.status, 'no-op');
    assert.match(result.reason, /identical/);
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 0);
  } finally {
    mock.restore();
  }
});

// --- validation abort -----------------------------------------------------------

test('source fails the shared validator → aborted, issue opened, nothing written', async () => {
  const bad = { schema: 'ed-items/2', items: { Junk: { kind: 'spaceship', effects: [] } } };
  let puts = 0;
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(bad)),
    'PUT /contents/rules/custom-items.json': () => {
      puts += 1;
      return { status: 200, body: {} };
    },
    ...issueOk(),
  });
  try {
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'aborted');
    assert.match(result.error, /shared validator/);
    assert.equal(result.issueUrl, 'https://github.com/Odenson/ed-charSheet/issues/1');

    const issue = mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues'));
    assert.ok(issue, 'opened a failure issue');
    const body = JSON.parse(issue.options.body);
    assert.match(body.title, /Fold blocked/);
    assert.match(body.body, /must be one of/);
    assert.equal(puts, 0, 'invalid source never reaches dev');
  } finally {
    mock.restore();
  }
});

// --- 409 retry -------------------------------------------------------------------

test('target 409 then 200 → retry re-reads the moved dev sha', async () => {
  let targetReads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    'GET /contents/rules/custom-items.json': () => {
      targetReads += 1;
      return { status: 200, body: { sha: `dev-sha-${targetReads}`, content: b64(canon({ ...CATALOG, notes: 'stale' })), encoding: 'base64' } };
    },
    'PUT /contents/rules/custom-items.json': () => {
      puts += 1;
      return puts === 1 ? { status: 409, body: {} } : { status: 200, body: { content: { sha: 'ok' } } };
    },
  });
  try {
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.status, 'folded');
    assert.equal(puts, 2, 'retried once');
    const putsArr = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(putsArr[1].options.body).sha, 'dev-sha-2', 'retry carries the re-read sha');
  } finally {
    mock.restore();
  }
});

test('persistent 409 → fails after MAX_RETRIES with an issue opened', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    'GET /contents/rules/custom-items.json': () => ({ status: 200, body: { sha: 'dev-sha', content: b64(canon({ ...CATALOG, notes: 'stale' })), encoding: 'base64' } }),
    'PUT /contents/rules/custom-items.json': () => {
      puts += 1;
      return { status: 409, body: {} };
    },
    ...issueOk(),
  });
  try {
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'error');
    assert.match(result.error, /kept moving/);
    assert.equal(puts, 3, 'three attempts');
    assert.ok(mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues')), 'issue opened');
  } finally {
    mock.restore();
  }
});

// --- env / upstream / issue-resilience ------------------------------------------

test('missing token/env → error without any fetch', async () => {
  const mock = mockGitHub({});
  try {
    const result = await run({});
    assert.equal(result.ok, false);
    assert.equal(result.status, 'error');
    assert.match(result.error, /required/);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('upstream failure reading the source (500) → error + issue opened', async () => {
  const mock = mockGitHub({
    'GET /contents/data/custom-items.json': () => ({ status: 500, body: {} }),
    ...issueOk(),
  });
  try {
    const result = await run();
    assert.equal(result.ok, false);
    assert.match(result.error, /could not read/);
    assert.equal(result.issueUrl, 'https://github.com/Odenson/ed-charSheet/issues/1');
  } finally {
    mock.restore();
  }
});

test('issue creation itself failing still returns the fold error', async () => {
  const bad = { schema: 'ed-items/2', items: { Junk: { kind: 'spaceship', effects: [] } } };
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(bad)),
    'POST /issues': () => ({ status: 500, body: {} }),
  });
  try {
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'aborted');
    assert.match(result.error, /shared validator/);
    assert.equal(result.issueUrl, null, 'issue URL absent when the issue call fails');
  } finally {
    mock.restore();
  }
});

// --- path/branch pinning --------------------------------------------------------

test('source/target path and branch come from env (never hardcoded)', async () => {
  const env = {
    ...ENV,
    SOURCE_BRANCH: 'dev',
    TARGET_BRANCH: 'main',
  };
  const mock = mockGitHub({
    ...readsContents('data/custom-items.json', canon(CATALOG)),
    'GET /contents/rules/custom-items.json': () => ({ status: 404, body: {} }),
    'PUT /contents/rules/custom-items.json': () => ({ status: 200, body: { content: { sha: 'ok' } } }),
  });
  try {
    const result = await run(env);
    assert.equal(result.status, 'folded');
    const get = mock.calls.find((c) => c.method === 'GET');
    assert.match(get.url, /ref=dev/, 'source branch from env');
    const put = mock.calls.find((c) => c.method === 'PUT');
    assert.equal(JSON.parse(put.options.body).branch, 'main', 'target branch from env');
  } finally {
    mock.restore();
  }
});
