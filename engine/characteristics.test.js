// engine/characteristics.test.js — run with `npm test` (node --test, no deps).
// Verifies the hand-transcribed Characteristics Table against the rulebook's own
// worked examples and exercises the effect applier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCharacteristics, defense, DEFENSE_ATTRIBUTE, applyModifiers } from './characteristics.js';

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

test('applyModifiers folds operations in order', () => {
  const eff = [
    { operation: 'add', value: 2, condition: 'always' },
    { operation: 'subtract', value: 1, condition: 'always' },
  ];
  const r = applyModifiers(10, eff, () => true);
  assert.equal(r.value, 11);
  assert.equal(r.base, 10);
});
