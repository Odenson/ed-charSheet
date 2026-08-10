// store-notes.test.js — run with `npm test` (node --test, no deps).
// Covers the Notes-tab slice (PLAN-NOTES-TAB): the notes / history / legend
// edits-overlay categories and their applyEdits merge, the SAVED_CATEGORIES
// reconcile round-trip, and the deriveModel Legend-earned display list — the
// legacy `totalEarnt` surfacing as a virtual "Starting total" row that feeds a
// pure-sum derived `totalEarnt`, real entries adding on top, and the derived
// total (not any stored number) pricing the rank-guard. Nothing recomputable is
// ever written to the overlay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel, saveNotesEdits, saveHistoryEdits, saveLegendEdits, hasPendingEdits, reconcileOverlay, applyEdits } from './store.js';

// Node has no localStorage; the store reads/writes the global. A tiny in-memory
// stub is enough — the store only uses get/set/removeItem.
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

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const rules = {
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
};

const baseCharacter = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Chakka' },
  attributes: {},
  resources: { legend: { totalEarnt: 10000 } },
  disciplines: [
    {
      name: 'Archer',
      circle: 4,
      talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }],
    },
  ],
  skills: [{ name: 'Tracking', rank: 3, tier: 'Novice' }],
  knacks: [],
  items: [],
});

// --- notes / history / legend overlay round-trip ------------------------------

test('notes/history/legend edits round-trip and applyEdits overlays them', () => {
  memory.clear();
  const notes = [{ id: 'n1', text: 'The old Innkeeper knows more than he lets on.' }];
  const history = [{ id: 'h1', date: '2026-08-01', text: 'Recovered the Crown of Tears.' }];
  const earned = [{ id: 'e1', amount: 2500, description: 'Recovered the Crown of Tears', date: null }];
  const edits = { ...saveNotesEdits(notes, 'c1'), ...saveHistoryEdits(history, 'c1'), ...saveLegendEdits(earned, 'c1') };
  const character = baseCharacter();
  const next = applyEdits(character, edits);
  assert.deepEqual(next.notes, notes);
  assert.deepEqual(next.history, history);
  // Legend merges INTO resources.legend — the legacy `totalEarnt` input survives.
  assert.equal(next.resources.legend.totalEarnt, 10000);
  assert.deepEqual(next.resources.legend.earned, earned);
  assert.notEqual(next, character); // overlay builds a fresh character
});

test('applyEdits notes/history/legend leave the other stored inputs untouched', () => {
  memory.clear();
  const edits = { ...saveNotesEdits([{ id: 'n1', text: 'x' }], 'c2'), ...saveLegendEdits([{ id: 'e1', amount: 1, description: 'd' }], 'c2') };
  const character = {
    ...baseCharacter(),
    meta: { name: 'Rook', race: 'Dwarf' },
    items: [{ name: 'Bracers of Aras', equipped: true }],
    resources: { legend: { totalEarnt: 10000 }, health: { damage: 3, wounds: 0, recoveriesUsed: 0 } },
  };
  const next = applyEdits(character, edits);
  assert.equal(next.meta.name, 'Rook'); // untouched
  assert.equal(next.items.length, 1); // untouched
  assert.deepEqual(next.resources.health, { damage: 3, wounds: 0, recoveriesUsed: 0 }); // untouched
  assert.equal(next.disciplines[0].talents[0].rank, 5); // untouched
});

test('notes/history/legend are SAVED_CATEGORIES: pending → reconcile clears', () => {
  memory.clear();
  assert.equal(hasPendingEdits('c3'), false);
  saveNotesEdits([], 'c3');
  assert.equal(hasPendingEdits('c3'), true);
  reconcileOverlay(undefined, 'c3');
  assert.equal(hasPendingEdits('c3'), false);
  assert.equal(memory.size, 0); // reconcile removes the overlay key entirely
});

test('saveLegendEdits never writes totalEarnt — earned only', () => {
  memory.clear();
  const edits = saveLegendEdits([{ id: 'e1', amount: 500, description: 'Quest', date: null }], 'c4');
  assert.deepEqual(edits.legend, { earned: [{ id: 'e1', amount: 500, description: 'Quest', date: null }] });
  const raw = JSON.parse(memory.get([...memory.keys()][0]));
  assert.equal(raw.legend.totalEarnt, undefined); // never a derived value in the overlay
});

// --- deriveModel: the Legend-earned display list ------------------------------

test('deriveModel: legacy totalEarnt becomes a virtual seed feeding the pure-sum total', () => {
  memory.clear();
  const char = baseCharacter();
  char.resources.legend.earned = [
    { id: 'e1', amount: 500, description: 'Crown of Tears', date: null },
    { id: 'e2', amount: 150, description: 'Patron gift', date: '2026-08-02' },
  ];
  const model = deriveModel(char, rules);
  // Display list: virtual "Starting total" first, then the real entries in order.
  assert.deepEqual(model.legendEarned[0], { id: '__starting_total__', amount: 10000, description: 'Starting total', date: null, virtual: true });
  assert.equal(model.legendEarned[0].virtual, true); // UI renders it read-only / non-deletable
  assert.deepEqual(model.legendEarned[1], { id: 'e1', amount: 500, description: 'Crown of Tears', date: null });
  // The derived total is the PURE SUM of the display list — a single path.
  assert.equal(model.legend.totalEarnt, 10650);
  assert.equal(model.legend.available, 10650 - 2900); // 10000-(1900+1000) → 10650-2900
});

test('deriveModel: the real entries (sans virtual) are exactly the edit payload', () => {
  memory.clear();
  const char = baseCharacter();
  char.resources.legend.earned = [{ id: 'e1', amount: 500, description: 'Crown of Tears', date: null }];
  const model = deriveModel(char, rules);
  const payload = model.legendEarned.filter((e) => !e.virtual);
  assert.deepEqual(payload, [{ id: 'e1', amount: 500, description: 'Crown of Tears', date: null }]);
});

test('deriveModel: no legacy totalEarnt and no entries ⇒ null, never a fabricated 0', () => {
  memory.clear();
  const char = baseCharacter();
  char.resources.legend = { totalSpent: 0 }; // no totalEarnt, no earned
  const model = deriveModel(char, rules);
  assert.equal(model.legendEarned.length, 0);
  assert.equal(model.legend, null);
});

test('deriveModel: earned alone (no legacy) derives from the real entries', () => {
  memory.clear();
  const char = baseCharacter();
  delete char.resources.legend.totalEarnt;
  char.resources.legend.earned = [{ id: 'e1', amount: 1200, description: 'Only earned', date: null }];
  const model = deriveModel(char, rules);
  assert.equal(model.legendEarned.length, 1); // no virtual row without a legacy value
  assert.equal(model.legend.totalEarnt, 1200);
});

test('deriveModel: rank-guard affordability prices from the DERIVED total, not a stored number', () => {
  memory.clear();
  // Legacy branch totalEarnt 10000; +500 earned ⇒ derived total 10500, available 7600.
  const char = baseCharacter();
  char.resources.legend.earned = [{ id: 'e1', amount: 500, description: 'Crown of Tears', date: null }];
  const model = deriveModel(char, rules);
  const t = model.disciplines[0].talents[0];
  assert.equal(model.legend.totalEarnt, 10500); // derived
  assert.equal(t.pricing.increaseCost, 1300); // Missile Weapon R5→R6
  assert.equal(t.pricing.affordable, true); // 1300 ≤ 7600, judged against the derived total
  // And an earned entry that exceeds affordability flips it: +20000 ⇒ available −12000.
  const over = deriveModel({ ...char, resources: { legend: { ...char.resources.legend, earned: [{ id: 'e1', amount: 20000, description: 'Windfall', date: null }] } } }, rules);
  assert.equal(over.legend.available, 30000 - 2900);
  assert.equal(over.disciplines[0].talents[0].pricing.affordable, true); // 1300 ≤ 27100 — still fits
});
