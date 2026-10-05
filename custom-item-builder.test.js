// custom-item-builder.test.js — regression tests for the pure custom-item form
// builders (ui/custom-item-builder.js). Two bugs pinned here (plans/PLAN-CUSTOM-
// ITEMS.md §6.6):
//   1. Effects were silently dropped on save. A type change reset the row via
//      blankEffect(newType) whose summary is '' and the old clean step filtered
//      out every summary-less row — so changing an effect's type erased it from
//      the saved file (every saved custom item landed with effects: []).
//   2. The form had no way to author presentation.shortEffect, and nothing
//      enforced its length.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEffects, cleanItemForm, blankEffect, finishEffect, summaryFor,
} from './ui/custom-item-builder.js';

const physical = () => ({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' } });

test('a type change cannot blank an effect out of the saved item', () => {
  // Reproduction of the shipped bug: add a row, change its type. The old code
  // reset the summary to '' and the clean step dropped the row entirely.
  const added = finishEffect(physical(), null);
  const changed = { ...added, ...blankEffect('attack-modifier'), value: 2 };
  changed.summary = summaryFor(changed); // what _setEffect now does after the reset
  const { ok, item } = cleanItemForm('Mug', { kind: 'magic-item', effects: [changed], ref: { cost: 5 } });
  assert.equal(ok, true);
  assert.equal(item.effects.length, 1, 'the effect survives the clean step');
  assert.equal(item.effects[0].summary, 'Adds +2 Damage step');
  assert.equal(item.effects[0].source, 'item');
});

test('cleanEffects auto-fills a blank summary instead of dropping the effect', () => {
  const blank = blankEffect('test-modifier'); // summary: '' — the type-change reset state
  blank.target = { domain: 'test', name: 'Action' };
  const cleaned = cleanEffects([blank]);
  assert.equal(cleaned.length, 1, 'a summary-less row is never filtered out');
  assert.equal(cleaned[0].summary, 'Adds +1 Action Test step');
});

test('cleanEffects strips the transient _openTarget flag', () => {
  const e = { ...finishEffect(physical(), null), _openTarget: true };
  const cleaned = cleanEffects([e]);
  assert.equal('_openTarget' in cleaned[0], false);
  assert.equal(cleaned[0].summary, 'Adds +1 Physical Armour');
});

test('summaryFor formats add / subtract / set and non-rating measures', () => {
  assert.equal(summaryFor({ type: 'attack-modifier', operation: 'add', value: 2, target: { name: 'Damage' } }), 'Adds +2 Damage');
  assert.equal(summaryFor({ type: 'characteristic-modifier', operation: 'subtract', value: 1, measure: 'step', target: { name: 'Initiative' } }), 'Reduces Initiative by 1 step');
  assert.equal(summaryFor({ type: 'test-modifier', operation: 'add', value: 1, measure: 'result', target: { name: 'Action' } }), 'Adds +1 Action Test result');
  assert.equal(summaryFor({ type: 'attribute-modifier', operation: 'set', value: 4, measure: 'value', target: { name: 'Dexterity' } }), 'Sets Dexterity to 4 value');
});

test('finishEffect stamps source:item, defaults condition, auto-summarises', () => {
  const e = finishEffect(physical(), null);
  assert.equal(e.source, 'item');
  assert.equal(e.condition, 'always');
  assert.equal(e.summary, 'Adds +1 Physical Armour');
  assert.equal(finishEffect(physical(), 'My label').summary, 'My label');
});

test('cleanItemForm persists presentation.shortEffect only when non-empty', () => {
  const base = { kind: 'gear', effects: [] };
  const withShort = cleanItemForm('Rope', { ...base, presentation: { shortEffect: '   Holds ~50 lb   ' } });
  assert.equal(withShort.ok, true);
  assert.deepEqual(withShort.item.presentation, { shortEffect: 'Holds ~50 lb' });
  const without = cleanItemForm('Rope', { ...base, presentation: { shortEffect: '   ' } });
  assert.equal(without.ok, true);
  assert.equal(without.item.presentation, undefined, 'whitespace-only shortEffect is not persisted');
});

test('cleanItemForm keeps a valid ref and drops transient empties', () => {
  const { ok, item } = cleanItemForm('Mug', {
    kind: 'magic-item',
    effects: [],
    ref: { cost: 0, weight: '', availability: 'Very Rare', range: 'Touch', shortRange: undefined },
  });
  assert.equal(ok, true);
  assert.deepEqual(item.ref, { cost: 0, availability: 'Very Rare', range: 'Touch' }, 'cost 0 is kept, empties are dropped');
});

test('cleanItemForm surfaces validation errors instead of silently dropping rows', () => {
  const r = cleanItemForm('Bad', { kind: 'gear', effects: [{ type: 'note', summary: '' }] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('note requires a summary')));
});

test('cleanItemForm requires a name', () => {
  const r = cleanItemForm('   ', { kind: 'gear', effects: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('Name is required.'));
});

// --- T-006: the builder only produces measures the engine folds -------------------------
import { measuresFor, defaultMeasure, reconcileMeasure } from './ui/custom-item-builder.js';
import { validateItem } from './engine/validate-item.js';
import { initiative, recoveryTests, makeCharacteristics } from './engine/characteristics.js';
import { readFileSync } from 'node:fs';

test('defaults: Initiative → step, other characteristics → rating, test bonuses → step', () => {
  assert.equal(defaultMeasure('characteristic-modifier', 'Initiative'), 'step');
  for (const n of ['WoundThreshold', 'DeathRating', 'UnconsciousnessRating', 'RecoveryTests', 'Movement', 'CarryingCapacity']) {
    assert.equal(defaultMeasure('characteristic-modifier', n), 'rating', n);
  }
  assert.equal(defaultMeasure('test-modifier', 'Attack'), 'step');
  assert.equal(defaultMeasure('attack-modifier', 'Damage'), 'step');
  assert.equal(defaultMeasure('attribute-modifier', 'Strength'), 'value');
  assert.equal(defaultMeasure('armor-modifier', 'Physical'), 'rating');
  assert.equal(measuresFor('note', null), null);
});

test('a blank characteristic effect is born with a measure that folds (no more silent rating-for-Initiative)', () => {
  const b = blankEffect('characteristic-modifier');
  assert.equal(b.target.name, 'WoundThreshold');
  assert.equal(b.measure, 'rating');
  assert.equal(blankEffect('test-modifier').measure, 'step');
});

test('reconcileMeasure: switching target keeps a still-valid measure, else takes the new default', () => {
  assert.equal(reconcileMeasure('characteristic-modifier', 'Initiative', 'rating'), 'step');
  assert.equal(reconcileMeasure('characteristic-modifier', 'DeathRating', 'step'), 'rating');
  assert.equal(reconcileMeasure('test-modifier', 'Damage', 'result'), 'result', 'result is still valid for a test bonus');
  assert.equal(reconcileMeasure('note', null, undefined), undefined);
});

test('the dropdown path now yields an Initiative effect the engine folds', () => {
  const e = blankEffect('characteristic-modifier');
  e.target = { domain: 'characteristic', name: 'Initiative' };
  e.measure = reconcileMeasure(e.type, 'Initiative', e.measure);
  e.operation = 'subtract';
  const fx = finishEffect(e);
  assert.equal(fx.summary, 'Reduces Initiative by 1 step');
  assert.equal(validateItem('Ring', { kind: 'magic-item', effects: [fx], ref: {} }).ok, true);
  assert.equal(initiative(8, [fx]).value, 7);
});

test('validateItem rejects a measure the engine would ignore, naming the allowed ones', () => {
  const item = (effect) => ({ kind: 'magic-item', effects: [{ condition: 'always', source: 'item', summary: 's', operation: 'add', value: 1, ...effect }], ref: {} });
  const ini = { type: 'characteristic-modifier', target: { domain: 'characteristic', name: 'Initiative' } };
  const r = validateItem('Ring', item({ ...ini, measure: 'rating' }));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /not valid for characteristic-modifier on Initiative \(use step\)/);
  assert.equal(validateItem('Ring', item({ ...ini, measure: 'step' })).ok, true);
  assert.equal(validateItem('Ring', item({ type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, measure: 'step' })).ok, false);
  assert.equal(validateItem('Ring', item({ type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, measure: 'rating' })).ok, false);
  assert.equal(validateItem('Ring', item({ type: 'test-modifier', target: { domain: 'test', name: 'Attack' }, measure: 'result' })).ok, true);
  assert.equal(validateItem('Ring', item({ type: 'attribute-modifier', target: { domain: 'attribute', name: 'Perception' }, measure: 'step' })).ok, true);
  assert.equal(validateItem('Ring', item({ ...ini })).ok, true, 'an absent measure is left to the engine default');
});

test('RecoveryTests built with the default measure folds (T-003)', () => {
  const lookup = makeCharacteristics(JSON.parse(readFileSync(new URL('./rules/characteristics.json', import.meta.url))));
  const e = blankEffect('characteristic-modifier');
  e.target = { domain: 'characteristic', name: 'RecoveryTests' };
  assert.equal(recoveryTests(17, [finishEffect(e)], lookup).value, 4);
});
