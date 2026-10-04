// store-nights-edge.test.js — run with `npm test` (node --test, no deps).
// spell-nights-edge I1/I6: equippedWeapons carries the thread block's
// mysticDefense (R6 data-down), a string-valued dice effect never yields NaN in
// the derived model, and the wasted-cast / bonus-die log entries round-trip
// through the device-local Roll Log. Red-first: fails until built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Node has no localStorage; the roll-log store reads the global.
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};

const { deriveModel } = await import('./store.js');
const { loadRollLog, saveRollLog, clearRollLog } = await import('./store-rolllog.js');
const { buildActiveSpell, wastedCastLogEntry } = await import('./engine/spells.js');

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
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: read('combat.json'),
  spellsFile: read('spells.json'),
};

const character = () => ({
  meta: { name: 'Tester', race: 'Ork' },
  attributes: {
    Dexterity: { base: 20 }, Strength: { base: 14 }, Toughness: { base: 10 },
    Perception: { base: 14 }, Willpower: { base: 12 }, Charisma: { base: 8 },
  },
  disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'Missile Weapon', rank: 5 }, { name: 'Durability', rank: 1 }] }],
  items: [
    { name: 'Orc Stinger', equipped: true, threadRank: 3 },
    { name: 'Ork Dagger', equipped: true },
  ],
  resources: { health: { damage: 0, wounds: 0 }, karma: { available: 3 } },
  skills: [], knacks: [], traits: [], wealth: {}, notes: [], history: [],
});

test('equippedWeapons: a thread weapon carries its mysticDefense (10); a plain weapon carries null (R6)', () => {
  const m = deriveModel(character(), rules);
  const stinger = m.combat.equippedWeapons.find((w) => w.name === 'Orc Stinger');
  const dagger = m.combat.equippedWeapons.find((w) => w.name === 'Ork Dagger');
  assert.equal(stinger.mysticDefense, 10);
  assert.equal(dagger.mysticDefense, null);
});

// Every number reachable from a value must be finite.
function nonFinite(node, trail = '', out = []) {
  if (typeof node === 'number') { if (!Number.isFinite(node)) out.push(trail); return out; }
  if (Array.isArray(node)) { node.forEach((v, i) => nonFinite(v, `${trail}[${i}]`, out)); return out; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) nonFinite(v, `${trail}.${k}`, out);
  return out;
}

test('no-NaN: an active Night’s Edge (string "D4" dice effect) leaves every derived value finite and unchanged', () => {
  const active = buildActiveSpell(rules.spellsFile.spells['Night’s Edge'], 3, { extraPicks: ['Increase Effect (+2 Damage Step)'], object: { name: 'Orc Stinger', index: 0 } });
  const without = deriveModel(character(), rules, {});
  const withSpell = deriveModel(character(), rules, { activeSpells: [active] });
  assert.deepEqual(nonFinite(withSpell, 'model'), []);
  // The spell targets attack/Damage only: no generic rating folds.
  for (const k of ['physicalDefense', 'mysticDefense', 'socialDefense', 'physicalArmor', 'mysticArmor', 'initiative', 'knockdown']) {
    if (k in without) assert.deepEqual(withSpell[k], without[k], k);
  }
  const fx = (withSpell.activeEffects ?? []).filter((e) => e.origin?.kind === 'spell');
  assert.ok(fx.some((e) => e.measure === 'dice' && e.value === 'D4'), 'the dice effect is present in the active effects');
  assert.ok(!/NaN/.test(JSON.stringify(withSpell.activeEffects ?? [])));
});

test('roll log: the wasted-cast entry round-trips through saveRollLog', () => {
  clearRollLog('ne-test');
  const e = wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'wasted-1', at: 5 });
  saveRollLog(e, 'ne-test');
  const back = loadRollLog('ne-test').entries[0];
  assert.deepEqual(back, JSON.parse(JSON.stringify(e)));
  assert.equal(back.total, null);
  assert.equal(back.outcome.word, 'Wasted');
  // Two wasted casts are two rows (distinct rollIds), not an upsert.
  saveRollLog(wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'wasted-2', at: 6 }), 'ne-test');
  assert.equal(loadRollLog('ne-test').entries.length, 2);
});

test('roll log: an entry with a bonusResult group round-trips; old entries without it still load', () => {
  clearRollLog('ne-test2');
  const withBonus = { rollId: 'b1', label: 'Damage — Spear', step: 9, total: 20, dice: [], bonusResult: { dice: [{ sides: 4, rolls: [4, 2] }], total: 6 } };
  const old = { rollId: 'o1', label: 'Damage — Spear', step: 9, total: 14, dice: [] };
  saveRollLog(old, 'ne-test2');
  saveRollLog(withBonus, 'ne-test2');
  const { entries } = loadRollLog('ne-test2');
  assert.deepEqual(entries.find((x) => x.rollId === 'b1').bonusResult, withBonus.bonusResult);
  assert.ok(!('bonusResult' in entries.find((x) => x.rollId === 'o1')));
});
