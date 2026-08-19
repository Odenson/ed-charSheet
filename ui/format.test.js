// ui/format.test.js — run with `npm test` (node --test, no deps).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numFmt, cap, prettyName, humanize } from './format.js';

test('numFmt rounds to 2dp and thousand-separates', () => {
  assert.equal(numFmt(0.8), '0.8');
  assert.equal(numFmt(25), '25');
  assert.equal(numFmt(0.875), '0.88');
  assert.equal(numFmt(1234.5), '1,234.5');
  assert.equal(numFmt(undefined), '0');
});

test('cap uppercases the first character only', () => {
  assert.equal(cap('scarce'), 'Scarce');
  assert.equal(cap(''), '');
  assert.equal(cap(null), null);
});

test('prettyName splits camelCase', () => {
  assert.equal(prettyName('shortRange'), 'short Range');
  assert.equal(prettyName(''), '');
  assert.equal(prettyName(undefined), '');
});

test('humanize = cap + prettyName', () => {
  assert.equal(humanize('sourceSheetVersion'), 'Source Sheet Version');
});
