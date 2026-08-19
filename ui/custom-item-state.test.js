// ui/custom-item-state.test.js — run with `npm test` (node --test, no deps).
// Pins the custom-item manager modal's lifecycle (PLAN-CUSTOM-ITEMS §5.2/§6):
//   open → seed from committed ∪ overlay → draft edits → save → reopen.
// Each scenario mirrors a regression the modal shipped or fought:
//   • a type change dropping the effect (saved effects must survive a commit);
//   • the edit form seeding the stale committed copy after a save;
//   • the overlay reconciled away against a lagged (old-content) branch read.
// No DOM, no Lit — the component (ui/ed-custom-item.js) delegates to these
// pure functions, so the decisions are testable here directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedWorking, deltaFrom, hasChanges, commitForm, removeWorking, weightToForm, weightFromForm } from './custom-item-state.js';

const LANTERN = { kind: 'gear', effects: [{ type: 'note', summary: 'A lantern.' }] };
const MUG = { kind: 'magic-item', effects: [] };
const MUG_EFFECTED = {
  kind: 'magic-item',
  effects: [
    {
      type: 'attack-modifier', operation: 'add', value: 1, measure: 'step',
      target: { domain: 'attack', name: 'Damage' }, condition: 'always',
      summary: 'Adds +1 Damage step', source: 'item',
    },
  ],
};

test('open with a pending overlay seeds the overlay copy, not the committed one (fresh-copy seed)', () => {
  const committed = { 'Beer Mug': MUG };
  const overlay = { items: { 'Beer Mug': MUG_EFFECTED }, delete: [] };
  const working = seedWorking(committed, overlay);
  assert.deepEqual(working.get('Beer Mug'), MUG_EFFECTED, 'the pending edit wins over the committed item');
  assert.equal(working.size, 1, 'same name means upsert, not a second row');
  assert.deepEqual(committed['Beer Mug'], MUG, 'inputs are never mutated');
});

test('open with no overlay: committed items are unchanged → no delta → not dirty', () => {
  const committed = { Lantern: LANTERN };
  const working = seedWorking(committed, null);
  assert.deepEqual(working.get('Lantern'), LANTERN);
  const delta = deltaFrom(working, committed);
  assert.deepEqual(delta, { items: {}, delete: [] }, 'untouched committed items read as unchanged');
  assert.equal(hasChanges(delta), false);
});

test('edit → commit keeps the full item including its effects (effects-drop regression)', () => {
  const committed = { 'Beer Mug': MUG };
  const working = seedWorking(committed, null);
  const next = commitForm(working, 'Beer Mug', 'Beer Mug', MUG_EFFECTED);
  const delta = deltaFrom(next, committed);
  assert.deepEqual(delta.items['Beer Mug'], MUG_EFFECTED, 'the saved item carries its effects');
  assert.ok(next.get('Beer Mug').effects.length === 1, 'the committed working set holds the effects');
  assert.deepEqual(delta.delete, [], 'an edit is not a delete');
  assert.equal(hasChanges(delta), true);
});

test('create new → items delta only, no delete', () => {
  const committed = {};
  const working = seedWorking(committed, null);
  const next = commitForm(working, null, 'New Lantern', LANTERN);
  const delta = deltaFrom(next, committed);
  assert.deepEqual(delta, { items: { 'New Lantern': LANTERN }, delete: [] });
  assert.equal(hasChanges(delta), true);
});

test('remove → delete list, working set loses the name (input Map untouched)', () => {
  const committed = { A: LANTERN, B: MUG };
  const working = seedWorking(committed, null);
  const next = removeWorking(working, 'A');
  assert.equal(next.has('A'), false);
  assert.equal(next.has('B'), true);
  assert.equal(working.has('A'), true, 'the input Map is not mutated');
  const delta = deltaFrom(next, committed);
  assert.deepEqual(delta, { items: {}, delete: ['A'] });
});

test('rename → old name leaves the working set, new name carries the item (delete list)', () => {
  const committed = { 'Old Name': LANTERN };
  const working = seedWorking(committed, null);
  const next = commitForm(working, 'Old Name', 'New Name', { ...LANTERN, ref: { cost: 5 } });
  assert.equal(next.has('Old Name'), false, 'rename removes the old key');
  assert.ok(next.has('New Name'), 'rename adds the new key');
  const delta = deltaFrom(next, committed);
  assert.deepEqual(Object.keys(delta.items), ['New Name']);
  assert.deepEqual(delta.delete, ['Old Name'], 'the old name becomes a staged delete');
});

test('save-reflected reopen: committed catches up → delta empty → not dirty', () => {
  // The branch re-read reflects the save (isItemsReflected true), the overlay is
  // reconciled away, and the modal reopens from the fresh committed catalog.
  const committed = { 'Beer Mug': MUG_EFFECTED };
  const working = seedWorking(committed, null);
  const delta = deltaFrom(working, committed);
  assert.deepEqual(delta, { items: {}, delete: [] });
  assert.equal(hasChanges(delta), false);
});

test('stale-read reopen: committed lags with old content → the pending edit survives', () => {
  // THE regression (§6.6): the branch re-read returned the previous commit's
  // file (same name, old content). isItemsReflected sees the mismatch, so the
  // overlay is NOT reconciled away — and reopening the modal must still seed the
  // fresh copy and keep the delta pending. Pinning the stale-read case here is
  // what the name-presence-only check broke.
  const laggedCommitted = { 'Beer Mug': MUG }; // old content (effects lost in the lagged read)
  const overlay = { items: { 'Beer Mug': MUG_EFFECTED }, delete: [] }; // the save still pending
  const working = seedWorking(laggedCommitted, overlay);
  assert.deepEqual(working.get('Beer Mug'), MUG_EFFECTED, 'the fresh edit is what the form opens with');
  const delta = deltaFrom(working, laggedCommitted);
  assert.deepEqual(delta.items['Beer Mug'], MUG_EFFECTED, 'the item is still pending against the stale read');
  assert.equal(hasChanges(delta), true, 'never reconciled away by a lagged read');
});

test('removeWorking and commitForm never mutate the working set they were given', () => {
  const committed = { A: LANTERN, B: MUG };
  const working = seedWorking(committed, null);
  const afterRemove = removeWorking(working, 'A');
  assert.equal(working.size, 2, 'removeWorking is copy-on-write');
  const afterCommit = commitForm(working, 'A', 'A', { ...LANTERN, ref: { cost: 1 } });
  assert.equal(working.get('A').ref, undefined, 'commitForm is copy-on-write');
  assert.ok(afterCommit.get('A').ref.cost === 1);
});

test('weightToForm maps the structured shapes losslessly', () => {
  assert.deepEqual(weightToForm(undefined), { mode: 'none', amount: '' });
  assert.deepEqual(weightToForm(null), { mode: 'none', amount: '' });
  assert.deepEqual(weightToForm({ negligible: true }), { mode: 'negligible', amount: '' });
  assert.deepEqual(weightToForm({ amount: 8, unit: 'oz' }), { mode: 'oz', amount: '8' });
  assert.deepEqual(weightToForm({ amount: 25, unit: 'lb' }), { mode: 'lb', amount: '25' });
});

test('weightToForm migrates a bare number / numeric-string legacy weight to pounds', () => {
  assert.deepEqual(weightToForm(5), { mode: 'lb', amount: '5' });
  assert.deepEqual(weightToForm('0.1'), { mode: 'lb', amount: '0.1' });
  assert.deepEqual(weightToForm('2'), { mode: 'lb', amount: '2' });
});

test('weightToForm flags a non-numeric legacy string for re-entry, never drops it', () => {
  assert.deepEqual(weightToForm('25 lb'), { mode: 'none', amount: '', legacy: '25 lb' });
  assert.deepEqual(weightToForm('heavy'), { mode: 'none', amount: '', legacy: 'heavy' });
  assert.deepEqual(weightToForm(true), { mode: 'none', amount: '', legacy: 'true' });
});

test('weightFromForm round-trips the editor states into ed-items/3 shapes', () => {
  assert.equal(weightFromForm('none', '5'), undefined);
  assert.deepEqual(weightFromForm('negligible', ''), { negligible: true });
  assert.deepEqual(weightFromForm('lb', '25'), { amount: 25, unit: 'lb' });
  assert.deepEqual(weightFromForm('oz', 8), { amount: 8, unit: 'oz' });
  assert.equal(weightFromForm('lb', '-3'), undefined, 'negative amount is invalid');
  assert.equal(weightFromForm('lb', 'abc'), undefined, 'non-numeric amount is invalid');
  assert.equal(weightFromForm('lb', ''), undefined, 'an empty amount picks no unit yet');
  assert.equal(weightFromForm('oz', null), undefined, 'a null amount picks no unit yet');
});

test('weightToForm → weightFromForm round-trips the real catalog shapes', () => {
  for (const w of [{ amount: 25, unit: 'lb' }, { amount: 8, unit: 'oz' }, { negligible: true }, null]) {
    const f = weightToForm(w);
    const back = weightFromForm(f.mode, f.amount);
    if (w === null) assert.equal(back, undefined);
    else assert.deepEqual(back, w);
  }
});
