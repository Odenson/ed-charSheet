// store-overlay-creation.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A2, overlay half (spec "New overlay categories"): the edits overlay
// (`ed-character-edits:<id>`) gains `attributes` (whole attributes map, replaced), `creation`
// (whole block, replaced) and the pre-existing gap `spells` (merged by applyEdits today but missing
// from SAVED_CATEGORIES, so hasPendingEdits ignored it and reconcileOverlay never cleared it).
// NEW-FEATURE tests: they fail until the dev builds the feature. The existing categories are pinned
// in store-creation-golden.test.js.
//
// Includes the REGRESSION for an existing caster: a spells edit now marks the character dirty and
// is cleared by a confirmed save (reconcileOverlay).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as store from './store.js';

const { applyEdits, forSave, hasPendingEdits, reconcileOverlay, saveSpellEdits, saveMetaEdits, saveAdvancementEdits } = store;

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
const KEY = (id) => `ed-character-edits:${id}`;
const overlay = (id) => JSON.parse(localStorage.getItem(KEY(id)));

const attrs = (over = {}) => ({
  Dexterity: { base: 10, points: 0, increases: 0 },
  Strength: { base: 10, points: 0, increases: 0 },
  Toughness: { base: 10, points: 0, increases: 0 },
  Perception: { base: 10, points: 0, increases: 0 },
  Willpower: { base: 10, points: 0, increases: 0 },
  Charisma: { base: 10, points: 0, increases: 0 },
  ...over,
});
const creation = (over = {}) => ({ open: true, free: { talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 }, skills: {}, spells: [] }, ...over });
const base = () => ({
  schema: 'ed-character/2',
  meta: { id: 'adept', name: 'Adept', race: 'Human' },
  attributes: attrs(),
  disciplines: [{ name: 'Archer', circle: 1, talents: [{ name: 'Durability', rank: 1, circle: 1 }, { name: 'Karma Ritual', rank: 1, circle: 1 }] }],
  skills: [],
  knacks: [],
  resources: { karma: { converted: 5, spent: 0 }, legend: { earned: [] }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  items: [],
  creation: creation(),
});

describe('attributes and creation overlay categories', () => {
  test('saveAttributeEdits writes the WHOLE attributes map under `attributes`; applyEdits replaces the map', () => {
    memory.clear();
    const next = attrs({ Dexterity: { base: 10, points: 4, increases: 0 }, Strength: { base: 10, points: 2, increases: 0 } });
    store.saveAttributeEdits(next, 'adept');
    assert.deepEqual(overlay('adept').attributes, next);
    const out = applyEdits(base(), overlay('adept'));
    assert.deepEqual(out.attributes, next);
  });

  test('applyEdits `attributes` is a REPLACE, not a merge: a map missing a key drops it', () => {
    memory.clear();
    const partial = { Dexterity: { base: 10, points: 1, increases: 0 } };
    const out = applyEdits(base(), { attributes: partial });
    assert.deepEqual(out.attributes, partial);
  });

  test('saveCreationEdits writes the WHOLE creation block under `creation`; applyEdits replaces the block', () => {
    memory.clear();
    const closed = { open: false, free: { talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 3 }, skills: { Climbing: 1 }, spells: [] } };
    store.saveCreationEdits(closed, 'adept');
    assert.deepEqual(overlay('adept').creation, closed);
    const out = applyEdits(base(), overlay('adept'));
    assert.deepEqual(out.creation, closed, 'replaced as a whole, no deep merge with the base block');
  });

  test('creation is REPLACED, not deep-merged: a ledger key the edit no longer has (a talent lowered to 0) is not resurrected from the base', () => {
    const richBase = base();
    richBase.creation = { open: true, free: { talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 3 }, skills: { Climbing: 1 }, spells: ['Astral Spear'] } };
    const edit = { open: true, free: { talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 }, skills: {}, spells: [] } };
    const out = applyEdits(richBase, { creation: edit });
    assert.deepEqual(out.creation, edit);
    assert.ok(!('Archer/Missile Weapon' in out.creation.free.talents));
  });

  test('a creation edit on a character whose base has no block still lands (a draft base always has one, a saved mid-creation file too)', () => {
    const bare = base();
    delete bare.creation;
    assert.deepEqual(applyEdits(bare, { creation: creation() }).creation, creation());
  });

  test('the save functions touch only their own category and keep the others', () => {
    memory.clear();
    saveMetaEdits({ name: 'Renamed' }, 'adept');
    store.saveAttributeEdits(attrs({ Dexterity: { base: 10, points: 3, increases: 0 } }), 'adept');
    store.saveCreationEdits(creation({ open: false }), 'adept');
    const o = overlay('adept');
    assert.equal(o.meta.name, 'Renamed');
    assert.equal(o.attributes.Dexterity.points, 3);
    assert.equal(o.creation.open, false);
    store.saveAttributeEdits(attrs(), 'adept');
    assert.equal(overlay('adept').creation.open, false, 'a later attributes save does not disturb the creation block');
  });

  test('overlays are per id: another character is untouched', () => {
    memory.clear();
    store.saveCreationEdits(creation(), 'a');
    assert.equal(localStorage.getItem(KEY('b')), null);
    assert.equal(hasPendingEdits('b'), false);
  });

  test('forSave carries the creation block through unchanged and keeps ed-character/2', () => {
    const c = base();
    c.creation = creation({ open: false });
    const out = forSave(c);
    assert.deepEqual(out.creation, c.creation);
    assert.equal(out.schema, 'ed-character/2');
    assert.deepEqual(Object.keys(out.creation).sort(), ['free', 'open']);
    assert.deepEqual(Object.keys(out.creation.free).sort(), ['skills', 'spells', 'talents']);
  });
});

describe('dirty indicator (hasPendingEdits) and reconcileOverlay cover the new categories', () => {
  const SAVERS = {
    attributes: () => store.saveAttributeEdits(attrs({ Dexterity: { base: 10, points: 1, increases: 0 } }), 'adept'),
    creation: () => store.saveCreationEdits(creation(), 'adept'),
    spells: () => saveSpellEdits({ known: [{ name: 'Astral Spear', learntSuccess: 0 }], matrices: [] }, 'adept'),
  };

  for (const [category, save] of Object.entries(SAVERS)) {
    test(`a ${category} edit marks the character dirty and a confirmed save (reconcileOverlay) clears it`, () => {
      memory.clear();
      assert.equal(hasPendingEdits('adept'), false);
      save();
      assert.equal(hasPendingEdits('adept'), true, `${category} is a saved category`);
      reconcileOverlay(undefined, 'adept');
      assert.equal(hasPendingEdits('adept'), false);
      assert.equal(localStorage.getItem(KEY('adept')), null, 'an empty overlay removes the key');
    });
  }

  test('reconcile clears every saved category together, including the new ones', () => {
    memory.clear();
    for (const save of Object.values(SAVERS)) save();
    saveMetaEdits({ name: 'X' }, 'adept');
    saveAdvancementEdits({ disciplines: base().disciplines, skills: [] }, 'adept');
    assert.equal(hasPendingEdits('adept'), true);
    reconcileOverlay(undefined, 'adept');
    assert.equal(hasPendingEdits('adept'), false);
    assert.equal(localStorage.getItem(KEY('adept')), null);
  });

  test('reconcile leaves another character overlay alone', () => {
    memory.clear();
    store.saveCreationEdits(creation(), 'a');
    store.saveCreationEdits(creation(), 'b');
    reconcileOverlay(undefined, 'a');
    assert.equal(hasPendingEdits('a'), false);
    assert.equal(hasPendingEdits('b'), true);
  });
});

describe('REGRESSION (existing caster): a spells edit now shows as unsaved and is cleared on save', () => {
  const chakkaLike = () => ({
    schema: 'ed-character/2',
    meta: { id: 'chakka', name: 'Chakka', race: 'Ork' },
    attributes: attrs(),
    disciplines: [{ name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank: 4, circle: 1 }] }],
    skills: [],
    knacks: [],
    resources: { karma: { converted: 15, spent: 0 }, legend: { totalEarnt: 1000 } },
    items: [],
    spells: {
      known: [{ name: 'Astral Spear', learntSuccess: 1 }],
      matrices: [{ type: 'Standard', spell: 'Astral Spear' }, { type: 'Standard', spell: null }],
    },
  });
  const edited = { known: [{ name: 'Astral Spear', learntSuccess: 2 }, { name: 'Shadow Meld', learntSuccess: 0 }], matrices: [{ type: 'Standard', spell: 'Shadow Meld' }, { type: 'Standard', spell: null }] };

  test('before the fix hasPendingEdits ignored spells; now a spells edit is pending', () => {
    memory.clear();
    saveSpellEdits(edited, 'chakka');
    assert.equal(hasPendingEdits('chakka'), true);
  });

  test('the overlay still merges onto the loaded character (existing behaviour) and reconcile removes it', () => {
    memory.clear();
    saveSpellEdits(edited, 'chakka');
    assert.deepEqual(applyEdits(chakkaLike(), overlay('chakka')).spells, edited);
    reconcileOverlay(undefined, 'chakka');
    assert.equal(hasPendingEdits('chakka'), false);
    assert.equal(localStorage.getItem(KEY('chakka')), null, 'the stale spells overlay would otherwise mask the branch file forever');
    assert.deepEqual(applyEdits(chakkaLike(), overlay('chakka') ?? undefined).spells, chakkaLike().spells);
  });
});
