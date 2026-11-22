// store-first-save.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A4: `store-first-save.js`, the injected-I/O first-Save check (spec A4; plan I6 "id
// race (F5)"): saveDraftFirstTime({ character, id, fetchTakenIds, post }).
//   taken = await fetchTakenIds()            // a FRESH index read; a rejection propagates, nothing is posted
//   idTaken(id, taken) -> { ok: false, reason: 'id-taken', id }   // post is never called
//   else            -> { ok: true, commit: await post(character, id) }   // post sends base: null
// Imports of a not-yet-existing module are expected to fail until the dev builds it. The draft-store
// integration case (rename after a clash) also exercises store-drafts.js.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveDraftFirstTime } from './store-first-save.js';
import { saveDraft, loadDraft, renameDraft, isDraft } from './store-drafts.js';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
beforeEach(() => memory.clear());

const draftChar = (id, name = id) => ({
  schema: 'ed-character/2',
  meta: { id, name, race: 'Human' },
  disciplines: [{ name: 'Archer', circle: 1, talents: [] }],
  creation: { open: true, free: { talents: {}, skills: {}, spells: [] } },
});

// Recording fakes: `post` returns a commit like saveServer does; `fetchTakenIds` serves a scripted index.
function fakes({ index = [], failFetch = null, failPost = null } = {}) {
  const calls = { fetch: 0, post: [] };
  return {
    calls,
    fetchTakenIds: async () => {
      calls.fetch++;
      if (failFetch) throw failFetch;
      return typeof index === 'function' ? index() : index;
    },
    post: async (...args) => {
      calls.post.push(args);
      if (failPost) throw failPost;
      return { sha: 'new-file-sha', url: 'https://gh/commit/new' };
    },
  };
}

describe('the id re-check', () => {
  test('a free id posts exactly once with (character, id) and returns { ok: true, commit }', async () => {
    const f = fakes({ index: ['chakka', 'kolon'] });
    const c = draftChar('adept');
    const out = await saveDraftFirstTime({ character: c, id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.deepEqual(out, { ok: true, commit: { sha: 'new-file-sha', url: 'https://gh/commit/new' } });
    assert.equal(f.calls.post.length, 1);
    assert.equal(f.calls.post[0][0], c);
    assert.equal(f.calls.post[0][1], 'adept');
  });

  test('ID RACE (F5): the index gained the id between draft creation and first Save -> { ok: false, reason: id-taken, id }, post never called', async () => {
    const f = fakes({ index: ['chakka', 'adept'] }); // another device saved "adept" meanwhile
    const out = await saveDraftFirstTime({ character: draftChar('adept'), id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.deepEqual(out, { ok: false, reason: 'id-taken', id: 'adept' });
    assert.equal(f.calls.post.length, 0, 'nothing is posted, so the existing character cannot be overwritten');
  });

  test('the index may be an array or a Set of ids', async () => {
    for (const index of [['adept'], new Set(['adept'])]) {
      const f = fakes({ index });
      const out = await saveDraftFirstTime({ character: draftChar('adept'), id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
      assert.equal(out.ok, false);
      assert.equal(f.calls.post.length, 0);
    }
  });

  test('a MISSING index ([] from listCharacters) is not a clash: the draft posts', async () => {
    const f = fakes({ index: [] });
    const out = await saveDraftFirstTime({ character: draftChar('adept'), id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.equal(out.ok, true);
    assert.equal(f.calls.post.length, 1);
  });

  test('only an EXACT id match blocks: kolon-2 or Kolon do not clash with kolon (no suffix logic)', async () => {
    const f = fakes({ index: ['kolon-2', 'kolonel'] });
    const out = await saveDraftFirstTime({ character: draftChar('kolon'), id: 'kolon', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.equal(out.ok, true);
  });

  test('every save does a FRESH index read (fetchTakenIds is called once per attempt, never cached)', async () => {
    let state = ['chakka'];
    const f = fakes({ index: () => state });
    const c = draftChar('adept');
    const first = await saveDraftFirstTime({ character: c, id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.equal(first.ok, true);
    state = ['chakka', 'adept']; // taken since
    const second = await saveDraftFirstTime({ character: c, id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.equal(second.ok, false);
    assert.equal(f.calls.fetch, 2);
    assert.equal(f.calls.post.length, 1);
  });
});

describe('failures propagate and post nothing', () => {
  test('a fetchTakenIds rejection rejects the save; post is never called', async () => {
    const boom = new Error('index fetch failed: 500');
    const f = fakes({ failFetch: boom });
    await assert.rejects(saveDraftFirstTime({ character: draftChar('adept'), id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post }), (e) => e === boom);
    assert.equal(f.calls.post.length, 0);
  });

  test('a post rejection rejects the save (the caller shows the save-error toast and keeps the draft)', async () => {
    const boom = new Error('offline');
    const f = fakes({ index: [], failPost: boom });
    await assert.rejects(saveDraftFirstTime({ character: draftChar('adept'), id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post }), (e) => e === boom);
    assert.equal(f.calls.post.length, 1);
  });

  test('the character argument is never mutated and the draft store is left alone (promotion is the caller job)', async () => {
    saveDraft(draftChar('adept'));
    const c = draftChar('adept');
    const frozen = structuredClone(c);
    const f = fakes({ index: [] });
    await saveDraftFirstTime({ character: c, id: 'adept', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.deepEqual(c, frozen);
    assert.equal(isDraft('adept'), true, 'the draft is still there until the caller promotes it after a confirmed save');
  });
});

describe('rename after a clash, then the save goes through (the rename modal flow)', () => {
  test('blocked under "kolon", renameDraft to a free id, then the second attempt posts once under the new id', async () => {
    const f = fakes({ index: ['kolon'] });
    saveDraft(draftChar('kolon', 'Kolon'));

    const blocked = await saveDraftFirstTime({ character: loadDraft('kolon').character, id: 'kolon', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.deepEqual(blocked, { ok: false, reason: 'id-taken', id: 'kolon' });
    assert.equal(f.calls.post.length, 0);

    assert.equal(renameDraft('kolon', 'kolon-the-second', 'Kolon the Second'), true);
    const renamed = loadDraft('kolon-the-second').character;
    assert.equal(renamed.meta.id, 'kolon-the-second');

    const ok = await saveDraftFirstTime({ character: renamed, id: 'kolon-the-second', fetchTakenIds: f.fetchTakenIds, post: f.post });
    assert.equal(ok.ok, true);
    assert.equal(f.calls.post.length, 1, 'posted exactly once, after the rename');
    assert.equal(f.calls.post[0][1], 'kolon-the-second');
    assert.equal(f.calls.post[0][0].meta.name, 'Kolon the Second');
    assert.equal(f.calls.fetch, 2, 'the check ran again on the new id');
  });
});
