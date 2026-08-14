// engine/potions.test.js — run with `npm test` (node --test, no deps).
// Pins the pure consumable-potion helpers (plans/PLAN-POTIONS.md): the decrement
// reshape, the arm decision (step-boost vs emergency), and the armed bonus read.
// No DOM — ed-app owns the session state; these decide what a consume *does*.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consumePotion,
  recoveryStepBonus,
  immediateWoundHeal,
  armPotion,
  armedRecoveryBonus,
  boostHasNoEffect,
} from './potions.js';

// Catalog entries shaped like rules/items.json values.
const booster = {
  consumable: { use: { armNextRoll: true } },
  effects: [{ type: 'test-modifier', target: { name: 'Recovery' }, operation: 'add', value: 8, measure: 'step' }],
};
const healing = {
  consumable: { use: { armNextRoll: true, healWounds: 1, emergencyHeal: { step: 8 } } },
  effects: [{ type: 'test-modifier', target: { name: 'Recovery' }, operation: 'add', value: 8, measure: 'step' }],
};
const cureDisease = {
  consumable: { use: {} },
  effects: [{ type: 'test-modifier', target: { name: 'Action' }, operation: 'add', value: 5, measure: 'step' }],
};

test('consumePotion: decrements the named dose and removes the entry at 0', () => {
  const items = [{ name: 'Booster Potion', equipped: true, qty: 2 }, { name: 'Dagger', equipped: true }];
  assert.deepEqual(consumePotion({ items, name: 'Booster Potion' }), [
    { name: 'Booster Potion', equipped: true, qty: 1 },
    { name: 'Dagger', equipped: true },
  ]);
  const last = [{ name: 'Booster Potion', equipped: true, qty: 1 }];
  assert.deepEqual(consumePotion({ items: last, name: 'Booster Potion' }), []);
});

test('consumePotion: a missing qty defaults to 1 (single dose → removed)', () => {
  assert.deepEqual(consumePotion({ items: [{ name: 'Healing Potion', equipped: false }], name: 'Healing Potion' }), []);
});

test('recoveryStepBonus: reads the Recovery step value from the catalog, null when none', () => {
  assert.equal(recoveryStepBonus(booster), 8);
  assert.equal(recoveryStepBonus(healing), 8);
  // Cure Disease's step modifier targets Action, not Recovery.
  assert.equal(recoveryStepBonus(cureDisease), null);
  assert.equal(recoveryStepBonus({ effects: [] }), null);
});

test('immediateWoundHeal: Healing heals 1, others heal nothing', () => {
  assert.equal(immediateWoundHeal(healing), 1);
  assert.equal(immediateWoundHeal(booster), 0);
  assert.equal(immediateWoundHeal(cureDisease), 0);
});

test('armPotion: Booster arms a +8 step-boost', () => {
  const p = armPotion({ name: 'Booster Potion', entry: booster, recoveriesRemaining: 3 });
  assert.equal(p.kind, 'step-boost');
  assert.equal(p.value, 8);
});

test('armPotion: Healing at a confirmed 0 remaining arms the emergency heal', () => {
  const p = armPotion({ name: 'Healing Potion', entry: healing, recoveriesRemaining: 0 });
  assert.equal(p.kind, 'emergency-heal');
  assert.equal(p.step, 8);
});

test('armPotion: Healing at >=1 remaining arms the +8 step-boost, not the emergency', () => {
  const p = armPotion({ name: 'Healing Potion', entry: healing, recoveriesRemaining: 2 });
  assert.equal(p.kind, 'step-boost');
  assert.equal(p.value, 8);
});

test('armPotion: unknown/null remaining arms the step-boost (never the emergency)', () => {
  const p = armPotion({ name: 'Healing Potion', entry: healing, recoveriesRemaining: null });
  assert.equal(p.kind, 'step-boost');
});

test('armPotion: a consume-only aid (Cure Disease / Halt Illness) arms nothing', () => {
  assert.equal(armPotion({ name: 'Cure Disease Potion', entry: cureDisease, recoveriesRemaining: 3 }), null);
  assert.equal(armPotion({ name: 'X', entry: { consumable: { use: {} } }, recoveriesRemaining: 0 }), null);
  assert.equal(armPotion({ name: 'Plain', entry: {}, recoveriesRemaining: 3 }), null);
});

test('armPotion: a pure step-boost (Booster) at a confirmed 0 remaining arms NOTHING', () => {
  // No Recovery test to boost — arming would leave a useless pending pill.
  assert.equal(armPotion({ name: 'Booster Potion', entry: booster, recoveriesRemaining: 0 }), null);
});

test('boostHasNoEffect: only a pure step-boost at 0 remaining is a no-effect drink', () => {
  assert.equal(boostHasNoEffect(booster.consumable.use, 0), true); // Booster, none left
  assert.equal(boostHasNoEffect(booster.consumable.use, 2), false); // Booster with tests left
  assert.equal(boostHasNoEffect(healing.consumable.use, 0), false); // Healing → emergency, not no-effect
  assert.equal(boostHasNoEffect(cureDisease.consumable.use, 0), false); // consume-only
  assert.equal(boostHasNoEffect(booster.consumable.use, null), false); // unknown remaining → arms
});

test('armedRecoveryBonus: returns the single boost or the emergency spec, never summed', () => {
  assert.deepEqual(armedRecoveryBonus(null), { stepBonus: null, emergency: null });
  assert.deepEqual(armedRecoveryBonus({ kind: 'step-boost', value: 8 }), { stepBonus: 8, emergency: null });
  assert.deepEqual(armedRecoveryBonus({ kind: 'emergency-heal', step: 8 }), { stepBonus: null, emergency: { step: 8 } });
});
