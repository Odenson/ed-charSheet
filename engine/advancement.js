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
 * @returns {{attained,supported,eligible,consistent,next,nextRequirement}}
 *   - `supported`  highest Circle the talents justify
 *   - `eligible`   supported > attained (the DTs already meet the next Circle's gate)
 *   - `consistent` supported >= attained (the stored Circle is justified; false = bad/imported data)
 *   - `next`       attained + 1
 *   - `nextRequirement`  circleRequirement(next) — the checklist for advancing
 */
export function circleStatus(ref, attained, rankByName) {
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
