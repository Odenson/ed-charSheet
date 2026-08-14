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
  assert.equal(cleaned[0].summary, 'Adds +1 Action Test result');
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
