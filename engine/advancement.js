// engine/advancement.js — pure, DOM-free Circle-advancement status for a
// Discipline. Attaining a Circle in ED4 is gated on BOTH minimum talent ranks
// AND training with a higher-Circle tutor (PG p.453) — training is an external
// event the sheet can't see, so the character's ATTAINED Circle stays a stored
// input. This module derives the talent-SUPPORTED Circle and the requirement to
// advance, so the UI can validate the stored number and surface "can advance"
// without ever mutating or storing anything (ARCHITECTURE §4.1).
//
// The gate (PG p.453, "Minimum Talent Requirements"): to train for Circle C,
// every Discipline Talent granted at Circles 1..C-1 must be at rank >= C. Talent
// Options never count; free talents and the universal talents (Durability, Karma
// Ritual) are not the gating Discipline Talents in the "N in total" rule, so the
// gate reads only `rules/disciplines.json` `circles[].talents` (not freeTalents).
//
// Optional gate (homebrew `advancement.optionalTable`, PG p.453 "Using All
// Talents To Advance"; plans/homebrew-circle-adv): when `circleStatus` is given
// `opts.table`, the gate is instead "N talents (Discipline Talents or Talent
// Options of THIS Discipline) at rank >= R, one from the Circle being left",
// keyed by the new Circle. Eligibility is the attained+1 row only; consistency
// checks only the stored Circle's count clause; there is no climb. Without
// `opts.table` every path below is the standard gate, unchanged.

import { UNIVERSAL_TALENTS, freeTalentSet } from './talent-options.js';

// Ordered, de-duplicated Discipline-Talent names granted at Circles <= through.
export function disciplineTalentsUpTo(ref, through) {
  const names = [];
  for (const c of ref?.circles ?? []) {
    if (c.circle > through) continue;
    for (const t of c.talents ?? []) if (!names.includes(t)) names.push(t);
  }
  return names;
}

// The requirement to advance TO `target`: all DTs from Circles 1..target-1 at
// rank >= target. Returns the per-talent breakdown plus whether it is satisfied.
// A target with no gating talents (e.g. Circle 1) is vacuously satisfied.
export function circleRequirement(ref, target, rankByName) {
  const gating = disciplineTalentsUpTo(ref, target - 1).map((name) => ({
    name,
    rank: rankByName[name] ?? 0,
    required: target,
    met: (rankByName[name] ?? 0) >= target,
  }));
  const met = gating.filter((g) => g.met);
  return {
    target,
    gating,
    met: met.length,
    total: gating.length,
    satisfied: gating.every((g) => g.met),
    missing: gating.filter((g) => !g.met),
  };
}

// The highest Circle the talent ranks support. Monotonic (meeting Circle C
// implies meeting every lower Circle, since the lower gate is a subset at a lower
// rank threshold), so we climb until a Circle's requirement fails. Floors at 1
// (owning the Discipline is Circle 1) and is capped by the Circles the rule data
// defines (we can't judge a Circle whose DT list we don't have).
export function supportedCircle(ref, rankByName) {
  const cap = Math.max(1, ...((ref?.circles ?? []).map((c) => c.circle)));
  let hi = 1;
  for (let c = 2; c <= cap + 1; c++) {
    if (circleRequirement(ref, c, rankByName).satisfied) hi = c;
    else break;
  }
  return hi;
}

/**
 * Circle status for one Discipline.
 * @param {object} ref  the `rules/disciplines.json` entry (has `circles[]`)
 * @param {number} attained  the stored Circle input
 * @param {Object<string,number>} rankByName  learned talent ranks in this Discipline
 * @param {{table:Map,talents:object[]}} [opts]  optional gate (homebrew); raw talents of THIS Discipline
 * @returns {{attained,supported,eligible,consistent,next,nextRequirement}}
 *   - `supported`  highest Circle the talents justify
 *   - `eligible`   supported > attained (the DTs already meet the next Circle's gate)
 *   - `consistent` supported >= attained (the stored Circle is justified; false = bad/imported data)
 *   - `next`       attained + 1
 *   - `nextRequirement`  circleRequirement(next) — the checklist for advancing
 */
export function circleStatus(ref, attained, rankByName, opts) {
  if (opts?.table) return optionalCircleStatus(ref, attained, opts);
  const at = attained ?? 1;
  const supported = supportedCircle(ref, rankByName);
  return {
    attained: at,
    supported,
    eligible: supported > at,
    consistent: supported >= at,
    next: at + 1,
    nextRequirement: circleRequirement(ref, at + 1, rankByName),
  };
}

// ---- Optional gate (PG p.453) ------------------------------------------------

// Validate the raw `legend.json` `costs.optionalAdvancement` map into a
// Map<newCircle,{minTalents,minRank,fromCircle}>, or null (=> standard gate)
// unless it is a non-empty object with integer keys >= 2 and positive-integer rows.
export function normalizeOptionalTable(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (!entries.length) return null;
  const pos = (n) => Number.isInteger(n) && n > 0;
  const map = new Map();
  for (const [k, row] of entries) {
    if (!/^\d+$/.test(k) || Number(k) < 2) return null;
    if (!row || typeof row !== 'object') return null;
    if (!pos(row.minTalents) || !pos(row.minRank) || !pos(row.fromCircle)) return null;
    map.set(Number(k), { minTalents: row.minTalents, minRank: row.minRank, fromCircle: row.fromCircle });
  }
  return map;
}

// The talents that count for one Discipline: its Discipline Talents and its
// Talent Options. Free talents, universal talents and Versatility-learned
// talents never count. Duplicate names collapse to the highest rank.
export function countableTalents(ref, talents) {
  const dts = new Set();
  for (const c of ref?.circles ?? []) for (const t of c.talents ?? []) dts.add(t);
  const frees = freeTalentSet(ref);
  const out = new Map();
  for (const t of talents ?? []) {
    if (!t || t.viaVersatility === true) continue;
    const isDt = dts.has(t.name);
    if (!isDt && (frees.has(t.name) || UNIVERSAL_TALENTS.has(t.name))) continue;
    const prev = out.get(t.name);
    if (!prev || t.rank > prev.rank) out.set(t.name, { name: t.name, rank: t.rank, circle: t.circle });
  }
  return [...out.values()];
}

// The optional-table requirement to advance TO `target`.
export function optionalRequirement(ref, target, talents, table) {
  const row = table?.get(target);
  const counted = countableTalents(ref, talents);
  const base = { target, rule: 'optional', counted, gating: [], missing: [] };
  if (!row) {
    return { ...base, minTalents: null, minRank: null, fromCircle: null, met: 0, total: counted.length, hasFromCircle: false, countMet: false, satisfied: false, unresolved: true };
  }
  const atRank = counted.filter((t) => t.rank >= row.minRank);
  const met = atRank.length;
  const hasFromCircle = atRank.some((t) => t.circle === row.fromCircle);
  const countMet = met >= row.minTalents;
  return { ...base, minTalents: row.minTalents, minRank: row.minRank, fromCircle: row.fromCircle, met, total: counted.length, hasFromCircle, countMet, satisfied: countMet && hasFromCircle, unresolved: false };
}

// UI text for a requirement (pure). `progress` is null when unresolved.
export function describeRequirement(req) {
  if (!req) return { text: '', progress: null, unresolved: true };
  if (req.rule === 'optional') {
    if (req.unresolved) return { text: `Circle ${req.target}: no optional-table row`, progress: null, unresolved: true };
    return {
      text: `${req.minTalents} talents at rank ${req.minRank}, one from Circle ${req.fromCircle}`,
      progress: `${req.met}/${req.minTalents} at rank ${req.minRank}`,
      fromCircleMet: req.hasFromCircle,
      satisfied: req.satisfied,
      unresolved: false,
    };
  }
  return {
    text: `All Circle 1–${req.target - 1} Discipline Talents at rank ${req.target}`,
    progress: `${req.met}/${req.total}`,
    satisfied: req.satisfied,
    unresolved: false,
  };
}

function optionalCircleStatus(ref, attained, opts) {
  const { table, talents } = opts;
  const at = attained ?? 1;
  const cap = Math.max(1, ...((ref?.circles ?? []).map((c) => c.circle)));
  const maxRow = Math.max(...table.keys());
  const next = at + 1 > cap || at + 1 > maxRow ? null : at + 1;
  const nextRequirement = next == null ? null : optionalRequirement(ref, next, talents, table);
  const eligible = !!nextRequirement?.satisfied;
  const ownRow = at > 1 ? table.get(at) : null;
  const consistent = !ownRow || optionalRequirement(ref, at, talents, table).countMet;
  const supported = eligible ? at + 1 : consistent ? at : Math.max(1, at - 1);
  return { attained: at, supported, eligible, consistent, next, nextRequirement };
}
