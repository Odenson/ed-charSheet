// tools/rules-starting-kit.test.js — run with `npm test` (node --test, no deps).
// create-new-adept A1: the three starting-kit catalog entries added to rules/items.json.
// Expected values come ONLY from plans/create-new-adept/rules.md R8 (starting kit) and R9
// (Grimoire house stat block) and the spec's "Rules" table. Failing-first until the entries land.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateItem, MAX_SHORT_EFFECT } from '../engine/validate-item.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const itemsFile = JSON.parse(fs.readFileSync(path.join(root, 'rules/items.json'), 'utf8'));
const items = itemsFile.items;

// name -> [cost (silver), weight (lb), availability]
const KIT = {
  "Traveler's Garb": [8, 3, 'average'], // R8: 8 sp, 3 lb, average
  'Trail Rations (1 week)': [10, 8, 'average'], // R8: 10 sp, 8 lb, average
  Grimoire: [0, 1, 'average'], // R9 (house): cost 0, weight 1 lb, availability average
};

test('items catalog keeps its schema tag (ed-items/3)', () => {
  assert.equal(itemsFile.schema, 'ed-items/3');
});

for (const [name, [cost, weight, availability]] of Object.entries(KIT)) {
  test(`${name}: exists as a gear item with the R8/R9 cost, weight and availability`, () => {
    const item = items[name];
    assert.ok(item, `rules/items.json has no "${name}"`);
    assert.equal(item.kind, 'gear');
    assert.equal(item.ref.cost, cost);
    assert.deepEqual(item.ref.weight, { amount: weight, unit: 'lb' });
    assert.equal(item.ref.availability, availability);
    assert.equal(typeof item.ref.description, 'string');
    assert.ok(item.ref.description.length > 0, 'description is non-empty');
  });

  test(`${name}: follows the Adventuring Kit shape - one note effect and a short presentation label`, () => {
    const item = items[name];
    assert.ok(item, `rules/items.json has no "${name}"`);
    assert.equal(item.effects.length, 1);
    assert.equal(item.effects[0].type, 'note');
    assert.equal(typeof item.presentation.shortEffect, 'string');
    assert.ok(item.presentation.shortEffect.length > 0);
    assert.ok(item.presentation.shortEffect.length <= MAX_SHORT_EFFECT, `shortEffect <= ${MAX_SHORT_EFFECT} chars`);
  });

  test(`${name}: passes validateItem`, () => {
    assert.ok(items[name], `rules/items.json has no "${name}"`);
    const r = validateItem(name, items[name]);
    assert.equal(r.ok, true, r.errors?.join('; '));
  });
}

test('Grimoire description says it is a house stat block (R9: the books give no stats)', () => {
  assert.match(items.Grimoire?.ref?.description ?? '', /house/i);
});

test('the other starting-kit items are still present: Adventuring Kit (15 sp, 14 lb, average) and Dagger (R8)', () => {
  const kit = items['Adventuring Kit'];
  assert.ok(kit, 'Adventuring Kit still in the catalog');
  assert.equal(kit.ref.cost, 15);
  assert.deepEqual(kit.ref.weight, { amount: 14, unit: 'lb' });
  assert.equal(kit.ref.availability, 'average');
  assert.ok(items.Dagger, 'Dagger still in the catalog');
  assert.equal(items.Dagger.kind, 'weapon');
});

test('the three new entries were added without removing any of the 183 pre-existing ones', () => {
  assert.ok(Object.keys(items).length >= 186, `catalog has ${Object.keys(items).length} entries, expected >= 183 + 3`);
});
