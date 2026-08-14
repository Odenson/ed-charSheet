// ui/item-equip-state.test.js — run with `npm test` (node --test, no deps).
// Pins the single-worn-armour rule behind the Equipment tab's equip actions:
// equipping a second armour blocks until the caller confirms the swap, and the
// confirmed swap stores every other armour. No DOM, no Lit — the component
// (ui/ed-equipment.js) delegates to these pure functions, so the decisions are
// testable here directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equipArmour, applyArmourSwap, unequipSpentCharms } from './item-equip-state.js';

// kindOf mirrors how the UI resolves an item's kind (model items + catalog,
// canon and player-created custom armour alike).
const kindOf = (kinds) => (name) => kinds[name] ?? null;

const items = () => [
  { name: 'Spear', equipped: false },
  { name: 'Hardened Leather', equipped: true },
  { name: 'Buckler', equipped: true },   // a shield — never competes for the worn slot
  { name: 'Backpack', equipped: true },  // gear — never competes
];

test('equipping a non-armour never blocks (gear, shield, weapon)', () => {
  const kinds = { Spear: 'weapon', Buckler: 'shield', Backpack: 'gear', 'Hardened Leather': 'armor' };
  for (const [name] of [['Spear'], ['Buckler'], ['Backpack']]) {
    const start = items().filter((i) => i.name === name);
    const before = start[0].equipped;
    const r = equipArmour(start, kindOf(kinds), name, 'toggle');
    assert.equal(r.blocked, false, `${name} must never block`);
    assert.equal(r.items.find((i) => i.name === name).equipped, !before, 'the toggle flipped it');
  }
});

test('equipping the first armour is free (no swap needed)', () => {
  const kinds = { Spear: 'weapon', 'Hardened Leather': 'armor' };
  const start = [
    { name: 'Spear', equipped: true },
    { name: 'Hardened Leather', equipped: false },
  ];
  const r = equipArmour(start, kindOf(kinds), 'Hardened Leather', 'toggle');
  assert.equal(r.blocked, false);
  assert.deepEqual(r.items, [
    { name: 'Spear', equipped: true },
    { name: 'Hardened Leather', equipped: true },
  ]);
});

test('equipping a second armour via toggle blocks until the caller swaps', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor' };
  const start = [
    { name: 'Hardened Leather', equipped: true },
    { name: 'Hide Armor', equipped: false },
  ];
  const r = equipArmour(start, kindOf(kinds), 'Hide Armor', 'toggle');
  assert.equal(r.blocked, true, 'a second worn armour must be a conscious swap');
});

test('adding a second armour via the picker blocks too', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor' };
  const start = [{ name: 'Hardened Leather', equipped: true }];
  const r = equipArmour(start, kindOf(kinds), 'Hide Armor', 'add');
  assert.equal(r.blocked, true);
});

test('storing the worn armour is free (only equipping a second one blocks)', () => {
  const kinds = { 'Hardened Leather': 'armor' };
  const start = [{ name: 'Hardened Leather', equipped: true }];
  const r = equipArmour(start, kindOf(kinds), 'Hardened Leather', 'toggle');
  assert.equal(r.blocked, false);
  assert.equal(r.items.find((i) => i.name === 'Hardened Leather').equipped, false, 'now stored');
});

test('confirmed add-swap stores every other armour and keeps their fields', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor', Backpack: 'gear' };
  const start = [
    { name: 'Backpack', equipped: true },
    { name: 'Hardened Leather', equipped: true },
    { name: 'Bracers of Aras', equipped: true, threadRank: 2 }, // a non-armour keeps threadRank
  ];
  const next = applyArmourSwap(start, kindOf(kinds), 'Hide Armor', 'add');
  assert.equal(next.find((i) => i.name === 'Hide Armor').equipped, true, 'the new armour is worn');
  assert.equal(next.find((i) => i.name === 'Hardened Leather').equipped, false, 'the old armour is stored');
  assert.equal(next.find((i) => i.name === 'Backpack').equipped, true, 'gear is untouched');
  assert.equal(next.find((i) => i.name === 'Bracers of Aras').threadRank, 2, 'non-armour inputs survive');
});

test('confirmed toggle-swap equips the target and stores the previous armour', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor' };
  const start = [
    { name: 'Hardened Leather', equipped: true },
    { name: 'Hide Armor', equipped: false },
  ];
  const next = applyArmourSwap(start, kindOf(kinds), 'Hide Armor', 'toggle');
  assert.deepEqual(
    next.map((i) => [i.name, i.equipped]),
    [
      ['Hardened Leather', false],
      ['Hide Armor', true],
    ],
  );
});

test('custom armour (player-created) competes for the worn slot like canon armour', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Mug Armour': 'armor' };
  const start = [{ name: 'Hardened Leather', equipped: true }];
  const r = equipArmour(start, kindOf(kinds), 'Mug Armour', 'toggle');
  assert.equal(r.blocked, true, 'a custom armour still counts');
});

test('inputs are never mutated', () => {
  const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor' };
  const start = [{ name: 'Hardened Leather', equipped: true }];
  equipArmour(start, kindOf(kinds), 'Hide Armor', 'add');
  applyArmourSwap(start, kindOf(kinds), 'Hide Armor', 'add');
  unequipSpentCharms(start, ['Hardened Leather']);
  assert.deepEqual(start, [{ name: 'Hardened Leather', equipped: true }]);
});

// --- unequipSpentCharms (Combat tab blood-charm spend on the new-round
//     Initiative roll) ---

test('unequipSpentCharms stores the armed charms, keeps everything else equipped', () => {
  const items = [
    { name: 'Desperate Blow', equipped: true },
    { name: 'Horn Needle', equipped: true },
    { name: 'Ork Dagger', equipped: true },
    { name: 'Broadsword', equipped: false },
  ];
  assert.deepEqual(unequipSpentCharms(items, ['Desperate Blow', 'Horn Needle']), [
    { name: 'Desperate Blow', equipped: false },
    { name: 'Horn Needle', equipped: false },
    { name: 'Ork Dagger', equipped: true },
    { name: 'Broadsword', equipped: false },
  ]);
});

test('unequipSpentCharms returns the stored input shape (derived fields dropped, threadRank kept)', () => {
  const items = [
    { name: 'Desperate Blow', equipped: true, ref: { cost: 275 } },
    { name: 'Bracers of Aras', equipped: true, thread: { threadRank: 2 }, ref: {} },
  ];
  assert.deepEqual(unequipSpentCharms(items, ['Desperate Blow']), [
    { name: 'Desperate Blow', equipped: false },
    { name: 'Bracers of Aras', equipped: true, threadRank: 2 },
  ]);
});

test('unequipSpentCharms with nothing armed changes nothing (no-op input list)', () => {
  const items = [{ name: 'Desperate Blow', equipped: true }];
  assert.deepEqual(unequipSpentCharms(items, []), [{ name: 'Desperate Blow', equipped: true }]);
  assert.deepEqual(unequipSpentCharms(items, undefined), [{ name: 'Desperate Blow', equipped: true }]);
});

test('unequipSpentCharms never removes an item, only stores it', () => {
  const items = [{ name: 'Desperate Blow', equipped: true }, { name: 'Dagger', equipped: true }];
  const next = unequipSpentCharms(items, ['Desperate Blow']);
  assert.deepEqual(next.map((i) => i.name), ['Desperate Blow', 'Dagger']);
});

// --- bumpQuantity (potion/item quantity, plans/PLAN-POTIONS.md) ---------------

import { bumpQuantity } from './item-equip-state.js';

test('bumpQuantity: increments the named entry, defaulting a missing qty to 1', () => {
  const items = [{ name: 'Booster Potion', equipped: true }, { name: 'Dagger', equipped: true }];
  assert.deepEqual(bumpQuantity(items, 'Booster Potion', 1), [
    { name: 'Booster Potion', equipped: true, qty: 2 },
    { name: 'Dagger', equipped: true },
  ]);
});

test('bumpQuantity: decrements, and removes the entry when the last dose is spent', () => {
  const items = [{ name: 'Healing Potion', equipped: true, qty: 2 }, { name: 'Dagger', equipped: true }];
  assert.deepEqual(bumpQuantity(items, 'Healing Potion', -1), [
    { name: 'Healing Potion', equipped: true, qty: 1 },
    { name: 'Dagger', equipped: true },
  ]);
  const last = [{ name: 'Healing Potion', equipped: true, qty: 1 }, { name: 'Dagger', equipped: true }];
  assert.deepEqual(bumpQuantity(last, 'Healing Potion', -1), [{ name: 'Dagger', equipped: true }]);
});

test('bumpQuantity: a thread-item name is a no-op (unique, no quantity)', () => {
  const items = [{ name: 'Bracers of Aras', equipped: true, threadRank: 2 }];
  const isThread = (n) => n === 'Bracers of Aras';
  assert.deepEqual(bumpQuantity(items, 'Bracers of Aras', 1, isThread), items);
});

test('bumpQuantity: never mutates the input list', () => {
  const items = [{ name: 'Booster Potion', equipped: true, qty: 1 }];
  const snapshot = JSON.parse(JSON.stringify(items));
  bumpQuantity(items, 'Booster Potion', 1);
  assert.deepEqual(items, snapshot);
});

test('unequipSpentCharms forwards a stack quantity (>1) untouched', () => {
  const items = [
    { name: 'Booster Potion', equipped: true, qty: 3 },
    { name: 'Desperate Blow', equipped: true },
  ];
  assert.deepEqual(unequipSpentCharms(items, ['Desperate Blow']), [
    { name: 'Booster Potion', equipped: true, qty: 3 },
    { name: 'Desperate Blow', equipped: false },
  ]);
});
