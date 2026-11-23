// fold-custom-skills.test.js — run with `node --test` (no deps).
//
// The CI fold job for custom skills (plans/gen-skill-other I5), mirroring
// fold-custom-items.test.js: 404 no-op, create, update, identical -> no PUT, 409 retry,
// file-level failure (bad JSON / wrong schema) aborts with an issue, and the
// skills-specific rule: an invalid entry is DROPPED + reported while valid ones still
// fold. Plus the pure seam foldSkills(sourceFile, { coreNames, attributeNames }).
// Assumes the mirror export name `foldCustomSkills(env)` (spec: "mirror fold-custom-items").
// Core names/attributes come from the dev checkout; the mock also serves them over the
// contents API in case the implementation fetches them instead of reading the checkout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldCustomSkills, foldSkills } from './fold-custom-skills.mjs';

const ENV = { GITHUB_TOKEN: 'ephemeral-token', GITHUB_OWNER: 'Odenson', GITHUB_REPO: 'ed-charSheet' };
const SRC = 'data/custom-skills.json';
const DST = 'rules/custom-skills.json';

const LORE = { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true };
const DANCE = { name: 'Rope Dancing', category: 'general', tier: 2, strain: 0, attribute: 'Dexterity', summary: 'On a rope.', custom: true };
const BAD_ATTR = { name: 'Junk Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Luck', custom: true };
const CORE_CLASH = { name: 'Alchemy', category: 'general', tier: 1, strain: 0, attribute: 'Perception', custom: true };
const file = (skills, over = {}) => ({ schema: 'ed-skills/1', source: 'custom', notes: 'Owner-created skills.', skills, ...over });

const canon = (f) => JSON.stringify(f, null, 2) + '\n';
const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');
const readRules = (p) => readFileSync(new URL(`../rules/${p}`, import.meta.url), 'utf8');

function mockGitHub(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const u = String(url);
    const pathname = new URL(u).pathname;
    calls.push({ method, url: u, options });
    const all = {
      'GET /contents/rules/skills.json': () => ({ status: 200, body: { sha: 'core', content: b64(readRules('skills.json')), encoding: 'base64' } }),
      'GET /contents/rules/attributes.json': () => ({ status: 200, body: { sha: 'attrs', content: b64(readRules('attributes.json')), encoding: 'base64' } }),
      ...routes,
    };
    for (const [key, handler] of Object.entries(all)) {
      const [m, frag] = key.split(' ');
      if (m === method && pathname.endsWith(frag)) {
        const { status = 200, body = {} } = handler(calls.length, { url: u, options });
        return new Response(JSON.stringify(body), { status });
      }
    }
    throw new Error(`unmocked fetch: ${method} ${u}`);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const reads = (path, text, sha = 'sha-1') => ({ [`GET /contents/${path}`]: () => ({ status: 200, body: { sha, content: b64(text), encoding: 'base64' } }) });
const notFound = (path) => ({ [`GET /contents/${path}`]: () => ({ status: 404, body: {} }) });
const putOk = (path) => ({ [`PUT /contents/${path}`]: () => ({ status: 200, body: { content: { sha: 'fold-commit' } } }) });
const issueOk = () => ({ 'POST /issues': () => ({ status: 201, body: { html_url: 'https://github.com/Odenson/ed-charSheet/issues/1' } }) });
const sentOf = (mock) => {
  const put = mock.calls.find((c) => c.method === 'PUT');
  const sent = JSON.parse(put.options.body);
  return { put, sent, file: JSON.parse(Buffer.from(sent.content, 'base64').toString('utf8')) };
};

// --- pure seam -------------------------------------------------------------------------

const ATTRS = ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'];
const POLICY = { coreNames: ['Alchemy', 'Knowledge'], attributeNames: ATTRS };

test('foldSkills keeps every valid entry and drops nothing', () => {
  const { file: out, dropped } = foldSkills(file([LORE, DANCE]), POLICY);
  assert.deepEqual(out.skills, [LORE, DANCE]);
  assert.equal(out.schema, 'ed-skills/1');
  assert.deepEqual(dropped, []);
});

test('foldSkills drops invalid entries (bad attribute, core collision) and reports name + errors; valid ones stay', () => {
  const { file: out, dropped } = foldSkills(file([LORE, BAD_ATTR, CORE_CLASH, DANCE]), POLICY);
  assert.deepEqual(out.skills.map((s) => s.name), ['Dwarven Mining Lore', 'Rope Dancing']);
  assert.deepEqual(dropped.map((d) => d.name).sort(), ['Alchemy', 'Junk Lore']);
  for (const d of dropped) assert.ok(Array.isArray(d.errors) && d.errors.length > 0);
});

test('foldSkills does not mutate its input', () => {
  const src = file([LORE, BAD_ATTR]);
  const before = JSON.stringify(src);
  foldSkills(src, POLICY);
  assert.equal(JSON.stringify(src), before);
});

// --- no-op / create / update / identical -----------------------------------------------------

test('source missing (404) -> no-op success, nothing written, no issue', async () => {
  let issues = 0;
  const mock = mockGitHub({ ...notFound(SRC), 'POST /issues': () => { issues += 1; return { status: 201, body: {} }; } });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'no-op');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 0);
    assert.equal(issues, 0);
  } finally {
    mock.restore();
  }
});

test('target missing (404) -> creates rules/custom-skills.json on dev with no sha', async () => {
  const mock = mockGitHub({ ...reads(SRC, canon(file([LORE, DANCE]))), ...notFound(DST), ...putOk(DST) });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'folded');
    const { put, sent, file: out } = sentOf(mock);
    assert.ok(put.url.endsWith(`/contents/${DST}`));
    assert.equal(sent.sha, undefined);
    assert.equal(sent.branch, 'dev');
    assert.deepEqual(out.skills, [LORE, DANCE]);
  } finally {
    mock.restore();
  }
});

test('target differs -> updates carrying the current dev sha', async () => {
  const mock = mockGitHub({ ...reads(SRC, canon(file([LORE]))), ...reads(DST, canon(file([])), 'dev-sha'), ...putOk(DST) });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.status, 'folded');
    assert.equal(sentOf(mock).sent.sha, 'dev-sha');
  } finally {
    mock.restore();
  }
});

test('target already identical -> no-op, no PUT (diff-guard)', async () => {
  const mock = mockGitHub({ ...reads(SRC, canon(file([LORE]))), ...reads(DST, canon(file([LORE])), 'dev-sha') });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, true);
    assert.equal(r.status, 'no-op');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 0);
  } finally {
    mock.restore();
  }
});

// --- invalid entries: dropped + reported, rest folded ------------------------------------------

test('an invalid entry on character-data is dropped and reported via an issue; valid entries still fold', async () => {
  const mock = mockGitHub({ ...reads(SRC, canon(file([LORE, BAD_ATTR, CORE_CLASH, DANCE]))), ...notFound(DST), ...putOk(DST), ...issueOk() });
  try {
    await foldCustomSkills(ENV);
    const { file: out } = sentOf(mock);
    assert.deepEqual(out.skills.map((s) => s.name), ['Dwarven Mining Lore', 'Rope Dancing'], 'only valid entries reach dev');
    const issue = mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues'));
    assert.ok(issue, 'an issue reports the dropped entries');
    const body = JSON.parse(issue.options.body);
    assert.match(body.body, /Junk Lore/);
    assert.match(body.body, /Alchemy/);
  } finally {
    mock.restore();
  }
});

// --- file-level failures abort ---------------------------------------------------------------------

test('bad JSON -> aborted, issue opened, nothing written', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...reads(SRC, '{not json'),
    [`PUT /contents/${DST}`]: () => { puts += 1; return { status: 200, body: {} }; },
    ...issueOk(),
  });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, false);
    assert.equal(puts, 0);
    assert.ok(mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues')));
  } finally {
    mock.restore();
  }
});

test('wrong schema -> aborted, issue opened, nothing written', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...reads(SRC, canon(file([LORE], { schema: 'ed-items/3' }))),
    [`PUT /contents/${DST}`]: () => { puts += 1; return { status: 200, body: {} }; },
    ...issueOk(),
  });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, false);
    assert.equal(puts, 0);
    assert.ok(mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues')));
  } finally {
    mock.restore();
  }
});

// --- 409 retry / env / upstream ---------------------------------------------------------------------

test('target 409 then 200 -> retry re-reads the moved dev sha', async () => {
  let targetReads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...reads(SRC, canon(file([LORE]))),
    [`GET /contents/${DST}`]: () => {
      targetReads += 1;
      return { status: 200, body: { sha: `dev-sha-${targetReads}`, content: b64(canon(file([]))), encoding: 'base64' } };
    },
    [`PUT /contents/${DST}`]: () => {
      puts += 1;
      return puts === 1 ? { status: 409, body: {} } : { status: 200, body: { content: { sha: 'ok' } } };
    },
  });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.status, 'folded');
    assert.equal(puts, 2);
    const putsArr = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(putsArr[1].options.body).sha, 'dev-sha-2');
  } finally {
    mock.restore();
  }
});

test('persistent 409 -> fails after 3 attempts with an issue opened', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...reads(SRC, canon(file([LORE]))),
    ...reads(DST, canon(file([])), 'dev-sha'),
    [`PUT /contents/${DST}`]: () => { puts += 1; return { status: 409, body: {} }; },
    ...issueOk(),
  });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, false);
    assert.equal(puts, 3);
    assert.ok(mock.calls.find((c) => c.method === 'POST' && c.url.endsWith('/issues')));
  } finally {
    mock.restore();
  }
});

test('missing token/env -> error without any fetch', async () => {
  const mock = mockGitHub({});
  try {
    const r = await foldCustomSkills({});
    assert.equal(r.ok, false);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('upstream failure reading the source (500) -> error + issue opened', async () => {
  const mock = mockGitHub({ [`GET /contents/${SRC}`]: () => ({ status: 500, body: {} }), ...issueOk() });
  try {
    const r = await foldCustomSkills(ENV);
    assert.equal(r.ok, false);
    assert.equal(r.issueUrl, 'https://github.com/Odenson/ed-charSheet/issues/1');
  } finally {
    mock.restore();
  }
});
