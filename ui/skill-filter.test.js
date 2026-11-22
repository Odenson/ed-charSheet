// ui/skill-filter.test.js — run with `npm test` (node --test, no deps).
// Pure chip-filter helper shared by both skill pickers (plans/gen-skill-other I7).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_CHIPS, chipMatches } from './skill-filter.js';

const item = (category, over = {}) => ({ name: 'X', category, ...over });

test('SKILL_CHIPS lists the seven chips in order with ids and labels', () => {
  assert.deepEqual(SKILL_CHIPS, [
    { id: 'all', label: 'All' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'artisan', label: 'Artisan' },
    { id: 'language-speak', label: 'Speak Language' },
    { id: 'language-readwrite', label: 'Read/Write Language' },
    { id: 'general', label: 'General' },
    { id: 'custom', label: 'Custom' },
  ]);
});

test('all matches every item', () => {
  for (const c of ['knowledge', 'artisan', 'language-speak', 'language-readwrite', 'general', null, undefined]) {
    assert.equal(chipMatches('all', item(c)), true);
  }
  assert.equal(chipMatches('all', item('general', { custom: true })), true);
});

test('category chips match their own category only', () => {
  for (const chip of ['knowledge', 'artisan', 'language-speak', 'language-readwrite']) {
    assert.equal(chipMatches(chip, item(chip)), true, chip);
    for (const other of ['knowledge', 'artisan', 'language-speak', 'language-readwrite', 'general']) {
      if (other !== chip) assert.equal(chipMatches(chip, item(other)), false, `${chip} vs ${other}`);
    }
  }
});

test('general matches everything that is not knowledge, artisan or a language', () => {
  assert.equal(chipMatches('general', item('general')), true);
  assert.equal(chipMatches('general', item(null)), true);
  assert.equal(chipMatches('general', item(undefined)), true);
  for (const c of ['knowledge', 'artisan', 'language-speak', 'language-readwrite']) {
    assert.equal(chipMatches('general', item(c)), false, c);
  }
});

test('custom matches only items with custom === true, across categories', () => {
  for (const c of ['knowledge', 'artisan', 'general']) {
    assert.equal(chipMatches('custom', item(c, { custom: true })), true, c);
    assert.equal(chipMatches('custom', item(c)), false, `${c} core`);
    assert.equal(chipMatches('custom', item(c, { custom: false })), false);
    assert.equal(chipMatches('custom', item(c, { custom: 'true' })), false);
  }
});

test('a custom skill also matches its own category chip', () => {
  assert.equal(chipMatches('knowledge', item('knowledge', { custom: true })), true);
  assert.equal(chipMatches('general', item('general', { custom: true })), true);
  assert.equal(chipMatches('artisan', item('knowledge', { custom: true })), false);
});

test('quick-add free-text rows: shown under All and their own category chip, hidden under Custom', () => {
  const kRow = item('knowledge', { generic: true, freeText: 'knowledge' });
  const aRow = item('artisan', { generic: true, freeText: 'artisan' });
  assert.equal(chipMatches('all', kRow), true);
  assert.equal(chipMatches('knowledge', kRow), true);
  assert.equal(chipMatches('custom', kRow), false);
  assert.equal(chipMatches('general', kRow), false);
  assert.equal(chipMatches('artisan', kRow), false);
  assert.equal(chipMatches('artisan', aRow), true);
  assert.equal(chipMatches('custom', aRow), false);
});

test('does not mutate the item', () => {
  const it = Object.freeze(item('knowledge', { custom: true }));
  assert.doesNotThrow(() => chipMatches('custom', it));
});
