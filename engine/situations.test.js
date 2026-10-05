// engine/situations.test.js — run with `npm test`.
// Situational chips global (plans/situational-chips-global): the combat.json
// data edits, the pure `situationRollMods` helper, the unscoped-exempt kinds,
// and the collectCombatEffects strip rules for global active situations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attackPool, damagePool, collectCombatEffects, situationRollMods, UNSCOPED_EXEMPT_KINDS } from './combat.js';

const combat = JSON.parse(readFileSync(new URL('../rules/combat.json', import.meta.url)));
const situation = (name) => combat.situations.find((s) => s.name === name);
const RULES = { options: combat.options, situations: combat.situations };
const rules = { combat };

const ATTACK = 13;
const DMG_BASE = { weaponDamageStep: 5, strengthStep: 5 }; // 10
const pools = (conditions, extra = {}) => {
  const r = collectCombatEffects({ rules: RULES, conditions, ...extra });
  return {
    r,
    attack: attackPool({ talentStep: ATTACK, effects: r.attackEffects }),
    damage: damagePool({ ...DMG_BASE, effects: r.damageEffects }),
  };
};

// --- data (rules/combat.json) ---

test('combat.json: no "Range — Short" situation remains (R9)', () => {
  assert.equal(situation('Range — Short'), undefined);
  assert.ok(!JSON.stringify(combat).includes('Range — Short'));
});

test('combat.json: Surprised carries -3 Physical and Mystic Defence, keeps a note (R2)', () => {
  const eff = situation('Surprised').effects;
  for (const name of ['Physical', 'Mystic']) {
    const d = eff.find((e) => e.type === 'defense-modifier' && e.target?.name === name);
    assert.ok(d, `${name} defence effect`);
    assert.equal(d.value, -3);
    assert.equal(d.operation, 'add');
    assert.equal(d.measure, 'rating');
    assert.equal(d.condition, 'situational');
    assert.equal(d.source, 'condition');
  }
  assert.ok(eff.some((e) => e.type === 'note'));
});

test('combat.json: scopes — Long ranged, Impaired Movement movement, Darkness sight (R4, R5, R9)', () => {
  const scopeOf = (n) => situation(n).effects.find((e) => e.type === 'test-modifier').scope;
  assert.equal(scopeOf('Range — Long'), 'ranged');
  assert.equal(scopeOf('Impaired Movement — Light'), 'movement');
  assert.equal(scopeOf('Impaired Movement — Heavy'), 'movement');
  assert.equal(scopeOf('Partial Darkness'), 'sight');
  assert.equal(scopeOf('Full Darkness'), 'sight');
});

// --- situationRollMods ---

test('UNSCOPED_EXEMPT_KINDS is exactly the karma roll kind', () => {
  assert.deepEqual([...UNSCOPED_EXEMPT_KINDS], ['karma']);
});

test('situationRollMods: splits unscoped from scoped and carries measure (R7, R8)', () => {
  const out = situationRollMods(['Harried', 'Full Darkness', 'Range — Long', 'Impaired Movement — Heavy', 'Blindsided'], rules);
  assert.deepEqual(out.unscoped, [{ label: 'Harried', value: -2, measure: 'step' }]);
  assert.equal(out.scoped.length, 3);
  const has = (label, value, scope) =>
    out.scoped.some((m) => m.label === label && m.value === value && m.scope === scope && m.measure === 'step');
  assert.ok(has('Full Darkness', -4, 'sight'));
  assert.ok(has('Range — Long', -2, 'ranged'));
  assert.ok(has('Impaired Movement — Heavy', -4, 'movement'));
});

test('situationRollMods: Knocked Down and unknown names are ignored; empty gives empty lists', () => {
  assert.deepEqual(situationRollMods(['Knocked Down', 'No Such Chip'], rules), { unscoped: [], scoped: [] });
  assert.deepEqual(situationRollMods([], rules), { unscoped: [], scoped: [] });
});

test('situationRollMods: defence-only situations (Blindsided, Cover, Surprised) yield no roll mods', () => {
  assert.deepEqual(situationRollMods(['Blindsided', 'Partial Cover', 'Full Cover', 'Surprised'], rules), { unscoped: [], scoped: [] });
});

test('situationRollMods does not mutate its inputs', () => {
  const before = JSON.stringify(combat);
  const names = ['Harried'];
  situationRollMods(names, rules);
  assert.equal(JSON.stringify(combat), before);
  assert.deepEqual(names, ['Harried']);
});

// --- collectCombatEffects strip rules ---

test('collectCombatEffects: global situations strip defence mods and unscoped test mods', () => {
  const { r, attack } = pools({ situations: ['Blindsided', 'Harried'] });
  assert.equal(r.defenseMods.length, 0, 'defence already in derived Defence');
  assert.equal(attack.step, ATTACK, 'Harried -2 rides roll-time, not the pool');
});

test('collectCombatEffects: a locked Harried (encumbrance) is not counted in the pool (R7)', () => {
  assert.equal(pools({ harried: true }).attack.step, ATTACK);
});

test('Range Long on: attack 13 to 11 and damage 10 to 8; off restores (R5, R9)', () => {
  const on = pools({ situations: ['Range — Long'] });
  assert.equal(on.attack.step, 11);
  assert.equal(on.damage.step, 8);
  const off = pools({ situations: [] });
  assert.equal(off.attack.step, 13);
  assert.equal(off.damage.step, 10);
});

test('Darkness and Impaired Movement hit attack pools but never the damage pool (R4, R5)', () => {
  const dark = pools({ situations: ['Full Darkness'] });
  assert.equal(dark.attack.step, ATTACK - 4);
  assert.equal(dark.damage.step, 10);
  const mov = pools({ situations: ['Impaired Movement — Light'] });
  assert.equal(mov.attack.step, ATTACK - 2);
  assert.equal(mov.damage.step, 10);
});

test('scoped mods stack additively on the attack pool; Knocked Down in situations adds nothing', () => {
  const { attack } = pools({ situations: ['Partial Darkness', 'Range — Long', 'Impaired Movement — Heavy', 'Knocked Down'] });
  assert.equal(attack.step, ATTACK - 2 - 2 - 4);
  assert.deepEqual(attack.resultMods, []);
});

test('sightBased:false still skips the Darkness penalty for a global situation', () => {
  const r = collectCombatEffects({ rules: RULES, conditions: { situations: ['Full Darkness'] } });
  assert.equal(attackPool({ talentStep: ATTACK, effects: r.attackEffects, opts: { sightBased: false } }).step, ATTACK);
});

test('collectCombatEffects with situations does not mutate the rules', () => {
  const before = JSON.stringify(combat);
  collectCombatEffects({ rules: RULES, conditions: { situations: ['Harried', 'Range — Long'] } });
  assert.equal(JSON.stringify(combat), before);
});
