// worker-skills.test.js — run with `npm test` (node --test, no deps).
// The worker's POST /save-skills route (plans/gen-skill-other I4), mirroring the
// /save-items tests in worker.test.js: upsert into data/custom-skills.json (array under
// `skills`), 400 invalid_skills (shape, unknown attribute, core-name collision — the
// worker ALWAYS checks these), fail-closed auth, env-pinned path, bounded 409 retry,
// first-save from a 404. GitHub is a scripted fetch. No Earthdawn rules values asserted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const ENV = {
  SAVE_KEY: 'secret-key',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_OWNER: 'odenson',
  GITHUB_REPO: 'ed-charSheet',
  GITHUB_CHARS_DIR: 'data/characters',
  GITHUB_BRANCH: 'character-data',
};
const PATH = 'data/custom-skills.json';

const req = (body, { path = '/save-skills', key = ENV.SAVE_KEY } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== null) headers['x-save-key'] = key;
  return new Request(`https://worker.test${path}`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
};

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
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const branchExists = { 'GET /git/ref/heads/character-data': () => ({ status: 200, body: { ref: 'ok' } }) };
const LORE = { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true };
const DANCE = { name: 'Rope Dancing', category: 'general', tier: 2, strain: 0, attribute: 'Dexterity', summary: 'On a rope.', custom: true };
const FILE = { schema: 'ed-skills/1', source: 'custom', notes: 'Owner-created skills.', skills: [LORE] };
const b64 = (file) => Buffer.from(JSON.stringify(file), 'utf8').toString('base64');
const readsSkills = (file, sha = 'skills-sha') => ({ [`GET /contents/${PATH}`]: () => ({ status: 200, body: { sha, content: b64(file), encoding: 'base64' } }) });
const putOk = (commitSha = 'skills-commit') => ({
  [`PUT /contents/${PATH}`]: () => ({ status: 200, body: { content: { sha: commitSha }, html_url: `https://github.com/commit/${commitSha}` } }),
});
const writtenOf = (mock) => {
  const put = mock.calls.find((c) => c.method === 'PUT');
  const sent = JSON.parse(put.options.body);
  return { put, sent, file: JSON.parse(Buffer.from(sent.content, 'base64').toString('utf8')) };
};

async function call(request, env = ENV) {
  const res = await worker.fetch(request, env);
  return { status: res.status, json: await res.json() };
}

test('save-skills upserts a new skill and PUTs the whole file', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSkills(FILE), ...putOk() });
  try {
    const { status, json } = await call(req({ skills: { [DANCE.name]: DANCE } }));
    assert.equal(status, 200);
    assert.equal(json.commit.sha, 'skills-commit');
    const { put, sent, file } = writtenOf(mock);
    assert.ok(put.url.endsWith(`/contents/${PATH}`));
    assert.equal(sent.sha, 'skills-sha', 'PUT carries the sha from the GET');
    assert.equal(sent.branch, 'character-data');
    assert.equal(sent.message, 'Save custom skills (serverless)');
    assert.equal(file.schema, 'ed-skills/1');
    assert.deepEqual(file.skills.map((s) => s.name).sort(), ['Dwarven Mining Lore', 'Rope Dancing']);
    assert.deepEqual(file.skills.find((s) => s.name === DANCE.name), DANCE);
  } finally {
    mock.restore();
  }
});

test('save-skills: same name replaces the existing entry (no duplicate row)', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSkills(FILE), ...putOk() });
  try {
    const edited = { ...LORE, summary: 'Edited.' };
    await call(req({ skills: { [LORE.name]: edited } }));
    const { file } = writtenOf(mock);
    assert.equal(file.skills.length, 1);
    assert.deepEqual(file.skills[0], edited);
  } finally {
    mock.restore();
  }
});

test('missing file (404) -> creates a fresh ed-skills/1 file with no sha', async () => {
  const mock = mockGitHub({ ...branchExists, [`GET /contents/${PATH}`]: () => ({ status: 404, body: {} }), ...putOk() });
  try {
    const { status } = await call(req({ skills: { [LORE.name]: LORE } }));
    assert.equal(status, 200);
    const { sent, file } = writtenOf(mock);
    assert.equal(sent.sha, undefined);
    assert.equal(file.schema, 'ed-skills/1');
    assert.deepEqual(file.skills, [LORE]);
  } finally {
    mock.restore();
  }
});

test('invalid skill deltas -> 400 invalid_skills and no PUT (always checks attribute and core names)', async () => {
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    ...readsSkills(FILE),
    [`PUT /contents/${PATH}`]: () => {
      puts += 1;
      return { status: 200, body: {} };
    },
  });
  try {
    const bodies = [
      { skills: { Junk: { ...LORE, name: 'Junk', attribute: 'Luck' } } }, // unknown attribute
      { skills: { Alchemy: { ...DANCE, name: 'Alchemy' } } }, // core-name collision
      { skills: { alchemy: { ...DANCE, name: 'alchemy' } } }, // case-insensitive collision
      { skills: { Knowledge: { ...LORE, name: 'Knowledge' } } }, // generic template name
      { skills: { 'Bad (x)': { ...LORE, name: 'Bad (x)' } } },
      { skills: { Tall: { ...LORE, name: 'Tall', tier: 2 } } }, // Knowledge cannot be Journeyman
      { skills: { Hacked: { ...LORE, name: 'Hacked', effects: [] } } }, // unknown key
      { skills: { Bad: 'not a skill' } },
      { skills: { Bad: null } },
      { skills: 'nope' },
      {},
    ];
    for (const body of bodies) {
      const { status, json } = await call(req(body));
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(json.error.code, 'invalid_skills');
    }
    assert.equal(puts, 0);
  } finally {
    mock.restore();
  }
});

test('a name colliding with an existing custom skill (different case) is rejected', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSkills(FILE), ...putOk() });
  try {
    const { status, json } = await call(req({ skills: { 'dwarven mining lore': { ...LORE, name: 'dwarven mining lore' } } }));
    assert.equal(status, 400);
    assert.equal(json.error.code, 'invalid_skills');
  } finally {
    mock.restore();
  }
});

test('save-skills fails closed on auth (wrong, missing or unconfigured key -> 401)', async () => {
  assert.equal((await call(req({ skills: {} }, { key: 'nope' }))).status, 401);
  assert.equal((await call(req({ skills: {} }, { key: null }))).status, 401);
  assert.equal((await call(req({ skills: {} }), { ...ENV, SAVE_KEY: undefined })).status, 401);
});

test('a character-shaped body to /save-skills is a 400 invalid_skills', async () => {
  const { status, json } = await call(req({ character: { schema: 'ed-character/1', meta: { name: 'T' } }, id: 'x' }));
  assert.equal(status, 400);
  assert.equal(json.error.code, 'invalid_skills');
});

test('/save and /save-items still reject skills-shaped bodies', async () => {
  const a = await call(req({ skills: { [LORE.name]: LORE } }, { path: '/save' }));
  assert.equal(a.status, 400);
  assert.equal(a.json.error.code, 'invalid_character');
  const b = await call(req({ skills: { [LORE.name]: LORE } }, { path: '/save-items' }));
  assert.equal(b.status, 400);
  assert.equal(b.json.error.code, 'invalid_items');
});

test('save-skills target is env-pinned to GITHUB_SKILLS_PATH', async () => {
  const path = 'data/other-skills.json';
  const mock = mockGitHub({
    ...branchExists,
    [`GET /contents/${path}`]: () => ({ status: 200, body: { sha: 's', content: b64(FILE) } }),
    [`PUT /contents/${path}`]: () => ({ status: 200, body: { content: { sha: 'c', html_url: 'u' } } }),
  });
  try {
    const { status } = await call(req({ skills: { [DANCE.name]: DANCE } }), { ...ENV, GITHUB_SKILLS_PATH: path });
    assert.equal(status, 200);
    assert.ok(mock.calls.find((c) => c.method === 'PUT').url.endsWith(`/contents/${path}`));
  } finally {
    mock.restore();
  }
});

test('save-skills 409 then 200 -> retry re-reads the moved sha', async () => {
  let reads = 0;
  let puts = 0;
  const mock = mockGitHub({
    ...branchExists,
    [`GET /contents/${PATH}`]: () => {
      reads += 1;
      return { status: 200, body: { sha: `s${reads}`, content: b64(FILE) } };
    },
    [`PUT /contents/${PATH}`]: () => {
      puts += 1;
      return puts === 1 ? { status: 409, body: {} } : { status: 200, body: { content: { sha: 'ok', html_url: 'u' } } };
    },
  });
  try {
    const { status } = await call(req({ skills: { [DANCE.name]: DANCE } }));
    assert.equal(status, 200);
    assert.equal(puts, 2);
    const putsArr = mock.calls.filter((c) => c.method === 'PUT');
    assert.equal(JSON.parse(putsArr[1].options.body).sha, 's2');
  } finally {
    mock.restore();
  }
});

test('save-skills persistent 409 -> 409 conflict after 3 attempts', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSkills(FILE), [`PUT /contents/${PATH}`]: () => ({ status: 409, body: {} }) });
  try {
    const { status, json } = await call(req({ skills: { [DANCE.name]: DANCE } }));
    assert.equal(status, 409);
    assert.equal(json.error.code, 'conflict');
    assert.equal(mock.calls.filter((c) => c.method === 'PUT').length, 3);
  } finally {
    mock.restore();
  }
});

test('save-skills non-409 GitHub failure (403) -> 502 github_auth', async () => {
  const mock = mockGitHub({ ...branchExists, ...readsSkills(FILE), [`PUT /contents/${PATH}`]: () => ({ status: 403, body: {} }) });
  try {
    const { status, json } = await call(req({ skills: { [DANCE.name]: DANCE } }));
    assert.equal(status, 502);
    assert.equal(json.error.code, 'github_auth');
  } finally {
    mock.restore();
  }
});

test('CORS preflight for /save-skills answers 204', async () => {
  const res = await worker.fetch(new Request('https://worker.test/save-skills', { method: 'OPTIONS' }), ENV);
  assert.equal(res.status, 204);
});
