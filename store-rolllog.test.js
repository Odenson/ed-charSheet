// store-rolllog.test.js — run with `npm test` (node --test, no deps).
// Covers the per-character roll log store (PLAN-NOTES-TAB, decisions #2/#5/#7):
// upsert-by-`rollId` (Karma toggles / "Roll again" replace the row, never
// duplicate), the "keep last N" cap and its valid options, per-character key
// isolation, corrupt-data degradation, Clear, and that the log is deliberately
// OUTSIDE the edits overlay — a roll never flags the Save button.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX, MAX_OPTIONS, loadRollLog, saveRollLog, setRollLogMax, clearRollLog } from './store-rolllog.js';
import { hasPendingEdits } from './store.js';

// Node has no localStorage; both stores read/write the global. A tiny in-memory
// stub is enough — they only use get/set/removeItem.
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

// A completed roll entry as ed-app builds it (ed-app.js:210-227): the raw dice
// result plus the display-only `karma`/`mods` sub-objects that explain a total
// which isn't the raw dice sum (decision #8) — the store must never re-add them.
const entry = (rollId, total) => ({
  rollId,
  at: '2026-08-10T00:00:00.000Z',
  label: 'Missile Weapon',
  step: 12,
  dice: '2D6+7',
  groups: 2,
  modifier: 7,
  total,
  difficulty: 9,
  outcome: 'success',
  karma: { step: 6, dice: '1D6', total: 4 },
  mods: [{ label: 'Knocked Down', value: -3 }],
});

test('saveRollLog upserts by rollId — a re-roll replaces the row, never duplicates', () => {
  memory.clear();
  const first = saveRollLog(entry('r1', 10), 'c1');
  assert.equal(first.entries.length, 1);
  assert.equal(first.entries[0].total, 10);
  // Same interaction lands again (Karma toggle): same rollId → same row, new total.
  const again = saveRollLog(entry('r1', 14), 'c1');
  assert.equal(again.entries.length, 1);
  assert.equal(again.entries[0].total, 14);
  // A fresh interaction appends a NEW row.
  const more = saveRollLog(entry('r2', 21), 'c1');
  assert.equal(more.entries.length, 2);
  assert.equal(more.entries[0].rollId, 'r2'); // newest first
});

test('saveRollLog trims to the kept max — and respects the persisted max option', () => {
  memory.clear();
  let log;
  for (let i = 0; i < DEFAULT_MAX + 5; i++) log = saveRollLog(entry(`r${i}`, i), 'c1');
  assert.equal(log.entries.length, DEFAULT_MAX); // 20 kept
  assert.equal(log.entries[0].rollId, `r${DEFAULT_MAX + 4}`); // newest first, oldest trimmed
});

test('setRollLogMax: a valid option changes the cap and trims; an invalid one falls back', () => {
  memory.clear();
  for (let i = 0; i < 25; i++) saveRollLog(entry(`r${i}`, i), 'c1');
  const small = setRollLogMax(10, 'c1');
  assert.equal(small.max, 10);
  assert.equal(small.entries.length, 10);
  const bad = setRollLogMax(7, 'c1'); // not in MAX_OPTIONS
  assert.equal(bad.max, DEFAULT_MAX);
});

test('MAX_OPTIONS offers the documented cap choices', () => {
  assert.deepEqual(MAX_OPTIONS, [10, 20, 50]);
});

test('roll log is per-character: ids never share a store', () => {
  memory.clear();
  saveRollLog(entry('r1', 10), 'chakka');
  saveRollLog(entry('r1', 10), 'rook');
  const a = loadRollLog('chakka');
  const b = loadRollLog('rook');
  assert.equal(a.entries.length, 1);
  assert.equal(b.entries.length, 1); // same rollId, different characters, both kept
  assert.notEqual([...memory.keys()].filter((k) => k.startsWith('ed-rolllog:')).length, 1);
});

test('clearRollLog empties the store and resets to defaults', () => {
  memory.clear();
  saveRollLog(entry('r1', 10), 'c1');
  setRollLogMax(50, 'c1');
  const cleared = clearRollLog('c1');
  assert.deepEqual(cleared, { max: DEFAULT_MAX, entries: [] });
  assert.deepEqual(loadRollLog('c1'), { max: DEFAULT_MAX, entries: [] });
  assert.equal(memory.size, 0); // the roll-log key is removed entirely
});

test('corrupt roll-log data degrades to defaults — a broken log never breaks a roll', () => {
  memory.clear();
  localStorage.setItem('ed-rolllog:c1', '{not json!!');
  assert.deepEqual(loadRollLog('c1'), { max: DEFAULT_MAX, entries: [] });
  // Wrong shapes too: a non-array `entries` and a bogus `max` both normalise.
  localStorage.setItem('ed-rolllog:c1', JSON.stringify({ max: 99, entries: 'oops' }));
  assert.deepEqual(loadRollLog('c1'), { max: DEFAULT_MAX, entries: [] });
  // And the store still records after the corruption (fail-open write).
  const log = saveRollLog(entry('r1', 10), 'c1');
  assert.equal(log.entries.length, 1);
});

test('entries carry display-only karma/mods — the store never re-adds them', () => {
  memory.clear();
  saveRollLog(entry('r1', 11), 'c1');
  const log = loadRollLog('c1');
  assert.deepEqual(log.entries[0].karma, { step: 6, dice: '1D6', total: 4 });
  assert.deepEqual(log.entries[0].mods, [{ label: 'Knocked Down', value: -3 }]);
  assert.equal(log.entries[0].total, 11); // stored as-is; render just shows it
});

test('a roll never flags the Save button — the log is outside SAVED_CATEGORIES', () => {
  memory.clear();
  assert.equal(hasPendingEdits('c1'), false);
  saveRollLog(entry('r1', 10), 'c1');
  assert.equal(hasPendingEdits('c1'), false); // no edits-overlay category was touched
  assert.equal([...memory.keys()].filter((k) => k.startsWith('ed-rolllog:')).length, 1);
});

test('saveRollLog guards a missing rollId and an undefined id', () => {
  memory.clear();
  const noId = saveRollLog({ label: 'no id' }, 'c1');
  assert.deepEqual(noId, { max: DEFAULT_MAX, entries: [] });
  assert.equal(loadRollLog('c1').entries.length, 0);
});

test('a non-roll action entry (kind: action, e.g. Stand up) round-trips as-is', () => {
  memory.clear();
  saveRollLog({ rollId: 'a1', at: '2026-08-12T00:00:00.000Z', kind: 'action', label: 'Stand up' }, 'c1');
  const log = loadRollLog('c1');
  assert.equal(log.entries.length, 1);
  assert.equal(log.entries[0].kind, 'action');
  assert.equal(log.entries[0].label, 'Stand up');
  assert.equal(log.entries[0].step, undefined); // no fabricated roll fields
  assert.equal(log.entries[0].total, undefined);
  // The upsert-by-rollId rule applies to action entries too.
  saveRollLog({ rollId: 'a1', at: '2026-08-12T00:00:01.000Z', kind: 'action', label: 'Stand up' }, 'c1');
  assert.equal(loadRollLog('c1').entries.length, 1);
});
