// engine/health.test.js — run with `npm test` (node --test, no deps).
// Covers the damage/healing engine: the Wound Threshold derivation (a health
// rating, added to characteristics.js alongside Unconsciousness/Death/Recovery)
// and the session-health helpers (damageState + applyHealth) that power the
// Overview's damage tracking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCharacteristics, woundThreshold } from './characteristics.js';
import { damageState, applyHealth, HEALTH_STATES } from './health.js';

const table = JSON.parse(
  readFileSync(new URL('../rules/characteristics.json', import.meta.url)),
);
const lookup = makeCharacteristics(table);

// Chakka's Toughness value for the anchors below (Tou 17).
const TOU = 17;

test('Wound Threshold = the table wound column (Chakka Tou 17 -> 11)', () => {
  const w = woundThreshold(TOU, [], lookup);
  assert.equal(w.base, 11);
  assert.equal(w.value, 11);
  assert.equal(w.modifiers.length, 0);
});

test('Wound Threshold folds an always-on characteristic-modifier (e.g. Temper Flesh)', () => {
  const eff = [
    {
      type: 'characteristic-modifier',
      target: { domain: 'characteristic', name: 'WoundThreshold' },
      operation: 'add',
      value: 4,
      measure: 'rating',
      condition: 'always',
    },
    // A Death/Unconsciousness effect must not leak into Wound Threshold.
    {
      type: 'characteristic-modifier',
      target: { domain: 'characteristic', name: 'DeathRating' },
      operation: 'add',
      value: 99,
      measure: 'rating',
      condition: 'always',
    },
  ];
  assert.equal(woundThreshold(TOU, eff, lookup).value, 15);
});

test('Wound Threshold clamps: Toughness above the table uses the last row', () => {
  assert.equal(woundThreshold(99, [], lookup).base, lookup(30).wound);
});

test('damageState: unhurt at 0 damage', () => {
  const s = damageState({ damage: 0, wounds: 0 }, { unconsciousness: { value: 34 }, death: { value: 70 } });
  assert.equal(s.state, 'unhurt');
  assert.equal(s.toUnconscious, 34);
  assert.equal(s.toDeath, 70);
});

test('damageState: conscious when damaged but below the thresholds', () => {
  const s = damageState({ damage: 4, wounds: 0 }, { unconsciousness: { value: 34 }, death: { value: 70 } });
  assert.equal(s.state, 'conscious');
  assert.equal(s.damage, 4);
  assert.equal(s.toUnconscious, 30);
  assert.equal(s.toDeath, 66);
});

test('damageState: unconscious at Damage >= Unconsciousness Rating', () => {
  const s = damageState({ damage: 34, wounds: 0 }, { unconsciousness: { value: 34 }, death: { value: 70 } });
  assert.equal(s.state, 'unconscious');
  assert.equal(s.toUnconscious, 0);
  assert.equal(s.toDeath, 36);
});

test('damageState: dead at Damage >= Death Rating', () => {
  const s = damageState({ damage: 70, wounds: 0 }, { unconsciousness: { value: 34 }, death: { value: 70 } });
  assert.equal(s.state, 'dead');
  assert.equal(s.toDeath, 0);
});

test('damageState: missing ratings -> state null, no fabricated headroom', () => {
  const s = damageState({ damage: 4, wounds: 0 }, {});
  assert.equal(s.state, null);
  assert.equal(s.toUnconscious, null);
  assert.equal(s.toDeath, null);
  assert.equal(s.damage, 4); // the input itself still passes through
});

test('damageState: bare-number ratings are accepted (not just { value } objects)', () => {
  const s = damageState({ damage: 10, wounds: 0 }, { unconsciousness: 34, death: 70 });
  assert.equal(s.state, 'conscious');
  assert.equal(s.toUnconscious, 24);
});

test('damageState: negative inputs clamp to 0 for the readout', () => {
  const s = damageState({ damage: -5, wounds: -1 }, { unconsciousness: 34, death: 70 });
  assert.equal(s.damage, 0);
  assert.equal(s.wounds, 0);
  assert.equal(s.state, 'unhurt');
});

test('HEALTH_STATES ladder is ordered best-to-worst', () => {
  assert.deepEqual(HEALTH_STATES, ['unhurt', 'conscious', 'unconscious', 'dead']);
});

test('applyHealth: taking damage adds; healing subtracts (clamped at 0)', () => {
  const next = applyHealth({ damage: 4, wounds: 0, recoveriesUsed: 0 }, { damage: 6 });
  assert.deepEqual(next, { damage: 10, wounds: 0, recoveriesUsed: 0 });
  const healed = applyHealth({ damage: 8, wounds: 0, recoveriesUsed: 0 }, { damage: -12 });
  assert.equal(healed.damage, 0); // clamped, never negative
});

test('applyHealth: a Recovery test heals the roll result and uses one test', () => {
  const next = applyHealth({ damage: 20, wounds: 0, recoveriesUsed: 1 }, { damage: -12, recoveriesUsed: 1 });
  assert.deepEqual(next, { damage: 8, wounds: 0, recoveriesUsed: 2 });
});

test('applyHealth: wounds delta works and clamps', () => {
  const next = applyHealth({ damage: 4, wounds: 2, recoveriesUsed: 0 }, { wounds: -3 });
  assert.equal(next.wounds, 0);
});

test('applyHealth: tolerates a missing health input and never mutates it', () => {
  const base = { damage: 4, wounds: 0, recoveriesUsed: 0 };
  const next = applyHealth(base, { damage: 2 });
  assert.deepEqual(base, { damage: 4, wounds: 0, recoveriesUsed: 0 }); // untouched
  assert.deepEqual(applyHealth(undefined, { damage: 2 }), { damage: 2, wounds: 0, recoveriesUsed: 0 });
});
