// Customize… flow of the create-custom-skill form: seeded name and blurb, learn flag, event detail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialForm, setField, createDetail, formErrors } from './custom-skill-state.js';
import { MAX_DESCRIPTION } from '../engine/validate-skill.js';

const ATTRS = ['Perception', 'Charisma', 'Willpower'];
const OPTS = { coreNames: ['Knowledge'], attributeNames: ATTRS, customNames: [] };

test('seeded from a quick row: typed subject (trimmed), template attribute and blurb prefilled', () => {
  const f = initialForm('knowledge', { templateAttribute: 'Perception', name: '  Barsaive History ', summary: 'Generic blurb.' });
  assert.equal(f.name, 'Barsaive History');
  assert.equal(f.attribute, 'Perception');
  assert.equal(f.summary, 'Generic blurb.');
  assert.deepEqual(formErrors(f, OPTS), []);
});

test('the seeded blurb is capped at the description limit', () => {
  const f = initialForm('artisan', { templateAttribute: 'Charisma', name: 'Pottery', summary: 'x'.repeat(MAX_DESCRIPTION + 50) });
  assert.equal(f.summary.length, MAX_DESCRIPTION);
  assert.deepEqual(formErrors(f, OPTS), []);
});

test('learn flag defaults to false and is only true when asked', () => {
  assert.equal(initialForm('knowledge', {}).learn, false);
  assert.equal(initialForm('knowledge', { learn: true }).learn, true);
  assert.equal(initialForm('knowledge', { learn: 'yes' }).learn, false);
  assert.equal(setField(initialForm('general', {}), 'learn', true).learn, true);
});

test('createDetail: entry from the form plus the learn flag', () => {
  const f = initialForm('knowledge', { templateAttribute: 'Perception', name: 'Barsaive History', summary: 'Blurb.', learn: true });
  const d = createDetail(f);
  assert.equal(d.name, 'Barsaive History');
  assert.equal(d.learn, true);
  assert.deepEqual(d.skill, { name: 'Barsaive History', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', summary: 'Blurb.', custom: true });
});

test('createDetail without learn, blank description omitted', () => {
  const d = createDetail(initialForm('general', { name: 'Rope Dancing' }));
  assert.equal(d.learn, false);
  assert.equal('summary' in d.skill, false);
});
