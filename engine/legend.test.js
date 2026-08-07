// engine/legend.test.js — run with `npm test` (node --test, no deps).
// Covers the pure Legend derivations against the real rules/legend.json bands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legendAvailable, legendaryStatus } from './legend.js';

const bands = JSON.parse(readFileSync(new URL('../rules/legend.json', import.meta.url))).bands;

// --- legendAvailable ----------------------------------------------------------

test('legendAvailable = totalEarnt − totalSpent (Chakka anchor)', () => {
  assert.equal(legendAvailable(45315, 44661), 654);
});

test('legendAvailable treats missing spent as 0, missing earned as null', () => {
  assert.equal(legendAvailable(100), 100);
  assert.equal(legendAvailable(0, 0), 0);
  assert.equal(legendAvailable(null, 10), null);
  assert.equal(legendAvailable(undefined), null);
});

// --- legendaryStatus ----------------------------------------------------------

test('legendaryStatus picks the band by total earned', () => {
  assert.equal(legendaryStatus(0, bands).label, 'Unknown');
  assert.equal(legendaryStatus(9999, bands).label, 'Unknown');
  assert.equal(legendaryStatus(10000, bands).label, 'Recognised'); // boundary → next band
  assert.equal(legendaryStatus(45315, bands).label, 'Recognised'); // Chakka
  assert.equal(legendaryStatus(100000, bands).label, 'Famous');
  assert.equal(legendaryStatus(999999, bands).label, 'Famous');
  assert.equal(legendaryStatus(1000000, bands).label, 'Legends'); // open-topped
  assert.equal(legendaryStatus(50000000, bands).label, 'Legends');
});

test('legendaryStatus carries the rulebook Renown/Reputation', () => {
  const s = legendaryStatus(45315, bands);
  assert.equal(s.renown, 12);
  assert.equal(s.reputation, 2);
});

test('legendaryStatus guards missing input', () => {
  assert.equal(legendaryStatus(null, bands), null);
  assert.equal(legendaryStatus(100, []), null);
  assert.equal(legendaryStatus(100, undefined), null);
});
