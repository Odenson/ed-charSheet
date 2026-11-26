// ui/notes-state.test.js — run with `npm test` (node --test, no deps).
// Pins the pure note-list helpers behind the Notes sub-view (plans/update-notes-edit, I4):
// upsertNote(list, id, text, makeId) and removeNote(list, id). Both are non-mutating and treat a
// null/undefined list as []. NEW-FEATURE tests: fail until ui/notes-state.js exists.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { upsertNote, removeNote } from './notes-state.js';

// Deep-frozen fixture: any in-place mutation of the array or an entry throws (ESM is strict mode).
const frozenList = () => Object.freeze([
  Object.freeze({ id: 'a', text: 'Alpha' }),
  Object.freeze({ id: 'b', text: 'Bravo', foo: 42 }),
  Object.freeze({ id: 'c', text: 'Charlie' }),
]);
const snapshot = (l) => JSON.parse(JSON.stringify(l));

// Counting stub for makeId.
const idStub = (value = 'new-1') => {
  const fn = () => { fn.calls += 1; return value; };
  fn.calls = 0;
  return fn;
};

describe('upsertNote — new note (id == null)', () => {
  test('prepends { id: makeId(), text } and keeps the original entries in order', () => {
    const list = frozenList();
    const makeId = idStub('new-1');
    const out = upsertNote(list, null, 'Delta', makeId);
    assert.equal(out.length, list.length + 1);
    assert.deepEqual(out[0], { id: 'new-1', text: 'Delta' });
    assert.deepEqual(out.slice(1), snapshot(list));
  });

  test('calls makeId exactly once', () => {
    const makeId = idStub();
    upsertNote(frozenList(), null, 'x', makeId);
    assert.equal(makeId.calls, 1);
  });

  test('undefined id is treated as a new note too', () => {
    const makeId = idStub('u-1');
    const out = upsertNote(frozenList(), undefined, 'x', makeId);
    assert.equal(out.length, 4);
    assert.deepEqual(out[0], { id: 'u-1', text: 'x' });
    assert.equal(makeId.calls, 1);
  });

  test('stores text as given (no trimming in the helper)', () => {
    const out = upsertNote([], null, '  padded  ', idStub('p'));
    assert.equal(out[0].text, '  padded  ');
  });

  test('does not mutate the input (frozen list does not throw, input unchanged)', () => {
    const list = frozenList();
    const before = snapshot(list);
    const out = upsertNote(list, null, 'Delta', idStub());
    assert.notEqual(out, list);
    assert.deepEqual(list, before);
  });
});

describe('upsertNote — existing id', () => {
  test('replaces only that entry\'s text; same length and order', () => {
    const list = frozenList();
    const out = upsertNote(list, 'a', 'Alpha 2', idStub());
    assert.deepEqual(out.map((n) => n.id), ['a', 'b', 'c']);
    assert.deepEqual(out[0], { id: 'a', text: 'Alpha 2' });
    assert.deepEqual(out[1], list[1]);
    assert.deepEqual(out[2], list[2]);
  });

  test('preserves the entry\'s other fields', () => {
    const out = upsertNote(frozenList(), 'b', 'Bravo 2', idStub());
    assert.deepEqual(out[1], { id: 'b', text: 'Bravo 2', foo: 42 });
  });

  test('the edited entry is a new object; makeId is not called', () => {
    const list = frozenList();
    const makeId = idStub();
    const out = upsertNote(list, 'b', 'Bravo 2', makeId);
    assert.notEqual(out[1], list[1]);
    assert.equal(makeId.calls, 0);
  });

  test('does not mutate the input (frozen list/entries do not throw, input unchanged)', () => {
    const list = frozenList();
    const before = snapshot(list);
    const out = upsertNote(list, 'c', 'Charlie 2', idStub());
    assert.notEqual(out, list);
    assert.deepEqual(list, before);
  });
});

describe('upsertNote — missing id', () => {
  test('returns a copy deep-equal to the input; makeId is not called', () => {
    const list = frozenList();
    const makeId = idStub();
    const out = upsertNote(list, 'zzz', 'nope', makeId);
    assert.deepEqual(out, snapshot(list));
    assert.notEqual(out, list);
    assert.equal(makeId.calls, 0);
  });
});

describe('removeNote', () => {
  test('removes the entry and keeps the remaining order', () => {
    const list = frozenList();
    const out = removeNote(list, 'b');
    assert.deepEqual(out, [{ id: 'a', text: 'Alpha' }, { id: 'c', text: 'Charlie' }]);
  });

  test('removing first and last entries', () => {
    assert.deepEqual(removeNote(frozenList(), 'a').map((n) => n.id), ['b', 'c']);
    assert.deepEqual(removeNote(frozenList(), 'c').map((n) => n.id), ['a', 'b']);
  });

  test('removing the only entry yields []', () => {
    assert.deepEqual(removeNote(Object.freeze([Object.freeze({ id: 'x', text: 't' })]), 'x'), []);
  });

  test('missing id returns a copy deep-equal to the input', () => {
    const list = frozenList();
    const out = removeNote(list, 'zzz');
    assert.deepEqual(out, snapshot(list));
    assert.notEqual(out, list);
  });

  test('does not mutate the input (frozen list does not throw, input unchanged)', () => {
    const list = frozenList();
    const before = snapshot(list);
    removeNote(list, 'a');
    assert.deepEqual(list, before);
  });
});

describe('null / undefined list is treated as []', () => {
  for (const nil of [null, undefined]) {
    test(`upsertNote(${nil}, null, …) → [{ id, text }]`, () => {
      const makeId = idStub('n-1');
      assert.deepEqual(upsertNote(nil, null, 'first', makeId), [{ id: 'n-1', text: 'first' }]);
      assert.equal(makeId.calls, 1);
    });
    test(`upsertNote(${nil}, existing-looking id, …) → []`, () => {
      const makeId = idStub();
      assert.deepEqual(upsertNote(nil, 'a', 'x', makeId), []);
      assert.equal(makeId.calls, 0);
    });
    test(`removeNote(${nil}, id) → []`, () => {
      assert.deepEqual(removeNote(nil, 'a'), []);
    });
  }
});
