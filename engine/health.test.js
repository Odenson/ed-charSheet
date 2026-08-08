// engine/health.test.js — run with `npm test` (node --test, no deps).
// Covers the damage/healing engine: the Wound Threshold derivation (a health
// rating, added to characteristics.js alongside Unconsciousness/Death/Recovery)
// and the session-health helpers (damageState + applyHealth) that power the
// Overview's damage tracking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCharacteristics, woundThreshold } from './characteristics.js';
import {
  damageState,
  applyHealth,
  HEALTH_STATES,
  woundsFromHit,
  knockdownTriggered,
  knockdownDifficulty,
  knockdownOutcome,
  KNOCKED_DOWN_EFFECT,
  KNOCKED_DOWN_DEFENSE_EFFECTS,
} from './health.js';

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

// --- Wounds & knockdown (a wounding hit) -------------------------------------
// Owner-stated rules: a hit at/above the Wound Threshold records one Wound; a
// hit five or more over it triggers a Knockdown test (Strength vs. Difficulty =
// hit − threshold); meeting the difficulty keeps you up, missing knocks you down.
const WT = 11; // Chakka (Tou 17) — the anchor used above

test('woundsFromHit: a hit at the Wound Threshold records one Wound', () => {
  assert.equal(woundsFromHit(WT, WT), 1); // exactly at the threshold
  assert.equal(woundsFromHit(WT + 5, WT), 1);
});

test('woundsFromHit: below the threshold inflicts no Wound', () => {
  assert.equal(woundsFromHit(WT - 1, WT), 0);
  assert.equal(woundsFromHit(0, WT), 0);
});

test('woundsFromHit: a missing Wound Threshold never fabricates a Wound', () => {
  assert.equal(woundsFromHit(100, null), 0);
  assert.equal(woundsFromHit(100, undefined), 0);
});

test('knockdownTriggered: only a hit five or more over the threshold', () => {
  assert.equal(knockdownTriggered(WT + 4, WT), false); // 15, one over the 5 gap
  assert.equal(knockdownTriggered(WT + 5, WT), true); // 16, the gap
  assert.equal(knockdownTriggered(WT, WT), false); // a plain wounding hit
  assert.equal(knockdownTriggered(WT + 5, null), false); // no threshold -> no test
});

test('knockdownDifficulty: hit minus threshold, and only when triggered', () => {
  assert.equal(knockdownDifficulty(WT + 7, WT), 7);
  assert.equal(knockdownDifficulty(WT + 5, WT), 5);
  assert.equal(knockdownDifficulty(WT, WT), null); // not triggered
  assert.equal(knockdownDifficulty(WT + 9, null), null); // no threshold
});

test('knockdownOutcome: result at or above the difficulty stays up', () => {
  assert.equal(knockdownOutcome(9, 9), 'up');
  assert.equal(knockdownOutcome(12, 9), 'up');
});

test('knockdownOutcome: a result below the difficulty knocks down', () => {
  assert.equal(knockdownOutcome(8, 9), 'down');
  assert.equal(knockdownOutcome(0, 5), 'down');
});

test('knockdownOutcome: an impossible comparison is null, never decided', () => {
  assert.equal(knockdownOutcome(5, null), null);
  assert.equal(knockdownOutcome(null, 5), null);
});

test('KNOCKED_DOWN_EFFECT: the synthesized condition is taxonomy-shaped and roll-time', () => {
  assert.equal(KNOCKED_DOWN_EFFECT.type, 'test-modifier');
  assert.deepEqual(KNOCKED_DOWN_EFFECT.target, { domain: 'test', name: 'Action' });
  assert.equal(KNOCKED_DOWN_EFFECT.operation, 'add');
  assert.equal(KNOCKED_DOWN_EFFECT.value, -3);
  assert.equal(KNOCKED_DOWN_EFFECT.measure, 'result'); // applied at roll time, not folded into a stat
  assert.equal(KNOCKED_DOWN_EFFECT.source, 'condition');
  assert.match(KNOCKED_DOWN_EFFECT.summary, /all tests/);
});

test('KNOCKED_DOWN_DEFENSE_EFFECTS: the condition folds −3 into Physical and Mystic Defense only', () => {
  assert.equal(KNOCKED_DOWN_DEFENSE_EFFECTS.length, 2);
  for (const e of KNOCKED_DOWN_DEFENSE_EFFECTS) {
    assert.equal(e.type, 'defense-modifier');
    assert.equal(e.target.domain, 'defense');
    assert.ok(['Physical', 'Mystic'].includes(e.target.name), e.target.name);
    assert.equal(e.operation, 'add');
    assert.equal(e.value, -3);
    assert.equal(e.measure, 'rating'); // folds into the static rating
    assert.equal(e.condition, 'always'); // auto-applies while the condition is set
    assert.equal(e.source, 'condition');
  }
  // Social Defense is only ever hit at the gamemaster's discretion — not folded.
  assert.ok(KNOCKED_DOWN_DEFENSE_EFFECTS.every((e) => e.target.name !== 'Social'));
});

// The full wound-and-knockdown flow a big hit takes through the engine.
test('a hit 5+ over the threshold wounds, triggers a test, and resolves up or down', () => {
  const take = WT + 6; // e.g. 17 vs threshold 11
  assert.equal(woundsFromHit(take, WT), 1);
  assert.equal(knockdownTriggered(take, WT), true);
  const difficulty = knockdownDifficulty(take, WT);
  assert.equal(difficulty, 6);
  assert.equal(knockdownOutcome(difficulty, difficulty), 'up'); // just meets it
  assert.equal(knockdownOutcome(difficulty - 1, difficulty), 'down');
});
