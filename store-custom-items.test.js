// store-custom-items.test.js — run with `npm test` (node --test, no deps).
// Covers the custom-item save + overlay plumbing (PLAN-CUSTOM-ITEMS P4):
//   • saveCustomItems — POSTs the { items, delete } delta to /save-items with the
//     x-save-key header, returns the commit, maps worker errors to typed SaveError;
//   • the ed-custom-items overlay — save/load/reconcile round-trip, corrupt
//     storage reads null, applyCustomEdits merge/custom-wins/delete;
//   • the store integration — a custom armor item flows through deriveModel, its
//     armor-modifier lands on the character, and custom wins over a canon collision.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import {
  saveCustomItems,
  loadCustomEdits,
  hasCustomPendingEdits,
  saveCustomEdits,
  reconcileCustomEdits,
  applyCustomEdits,
  applyCustomItemsMap,
  isItemsReflected,
  DEFAULT_ITEMS_ENDPOINT,
} from './store-custom-items.js';
import { SaveError } from './store-server.js';

// --- hermetic localStorage (isolated per test, no disk-backed webstorage) -----

function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return () => {
    delete globalThis.localStorage;
  };
}

// --- saveCustomItems (mocked worker) ------------------------------------------

const ITEM = { kind: 'gear', effects: [{ type: 'note', summary: 'A lantern.' }] };

function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const { status = 200, body = {} } = handler(calls.length, { url: String(url), options });
    return new Response(JSON.stringify(body), { status });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test('saveCustomItems POSTs { items, delete } to /save-items with the key and returns the commit', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'c1', url: 'https://github.com/commit/c1' } } }));
  try {
    const commit = await saveCustomItems({ 'My Lantern': ITEM }, { saveKey: 'k', deleteNames: ['Old'] });
    assert.equal(commit.sha, 'c1');
    assert.equal(commit.url, 'https://github.com/commit/c1');
    const call = mock.calls[0];
    assert.equal(call.url, DEFAULT_ITEMS_ENDPOINT);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers['x-save-key'], 'k');
    assert.deepEqual(JSON.parse(call.options.body), { items: { 'My Lantern': ITEM }, delete: ['Old'] });
  } finally {
    mock.restore();
  }
});

test('saveCustomItems without a save key → SaveError no_key before any request', async () => {
  const mock = mockFetch(() => ({ status: 200, body: {} }));
  try {
    await assert.rejects(() => saveCustomItems({}), SaveError);
    await assert.rejects(() => saveCustomItems({}), (e) => e.code === 'no_key');
    assert.equal(mock.calls.length, 0, 'no request was made');
  } finally {
    mock.restore();
  }
});

test('saveCustomItems maps worker error codes to typed SaveError', async () => {
  const cases = [
    ['unauthorized', 'bad or missing save key', 401],
    ['invalid_items', 'items["x"]: kind: must be one of weapon, armor', 400],
    ['conflict', 'sha kept moving', 409],
    ['upstream', 'github 403', 502],
  ];
  for (const [code, message, status] of cases) {
    const mock = mockFetch(() => ({ status, body: { ok: false, error: { code, message } } }));
    try {
      await assert.rejects(() => saveCustomItems({}, { saveKey: 'k' }), (e) => e.code === code && e.message === message);
    } finally {
      mock.restore();
    }
  }
});

test('saveCustomItems unreachable worker → SaveError offline', async () => {
  const mock = mockFetch(() => {
    throw new TypeError('fetch failed');
  });
  try {
    await assert.rejects(() => saveCustomItems({}, { saveKey: 'k' }), (e) => e.code === 'offline');
  } finally {
    mock.restore();
  }
});

// --- ed-custom-items overlay ---------------------------------------------------

test('overlay round-trip: save → load → hasPending → reconcile clears', () => {
  const restore = installLocalStorage();
  try {
    assert.equal(loadCustomEdits(), null);
    assert.equal(hasCustomPendingEdits(), false);
    saveCustomEdits({ items: { 'My Lantern': ITEM }, delete: ['Old'] });
    assert.deepEqual(loadCustomEdits(), { items: { 'My Lantern': ITEM }, delete: ['Old'] });
    assert.equal(hasCustomPendingEdits(), true);
    reconcileCustomEdits();
    assert.equal(loadCustomEdits(), null);
  } finally {
    restore();
  }
});

test('overlay: a net-empty delta reads as not pending (add-then-remove leaves no dot)', () => {
  const restore = installLocalStorage();
  try {
    saveCustomEdits({ items: {}, delete: [] });
    assert.equal(hasCustomPendingEdits(), false);
    saveCustomEdits({ items: { A: ITEM }, delete: ['A'] });
    assert.equal(hasCustomPendingEdits(), true);
  } finally {
    restore();
  }
});

test('overlay: corrupt or wrong-shape storage reads as null (never blocks loading)', () => {
  const restore = installLocalStorage();
  try {
    localStorage.setItem('ed-custom-items', '{not json');
    assert.equal(loadCustomEdits(), null);
    localStorage.setItem('ed-custom-items', '"just a string"');
    assert.equal(loadCustomEdits(), null);
    localStorage.setItem('ed-custom-items', '[]');
    assert.equal(loadCustomEdits(), null);
    localStorage.setItem('ed-custom-items', JSON.stringify({ items: 'nope' }));
    assert.equal(loadCustomEdits(), null);
    localStorage.setItem('ed-custom-items', JSON.stringify({ delete: 'nope' }));
    assert.equal(loadCustomEdits(), null);
  } finally {
    restore();
  }
});

test('applyCustomEdits merges edits, custom wins, delete applies last', () => {
  const file = { schema: 'ed-items/2', items: { Keep: ITEM, Both: ITEM, Old: ITEM } };
  const edited = { ...ITEM, kind: 'magic-item' };
  const next = applyCustomEdits(file, { items: { New: ITEM, Both: edited }, delete: ['Old', 'Both'] });
  assert.deepEqual(Object.keys(next.items).sort(), ['Keep', 'New']);
  assert.deepEqual(next.items.Both, undefined, 'a name in items AND delete is removed (last-write-wins)');
  assert.deepEqual(next.items.New, ITEM);
  assert.deepEqual(file.items.Old, ITEM, 'input file is never mutated');
});

test('applyCustomEdits with no delta returns the file unchanged', () => {
  const file = { schema: 'ed-items/2', items: {} };
  assert.equal(applyCustomEdits(file, null), file);
});

test('applyCustomItemsMap keeps every committed item unless the overlay deletes it (modal seed baseline, D8)', () => {
  const map = { Old: ITEM };
  assert.deepEqual(applyCustomItemsMap(map, null), map, 'no overlay keeps the committed map as-is');
  const next = applyCustomItemsMap(map, { items: { New: ITEM }, delete: [] });
  assert.deepEqual(Object.keys(next), ['Old', 'New'], 'creating a new item keeps the existing one');
  assert.deepEqual(applyCustomItemsMap(map, { items: {}, delete: ['Old'] }), {}, 'only an explicit overlay delete removes an item');
  assert.deepEqual(map, { Old: ITEM }, 'input map is never mutated');
});

test('applyCustomItemsMap lets the overlay win over a committed item of the same name (edit-form freshest-copy seed)', () => {
  // A save whose branch re-read lags the PUT leaves the edited item pending in
  // the overlay; reopening the modal must seed the *edited* copy, not the stale
  // committed one — this is the copy the edit form opens with (§6.6 edit fix).
  const map = { 'Boar Hide': { kind: 'armor', effects: [{ type: 'note', summary: 'Old copy.' }] } };
  const edited = { kind: 'armor', ref: { cost: 55 }, effects: [{ type: 'note', summary: 'Fresh copy.' }] };
  const next = applyCustomItemsMap(map, { items: { 'Boar Hide': edited }, delete: [] });
  assert.deepEqual(next['Boar Hide'], edited, 'the overlay edit replaces the committed item');
  assert.equal(Object.keys(next).length, 1, 'same name means upsert, not a second row');
  assert.deepEqual(map['Boar Hide'], { kind: 'armor', effects: [{ type: 'note', summary: 'Old copy.' }] }, 'input map is never mutated');
});

test('isItemsReflected: an equal re-read confirms the save and authorises reconciling the overlay', () => {
  const saved = { 'Beer Mug': { kind: 'magic-item', effects: [] } };
  assert.equal(isItemsReflected(saved, [], saved), true, 'read matches the saved item');
  assert.equal(isItemsReflected(null, null, saved), true, 'nothing saved/deleted is trivially reflected');
  assert.equal(isItemsReflected(null, ['Old'], {}), true, 'a delete reflects once the name is gone');
});

test('isItemsReflected: a lagged read (same name, old content) is NOT reflected — the overlay must keep the fresh edit', () => {
  // THE regression (PLAN-CUSTOM-ITEMS §6.6): a git-consistent read that lags the
  // PUT returns the previous commit's file — the item name exists but carries
  // the old content (e.g. effects added in the save are absent). The old
  // name-presence check passed and reconciled the overlay away, so the modal
  // re-seeded the stale item and the fresh effects vanished until a refresh.
  const saved = {
    'Beer Mug': {
      kind: 'magic-item',
      effects: [{ type: 'attack-modifier', operation: 'add', value: 1, measure: 'step', target: { domain: 'attack', name: 'Damage' }, condition: 'always', summary: 'Adds +1 Damage step', source: 'item' }],
    },
  };
  const staleRead = { 'Beer Mug': { kind: 'magic-item', effects: [] } };
  assert.equal(isItemsReflected(saved, [], staleRead), false, 'same name but old content → still pending, never reconciled away');
  assert.equal(isItemsReflected(saved, [], {}), false, 'item missing entirely → still pending');
  assert.equal(isItemsReflected(null, ['Old'], { Old: { kind: 'gear', effects: [] } }), false, 'delete not yet applied → still pending');
  assert.equal(isItemsReflected(saved, ['Old'], { ...saved, Old: { kind: 'gear', effects: [] } }), false, 'delete lagging on top of a confirmed item → still pending');
});

// --- store integration: custom item flows through deriveModel ------------------

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const baseRules = () => ({
  steps: read('steps.json').steps,
  talentsFile: read('talents.json'),
  disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'),
  characteristicsFile: read('characteristics.json'),
  itemsFile: read('items.json'),
  legendFile: read('legend.json'),
  skillsFile: read('skills.json'),
  knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'),
});

const CUSTOM_ARMOR = {
  kind: 'armor',
  ref: { cost: 40, weight: '25 lb', availability: 'scarce', description: 'Stitched from the hide of a mountain boar.' },
  effects: [
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 2, measure: 'rating', condition: 'always', summary: 'Physical Armor 2' },
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' }, operation: 'add', value: 1, measure: 'rating', condition: 'always', summary: 'Mystic Armor 1' },
  ],
};

test('a custom armor item resolves from the merged catalog and its armor-modifier lands on the character', () => {
  const rules = {
    ...baseRules(),
    customItemsFile: { schema: 'ed-items/2', effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)', source: 'custom', notes: '', items: { 'Boar Hide': CUSTOM_ARMOR } },
  };
  const character = {
    meta: { name: 'Test' },
    attributes: { Strength: { base: 15 }, Dexterity: { base: 15 }, Willpower: { base: 14 } },
    resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
    disciplines: [],
    skills: [],
    knacks: [],
    items: [{ name: 'Boar Hide', equipped: true }],
  };
  const model = deriveModel(character, rules);

  const item = model.items.find((i) => i.name === 'Boar Hide');
  assert.ok(item.known, 'custom item resolves against the merged catalog');
  assert.equal(item.kind, 'armor');
  assert.equal(model.characteristics.physicalArmor.value, 2, 'custom armor-modifier folds onto Physical Armor');
  assert.equal(model.characteristics.mysticArmor.value, 3, 'custom armor-modifier folds onto Mystic Armor (2 base from Willpower + 1)');
  assert.deepEqual(model.customCatalog, { 'Boar Hide': CUSTOM_ARMOR }, 'customCatalog exposes the editable set');
  assert.ok(model.activeEffects.some((e) => e.origin.kind === 'item' && e.origin.name === 'Boar Hide'), 'custom item origin tags the active effect');
});

test('customCommittedCatalog stays the branch truth while customCatalog carries the overlay', () => {
  const rules = {
    ...baseRules(),
    customItemsCommittedFile: { schema: 'ed-items/2', items: { 'Branch Only': CUSTOM_ARMOR } },
    customItemsFile: { schema: 'ed-items/2', items: { 'Branch Only': CUSTOM_ARMOR, 'Pending Draft': CUSTOM_ARMOR } },
  };
  const character = {
    meta: { name: 'Test' },
    attributes: { Strength: { base: 15 }, Dexterity: { base: 15 }, Willpower: { base: 14 } },
    resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
    disciplines: [],
    skills: [],
    knacks: [],
    items: [],
  };
  const model = deriveModel(character, rules);
  assert.deepEqual(model.customCommittedCatalog, { 'Branch Only': CUSTOM_ARMOR }, 'committed catalog is the pre-overlay branch read (modal delta baseline)');
  assert.deepEqual(model.customCatalog, { 'Branch Only': CUSTOM_ARMOR, 'Pending Draft': CUSTOM_ARMOR }, 'customCatalog includes pending overlay edits');
  assert.ok(Array.isArray(model.customCanonKeys) && model.customCanonKeys.length > 0, 'canon item names are exposed for the collision warning');
});

test('custom wins over a canon-name collision in the item catalog', () => {
  const rules = {
    ...baseRules(),
    customItemsFile: { schema: 'ed-items/2', items: { 'Padded Cloth': { ...CUSTOM_ARMOR } } },
  };
  const character = {
    meta: { name: 'Test' },
    attributes: { Strength: { base: 15 }, Dexterity: { base: 15 }, Willpower: { base: 14 } },
    resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
    disciplines: [],
    skills: [],
    knacks: [],
    items: [{ name: 'Padded Cloth', equipped: true }],
  };
  const model = deriveModel(character, rules);
  const item = model.items.find((i) => i.name === 'Padded Cloth');
  assert.equal(item.kind, 'armor');
  assert.equal(model.characteristics.physicalArmor.value, 2, 'the custom +2 Physical wins over canon +1');
});

test('unequipped custom items drop out of the active-effects fold', () => {
  const rules = {
    ...baseRules(),
    customItemsFile: { schema: 'ed-items/2', items: { 'Boar Hide': CUSTOM_ARMOR } },
  };
  const character = {
    meta: { name: 'Test' },
    attributes: { Strength: { base: 15 }, Dexterity: { base: 15 }, Willpower: { base: 14 } },
    resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
    disciplines: [],
    skills: [],
    knacks: [],
    items: [{ name: 'Boar Hide', equipped: false }],
  };
  const model = deriveModel(character, rules);
  assert.equal(model.characteristics.physicalArmor.value, 0, 'unequipped custom item contributes nothing');
  assert.ok(!model.activeEffects.some((e) => e.origin.kind === 'item' && e.origin.name === 'Boar Hide'));
});
