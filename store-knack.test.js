// store-knack.test.js — run with `npm test` (node --test, no deps).
// Covers resolveKnack: the single place a knack is turned into a structured object,
// resolving against the rules/knacks.json catalog with a legacy-string fallback.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveKnack } from './store.js';

const realCatalog = JSON.parse(readFileSync(new URL('./rules/knacks.json', import.meta.url))).knacks;

const catalog = {
  Hunting: { parents: ['Tracking'], requiredRank: 3, action: 'Sustained', summary: 'Bring down game.' },
  'Thread Weaving': {
    parents: ['Elementalism', 'Nethermancy'],
    requiredRank: 5,
  },
};
const skillNames = new Set(['Tracking']);
const talentNames = new Set();

test('resolveKnack pulls fixed rules from the catalog', () => {
  const k = resolveKnack({ name: 'Hunting' }, catalog, skillNames);
  assert.equal(k.known, true);
  assert.deepEqual(k.parent, { type: 'skill', name: 'Tracking' });
  assert.equal(k.requiredRank, 3);
  assert.equal(k.action, 'Sustained');
  assert.equal(k.detail.documented, true);
});

test('resolveKnack picks the parent named by `via` when several exist', () => {
  const k = resolveKnack({ name: 'Thread Weaving', via: 'Nethermancy' }, catalog, skillNames);
  assert.deepEqual(k.parent, { type: 'talent', name: 'Nethermancy' });
  // Without `via`, it defaults to the first listed parent.
  const d = resolveKnack({ name: 'Thread Weaving' }, catalog, skillNames);
  assert.equal(d.parent.name, 'Elementalism');
});

test('resolveKnack falls back to parsing the legacy "Knack (Parent)" string', () => {
  const k = resolveKnack({ name: 'Skinning (Tracking)' }, {}, skillNames);
  assert.equal(k.name, 'Skinning');
  assert.equal(k.rawName, 'Skinning (Tracking)');
  assert.equal(k.known, false);
  assert.deepEqual(k.parent, { type: 'skill', name: 'Tracking' }); // Tracking is a skill
  assert.equal(k.requiredRank, null); // no catalog → unpriced
});

test('resolveKnack tags an unknown parent as a talent (not a skill)', () => {
  const k = resolveKnack({ name: 'Down Strike (Melee Weapons)' }, {}, skillNames);
  assert.deepEqual(k.parent, { type: 'talent', name: 'Melee Weapons' });
});

test('resolveKnack keeps a bare unknown knack, with no parent', () => {
  const k = resolveKnack({ name: 'Mystery Knack' }, {}, skillNames);
  assert.equal(k.name, 'Mystery Knack');
  assert.equal(k.known, false);
  assert.equal(k.parent, null);
});

// --- real rules/knacks.json catalog ------------------------------------------

test('real knacks catalog: 145 entries, ed-knacks/1 shape', () => {
  const names = Object.keys(realCatalog);
  assert.equal(names.length, 145);
  assert.ok(names.includes('Lip Reading'));
  assert.ok(names.includes('Point-Blank Shot'));
  assert.ok(names.includes('Detect Spirit'));
  assert.ok(names.includes('Hunting'));
  assert.ok(names.includes('Skinning'));
  assert.ok(names.includes('Animal Tracking'));
  assert.ok(names.includes('Riding'));
  for (const k of Object.values(realCatalog)) {
    assert.ok(Array.isArray(k.parents) && k.parents.length > 0, k.summary);
    for (const p of k.parents) assert.equal(typeof p, 'string'); // name-only binding keys
    assert.equal(typeof k.requiredRank, 'number');
    assert.equal(typeof k.summary, 'string');
  }
});

test('real catalog: resolveKnack prices a Companion knack from the catalog', () => {
  const k = resolveKnack({ name: 'Lip Reading' }, realCatalog);
  assert.equal(k.known, true);
  assert.equal(k.parent.name, 'Awareness');
  assert.equal(k.requiredRank, 3);
  assert.equal(k.action, 'Standard');
  assert.equal(k.detail.documented, true);
});

test('real catalog: a parent binds to whichever kind the character owns', () => {
  const asSkill = resolveKnack({ name: 'Lip Reading' }, realCatalog, new Set(['Awareness']), new Set());
  assert.deepEqual(asSkill.parent, { type: 'skill', name: 'Awareness' });
  const asTalent = resolveKnack({ name: 'Lip Reading' }, realCatalog, new Set(), new Set(['Awareness']));
  assert.deepEqual(asTalent.parent, { type: 'talent', name: 'Awareness' });
  // Owned as both → talent wins (Companion default labeling); `via` disambiguates.
  const both = resolveKnack(
    { name: 'Point-Blank Shot' },
    realCatalog,
    new Set(['Missile Weapons', 'Throwing Weapons']),
    new Set(['Missile Weapons']),
  );
  assert.deepEqual(both.parent, { type: 'talent', name: 'Missile Weapons' });
  const via = resolveKnack(
    { name: 'Point-Blank Shot', via: 'Throwing Weapons' },
    realCatalog,
    new Set(['Throwing Weapons']),
    new Set(),
  );
  assert.deepEqual(via.parent, { type: 'skill', name: 'Throwing Weapons' });
});

test('real catalog: multi-parent knack defaults to first, `via` picks another', () => {
  const k = resolveKnack({ name: 'Point-Blank Shot' }, realCatalog);
  assert.equal(k.parent.name, 'Missile Weapons');
  const v = resolveKnack({ name: 'Point-Blank Shot', via: 'Throwing Weapons' }, realCatalog);
  assert.equal(v.parent.name, 'Throwing Weapons');
  assert.equal(v.requiredRank, 3);
});
