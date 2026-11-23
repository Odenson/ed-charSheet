// ui/attribute-improve-state.test.js — run with `npm test` (node --test, no deps).
// Pins the pure view-state behind the Overview `+` (plans/improve-attributes): which rows show
// an Improve control, which are disabled (with a reason title), and the pending/undo row.
// NEW-FEATURE tests: fail until ui/attribute-improve-state.js exists. The spec fixes the per-row
// fields {show, canImprove, pending, title} but not the container shape, so rowOf() accepts
// view.rows[name], view[name], or an array of rows carrying `name`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { attributeImproveView } from './attribute-improve-state.js';

const TABLE = { 1: 800, 2: 1300, 3: 2100 }; // R1
const attrs = (over = {}) => ({
  Dexterity: { base: 10, points: 4, increases: 0 },
  Strength: { base: 9, points: 2, increases: 0 },
  Toughness: { base: 11, points: 0, increases: 0 },
  Perception: { base: 10, points: 1, increases: 0 },
  Willpower: { base: 12, points: 0, increases: 0 },
  Charisma: { base: 8, points: 3, increases: 0 },
  ...over,
});
const clone = (o) => JSON.parse(JSON.stringify(o));
const view = (o = {}) => {
  const a = o.attributes ?? attrs();
  return attributeImproveView({
    attributes: a,
    savedAttributes: 'savedAttributes' in o ? o.savedAttributes : clone(a),
    available: 'available' in o ? o.available : 5000,
    costTable: TABLE,
    editMode: 'editMode' in o ? o.editMode : true,
    creationOpen: !!o.creationOpen,
    health: o.health,
  });
};
const rowOf = (v, name) => {
  const rows = v?.rows ?? v;
  if (Array.isArray(rows)) return rows.find((r) => r.name === name);
  return rows?.[name];
};

describe('attributeImproveView rows', () => {
  test('edit mode, saved, enough Legend: every row shows an enabled +', () => {
    const v = view();
    for (const n of Object.keys(attrs())) {
      const r = rowOf(v, n);
      assert.equal(r.show, true, n);
      assert.equal(r.canImprove, true, n);
      assert.equal(!!r.pending, false, n);
    }
  });
  test('edit mode off -> nothing shown', () => {
    assert.equal(rowOf(view({ editMode: false }), 'Dexterity').show, false);
  });
  test('creation open -> nothing shown (creation stepper owns the tile)', () => {
    assert.equal(rowOf(view({ creationOpen: true }), 'Dexterity').show, false);
  });
  test('null baseline (draft / unsaved) -> nothing shown', () => {
    assert.equal(rowOf(view({ savedAttributes: null }), 'Dexterity').show, false);
  });
  test('+3 attribute -> hidden (cap, R2); others still shown', () => {
    const a = attrs({ Strength: { base: 9, points: 2, increases: 3 } });
    const v = view({ attributes: a });
    assert.equal(rowOf(v, 'Strength').show, false);
    assert.equal(rowOf(v, 'Dexterity').show, true);
  });
  test('Legend short -> shown but disabled with a reason title; exactly enough is enabled (R1)', () => {
    const short = rowOf(view({ available: 799 }), 'Dexterity');
    assert.equal(short.show, true);
    assert.equal(short.canImprove, false);
    assert.ok(typeof short.title === 'string' && short.title.length > 0);
    assert.equal(rowOf(view({ available: 800 }), 'Dexterity').canImprove, true);
  });
  test('another attribute pending -> the rest disabled with a title; pending row flagged for undo (R2)', () => {
    const saved = attrs();
    const pend = attrs({ Dexterity: { base: 10, points: 4, increases: 1 } });
    const v = view({ attributes: pend, savedAttributes: saved });
    const dex = rowOf(v, 'Dexterity');
    assert.equal(dex.pending, true);
    assert.equal(dex.show, true);
    const str = rowOf(v, 'Strength');
    assert.equal(str.show, true);
    assert.equal(str.canImprove, false);
    assert.ok(typeof str.title === 'string' && str.title.length > 0);
  });
  test('does not mutate its inputs', () => {
    const a = attrs();
    const s = clone(a);
    const before = clone(a);
    view({ attributes: a, savedAttributes: s });
    assert.deepEqual(a, before);
    assert.deepEqual(s, before);
  });
});

describe('attributeImproveView: rested and healthy', () => {
  test('Damage or Wounds above 0 disables every + with a reason title', () => {
    for (const health of [{ damage: 2, wounds: 0 }, { damage: 0, wounds: 1 }]) {
      const v = view({ health });
      for (const name of ['Dexterity', 'Strength']) {
        const r = rowOf(v, name);
        assert.equal(r.show, true);
        assert.equal(r.canImprove, false);
        assert.match(r.title, /rested and healthy/i);
      }
    }
  });
  test('no Damage or Wounds leaves + enabled', () => {
    assert.equal(rowOf(view({ health: { damage: 0, wounds: 0 } }), 'Dexterity').canImprove, true);
  });
});
