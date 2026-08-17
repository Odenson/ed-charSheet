// engine/ability-ranks.test.js — run with `npm test` (node --test, no deps).
// Exercises the rank-grant fold (plans/PLAN-RANK-GRANTS.md): possession from
// `set`, rank bonuses from `add`/`subtract`, collapse per fold target.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldAbilityGrants } from './ability-ranks.js';

const grant = (over = {}) => ({
  type: 'grant-ability',
  target: { domain: 'ability', name: 'Avoid Blow' },
  operation: 'add',
  value: 1,
  measure: 'rank',
  condition: 'always',
  stacking: 'replace',
  source: 'thread',
  origin: { kind: 'thread', name: 'Dark Archer Armour', rank: 2 },
  ...over,
});

// --- possession (`set`) -----------------------------------------------------

test('set:0 grants unranked possession', () => {
  const { possessed, bonuses } = foldAbilityGrants([
    grant({ operation: 'set', value: 0, condition: 'always', source: 'race', origin: { kind: 'race', name: 'Windling' } }),
  ]);
  assert.deepEqual(Object.keys(possessed), ['Avoid Blow']);
  assert.equal(possessed['Avoid Blow'].setValue, 0);
  assert.deepEqual(bonuses, {});
});

test('set:N>0 grants possession at rank N', () => {
  const { possessed } = foldAbilityGrants([grant({ operation: 'set', value: 2 })]);
  assert.equal(possessed['Avoid Blow'].setValue, 2);
});

test('side-by-side set grants yield one possession (no double row)', () => {
  const { possessed } = foldAbilityGrants([
    grant({ operation: 'set', value: 0, source: 'race', origin: { kind: 'race', name: 'Windling' } }),
    grant({ operation: 'set', value: 0, source: 'item', origin: { kind: 'item', name: 'Astral Sight Gift' } }),
  ]);
  assert.equal(Object.keys(possessed).length, 1, 'one row per ability');
  assert.equal(possessed['Avoid Blow'].setValue, 0);
});

test('later set overrides an earlier one (applyModifiers pass-1)', () => {
  const { possessed } = foldAbilityGrants([
    grant({ operation: 'set', value: 0 }),
    grant({ operation: 'set', value: 2 }),
  ]);
  assert.equal(possessed['Avoid Blow'].setValue, 2);
});

// --- rank bonus (`add` / `subtract`) ----------------------------------------

test('multi-source add grants sum on one ability', () => {
  const { bonuses } = foldAbilityGrants([
    grant({ value: 1, origin: { kind: 'thread', name: 'A', rank: 2 } }),
    grant({ value: 2, origin: { kind: 'thread', name: 'B', rank: 3 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 3);
  assert.equal(bonuses['Avoid Blow'].sources.length, 2);
  assert.deepEqual(bonuses['Avoid Blow'].sources[0], {
    value: 1,
    operation: 'add',
    source: 'thread',
    origin: { kind: 'thread', name: 'A', rank: 2 },
    summary: null,
  });
});

test('replace within one progression keeps the last rank grant, not the sum', () => {
  // Crimson Bracers-style: rank1 +1, rank3 +2 = +2 (never +3).
  const { bonuses } = foldAbilityGrants([
    grant({ value: 1, origin: { kind: 'thread', name: 'Crimson Bracers', rank: 1 } }),
    grant({ value: 2, origin: { kind: 'thread', name: 'Crimson Bracers', rank: 3 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 2);
});

test('replace is per progression — two different items each apply (D3)', () => {
  // Dark Archer +1 AND Espagra +2 on the same ability, different wears: both
  // stack (stacking allowed, D3); within each item its own progression only the
  // highest woven rank's grant survives.
  const { bonuses } = foldAbilityGrants([
    grant({ value: 1, origin: { kind: 'thread', name: 'Dark Archer Armour', rank: 1 } }),
    grant({ value: 1, origin: { kind: 'thread', name: 'Espagra Boots', rank: 1 } }),
    grant({ value: 2, origin: { kind: 'thread', name: 'Espagra Boots', rank: 3 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 3, 'Dark Archer +1 and Espagra +2 both apply');
});

test('a progression granting several abilities keeps EVERY ability', () => {
  // Espagra Boots woven: Avoid Blow and Stealthy Stride on the same `replace`
  // progression. Raw collapseStacking over the mixed list would drop Avoid Blow;
  // the per-target fold keeps both, per ability.
  const { bonuses } = foldAbilityGrants([
    grant({ target: { domain: 'ability', name: 'Avoid Blow' }, value: 1, origin: { kind: 'thread', name: 'Espagra Boots', rank: 1 } }),
    grant({ target: { domain: 'ability', name: 'Stealthy Stride' }, value: 1, origin: { kind: 'thread', name: 'Espagra Boots', rank: 2 } }),
    grant({ target: { domain: 'ability', name: 'Avoid Blow' }, value: 2, origin: { kind: 'thread', name: 'Espagra Boots', rank: 3 } }),
    grant({ target: { domain: 'ability', name: 'Stealthy Stride' }, value: 2, origin: { kind: 'thread', name: 'Espagra Boots', rank: 4 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 2, 'Avoid Blow +2 kept');
  assert.equal(bonuses['Stealthy Stride'].bonus, 2, 'Stealthy Stride +2 kept');
  assert.equal(Object.keys(bonuses).length, 2);
});

test('highest stacking keeps the single largest grant', () => {
  const { bonuses } = foldAbilityGrants([
    grant({ value: 1, stacking: 'highest', origin: { kind: 'thread', name: 'X', rank: 1 } }),
    grant({ value: 3, stacking: 'highest', origin: { kind: 'thread', name: 'X', rank: 3 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 3);
});

test('unique collapses across sources', () => {
  const { bonuses } = foldAbilityGrants([
    grant({ value: 1, stacking: 'unique', origin: { kind: 'thread', name: 'P', rank: 1 } }),
    grant({ value: 1, stacking: 'unique', origin: { kind: 'thread', name: 'Q', rank: 1 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 1);
  assert.equal(bonuses['Avoid Blow'].sources.length, 1);
});

test('subtract folds down', () => {
  const { bonuses } = foldAbilityGrants([
    grant({ value: 2, origin: { kind: 'thread', name: 'A', rank: 1 } }),
    grant({ operation: 'subtract', value: 1, origin: { kind: 'thread', name: 'B', rank: 1 } }),
  ]);
  assert.equal(bonuses['Avoid Blow'].bonus, 1);
});

test('add on an un-possessed ability still surfaces a bonus map entry', () => {
  const { bonuses } = foldAbilityGrants([grant({ value: 1 })]);
  assert.equal(bonuses['Avoid Blow'].bonus, 1);
});

test('a grant that nets to zero ranks is dropped — no +0 pill anywhere', () => {
  const { possessed, bonuses } = foldAbilityGrants([
    grant({ value: 1, origin: { kind: 'thread', name: 'A', rank: 1 } }),
    grant({ operation: 'subtract', value: 1, origin: { kind: 'thread', name: 'B', rank: 1 } }),
  ]);
  assert.deepEqual(bonuses, {}, 'zero total is no grant');
  assert.deepEqual(possessed, {}, 'no possession either');
});

test('an add:0 grant is dropped', () => {
  const { bonuses } = foldAbilityGrants([grant({ value: 0 })]);
  assert.deepEqual(bonuses, {});
});

// --- auto-apply guard -------------------------------------------------------

test('situational grants are never folded', () => {
  const { possessed, bonuses } = foldAbilityGrants([
    grant({ value: 3, condition: 'situational', scope: 'for one test, for 1 Strain' }),
  ]);
  assert.deepEqual(possessed, {});
  assert.deepEqual(bonuses, {});
});

test('gmDiscretion grants are never folded', () => {
  const { possessed, bonuses } = foldAbilityGrants([grant({ value: 1, gmDiscretion: true })]);
  assert.deepEqual(possessed, {});
  assert.deepEqual(bonuses, {});
});

test('non-rank or non-grant-ability effects are ignored', () => {
  const { possessed, bonuses } = foldAbilityGrants([
    grant({ measure: 'step' }),
    { type: 'characteristic-modifier', target: { domain: 'characteristic', name: 'Initiative' }, operation: 'add', value: 1, measure: 'step', condition: 'always' },
    { type: 'grant-ability', target: { domain: 'ability', name: 'X' }, operation: 'set', value: 0, measure: 'rating', condition: 'always' },
  ]);
  assert.deepEqual(possessed, {});
  assert.deepEqual(bonuses, {});
});

test('other operations on a rank grant are ignored', () => {
  const { possessed, bonuses } = foldAbilityGrants([grant({ operation: 'multiply', value: 2 })]);
  assert.deepEqual(possessed, {});
  assert.deepEqual(bonuses, {});
});