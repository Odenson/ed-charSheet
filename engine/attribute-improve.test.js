// engine/attribute-improve.test.js — run with `npm test` (node --test, no deps).
// Pins the pure post-creation attribute improvement rules (plans/improve-attributes):
// Legend cost per +1 (800/1,300/2,100, per-step), cap +3 on `increases` only, one
// improvement per save (baseline = saved attributes), undo of the pending one, and the
// info-only training numbers. NEW-FEATURE tests: they fail until engine/attribute-improve.js exists.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextIncreaseCost,
  attributeImprovePlan,
  applyAttributeIncrease,
  undoAttributeIncrease,
  pendingAttribute,
} from './attribute-improve.js';
import { valueToStep, attributeValue } from './derive.js';
import { attributeIncreaseCost } from './legend-spent.js';

const TABLE = { 1: 800, 2: 1300, 3: 2100 }; // rules/legend.json costs.attributeIncrease (R1)
const attrs = (over = {}) => ({
  Dexterity: { base: 10, points: 4, increases: 0 },
  Strength: { base: 9, points: 2, increases: 0 },
  Toughness: { base: 11, points: 0, increases: 0 },
  Perception: { base: 10, points: 1, increases: 0 },
  Willpower: { base: 12, points: 0, increases: 0 },
  Charisma: { base: 8, points: 3, increases: 0 },
  ...over,
});
const ctx = (over = {}) => ({ costTable: TABLE, available: 10000, stepOf: valueToStep, ...over });
const clone = (o) => JSON.parse(JSON.stringify(o));

describe('nextIncreaseCost', () => {
  test('prices the next step by direct lookup: 0->800, 1->1300, 2->2100 (R1)', () => {
    assert.equal(nextIncreaseCost(0, TABLE), 800);
    assert.equal(nextIncreaseCost(1, TABLE), 1300);
    assert.equal(nextIncreaseCost(2, TABLE), 2100);
  });
  test('beyond the table (+3 reached) -> null (R2 cap)', () => {
    assert.equal(nextIncreaseCost(3, TABLE), null);
  });
  test('agrees with differences of the audit cumulative attributeIncreaseCost (R1)', () => {
    for (let i = 0; i < 3; i++) {
      assert.equal(nextIncreaseCost(i, TABLE), attributeIncreaseCost(i + 1, TABLE) - attributeIncreaseCost(i, TABLE));
    }
  });
});

describe('attributeImprovePlan', () => {
  test('ok plan: cost, new increases, current/next value+step, training info (R1, R2, R3)', () => {
    const a = attrs();
    const p = attributeImprovePlan(a, clone(a), 'Dexterity', ctx());
    assert.equal(p.ok, true);
    assert.equal(p.cost, 800);
    assert.equal(p.newIncreases, 1);
    const v = attributeValue(a.Dexterity);
    assert.equal(p.current.value, v);
    assert.equal(p.current.step, valueToStep(v));
    assert.equal(p.next.value, v + 1);
    assert.equal(p.next.step, valueToStep(v + 1));
    assert.equal(p.trainingDays, p.current.step); // R3: days = current Step
    assert.equal(p.silverFee, p.current.step * 10); // R3: Step x 10 sp/day
    assert.equal(p.weeksWait, p.next.step); // R2: weeks = NEW Step
  });
  test('Step 7 example: 7 days x 70 sp (R3)', () => {
    // Value 17 => Step 7 (valueToStep from engine/derive.js)
    const a = attrs({ Dexterity: { base: 10, points: 7, increases: 0 } });
    const p = attributeImprovePlan(a, clone(a), 'Dexterity', ctx());
    assert.equal(p.current.step, 7);
    assert.equal(p.trainingDays, 7);
    assert.equal(p.silverFee, 70);
  });
  test('second and third increase cost 1300 and 2100 (R1)', () => {
    const a = attrs({ Strength: { base: 9, points: 2, increases: 1 } });
    assert.equal(attributeImprovePlan(a, clone(a), 'Strength', ctx()).cost, 1300);
    const b = attrs({ Strength: { base: 9, points: 2, increases: 2 } });
    assert.equal(attributeImprovePlan(b, clone(b), 'Strength', ctx()).cost, 2100);
  });
  test('refusal reasons: cap, insufficient-legend, unknown-attribute, no-baseline, already-pending (R1, R2)', () => {
    const capped = attrs({ Strength: { base: 9, points: 2, increases: 3 } });
    const c = attributeImprovePlan(capped, clone(capped), 'Strength', ctx());
    assert.equal(c.ok, false);
    assert.equal(c.reason, 'cap');
    const a = attrs();
    const short = attributeImprovePlan(a, clone(a), 'Dexterity', ctx({ available: 799 }));
    assert.equal(short.ok, false);
    assert.equal(short.reason, 'insufficient-legend');
    assert.equal(attributeImprovePlan(a, clone(a), 'Luck', ctx()).reason, 'unknown-attribute');
    assert.equal(attributeImprovePlan(a, null, 'Dexterity', ctx()).reason, 'no-baseline');
    const pend = attrs({ Dexterity: { base: 10, points: 4, increases: 1 } });
    assert.equal(attributeImprovePlan(pend, attrs(), 'Strength', ctx()).reason, 'already-pending');
  });
  test('available exactly equal to cost is ok (edge)', () => {
    const a = attrs();
    assert.equal(attributeImprovePlan(a, clone(a), 'Dexterity', ctx({ available: 800 })).ok, true);
  });
});

describe('applyAttributeIncrease', () => {
  test('bumps only increases on the target; base/points and others untouched; inputs not mutated (R6)', () => {
    const a = attrs();
    const saved = clone(a);
    const before = clone(a);
    const r = applyAttributeIncrease(a, saved, 'Dexterity', ctx());
    assert.equal(r.ok, true);
    assert.deepEqual(r.attributes.Dexterity, { base: 10, points: 4, increases: 1 });
    for (const n of Object.keys(a)) if (n !== 'Dexterity') assert.deepEqual(r.attributes[n], a[n]);
    assert.notEqual(r.attributes, a);
    assert.deepEqual(a, before, 'input attributes never mutated');
    assert.deepEqual(saved, before, 'baseline never mutated');
  });
  test('creation points do not count toward the +3 cap (R4)', () => {
    const a = attrs({ Dexterity: { base: 10, points: 9, increases: 0 } });
    assert.equal(applyAttributeIncrease(a, clone(a), 'Dexterity', ctx()).ok, true);
  });
  test('at +3 increases -> cap refusal, SAME attributes reference (R2)', () => {
    const a = attrs({ Strength: { base: 9, points: 2, increases: 3 } });
    const r = applyAttributeIncrease(a, clone(a), 'Strength', ctx());
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'cap');
    assert.equal(r.attributes, a);
  });
  test('Legend short -> insufficient-legend, same reference; exactly equal succeeds (R1)', () => {
    const a = attrs();
    const r = applyAttributeIncrease(a, clone(a), 'Dexterity', ctx({ available: 799 }));
    assert.equal(r.reason, 'insufficient-legend');
    assert.equal(r.attributes, a);
    assert.equal(applyAttributeIncrease(a, clone(a), 'Dexterity', ctx({ available: 800 })).ok, true);
  });
  test('one per save: a different or the same attribute already pending -> already-pending (R2)', () => {
    const saved = attrs();
    const first = applyAttributeIncrease(saved, saved, 'Dexterity', ctx());
    const other = applyAttributeIncrease(first.attributes, saved, 'Strength', ctx());
    assert.equal(other.ok, false);
    assert.equal(other.reason, 'already-pending');
    assert.equal(other.attributes, first.attributes);
    const same = applyAttributeIncrease(first.attributes, saved, 'Dexterity', ctx());
    assert.equal(same.ok, false);
    assert.equal(same.reason, 'already-pending');
  });
  test('after a save (baseline caught up) the next increase is allowed, priced as the next step (R1)', () => {
    const afterSave = attrs({ Dexterity: { base: 10, points: 4, increases: 1 } });
    const r = applyAttributeIncrease(afterSave, clone(afterSave), 'Dexterity', ctx());
    assert.equal(r.ok, true);
    assert.equal(r.attributes.Dexterity.increases, 2);
    assert.equal(attributeImprovePlan(afterSave, clone(afterSave), 'Dexterity', ctx()).cost, 1300);
  });
  test('null baseline -> no-baseline, same reference; unknown name -> unknown-attribute', () => {
    const a = attrs();
    const r = applyAttributeIncrease(a, null, 'Dexterity', ctx());
    assert.equal(r.reason, 'no-baseline');
    assert.equal(r.attributes, a);
    assert.equal(applyAttributeIncrease(a, clone(a), 'Luck', ctx()).reason, 'unknown-attribute');
  });
});

describe('undoAttributeIncrease', () => {
  test('restores the baseline increases of the pending attribute; new object; base/points kept', () => {
    const saved = attrs();
    const pend = applyAttributeIncrease(saved, saved, 'Dexterity', ctx()).attributes;
    const r = undoAttributeIncrease(pend, saved, 'Dexterity');
    assert.equal(r.ok, true);
    assert.deepEqual(r.attributes, saved);
    assert.notEqual(r.attributes, pend);
  });
  test('nothing pending on that attribute -> nothing-to-undo, same reference; never below saved', () => {
    const saved = attrs({ Dexterity: { base: 10, points: 4, increases: 2 } });
    const r = undoAttributeIncrease(saved, saved, 'Dexterity');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'nothing-to-undo');
    assert.equal(r.attributes, saved);
  });
  test('null baseline -> no-baseline; unknown name -> unknown-attribute', () => {
    const a = attrs();
    assert.equal(undoAttributeIncrease(a, null, 'Dexterity').reason, 'no-baseline');
    assert.equal(undoAttributeIncrease(a, clone(a), 'Luck').reason, 'unknown-attribute');
  });
});

describe('pendingAttribute', () => {
  test('names the attribute whose increases exceed the baseline, else null', () => {
    const saved = attrs();
    assert.equal(pendingAttribute(saved, clone(saved)), null);
    const pend = applyAttributeIncrease(saved, saved, 'Willpower', ctx()).attributes;
    assert.equal(pendingAttribute(pend, saved), 'Willpower');
  });
});

describe('improve-attributes: rested and healthy (PG pp. 447-448)', () => {
  test('any Damage or Wounds above 0 refuses with reason damaged', () => {
    const a = attrs();
    for (const health of [{ damage: 2, wounds: 0 }, { damage: 0, wounds: 1 }, { damage: 3, wounds: 2 }]) {
      const r = applyAttributeIncrease(a, clone(a), 'Dexterity', ctx({ health }));
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'damaged');
      assert.equal(r.attributes, a);
    }
  });
  test('zero or missing health is fine', () => {
    const a = attrs();
    assert.equal(attributeImprovePlan(a, clone(a), 'Dexterity', ctx({ health: { damage: 0, wounds: 0 } })).ok, true);
    assert.equal(attributeImprovePlan(a, clone(a), 'Dexterity', ctx({ health: undefined })).ok, true);
  });
});
