// engine/combat-bonus-dice.test.js — run with `npm test` (node --test, no deps).
// spell-nights-edge I4: the D4 folds into the CHOSEN equipped weapon's Damage
// pool as `bonusDice` (never as a step), matching on object.kind + chosen
// name/index; the +2 Damage Step folds on the same weapon only; Arrow of Night
// (scope, no object) is unchanged. Rules: R2 (every Damage test), R3 (equipped
// weapons, any type), R5 (separate bonus die). Red-first: fails until built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildActiveSpell, activeSpellEffects } from './spells.js';
import { attackPool, damagePool, auditPool, activeSpellBundlesFor, collectCombatEffects } from './combat.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));
const NE = () => spellsFile.spells['Night’s Edge'];
const STEP_PICK = 'Increase Effect (+2 Damage Step)';
const RULES = { options: [], situations: [] };
const STR = 3;
const WEAPON = 4;
const TALENT = 9;

const effectsFor = (chosen, extraPicks = []) =>
  activeSpellEffects([buildActiveSpell(NE(), 3, { object: chosen, extraPicks })]);

// Run the full engine path for one selected weapon.
function damageFor(activeEffects, weapon) {
  const bundles = activeSpellBundlesFor(activeEffects, weapon.category, weapon);
  const fx = collectCombatEffects({ activeSpellBundles: bundles, rules: RULES });
  return { bundles, fx, pool: damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: fx.damageEffects }) };
}

test('bonus die reaches the chosen weapon’s Damage pool as bonusDice; the step is untouched (R2)', () => {
  const active = effectsFor({ name: 'Spear', index: 0 });
  const { pool, fx } = damageFor(active, { name: 'Spear', category: 'melee', index: 0 });
  assert.equal(pool.step, STR + WEAPON, 'a dice effect never changes step');
  assert.equal(pool.bonusDice.length, 1);
  assert.ok(JSON.stringify(pool.bonusDice).includes('Night’s Edge'), 'labelled by the spell name like the step mods');
  assert.equal(attackPool({ talentStep: TALENT, effects: fx.attackEffects }).step, TALENT, 'attack pool unaffected');
});

test('D4 is absent for a different weapon (R3)', () => {
  const active = effectsFor({ name: 'Spear', index: 0 });
  const { pool, bundles } = damageFor(active, { name: 'Sword', category: 'melee', index: 0 });
  assert.deepEqual(bundles, []);
  assert.deepEqual(pool.bonusDice, []);
  assert.equal(pool.step, STR + WEAPON);
});

test('any weapon category qualifies for kind "weapon": missile and melee (R3)', () => {
  const active = effectsFor({ name: 'Longbow', index: 0 });
  assert.equal(damageFor(active, { name: 'Longbow', category: 'missile', index: 0 }).pool.bonusDice.length, 1);
  const active2 = effectsFor({ name: 'Axe', index: 0 });
  assert.equal(damageFor(active2, { name: 'Axe', category: 'melee', index: 0 }).pool.bonusDice.length, 1);
});

test('duplicate names: chosen {Spear, 1} puts the D4 on the second Spear only', () => {
  const active = effectsFor({ name: 'Spear', index: 1 });
  assert.equal(damageFor(active, { name: 'Spear', category: 'melee', index: 1 }).pool.bonusDice.length, 1);
  assert.equal(damageFor(active, { name: 'Spear', category: 'melee', index: 0 }).pool.bonusDice.length, 0);
});

test('unequipping an earlier same-name Spear shifts the remaining one to index 0: no match until restored (accepted)', () => {
  const active = effectsFor({ name: 'Spear', index: 1 });
  assert.equal(damageFor(active, { name: 'Spear', category: 'melee', index: 0 }).pool.bonusDice.length, 0);
  assert.equal(damageFor(active, { name: 'Spear', category: 'melee', index: 1 }).pool.bonusDice.length, 1, 'original arrangement restored');
});

test('chosen weapon not in the equipped list: no weapon is selectable, so nothing folds; it returns on re-equip', () => {
  const active = effectsFor({ name: 'Spear', index: 0 });
  // Only a different weapon is equipped/selectable.
  assert.deepEqual(activeSpellBundlesFor(active, 'melee', { name: 'Sword', category: 'melee', index: 0 }), []);
  // Re-equipped and selected again.
  assert.equal(activeSpellBundlesFor(active, 'melee', { name: 'Spear', category: 'melee', index: 0 }).length, 1);
});

test('the +2 Damage Step folds as a step on the same weapon only', () => {
  const active = effectsFor({ name: 'Spear', index: 0 }, [STEP_PICK]);
  const on = damageFor(active, { name: 'Spear', category: 'melee', index: 0 }).pool;
  assert.equal(on.step, STR + WEAPON + 2);
  assert.equal(on.bonusDice.length, 1);
  const off = damageFor(active, { name: 'Sword', category: 'melee', index: 0 }).pool;
  assert.equal(off.step, STR + WEAPON);
  assert.equal(off.bonusDice.length, 0);
});

test('activeSpellBundlesFor: object.kind replaces scope (melee-weapon / missile-weapon by category)', () => {
  const base = { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' }, operation: 'add', value: 'D4', measure: 'dice', source: 'spell', chosen: { name: 'X', index: 0 }, origin: { kind: 'spell', name: 'Test' } };
  const melee = { ...base, object: { kind: 'melee-weapon', require: 'equipped' } };
  const missile = { ...base, object: { kind: 'missile-weapon', require: 'equipped' } };
  assert.equal(activeSpellBundlesFor([melee], 'melee', { name: 'X', category: 'melee', index: 0 }).length, 1);
  assert.deepEqual(activeSpellBundlesFor([melee], 'missile', { name: 'X', category: 'missile', index: 0 }), []);
  assert.equal(activeSpellBundlesFor([missile], 'missile', { name: 'X', category: 'missile', index: 0 }).length, 1);
  assert.deepEqual(activeSpellBundlesFor([missile], 'melee', { name: 'X', category: 'melee', index: 0 }), []);
});

test('activeSpellBundlesFor: effects with no object keep scope filtering even when a weapon is passed (Arrow of Night unchanged)', () => {
  const arrow = activeSpellEffects([buildActiveSpell(spellsFile.spells['Arrow of Night'], 3, {})]);
  assert.equal(activeSpellBundlesFor(arrow, 'missile', { name: 'Longbow', category: 'missile', index: 0 }).length, 1);
  assert.deepEqual(activeSpellBundlesFor(arrow, 'melee', { name: 'Spear', category: 'melee', index: 0 }), []);
  // The legacy two-argument call still works.
  assert.equal(activeSpellBundlesFor(arrow, 'missile').length, 1);
  const { pool } = damageFor(arrow, { name: 'Longbow', category: 'missile', index: 0 });
  assert.equal(pool.step, STR + WEAPON + 6);
  assert.deepEqual(pool.bonusDice, []);
});

test('the gmDiscretion -2 Mystic Defense note never routes to the combat bundles', () => {
  const rec = buildActiveSpell(NE(), 3, { object: { name: 'Spear', index: 0 } });
  assert.ok(!rec.effects.some((e) => e.type === 'note'));
});

test('auditPool itemises the dice as a part of kind "dice" without changing the step', () => {
  const active = effectsFor({ name: 'Spear', index: 0 });
  const { fx } = damageFor(active, { name: 'Spear', category: 'melee', index: 0 });
  const audit = auditPool([{ label: 'Strength', value: STR }, { label: 'Weapon', value: WEAPON }], fx.damageEffects, { testKind: 'damage' });
  assert.equal(audit.step, STR + WEAPON);
  const dice = audit.parts.filter((p) => p.kind === 'dice');
  assert.equal(dice.length, 1);
  assert.ok(String(dice[0].label).includes('Night’s Edge'));
  assert.ok(audit.parts.every((p) => p.kind !== 'step'), 'no step part from a dice effect');
});

test('rolls without bonus dice: empty bonusDice (byte-identical flow otherwise)', () => {
  const pool = damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: [] });
  assert.deepEqual(pool.bonusDice, []);
});
