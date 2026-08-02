// engine/characteristics.test.js — run with `npm test` (node --test, no deps).
// Verifies the hand-transcribed Characteristics Table against the rulebook's own
// worked examples and exercises the effect applier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeCharacteristics,
  defense,
  DEFENSE_ATTRIBUTE,
  applyModifiers,
  armor,
  physicalArmor,
  mysticArmor,
  initiative,
  knockdown,
  maxKarma,
  KARMA_STEP,
  karmaUse,
} from './characteristics.js';

// Build an armor-modifier effect (worn armor / racial Natural Armor).
const armEffect = (name, value, extra = {}) => ({
  type: 'armor-modifier',
  target: { domain: 'armor', name },
  operation: 'add',
  value,
  measure: 'rating',
  condition: 'always',
  source: 'item',
  ...extra,
});

// Build a defense-modifier effect targeting one kind of defense.
const defEffect = (name, value, extra = {}) => ({
  type: 'defense-modifier',
  target: { domain: 'defense', name },
  operation: 'add',
  value,
  measure: 'rating',
  condition: 'always',
  source: 'discipline',
  ...extra,
});

const table = JSON.parse(
  readFileSync(new URL('../rules/characteristics.json', import.meta.url)),
);
const lookup = makeCharacteristics(table);

test('table is 30 contiguous rows', () => {
  assert.equal(table.rows.length, 30);
  table.rows.forEach((r, i) => assert.equal(r.value, i + 1));
});

test("matches the Player's Guide worked example", () => {
  assert.equal(lookup(16).defense, 9); // DEX value 16 -> Physical Defense 9
  assert.equal(lookup(12).defense, 7); // PER value 12 -> Mystic Defense 7
  assert.equal(lookup(14).uncon, 28); // TOU value 14 -> Uncon 28
  assert.equal(lookup(14).death, 34); //           -> Death base 34 (Uncon 28 + Step 6)
  assert.equal(lookup(14).wound, 9); //            -> Wound Threshold 9
});

test('the three defenses map to the right attributes', () => {
  assert.equal(DEFENSE_ATTRIBUTE.Physical, 'Dexterity');
  assert.equal(DEFENSE_ATTRIBUTE.Mystic, 'Perception');
  assert.equal(DEFENSE_ATTRIBUTE.Social, 'Charisma');
});

test('Chakka: Physical Defense = 11 base (DEX 20), no racial modifier', () => {
  const pd = defense('Physical', 20, [], lookup);
  assert.equal(pd.base, 11);
  assert.equal(pd.value, 11);
  assert.equal(pd.modifiers.length, 0);
});

test('a Windling-style +2 defense-modifier layers onto the table base', () => {
  const pd = defense('Physical', 16, [defEffect('Physical', 2, { source: 'race' })], lookup);
  assert.equal(pd.base, 9);
  assert.equal(pd.value, 11);
  assert.equal(pd.modifiers.length, 1);
});

test('situational / gmDiscretion effects do not auto-apply', () => {
  const situational = [defEffect('Physical', 5, { condition: 'situational', gmDiscretion: true })];
  assert.equal(defense('Physical', 16, situational, lookup).value, 9);
});

test('each defense kind picks only its own effects', () => {
  // One pool of effects; each kind must select just its matching modifier.
  const effects = [
    defEffect('Physical', 1),
    defEffect('Mystic', 2),
    defEffect('Mystic', 1), // two Mystic modifiers stack
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 3, measure: 'rating', condition: 'always' },
  ];
  assert.equal(defense('Physical', 16, effects, lookup).value, 9 + 1); // base 9 (v16) +1
  assert.equal(defense('Mystic', 16, effects, lookup).value, 9 + 3); //  base 9 (v16) +2+1
  assert.equal(defense('Social', 16, effects, lookup).value, 9); //      no Social effects
});

test('Chakka: Mystic Defense = 10 (PER 14 base 8, +1 Archer +1 Nethermancer)', () => {
  const md = defense('Mystic', 14, [defEffect('Mystic', 1), defEffect('Mystic', 1)], lookup);
  assert.equal(md.base, 8);
  assert.equal(md.value, 10);
  assert.equal(md.modifiers.length, 2);
});

test('Chakka: Social Defense = 8 (CHA 13 base 8, no effects)', () => {
  const sd = defense('Social', 13, [], lookup);
  assert.equal(sd.base, 8);
  assert.equal(sd.value, 8);
});

test('values above the table clamp to the last row', () => {
  assert.equal(lookup(99).defense, lookup(30).defense);
});

// --- Armor ratings ------------------------------------------------------------

test('Mystic Armor Table column matches the Player\'s Guide (floor(WIL/5))', () => {
  assert.equal(lookup(4).mysticArmor, 0);
  assert.equal(lookup(5).mysticArmor, 1);
  assert.equal(lookup(9).mysticArmor, 1);
  assert.equal(lookup(13).mysticArmor, 2); // Chakka's WIL value
  assert.equal(lookup(20).mysticArmor, 4);
  assert.equal(lookup(30).mysticArmor, 6);
});

test('Chakka: Physical Armor = 0 with no armour worn', () => {
  const pa = physicalArmor([]);
  assert.equal(pa.base, 0);
  assert.equal(pa.value, 0);
  assert.equal(pa.modifiers.length, 0);
});

test('Hardened Leather: Physical Armor 0 + 5 = 5', () => {
  const pa = physicalArmor([armEffect('Physical', 5)]);
  assert.equal(pa.value, 5);
  assert.equal(pa.modifiers.length, 1);
});

test('Chakka: Mystic Armor = table 2 (WIL 13) + worn bonuses', () => {
  assert.equal(mysticArmor(13, [], lookup).value, 2); // natural, no gear
  assert.equal(mysticArmor(13, [armEffect('Mystic', 1)], lookup).value, 3); // + Hardened Leather
});

test('armor picks only its own kind; shields (defence) never leak in', () => {
  const effects = [
    armEffect('Physical', 5),
    armEffect('Mystic', 1),
    // A shield raises DEFENCE, not armor — must be ignored by armor().
    { type: 'defense-modifier', target: { domain: 'defense', name: 'Physical' }, operation: 'add', value: 2, measure: 'rating', condition: 'always' },
  ];
  assert.equal(armor('Physical', 0, effects).value, 5);
  assert.equal(armor('Mystic', 2, effects).value, 3);
});

test('set-as-base: obsidiman Natural Armor (set 3) is a floor living armour adds onto', () => {
  const natural = armEffect('Physical', 3, { operation: 'set', source: 'race' });
  const living = armEffect('Physical', 6, { source: 'item' }); // e.g. Living Crystal
  // Order-independent: `set` establishes the base before the `add` folds on.
  assert.equal(physicalArmor([natural, living]).value, 9);
  assert.equal(physicalArmor([living, natural]).value, 9);
  // Natural armour alone is just the base.
  assert.equal(physicalArmor([natural]).value, 3);
});

test('Chakka: Initiative = Dexterity step 8 (no armour, no applicable effect)', () => {
  const init = initiative(8, []);
  assert.equal(init.base, 8);
  assert.equal(init.value, 8);
  assert.equal(init.modifiers.length, 0);
});

test('Initiative applies a step-adding characteristic-modifier (e.g. Archer C7)', () => {
  const eff = [
    {
      type: 'characteristic-modifier',
      target: { domain: 'characteristic', name: 'Initiative' },
      operation: 'add',
      value: 1,
      measure: 'step',
      condition: 'always',
      source: 'discipline',
    },
  ];
  assert.equal(initiative(8, eff).value, 9);
  // A Knockdown effect must not leak into Initiative.
  const kd = [{ ...eff[0], target: { domain: 'characteristic', name: 'Knockdown' } }];
  assert.equal(initiative(8, kd).value, 8);
});

test('Chakka: Knockdown = Strength step 8', () => {
  const kd = knockdown(8, []);
  assert.equal(kd.base, 8);
  assert.equal(kd.value, 8);
});

test('Chakka: Max Karma = karmaModifier 5 × highest Circle 4 = 20; die is D6 (step 4)', () => {
  assert.equal(maxKarma(5, 4), 20);
  assert.equal(KARMA_STEP, 4);
});

test('maxKarma guards missing inputs', () => {
  assert.equal(maxKarma(null, 4), null);
  assert.equal(maxKarma(5, undefined), null);
});

test('karmaUse finds grant-karma-use permissions by test name, with scope', () => {
  const effects = [
    { type: 'grant-karma-use', target: { domain: 'test', name: 'Initiative' }, origin: { kind: 'discipline', name: 'Archer', circle: 3 } },
    { type: 'grant-karma-use', target: { domain: 'test', name: 'Perception' }, scope: 'sight-based', origin: { kind: 'discipline', name: 'Archer', circle: 1 } },
    { type: 'defense-modifier', target: { domain: 'defense', name: 'Physical' }, operation: 'add', value: 1 },
  ];
  assert.equal(karmaUse('Initiative', effects).grants[0].scope, null); // unscoped
  assert.equal(karmaUse('Initiative', effects).grants[0].via.name, 'Archer');
  assert.equal(karmaUse('Perception', effects).grants[0].scope, 'sight-based');
  assert.equal(karmaUse('Strength', effects), null); // no grant → not karma-eligible
});

test('applyModifiers folds operations in order', () => {
  const eff = [
    { operation: 'add', value: 2, condition: 'always' },
    { operation: 'subtract', value: 1, condition: 'always' },
  ];
  const r = applyModifiers(10, eff, () => true);
  assert.equal(r.value, 11);
  assert.equal(r.base, 10);
});
