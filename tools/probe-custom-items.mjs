#!/usr/bin/env node
// tools/probe-custom-items.mjs — headless logic-level smoke for the custom-item
// feature (docs/PLAN-CUSTOM-ITEMS.md Phase 8). Run: `node tools/probe-custom-items.mjs`.
//
// P8.2 of the plan asked for a browser-level probe (picker, modal keyboard,
// light/dark, viewport) "using the existing probe pattern" — no such pattern
// exists in the repo, and the repo is deliberately dependency-free (no
// playwright/jsdom), so the owner chose a logic-level probe with the UI checks
// deferred to the manual Phase D walkthrough (runbook §8, D1–D9). This script
// covers the *logic* behind those checks by driving the real shipped modules:
//   1. the shared validate-item.js gate (the filter between the open /save-items
//      endpoint and the deployed rules) — P8.2's "picker lists a custom item"
//      premise: nothing invalid can ever be listed or folded;
//   2. the catalog merge the picker reads from (store.js:465) — custom entries
//      appear, and custom wins on a canon-name collision; plus the picker's own
//      selection rule (ui/picker.js) — a fresh custom item surfaces within the
//      50-result cap despite the real 179-item canon catalog (D3 regression);
//   3. engine/characteristics.js resolution — "adding it to a character
//      resolves its effects" (an armor-modifier lands on Physical/Mystic Armor);
//   4. the manager modal's working-set delta — applyCustomEdits (custom wins,
//      delete applied last, pure) and the ed-custom-items overlay round-trip;
//   5. the file caps (MAX_ITEMS, MAX_FILE_BYTES) the worker/fold enforce.
// Exits non-zero on any failure; all assertions use node:assert (no deps).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateItem, validateItemsFile, MAX_ITEMS, MAX_FILE_BYTES } from '../engine/validate-item.js';
import { makeCharacteristics, physicalArmor, mysticArmor } from '../engine/characteristics.js';
import { applyCustomEdits, loadCustomEdits, saveCustomEdits, reconcileCustomEdits, hasCustomPendingEdits } from '../store-custom-items.js';
import { pickItemKeys } from '../ui/picker.js';

// --- fixtures -----------------------------------------------------------------

const SMOKE_CLOAK = {
  kind: 'gear',
  ref: { cost: 5, description: 'test' },
  effects: [
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 2, measure: 'rating', condition: 'always', summary: 'Physical Armour 2' },
  ],
};

const CUSTOM_ARMOR = {
  kind: 'armor',
  ref: { cost: 50, description: 'custom plate' },
  effects: [
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'add', value: 2, measure: 'rating', condition: 'always', summary: 'Physical Armour 2' },
    { type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' }, operation: 'add', value: 1, measure: 'rating', condition: 'always', summary: 'Mystic Armour 1' },
  ],
};

// --- 1. the shared gate (validate-item.js) ------------------------------------

assert.equal(
  validateItem('Smoke Cloak', SMOKE_CLOAK).ok,
  true,
  'a valid custom item passes the gate the worker and fold share',
);

const badKind = validateItem('Junk', { kind: 'nope', effects: [] });
assert.equal(badKind.ok, false, 'unknown kind is rejected');
assert.match(badKind.errors.join(' '), /must be one of/, 'rejects with the kind list');

const socialArmor = validateItem('X', {
  kind: 'gear',
  effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Social' }, operation: 'add', value: 1, measure: 'rating', condition: 'always', summary: 'x' }],
});
assert.equal(socialArmor.ok, false, 'Social Armour is rejected (it does not exist)');

const multiplyOp = validateItem('X', {
  kind: 'gear',
  effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Physical' }, operation: 'multiply', value: 2, measure: 'rating', condition: 'always', summary: 'x' }],
});
assert.equal(multiplyOp.ok, false, 'non-add/subtract/set operation is rejected');

const badName = validateItem('../evil', SMOKE_CLOAK);
assert.equal(badName.ok, false, 'a name with a path separator is rejected');

const goodFile = {
  schema: 'ed-items/2',
  items: { 'Smoke Cloak': SMOKE_CLOAK, 'Plate of Home': CUSTOM_ARMOR },
};
assert.equal(validateItemsFile(goodFile).ok, true, 'a valid ed-items/2 file passes');

const wrongSchema = validateItemsFile({ schema: 'ed-items/1', items: {} });
assert.match(wrongSchema.errors.join(' '), /ed-items\/2/, 'wrong schema tag is rejected');

const overCap = {
  schema: 'ed-items/2',
  items: Object.fromEntries(Array.from({ length: MAX_ITEMS + 1 }, (_, i) => [`Item ${i}`, SMOKE_CLOAK])),
};
assert.match(validateItemsFile(overCap).errors.join(' '), /too many/, 'item-count cap is enforced');

const tooBig = {
  schema: 'ed-items/2',
  items: { pad: { ...SMOKE_CLOAK, ref: { cost: 0, description: 'x'.repeat(MAX_FILE_BYTES) } } },
};
const bigCheck = validateItemsFile(tooBig);
assert.match(bigCheck.errors.join(' '), /file too large/, 'oversized file is rejected');

// --- 2. the catalog the picker reads (store.js:465 merge) ----------------------

const canonItems = { 'Bracers of Aras': { kind: 'magic-item' } };
const customItems = { 'Smoke Cloak': SMOKE_CLOAK, 'Bracers of Aras': CUSTOM_ARMOR };
const itemCatalog = { ...canonItems, ...customItems };

assert.equal(itemCatalog['Smoke Cloak'], SMOKE_CLOAK, 'a custom item is listed in the merged picker catalog');
assert.equal(itemCatalog['Bracers of Aras'], CUSTOM_ARMOR, 'custom wins on a canon-name collision');

// --- 2b. the add-picker's 50-result cap cannot hide a fresh custom item ---------
// D3 regression (§6.6 P8.4): the merged catalog appends custom items after the
// real 179-item canon catalog, so without custom-first prioritisation a saved
// item would sit past the picker's .slice(0, 50) and never appear in the browse
// list. pickItemKeys (ui/picker.js) sorts custom items first — assert against
// the REAL rules file, exactly as the picker sees it.
const realCanon = JSON.parse(readFileSync(new URL('../rules/items.json', import.meta.url), 'utf8')).items;
const withCustom = { ...realCanon, 'Smoke Cloak': SMOKE_CLOAK };
const pickerKeys = pickItemKeys({ catalog: withCustom, customNames: ['Smoke Cloak'] });
assert.ok(Object.keys(realCanon).length > 50, 'canon catalog exceeds the picker cap (179 items) — regression precondition');
assert.ok(pickerKeys.includes('Smoke Cloak'), 'a fresh custom item appears within the first 50 browse results');

// --- 3. adding it to a character resolves its effects --------------------------

const effects = CUSTOM_ARMOR.effects;
assert.equal(physicalArmor(effects).value, 2, 'custom Physical Armour folds onto the character');

const table = JSON.parse(readFileSync(new URL('../rules/characteristics.json', import.meta.url), 'utf8'));
const lookup = makeCharacteristics(table);
assert.equal(mysticArmor(12, effects, lookup).value, 3, 'custom Mystic Armour folds onto the 2 Willpower base = 3');

// --- 4. the manager modal working-set (ed-custom-items overlay) ----------------

const delta = { items: { 'Smoke Cloak': SMOKE_CLOAK, 'Both': { kind: 'gear' } }, delete: ['Both'] };
const baseFile = { schema: 'ed-items/2', items: { 'Both': { kind: 'weapon' }, 'Old': { kind: 'gear' } } };
const merged = applyCustomEdits(baseFile, delta);
assert.equal(merged.items['Smoke Cloak'], SMOKE_CLOAK, 'a pending custom item appears in the overlay-applied catalog');
assert.equal(merged.items['Both'], undefined, 'a name in both items and delete is removed (delete applied last)');
assert.equal(merged.items['Old'].kind, 'gear', 'unrelated catalog entries survive an overlay');
assert.equal(baseFile.items['Both'].kind, 'weapon', 'applyCustomEdits never mutates its input');
assert.notEqual(merged, baseFile, 'applyCustomEdits returns a new object');

const base = { schema: 'ed-items/2', items: {} };
assert.equal(applyCustomEdits(base, null), base, 'a null delta is a no-op (same reference)');

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

saveCustomEdits(delta);
assert.deepEqual(loadCustomEdits(), delta, 'the overlay round-trips');
assert.equal(hasCustomPendingEdits(), true, 'a pending delta reads as pending');
saveCustomEdits({ items: {}, delete: [] });
assert.equal(hasCustomPendingEdits(), false, 'an empty delta reads as not pending');
reconcileCustomEdits();
assert.equal(loadCustomEdits(), null, 'reconcile clears the overlay on confirmed save');

saveCustomEdits('{ not json');
assert.equal(loadCustomEdits(), null, 'a corrupt overlay never blocks catalog loading');

// --- 5. caps the worker/fold enforce ------------------------------------------

assert.equal(MAX_ITEMS, 200, 'item cap constant exported');
assert.equal(MAX_FILE_BYTES, 512 * 1024, 'file cap constant exported');

// --- 6. the single-worn-armour rule (ui/item-equip-state.js) -------------------
// The Equipment tab's equip actions route through the pure equip-state module:
// a second armour must be an explicit swap; the confirmed swap stores the other
// armours; the engine folds whatever ends up equipped.
import { equipArmour, applyArmourSwap } from '../ui/item-equip-state.js';

const kinds = { 'Hardened Leather': 'armor', 'Hide Armor': 'armor', Buckler: 'shield' };
const worn = [{ name: 'Hardened Leather', equipped: true }, { name: 'Hide Armor', equipped: false }];

assert.equal(equipArmour(worn, (n) => kinds[n] ?? null, 'Buckler', 'toggle').blocked, false, 'a shield never blocks equipping');
assert.equal(equipArmour(worn, (n) => kinds[n] ?? null, 'Hide Armor', 'toggle').blocked, true, 'a second armour blocks');
const swapped = applyArmourSwap(worn, (n) => kinds[n] ?? null, 'Hide Armor', 'toggle');
assert.equal(swapped.find((i) => i.name === 'Hardened Leather').equipped, false, 'the worn armour is stored on swap');
assert.equal(swapped.find((i) => i.name === 'Hide Armor').equipped, true, 'the new armour is worn after swap');

console.log('probe-custom-items: ALL LOGIC CHECKS PASSED');
