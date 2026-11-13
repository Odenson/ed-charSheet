// describeRequirement — pure UI-text helper (plans/homebrew-circle-adv).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeRequirement, optionalRequirement, normalizeOptionalTable, circleRequirement } from './advancement.js';

const ref = { name: 'A', circles: [{ circle: 1, talents: ['X'] }, { circle: 2, talents: ['Y'] }] };
const table = normalizeOptionalTable({ 3: { minTalents: 6, minRank: 3, fromCircle: 2 } });

test('describeRequirement: optional row states N, rank and from-Circle with progress', () => {
  const d = describeRequirement(optionalRequirement(ref, 3, [{ name: 'X', rank: 3, circle: 1 }], table));
  assert.equal(d.text, '6 talents at rank 3, one from Circle 2');
  assert.equal(d.progress, '1/6 at rank 3');
  assert.equal(d.fromCircleMet, false);
  assert.equal(d.unresolved, false);
});

test('describeRequirement: unresolved optional has no progress number', () => {
  const d = describeRequirement(optionalRequirement(ref, 9, [], table));
  assert.equal(d.unresolved, true);
  assert.equal(d.progress, null);
});

test('describeRequirement: standard shape and null input', () => {
  const d = describeRequirement(circleRequirement(ref, 2, { X: 2 }));
  assert.equal(d.progress, '1/1');
  assert.equal(d.satisfied, true);
  assert.equal(describeRequirement(null).unresolved, true);
});
