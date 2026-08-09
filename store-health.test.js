// store-health.test.js — run with `npm test` (node --test, no deps).
// Covers the health slice of the edits overlay: saving Current Damage / Wounds /
// Recovery-tests-used to localStorage, the overlay merge back onto the character
// (applyEdits), and that deriveModel exposes the derived characteristics the
// Overview renders (woundThreshold + healthState) without storing them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel, saveHealthEdits, hasPendingEdits, reconcileOverlay, applyEdits } from './store.js';

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
  meta: { name: 'Test' },
  attributes: {},
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [],
  skills: [],
  knacks: [],
  items: [],
});

test('saveHealthEdits round-trips and applyEdits merges health into resources.health', () => {
  memory.clear();
  const edits = saveHealthEdits({ damage: 7, wounds: 1, recoveriesUsed: 2 }, 'c1');
  const character = baseCharacter();
  const next = applyEdits(character, edits);
  assert.deepEqual(next.resources.health, { damage: 7, wounds: 1, recoveriesUsed: 2 });
  assert.equal(character.resources.health.damage, 0); // original untouched
  assert.notEqual(next, character); // overlay builds a fresh character
});

test('applyEdits health overlay preserves the other stored inputs', () => {
  memory.clear();
  const edits = saveHealthEdits({ damage: 4 }, 'c1');
  const character = {
    ...baseCharacter(),
    meta: { name: 'Rook', race: 'Dwarf' },
    items: [{ name: 'Bracers of Aras', equipped: true }],
    resources: { legend: { totalEarnt: 100 }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  };
  const next = applyEdits(character, edits);
  assert.equal(next.resources.health.damage, 4);
  assert.equal(next.meta.name, 'Rook'); // untouched
  assert.equal(next.items.length, 1); // untouched
  assert.equal(next.resources.legend.totalEarnt, 100); // untouched
});

test('hasPendingEdits: false before, true after a health edit, false after reconcile', () => {
  memory.clear();
  assert.equal(hasPendingEdits('c2'), false);
  saveHealthEdits({ damage: 3 }, 'c2');
  assert.equal(hasPendingEdits('c2'), true);
  reconcileOverlay(undefined, 'c2');
  assert.equal(hasPendingEdits('c2'), false);
});

test('a later health save replaces the whole health object (stored as-is, not merged)', () => {
  memory.clear();
  saveHealthEdits({ damage: 5 }, 'c3');
  saveHealthEdits({ damage: 9 }, 'c3');
  const edits = saveHealthEdits({ damage: 2, wounds: 1, recoveriesUsed: 1 }, 'c3');
  assert.deepEqual(edits.health, { damage: 2, wounds: 1, recoveriesUsed: 1 });
});

test('deriveModel exposes woundThreshold and healthState from stored inputs only', () => {
  memory.clear();
  const character = {
    ...baseCharacter(),
    attributes: { Toughness: { base: 17 } },
    resources: { health: { damage: 4, wounds: 0, recoveriesUsed: 0 } },
  };
  const model = deriveModel(character, rules);
  // Derived ratings (Tou 17 -> wound 11, uncon 34, death 41) — never stored.
  assert.equal(model.characteristics.woundThreshold.value, 11);
  assert.equal(model.characteristics.unconsciousness.value, 34);
  assert.equal(model.characteristics.death.value, 41);
  assert.equal(model.characteristics.recoveries.value, 3);
  assert.equal(model.healthState.state, 'conscious');
  assert.equal(model.healthState.damage, 4);
  assert.equal(model.healthState.toUnconscious, 30);
  assert.equal(model.healthState.toDeath, 37);
  // The stored inputs themselves are untouched — the sheet stores only inputs.
  assert.deepEqual(character.resources.health, { damage: 4, wounds: 0, recoveriesUsed: 0 });
});

test('deriveModel: an equipped blood charm folds its implant damage into the health ratings', () => {
  memory.clear();
  const base = {
    ...baseCharacter(),
    attributes: { Toughness: { base: 17 } },
    resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  };
  // Death Cheat's implant inflicts Blood Magic Damage: Unconsciousness −3, Death −3.
  // The effects are `condition: always` on the charm; the engine collects effects
  // from equipped items only, so the reduction applies exactly while it is worn.
  const worn = deriveModel({ ...base, items: [{ name: 'Death Cheat', equipped: true }] }, rules);
  assert.equal(worn.characteristics.unconsciousness.value, 31);
  assert.equal(worn.characteristics.death.value, 38);
  const modifier = worn.characteristics.unconsciousness.modifiers.find((m) => m.origin?.kind === 'item' && m.operation === 'subtract' && m.value === 3);
  assert.ok(modifier, 'the implant damage surfaces as a folded modifier');
  // Unequipped (stored) — the effect drops back out.
  const stored = deriveModel({ ...base, items: [{ name: 'Death Cheat', equipped: false }] }, rules);
  assert.equal(stored.characteristics.unconsciousness.value, 34);
  assert.equal(stored.characteristics.death.value, 41);
});

test('deriveModel exposes activeEffects: the always-on fold, no condition when not knocked down', () => {
  memory.clear();
  const character = {
    ...baseCharacter(),
    attributes: { Toughness: { base: 17 } },
    resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  };
  const model = deriveModel(character, rules);
  const names = model.activeEffects.map((e) => e.origin?.kind);
  assert.ok(Array.isArray(model.activeEffects));
  assert.ok(!names.includes('condition'), 'no condition effect when standing');
});

test('deriveModel: knockedDown:true folds the Knocked Down condition into activeEffects', () => {
  memory.clear();
  const character = {
    ...baseCharacter(),
    attributes: { Toughness: { base: 17 }, Strength: { base: 20 } },
    resources: { health: { damage: 12, wounds: 1, recoveriesUsed: 0, knockedDown: true } },
  };
  const model = deriveModel(character, rules);
  const cond = model.activeEffects.filter((e) => e.origin?.kind === 'condition');
  assert.equal(cond.length, 1);
  assert.equal(cond[0].type, 'test-modifier');
  assert.equal(cond[0].target.name, 'Action');
  assert.equal(cond[0].value, -3);
  assert.deepEqual(cond[0].origin, { kind: 'condition', name: 'Knocked Down' });
  // The static Knockdown Step is NOT penalized — the −3 is roll-time only
  // (measure: result), so the derived step stays at Strength Step 8.
  assert.equal(model.characteristics.knockdown.value, 8);
  // Cleared: the condition folds back out of the readout.
  const standing = deriveModel({ ...character, resources: { health: { ...character.resources.health, knockedDown: false } } }, rules);
  assert.ok(!standing.activeEffects.some((e) => e.origin?.kind === 'condition'));
});

test('deriveModel: knockedDown folds −3 into Physical and Mystic Defense (not Social), clears on stand-up', () => {
  memory.clear();
  const character = {
    ...baseCharacter(),
    attributes: { Dexterity: { base: 14 }, Perception: { base: 13 }, Charisma: { base: 12 } },
    resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0, knockedDown: true } },
  };
  const down = deriveModel(character, rules);
  const up = deriveModel({ ...character, resources: { health: { ...character.resources.health, knockedDown: false } } }, rules);
  assert.ok(up.characteristics.physicalDefense?.value != null, 'Physical Defense derived');
  assert.ok(up.characteristics.mysticDefense?.value != null, 'Mystic Defense derived');
  assert.ok(up.characteristics.socialDefense?.value != null, 'Social Defense derived');
  // Exactly the PG p.389 −3 to Physical and Mystic Defense while prone.
  assert.equal(up.characteristics.physicalDefense.value - down.characteristics.physicalDefense.value, 3);
  assert.equal(up.characteristics.mysticDefense.value - down.characteristics.mysticDefense.value, 3);
  // Social Defense is only ever hit at GM discretion — never folded.
  assert.equal(up.characteristics.socialDefense.value, down.characteristics.socialDefense.value);
  // The −3 shows up in the folded modifiers (source: condition) for the tooltip.
  assert.ok(down.characteristics.physicalDefense.modifiers.some((m) => m.origin?.kind === 'condition' && m.value === -3));
  assert.ok(down.characteristics.mysticDefense.modifiers.some((m) => m.origin?.kind === 'condition' && m.value === -3));
});
