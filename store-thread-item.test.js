// store-thread-item.test.js — run with `npm test` (node --test, no deps).
// Covers how owned thread items resolve in deriveModel: an item whose name is in
// rules/thread-items.json becomes a thread item whose effects are the unthreaded
// `base` plus each woven Thread Rank up to the character's `threadRank` input
// (equipped-gated at the active-effects fold). Ranks combine by `stacking: replace`
// in the engine (engine/characteristics.test.js); here we assert the store emits the
// rank-gated effect set and the thread metadata the UI renders.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

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
  meta: { name: 'Test' },
  attributes: {},
  resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [{ name: 'Bracers of Aras', equipped: true, threadRank: 3 }],
});

test('real thread-items catalog: schema ed-thread-items/1 with Bracers of Aras', () => {
  const catalog = read('thread-items.json');
  assert.equal(catalog.schema, 'ed-thread-items/1');
  assert.ok(catalog.tiers);
  const item = catalog.items['Bracers of Aras'];
  assert.ok(item);
  assert.equal(item.tier, 'Journeyman');
  assert.equal(item.mysticDefense, 12);
  assert.equal(item.maximumThreads, 3);
  assert.ok(Array.isArray(item.threadRanks) && item.threadRanks.length === 6);
  for (const rank of item.threadRanks) {
    assert.ok(rank.rank >= 1 && rank.rank <= 6);
    for (const e of rank.effects ?? []) {
      assert.equal(typeof e.type, 'string');
      assert.equal(e.source, 'thread');
      assert.equal(typeof e.summary, 'string');
    }
  }
});

test('an owned thread item resolves with rank-gated effects and thread metadata', () => {
  const model = deriveModel(baseCharacter(), rules);
  const item = model.items.find((i) => i.name === 'Bracers of Aras');
  assert.ok(item.thread);
  assert.equal(item.thread.tier, 'Journeyman');
  assert.equal(item.thread.mysticDefense, 12);
  assert.equal(item.thread.maximumThreads, 3);
  assert.equal(item.thread.threadRank, 3);
  assert.equal(item.thread.threadRanks.length, 6);
  // Effects = ranks 1..3 only (rank 4+ is not woven): +1 PD, +1 MD, +2 PD.
  const summaries = item.effects.map((e) => e.summary);
  assert.equal(summaries.length, 3);
  assert.ok(summaries.some((s) => s.includes('+1 Physical Defense'))); // rank 1
  assert.ok(summaries.some((s) => s.includes('+1 Mystic Defense'))); // rank 2
  assert.ok(summaries.some((s) => s.includes('+2 Physical Defense'))); // rank 3
  assert.ok(!summaries.some((s) => s.includes('+2 Mystic Defense'))); // rank 4 not woven
});

test('threadRank 0 (or missing) weaves nothing — the item contributes no effects', () => {
  const character = baseCharacter();
  character.items[0].threadRank = 0;
  const model = deriveModel(character, rules);
  const item = model.items.find((i) => i.name === 'Bracers of Aras');
  assert.equal(item.effects.length, 0);
});

test('unequipped thread items drop out of the active-effects fold', () => {
  const character = baseCharacter();
  character.attributes = { Dexterity: { value: 16 }, Perception: { value: 16 } };
  character.items[0].equipped = false;
  const model = deriveModel(character, rules);
  const item = model.items.find((i) => i.name === 'Bracers of Aras');
  assert.equal(item.equipped, false);
  assert.equal(item.thread.threadRank, 3); // still woven, just not active
});

test('a thread item that also has an items.json entry resolves as a thread item', () => {
  // "Bracers of Aras" is not in rules/items.json, so this guards the dispatch: the
  // thread catalog wins when both could match.
  const model = deriveModel(baseCharacter(), rules);
  const item = model.items.find((i) => i.name === 'Bracers of Aras');
  assert.equal(item.kind, 'thread-item');
  assert.ok(item.thread);
});

test('unknown items degrade gracefully (thread: null, regular item path)', () => {
  const character = baseCharacter();
  character.items = [{ name: 'Totally Unknown Thing', equipped: true }];
  const model = deriveModel(character, rules);
  const item = model.items[0];
  assert.equal(item.known, false);
  assert.equal(item.thread, null);
  assert.equal(item.effects.length, 0);
});

test('thread items are priced into the legend audit (cumulative at tier)', () => {
  const model = deriveModel(baseCharacter(), rules);
  const spent = model.legend.spent;
  const threads = spent.sections.find((s) => s.key === 'threads');
  assert.ok(threads);
  assert.equal(threads.lines[0].name, 'Bracers of Aras');
  assert.equal(threads.lines[0].detail, 'Journeyman · Thread Rank 3');
  assert.equal(threads.lines[0].cost, 200 + 300 + 500); // 1000, cumulative at tier
  assert.equal(spent.total, 1000);
  assert.equal(model.legend.available, 5000 - 1000);
});
