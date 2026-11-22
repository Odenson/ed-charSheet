// ui/creation-text.test.js — run with `npm test` (node --test, no deps).
// Pins the player-facing wording of creation mode (ui/creation-text.js): every engine refusal
// code has a sentence, and the Finish confirm texts are composed only from the plan's numbers.
// No DOM, no Lit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creationRefusalText, CREATION_REASON_CODES, finishMessage, finishWarn } from './creation-text.js';

// The reason codes engine/creation.js documents (spec "Modules & functions", A5).
const ENGINE_CODES = [
  'creation-closed', 'no-change', 'bad-rank', 'over-budget', 'unknown-discipline', 'not-a-creation-talent',
  'unknown-attribute', 'out-of-range', 'unknown-skill', 'duplicate', 'not-allowed-category', 'tier-not-novice',
  'bad-text', 'generic-not-allowed', 'rank-cap', 'not-found', 'not-a-magician', 'unknown-spell', 'not-available',
  'matrix-circle', 'invalid-budget', 'already-finished', 'option-slot-full',
];

test('every engine refusal code has its own non-empty sentence', () => {
  assert.deepEqual([...CREATION_REASON_CODES].sort(), [...ENGINE_CODES].sort());
  const seen = new Set();
  for (const code of ENGINE_CODES) {
    const text = creationRefusalText(code);
    assert.ok(typeof text === 'string' && text.length > 0, code);
    assert.ok(!seen.has(text), `${code} has its own wording`);
    seen.add(text);
  }
});

test('an unknown or missing code falls back to a generic refusal', () => {
  assert.equal(creationRefusalText('something-new'), 'That change is not allowed.');
  assert.equal(creationRefusalText(undefined), 'That change is not allowed.');
});

test('finishWarn: empty when nothing is forfeited, else lists only what is', () => {
  assert.equal(finishWarn({ forfeits: { talents: 0, skills: 0, spells: 0 } }), '');
  assert.equal(finishWarn(null), '');
  assert.equal(finishWarn({ forfeits: { talents: 1, skills: 0, spells: 0 } }), '1 talent point will be forfeited.');
  assert.equal(finishWarn({ forfeits: { talents: 3, skills: 14, spells: 0 } }), '3 talent points and 14 skill ranks will be forfeited.');
  assert.equal(finishWarn({ forfeits: { talents: 8, skills: 1, spells: 2 } }), '8 talent points, 1 skill rank and 2 spell points will be forfeited.');
});

test('finishMessage: unspent attribute points become Max Karma, old to new, and ranks then cost Legend', () => {
  const text = finishMessage({ karmaBonus: 4, oldMaxKarma: 5, newMaxKarma: 9 });
  assert.match(text, /4 unused attribute points become Max Karma \(5 to 9\)/);
  assert.match(text, /costs Legend/);
  assert.doesNotMatch(text, /race maximum/);
});

test('finishMessage: the race cap is named when it held the bonus back (Troll 3 + 25 -> 20)', () => {
  const text = finishMessage({ karmaBonus: 25, oldMaxKarma: 3, newMaxKarma: 20 });
  assert.match(text, /25 unused attribute points become Max Karma \(3 to 20, held back by the race maximum\)/);
});

test('finishMessage: no leftovers, one leftover, and a race with no Karma Modifier', () => {
  assert.match(finishMessage({ karmaBonus: 0, oldMaxKarma: 4, newMaxKarma: 4 }), /No attribute points are left over/);
  assert.match(finishMessage({ karmaBonus: 1, oldMaxKarma: 4, newMaxKarma: 5 }), /Your 1 unused attribute point becomes Max Karma \(4 to 5\)/);
  const noKarma = finishMessage({ karmaBonus: 6, oldMaxKarma: null, newMaxKarma: null });
  assert.match(noKarma, /6 unused attribute points become Max Karma\./);
  assert.doesNotMatch(noKarma, /\(.* to .*\)/);
});

import { guideIntro, guideSteps } from './creation-text.js';

test('guideSteps: Overview, Disciplines, Equipment, Finish for a non-magician; Spells joins for a magician', () => {
  assert.deepEqual(guideSteps({ magician: false }).map((s) => s.where), ['Overview', 'Disciplines', 'Equipment', 'Finish']);
  assert.deepEqual(guideSteps({ magician: true }).map((s) => s.where), ['Overview', 'Disciplines', 'Spells', 'Equipment', 'Finish']);
  assert.deepEqual(guideSteps().map((s) => s.where), ['Overview', 'Disciplines', 'Equipment', 'Finish']);
});

test('guideIntro names the character, or falls back', () => {
  assert.match(guideIntro('Fighter'), /^Fighter is saved/);
  assert.match(guideIntro(''), /^Your character is saved/);
});
