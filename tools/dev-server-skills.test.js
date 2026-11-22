// tools/dev-server-skills.test.js — run with `npm test` (node --test, no deps).
// Parity of the local dev server's POST /save-skills with the worker route
// (plans/gen-skill-other I4): merge into data/custom-skills.json, invalid_skills 400,
// failed merges never land. Temp docroot; real rules/ copied in so a server that reads
// core names/attributes from the docroot or from the repo behaves the same.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevServer } from './dev-server.mjs';

const LORE = { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true };
const DANCE = { name: 'Rope Dancing', category: 'general', tier: 2, strain: 0, attribute: 'Dexterity', summary: 'On a rope.', custom: true };

function makeDocroot() {
  const root = mkdtempSync(join(tmpdir(), 'ed-dev-skills-'));
  writeFileSync(join(root, 'index.html'), '<!doctype html>');
  mkdirSync(join(root, 'rules'), { recursive: true });
  for (const f of ['skills.json', 'attributes.json']) copyFileSync(new URL(`../rules/${f}`, import.meta.url), join(root, 'rules', f));
  return root;
}

async function withServer(fn) {
  const root = makeDocroot();
  const server = createDevServer({ root });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const request = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    await fn({ request });
  } finally {
    await new Promise((r) => server.close(r));
    rmSync(root, { recursive: true, force: true });
  }
}

test('/save-skills creates data/custom-skills.json (ed-skills/1 header + skill)', async () => {
  await withServer(async ({ request }) => {
    const res = await request('POST', '/save-skills', { skills: { [LORE.name]: LORE } });
    assert.equal(res.status, 200);
    const read = await request('GET', '/data/custom-skills.json');
    assert.equal(read.status, 200);
    assert.equal(read.body.schema, 'ed-skills/1');
    assert.ok(Array.isArray(read.body.skills));
    assert.deepEqual(read.body.skills, [LORE]);
  });
});

test('/save-skills merges onto an existing file without losing others; same name replaces', async () => {
  await withServer(async ({ request }) => {
    await request('POST', '/save-skills', { skills: { [LORE.name]: LORE } });
    await request('POST', '/save-skills', { skills: { [DANCE.name]: DANCE } });
    let read = await request('GET', '/data/custom-skills.json');
    assert.deepEqual(read.body.skills.map((s) => s.name).sort(), ['Dwarven Mining Lore', 'Rope Dancing']);
    const edited = { ...LORE, summary: 'Edited.' };
    await request('POST', '/save-skills', { skills: { [LORE.name]: edited } });
    read = await request('GET', '/data/custom-skills.json');
    assert.equal(read.body.skills.length, 2);
    assert.deepEqual(read.body.skills.find((s) => s.name === LORE.name), edited);
  });
});

test('/save-skills rejects invalid skills with 400 invalid_skills and leaves the file untouched', async () => {
  await withServer(async ({ request }) => {
    await request('POST', '/save-skills', { skills: { [LORE.name]: LORE } });
    const bodies = [
      { skills: { Junk: { ...LORE, name: 'Junk', attribute: 'Luck' } } }, // unknown attribute
      { skills: { Alchemy: { ...DANCE, name: 'Alchemy' } } }, // core-name collision
      { skills: { 'alchemy': { ...DANCE, name: 'alchemy' } } }, // case-insensitive collision
      { skills: { 'Bad (x)': { ...LORE, name: 'Bad (x)' } } }, // parentheses
      { skills: { Hacked: { ...LORE, name: 'Hacked', action: 'Standard' } } }, // unknown key
      { skills: { Bad: 'not a skill' } },
      { skills: 'nope' },
    ];
    for (const b of bodies) {
      const res = await request('POST', '/save-skills', b);
      assert.equal(res.status, 400, JSON.stringify(b));
      assert.equal(res.body.error.code, 'invalid_skills');
    }
    const read = await request('GET', '/data/custom-skills.json');
    assert.deepEqual(read.body.skills, [LORE], 'a failed merge never lands');
  });
});

test('/save-skills requires a skills envelope', async () => {
  await withServer(async ({ request }) => {
    const res = await request('POST', '/save-skills', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'invalid_skills');
  });
});

test('the 404 hint lists /save-skills', async () => {
  await withServer(async ({ request }) => {
    const res = await request('POST', '/nope', {});
    assert.equal(res.status, 404);
    assert.match(res.body.error.message, /save-skills/);
  });
});
