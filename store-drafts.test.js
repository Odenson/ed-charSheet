// store-drafts.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A4: `store-drafts.js`, the localStorage draft layer (spec A4 "store-drafts.js").
// A draft is a BASE ENVELOPE `ed-character-draft:<id>` = { v: 1, createdAt, character } plus the ordinary
// edits overlay `ed-character-edits:<id>`. Imports of a not-yet-existing module are expected to fail
// until the dev builds it. The localStorage shim has key(i)/length because listDrafts scans keys
// (precedent: store-start-discipline.test.js).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from './store.js';
import {
  DRAFT_PREFIX,
  draftKey,
  saveDraft,
  loadDraft,
  isDraft,
  listDrafts,
  discardDraft,
  renameDraft,
  promoteDraft,
  mergeRows,
  loadDraftCharacter,
} from './store-drafts.js';

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
const EDITS = (id) => `ed-character-edits:${id}`;
const raw = (k) => JSON.parse(localStorage.getItem(k));

const char = (id, name = `Name of ${id}`, discipline = 'Archer', race = 'Human') => ({
  schema: 'ed-character/2',
  meta: { id, name, race },
  attributes: { Dexterity: { base: 10, points: 0, increases: 0 } },
  disciplines: [{ name: discipline, circle: 1, talents: [{ name: 'Durability', rank: 1, circle: 1 }, { name: 'Karma Ritual', rank: 1, circle: 1 }] }],
  skills: [],
  knacks: [],
  traits: [],
  resources: { karma: { converted: 5, spent: 0 }, legend: { earned: [] }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  items: [{ name: 'Dagger', equipped: true }],
  wealth: { coins: { silver: 100 }, gems: [] },
  creation: { open: true, free: { talents: { [`${discipline}/Durability`]: 1, [`${discipline}/Karma Ritual`]: 1 }, skills: {}, spells: [] } },
});

beforeEach(() => memory.clear());

describe('keys', () => {
  test('DRAFT_PREFIX and draftKey', () => {
    assert.equal(DRAFT_PREFIX, 'ed-character-draft:');
    assert.equal(draftKey('kolon'), 'ed-character-draft:kolon');
  });
});

describe('saveDraft / loadDraft / isDraft', () => {
  test('saveDraft stores { v: 1, createdAt, character } under the draft key and returns that envelope', () => {
    const c = char('kolon');
    const env = saveDraft(c);
    assert.deepEqual(Object.keys(env).sort(), ['character', 'createdAt', 'v']);
    assert.equal(env.v, 1);
    assert.deepEqual(env.character, c);
    assert.equal(new Date(env.createdAt).toISOString(), env.createdAt, 'createdAt is an ISO timestamp');
    assert.deepEqual(raw(draftKey('kolon')), env, 'what is stored is the returned envelope');
  });

  test('the id is character.meta.id; saveDraft throws without one and stores nothing', () => {
    for (const bad of [{ schema: 'ed-character/2' }, { meta: {} }, { meta: { id: '' } }, { meta: { name: 'x' } }]) {
      assert.throws(() => saveDraft(bad), JSON.stringify(bad));
    }
    assert.equal(memory.size, 0);
  });

  test('re-saving keeps the existing createdAt and replaces the character', () => {
    localStorage.setItem(draftKey('kolon'), JSON.stringify({ v: 1, createdAt: '2020-01-02T03:04:05.000Z', character: char('kolon', 'Old') }));
    const env = saveDraft(char('kolon', 'New'));
    assert.equal(env.createdAt, '2020-01-02T03:04:05.000Z');
    assert.equal(raw(draftKey('kolon')).character.meta.name, 'New');
  });

  test('loadDraft round-trips the envelope; isDraft is true', () => {
    const env = saveDraft(char('kolon'));
    assert.deepEqual(loadDraft('kolon'), env);
    assert.equal(isDraft('kolon'), true);
  });

  test('an absent draft reads as null / false', () => {
    assert.equal(loadDraft('nobody'), null);
    assert.equal(isDraft('nobody'), false);
  });

  test('a corrupt or unsupported envelope reads as absent and never throws', () => {
    const cases = {
      'not-json': '{oops',
      'wrong-version': JSON.stringify({ v: 2, createdAt: '2020-01-01T00:00:00.000Z', character: char('wrong-version') }),
      'no-version': JSON.stringify({ createdAt: '2020-01-01T00:00:00.000Z', character: char('no-version') }),
      'json-null': 'null',
      'json-number': '42',
      'json-string': '"hello"',
      'json-array': '[]',
    };
    for (const [id, text] of Object.entries(cases)) {
      localStorage.setItem(draftKey(id), text);
      assert.doesNotThrow(() => loadDraft(id), id);
      assert.equal(loadDraft(id), null, id);
      assert.equal(isDraft(id), false, id);
    }
  });
});

describe('listDrafts', () => {
  test('rows are { id, name, portrait: null, draft: true, race, discipline, createdAt }, sorted by id', () => {
    const zed = saveDraft(char('zed', 'Zed the Red', 'Warrior', 'Ork'));
    const abe = saveDraft(char('abe', 'Abe', 'Nethermancer', 'Elf'));
    assert.deepEqual(listDrafts(), [
      { id: 'abe', name: 'Abe', portrait: null, draft: true, race: 'Elf', discipline: 'Nethermancer', createdAt: abe.createdAt },
      { id: 'zed', name: 'Zed the Red', portrait: null, draft: true, race: 'Ork', discipline: 'Warrior', createdAt: zed.createdAt },
    ]);
  });

  test('corrupt envelopes are skipped; other localStorage keys are ignored', () => {
    saveDraft(char('good'));
    localStorage.setItem(draftKey('bad'), '{oops');
    localStorage.setItem(draftKey('old'), JSON.stringify({ v: 9, character: char('old') }));
    localStorage.setItem(EDITS('good'), JSON.stringify({ meta: { name: 'x' } }));
    localStorage.setItem('ed-character', 'good');
    localStorage.setItem('ed-rolllog:good', '[]');
    assert.deepEqual(listDrafts().map((r) => r.id), ['good']);
  });

  test('no drafts gives an empty list', () => {
    assert.deepEqual(listDrafts(), []);
  });

  test('a draft row is picker-ready: a portrait-less row like an index row without a portrait (portrait is null, name is a string)', () => {
    saveDraft(char('kolon', 'Kolon'));
    const [row] = listDrafts();
    const indexRow = store.indexToRows({ characters: { kolon: { name: 'Kolon' } } })[0];
    assert.equal(row.portrait, null);
    assert.equal(typeof row.name, 'string');
    for (const k of Object.keys(indexRow)) assert.ok(k in row, `draft row has the index-row field ${k}`);
    assert.equal(row.draft, true);
  });
});

describe('discardDraft', () => {
  test('removes the draft base AND its overlay, and only those two keys', () => {
    saveDraft(char('a'));
    saveDraft(char('b'));
    localStorage.setItem(EDITS('a'), JSON.stringify({ meta: { name: 'A2' } }));
    localStorage.setItem(EDITS('b'), JSON.stringify({ meta: { name: 'B2' } }));
    localStorage.setItem('ed-rolllog:a', '[1]');
    localStorage.setItem('ed-discord:a', '{}');
    localStorage.setItem('ed-character', 'a');
    discardDraft('a');
    assert.equal(localStorage.getItem(draftKey('a')), null);
    assert.equal(localStorage.getItem(EDITS('a')), null);
    assert.ok(localStorage.getItem(draftKey('b')), "another draft's base survives");
    assert.ok(localStorage.getItem(EDITS('b')), "another character's overlay survives");
    assert.equal(localStorage.getItem('ed-rolllog:a'), '[1]', 'device-local keys are cleared by the ed-app handler, not here');
    assert.equal(localStorage.getItem('ed-discord:a'), '{}');
    assert.equal(localStorage.getItem('ed-character'), 'a');
  });

  test('leaves a SAVED character overlay (same-looking id) alone and tolerates a missing draft', () => {
    localStorage.setItem(EDITS('saved'), JSON.stringify({ items: [] }));
    assert.doesNotThrow(() => discardDraft('nothing-here'));
    assert.ok(localStorage.getItem(EDITS('saved')));
    assert.deepEqual(listDrafts(), []);
  });
});

describe('renameDraft(oldId, newId, name)', () => {
  test('moves the base and the overlay to the new id and patches meta.id / meta.name in both', () => {
    saveDraft(char('old', 'Old Name'));
    localStorage.setItem(EDITS('old'), JSON.stringify({ meta: { id: 'old', name: 'Old Name', age: 22 }, creation: { open: true, free: { talents: {}, skills: {}, spells: [] } } }));
    assert.equal(renameDraft('old', 'fresh', 'Fresh Name'), true);
    assert.equal(localStorage.getItem(draftKey('old')), null);
    assert.equal(localStorage.getItem(EDITS('old')), null);
    const env = raw(draftKey('fresh'));
    assert.equal(env.v, 1);
    assert.equal(env.character.meta.id, 'fresh');
    assert.equal(env.character.meta.name, 'Fresh Name');
    assert.equal(env.character.meta.race, 'Human', 'other meta fields are kept');
    const overlay = raw(EDITS('fresh'));
    assert.equal(overlay.meta.id, 'fresh');
    assert.equal(overlay.meta.name, 'Fresh Name');
    assert.equal(overlay.meta.age, 22, 'other overlay meta fields are kept');
    assert.deepEqual(overlay.creation, { open: true, free: { talents: {}, skills: {}, spells: [] } }, 'other overlay categories move intact');
    assert.deepEqual(listDrafts().map((r) => [r.id, r.name]), [['fresh', 'Fresh Name']]);
  });

  test('with no overlay none is created; an overlay without meta gets no meta invented', () => {
    saveDraft(char('a'));
    assert.equal(renameDraft('a', 'b', 'B'), true);
    assert.equal(localStorage.getItem(EDITS('b')), null);
    saveDraft(char('c'));
    localStorage.setItem(EDITS('c'), JSON.stringify({ items: [] }));
    assert.equal(renameDraft('c', 'd', 'D'), true);
    assert.deepEqual(raw(EDITS('d')), { items: [] });
  });

  test('refuses (false) when the old draft is missing, and creates nothing', () => {
    assert.equal(renameDraft('ghost', 'new', 'New'), false);
    assert.equal(memory.size, 0);
  });

  test('refuses (false) when the new id is already a draft, and moves nothing', () => {
    saveDraft(char('a', 'A'));
    saveDraft(char('b', 'B'));
    localStorage.setItem(EDITS('a'), JSON.stringify({ meta: { name: 'A2' } }));
    const before = [...memory.entries()];
    assert.equal(renameDraft('a', 'b', 'Taken'), false);
    assert.deepEqual([...memory.entries()], before, 'storage is byte-identical');
  });

  test('the renamed draft loads under the new id with the patched character', () => {
    saveDraft(char('a', 'A'));
    renameDraft('a', 'z', 'Z');
    assert.equal(isDraft('a'), false);
    assert.equal(isDraft('z'), true);
    assert.equal(loadDraft('z').character.meta.name, 'Z');
  });
});

describe('promoteDraft(id): after a confirmed first save', () => {
  test('clears the saved overlay categories (incl. attributes, creation, spells) and removes the base: no draft, clean overlay', () => {
    saveDraft(char('adept'));
    store.saveMetaEdits({ name: 'Adept' }, 'adept');
    store.saveAdvancementEdits({ disciplines: char('adept').disciplines, skills: [] }, 'adept');
    store.saveAttributeEdits(char('adept').attributes, 'adept');
    store.saveCreationEdits(char('adept').creation, 'adept');
    store.saveSpellEdits({ known: [], matrices: [] }, 'adept');
    assert.equal(store.hasPendingEdits('adept'), true);
    promoteDraft('adept');
    assert.equal(isDraft('adept'), false);
    assert.equal(loadDraft('adept'), null);
    assert.equal(store.hasPendingEdits('adept'), false);
    assert.equal(localStorage.getItem(EDITS('adept')), null);
    assert.deepEqual(listDrafts(), []);
  });

  test('touches nothing else: another draft, another overlay and device-local keys survive', () => {
    saveDraft(char('adept'));
    saveDraft(char('other'));
    store.saveMetaEdits({ name: 'X' }, 'other');
    localStorage.setItem('ed-rolllog:adept', '[1]');
    promoteDraft('adept');
    assert.equal(isDraft('other'), true);
    assert.ok(localStorage.getItem(EDITS('other')));
    assert.equal(localStorage.getItem('ed-rolllog:adept'), '[1]');
  });

  test('promoting a draft with no overlay is fine', () => {
    saveDraft(char('adept'));
    assert.doesNotThrow(() => promoteDraft('adept'));
    assert.equal(isDraft('adept'), false);
  });
});

describe('mergeRows(indexRows, draftRows)', () => {
  const index = [
    { id: 'chakka', name: 'Chakka', portrait: 'data/chakka.jpg' },
    { id: 'kolon', name: 'Kolon', portrait: null },
  ];
  const drafts = [
    { id: 'zed', name: 'Zed', portrait: null, draft: true, race: 'Ork', discipline: 'Warrior', createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'abe', name: 'Abe', portrait: null, draft: true, race: 'Elf', discipline: 'Thief', createdAt: '2025-01-02T00:00:00.000Z' },
  ];

  test('sorted by id; draft rows keep draft: true; index rows are not flagged', () => {
    const rows = mergeRows(index, drafts);
    assert.deepEqual(rows.map((r) => r.id), ['abe', 'chakka', 'kolon', 'zed']);
    assert.equal(rows.find((r) => r.id === 'abe').draft, true);
    assert.equal(rows.find((r) => r.id === 'zed').draft, true);
    assert.notEqual(rows.find((r) => r.id === 'chakka').draft, true);
    assert.deepEqual(rows.find((r) => r.id === 'chakka'), index[0]);
  });

  test('an id in both: the index row wins and the shadowed draft is hidden', () => {
    const rows = mergeRows(index, [{ id: 'kolon', name: 'Draft Kolon', portrait: null, draft: true, race: 'Ork', discipline: 'Archer', createdAt: 'x' }, ...drafts]);
    assert.deepEqual(rows.map((r) => r.id), ['abe', 'chakka', 'kolon', 'zed']);
    const kolon = rows.find((r) => r.id === 'kolon');
    assert.equal(kolon.name, 'Kolon');
    assert.notEqual(kolon.draft, true);
  });

  test('either side may be empty; inputs are not mutated', () => {
    assert.deepEqual(mergeRows([], []), []);
    assert.deepEqual(mergeRows(index, []).map((r) => r.id), ['chakka', 'kolon']);
    assert.deepEqual(mergeRows([], drafts).map((r) => r.id), ['abe', 'zed']);
    const before = JSON.stringify([index, drafts]);
    mergeRows(index, drafts);
    assert.equal(JSON.stringify([index, drafts]), before);
    assert.deepEqual(drafts.map((r) => r.id), ['zed', 'abe'], 'the draft array keeps its order');
  });
});

describe('loadDraftCharacter(id) -> { character, rules, base: null }', () => {
  let originalFetch;
  let originalLocation;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalLocation = globalThis.location;
    globalThis.location = { protocol: 'http:', hostname: 'localhost' };
    // Serve ./rules/*.json from disk; everything else (data/*, the live branch) is a 404.
    globalThis.fetch = async (url) => {
      const m = /^\.\/rules\/([\w-]+\.json)$/.exec(String(url));
      if (!m) return new Response('not found', { status: 404 });
      try {
        return new Response(readFileSync(new URL(`./rules/${m[1]}`, import.meta.url)), { status: 200 });
      } catch {
        return new Response('not found', { status: 404 });
      }
    };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  });

  test('applies the ordinary edits overlay over the base and returns base: null (the first Save takes the create path)', async () => {
    saveDraft(char('adept'));
    const advanced = { disciplines: [{ name: 'Archer', circle: 1, talents: [{ name: 'Durability', rank: 1, circle: 1 }, { name: 'Karma Ritual', rank: 1, circle: 1 }, { name: 'Missile Weapon', rank: 3, circle: 1 }] }], skills: [{ name: 'Climbing', rank: 1, tier: 'Novice' }] };
    store.saveAdvancementEdits(advanced, 'adept');
    const creation = { open: true, free: { talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 3 }, skills: { Climbing: 1 }, spells: [] } };
    store.saveCreationEdits(creation, 'adept');
    const out = await loadDraftCharacter('adept');
    assert.equal(out.base, null);
    assert.deepEqual(out.character.disciplines, advanced.disciplines);
    assert.deepEqual(out.character.skills, advanced.skills);
    assert.deepEqual(out.character.creation, creation);
    assert.equal(out.character.meta.id, 'adept');
    assert.ok(out.rules.disciplinesFile.disciplines.length >= 4, 'the rules bundle is loaded too');
    assert.ok(out.rules.racesFile.races.length >= 8);
  });

  test('survives a reload: nothing but localStorage is needed to get the same draft back', async () => {
    saveDraft(char('adept'));
    store.saveCreationEdits({ open: false, free: { talents: {}, skills: {}, spells: [] } }, 'adept');
    const first = await loadDraftCharacter('adept');
    const second = await loadDraftCharacter('adept');
    assert.deepEqual(second.character, first.character);
    assert.equal(second.character.creation.open, false);
  });

  test('throws when there is no draft (absent, corrupt or wrong version)', async () => {
    await assert.rejects(loadDraftCharacter('nobody'));
    localStorage.setItem(draftKey('bad'), '{oops');
    await assert.rejects(loadDraftCharacter('bad'));
    localStorage.setItem(draftKey('old'), JSON.stringify({ v: 2, character: char('old') }));
    await assert.rejects(loadDraftCharacter('old'));
  });

  test('a corrupt OVERLAY never blocks loading the base (loadEdits precedent)', async () => {
    saveDraft(char('adept'));
    localStorage.setItem(EDITS('adept'), '{oops');
    const out = await loadDraftCharacter('adept');
    assert.equal(out.character.meta.id, 'adept');
  });
});
