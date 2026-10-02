// engine/spells-options.test.js — spell-extra-weave-and-extra-cast.
// Applied options (extra-thread picks + success-level option) and boosted
// duration, composed by the pure engine. Rules: plans/.../rules.md R1-R4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appliedOptions,
  boostedDuration,
  otherCastOutcome,
  buildActiveSpell,
  tickActiveSpells,
  buildSpellsContext,
} from './spells.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));
const pain = () => spellsFile.spells.Pain;
const WOUND = 'Increase Effect (+1 Wound)';
const RANGE = 'Increase Range (+10 yards)';
const DUR = 'Increase Duration (+2 rounds)';
const rec = (o = {}) => ({ seq: 1, name: 'Pain', target: 9, total: 14, levels: 3, extraPicks: [], effectTotal: null, ...o });

// ---- appliedOptions ----

test('appliedOptions: Pain, one pick, 2 successes -> pick + success x1 (R1, R2)', () => {
  const o = appliedOptions(pain(), [WOUND], 2);
  assert.deepEqual(o.picks, [{ label: WOUND, count: 1 }]);
  assert.deepEqual(o.success, { label: DUR, mult: 1 });
});

test('appliedOptions: 3 successes -> mult 2; 1 success -> null (R1)', () => {
  assert.equal(appliedOptions(pain(), [], 3).success.mult, 2);
  assert.equal(appliedOptions(pain(), [], 1).success, null);
});

test('appliedOptions: levels 0 / null / undefined never negative, success null', () => {
  for (const l of [0, null, undefined]) {
    assert.equal(appliedOptions(pain(), [], l).success, null);
  }
});

test('appliedOptions: repeats stack with counts, first-seen order, distinct combine (R2)', () => {
  const o = appliedOptions(pain(), [RANGE, WOUND, RANGE], 1);
  assert.deepEqual(o.picks, [{ label: RANGE, count: 2 }, { label: WOUND, count: 1 }]);
});

test('appliedOptions: unknown label listed with count 1; absent picks -> []', () => {
  assert.deepEqual(appliedOptions(pain(), ['Stale'], 1).picks, [{ label: 'Stale', count: 1 }]);
  assert.deepEqual(appliedOptions(pain(), undefined, 1).picks, []);
});

test('appliedOptions: spell without successes -> success null, no throw', () => {
  const sp = { ...pain(), successes: [] };
  assert.equal(appliedOptions(sp, [], 4).success, null);
  const sp2 = { name: 'X', duration: 'Rank rounds' };
  assert.doesNotThrow(() => appliedOptions(sp2, [], 3));
});

test('appliedOptions: does not mutate inputs', () => {
  const sp = structuredClone(pain());
  const snap = structuredClone(sp);
  const picks = [WOUND, WOUND];
  appliedOptions(sp, picks, 3);
  assert.deepEqual(sp, snap);
  assert.deepEqual(picks, [WOUND, WOUND]);
});

// ---- boostedDuration ----

test('boostedDuration: Pain rank 5 boost 2 -> 7 rounds (Rank 5 + 2) (R3)', () => {
  const d = boostedDuration(pain(), 5, 2);
  assert.equal(d.label, 'Rank rounds');
  assert.equal(d.base, 5);
  assert.equal(d.boost, 2);
  assert.equal(d.rounds, 7);
  assert.equal(d.text, '7 rounds (Rank 5 + 2)');
});

test('boostedDuration: boost 0 omits "+ boost"', () => {
  assert.equal(boostedDuration(pain(), 5, 0).text, '5 rounds (Rank 5)');
  assert.equal(boostedDuration(pain(), 5, 4).text, '9 rounds (Rank 5 + 4)');
});

test('boostedDuration: minutes duration converts via durationRounds (1 min = 10 rounds)', () => {
  const sp = { name: 'S', duration: 'Rank minutes' };
  const d = boostedDuration(sp, 3, 40);
  assert.equal(d.base, 30);
  assert.equal(d.rounds, 70);
});

test('boostedDuration: fixed rounds, no boost -> no parentheses', () => {
  const d = boostedDuration({ name: 'F', duration: '2 rounds' }, 5, 0);
  assert.equal(d.rounds, 2);
  assert.equal(d.text, '2 rounds');
  assert.ok(!d.text.includes('('));
});

test('boostedDuration: fixed rounds with boost shows base + boost, never "Rank"', () => {
  const d = boostedDuration({ name: 'F', duration: '2 rounds' }, 5, 2);
  assert.equal(d.rounds, 4);
  assert.ok(!/Rank/.test(d.text));
  assert.equal(d.text, '4 rounds (2 + 2)');
});

test('boostedDuration: non-round duration -> rounds/base null, text = spell.duration', () => {
  const d = boostedDuration({ name: 'M', duration: 'Rank months' }, 5, 2);
  assert.equal(d.rounds, null);
  assert.equal(d.base, null);
  assert.equal(d.text, 'Rank months');
  assert.equal(d.label, 'Rank months');
});

test('boostedDuration: rank null / 0 / undefined -> fallback text, never "Rank 0"', () => {
  for (const r of [null, 0, undefined]) {
    const d = boostedDuration(pain(), r, 2);
    assert.equal(d.rounds, null);
    assert.equal(d.base, null);
    assert.equal(d.text, 'Rank rounds');
    assert.ok(!/Rank 0/.test(d.text));
  }
});

test('boostedDuration: falsy spell.duration -> null', () => {
  assert.equal(boostedDuration({ name: 'N', duration: null }, 5, 0), null);
  assert.equal(boostedDuration({ name: 'N', duration: '' }, 5, 0), null);
});

// ---- otherCastOutcome ----

test('otherCastOutcome: Pain example, rank 5, +1 Wound pick, 2 successes (R1, R3, R4)', () => {
  const o = otherCastOutcome(pain(), rec({ levels: 2, extraPicks: [WOUND] }), { rank: 5 });
  assert.deepEqual(o.picks, [{ label: WOUND, count: 1 }]);
  assert.deepEqual(o.success, { label: DUR, mult: 1 });
  assert.equal(o.duration.rounds, 7);
  assert.equal(o.duration.text, '7 rounds (Rank 5 + 2)');
  assert.equal(o.duration.label, 'Rank rounds');
  assert.ok(o.text.includes(`Success option: ${DUR}`));
  assert.ok(!o.text.includes(`${DUR} ×`));
  assert.ok(o.text.includes('Duration 7 rounds (Rank 5 + 2)'));
  assert.ok(o.text.includes(WOUND));
});

test('otherCastOutcome: 1 success -> no success option, unboosted duration', () => {
  const o = otherCastOutcome(pain(), rec({ levels: 1, extraPicks: [WOUND] }), { rank: 5 });
  assert.equal(o.success, null);
  assert.equal(o.duration.text, '5 rounds (Rank 5)');
  assert.ok(!o.text.includes('Success option'));
});

test('otherCastOutcome: 3 successes -> mult 2, +4 rounds, text carries x2', () => {
  const o = otherCastOutcome(pain(), rec({ levels: 3 }), { rank: 5 });
  assert.deepEqual(o.success, { label: DUR, mult: 2 });
  assert.equal(o.duration.text, '9 rounds (Rank 5 + 4)');
  assert.ok(o.text.includes(`Success option: ${DUR} ×2`));
});

test('otherCastOutcome: miss -> success null, picks empty, duration null', () => {
  const o = otherCastOutcome(pain(), rec({ levels: 0, extraPicks: [WOUND] }), { rank: 5 });
  assert.equal(o.success, null);
  assert.deepEqual(o.picks, []);
  assert.equal(o.duration, null);
});

test('otherCastOutcome: no opts / no rank -> rounds null, text falls back to spell text', () => {
  for (const opts of [undefined, {}, { rank: null }, { rank: 0 }]) {
    const o = otherCastOutcome(pain(), rec({ levels: 3 }), opts);
    assert.equal(o.duration.rounds, null);
    assert.equal(o.duration.text, 'Rank rounds');
    assert.ok(o.text.includes('Duration Rank rounds'));
    assert.deepEqual(o.success, { label: DUR, mult: 2 }); // options still listed
  }
});

test('otherCastOutcome: unknown pick listed, adds no duration boost', () => {
  const o = otherCastOutcome(pain(), rec({ levels: 1, extraPicks: ['Stale'] }), { rank: 5 });
  assert.deepEqual(o.picks, [{ label: 'Stale', count: 1 }]);
  assert.equal(o.duration.rounds, 5);
});

test('otherCastOutcome: non-round duration keeps spell text', () => {
  const sp = { ...pain(), duration: 'Rank months' };
  const o = otherCastOutcome(sp, rec({ levels: 3 }), { rank: 5 });
  assert.equal(o.duration.rounds, null);
  assert.equal(o.duration.text, 'Rank months');
});

// ---- buildActiveSpell / tick ----

test('buildActiveSpell: Pain self-cast pick + 2 successes -> options and boosted rounds (R4)', () => {
  const s = buildActiveSpell(pain(), 5, { extraPicks: [WOUND], successLevels: 2 });
  assert.deepEqual(s.options.picks, [{ label: WOUND, count: 1 }]);
  assert.deepEqual(s.options.success, { label: DUR, mult: 1 });
  assert.equal(s.roundsTotal, 7);
  assert.equal(s.roundsLeft, 7);
});

test('buildActiveSpell: plain cast -> empty picks, null success; unchanged rounds', () => {
  const s = buildActiveSpell(pain(), 5, {});
  assert.deepEqual(s.options, { picks: [], success: null });
  assert.equal(s.roundsTotal, 5);
  const s2 = buildActiveSpell(pain(), 5);
  assert.deepEqual(s2.options, { picks: [], success: null });
});

test('tickActiveSpells preserves options', () => {
  const s = buildActiveSpell(pain(), 5, { extraPicks: [WOUND, WOUND], successLevels: 3 });
  const [t] = tickActiveSpells([s]);
  assert.equal(t.roundsLeft, s.roundsLeft - 1);
  assert.deepEqual(t.options, s.options);
  assert.deepEqual(t.options.picks, [{ label: WOUND, count: 2 }]);
});

// ---- buildSpellsContext.castingRank ----

const character = { spells: { known: [{ name: 'Pain', learntSuccess: 2 }], matrices: [] } };
const disc = (name, talents) => ({ name, circle: 3, talents });

test('buildSpellsContext: castingRank equals the Spellcasting talent rank', () => {
  const derived = { disciplines: [disc('Nethermancer', [
    { name: 'Thread Weaving (Nethermancer)', step: 9, rank: 4 },
    { name: 'Spellcasting', step: 8, rank: 5 },
  ])], attrStepByName: {} };
  assert.equal(buildSpellsContext(character, spellsFile, derived).castingRank, 5);
});

test('buildSpellsContext: castingRank is the first-match discipline\'s Spellcasting rank', () => {
  const derived = { disciplines: [
    disc('Nethermancer', [{ name: 'Spellcasting', step: 8, rank: 5 }]),
    disc('Wizard', [{ name: 'Spellcasting', step: 9, rank: 7 }]),
  ], attrStepByName: {} };
  assert.equal(buildSpellsContext(character, spellsFile, derived).castingRank, 5);
});

test('buildSpellsContext: castingRank null without the talent or with a missing rank', () => {
  const none = { disciplines: [disc('Nethermancer', [{ name: 'Thread Weaving (Nethermancer)', step: 9 }])], attrStepByName: {} };
  assert.equal(buildSpellsContext(character, spellsFile, none).castingRank, null);
  const noRank = { disciplines: [disc('Nethermancer', [{ name: 'Spellcasting', step: 8 }])], attrStepByName: {} };
  assert.equal(buildSpellsContext(character, spellsFile, noRank).castingRank, null);
});
