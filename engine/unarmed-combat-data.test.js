// engine/unarmed-combat-data.test.js — run with `npm test` (node --test, no deps).
// plans/unarmed-short-effect I1: Unarmed Combat ships as a full talent entry
// shaped like Melee Weapon (was a name/action/attribute stub). Values per
// rules.md R1-R6; shortEffect per owner decision 2026-11-26T21:57:50Z.
// Data-only: the note effect is display-only (no karma/combatOptions/arms).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const talentsFile = JSON.parse(readFileSync(new URL('../rules/talents.json', import.meta.url)));
const t = talentsFile.talents['Unarmed Combat'];

test('Unarmed Combat entry exists under its own name', () => {
  assert.ok(t, 'talents["Unarmed Combat"] missing');
  assert.equal(t.name, 'Unarmed Combat');
});

test('Unarmed Combat shortEffect is exactly "Unarmed close-combat attack" (owner decision)', () => {
  assert.equal(t.presentation?.shortEffect, 'Unarmed close-combat attack');
});

test('Unarmed Combat: Standard action, Dexterity, Strain 0 (R1)', () => {
  assert.equal(t.action, 'Standard');
  assert.equal(t.attribute, 'Dexterity');
  assert.equal(t.strain, 0);
});

test('Unarmed Combat: Skill Use allowed at Novice (R2)', () => {
  assert.deepEqual(t.skillUse, { allowed: true, tier: 'Novice' });
});

test('Unarmed Combat: talent tier Novice (R3)', () => {
  assert.equal(t.tier, 'Novice');
});

test('Unarmed Combat: versus the target\'s Physical Defense (R4)', () => {
  assert.equal(typeof t.versus, 'string');
  assert.match(t.versus, /Physical Defense/);
});

test('Unarmed Combat summary documents the attack and Strength Step damage (R4, R5)', () => {
  assert.equal(typeof t.summary, 'string');
  assert.ok(t.summary.trim().length > 0, 'summary must be non-empty');
  assert.match(t.summary, /Physical Defense/);
  assert.match(t.summary, /Strength Step/);
});

test('Unarmed Combat has exactly one effect: an on-success talent note (R5)', () => {
  assert.ok(Array.isArray(t.effects), 'effects must be an array');
  assert.equal(t.effects.length, 1);
  const [e] = t.effects;
  assert.equal(e.type, 'note');
  assert.equal(e.condition, 'on-success');
  assert.equal(e.source, 'talent');
  assert.equal(typeof e.summary, 'string');
  assert.ok(e.summary.trim().length > 0, 'note summary must be non-empty');
  assert.match(e.summary, /Strength Step/);
});

test('Unarmed Combat carries no karma, combatOptions or arms (R6; display-only)', () => {
  assert.ok(t, 'talents["Unarmed Combat"] missing');
  assert.ok(!('karma' in t), 'no karma field (R6)');
  assert.ok(!('combatOptions' in t), 'no combatOptions');
  assert.ok(!('arms' in t), 'no arms');
});

test('effectTaxonomy reference is still v6 (no version bump)', () => {
  assert.match(talentsFile.effectTaxonomy, /\(v6\)/);
});
