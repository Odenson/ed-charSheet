// engine/advancement-optional.test.js — run with `npm test` (node --test, no deps).
// Pure units for the homebrew optional Circle-advancement gate (PG p.453 "Using
// All Talents To Advance"; plans/homebrew-circle-adv). Table values come from
// plans/homebrew-circle-adv/spec.md (Rules) / rules.md R1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeOptionalTable, countableTalents, optionalRequirement, circleStatus,
} from './advancement.js';

// R1: [newCircle, minTalents, minRank, fromCircle]
const R1 = [
  [2, 5, 2, 1], [3, 6, 3, 2], [4, 7, 4, 3], [5, 8, 5, 4], [6, 9, 6, 5], [7, 10, 7, 6], [8, 11, 8, 7],
  [9, 12, 9, 8], [10, 13, 10, 9], [11, 14, 11, 10], [12, 15, 11, 11], [13, 16, 12, 12], [14, 17, 12, 13], [15, 18, 13, 14],
];
const rawTable = () => Object.fromEntries(R1.map(([c, n, r, f]) => [String(c), { minTalents: n, minRank: r, fromCircle: f }]));
const table = () => normalizeOptionalTable(rawTable());

// Small Archer-shaped ref (4 Circles).
const ref = {
  name: 'Archer',
  circles: [
    { circle: 1, talents: ['Avoid Blow', 'Missile Weapon', 'Mystic Aim', 'Thread Weaving (Archer)', 'True Shot'], freeTalents: ['Call Missile'] },
    { circle: 2, talents: ['Mystic Pursuit'] },
    { circle: 3, talents: ['Anticipate Blow'] },
    { circle: 4, talents: ['Long Shot'] },
  ],
};
// 15-Circle ref, one DT per Circle (padding talents below are Talent Options).
const ref15 = { name: 'Big', circles: Array.from({ length: 15 }, (_, i) => ({ circle: i + 1, talents: [`DT ${i + 1}`] })) };

const rankMap = (talents) => Object.fromEntries(talents.map((t) => [t.name, t.rank]));
const opts = (n, rank, circle = 1) => Array.from({ length: n }, (_, i) => ({ name: `Opt ${i + 1}`, rank, circle }));
const names = (list) => list.map((t) => t.name).sort();

test('normalizeOptionalTable: valid table becomes a Map keyed by numeric Circle', () => {
  const m = table();
  assert.ok(m instanceof Map);
  assert.equal(m.size, 14);
  assert.deepEqual(m.get(3), { minTalents: 6, minRank: 3, fromCircle: 2 });
  assert.deepEqual(m.get(15), { minTalents: 18, minRank: 13, fromCircle: 14 });
});

test('normalizeOptionalTable: null/empty/array/non-object give null (standard gate)', () => {
  for (const bad of [null, undefined, {}, [], 'x', 5, true]) assert.equal(normalizeOptionalTable(bad), null);
});

test('normalizeOptionalTable: keys must be integers >= 2', () => {
  const row = { minTalents: 5, minRank: 2, fromCircle: 1 };
  for (const k of ['1', '0', '-3', 'x', '2.5', '']) assert.equal(normalizeOptionalTable({ [k]: row }), null, `key ${k}`);
  assert.equal(normalizeOptionalTable({ 2: row, 1: row }), null);
});

test('normalizeOptionalTable: every row needs positive-integer fields', () => {
  const good = { minTalents: 5, minRank: 2, fromCircle: 1 };
  assert.ok(normalizeOptionalTable({ 2: good }));
  for (const bad of [
    { ...good, minTalents: 0 }, { ...good, minRank: -1 }, { ...good, fromCircle: 0 },
    { ...good, minTalents: 2.5 }, { ...good, minRank: '2' }, { minRank: 2, fromCircle: 1 }, null, 'row',
  ]) assert.equal(normalizeOptionalTable({ 2: good, 3: bad }), null);
});

test('countableTalents: Discipline Talents and Talent Options count; free + universal drop (R5)', () => {
  const out = countableTalents(ref, [
    { name: 'Avoid Blow', rank: 3, circle: 1 },
    { name: 'Awareness', rank: 3, circle: 2 }, // option
    { name: 'Call Missile', rank: 3, circle: 1 }, // free
    { name: 'Durability', rank: 3, circle: 1 },
    { name: 'Karma Ritual', rank: 3, circle: 1 },
  ]);
  assert.deepEqual(names(out), ['Avoid Blow', 'Awareness']);
  const o = out.find((t) => t.name === 'Awareness');
  assert.equal(o.rank, 3);
  assert.equal(o.circle, 2);
});

test('countableTalents: viaVersatility === true never counts; false/absent does (R2)', () => {
  const out = countableTalents(ref, [
    { name: 'Awareness', rank: 5, circle: 2, viaVersatility: true },
    { name: 'Climbing', rank: 5, circle: 2, viaVersatility: false },
    { name: 'Tracking', rank: 5, circle: 2 },
  ]);
  assert.deepEqual(names(out), ['Climbing', 'Tracking']);
});

test('countableTalents: duplicate names collapse to the highest rank; tie keeps first listed', () => {
  const out = countableTalents(ref, [
    { name: 'Awareness', rank: 2, circle: 1 },
    { name: 'Awareness', rank: 5, circle: 2 },
    { name: 'Tracking', rank: 4, circle: 3 },
    { name: 'Tracking', rank: 4, circle: 4 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((t) => t.name === 'Awareness').rank, 5);
  assert.equal(out.find((t) => t.name === 'Tracking').circle, 3);
});

test('countableTalents: exact-name matching only (near-names are distinct, not free/universal/duplicate)', () => {
  const out = countableTalents(ref, [
    { name: 'Avoid Blow', rank: 3, circle: 1 },
    { name: 'Avoid Blow II', rank: 3, circle: 1 },
    { name: 'Durability II', rank: 3, circle: 1 },
  ]);
  assert.deepEqual(names(out), ['Avoid Blow', 'Avoid Blow II', 'Durability II']);
});

test('countableTalents: empty/undefined input gives []', () => {
  assert.deepEqual(countableTalents(ref, []), []);
  assert.deepEqual(countableTalents(ref, undefined), []);
});

test('optionalRequirement: Mica example, Third Circle needs 6 talents at rank 3, one from Circle 2', () => {
  const talents = [...opts(5, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: 2 }];
  const r = optionalRequirement(ref, 3, talents, table());
  assert.equal(r.rule, 'optional');
  assert.equal(r.target, 3);
  assert.equal(r.minTalents, 6);
  assert.equal(r.minRank, 3);
  assert.equal(r.fromCircle, 2);
  assert.equal(r.total, 6);
  assert.equal(r.met, 6);
  assert.equal(r.countMet, true);
  assert.equal(r.hasFromCircle, true);
  assert.equal(r.satisfied, true);
  assert.equal(r.unresolved, false);
  assert.equal(r.counted.length, 6);
  assert.deepEqual(r.gating, []);
  assert.deepEqual(r.missing, []);
});

test('optionalRequirement: one talent short, rank short, or from-Circle missing each fail', () => {
  const base = [...opts(5, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: 2 }];
  assert.equal(optionalRequirement(ref, 3, base.slice(1), table()).satisfied, false); // 5 of 6
  assert.equal(optionalRequirement(ref, 3, base.slice(1), table()).countMet, false);
  const lowRank = base.map((t, i) => (i === 0 ? { ...t, rank: 2 } : t));
  const lr = optionalRequirement(ref, 3, lowRank, table());
  assert.equal(lr.met, 5);
  assert.equal(lr.satisfied, false);
  const noFrom = base.map((t) => (t.circle === 2 ? { ...t, circle: 1 } : t));
  const nf = optionalRequirement(ref, 3, noFrom, table());
  assert.equal(nf.countMet, true);
  assert.equal(nf.hasFromCircle, false);
  assert.equal(nf.satisfied, false);
});

test('optionalRequirement: from-Circle is strict; above/below or null/undefined never match', () => {
  const six = (c) => [...opts(5, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: c }];
  for (const c of [3, 1, null, undefined]) assert.equal(optionalRequirement(ref, 3, six(c), table()).hasFromCircle, false, String(c));
  assert.equal(optionalRequirement(ref, 3, six(2), table()).hasFromCircle, true);
});

test('optionalRequirement: the from-Circle talent must itself be at min rank', () => {
  const t = [...opts(5, 3, 1), { name: 'Mystic Pursuit', rank: 2, circle: 2 }];
  const r = optionalRequirement(ref, 3, t, table());
  assert.equal(r.met, 5);
  assert.equal(r.hasFromCircle, false);
});

test('optionalRequirement: a Talent Option taken at the from-Circle satisfies it', () => {
  const t = [...opts(5, 3, 1), { name: 'Awareness', rank: 3, circle: 2 }];
  assert.equal(optionalRequirement(ref, 3, t, table()).satisfied, true);
});

test('optionalRequirement: free talents and viaVersatility do not reach N (R5, R2)', () => {
  const t = [...opts(4, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: 2 },
    { name: 'Call Missile', rank: 9, circle: 1 }, { name: 'Durability', rank: 9, circle: 1 },
    { name: 'Awareness', rank: 9, circle: 2, viaVersatility: true }];
  const r = optionalRequirement(ref, 3, t, table());
  assert.equal(r.met, 5);
  assert.equal(r.satisfied, false);
});

test('optionalRequirement: a duplicate name cannot fake N', () => {
  const t = [...opts(4, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: 2 }, { name: 'Mystic Pursuit', rank: 3, circle: 2 }];
  assert.equal(optionalRequirement(ref, 3, t, table()).met, 5);
});

test('optionalRequirement: target with no table row is unresolved and unsatisfied', () => {
  for (const target of [1, 16, 99]) {
    const r = optionalRequirement(ref15, target, opts(30, 20, target - 1), table());
    assert.equal(r.unresolved, true, `target ${target}`);
    assert.equal(r.satisfied, false);
    assert.equal(r.rule, 'optional');
  }
});

test('optionalRequirement: every legend row boundary (driven from rules/legend.json)', () => {
  const legend = JSON.parse(readFileSync(new URL('../rules/legend.json', import.meta.url))).costs.optionalAdvancement;
  const t = normalizeOptionalTable(legend);
  assert.ok(t, 'legend table normalises');
  for (const [c] of R1) {
    const { minTalents: N, minRank: R, fromCircle: F } = legend[String(c)];
    // Fillers sit at F+2: neither F nor F+1, so only the "From" talent can supply the from-Circle.
    const mk = (n, rank, fc) => [...opts(n - 1, rank, F + 2), { name: 'From', rank, circle: fc }];
    assert.equal(optionalRequirement(ref15, c, mk(N, R, F), t).satisfied, true, `C${c} exact`);
    assert.equal(optionalRequirement(ref15, c, mk(N, R, F).slice(1), t).satisfied, false, `C${c} N-1`);
    assert.equal(optionalRequirement(ref15, c, mk(N, R - 1, F), t).satisfied, false, `C${c} rank-1`);
    assert.equal(optionalRequirement(ref15, c, mk(N, R, F + 1), t).satisfied, false, `C${c} above from-Circle`);
    assert.equal(optionalRequirement(ref15, c, mk(N, R, null), t).satisfied, false, `C${c} null circle`);
    assert.equal(optionalRequirement(ref15, c, mk(N + 1, R, F), t).satisfied, true, `C${c} N+1`);
  }
});

test('circleStatus: eligible at Circle 2 -> 3 when the row-3 gate is met (Mica example)', () => {
  const talents = [...opts(5, 3, 1), { name: 'Mystic Pursuit', rank: 3, circle: 2 }];
  const s = circleStatus(ref, 2, rankMap(talents), { table: table(), talents });
  assert.equal(s.attained, 2);
  assert.equal(s.next, 3);
  assert.equal(s.eligible, true);
  assert.equal(s.supported, 3);
  assert.equal(s.consistent, true);
  assert.equal(s.nextRequirement.rule, 'optional');
  assert.equal(s.nextRequirement.satisfied, true);
});

test('circleStatus: not eligible but consistent when row 3 fails and row 2 count holds', () => {
  const talents = [...opts(5, 3, 1)]; // 5 at rank 3: row 2 (5 at rank 2) ok, row 3 needs 6
  const s = circleStatus(ref, 2, rankMap(talents), { table: table(), talents });
  assert.equal(s.eligible, false);
  assert.equal(s.consistent, true);
  assert.equal(s.supported, 2);
});

test('circleStatus (optional): eligible <=> supported > attained, consistent <=> supported >= attained', () => {
  for (const n of [3, 4, 5, 6, 7]) {
    const talents = [...opts(n, 3, 2)];
    const s = circleStatus(ref, 2, rankMap(talents), { table: table(), talents });
    assert.equal(s.eligible, s.supported > s.attained);
    assert.equal(s.consistent, s.supported >= s.attained);
  }
});

test('circleStatus (optional): the gate is the Circle-leaving row only, no climb', () => {
  // Rich talents satisfy rows 3..6 but the stored Circle is 2: only row 3 is judged.
  const talents = [...opts(12, 9, 2)];
  const s = circleStatus(ref15, 2, rankMap(talents), { table: table(), talents });
  assert.equal(s.eligible, true);
  assert.equal(s.supported, 3); // no climb past attained + 1
  assert.equal(s.next, 3);
});

test('circleStatus (optional): Circles 12-15 min rank lags the Circle number', () => {
  // attained 11 -> 12 needs 15 talents at rank 11, one from Circle 11.
  const ok = [...opts(14, 11, 1), { name: 'From', rank: 11, circle: 11 }];
  assert.equal(circleStatus(ref15, 11, rankMap(ok), { table: table(), talents: ok }).eligible, true);
  const low = ok.map((t, i) => (i === 0 ? { ...t, rank: 10 } : t));
  assert.equal(circleStatus(ref15, 11, rankMap(low), { table: table(), talents: low }).eligible, false);
  // attained 14 -> 15 needs 18 at rank 13, one from Circle 14.
  const t15 = [...opts(17, 13, 1), { name: 'From', rank: 13, circle: 14 }];
  assert.equal(circleStatus(ref15, 14, rankMap(t15), { table: table(), talents: t15 }).eligible, true);
});

test('circleStatus (optional): top Circle and beyond the table are not eligible, and stay consistent', () => {
  const talents = [...opts(30, 20, 14)];
  const top = circleStatus(ref15, 15, rankMap(talents), { table: table(), talents });
  assert.equal(top.next, null);
  assert.equal(top.eligible, false);
  assert.equal(top.consistent, true);
  const beyond = circleStatus(ref15, 16, rankMap(talents), { table: table(), talents: [] });
  assert.equal(beyond.next, null);
  assert.equal(beyond.eligible, false);
  assert.equal(beyond.consistent, true); // no row for 16
});

test('circleStatus (optional): next is null beyond the highest Circle in ref.circles', () => {
  const talents = [...opts(30, 20, 4)];
  const s = circleStatus(ref, 4, rankMap(talents), { table: table(), talents }); // ref tops at 4
  assert.equal(s.next, null);
  assert.equal(s.eligible, false);
});

test('circleStatus (optional): Circle 1 / null attained is always consistent', () => {
  const s = circleStatus(ref, 1, {}, { table: table(), talents: [] });
  assert.equal(s.consistent, true);
  const n = circleStatus(ref, null, {}, { table: table(), talents: [] });
  assert.equal(n.attained, 1);
  assert.equal(n.consistent, true);
  assert.equal(n.next, 2);
});

test('F2(a): legacy Circle 5, null circle on every talent, >=8 at rank 5 stays consistent', () => {
  const talents = opts(8, 5, null);
  const s = circleStatus(ref15, 5, rankMap(talents), { table: table(), talents });
  assert.equal(s.consistent, true);
  assert.equal(s.eligible, false);
});

test('F2(a): row 6 count met but no from-Circle-5 talent: not eligible, consistent unchanged', () => {
  const talents = opts(9, 6, null);
  const s = circleStatus(ref15, 5, rankMap(talents), { table: table(), talents });
  assert.equal(s.nextRequirement.countMet, true);
  assert.equal(s.nextRequirement.hasFromCircle, false);
  assert.equal(s.eligible, false);
  assert.equal(s.consistent, true);
});

test('F2(b): a gap Circle (nothing stored at Circle 3) follows only the count clause', () => {
  const mk = (n) => opts(n, 5, 1).map((t, i) => ({ ...t, circle: [1, 2, 4, 4, 5, 1, 2, 4][i] ?? 1 }));
  const ok = mk(8);
  assert.equal(circleStatus(ref15, 5, rankMap(ok), { table: table(), talents: ok }).consistent, true);
  const few = mk(7);
  assert.equal(circleStatus(ref15, 5, rankMap(few), { table: table(), talents: few }).consistent, false);
});

test('F2(c): too few counted talents for its own row -> inconsistent and not eligible', () => {
  const talents = opts(7, 5, 4); // row 5 needs 8
  const s = circleStatus(ref15, 5, rankMap(talents), { table: table(), talents });
  assert.equal(s.consistent, false);
  assert.equal(s.eligible, false);
  assert.equal(s.supported, 4); // max(1, at - 1)
});

test('circleStatus (optional): consistency never depends on the from-Circle clause', () => {
  const noFrom = opts(8, 5, null);
  const withFrom = opts(8, 5, 4);
  assert.equal(circleStatus(ref15, 5, rankMap(noFrom), { table: table(), talents: noFrom }).consistent, true);
  assert.equal(circleStatus(ref15, 5, rankMap(withFrom), { table: table(), talents: withFrom }).consistent, true);
});

test('Multiple Disciplines: a talent in Discipline A never counts for Discipline B', () => {
  const a = [...opts(5, 3, 1)]; // A: 5 talents
  const b = [{ name: 'Mystic Pursuit', rank: 3, circle: 2 }]; // B: 1 talent
  const sa = circleStatus(ref, 2, rankMap(a), { table: table(), talents: a });
  const sb = circleStatus(ref, 2, rankMap(b), { table: table(), talents: b });
  assert.equal(sa.nextRequirement.met, 5);
  assert.equal(sa.eligible, false); // no Circle-2 talent in A's own list
  assert.equal(sb.nextRequirement.met, 1);
  assert.equal(sb.eligible, false);
});

test('standard path unchanged: no opts / no table / opts without table deep-equal the 3-arg result', () => {
  const ranks = { 'Avoid Blow': 4, 'Missile Weapon': 5, 'Mystic Aim': 5, 'Thread Weaving (Archer)': 4, 'True Shot': 4, 'Mystic Pursuit': 3, 'Anticipate Blow': 4 };
  const base = circleStatus(ref, 3, ranks);
  assert.deepEqual(circleStatus(ref, 3, ranks, undefined), base);
  assert.deepEqual(circleStatus(ref, 3, ranks, {}), base);
  assert.deepEqual(circleStatus(ref, 3, ranks, { talents: [{ name: 'X', rank: 9, circle: 1 }] }), base);
  assert.notEqual(base.nextRequirement.rule, 'optional');
});
