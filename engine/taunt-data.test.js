// engine/taunt-data.test.js — run with `npm test` (node --test, no deps).
// plans/active-condition-window I3: Taunt ships as an `arms` talent
// { roll: { vs: "Social" }, rounds: "rank" } (R1; owner decision 2026-11-24).
// Mystic Aim's arms stay as they are (R2); taxonomy is not bumped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const talentsFile = JSON.parse(readFileSync(new URL('../rules/talents.json', import.meta.url)));

test('Taunt carries exactly the new arms descriptor', () => {
  const t = talentsFile.talents.Taunt;
  assert.deepEqual(t.arms, { roll: { vs: 'Social' }, rounds: 'rank' });
});

test('Taunt keeps its note effect and gains no on-success effects (display-only, R1)', () => {
  const t = talentsFile.talents.Taunt;
  assert.ok(t.effects.some((e) => e.type === 'note'));
  assert.ok(!t.effects.some((e) => e.condition === 'on-success'));
});

test('Mystic Aim arms is unchanged (rounds 1, Mystic) (R2)', () => {
  const a = talentsFile.talents['Mystic Aim'].arms;
  assert.equal(a.rounds, 1);
  assert.equal(a.roll.vs, 'Mystic');
});

test('no other talent uses a string arms.rounds besides Taunt', () => {
  const strs = Object.entries(talentsFile.talents)
    .filter(([, t]) => t.arms && typeof t.arms.rounds === 'string')
    .map(([k]) => k);
  assert.deepEqual(strs, ['Taunt']);
});

test('effectTaxonomy reference is still v6 (no version bump)', () => {
  assert.match(talentsFile.effectTaxonomy, /\(v6\)/);
});
