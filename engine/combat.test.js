// engine/combat.test.js — run with `npm test` (node --test, no deps).
// Covers the Phase B combat-pool engine against the REAL rules/combat.json:
// attack/damage pool assembly, step-vs-result separation (B10), defense mods
// excluded (B7), except-knockdown scope (B8), sight scope, note-only riders,
// strain totals, the hit/miss / net-damage resolvers, and the Phase B11
// asymmetric locked-condition strip in collectCombatEffects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attackPool, damagePool, auditPool, resolveAttack, netDamage, collectCombatEffects, foldCombatRatings, attackTalentNamesFor, attackSuccessLevels, successCount, tickArmedTalents } from './combat.js';

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
  // Folded effects are COPIES stamped with their source name (label), so compare
  // by content, not identity: the +3 Attack step mod is present, labelled by source.
  assert.ok(r.attackEffects.some((e) => e.type === 'test-modifier' && e.target?.name === 'Attack' && e.value === 3 && e.label === 'Aggressive Attack'), 'attack step mod present, labelled by source');
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
  // The result mod is labelled by its source (the charm name), not its summary.
  assert.deepEqual(ap.resultMods, [{ label: 'Desperate Blow', value: 6 }]);
  assert.equal(ap.strain, 1);
});

test('collectCombatEffects: armor-modifier effects collect as armorMods, never the pools', () => {
  const charm = {
    name: 'Petrified Oak',
    effects: [
      { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 2, measure: 'rating', condition: 'situational', source: 'condition', summary: 'Physical armour +2.' },
    ],
  };
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [charm], rules: RULES, conditions: {} });
  assert.deepEqual(r.armorMods, [{ source: 'Petrified Oak', name: 'Physical', value: 2 }]);
  assert.equal(r.defenseMods.length, 0, 'armour is not a defence');
  assert.ok(!r.attackEffects.includes(charm.effects[0]), 'armor mods never enter a pool');
  assert.ok(!r.damageEffects.includes(charm.effects[0]), 'armor mods never enter a pool');
});

test('collectCombatEffects: the selected weapon folds its woven always-on test modifiers', () => {
  // Orc Stinger at Thread Rank 4: the weave carries BOTH rank 2's +1 and rank
  // 4's +2 to Attack tests as STEP bonuses. The thread weave is stacking:"replace"
  // — rank 4 must supersede rank 2, never sum (+3): the Attack step rises by
  // exactly +2. The weave's Damage-step attack-modifier does NOT (it already
  // rides equippedWeapons.damageStep; feeding it twice would double-count).
  const weaponEffects = [
    { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' }, operation: 'add', value: 5, measure: 'step', condition: 'always', stacking: 'replace', source: 'thread', summary: 'base 5' },
    { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' }, operation: 'add', value: 7, measure: 'step', condition: 'always', stacking: 'replace', source: 'thread', summary: 'rank 3, replaces to 7' },
    { type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 1, measure: 'step', condition: 'always', stacking: 'replace', source: 'thread', summary: '+1 to Attack tests.' },
    { type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 2, measure: 'step', condition: 'always', stacking: 'replace', source: 'thread', summary: '+2 to Attack tests.' },
  ];
  const r = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [], selectedWeaponEffects: weaponEffects, rules: RULES, conditions: {} });
  const ap = attackPool({ talentStep: TALENT, effects: r.attackEffects });
  // +2 replaces +1 → the Attack step rises by exactly 2 (never +3).
  assert.equal(ap.step, TALENT + 2);
  assert.deepEqual(ap.resultMods, [], 'step-measure weave folds into step, not flat mods');
  assert.equal(ap.strain, 0);
  // The Damage attack-modifier must not leak into the damage pool (it already
  // rides weaponDamageStep downstream).
  assert.ok(!r.damageEffects.some((e) => e.type === 'attack-modifier'), 'attachment attack-modifier damage step stays out of the fold');
  // A fresh weapon with no woven effects folds nothing.
  const none = collectCombatEffects({ selectedOptions: [], selectedSituations: [], selectedCharms: [], selectedWeaponEffects: [], rules: RULES, conditions: {} });
  assert.equal(none.attackEffects.length, 0);
});

// --- foldCombatRatings (Overview-style live Defence & Armour figure) ---

test('foldCombatRatings: folds toggled mods onto the derived base for display', () => {
  const r = foldCombatRatings(
    { physicalDefense: 21, mysticDefense: 17, socialDefense: 14, physicalArmor: 10, mysticArmor: 8 },
    [
      { source: 'Aggressive Attack', name: 'Physical', value: -3 },
      { source: 'Aggressive Attack', name: 'Mystic', value: -3 },
      { source: 'Partial Cover', name: 'Physical', value: 2 },
    ],
    [{ source: 'Petrified Oak', name: 'Physical', value: 2 }],
  );
  assert.deepEqual(r.defence.Physical, { base: 21, mods: [{ source: 'Aggressive Attack', name: 'Physical', value: -3 }, { source: 'Partial Cover', name: 'Physical', value: 2 }], delta: -1, value: 20 });
  assert.deepEqual(r.defence.Mystic, { base: 17, mods: [{ source: 'Aggressive Attack', name: 'Mystic', value: -3 }], delta: -3, value: 14 });
  assert.deepEqual(r.defence.Social, { base: 14, mods: [], delta: 0, value: 14 });
  assert.deepEqual(r.armour.Physical, { base: 10, mods: [{ source: 'Petrified Oak', name: 'Physical', value: 2 }], delta: 2, value: 12 });
  assert.deepEqual(r.armour.Mystic, { base: 8, mods: [], delta: 0, value: 8 });
});

test('foldCombatRatings: no derived base → null value (placeholder-pill rule, never fabricated)', () => {
  const r = foldCombatRatings({}, [{ source: 'Aggressive Attack', name: 'Physical', value: -3 }], []);
  assert.equal(r.defence.Physical.value, null);
  assert.equal(r.defence.Mystic.value, null);
  assert.equal(r.armour.Physical.value, null);
  assert.equal(r.defence.Social.value, null);
});

// --- armedOptions gate + per-success scaling (Mystic Aim) ---------------------

const aimBundle = {
  name: 'Mystic Aim',
  effects: [
    { type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 2, measure: 'step', condition: 'on-success', perSuccess: true, source: 'talent' },
  ],
};

test('collectCombatEffects: an on-success effect is withheld until its option is armed', () => {
  const rules = { options: [aimBundle], situations: [] };
  const off = collectCombatEffects({ selectedOptions: ['Mystic Aim'], rules, conditions: {} });
  assert.ok(!off.attackEffects.some((e) => e.condition === 'on-success'), 'unarmed: withheld');
  assert.equal(attackPool({ talentStep: 10, effects: off.attackEffects }).step, 10);
});

test('collectCombatEffects: a perSuccess on-success effect scales by the success count (map)', () => {
  const rules = { options: [aimBundle], situations: [] };
  // 1 success → +2 steps; 3 successes → +6 steps. The scaled effect is flat
  // (perSuccess dropped) so the pool folds it once at the scaled value.
  const one = collectCombatEffects({ selectedOptions: ['Mystic Aim'], armedOptions: { 'Mystic Aim': 1 }, rules, conditions: {} });
  assert.equal(attackPool({ talentStep: 10, effects: one.attackEffects }).step, 12);
  const three = collectCombatEffects({ selectedOptions: ['Mystic Aim'], armedOptions: { 'Mystic Aim': 3 }, rules, conditions: {} });
  const scaled = three.attackEffects.find((e) => e.target?.name === 'Attack');
  assert.equal(scaled.value, 6);
  assert.equal(scaled.perSuccess, false);
  assert.equal(attackPool({ talentStep: 10, effects: three.attackEffects }).step, 16);
});

test('collectCombatEffects: count 0 (miss) withholds the effect', () => {
  const rules = { options: [aimBundle], situations: [] };
  const r = collectCombatEffects({ selectedOptions: ['Mystic Aim'], armedOptions: { 'Mystic Aim': 0 }, rules, conditions: {} });
  assert.equal(attackPool({ talentStep: 10, effects: r.attackEffects }).step, 10);
});

test('collectCombatEffects: a legacy name-array arms as count 1', () => {
  const rules = { options: [aimBundle], situations: [] };
  const r = collectCombatEffects({ selectedOptions: ['Mystic Aim'], armedOptions: ['Mystic Aim'], rules, conditions: {} });
  assert.equal(attackPool({ talentStep: 10, effects: r.attackEffects }).step, 12);
});

test('collectCombatEffects: armedOptions only frees the named option, not others', () => {
  const aimA = { name: 'Aim A', effects: [{ type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 2, measure: 'step', condition: 'on-success', perSuccess: true }] };
  const aimB = { name: 'Aim B', effects: [{ type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 3, measure: 'step', condition: 'on-success', perSuccess: true }] };
  const rules = { options: [aimA, aimB], situations: [] };
  const r = collectCombatEffects({ selectedOptions: ['Aim A', 'Aim B'], armedOptions: { 'Aim A': 1 }, rules, conditions: {} });
  assert.equal(attackPool({ talentStep: 10, effects: r.attackEffects }).step, 12); // only A's +2
});

test('successCount: 1 for meeting the target, +1 per 5 over, 0 on a miss', () => {
  assert.equal(successCount(10, 10), 1);
  assert.equal(successCount(14, 10), 1);
  assert.equal(successCount(15, 10), 2);
  assert.equal(successCount(20, 10), 3);
  assert.equal(successCount(9, 10), 0);
  assert.equal(successCount(null, 10), 0);
});

// --- auditPool (step-audit modal breakdown) -----------------------------------

test('auditPool: attack breakdown lists the base + step mods; step matches attackPool', () => {
  const effects = option('Aggressive Attack').effects; // +3 attack step, +3 damage step, -3/-3 def, 1 strain
  const a = auditPool([{ label: 'Melee Weapon step', value: TALENT }], effects, { testKind: 'attack' });
  assert.equal(a.step, TALENT + 3); // same as attackPool
  assert.equal(attackPool({ talentStep: TALENT, effects }).step, a.step);
  const base = a.parts.find((p) => p.kind === 'base');
  assert.deepEqual({ label: base.label, value: base.value }, { label: 'Melee Weapon step', value: TALENT });
  const step = a.parts.filter((p) => p.kind === 'step');
  assert.equal(step.length, 1);
  assert.equal(step[0].value, 3);
  // Defense mods never enter a step/roll audit; strain is not a part.
  assert.ok(!a.parts.some((p) => /Defence|Strain/i.test(p.label)));
});

test('auditPool: damage breakdown carries both bases and the success-level bonus', () => {
  const a = auditPool(
    [{ label: 'Strength step', value: STR }, { label: 'Battle Axe Damage Step', value: WEAPON }],
    [],
    { testKind: 'damage' },
    2, // two attack success levels
  );
  assert.equal(a.step, STR + WEAPON + 2);
  assert.deepEqual(a.parts.filter((p) => p.kind === 'base').map((p) => p.value), [STR, WEAPON]);
  const bonus = a.parts.find((p) => p.kind === 'step');
  assert.equal(bonus.value, 2);
  assert.equal(damagePool({ weaponDamageStep: WEAPON, strengthStep: STR, effects: [], bonusSteps: 2 }).step, a.step);
});

test('auditPool: result-measure mods are kind "result" (roll total, not the Step)', () => {
  const effects = [
    { type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, operation: 'add', value: 1, measure: 'result', condition: 'situational', summary: 'Gahad +1' },
  ];
  const a = auditPool([{ label: 'step', value: TALENT }], effects, { testKind: 'attack' });
  assert.equal(a.step, TALENT); // result mod does not change the Step
  const r = a.parts.find((p) => p.kind === 'result');
  assert.equal(r.value, 1);
});

test('auditPool: extraMods itemise a talent\'s active step buff off the base (spell fold)', () => {
  // Stealthy Stride case: base step 12, a sustained spell's +4 step already folded
  // onto the ability. The audit shows base 12 + a +4 step part summing to 16.
  const extraMods = [{ source: 'Stealthy Stride', value: 4, measure: 'step' }];
  const a = auditPool([{ label: 'Stealthy Stride step', value: 12 }], [], { testKind: 'attack' }, 0, extraMods);
  assert.equal(a.step, 16);
  const base = a.parts.find((p) => p.kind === 'base');
  assert.equal(base.value, 12);
  const step = a.parts.filter((p) => p.kind === 'step');
  assert.equal(step.length, 1);
  assert.deepEqual({ label: step[0].label, value: step[0].value }, { label: 'Stealthy Stride', value: 4 });
});

test('auditPool: a result-measure extraMod rides the roll, not the Step', () => {
  const extraMods = [{ source: 'Aim', value: 2, measure: 'result' }];
  const a = auditPool([{ label: 'step', value: 12 }], [], { testKind: 'attack' }, 0, extraMods);
  assert.equal(a.step, 12); // result mod does not change the Step
  const r = a.parts.find((p) => p.kind === 'result');
  assert.deepEqual({ label: r.label, value: r.value }, { label: 'Aim', value: 2 });
});

test('auditPool: a null base keeps step null but still lists the base part', () => {
  const a = auditPool([{ label: 'Talent step', value: null }], [], { testKind: 'attack' });
  assert.equal(a.step, null);
  assert.equal(a.parts.length, 1);
  assert.equal(a.parts[0].kind, 'base');
  assert.equal(a.parts[0].value, null);
});

// --- armed talents (Mystic Aim): session-driven fold + round countdown ---------

const AIM_EFFECT = {
  type: 'test-modifier',
  target: { domain: 'test', name: 'Attack' },
  operation: 'add',
  value: 2,
  measure: 'step',
  condition: 'on-success',
  perSuccess: true,
  source: 'talent',
};

test('collectCombatEffects folds an armed talent scaled by its success count', () => {
  const armed = [{ name: 'Mystic Aim', successes: 3, effects: [AIM_EFFECT] }];
  const { attackEffects } = collectCombatEffects({ armedTalents: armed, rules: { options: [], situations: [] } });
  // 3 successes × +2 step = +6, baked flat (perSuccess dropped) so the pool folds it.
  const e = attackEffects.find((x) => x.target?.name === 'Attack');
  assert.ok(e);
  assert.equal(e.value, 6);
  assert.equal(e.perSuccess, false);
  // The folded effect is labelled by its SOURCE (the talent name), so the step
  // audit names "Mystic Aim" rather than the effect's prose summary.
  assert.equal(e.label, 'Mystic Aim');
  // It lands on the Attack step of the pool.
  const ap = attackPool({ talentStep: 10, effects: attackEffects, activeTalent: 'Missile Weapon' });
  assert.equal(ap.step, 16);
});

test('an armed talent with 0 successes folds nothing (a miss never buffs)', () => {
  const armed = [{ name: 'Mystic Aim', successes: 0, effects: [AIM_EFFECT] }];
  const { attackEffects } = collectCombatEffects({ armedTalents: armed, rules: { options: [], situations: [] } });
  assert.equal(attackEffects.filter((x) => x.target?.name === 'Attack').length, 0);
});

test('tickArmedTalents decrements roundsLeft and drops the expired', () => {
  const armed = [
    { name: 'Mystic Aim', successes: 2, roundsLeft: 1, effects: [] },
    { name: 'Long Aim', successes: 1, roundsLeft: 3, effects: [] },
  ];
  const next = tickArmedTalents(armed);
  assert.equal(next.length, 1); // the 1-round arm expired
  assert.equal(next[0].name, 'Long Aim');
  assert.equal(next[0].roundsLeft, 2);
  // Pure: the input is untouched.
  assert.equal(armed[0].roundsLeft, 1);
});
