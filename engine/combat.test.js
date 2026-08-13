// engine/combat.test.js — run with `npm test` (node --test, no deps).
// Covers the Phase B combat-pool engine against the REAL rules/combat.json:
// attack/damage pool assembly, step-vs-result separation (B10), defense mods
// excluded (B7), except-knockdown scope (B8), sight scope, note-only riders,
// strain totals, the hit/miss / net-damage resolvers, and the Phase B11
// asymmetric locked-condition strip in collectCombatEffects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attackPool, damagePool, resolveAttack, netDamage, collectCombatEffects, attackTalentNamesFor, attackSuccessLevels } from './combat.js';

const combat = JSON.parse(readFileSync(new URL('../rules/combat.json', import.meta.url)));
const option = (name) => combat.options.find((o) => o.name === name);
const situation = (name) => combat.situations.find((s) => s.name === name);

const TALENT = 10; // the character's attack talent step
const WEAPON = 5; // weapon Damage Step
const STR = 8; // Strength step

test('rules/combat.json carries 10 options and 12 situations', () => {
  assert.equal(combat.options.length, 10);
  assert.equal(combat.situations.length, 12);
  assert.equal(combat.schema, 'ed-combat/1');
});

test('empty effect list: unchanged step, no mods, no strain', () => {
  assert.deepEqual(attackPool({ talentStep: TALENT, effects: [] }), { step: TALENT, resultMods: [], strain: 0 });
  assert.deepEqual(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: [] }), {
    step: STR + WEAPON,
    resultMods: [],
  });
});

test('attackTalentNamesFor: category → wielding talent/skill names (throwing-only)', () => {
  assert.deepEqual(attackTalentNamesFor('melee'), ['Melee Weapon']);
  assert.deepEqual(attackTalentNamesFor('missile'), ['Missile Weapon']);
  assert.deepEqual(attackTalentNamesFor('throwing'), ['Throwing Weapon']); // no Melee (owner)
  assert.deepEqual(attackTalentNamesFor('unarmed'), ['Unarmed Combat']);
  assert.equal(attackTalentNamesFor(null), null); // "None" → caller shows the whole list
  assert.deepEqual(attackTalentNamesFor('mystery'), []); // unknown category wields nothing
});

test('attackSuccessLevels: every whole 5 over target is a level, miss clamps to 0', () => {
  assert.equal(attackSuccessLevels(11, 5), 1); // owner example
  assert.equal(attackSuccessLevels(17, 5), 2); // owner example
  assert.equal(attackSuccessLevels(24, 5), 3); // owner example
  assert.equal(attackSuccessLevels(9, 5), 0); // hit, but < 5 over → no bonus
  assert.equal(attackSuccessLevels(5, 5), 0); // exact hit → 0
  assert.equal(attackSuccessLevels(4, 5), 0); // miss → clamped, never negative
  assert.equal(attackSuccessLevels(null, 5), 0);
  assert.equal(attackSuccessLevels(20, null), 0);
});

test('damagePool bonusSteps: adds success-level steps, never fabricates a null base', () => {
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: [], bonusSteps: 2 }).step, STR + WEAPON + 2);
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: [], bonusSteps: 0 }).step, STR + WEAPON);
  // No weapon (null base) + a bonus must stay null — placeholder pill, no invented step.
  assert.equal(damagePool({ weaponDamageStep: null, strengthStep: STR, effects: [], bonusSteps: 3 }).step, null);
});

test('Aggressive Attack: +3 attack step, +3 damage step, defense mods excluded, 1 Strain', () => {
  const effects = option('Aggressive Attack').effects;
  assert.deepEqual(attackPool({ talentStep: TALENT, effects }), { step: TALENT + 3, resultMods: [], strain: 1 });
  assert.deepEqual(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects }), {
    step: STR + WEAPON + 3,
    resultMods: [],
  });
});

test('Called Shot: −3 attack step, 1 Strain, note folds nothing', () => {
  const effects = option('Called Shot').effects;
  assert.deepEqual(attackPool({ talentStep: TALENT, effects }), { step: TALENT - 3, resultMods: [], strain: 1 });
});

test('Defensive Stance: −3 attack AND damage (except-knockdown scope), defense mods excluded', () => {
  const effects = option('Defensive Stance').effects;
  assert.deepEqual(attackPool({ talentStep: TALENT, effects }), { step: TALENT - 3, resultMods: [], strain: 0 });
  assert.deepEqual(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects }), {
    step: STR + WEAPON - 3,
    resultMods: [],
  });
});

test('Action-test mods hit the attack pool but not the damage (Effect) pool', () => {
  const effects = situation('Range — Long').effects; // −2 to Action tests
  assert.equal(attackPool({ talentStep: TALENT, effects }).step, TALENT - 2);
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects }).step, STR + WEAPON);
});

test('Full Darkness: −4 attack step for a sighted attacker, ignored for heat sight', () => {
  const effects = situation('Full Darkness').effects;
  assert.equal(attackPool({ talentStep: TALENT, effects }).step, TALENT - 4);
  assert.equal(attackPool({ talentStep: TALENT, effects, opts: { sightBased: false } }).step, TALENT);
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects }).step, STR + WEAPON);
});

test('Partial Darkness: −2 attack step, scope sight', () => {
  const effects = situation('Partial Darkness').effects;
  assert.equal(attackPool({ talentStep: TALENT, effects }).step, TALENT - 2);
  assert.equal(attackPool({ talentStep: TALENT, effects, opts: { sightBased: false } }).step, TALENT);
});

test('Harried: −2 attack step, defense mods excluded', () => {
  const effects = situation('Harried').effects;
  assert.deepEqual(attackPool({ talentStep: TALENT, effects }), { step: TALENT - 2, resultMods: [], strain: 0 });
});

test('Knocked Down is a flat RESULT mod (B10): step unchanged, mods carry the −3', () => {
  const effects = situation('Knocked Down').effects;
  const pool = attackPool({ talentStep: TALENT, effects });
  assert.equal(pool.step, TALENT);
  assert.equal(pool.resultMods.length, 1);
  assert.equal(pool.resultMods[0].value, -3);
});

test('note-only riders fold nothing: Full Cover, Surprised, Stun, Knockdown, Jump Up, Set Charge', () => {
  for (const name of ['Full Cover', 'Surprised', 'Attacking to Stun', 'Attacking to Knockdown', 'Jump Up', 'Setting Against a Charge', 'Range — Short']) {
    const effects = (option(name) ?? situation(name)).effects;
    assert.deepEqual(attackPool({ talentStep: TALENT, effects }), { step: TALENT, resultMods: [], strain: 0 }, name);
    assert.deepEqual(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects }), {
      step: STR + WEAPON,
      resultMods: [],
    }, name);
  }
});

test('strain totals sum across selected options', () => {
  const aggressive = option('Aggressive Attack').effects;
  const called = option('Called Shot').effects;
  const shatter = option('Shattering a Shield').effects;
  const split = option('Splitting Movement').effects;
  assert.equal(attackPool({ talentStep: TALENT, effects: [...aggressive, ...called] }).strain, 2);
  assert.equal(attackPool({ talentStep: TALENT, effects: [...shatter, ...split] }).strain, 2);
  assert.equal(attackPool({ talentStep: TALENT, effects: [] }).strain, 0);
});

test('missing base keeps step null (placeholder pill), strain still folds', () => {
  const called = option('Called Shot').effects;
  const p = attackPool({ talentStep: null, effects: called });
  assert.equal(p.step, null);
  assert.equal(p.strain, 1);
  assert.equal(damagePool({ weaponDamageStep: null, strengthStep: STR, effects: [] }).step, null);
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: null, effects: [] }).step, null);
  assert.equal(damagePool({ weaponDamageStep: null, strengthStep: STR, effects: option('Aggressive Attack').effects }).step, null);
});

test('resolveAttack: hit/miss against a target, null when roll-only', () => {
  assert.equal(resolveAttack(20, 11), 'hit');
  assert.equal(resolveAttack(10, 11), 'miss');
  assert.equal(resolveAttack(20, null), null);
  assert.equal(resolveAttack(20, undefined), null);
  assert.equal(resolveAttack(null, 11), null);
});

test('netDamage: result − armor floored at 0; no armor → raw result; no roll → null', () => {
  assert.equal(netDamage(15, 5), 10);
  assert.equal(netDamage(15, 20), 0);
  assert.equal(netDamage(3, 5), 0);
  assert.equal(netDamage(15, null), 15);
  assert.equal(netDamage(null, 5), null);
});

// --- collectCombatEffects (Phase B11 — the asymmetric locked-condition strip) ---

const RULES = { options: combat.options, situations: combat.situations };

test('collectCombatEffects: player toggles return attack/damage effects AND defense mods (informational)', () => {
  const r = collectCombatEffects({
    selectedOptions: ['Aggressive Attack'],
    selectedSituations: ['Partial Cover'],
    selectedCharms: [],
    rules: RULES,
    conditions: {},
  });
  assert.ok(r.attackEffects.includes(option('Aggressive Attack').effects[0]), 'attack step mod present');
  assert.ok(r.attackEffects.some((e) => e.type === 'resource-modifier'), 'strain mod present');
  assert.ok(!r.attackEffects.some((e) => e.type === 'defense-modifier'), 'defense mods never enter the pool (B7)');
  // defenseMods: Aggressive Attack −3/−3 + Partial Cover +2/+2
  const sum = (n) => r.defenseMods.filter((x) => x.name === n).reduce((s, x) => s + x.value, 0);
  assert.equal(sum('Physical'), -3 + 2);
  assert.equal(sum('Mystic'), -3 + 2);
  // And the round trip: the collected effects fold into the pool exactly like
  // feeding the raw bundle effects would.
  assert.deepEqual(attackPool({ talentStep: TALENT, effects: r.attackEffects }), {
    step: TALENT + 3, // Aggressive Attack +3 step (Partial Cover has no test mod)
    resultMods: [],
    strain: 1,
  });
});

test('collectCombatEffects: Knocked Down stripped entirely when locked (B11)', () => {
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [], rules: RULES, conditions: { knockedDown: true } });
  assert.equal(r.attackEffects.length, 0);
  assert.equal(r.damageEffects.length, 0);
  assert.equal(r.defenseMods.length, 0);
  // The pool sees nothing — the −3 rides ed-app's roll-time mods instead.
  assert.deepEqual(attackPool({ talentStep: TALENT, effects: r.attackEffects }), { step: TALENT, resultMods: [], strain: 0 });
});

test('collectCombatEffects: Harried keeps its Action −2 but strips defence mods (B11)', () => {
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [], rules: RULES, conditions: { harried: true } });
  assert.deepEqual(attackPool({ talentStep: TALENT, effects: r.attackEffects }), { step: TALENT - 2, resultMods: [], strain: 0 });
  assert.equal(r.defenseMods.length, 0);
});

test('collectCombatEffects: a player-toggled Harried chip returns its defence mods (B7 informational)', () => {
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: ['Harried'], selectedCharms: [], rules: RULES, conditions: {} });
  const sum = (n) => r.defenseMods.filter((x) => x.name === n).reduce((s, x) => s + x.value, 0);
  assert.equal(sum('Physical'), -2);
  assert.equal(sum('Mystic'), -2);
  // The Action −2 still folds — a hand-toggled Harried is the player's choice.
  assert.equal(attackPool({ talentStep: TALENT, effects: r.attackEffects }).step, TALENT - 2);
});

test('collectCombatEffects: blood-charm effects fold (result-measure → resultMods, strain folds)', () => {
  const charm = {
    name: 'Desperate Blow',
    effects: [
      { type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 6, measure: 'result', condition: 'situational', source: 'condition', summary: '+6 to the Attack result.' },
      { type: 'resource-modifier', target: { domain: 'resource', name: 'Strain' }, operation: 'add', value: 1, measure: 'points', condition: 'situational', source: 'condition', summary: '1 Strain.' },
    ],
  };
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [charm], rules: RULES, conditions: {} });
  const ap = attackPool({ talentStep: TALENT, effects: r.attackEffects });
  assert.equal(ap.step, TALENT);
  assert.deepEqual(ap.resultMods, [{ label: '+6 to the Attack result.', value: 6 }]);
  assert.equal(ap.strain, 1);
});
