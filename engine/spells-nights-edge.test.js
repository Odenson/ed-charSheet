// engine/spells-nights-edge.test.js — run with `npm test` (node --test, no deps).
// spell-nights-edge I2/I3/I6: the Night’s Edge catalog entry (rules.md R1, R4),
// the active record's `chosen` weapon, label rule, object-stamping, the cast
// modal's pure helpers (R3, R6) and the wasted-cast log entry.
// Written red-first: these fail until the feature is built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildActiveSpell,
  activeSpellEffects,
  sustainedEffectsOf,
  isSustainedSelfEffect,
  effectReadout,
  otherCastOutcome,
  tickActiveSpells,
  appliedOptions,
  spellObjectRequirement,
  weaponOccurrence,
  castWeaponChoices,
  weaponMysticDefense,
  nextCastNumber,
  wastedCastLogEntry,
} from './spells.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));
const NE = () => spellsFile.spells['Night’s Edge']; // curly apostrophe key
const ARROW = () => spellsFile.spells['Arrow of Night'];
const OBJ = { kind: 'weapon', require: 'equipped' };
const STEP_PICK = 'Increase Effect (+2 Damage Step)';

// ---- catalog entry (R1, R4) ----

test('Night’s Edge: stat block matches the book (R1)', () => {
  const s = NE();
  assert.ok(s, 'Night’s Edge entry exists');
  assert.equal(s.discipline, 'Nethermancer');
  assert.equal(s.circle, 2);
  assert.equal(s.threadsToWeave, 0);
  assert.deepEqual(s.weavingDifficulty, { value: 6, reattune: 11 });
  assert.equal(s.castingTarget, "Target's Mystic Defense");
  assert.equal(s.range, 'Touch');
  assert.equal(s.duration, 'Rank+5 rounds');
});

test('Night’s Edge: success level and extra threads match the book (R1)', () => {
  const s = NE();
  assert.deepEqual(s.successes.map((o) => o.label), ['Increase Duration (+2 rounds)']);
  assert.deepEqual(s.extraThreads.map((o) => o.label), [STEP_PICK, 'Increase Range (+10 yards)', 'Additional Target (+Rank)']);
});

test('Night’s Edge: the +2 Damage Step extra thread is a sustained attack-modifier step with the same object (R1)', () => {
  const opt = NE().extraThreads.find((o) => o.label === STEP_PICK);
  assert.equal(opt.effects.length, 1);
  const e = opt.effects[0];
  assert.equal(e.type, 'attack-modifier');
  assert.deepEqual(e.target, { domain: 'attack', name: 'Damage' });
  assert.equal(e.operation, 'add');
  assert.equal(e.value, 2);
  assert.equal(e.measure, 'step');
  assert.equal(e.duration, 'sustained');
  assert.deepEqual(e.object, OBJ);
});

test('Night’s Edge: base effect is a sustained D4 dice attack-modifier on the equipped weapon, not gmDiscretion (R1, R2, R3)', () => {
  const s = NE();
  const dice = s.effects.find((e) => e.measure === 'dice');
  assert.ok(dice, 'has a dice effect');
  assert.equal(dice.type, 'attack-modifier');
  assert.deepEqual(dice.target, { domain: 'attack', name: 'Damage' });
  assert.equal(dice.operation, 'add');
  assert.equal(dice.value, 'D4');
  assert.equal(dice.duration, 'sustained');
  assert.equal(dice.source, 'spell');
  assert.deepEqual(dice.object, OBJ);
  assert.ok(!dice.gmDiscretion, 'must not be gmDiscretion or sustainedEffectsOf drops it');
  assert.equal(sustainedEffectsOf(s).length, 1);
  assert.equal(isSustainedSelfEffect(s), true);
});

test('Night’s Edge: the -2 Mystic Defense rider is a gmDiscretion note that never folds (R4)', () => {
  const notes = NE().effects.filter((e) => e.type === 'note');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].gmDiscretion, true);
  assert.ok(!sustainedEffectsOf(NE()).some((e) => e.type === 'note'));
  assert.equal(NE().effects.length, 2);
});

test('Night’s Edge: summary is no longer the truncated stub', () => {
  const s = NE().summary;
  assert.ok(typeof s === 'string' && s.length > 0);
  assert.ok(!/reduces target’s$/.test(s), 'truncated summary fixed');
});

// ---- option counts (spells-options regression for this entry) ----

test('Night’s Edge options: 2 successes apply the duration success once; the step pick is listed', () => {
  const o = appliedOptions(NE(), [STEP_PICK], 2);
  assert.deepEqual(o.picks, [{ label: STEP_PICK, count: 1 }]);
  assert.deepEqual(o.success, { label: 'Increase Duration (+2 rounds)', mult: 1 });
});

// ---- spellObjectRequirement ----

test('spellObjectRequirement: returns the sustained effects’ object, null for spells without one', () => {
  assert.deepEqual(spellObjectRequirement(NE()), OBJ);
  assert.equal(spellObjectRequirement(ARROW()), null);
  assert.equal(spellObjectRequirement({ effects: [] }), null);
  assert.equal(spellObjectRequirement({}), null);
});

// ---- weaponOccurrence ----

test('weaponOccurrence: 0-based index among equipped items of the same name ([Spear, Sword, Spear] -> 0, 0, 1)', () => {
  const list = [{ name: 'Spear' }, { name: 'Sword' }, { name: 'Spear' }];
  assert.equal(weaponOccurrence(list, list[0]), 0);
  assert.equal(weaponOccurrence(list, list[1]), 0);
  assert.equal(weaponOccurrence(list, list[2]), 1);
});

test('weaponOccurrence: unequipping an earlier same-name item shifts indices (accepted, documented)', () => {
  const list = [{ name: 'Spear' }, { name: 'Sword' }, { name: 'Spear' }];
  const after = [list[1], list[2]];
  assert.equal(weaponOccurrence(after, list[2]), 0);
});

// ---- buildActiveSpell / chosen / label ----

test('buildActiveSpell: ctx.object becomes record.chosen {name, index}; a dice effect is recorded', () => {
  const rec = buildActiveSpell(NE(), 3, { object: { name: 'Spear', index: 1 } });
  assert.deepEqual(rec.chosen, { name: 'Spear', index: 1 });
  assert.equal(rec.name, 'Night’s Edge');
  assert.equal(rec.effects.length, 1);
  assert.equal(rec.effects[0].measure, 'dice');
  assert.equal(rec.effects[0].value, 'D4', 'a string value is never boosted or coerced');
  assert.ok(!('object' in rec), 'the record carries chosen, not object');
});

test('buildActiveSpell: duration is Rank+5 rounds; each extra success adds 2 (R1)', () => {
  const rec = buildActiveSpell(NE(), 3, { object: { name: 'Spear', index: 0 } });
  assert.equal(rec.roundsLeft, 8);
  assert.equal(rec.roundsTotal, 8);
  const more = buildActiveSpell(NE(), 3, { object: { name: 'Spear', index: 0 }, successLevels: 3 });
  assert.equal(more.roundsLeft, 12);
  assert.equal(tickActiveSpells([rec])[0].roundsLeft, 7, 'countdown untouched');
});

test('buildActiveSpell: the +2 Damage Step pick is a standalone step effect with the same object', () => {
  const rec = buildActiveSpell(NE(), 3, { extraPicks: [STEP_PICK], object: { name: 'Spear', index: 0 } });
  assert.equal(rec.effects.length, 2);
  const dice = rec.effects.find((e) => e.measure === 'dice');
  const step = rec.effects.find((e) => e.measure === 'step');
  assert.equal(dice.value, 'D4', 'the D4 is not boosted by the step pick');
  assert.equal(step.value, 2);
  assert.deepEqual(step.object, OBJ);
  assert.deepEqual(step.target, { domain: 'attack', name: 'Damage' });
});

test('effectLabel: "+D4 Damage" without the pick, "+D4 Damage, +2 Damage Step" with it', () => {
  assert.equal(buildActiveSpell(NE(), 3, { object: { name: 'S', index: 0 } }).effectLabel, '+D4 Damage');
  assert.equal(buildActiveSpell(NE(), 3).effectLabel, '+D4 Damage', 'no object in ctx still uses the dice label, not the summary');
  assert.equal(
    buildActiveSpell(NE(), 3, { extraPicks: [STEP_PICK], object: { name: 'S', index: 0 } }).effectLabel,
    '+D4 Damage, +2 Damage Step',
  );
});

test('Arrow of Night regression: no ctx.object -> no chosen, unchanged label and value', () => {
  const rec = buildActiveSpell(ARROW(), 3, {});
  assert.ok(!('chosen' in rec) || rec.chosen == null);
  assert.equal(rec.effectLabel, '+6 Damage step');
  assert.equal(rec.effects[0].value, 6);
  const fx = activeSpellEffects([rec]);
  assert.equal(fx.length, 1);
  assert.ok(!('chosen' in fx[0]) && !('object' in fx[0]));
});

// ---- activeSpellEffects stamping ----

test('activeSpellEffects: object-bearing effects get object (unchanged) + chosen; others get neither', () => {
  const rec = buildActiveSpell(NE(), 3, { extraPicks: [STEP_PICK], object: { name: 'Spear', index: 1 } });
  const withPlain = { ...rec, effects: [...rec.effects, { type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' }, operation: 'add', value: 1, measure: 'rating', duration: 'sustained', source: 'spell' }] };
  const fx = activeSpellEffects([withPlain]);
  assert.equal(fx.length, 3);
  for (const e of fx.filter((x) => x.type === 'attack-modifier')) {
    assert.deepEqual(e.object, OBJ);
    assert.deepEqual(e.chosen, { name: 'Spear', index: 1 });
    assert.deepEqual(e.origin, { kind: 'spell', name: 'Night’s Edge' });
  }
  const plain = fx.find((x) => x.type === 'armor-modifier');
  assert.ok(!('chosen' in plain) && !('object' in plain));
});

// ---- castWeaponChoices (R3) ----
// Contract assumption: ctx = { spell, equippedWeapons } (spec gives `ctx` only).

test('castWeaponChoices: unique names -> plain labels, index 0', () => {
  const r = castWeaponChoices({ spell: NE(), equippedWeapons: [{ name: 'Spear', category: 'melee' }, { name: 'Longbow', category: 'missile' }] });
  assert.equal(r.empty, false);
  assert.deepEqual(r.choices, [
    { name: 'Spear', index: 0, label: 'Spear' },
    { name: 'Longbow', index: 0, label: 'Longbow' },
  ]);
});

test('castWeaponChoices: duplicates are labelled Spear / Spear (2nd) / Spear (3rd) with indices 0/1/2', () => {
  const w = [{ name: 'Spear', category: 'melee' }, { name: 'Sword', category: 'melee' }, { name: 'Spear', category: 'melee' }, { name: 'Spear', category: 'melee' }];
  const r = castWeaponChoices({ spell: NE(), equippedWeapons: w });
  assert.deepEqual(r.choices.map((c) => [c.name, c.index, c.label]), [
    ['Spear', 0, 'Spear'],
    ['Sword', 0, 'Sword'],
    ['Spear', 1, 'Spear (2nd)'],
    ['Spear', 2, 'Spear (3rd)'],
  ]);
});

test('castWeaponChoices: any weapon type qualifies for kind "weapon" (R3)', () => {
  const r = castWeaponChoices({ spell: NE(), equippedWeapons: [{ name: 'Bow', category: 'missile' }, { name: 'Axe', category: 'melee' }] });
  assert.equal(r.choices.length, 2);
});

test('castWeaponChoices: no equipped weapon -> empty with reason "No equipped weapon"', () => {
  const r = castWeaponChoices({ spell: NE(), equippedWeapons: [] });
  assert.equal(r.empty, true);
  assert.equal(r.reason, 'No equipped weapon');
  assert.deepEqual(r.choices, []);
});

test('castWeaponChoices: kind that matches nothing is empty (melee-weapon vs missile only)', () => {
  const spell = { name: 'X', effects: [{ type: 'attack-modifier', duration: 'sustained', object: { kind: 'melee-weapon', require: 'equipped' } }] };
  const r = castWeaponChoices({ spell, equippedWeapons: [{ name: 'Bow', category: 'missile' }] });
  assert.equal(r.empty, true);
  assert.equal(r.reason, 'No equipped weapon');
  const ok = castWeaponChoices({ spell, equippedWeapons: [{ name: 'Bow', category: 'missile' }, { name: 'Axe', category: 'melee' }] });
  assert.deepEqual(ok.choices.map((c) => c.name), ['Axe']);
});

test('castWeaponChoices: a spell without an object is never empty', () => {
  for (const eq of [[], [{ name: 'Spear', category: 'melee' }]]) {
    assert.equal(castWeaponChoices({ spell: ARROW(), equippedWeapons: eq }).empty, false);
  }
});

// ---- weaponMysticDefense (R6) ----

test('weaponMysticDefense: a thread weapon uses its numeric mysticDefense; ordinary weapon gives 2; no weapon null (R6)', () => {
  assert.equal(weaponMysticDefense({ name: 'Orc Stinger', mysticDefense: 10 }), 10);
  assert.equal(weaponMysticDefense({ name: 'Broadsword', mysticDefense: null }), 2);
  assert.equal(weaponMysticDefense({ name: 'Broadsword' }), 2);
  assert.equal(weaponMysticDefense({ name: 'Weird', mysticDefense: 'high' }), 2, 'non-number falls back to 2');
  assert.equal(weaponMysticDefense(null), null);
  assert.equal(weaponMysticDefense(undefined), null);
});

// ---- nextCastNumber (R6 touched rule) ----

test('nextCastNumber: untouched + weapon change re-prefills from the weapon (R6)', () => {
  assert.equal(nextCastNumber({ current: 2, touched: false, weapon: { name: 'Orc Stinger', mysticDefense: 10 } }), 10);
  assert.equal(nextCastNumber({ current: 10, touched: false, weapon: { name: 'Broadsword' } }), 2);
});

test('nextCastNumber: touched keeps the user’s value across weapon changes', () => {
  assert.equal(nextCastNumber({ current: 7, touched: true, weapon: { name: 'Orc Stinger', mysticDefense: 10 } }), 7);
  assert.equal(nextCastNumber({ current: 7, touched: true, weapon: null }), 7);
});

test('nextCastNumber: no weapon and untouched gives null', () => {
  assert.equal(nextCastNumber({ current: 5, touched: false, weapon: null }), null);
});

// ---- wastedCastLogEntry ----

test('wastedCastLogEntry: null step/total, empty dice, outcome Wasted, label names spell and reason', () => {
  const e = wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'r1', at: 1234 });
  assert.equal(e.label, 'Cast — Night’s Edge (wasted: no equipped weapon)');
  assert.equal(e.total, null);
  assert.equal(e.step, null);
  assert.deepEqual(e.dice, []);
  assert.deepEqual(e.outcome, { word: 'Wasted', ok: false });
  assert.equal(e.rollId, 'r1');
});

test('wastedCastLogEntry: distinct rollIds give distinct entries', () => {
  const a = wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'a', at: 1 });
  const b = wastedCastLogEntry({ spellName: 'Night’s Edge', rollId: 'b', at: 1 });
  assert.notEqual(a.rollId, b.rollId);
});

// ---- Target effects text (cast on Other) ----

test('effectReadout: Night’s Edge has no Effect roll (kind is not "step") and never yields NaN', () => {
  const r = effectReadout({ attrStep: {} }, NE());
  assert.notEqual(r.kind, 'step');
  assert.ok(!/NaN/.test(JSON.stringify(r)));
});

test('otherCastOutcome: the D4 renders in the Target effects text; no NaN/undefined', () => {
  const cast = { seq: 1, name: 'Night’s Edge', target: 9, total: 14, levels: 1, extraPicks: [], effectTotal: null };
  const o = otherCastOutcome(NE(), cast, { rank: 3 });
  assert.ok(o.hit);
  assert.match(o.text, /D4/);
  assert.ok(!/NaN|undefined/.test(o.text), o.text);
});
