// engine/shadow-meld.test.js — run with `npm test` (node --test, no deps).
// Pins the Shadow Meld entry in rules/spells.json (PG p. 321) against the
// existing active-spell fold: success level, two extra threads, the always-on
// Stealthy Stride bonus, and the default-skill note.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildActiveSpell, appliedOptions, boostedDuration, sustainedEffectsOf } from './spells.js';
import { autoApplies } from './characteristics.js';

const spell = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url), 'utf8')).spells['Shadow Meld'];

const DUR = 'Increase Duration (+2 minutes)';
const EFFECT = 'Increase Effect (+2 Stealthy Stride)';
const isStride = (e) => e.type === 'test-modifier' && e.target?.domain === 'test' && e.target?.name === 'Stealthy Stride';

test('unchanged base facts (R1)', () => {
  assert.equal(spell.circle, 1);
  assert.equal(spell.threadsToWeave, 1);
  assert.equal(spell.weavingDifficulty.value, 5);
  assert.equal(spell.weavingDifficulty.reattune, 10);
  assert.equal(spell.castingTarget, "Target's Mystic Defense");
  assert.equal(spell.range, 'Touch');
  assert.equal(spell.duration, 'Rank minutes');
  assert.equal(spell.area, null);
});

test('success level: one per-success Increase Duration (+2 minutes) (R2)', () => {
  assert.equal(spell.successes.length, 1);
  const s = spell.successes[0];
  assert.equal(s.label, DUR);
  const fx = s.effects.find((e) => e.type === 'duration-modifier');
  assert.ok(fx);
  assert.equal(fx.operation, 'add');
  assert.equal(fx.value, 2);
  assert.equal(fx.measure, 'minutes');
  assert.equal(fx.condition, 'on-success');
  assert.equal(fx.perSuccess, true);
});

test('extra threads: Increase Duration and Increase Effect, in order (R3)', () => {
  assert.deepEqual(spell.extraThreads.map((t) => t.label), [DUR, EFFECT]);
  const d = spell.extraThreads[0].effects.find((e) => e.type === 'duration-modifier');
  assert.equal(d.operation, 'add');
  assert.equal(d.value, 2);
  assert.equal(d.measure, 'minutes');
  assert.equal(d.duration, undefined);
});

test('Increase Effect matches the base effect target/measure/duration (R3)', () => {
  const base = spell.effects.find(isStride);
  const opt = spell.extraThreads[1].effects.find(isStride);
  assert.ok(base && opt);
  assert.equal(base.value, 4);
  assert.equal(opt.value, 2);
  assert.equal(opt.operation, 'add');
  for (const k of ['measure', 'duration']) assert.equal(opt[k], base[k]);
  assert.equal(base.measure, 'step');
  assert.equal(base.duration, 'sustained');
  assert.deepEqual(opt.target, base.target);
});

test('base and Increase Effect effects are always-on rolled-in modifiers (R4)', () => {
  const base = spell.effects.find(isStride);
  const opt = spell.extraThreads[1].effects.find(isStride);
  assert.equal(base.condition, 'always');
  assert.equal(opt.condition, 'always');
  assert.ok(autoApplies(base));
  assert.ok(autoApplies(opt));
});

test('default-skill note effect exists, is non-sustained and not gm-gated for folding (R6)', () => {
  const note = spell.effects.find((e) => e.type === 'note');
  assert.ok(note);
  assert.match(note.summary, /Stealthy Stride/);
  assert.match(note.summary, /default/i);
  assert.notEqual(note.duration, 'sustained');
});

test('description and summary state the book facts (R1, R4, R6)', () => {
  const d = spell.description;
  assert.match(d, /near shadows?/i);
  assert.match(d, /default skill/i);
  assert.match(d, /light/i);
  assert.match(d, /\+4/);
  assert.ok(spell.summary && spell.summary.length > 0);
});

test('sustainedEffectsOf returns only the +4 effect; note is excluded (R6)', () => {
  const s = sustainedEffectsOf(spell);
  assert.equal(s.length, 1);
  assert.equal(s[0].value, 4);
  assert.ok(isStride(s[0]));
});

test('no options: rank-1 baseline is 10 rounds, +4, note not in active record (R1)', () => {
  const a = buildActiveSpell(spell, 1, {});
  assert.equal(a.roundsTotal, 10);
  const stride = a.effects.filter(isStride);
  assert.equal(stride.length, 1);
  assert.equal(stride[0].value, 4);
  assert.ok(!a.effects.some((e) => e.type === 'note'));
});

test('successLevels 1 gives no duration boost (R2)', () => {
  assert.equal(buildActiveSpell(spell, 1, { successLevels: 1 }).roundsTotal, 10);
  assert.equal(buildActiveSpell(spell, 1, { successLevels: 0 }).roundsTotal, 10);
});

test('successLevels 2 adds +2 minutes = +20 rounds (R2)', () => {
  const a = buildActiveSpell(spell, 1, { successLevels: 2 });
  assert.equal(a.roundsTotal, 30);
  assert.deepEqual(appliedOptions(spell, [], 2).success, { label: DUR, mult: 1 });
});

test('successLevels 3 adds +4 minutes = +40 rounds (R2)', () => {
  assert.equal(buildActiveSpell(spell, 1, { successLevels: 3 }).roundsTotal, 50);
});

test('Increase Duration thread adds +20 rounds, and no standalone effect (R3)', () => {
  const a = buildActiveSpell(spell, 1, { extraPicks: [DUR] });
  assert.equal(a.roundsTotal, 30);
  assert.equal(a.effects.filter(isStride).length, 1);
  assert.equal(a.effects.filter(isStride)[0].value, 4);
});

test('success level and duration thread stack (R2, R3)', () => {
  assert.equal(buildActiveSpell(spell, 1, { extraPicks: [DUR], successLevels: 2 }).roundsTotal, 50);
});

test('one Increase Effect pick: single Stealthy Stride effect of +6, duration unchanged (R3)', () => {
  const a = buildActiveSpell(spell, 1, { extraPicks: [EFFECT] });
  const stride = a.effects.filter(isStride);
  assert.equal(stride.length, 1);
  assert.equal(stride[0].value, 6);
  assert.equal(a.roundsTotal, 10);
});

test('two Increase Effect picks: one effect of +8, no duplicate (R3)', () => {
  const a = buildActiveSpell(spell, 1, { extraPicks: [EFFECT, EFFECT] });
  const stride = a.effects.filter(isStride);
  assert.equal(stride.length, 1);
  assert.equal(stride[0].value, 8);
});

test('mixed picks fold both boosts (R3)', () => {
  const a = buildActiveSpell(spell, 1, { extraPicks: [EFFECT, DUR] });
  assert.equal(a.effects.filter(isStride)[0].value, 6);
  assert.equal(a.roundsTotal, 30);
});

test('boostedDuration reflects +20 rounds at rank 1 (R2)', () => {
  assert.equal(boostedDuration(spell, 1, 20).rounds, 30);
});
