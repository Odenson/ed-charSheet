// engine/validate-item.test.js — run with `npm test` (node --test, no deps).
// Covers the shared custom-item validator: name/kind/ref rules, the effect
// grammar (taxonomy v3 subset), the per-item size cap, and the whole-file check
// the worker and fold job rely on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateItem, validateItemsFile, ITEM_KINDS, EFFECT_TYPES, MAX_SHORT_EFFECT } from './validate-item.js';

const ok = (r) => ({ pass: r.ok, errors: r.errors });

const armorItem = {
  kind: 'armor',
  living: false,
  ref: { cost: 40, weight: '20 lb', availability: 'average', description: 'Test armour.' },
  effects: [
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 5, measure: 'rating', condition: 'always', summary: 'Adds Physical Armour of 5.' },
  ],
};

test('valid armor item passes', () => {
  assert.deepEqual(ok(validateItem('Hardened Leather', armorItem)), { pass: true, errors: [] });
});

test('valid weapon item passes', () => {
  const r = validateItem('Battle Axe', {
    kind: 'weapon',
    ref: { cost: 35, weight: '6 lb', category: 'melee', strMin: 13, size: 5 },
    effects: [
      { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' }, operation: 'add', value: 7, measure: 'step', condition: 'always', summary: 'Melee damage: Strength step + 7.' },
    ],
  });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('note-only gear item passes (empty mechanics)', () => {
  const r = validateItem('Backpack', {
    kind: 'gear',
    ref: { cost: 5, weight: '3 lb' },
    effects: [{ type: 'note', condition: 'always', summary: 'Standard backpack.' }],
  });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('an empty effects array is valid (no mechanics)', () => {
  const r = validateItem('Plain Trinket', { kind: 'gear', effects: [] });
  assert.equal(r.ok, true, r.errors.join('; '));
});

// --- name rules --------------------------------------------------------------

test('name: rejects empty, oversized, and whitespace-trimmed names', () => {
  for (const n of ['', '   ', 'a'.repeat(65), ' padded', 'padded ', 'x/y', 'x\\y', 'a\u0000b']) {
    const r = validateItem(n, { kind: 'gear', effects: [] });
    assert.equal(r.ok, false, `"${n}" should be rejected`);
    assert.ok(r.errors.some((e) => e.startsWith('name')), `"${n}" should report a name error`);
  }
});

test('name: accepts spaces, commas, apostrophes, and unicode', () => {
  for (const n of ['Water or Wine Skin', 'Light Quartz, Small', "Cat's Claw", 'Epée du Roi ×2']) {
    const r = validateItem(n, { kind: 'gear', effects: [] });
    assert.equal(r.ok, true, `${n}: ${r.errors.join('; ')}`);
  }
});

// --- kind / ref --------------------------------------------------------------

test('kind must be in the item kinds vocabulary', () => {
  const r = validateItem('Junk', { kind: 'nope', effects: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith('kind')));
  assert.deepEqual(new Set(ITEM_KINDS).size, ITEM_KINDS.length, 'kinds are unique');
  assert.ok(EFFECT_TYPES.length >= 6);
});

test('ref is display-only but shape-checked', () => {
  const badCost = validateItem('Bad', { kind: 'gear', ref: { cost: 'expensive' }, effects: [] });
  assert.equal(badCost.ok, false);
  assert.ok(badCost.errors.some((e) => e.includes('ref.cost')));
  const badType = validateItem('Bad', { kind: 'gear', ref: [1, 2], effects: [] });
  assert.equal(badType.ok, false);
});

test('presentation.shortEffect is an optional string capped at MAX_SHORT_EFFECT', () => {
  const gear = { kind: 'gear', effects: [] };
  assert.equal(validateItem('Plain', gear).ok, true, 'no presentation is fine');
  assert.equal(validateItem('Tag', { ...gear, presentation: { shortEffect: 'Holds ~50 lb' } }).ok, true);
  const notString = validateItem('Bad', { ...gear, presentation: { shortEffect: 5 } });
  assert.equal(notString.ok, false);
  assert.ok(notString.errors.some((e) => e.includes('shortEffect')));
  assert.equal(validateItem('At', { ...gear, presentation: { shortEffect: 'x'.repeat(MAX_SHORT_EFFECT) } }).ok, true);
  const tooLong = validateItem('Over', { ...gear, presentation: { shortEffect: 'x'.repeat(MAX_SHORT_EFFECT + 1) } });
  assert.equal(tooLong.ok, false);
  assert.ok(tooLong.errors.some((e) => e.includes(`at most ${MAX_SHORT_EFFECT} chars`)));
});

// --- effect grammar ----------------------------------------------------------

test('unknown effect type is rejected', () => {
  const r = validateItem('X', { kind: 'gear', effects: [{ type: 'bogus', summary: 'x' }] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('unknown type')));
});

test('modifier requires operation, value, and measure', () => {
  const missing = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, summary: 'x' }] });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => e.includes('operation')));
  assert.ok(missing.errors.some((e) => e.includes('value')));
});

test('modifier requires a target with the type-correct domain/name', () => {
  const noTarget = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', operation: 'add', value: 1, measure: 'rating', summary: 'x' }] });
  assert.ok(noTarget.errors.some((e) => e.includes('target')));
  // Social Armour does not exist — armor-modifier rejects it.
  const social = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Social' }, operation: 'add', value: 1, measure: 'rating', summary: 'x' }] });
  assert.ok(social.errors.some((e) => e.includes('not valid for armor')));
  // Defense domain on an armor modifier is a domain mismatch.
  const wrongDomain = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', target: { domain: 'defense', name: 'Physical' }, operation: 'add', value: 1, measure: 'rating', summary: 'x' }] });
  assert.ok(wrongDomain.errors.some((e) => e.includes('target domain')));
});

test('operation is restricted to add | subtract | set for items', () => {
  const r = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'multiply', value: 2, measure: 'rating', summary: 'x' }] });
  assert.equal(r.ok, false);
});

test('note effects carry a summary but no value mechanics', () => {
  const r = validateItem('X', { kind: 'gear', effects: [{ type: 'note' }] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('summary')));
});

test('effect value may be a { ref } pull', () => {
  const r = validateItem('X', {
    kind: 'gear',
    effects: [{ type: 'characteristic-modifier', target: { domain: 'characteristic', name: 'Initiative' }, operation: 'add', value: { ref: 'attribute|Dexterity|Step' }, measure: 'step', summary: 'x' }],
  });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('optional effect fields are type-checked', () => {
  const r = validateItem('X', {
    kind: 'gear',
    effects: [{ type: 'note', summary: 'x', stacking: 'bogus', duration: 'forever', gmDiscretion: 'yes' }],
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('stacking')));
  assert.ok(r.errors.some((e) => e.includes('duration')));
  assert.ok(r.errors.some((e) => e.includes('gmDiscretion')));
});

test('every effect needs a summary (taxonomy: required)', () => {
  const r = validateItem('X', { kind: 'gear', effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 1, measure: 'rating' }] });
  assert.ok(r.errors.some((e) => e.includes('summary')));
});

// --- size caps ---------------------------------------------------------------

test('an oversized item is rejected', () => {
  const big = { kind: 'gear', effects: [{ type: 'note', summary: 'y'.repeat(5 * 1024) }] };
  const r = validateItem('X', big);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('too large')));
});

// --- whole-file validation ---------------------------------------------------

const goodFile = () => ({
  schema: 'ed-items/2',
  effectTaxonomy: 'docs/EFFECT-TAXONOMY.md (v3)',
  source: 'custom',
  notes: 'Player-created items.',
  items: { 'Hardened Leather': armorItem },
});

test('a valid file passes the whole-file check', () => {
  assert.equal(validateItemsFile(goodFile()).ok, true);
});

test('file check rejects a wrong schema tag', () => {
  const f = goodFile();
  f.schema = 'ed-items/1';
  const r = validateItemsFile(f);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('schema')));
});

test('file check rejects a non-object items map', () => {
  const f = goodFile();
  f.items = [];
  assert.equal(validateItemsFile(f).ok, false);
});

test('file check surfaces per-item errors with the key', () => {
  const f = goodFile();
  f.items['Broken'] = { kind: 'bogus', effects: [] };
  const r = validateItemsFile(f);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('items["Broken"]') && e.includes('kind')));
});

test('file check enforces the item-count cap', () => {
  const f = goodFile();
  for (let i = 0; i < 5; i++) f.items[`Item ${i}`] = { kind: 'gear', effects: [] };
  const r = validateItemsFile(f, { maxItems: 3 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('too many')));
});

test('file check enforces the total-size cap', () => {
  const f = goodFile();
  f.items['Big'] = { kind: 'gear', effects: [{ type: 'note', summary: 'z'.repeat(2 * 1024) }] };
  const r = validateItemsFile(f, { maxTotalBytes: 2048 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('file too large')));
});
