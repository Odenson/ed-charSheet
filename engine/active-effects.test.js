// engine/active-effects.test.js — run with `npm test` (node --test, no deps).
// plans/active-condition-window: the pure unified active-effects list, grouper and
// session reducers. Rules values come from spec.md -> Rules (R1 Taunt, R2 Aim,
// R3 spell rounds: minutes x10 / hours x600, tick per Initiative, R5 options).
// Expected to fail until engine/active-effects.js exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROUPS,
  buildActiveEffectsList,
  groupEffects,
  addOpponentEffect,
  tickOpponentEffects,
  endEffect,
  clearAll,
  armOpponent,
  otherCastToRecord,
  setOtherCastEffect,
} from './active-effects.js';
import { otherCastOutcome } from './spells.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));

const build = (o = {}) => buildActiveEffectsList({
  spells: [], opponent: [], armed: [], options: [], charms: [], situations: [],
  knockedDown: false, encumbranceHarried: false, ...o,
});
const spell = (o = {}) => ({
  name: 'Haste', effectLabel: '+2 Physical Defense', roundsLeft: 5, roundsTotal: 10,
  options: { picks: [], success: null }, ...o,
});
const opp = (o = {}) => ({
  id: 'opp:1', kind: 'talent', name: 'Taunt', effectLabel: '2 successes',
  text: 'Per success the target gets -1 to tests and -1 Social Defense for Rank rounds.',
  targetName: 'Bob', roundsLeft: 4, roundsTotal: 4, ...o,
});
const byId = (list, id) => list.find((e) => e.id === id);
const emptyState = (o = {}) => ({
  activeSpells: [], opponentEffects: [], armedTalents: [], toggledOptions: [], activeCharms: [], ...o,
});

// ---- GROUPS / empty -------------------------------------------------------

test('GROUPS lists the three lifetime groups in order', () => {
  assert.deepEqual(GROUPS.map((g) => g.side), ['atk', 'you', 'tgt']);
  assert.equal(GROUPS.length, 3);
  assert.ok(GROUPS.every((g) => typeof g.label === 'string' && g.label.length));
});

test('empty sources -> empty list; groupEffects([]) keeps three empty groups', () => {
  assert.deepEqual(build(), []);
  const g = groupEffects([]);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((x) => x.side), ['atk', 'you', 'tgt']);
  assert.ok(g.every((x) => Array.isArray(x.items) && x.items.length === 0));
  assert.ok(g.every((x) => typeof x.label === 'string'));
});

// ---- per-source entries -----------------------------------------------------

test('self spell -> kind spell, side you, id spell:<name>, endable, rounds/pct/low', () => {
  const list = build({ spells: [spell()] });
  assert.equal(list.length, 1);
  const e = list[0];
  assert.equal(e.id, 'spell:Haste');
  assert.equal(e.kind, 'spell');
  assert.equal(e.side, 'you');
  assert.equal(e.name, 'Haste');
  assert.equal(e.effectLabel, '+2 Physical Defense');
  assert.equal(e.roundsLeft, 5);
  assert.equal(e.roundsTotal, 10);
  assert.equal(e.pct, 50);
  assert.equal(e.low, false);
  assert.equal(e.endable, true);
  assert.equal(e.endAction.kind, 'spell');
});

test('low flag: roundsLeft 3 is low, 4 is not (R3 display threshold)', () => {
  const l3 = build({ spells: [spell({ roundsLeft: 3, roundsTotal: 10 })] })[0];
  const l4 = build({ spells: [spell({ roundsLeft: 4, roundsTotal: 10 })] })[0];
  assert.equal(l3.low, true);
  assert.equal(l4.low, false);
});

test('spell with chosen object appends the chosen name; chips from picks and success', () => {
  const e = build({
    spells: [spell({
      chosen: { name: 'Longsword', index: 0 },
      options: { picks: [{ label: 'Increase Range', count: 2 }, { label: 'Other', count: 1 }], success: { label: 'Duration', mult: 2 } },
    })],
  })[0];
  assert.ok(e.name.includes('Haste') && e.name.includes('Longsword'));
  const labels = e.chips.map((c) => c.label);
  assert.deepEqual(labels, ['Increase Range', 'Other', 'Duration']);
  assert.equal(e.chips[0].count, 2);
  assert.ok(!(e.chips[1].count > 1));
  assert.equal(e.chips[2].count, 2);
});

test('a spell with no countdown is round-free: pct 100, low false', () => {
  const e = build({ spells: [spell({ roundsLeft: null, roundsTotal: null })] })[0];
  assert.equal(e.roundsLeft, null);
  assert.equal(e.pct, 100);
  assert.equal(e.low, false);
});

test('armed Aim -> kind talent, side you, id talent:<name>, endable; fallback label is the success count text', () => {
  const e = build({ armed: [{ name: 'Mystic Aim', successes: 2, roundsLeft: 1, roundsTotal: 1, effects: [] }] })[0];
  assert.equal(e.id, 'talent:Mystic Aim');
  assert.equal(e.kind, 'talent');
  assert.equal(e.side, 'you');
  assert.equal(e.roundsLeft, 1);
  assert.equal(e.roundsTotal, 1);
  assert.equal(e.endable, true);
  assert.equal(e.endAction.kind, 'talent');
  assert.equal(e.effectLabel, '2 successes');
});

test('an armed record flagged opponent is skipped defensively', () => {
  const list = build({ armed: [{ name: 'Taunt', opponent: true, successes: 2, roundsLeft: 3, roundsTotal: 3 }] });
  assert.deepEqual(list, []);
});

test('opponent record -> side tgt, kind from record, targetName, text, endable', () => {
  const e = build({ opponent: [opp()] })[0];
  assert.equal(e.id, 'opp:1');
  assert.equal(e.kind, 'talent');
  assert.equal(e.side, 'tgt');
  assert.equal(e.name, 'Taunt');
  assert.equal(e.targetName, 'Bob');
  assert.equal(e.text, opp().text);
  assert.equal(e.roundsLeft, 4);
  assert.equal(e.endable, true);
});

test('blank opponent targetName falls back to "target" (or the supplied fallback)', () => {
  assert.equal(build({ opponent: [opp({ targetName: '' })] })[0].targetName, 'target');
  assert.equal(build({ opponent: [opp({ targetName: null })] })[0].targetName, 'target');
  assert.equal(
    build({ opponent: [opp({ targetName: '' })], targetNameFallback: 'foe' })[0].targetName,
    'foe',
  );
});

test('toggled option -> kind option, side atk, round-free, endable', () => {
  const e = build({ options: [{ name: 'Aggressive Attack', summary: 'x' }] })[0];
  assert.equal(e.id, 'option:Aggressive Attack');
  assert.equal(e.kind, 'option');
  assert.equal(e.side, 'atk');
  assert.equal(e.roundsLeft, null);
  assert.equal(e.roundsTotal, null);
  assert.equal(e.pct, 100);
  assert.equal(e.low, false);
  assert.equal(e.endable, true);
  assert.equal(e.endAction.kind, 'option');
});

test('active charm -> kind charm, side atk, endable', () => {
  const e = build({ charms: [{ name: 'Blood Charm A', summary: 's' }] })[0];
  assert.equal(e.id, 'charm:Blood Charm A');
  assert.equal(e.kind, 'charm');
  assert.equal(e.side, 'atk');
  assert.equal(e.endable, true);
  assert.equal(e.endAction.kind, 'charm');
});

test('situation -> kind situation, side you, round-free, endable', () => {
  const e = build({ situations: [{ name: 'Surprised', summary: 's' }] })[0];
  assert.equal(e.id, 'situation:Surprised');
  assert.equal(e.kind, 'situation');
  assert.equal(e.side, 'you');
  assert.equal(e.roundsLeft, null);
  assert.equal(e.endable, true);
  assert.equal(e.endAction.kind, 'situation');
});

test('Knocked Down is a locked condition: not endable, no endAction', () => {
  const e = build({ knockedDown: true })[0];
  assert.equal(e.id, 'condition:Knocked Down');
  assert.equal(e.kind, 'condition');
  assert.equal(e.side, 'you');
  assert.equal(e.name, 'Knocked Down');
  assert.equal(e.endable, false);
  assert.equal(e.endAction, null);
});

test('encumbrance Harried is a locked condition', () => {
  const e = build({ encumbranceHarried: true })[0];
  assert.equal(e.id, 'condition:Encumbered Harried');
  assert.equal(e.kind, 'condition');
  assert.equal(e.name, 'Harried');
  assert.equal(e.effectLabel, 'encumbrance');
  assert.equal(e.endable, false);
  assert.equal(e.endAction, null);
});

test('conditions absent when flags are false/undefined', () => {
  assert.deepEqual(build({ knockedDown: false, encumbranceHarried: false }), []);
});

// ---- grouping / order -------------------------------------------------------

test('list order: atk, then you, then tgt; source order within "you"', () => {
  const list = build({
    spells: [spell()],
    opponent: [opp()],
    armed: [{ name: 'Mystic Aim', successes: 1, roundsLeft: 1, roundsTotal: 1 }],
    options: [{ name: 'Aggressive Attack', summary: '' }],
    charms: [{ name: 'Blood Charm A', summary: '' }],
    situations: [{ name: 'Surprised', summary: '' }],
    knockedDown: true,
    encumbranceHarried: true,
  });
  const sides = list.map((e) => e.side);
  const rank = { atk: 0, you: 1, tgt: 2 };
  assert.deepEqual(sides, [...sides].sort((a, b) => rank[a] - rank[b]), 'sides are grouped in GROUPS order');
  const you = list.filter((e) => e.side === 'you').map((e) => e.id);
  assert.deepEqual(you, ['spell:Haste', 'talent:Mystic Aim', 'situation:Surprised', 'condition:Knocked Down', 'condition:Encumbered Harried']);
  assert.deepEqual(list.filter((e) => e.side === 'atk').map((e) => e.kind).sort(), ['charm', 'option']);
  assert.deepEqual(list.filter((e) => e.side === 'tgt').map((e) => e.id), ['opp:1']);
});

test('opponent entries keep insertion order and ids stay distinct (two Taunts coexist)', () => {
  const list = build({
    opponent: [opp({ id: 'opp:1', targetName: 'Bob' }), opp({ id: 'opp:2', targetName: 'Bob' }), opp({ id: 'opp:3', targetName: 'Ann' })],
  });
  assert.deepEqual(list.map((e) => e.id), ['opp:1', 'opp:2', 'opp:3']);
});

test('builder is deterministic and does not mutate its inputs', () => {
  const input = { spells: [spell()], opponent: [opp()] };
  const snap = JSON.stringify(input);
  const a = build(input);
  const b = build(input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input), snap);
});

test('groupEffects buckets entries by side with the GROUPS labels, keeping empty groups', () => {
  const list = build({ spells: [spell()], opponent: [opp()] });
  const g = groupEffects(list);
  assert.deepEqual(g.map((x) => x.side), ['atk', 'you', 'tgt']);
  assert.deepEqual(g.map((x) => x.label), GROUPS.map((x) => x.label));
  assert.equal(g[0].items.length, 0);
  assert.deepEqual(g[1].items.map((e) => e.id), ['spell:Haste']);
  assert.deepEqual(g[2].items.map((e) => e.id), ['opp:1']);
});

// ---- reducers: add / tick ---------------------------------------------------

test('addOpponentEffect appends without dedupe and never mutates', () => {
  const l0 = [opp({ id: 'opp:1' })];
  const l1 = addOpponentEffect(l0, opp({ id: 'opp:2' }));
  assert.equal(l0.length, 1);
  assert.deepEqual(l1.map((r) => r.id), ['opp:1', 'opp:2']);
  const l2 = addOpponentEffect(l1, opp({ id: 'opp:3' }));
  assert.equal(l2.length, 3);
});

test('tickOpponentEffects decrements, drops those reaching 0, leaves no roundsLeft <= 0, no mutation', () => {
  const l0 = [opp({ id: 'opp:1', roundsLeft: 1 }), opp({ id: 'opp:2', roundsLeft: 3, roundsTotal: 3 })];
  const snap = JSON.stringify(l0);
  const l1 = tickOpponentEffects(l0);
  assert.equal(JSON.stringify(l0), snap);
  assert.deepEqual(l1.map((r) => [r.id, r.roundsLeft]), [['opp:2', 2]]);
  assert.ok(tickOpponentEffects(l1).every((r) => r.roundsLeft > 0));
  assert.deepEqual(tickOpponentEffects([]), []);
});

test('tickOpponentEffects: a Taunt of rank N lasts exactly N ticks (R1)', () => {
  let l = [opp({ roundsLeft: 3, roundsTotal: 3 })];
  l = tickOpponentEffects(l);
  l = tickOpponentEffects(l);
  assert.equal(l.length, 1);
  l = tickOpponentEffects(l);
  assert.equal(l.length, 0);
});

// ---- reducers: endEffect ----------------------------------------------------

test('endEffect(spell): removes that active spell only (via the entry endAction)', () => {
  const spells = [spell({ name: 'Haste' }), spell({ name: 'Armor' })];
  const entry = byId(build({ spells }), 'spell:Haste');
  const { state, action } = endEffect(emptyState({ activeSpells: spells }), entry.endAction);
  assert.deepEqual(state.activeSpells.map((s) => s.name), ['Armor']);
  assert.equal(action, null);
});

test('endEffect(opponent): removes that record by id, others stay', () => {
  const opponentEffects = [opp({ id: 'opp:1' }), opp({ id: 'opp:2' })];
  const entry = byId(build({ opponent: opponentEffects }), 'opp:2');
  const { state, action } = endEffect(emptyState({ opponentEffects }), entry.endAction);
  assert.deepEqual(state.opponentEffects.map((r) => r.id), ['opp:1']);
  assert.equal(action, null);
});

test('endEffect(talent): removes the armed talent by name', () => {
  const armedTalents = [{ name: 'Mystic Aim', successes: 1, roundsLeft: 1, roundsTotal: 1 }];
  const entry = byId(build({ armed: armedTalents }), 'talent:Mystic Aim');
  const { state } = endEffect(emptyState({ armedTalents }), entry.endAction);
  assert.deepEqual(state.armedTalents, []);
});

test('endEffect(option): removes the name from toggledOptions', () => {
  const entry = byId(build({ options: [{ name: 'Aggressive Attack', summary: '' }] }), 'option:Aggressive Attack');
  const { state } = endEffect(emptyState({ toggledOptions: ['Aggressive Attack', 'Defensive Stance'] }), entry.endAction);
  assert.deepEqual(state.toggledOptions, ['Defensive Stance']);
});

test('endEffect(charm): deactivates only - activeCharms loses the name, nothing else changes', () => {
  const entry = byId(build({ charms: [{ name: 'Blood Charm A', summary: '' }] }), 'charm:Blood Charm A');
  const before = emptyState({
    activeCharms: ['Blood Charm A', 'Blood Charm B'],
    activeSpells: [spell()],
    toggledOptions: ['Aggressive Attack'],
  });
  const { state, action } = endEffect(before, entry.endAction);
  assert.deepEqual(state.activeCharms, ['Blood Charm B']);
  assert.deepEqual(state.activeSpells, before.activeSpells);
  assert.deepEqual(state.toggledOptions, before.toggledOptions);
  assert.equal(action, null);
});

test('endEffect(situation): state unchanged, returns the toggle-situation action', () => {
  const entry = byId(build({ situations: [{ name: 'Surprised', summary: '' }] }), 'situation:Surprised');
  const before = emptyState({ activeSpells: [spell()] });
  const { state, action } = endEffect(before, entry.endAction);
  assert.deepEqual(state, before);
  assert.deepEqual(action, { type: 'toggle-situation', name: 'Surprised' });
});

test('endEffect(condition): no-op with null action', () => {
  const before = emptyState({ activeSpells: [spell()] });
  const { state, action } = endEffect(before, { kind: 'condition', id: 'condition:Knocked Down' });
  assert.deepEqual(state, before);
  assert.equal(action, null);
});

test('endEffect with an unknown id leaves the state unchanged', () => {
  const before = emptyState({
    activeSpells: [spell()], opponentEffects: [opp()], toggledOptions: ['Aggressive Attack'], activeCharms: ['Blood Charm A'],
  });
  for (const k of ['spell', 'talent', 'option', 'charm']) {
    const { state, action } = endEffect(before, { kind: k, id: `${k}:Nope` });
    assert.deepEqual(state, before, `${k} unknown id`);
    assert.equal(action, null);
  }
  assert.deepEqual(endEffect(before, { kind: 'spell', id: 'opp:99' }).state.opponentEffects, before.opponentEffects);
});

test('endEffect never mutates its input state', () => {
  const before = emptyState({ activeSpells: [spell()], toggledOptions: ['A'] });
  const snap = JSON.stringify(before);
  const entry = byId(build({ spells: before.activeSpells }), 'spell:Haste');
  endEffect(before, entry.endAction);
  assert.equal(JSON.stringify(before), snap);
});

test('clearAll empties opponent effects and toggled options', () => {
  assert.deepEqual(clearAll(), { opponentEffects: [], toggledOptions: [] });
});

// ---- armOpponent (Taunt) ----------------------------------------------------

test('armOpponent: a hit makes one tgt-bound record, rounds = arms.rounds (R1)', () => {
  const r = armOpponent({
    arms: { opponent: true, rounds: 3, text: 'T' }, successes: 2, targetName: 'Bob', seq: 7,
  });
  assert.equal(r.id, 'opp:7');
  assert.equal(r.kind, 'talent');
  assert.equal(r.targetName, 'Bob');
  assert.equal(r.roundsLeft, 3);
  assert.equal(r.roundsTotal, 3);
  assert.equal(r.effectLabel, '2 successes');
  assert.equal(r.text, 'T');
});

test('armOpponent: one success reads "1 success"', () => {
  const r = armOpponent({ arms: { opponent: true, rounds: 2, text: 'T' }, successes: 1, targetName: '', seq: 1 });
  assert.equal(r.effectLabel, '1 success');
});

test('armOpponent: a miss (0 successes) or non-opponent arms -> null', () => {
  assert.equal(armOpponent({ arms: { opponent: true, rounds: 2, text: 'T' }, successes: 0, targetName: '', seq: 1 }), null);
  assert.equal(armOpponent({ arms: { opponent: false, rounds: 1 }, successes: 2, targetName: '', seq: 1 }), null);
  assert.equal(armOpponent({ arms: { rounds: 1 }, successes: 2, targetName: '', seq: 1 }), null);
});

// ---- otherCastToRecord ------------------------------------------------------

const cast = (o = {}) => ({ name: 'Slowly', target: 9, total: 14, levels: 1, extraPicks: [], effectTotal: null, ...o });
const synth = (duration) => ({ name: 'Slowly', duration, effects: [] });
const recFor = (sp, c, rank = 3, extra = {}) => otherCastToRecord({
  outcome: otherCastOutcome(sp, c, { rank }), spell: sp, seq: 5, targetName: 'Bob', ...extra,
});

test('otherCastToRecord: hit with a rounds duration -> spell record, side-tgt shape', () => {
  const r = recFor(synth('3 rounds'), cast());
  assert.equal(r.id, 'opp:5');
  assert.equal(r.kind, 'spell');
  assert.equal(r.name, 'Slowly');
  assert.equal(r.targetName, 'Bob');
  assert.equal(r.roundsLeft, 3);
  assert.equal(r.roundsTotal, 3);
  assert.equal(typeof r.text, 'string');
});

test('otherCastToRecord: minutes are x10 rounds, hours x600 (R3), converted once', () => {
  assert.equal(recFor(synth('2 minutes'), cast()).roundsLeft, 20);
  assert.equal(recFor(synth('1 hour'), cast()).roundsLeft, 600);
});

test('otherCastToRecord: "Rank rounds" uses the caster rank', () => {
  assert.equal(recFor(synth('Rank rounds'), cast(), 4).roundsLeft, 4);
});

test('otherCastToRecord: a miss -> null', () => {
  assert.equal(recFor(synth('3 rounds'), cast({ levels: 0 })), null);
});

test('otherCastToRecord: non-parsable duration (months) or no duration -> null', () => {
  assert.equal(recFor(synth('1 month'), cast()), null);
  assert.equal(recFor({ name: 'Slowly', effects: [] }, cast()), null);
});

test('otherCastToRecord: a pending Effect roll leaves effectLabel null; setOtherCastEffect fills it', () => {
  const sp = spellsFile.spells['Spirit Dart'];
  const out = otherCastOutcome(sp, cast({ name: 'Spirit Dart' }), { rank: 3 });
  assert.equal(out.effect.kind, 'step');
  const r = otherCastToRecord({ outcome: out, spell: sp, seq: 9, targetName: 'Bob' });
  assert.ok(r, 'Spirit Dart has a parsable duration');
  assert.equal(r.effectLabel, null);
  const list = [r, opp({ id: 'opp:2' })];
  const next = setOtherCastEffect(list, 'opp:9', 'Effect 12');
  assert.equal(next[0].effectLabel, 'Effect 12');
  assert.equal(next[1].effectLabel, list[1].effectLabel, 'other records untouched');
  assert.equal(list[0].effectLabel, null, 'input not mutated');
  assert.deepEqual(setOtherCastEffect(list, 'opp:404', 'Effect 3'), list);
});

// ---- armOpponent (Frighten uplift: computed per-success total + Step) -------
// plans/frighten-uplift I2/I3; R2 (-2 to all tests per success), R3 (end-test vs Frighten Step).

const frightenArms = (o = {}) => ({
  opponent: true, rounds: 4, name: 'Frighten', text: 'NOTE.',
  perSuccess: { delta: -2, allTests: true }, step: 9, ...o,
});

test('armOpponent perSuccess: text carries "-2 x 3 = -6 to all tests", note and Frighten Step (R2,R3)', () => {
  const r = armOpponent({ arms: frightenArms(), successes: 3, targetName: 'Bob', seq: 2 });
  assert.ok(r.text.includes('-2 x 3 = -6 to all tests'), r.text);
  assert.ok(r.text.includes('NOTE.'), r.text);
  assert.ok(r.text.includes('Frighten Step 9'), r.text);
  assert.equal(r.name, 'Frighten');
  assert.equal(r.effectLabel, '3 successes');
  assert.equal(r.roundsLeft, 4);
  assert.equal(r.roundsTotal, 4);
});

test('armOpponent perSuccess: head precedes note, Step sentence last', () => {
  const t = armOpponent({ arms: frightenArms(), successes: 2, targetName: '', seq: 1 }).text;
  assert.ok(t.indexOf('-2 x 2 = -4') < t.indexOf('NOTE.'));
  assert.ok(t.indexOf('NOTE.') < t.indexOf('Frighten Step 9'));
});

test('armOpponent perSuccess: allTests false omits "to all tests"', () => {
  const r = armOpponent({ arms: frightenArms({ perSuccess: { delta: -2, allTests: false } }), successes: 3, targetName: '', seq: 1 });
  assert.ok(r.text.includes('-2 x 3 = -6'));
  assert.ok(!r.text.includes('to all tests'));
});

test('armOpponent: step null/absent omits the Step sentence', () => {
  assert.ok(!armOpponent({ arms: frightenArms({ step: null }), successes: 1, targetName: '', seq: 1 }).text.includes('Step'));
  const { step, ...noStep } = frightenArms();
  assert.ok(!armOpponent({ arms: noStep, successes: 1, targetName: '', seq: 1 }).text.includes('Step'));
});

test('armOpponent: no perSuccess leaves the output identical to the static Taunt text', () => {
  const r = armOpponent({ arms: { opponent: true, rounds: 3, text: 'T' }, successes: 2, targetName: 'Bob', seq: 7 });
  assert.equal(r.text, 'T');
  assert.equal(r.name, 'Taunt');
  const withNull = armOpponent({ arms: { opponent: true, rounds: 3, text: 'T', perSuccess: null, step: null }, successes: 2, targetName: 'Bob', seq: 7 });
  assert.equal(withNull.text, 'T');
});

test('armOpponent perSuccess: a positive delta prints as-is', () => {
  const r = armOpponent({ arms: frightenArms({ perSuccess: { delta: 2, allTests: true } }), successes: 2, targetName: '', seq: 1 });
  assert.ok(r.text.includes('2 x 2 = 4 to all tests'), r.text);
});

test('armOpponent perSuccess: a miss still returns null', () => {
  assert.equal(armOpponent({ arms: frightenArms(), successes: 0, targetName: '', seq: 1 }), null);
});
