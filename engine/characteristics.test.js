// engine/characteristics.test.js — run with `npm test` (node --test, no deps).
// Verifies the hand-transcribed Characteristics Table against the rulebook's own
// worked examples and exercises the effect applier.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCharacteristics, physicalDefense, applyModifiers } from './characteristics.js';

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

test('Chakka: Dexterity value 20 -> Physical Defense 11, no racial modifier', () => {
  const pd = physicalDefense(20, [], lookup);
  assert.equal(pd.base, 11);
  assert.equal(pd.value, 11);
  assert.equal(pd.modifiers.length, 0);
});

test('a Windling-style +2 defense-modifier layers onto the table base', () => {
  const windling = [
    {
      type: 'defense-modifier',
      target: { domain: 'defense', name: 'Physical' },
      operation: 'add',
      value: 2,
      measure: 'rating',
      condition: 'always',
      source: 'race',
    },
  ];
  const pd = physicalDefense(16, windling, lookup);
  assert.equal(pd.base, 9);
  assert.equal(pd.value, 11);
  assert.equal(pd.modifiers.length, 1);
});

test('situational / gmDiscretion effects do not auto-apply', () => {
  const situational = [
    {
      type: 'defense-modifier',
      target: { domain: 'defense', name: 'Physical' },
      operation: 'add',
      value: 5,
      measure: 'rating',
      condition: 'situational',
      gmDiscretion: true,
      source: 'race',
    },
  ];
  assert.equal(physicalDefense(16, situational, lookup).value, 9);
});

test('non-matching effects are ignored (Mystic defense, Armor)', () => {
  const others = [
    { type: 'defense-modifier', target: { domain: 'defense', name: 'Mystic' }, operation: 'add', value: 3, measure: 'rating', condition: 'always' },
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 3, measure: 'rating', condition: 'always' },
  ];
  assert.equal(physicalDefense(16, others, lookup).value, 9);
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
