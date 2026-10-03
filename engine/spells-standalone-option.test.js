// engine/spells-standalone-option.test.js — deaths-head-spell-fix.
// An extra-thread option's own sustained effect folds onto the active record
// when the base spell has no matching numeric sustained effect (Death's Head).
// Rules: plans/deaths-head-spell-fix/rules.md R1-R4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildActiveSpell,
  tickActiveSpells,
  activeSpellEffects,
  effectStepBonus,
  otherCastOutcome,
  sustainedEffectsOf,
} from './spells.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));
const dh = spellsFile.spells['Death’s Head'];
const LABEL = 'Increase Effect (+2 bonus to Frighten)';
const frighten = (a) => activeSpellEffects([a]).filter((e) =>
  e.type === 'test-modifier' && e.target?.domain === 'test' && e.target?.name === 'Frighten' && e.measure === 'step');
const sum = (list) => list.reduce((n, e) => n + e.value, 0);

// ---- data (R1-R4) ----

test('Death’s Head data: exactly one extra thread, +2 sustained Frighten step test-modifier (R2, R4)', () => {
  assert.equal(dh.extraThreads.length, 1);
  const opt = dh.extraThreads[0];
  assert.equal(opt.label, LABEL);
  assert.equal(opt.effects.length, 1);
  const e = opt.effects[0];
  assert.equal(e.type, 'test-modifier');
  assert.deepEqual(e.target, { domain: 'test', name: 'Frighten' });
  assert.equal(e.operation, 'add');
  assert.equal(e.value, 2);
  assert.equal(e.measure, 'step');
  assert.equal(e.duration, 'sustained');
  assert.ok(!e.gmDiscretion, 'must auto-apply');
  assert.ok(!e.condition || e.condition === 'always');
});

test('Death’s Head data: success level is only +2 rounds; block matches book (R1, R3)', () => {
  assert.equal(dh.successes.length, 1);
  assert.equal(dh.successes[0].label, 'Increase Duration (+2 rounds)');
  assert.equal(dh.threadsToWeave, 0);
  assert.equal(dh.circle, 2);
  assert.equal(dh.discipline, 'Nethermancer');
});

test('removed non-book labels are gone from spells.json (R2)', () => {
  const dhText = JSON.stringify(dh);
  assert.ok(!dhText.includes('Increase Range (+10 yards)'));
  assert.ok(!dhText.includes('Additional Target'));
  assert.ok(!dhText.includes('+2 Damage Step'));
});

// ---- buildActiveSpell: 0 / 1 / 2 picks (R3, R4) ----

test('buildActiveSpell: Death’s Head 0 picks -> countdown, no Frighten bonus, summary label', () => {
  const a = buildActiveSpell(dh, 5, { extraPicks: [], successLevels: 3 });
  assert.equal(a.roundsTotal, 14);
  assert.equal(a.roundsLeft, 14);
  assert.equal(sum(frighten(a)), 0);
  assert.equal(a.effectLabel, dh.summary);
});

test('buildActiveSpell: Death’s Head 1 pick -> +2 Frighten step, 14 rounds, picks recorded', () => {
  const a = buildActiveSpell(dh, 5, { extraPicks: [LABEL], successLevels: 3 });
  assert.equal(a.roundsTotal, 14);
  assert.equal(sum(frighten(a)), 2);
  assert.deepEqual(a.options.picks, [{ label: LABEL, count: 1 }]);
  assert.equal(a.options.success.mult, 2);
  for (const e of frighten(a)) assert.deepEqual(e.origin, { kind: 'spell', name: dh.name });
});

test('buildActiveSpell: Death’s Head 2 picks stack to +4 Frighten step', () => {
  const a = buildActiveSpell(dh, 5, { extraPicks: [LABEL, LABEL], successLevels: 3 });
  assert.equal(sum(frighten(a)), 4);
  assert.deepEqual(a.options.picks, [{ label: LABEL, count: 2 }]);
  assert.match(a.effectLabel, /^\+4 /);
});

test('buildActiveSpell: stale pick label contributes nothing and does not throw', () => {
  const a = buildActiveSpell(dh, 5, { extraPicks: ['Increase Range (+10 yards)'], successLevels: 1 });
  assert.equal(sum(frighten(a)), 0);
});

test('Frighten bonus is dropped when the record expires via tickActiveSpells', () => {
  let active = [buildActiveSpell(dh, 5, { extraPicks: [LABEL], successLevels: 1 })]; // 5+5 = 10 rounds
  assert.equal(active[0].roundsLeft, 10);
  assert.equal(sum(frighten(active[0])), 2);
  for (let i = 0; i < 10; i++) active = tickActiveSpells(active);
  assert.equal(active.length, 0);
  assert.equal(sum(activeSpellEffects(active).filter((e) => e.target?.name === 'Frighten')), 0);
});

// ---- no leak into the cast Effect step (R4 is a test bonus, not an Effect step) ----

test('effectStepBonus is 0 for Death’s Head regardless of picks', () => {
  assert.equal(effectStepBonus(dh, [LABEL, LABEL], 3), 0);
  assert.equal(effectStepBonus(dh, [], 3), 0);
});

test('otherCastOutcome: Death’s Head Effect output unchanged by picks', () => {
  const cast = (extraPicks) => ({ name: dh.name, target: 9, total: 14, levels: 3, extraPicks, effectTotal: null });
  const withPicks = otherCastOutcome(dh, cast([LABEL, LABEL]), { rank: 5 });
  const none = otherCastOutcome(dh, cast([]), { rank: 5 });
  assert.deepEqual(withPicks.effect, none.effect);
  assert.deepEqual(withPicks.duration, none.duration);
});

// ---- fixture: engine path independent of data ----

const fixture = {
  name: 'Fixture', discipline: 'Nethermancer', circle: 1, duration: 'Rank rounds',
  effects: [{ type: 'note', duration: 'sustained', gmDiscretion: true, summary: 'n' }],
  extraThreads: [{ label: 'Bonus', effects: [{
    type: 'test-modifier', target: { domain: 'test', name: 'Foo' }, operation: 'add',
    value: 3, measure: 'step', duration: 'sustained', source: 'spell', summary: 'Bonus',
  }] }],
  successes: [],
};

test('fixture: standalone option folds value*count and adds no Effect-step boost', () => {
  assert.equal(effectStepBonus(fixture, ['Bonus', 'Bonus'], 1), 0);
  const a = buildActiveSpell(fixture, 4, { extraPicks: ['Bonus', 'Bonus'], successLevels: 1 });
  const foo = activeSpellEffects([a]).filter((e) => e.target?.name === 'Foo');
  assert.equal(sum(foo), 6);
});

// ---- regression: existing spells with sustained option effects are not double-folded ----

test('Soul Armor: option still boosts the base effect once and is not folded again', () => {
  const sa = spellsFile.spells['Soul Armor'];
  const base = sustainedEffectsOf(sa);
  const opt = sa.extraThreads.find((t) => (t.effects ?? []).some((e) => e.duration === 'sustained'));
  const a0 = buildActiveSpell(sa, 5, { extraPicks: [], successLevels: 1 });
  const a1 = buildActiveSpell(sa, 5, { extraPicks: [opt.label], successLevels: 1 });
  assert.equal(a1.effects.length, base.length);
  assert.equal(a1.effects.length, a0.effects.length);
  const first = (a) => a.effects.find((e) => typeof e.value === 'number').value;
  assert.equal(first(a1), first(a0) + 2);
});

test('every spell: picking a sustained option whose base has a matching effect never adds a record entry', () => {
  let checked = 0;
  for (const spell of Object.values(spellsFile.spells)) {
    const base = sustainedEffectsOf(spell).filter((e) => typeof e.value === 'number');
    for (const opt of spell.extraThreads ?? []) {
      const sust = (opt.effects ?? []).filter((e) => e.duration === 'sustained');
      const matching = sust.length && sust.every((e) => base.some((b) =>
        b.type === e.type && b.target?.domain === e.target?.domain
        && b.target?.name === e.target?.name && b.measure === e.measure));
      if (!matching) continue;
      checked++;
      const a = buildActiveSpell(spell, 5, { extraPicks: [opt.label], successLevels: 1 });
      assert.equal(a.effects.length, sustainedEffectsOf(spell).length, `${spell.name}: ${opt.label}`);
    }
  }
  assert.ok(checked >= 4, 'expected Soul Armor, Soulless Eyes, Shield Mist and the Aspects');
});
