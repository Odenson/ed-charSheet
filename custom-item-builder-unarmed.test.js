// custom-item-builder-unarmed.test.js — unarmed weapons + single-source Damage
// Step in the custom-item builder (plans/custom-item-builder/spec.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanItemForm, damageStepEffect, isDamageStepEffect, seedDamageStep, finishEffect,
} from './ui/custom-item-builder.js';
import { validateItem } from './engine/validate-item.js';

const dmgEffect = (value = 2) => finishEffect({
  type: 'attack-modifier', operation: 'add', value, measure: 'step',
  target: { domain: 'attack', name: 'Damage' },
}, null);
const weapon = (ref = {}, effects = []) => ({ kind: 'weapon', ref, effects });
const generated = (item) => item.effects.filter(isDamageStepEffect);

// --- damageStepEffect -------------------------------------------------------
test('damageStepEffect builds the Damage attack-modifier (R3)', () => {
  const e = damageStepEffect(3);
  assert.equal(e.type, 'attack-modifier');
  assert.deepEqual(e.target, { domain: 'attack', name: 'Damage' });
  assert.equal(e.operation, 'add');
  assert.equal(e.value, 3);
  assert.equal(e.measure, 'step');
  assert.equal(e.condition, 'always');
  assert.equal(e.source, 'item');
  assert.equal(e.summary, 'Adds +3 Damage step');
});

test('damageStepEffect(0) yields a +0 effect (R4)', () => {
  const e = damageStepEffect(0);
  assert.ok(e);
  assert.equal(e.value, 0);
  assert.equal(e.summary, 'Adds +0 Damage step');
});

test('damageStepEffect returns null for empty / invalid input', () => {
  for (const bad of [undefined, '', -1, 1.5, NaN, Infinity, 'abc']) {
    assert.equal(damageStepEffect(bad), null, `null for ${String(bad)}`);
  }
});

test('isDamageStepEffect matches only attack/Damage add step', () => {
  assert.equal(isDamageStepEffect(damageStepEffect(1)), true);
  assert.equal(isDamageStepEffect({ ...damageStepEffect(1), operation: 'set' }), false);
  assert.equal(isDamageStepEffect({ ...damageStepEffect(1), measure: 'rating' }), false);
  assert.equal(isDamageStepEffect({ ...damageStepEffect(1), target: { domain: 'attack', name: 'Attack' } }), false);
  assert.equal(isDamageStepEffect({ ...damageStepEffect(1), type: 'armor-modifier' }), false);
  assert.equal(isDamageStepEffect({ type: 'note', summary: 'x' }), false);
});

// --- cleanItemForm: generation ---------------------------------------------
test('weapon with damageStep gets exactly one generated effect, first', () => {
  const hand = finishEffect({ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', target: { domain: 'armor', name: 'Physical' } }, null);
  const r = cleanItemForm('Gauntlet', weapon({ category: 'melee', damageStep: 2 }, [hand]));
  assert.equal(r.ok, true);
  assert.equal(r.item.effects.length, 2);
  assert.equal(generated(r.item).length, 1);
  assert.equal(isDamageStepEffect(r.item.effects[0]), true);
  assert.equal(r.item.effects[0].value, 2);
  assert.equal(r.item.effects[1].type, 'armor-modifier');
});

test('weapon with empty/undefined damageStep generates nothing', () => {
  for (const ref of [{ category: 'melee' }, { category: 'melee', damageStep: '' }]) {
    const r = cleanItemForm('Stick', weapon(ref));
    assert.equal(r.ok, true);
    assert.equal(generated(r.item).length, 0);
  }
});

test('damageStep 0 is kept in ref and generates a +0 effect (R4)', () => {
  const r = cleanItemForm('Glove', weapon({ category: 'unarmed', damageStep: 0 }));
  assert.equal(r.ok, true);
  assert.equal(r.item.ref.damageStep, 0);
  assert.equal(r.item.effects[0].value, 0);
});

test('strMin 0 and size 0 are still dropped, cost 0 still kept', () => {
  const r = cleanItemForm('Club', weapon({ category: 'melee', damageStep: 1, strMin: 0, size: 0, cost: 0 }));
  assert.equal(r.ok, true);
  assert.equal('strMin' in r.item.ref, false);
  assert.equal('size' in r.item.ref, false);
  assert.equal(r.item.ref.cost, 0);
});

test('invalid damageStep errors and generates no effect', () => {
  for (const bad of [-1, 1.5, NaN]) {
    const r = cleanItemForm('Bad', weapon({ category: 'melee', damageStep: bad }));
    assert.equal(r.ok, false, `rejects ${String(bad)}`);
    assert.ok(r.errors.includes('Damage Step must be a whole number of 0 or more'));
  }
});

test('hand-added Damage add-step effect is rejected with a pointer to the field', () => {
  const r = cleanItemForm('Dup', weapon({ category: 'melee', damageStep: 2 }, [dmgEffect(1)]));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('use the Damage Step field')));
});

test('hand-added Damage effect is rejected even with no damageStep set', () => {
  const r = cleanItemForm('Dup', weapon({ category: 'melee' }, [dmgEffect(1)]));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('use the Damage Step field')));
});

test('the duplicate guard error comes from the builder, not the validator', () => {
  // Same effect without the guard would be valid; confirm the item is otherwise valid.
  const item = { kind: 'weapon', ref: { category: 'melee' }, effects: [dmgEffect(1)] };
  assert.equal(validateItem('Dup', item).ok, true);
});

// --- unarmed ----------------------------------------------------------------
test('unarmed strips stale short/long range (R2)', () => {
  const r = cleanItemForm('Gauntlet', weapon({ category: 'unarmed', damageStep: 1, shortRange: '5', longRange: '10' }));
  assert.equal(r.ok, true);
  assert.equal('shortRange' in r.item.ref, false);
  assert.equal('longRange' in r.item.ref, false);
  assert.equal(r.item.ref.category, 'unarmed');
});

test('melee keeps its ranges', () => {
  const r = cleanItemForm('Spear', weapon({ category: 'melee', damageStep: 3, shortRange: '5', longRange: '10' }));
  assert.equal(r.ok, true);
  assert.equal(r.item.ref.shortRange, '5');
  assert.equal(r.item.ref.longRange, '10');
});

test('an unarmed item passes validateItem', () => {
  const r = cleanItemForm('Gauntlet', weapon({ category: 'unarmed', damageStep: 1 }));
  assert.equal(r.ok, true);
  assert.equal(validateItem('Gauntlet', r.item).ok, true);
});

// --- non-weapons ------------------------------------------------------------
test('non-weapon kinds: no generation, no guard', () => {
  const r = cleanItemForm('Charm', { kind: 'magic-item', ref: { damageStep: 2 }, effects: [dmgEffect(1)] });
  assert.equal(r.ok, true);
  assert.equal(r.item.effects.length, 1);
  assert.equal(r.item.effects[0].value, 1);
});

// --- seedDamageStep ---------------------------------------------------------
test('seed: effect only seeds the field and drops the effect', () => {
  const input = weapon({ category: 'melee' }, [dmgEffect(3)]);
  const out = seedDamageStep(input);
  assert.equal(out.ref.damageStep, 3);
  assert.equal(out.effects.length, 0);
  assert.equal(input.effects.length, 1, 'input is not mutated');
  assert.equal('damageStep' in input.ref, false);
});

test('seed: field wins over a disagreeing effect; agreeing effect dropped', () => {
  const a = seedDamageStep(weapon({ damageStep: 4 }, [dmgEffect(2)]));
  assert.equal(a.ref.damageStep, 4);
  assert.equal(a.effects.length, 0);
  const b = seedDamageStep(weapon({ damageStep: 2 }, [dmgEffect(2)]));
  assert.equal(b.ref.damageStep, 2);
  assert.equal(b.effects.length, 0);
});

test('seed: empty-string field is treated as unset', () => {
  const out = seedDamageStep(weapon({ damageStep: '' }, [dmgEffect(5)]));
  assert.equal(out.ref.damageStep, 5);
});

test('seed: field only is unchanged', () => {
  const out = seedDamageStep(weapon({ damageStep: 3 }, []));
  assert.equal(out.ref.damageStep, 3);
  assert.equal(out.effects.length, 0);
});

test('seed: two matching effects, first consumed, second stays', () => {
  const out = seedDamageStep(weapon({}, [dmgEffect(1), dmgEffect(2)]));
  assert.equal(out.ref.damageStep, 1);
  assert.equal(out.effects.length, 1);
  assert.equal(out.effects[0].value, 2);
  assert.equal(cleanItemForm('x', out).ok, false, 'leftover trips the guard');
});

test('seed: stored 0 effect seeds 0', () => {
  const out = seedDamageStep(weapon({}, [dmgEffect(0)]));
  assert.equal(out.ref.damageStep, 0);
  assert.equal(out.effects.length, 0);
});

test('seed: non-weapon returned unchanged', () => {
  const item = { kind: 'magic-item', ref: {}, effects: [dmgEffect(2)] };
  const out = seedDamageStep(item);
  assert.deepEqual(out, item);
});

test('seed then clean round-trips a legacy weapon', () => {
  const r = cleanItemForm('Old', seedDamageStep(weapon({ category: 'melee' }, [dmgEffect(0)])));
  assert.equal(r.ok, true);
  assert.equal(r.item.ref.damageStep, 0);
  assert.equal(generated(r.item).length, 1);
});
