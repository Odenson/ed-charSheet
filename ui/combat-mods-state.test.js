// ui/combat-mods-state.test.js — run with `npm test` (node --test, no deps).
// Pins the pure segment-count / normalisation logic behind the Combat tab's
// tabbed Combat-modifiers control. No DOM, no Lit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOD_TABS, modTabCounts, normalizeModTab } from './combat-mods-state.js';

test('MOD_TABS lists the three segments in order with labels', () => {
  assert.deepEqual(MOD_TABS, [
    { id: 'opts', label: 'Combat options' },
    { id: 'sits', label: 'Situational' },
    { id: 'charms', label: 'Blood charms' },
  ]);
});

test('non-arms option counts only when toggled', () => {
  const options = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
  const c = modTabCounts({ options, armedNames: new Set(['A']), toggledOpts: ['B'] });
  assert.equal(c.opts, 1);
});

test('arms option counts only when in armedNames, regardless of toggledOpts', () => {
  const options = [{ name: 'X', arms: true }, { name: 'Y', arms: true }];
  const c = modTabCounts({
    options,
    armedNames: new Set(['X']),
    toggledOpts: ['Y'], // toggled but not armed -> not counted
  });
  assert.equal(c.opts, 1);
});

test('sits is toggled count plus locked entries', () => {
  const c = modTabCounts({
    sits: [{ name: 'a', locked: true }, { name: 'b' }, { name: 'c', locked: true }],
    toggledSits: ['b'],
  });
  assert.equal(c.sits, 3);
});

test('charms is the length of charmNames', () => {
  assert.equal(modTabCounts({ charmNames: ['p', 'q'] }).charms, 2);
});

test('undefined inputs give zeros', () => {
  assert.deepEqual(modTabCounts({}), { opts: 0, sits: 0, charms: 0 });
});

test('empty inputs give zeros', () => {
  assert.deepEqual(
    modTabCounts({ options: [], armedNames: new Set(), toggledOpts: [], sits: [], toggledSits: [], charmNames: [] }),
    { opts: 0, sits: 0, charms: 0 },
  );
});

test('normalizeModTab passes valid ids through', () => {
  for (const id of ['opts', 'sits', 'charms']) assert.equal(normalizeModTab(id), id);
});

test('normalizeModTab falls back to opts for anything else', () => {
  for (const v of [undefined, null, '', 'x', 'OPTS', 3, {}]) assert.equal(normalizeModTab(v), 'opts');
});
