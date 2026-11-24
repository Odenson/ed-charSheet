// ui/active-effects-state.test.js — run with `npm test` (node --test, no deps).
// plans/active-condition-window: pure view helpers behind <ed-active-effects>.
// No DOM, no Lit. Expected to fail until ui/active-effects-state.js exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewGroups, roundsPillText, endButtonLabel } from './active-effects-state.js';

const e = (o = {}) => ({
  id: 'spell:Haste', kind: 'spell', side: 'you', name: 'Haste', roundsLeft: 5, roundsTotal: 10,
  pct: 50, low: false, chips: [], endable: true, endAction: { kind: 'spell', id: 'spell:Haste' }, ...o,
});

test('viewGroups columns keeps all three groups even when empty', () => {
  const g = viewGroups([], 'columns');
  assert.deepEqual(g.map((x) => x.side), ['atk', 'you', 'tgt']);
  assert.ok(g.every((x) => x.items.length === 0));
});

test('viewGroups stack omits empty groups', () => {
  const g = viewGroups([e(), e({ id: 'opp:1', side: 'tgt', kind: 'talent', name: 'Taunt' })], 'stack');
  assert.deepEqual(g.map((x) => x.side), ['you', 'tgt']);
  assert.deepEqual(viewGroups([], 'stack'), []);
});

test('viewGroups buckets items by side and keeps entry order', () => {
  const list = [e({ id: 'a' }), e({ id: 'b', side: 'atk', kind: 'option' }), e({ id: 'c' })];
  const g = viewGroups(list, 'columns');
  assert.deepEqual(g.find((x) => x.side === 'you').items.map((i) => i.id), ['a', 'c']);
  assert.deepEqual(g.find((x) => x.side === 'atk').items.map((i) => i.id), ['b']);
  assert.ok(g.every((x) => typeof x.label === 'string'));
});

test('viewGroups tolerates undefined effects', () => {
  assert.equal(viewGroups(undefined, 'columns').length, 3);
  assert.deepEqual(viewGroups(undefined, 'stack'), []);
});

test('roundsPillText: counted -> "N rds"; round-free attack -> "this attack"; other round-free -> "active"', () => {
  assert.equal(roundsPillText(e({ roundsLeft: 4 })), '4 rds');
  assert.equal(roundsPillText(e({ side: 'atk', kind: 'option', roundsLeft: null, roundsTotal: null })), 'this attack');
  assert.equal(roundsPillText(e({ side: 'you', kind: 'situation', roundsLeft: null, roundsTotal: null })), 'active');
  assert.equal(roundsPillText(e({ side: 'you', kind: 'condition', roundsLeft: null, roundsTotal: null })), 'active');
});

test('endButtonLabel is "End <name>"', () => {
  assert.equal(endButtonLabel(e({ name: 'Haste' })), 'End Haste');
  assert.equal(endButtonLabel(e({ name: 'Taunt' })), 'End Taunt');
});
