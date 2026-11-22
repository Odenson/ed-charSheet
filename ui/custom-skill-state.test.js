// ui/custom-skill-state.test.js — run with `npm test` (node --test, no deps).
// Pure state behind the create-custom-skill form (plans/gen-skill-other I8a).
// R1: Knowledge/Artisan Novice, default attribute prefilled from the generic template
// entry's attribute IN DATA (passed as templateAttribute, never hard-coded); R4: General
// has no default attribute and an owner-chosen Novice/Journeyman tier.
// Assumption: `attributes` is an array of attribute names; `opts` to formErrors is the
// validateSkill options object { coreNames, attributeNames, customNames }.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialForm, setField, formErrors, toSkill } from './custom-skill-state.js';
import { validateSkill } from '../engine/validate-skill.js';

const ATTRS = ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'];
const OPTS = { coreNames: ['Alchemy', 'Knowledge', 'Artisan'], attributeNames: ATTRS, customNames: ['Rope Dancing'] };
const init = (kind, templateAttribute) => initialForm(kind, { attributes: ATTRS, templateAttribute });

test('initialForm: Knowledge/Artisan prefill the template attribute, Novice, blank name/summary', () => {
  const k = init('knowledge', 'Perception');
  assert.equal(k.kind, 'knowledge');
  assert.equal(k.attribute, 'Perception');
  assert.equal(k.tier, 1);
  assert.equal(k.name, '');
  assert.equal(k.summary, '');
  const a = init('artisan', 'Charisma');
  assert.equal(a.attribute, 'Charisma');
  assert.equal(a.tier, 1);
});

test('initialForm: the prefill is whatever the data says (not hard-coded)', () => {
  assert.equal(init('knowledge', 'Willpower').attribute, 'Willpower');
});

test('initialForm: General has no attribute prefill and starts Novice', () => {
  const g = init('general', 'Perception');
  assert.equal(g.kind, 'general');
  assert.equal(g.attribute, '');
  assert.equal(g.tier, 1);
});

test('setField returns a new form and never mutates', () => {
  const f = Object.freeze(init('knowledge', 'Perception'));
  const next = setField(f, 'name', 'Mining Lore');
  assert.equal(next.name, 'Mining Lore');
  assert.equal(f.name, '');
  assert.notEqual(next, f);
  assert.equal(next.attribute, 'Perception', 'other fields kept');
});

test('formErrors: empty name is an error', () => {
  assert.ok(formErrors(init('knowledge', 'Perception'), OPTS).length > 0);
});

test('formErrors: duplicate (core or custom, case-insensitive), parentheses and over-length names are errors', () => {
  const base = init('knowledge', 'Perception');
  for (const n of ['Alchemy', 'alchemy', 'Rope Dancing', 'rope dancing', 'Lore (x)', 'a'.repeat(41)]) {
    assert.ok(formErrors(setField(base, 'name', n), OPTS).length > 0, n);
  }
});

test('formErrors: a good Knowledge form has no errors', () => {
  const f = setField(init('knowledge', 'Perception'), 'name', 'Dwarven Mining Lore');
  assert.deepEqual(formErrors(f, OPTS), []);
});

test('formErrors: General with an empty attribute asks the owner to choose one', () => {
  const f = setField(init('general', null), 'name', 'Sky Surfing');
  const errs = formErrors(f, OPTS);
  assert.ok(errs.some((e) => /Choose an attribute/.test(e)), errs.join('; '));
  assert.deepEqual(formErrors(setField(f, 'attribute', 'Dexterity'), OPTS), []);
});

test('formErrors: a General Journeyman form is valid; an over-long description is an error', () => {
  let f = setField(init('general', null), 'name', 'Sky Surfing');
  f = setField(setField(f, 'attribute', 'Willpower'), 'tier', 2);
  assert.deepEqual(formErrors(f, OPTS), []);
  assert.ok(formErrors(setField(f, 'summary', 'x'.repeat(501)), OPTS).length > 0);
});

test('toSkill: trimmed, custom:true, strain 0, summary omitted when blank', () => {
  let f = setField(init('knowledge', 'Perception'), 'name', '  Dwarven Mining Lore  ');
  f = setField(f, 'summary', '   ');
  const s = toSkill(f);
  assert.deepEqual(s, { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true });
  assert.equal('summary' in s, false);
});

test('toSkill: a description is kept (trimmed)', () => {
  let f = setField(init('artisan', 'Charisma'), 'name', 'Glass Blowing');
  f = setField(f, 'summary', '  Shape molten glass.  ');
  assert.equal(toSkill(f).summary, 'Shape molten glass.');
});

test('toSkill: tier is forced to 1 unless the kind is general', () => {
  let f = setField(init('knowledge', 'Perception'), 'name', 'Lore');
  f = setField(f, 'tier', 2);
  assert.equal(toSkill(f).tier, 1);
  let g = setField(init('general', null), 'name', 'Sky Surfing');
  g = setField(setField(g, 'attribute', 'Willpower'), 'tier', 2);
  const s = toSkill(g);
  assert.equal(s.tier, 2);
  assert.equal(s.category, 'general');
});

test('toSkill output passes the shared validator', () => {
  const f = setField(init('knowledge', 'Perception'), 'name', 'Dwarven Mining Lore');
  const s = toSkill(f);
  assert.equal(validateSkill(s.name, s, OPTS).ok, true);
});
