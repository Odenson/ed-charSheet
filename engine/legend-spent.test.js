// engine/legend-spent.test.js — run with `npm test` (node --test, no deps).
// Covers the pure Legend-spent audit against the real rules/legend.json cost tables,
// anchored on Chakka's recorded advancement.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  attributeIncreaseCost,
  talentRanksCost,
  spellCost,
  knackCost,
  skillRanksCost,
  lowestDisciplineCircle,
  tierForCircle,
  equivalentTier,
  shiftedTier,
  newDisciplineRank1Cost,
  additionalDisciplineTalentCost,
  talentRankStepCost,
  skillRankStepCost,
  auditLegendSpent,
} from './legend-spent.js';

const costs = JSON.parse(readFileSync(new URL('../rules/legend.json', import.meta.url))).costs;

// --- attributeIncreaseCost ----------------------------------------------------

test('attributeIncreaseCost sums each +1 step (per-increase, not cumulative)', () => {
  assert.equal(attributeIncreaseCost(0, costs.attributeIncrease), 0);
  assert.equal(attributeIncreaseCost(1, costs.attributeIncrease), 800);
  assert.equal(attributeIncreaseCost(2, costs.attributeIncrease), 800 + 1300); // 2100
  assert.equal(attributeIncreaseCost(3, costs.attributeIncrease), 800 + 1300 + 2100); // 4200
});

test('attributeIncreaseCost flags values beyond the table with null', () => {
  assert.equal(attributeIncreaseCost(4, costs.attributeIncrease), null);
  assert.equal(attributeIncreaseCost(5, costs.attributeIncrease), null);
});

// --- talentRanksCost (cumulative by tier) -------------------------------------

test('talentRanksCost sums each rank step (Novice)', () => {
  assert.equal(talentRanksCost(0, 'Novice', costs.talentRank), 0);
  assert.equal(talentRanksCost(1, 'Novice', costs.talentRank), 100);
  assert.equal(talentRanksCost(3, 'Novice', costs.talentRank), 100 + 200 + 300); // 600
  // Chakka's Missile Weapon: Rank 5 Novice = 100+200+300+500+800 = 1900
  assert.equal(talentRanksCost(5, 'Novice', costs.talentRank), 1900);
});

test('talentRanksCost uses the tier column', () => {
  assert.equal(talentRanksCost(2, 'Journeyman', costs.talentRank), 200 + 300); // 500
  assert.equal(talentRanksCost(1, 'Master', costs.talentRank), 500);
});

test('talentRanksCost flags an unknown tier with null', () => {
  assert.equal(talentRanksCost(3, 'Adept', costs.talentRank), null);
});

// --- spellCost ----------------------------------------------------------------

test('spellCost = Novice talent step at Rank = spell Circle', () => {
  assert.equal(spellCost(5, costs.talentRank), 800); // rulebook example
  assert.equal(spellCost(1, costs.talentRank), 100);
});

// --- skillRanksCost -----------------------------------------------------------

test('skillRanksCost sums each skill rank step (Skill Training Table)', () => {
  assert.equal(skillRanksCost(0, 'Novice', costs.skillRank), 0);
  assert.equal(skillRanksCost(1, 'Novice', costs.skillRank), 200);
  assert.equal(skillRanksCost(2, 'Novice', costs.skillRank), 200 + 300); // 500
  assert.equal(skillRanksCost(3, 'Novice', costs.skillRank), 200 + 300 + 500); // 1000 (Chakka Tracking)
  assert.equal(skillRanksCost(2, 'Journeyman', costs.skillRank), 300 + 500); // 800
});

test('skillRanksCost flags an out-of-range tier with null', () => {
  assert.equal(skillRanksCost(3, 'Warden', costs.skillRank), null); // skills have no Warden tier
});

// --- knackCost ----------------------------------------------------------------

test('knackCost = Novice talent step at the required Rank (flat, one-time)', () => {
  assert.equal(knackCost(1, costs.talentRank), 100);
  assert.equal(knackCost(4, costs.talentRank), 500);
  assert.equal(knackCost(7, costs.talentRank), 2100);
});

test('knackCost returns null when the required rank is unknown', () => {
  assert.equal(knackCost(null, costs.talentRank), null);
  assert.equal(knackCost(undefined, costs.talentRank), null);
  assert.equal(knackCost(0, costs.talentRank), null);
});

// --- auditLegendSpent (reconciliation anchor) ---------------------------------

const chakka = {
  attributes: {
    Dexterity: { base: 10, points: 8, increases: 2 },
    Strength: { base: 13, points: 5, increases: 2 },
    Toughness: { base: 12, points: 3, increases: 2 },
    Perception: { base: 10, points: 3, increases: 1 },
    Willpower: { base: 11, points: 2, increases: 1 },
    Charisma: { base: 9, points: 2, increases: 2 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 4,
      talents: [
        { name: 'Avoid Blow', rank: 4, circle: 1 },
        { name: 'Durability', rank: 5, circle: 1 },
        { name: 'Karma Ritual', rank: 4, circle: 1 },
        { name: 'Missile Weapon', rank: 5, circle: 1 },
      ],
    },
  ],
  resources: { legend: { totalEarnt: 45315, totalSpent: 44661 } },
};

test('auditLegendSpent totals attributes by increases', () => {
  const r = auditLegendSpent(chakka, costs);
  const attrs = r.sections.find((s) => s.key === 'attributes');
  // 4× +2 (Dex/Str/Tou/Cha) = 800+1300 = 2100 each, 2× +1 (Per/Wil) = 800 each
  assert.equal(attrs.total, 2100 * 4 + 800 * 2); // 10000
});

test('auditLegendSpent totals first-Discipline talents cumulatively', () => {
  const r = auditLegendSpent(chakka, costs);
  const archer = r.sections.find((s) => s.key === 'talents:0');
  assert.equal(archer.label, 'Archer');
  assert.equal(archer.ordinal, 1);
  assert.equal(archer.additional, false);
  // Avoid Blow R4=1100, Durability R5=1900, Karma Ritual R4=1100, Missile Weapon R5=1900
  assert.equal(archer.total, 1100 + 1900 + 1100 + 1900); // 6000
});

test('auditLegendSpent reconciles the modeled total against recorded', () => {
  const r = auditLegendSpent(chakka, costs);
  assert.equal(r.total, 10000 + 6000); // attributes + Archer, for this trimmed set
  assert.equal(r.recorded, 44661);
  assert.equal(r.delta, 44661 - 16000); // recorded − modeled = still-unmodeled
});

// --- multi-Discipline pricing (Phase 2) ---------------------------------------

test('lowestDisciplineCircle takes the minimum Circle', () => {
  assert.equal(lowestDisciplineCircle([{ circle: 4 }, { circle: 3 }]), 3);
  assert.equal(lowestDisciplineCircle([]), null);
});

test('tierForCircle reads the Circle band ladder (never stored — derived)', () => {
  assert.equal(tierForCircle(1, costs), 'Novice');
  assert.equal(tierForCircle(4, costs), 'Novice');
  assert.equal(tierForCircle(5, costs), 'Journeyman');
  assert.equal(tierForCircle(8, costs), 'Journeyman');
  assert.equal(tierForCircle(9, costs), 'Warden');
  assert.equal(tierForCircle(12, costs), 'Warden');
  assert.equal(tierForCircle(13, costs), 'Master');
  assert.equal(tierForCircle(15, costs), 'Master');
  assert.equal(tierForCircle(0, costs), null); // out of band below
  assert.equal(tierForCircle(16, costs), null); // out of band above
  assert.equal(tierForCircle(undefined, costs), null); // missing circle
  assert.equal(tierForCircle(3, undefined), null); // missing costs
});

test('equivalentTier shifts up for additional Disciplines', () => {
  assert.equal(equivalentTier(1, 1, costs), 'Novice'); // first Discipline: own band
  assert.equal(equivalentTier(1, 2, costs), 'Journeyman'); // 2nd: Circle 1–4 → Journeyman
  assert.equal(equivalentTier(5, 2, costs), 'Warden'); // 2nd: Circle 5–8 → Warden
  assert.equal(equivalentTier(1, 3, costs), 'Warden'); // 3rd: Circle 1–4 → Warden
  assert.equal(equivalentTier(1, 4, costs), 'Master'); // 4th+: always Master
});

test('newDisciplineRank1Cost reads the New Discipline table', () => {
  assert.equal(newDisciplineRank1Cost(3, 2, costs), 500); // Mica: lowest 3, 2nd Discipline
  assert.equal(newDisciplineRank1Cost(1, 2, costs), 1300);
  assert.equal(newDisciplineRank1Cost(3, 3, costs), 800); // 3rd Discipline
  assert.equal(newDisciplineRank1Cost(9, 2, costs), 200); // clamped to the 5+ row
  assert.equal(newDisciplineRank1Cost(3, 1, costs), null); // first Discipline: n/a
});

test('additionalDisciplineTalentCost = Rank-1 table + equivalent-tier ranks 2+', () => {
  // 2nd Discipline, Circle-1 (Novice→Journeyman), Rank 3, lowest Circle 3:
  //   R1 = 500 (New Discipline table), R2 = 300, R3 = 500 (Journeyman) → 1300
  const { cost, tier, rank1 } = additionalDisciplineTalentCost(3, 1, 2, 3, costs);
  assert.equal(rank1, 500);
  assert.equal(tier, 'Journeyman');
  assert.equal(cost, 500 + 300 + 500); // 1300
});

// --- homebrew additional-tier shift (plans/PLAN-HOMEBREW-LEGEND-TIER.md) ------

test('shiftedTier moves one step up the ladder, clamping at Master', () => {
  assert.equal(shiftedTier('Novice', costs, 1), 'Journeyman');
  assert.equal(shiftedTier('Journeyman', costs, 1), 'Warden');
  assert.equal(shiftedTier('Warden', costs, 1), 'Master');
  assert.equal(shiftedTier('Master', costs, 1), 'Master'); // ceiling: no higher column
  assert.equal(shiftedTier('Novice', costs, 0), 'Novice'); // shift 0 = no change
  assert.equal(shiftedTier('Novice', costs), 'Journeyman'); // default shift 1
  assert.equal(shiftedTier('Adept', costs, 1), 'Adept'); // unknown label passes through
});

test('additionalDisciplineTalentCost with tierShift = plain cumulative at the bumped column', () => {
  // Owner example: Frighten, Novice 2nd-Discipline talent, Rank 3 → 200+300+500 = 1000.
  const { cost, tier, rank1 } = additionalDisciplineTalentCost(3, 1, 2, 3, costs, { tierShift: 1, tier: 'Novice' });
  assert.equal(rank1, null); // New-Discipline table skipped entirely
  assert.equal(tier, 'Journeyman'); // shifted column actually used
  assert.equal(cost, 200 + 300 + 500); // 1000
});

test('additionalDisciplineTalentCost with tierShift: missing tier defaults to Novice then shifts', () => {
  const { cost, tier } = additionalDisciplineTalentCost(3, 1, 2, 3, costs, { tierShift: 1 });
  assert.equal(tier, 'Journeyman');
  assert.equal(cost, 1000);
});

test('additionalDisciplineTalentCost with tierShift: Master talent keeps Master prices', () => {
  const { cost, tier, rank1 } = additionalDisciplineTalentCost(2, 1, 2, 3, costs, { tierShift: 1, tier: 'Master' });
  assert.equal(tier, 'Master'); // no shift above the ceiling
  assert.equal(rank1, null);
  // Master column R1+R2 = 500 + 800
  assert.equal(cost, 500 + 800); // 1300
});

test('additionalDisciplineTalentCost with tierShift: unknown tier label flags null', () => {
  const { cost, tier } = additionalDisciplineTalentCost(2, 1, 2, 3, costs, { tierShift: 1, tier: 'Adept' });
  assert.equal(tier, 'Adept'); // passes through, then the table miss flags it
  assert.equal(cost, null);
});

test('tierShift 0 leaves the standard additional-Discipline model untouched', () => {
  const { cost, rank1 } = additionalDisciplineTalentCost(3, 1, 2, 3, costs, { tierShift: 0, tier: 'Novice' });
  assert.equal(rank1, 500);
  assert.equal(cost, 1300);
});

test('talentRankStepCost with tierShift == audit(after) − audit(before) under the rule', () => {
  const char = (rank) => ({
    attributes: {},
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }] },
      { name: 'Nethermancer', circle: 3, talents: [{ name: 'Frighten', rank, tier: 'Novice', circle: 1 }] },
    ],
    skills: [],
    resources: { legend: { totalEarnt: 10000 } },
  });
  const t = { name: 'Frighten', rank: 3, tier: 'Novice', circle: 1 };
  const shift = { tierShift: 1 };
  assert.equal(
    talentRankStepCost(t, 2, 3, costs, 4, shift),
    auditLegendSpent(char(4), costs, shift).total - auditLegendSpent(char(3), costs, shift).total,
  );
  assert.equal(
    talentRankStepCost(t, 2, 3, costs, 3, shift),
    auditLegendSpent(char(3), costs, shift).total - auditLegendSpent(char(2), costs, shift).total,
  );
});

test('talentRankStepCost with tierShift: each step is the shifted column single step', () => {
  const t = { name: 'Frighten', rank: 3, tier: 'Novice', circle: 1 };
  const shift = { tierShift: 1 };
  assert.equal(talentRankStepCost(t, 2, 3, costs, 1, shift), 200); // Journeyman R1
  assert.equal(talentRankStepCost(t, 2, 3, costs, 2, shift), 300); // Journeyman R2
  assert.equal(talentRankStepCost(t, 2, 3, costs, 3, shift), 500); // Journeyman R3
  assert.equal(talentRankStepCost(t, 2, 3, costs, 1, shift) + talentRankStepCost(t, 2, 3, costs, 2, shift) + talentRankStepCost(t, 2, 3, costs, 3, shift), 1000);
  assert.equal(talentRankStepCost(t, 2, 3, costs, 0, shift), 0);
});

// --- rank-step costs (rank editing: increase consumes, decrease refunds) ------

test('talentRankStepCost: the step into a rank equals the single table step', () => {
  const t = { name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 };
  // Raising R5 → R6 costs the 6th Novice step (1300); raising R4 → R5 costs 800.
  assert.equal(talentRankStepCost(t, 1, null, costs, 6), 1300);
  assert.equal(talentRankStepCost(t, 1, null, costs, 5), 800);
  // The refund for dropping R5 → R4 is the step that bought Rank 5 (800).
  assert.equal(talentRankStepCost(t, 1, null, costs, 5), 800);
  // toRank 0/negative — nothing below Rank 1 to refund.
  assert.equal(talentRankStepCost(t, 1, null, costs, 0), 0);
});

test('talentRankStepCost == audit(after) − audit(before) for a first-Discipline talent', () => {
  const char = (rank) => ({
    attributes: {},
    disciplines: [{ name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank, tier: 'Novice', circle: 1 }] }],
    skills: [],
    resources: { legend: { totalEarnt: 10000 } },
  });
  const t = { name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 };
  assert.equal(talentRankStepCost(t, 1, 4, costs, 6), auditLegendSpent(char(6), costs).total - auditLegendSpent(char(5), costs).total);
  assert.equal(talentRankStepCost(t, 1, 4, costs, 5), auditLegendSpent(char(5), costs).total - auditLegendSpent(char(4), costs).total);
});

test('talentRankStepCost: an additional-Discipline talent uses the surcharge tables', () => {
  // 2nd Discipline (equiv tier Journeyman), lowest Circle 3.
  const t = { name: 'Spellcasting', rank: 3, tier: 'Novice', circle: 1 };
  assert.equal(talentRankStepCost(t, 2, 3, costs, 1), 500); // New Discipline Rank-1 (lowest 3)
  assert.equal(talentRankStepCost(t, 2, 3, costs, 2), 300); // Journeyman R2
  assert.equal(talentRankStepCost(t, 2, 3, costs, 3), 500); // Journeyman R3
  assert.equal(talentRankStepCost(t, 2, 3, costs, 4), 800); // Journeyman R4
  // Matches the section subtotal: Rank 3 = 500 + 300 + 500 = 1300 (see the audit test above).
  assert.equal(talentRankStepCost(t, 2, 3, costs, 1) + talentRankStepCost(t, 2, 3, costs, 2) + talentRankStepCost(t, 2, 3, costs, 3), 1300);
});

test('talentRankStepCost == audit(after) − audit(before) for an additional-Discipline talent', () => {
  const char = (rank) => ({
    attributes: {},
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }] },
      { name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank, tier: 'Novice', circle: 1 }] },
    ],
    skills: [],
    resources: { legend: { totalEarnt: 10000 } },
  });
  const t = { name: 'Spellcasting', rank: 3, tier: 'Novice', circle: 1 };
  assert.equal(
    talentRankStepCost(t, 2, 3, costs, 4),
    auditLegendSpent(char(4), costs).total - auditLegendSpent(char(3), costs).total,
  );
  assert.equal(
    talentRankStepCost(t, 2, 3, costs, 3),
    auditLegendSpent(char(3), costs).total - auditLegendSpent(char(2), costs).total,
  );
});

test('skillRankStepCost: the step into a rank equals the Skill Training step', () => {
  const s = { name: 'Tracking', rank: 3, tier: 'Novice' };
  assert.equal(skillRankStepCost(s, costs, 4), 800); // Novice R4
  assert.equal(skillRankStepCost(s, costs, 3), 500); // the step that bought R3
  // Missing tier defaults to Novice, exactly as the audit prices it.
  assert.equal(skillRankStepCost({ name: 'Tracking', rank: 3 }, costs, 4), 800);
  assert.equal(skillRankStepCost(s, costs, 0), 0);
});

test('skillRankStepCost == audit(after) − audit(before)', () => {
  const char = (rank) => ({
    attributes: {},
    disciplines: [],
    skills: [{ name: 'Tracking', rank, tier: 'Novice' }],
    resources: { legend: { totalEarnt: 5000 } },
  });
  const s = { name: 'Tracking', rank: 3, tier: 'Novice' };
  assert.equal(skillRankStepCost(s, costs, 4), auditLegendSpent(char(4), costs).total - auditLegendSpent(char(3), costs).total);
  assert.equal(skillRankStepCost(s, costs, 3), auditLegendSpent(char(3), costs).total - auditLegendSpent(char(2), costs).total);
});

test('rank-step costs flag unpriceable steps with null', () => {
  const noCircle = { name: 'Missile Weapon', rank: 5, tier: 'Novice' }; // no learned Circle → no tier band
  assert.equal(talentRankStepCost(noCircle, 1, null, costs, 6), null);
  const beyondTable = { name: 'Missile Weapon', rank: 15, circle: 1 };
  assert.equal(talentRankStepCost(beyondTable, 1, null, costs, 16), null); // table stops at 15
  const skill = { name: 'Tracking', rank: 10, tier: 'Novice' };
  assert.equal(skillRankStepCost(skill, costs, 11), null); // skills stop at Rank 10
});

test('auditLegendSpent prices a 2nd Discipline with the surcharge', () => {
  const twoDisc = {
    attributes: {},
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, tier: 'Novice', circle: 1 }] },
      { name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank: 3, tier: 'Novice', circle: 1 }] },
    ],
    resources: { legend: { totalEarnt: 10000, totalSpent: 3200 } },
  };
  const r = auditLegendSpent(twoDisc, costs);
  const arch = r.sections.find((s) => s.key === 'talents:0');
  const neth = r.sections.find((s) => s.key === 'talents:1');
  assert.equal(arch.total, 1900); // Missile Weapon R5 Novice, first Discipline
  assert.equal(neth.additional, true);
  assert.equal(neth.ordinalLabel, '2nd');
  assert.equal(neth.total, 1300); // Spellcasting R3, 2nd Discipline (lowest Circle 3)
  assert.equal(r.total, 1900 + 1300);
});

test('auditLegendSpent with tierShift prices the 2nd Discipline at the bumped column', () => {
  const twoDisc = {
    attributes: {},
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, circle: 1 }] },
      { name: 'Nethermancer', circle: 3, talents: [{ name: 'Frighten', rank: 3, circle: 1 }] },
    ],
    resources: { legend: { totalEarnt: 10000, totalSpent: 2900 } },
  };
  const r = auditLegendSpent(twoDisc, costs, { tierShift: 1 });
  const arch = r.sections.find((s) => s.key === 'talents:0');
  const neth = r.sections.find((s) => s.key === 'talents:1');
  assert.equal(arch.total, 1900); // first Discipline unaffected
  assert.equal(neth.total, 1000); // Frighten R3, Novice bumped to Journeyman (200+300+500)
  assert.equal(neth.lines[0].detail, 'Novice → Journeyman · Rank 3');
  assert.equal(r.total, 1900 + 1000);
  assert.equal(r.delta, 2900 - (1900 + 1000)); // recorded − modeled
});

test('auditLegendSpent with tierShift leaves a first Discipline untouched', () => {
  const r = auditLegendSpent(chakka, costs, { tierShift: 1 });
  const archer = r.sections.find((s) => s.key === 'talents:0');
  assert.equal(archer.total, 6000); // bit-for-bit the rule-off value
});

test('auditLegendSpent adds a Skills section priced by tier', () => {
  const withSkills = {
    attributes: {},
    disciplines: [],
    skills: [
      { name: 'Tracking', rank: 3, tier: 'Novice' }, // 200+300+500 = 1000
      { name: 'Air Sailing', rank: 2, tier: 'Novice' }, // 200+300 = 500
    ],
    resources: { legend: { totalEarnt: 5000, totalSpent: 1500 } },
  };
  const r = auditLegendSpent(withSkills, costs);
  const sk = r.sections.find((s) => s.key === 'skills');
  assert.equal(sk.lines[0].cost, 1000);
  assert.equal(sk.lines[1].cost, 500);
  assert.equal(sk.total, 1500);
  assert.equal(r.total, 1500);
  assert.equal(r.delta, 0);
});

test('auditLegendSpent prices knacks with a rank, flags those without', () => {
  const withKnacks = {
    attributes: {},
    disciplines: [],
    knacks: [
      { name: 'Split Shot (Missile Weapons)', rank: 4 }, // priced: Novice R4 = 500
      { name: 'Hunting (Tracking)' }, // no rank → unpriced
    ],
    resources: { legend: { totalEarnt: 5000, totalSpent: 600 } },
  };
  const r = auditLegendSpent(withKnacks, costs);
  const knacks = r.sections.find((s) => s.key === 'knacks');
  assert.equal(knacks.lines[0].cost, 500);
  assert.equal(knacks.lines[0].detail, 'Rank 4');
  assert.equal(knacks.lines[1].cost, null); // flagged, not fabricated
  assert.equal(knacks.lines[1].detail, 'rank unrecorded');
  assert.equal(knacks.total, 500); // null line ignored in the subtotal
  assert.equal(r.total, 500);
  assert.equal(r.delta, 600 - 500);
});

test('auditLegendSpent prices knacks from the resolved knacks (opts.knacks)', () => {
  const char = {
    attributes: {},
    disciplines: [],
    resources: { legend: { totalEarnt: 2000, totalSpent: 300 } },
  };
  // Resolved knacks (as store.resolveKnack produces): requiredRank already bound from
  // the catalog. The audit reads it directly — it does not re-resolve.
  const knacks = [
    { name: 'Hunting', requiredRank: 3 },
    { name: 'Mystery', requiredRank: null }, // unknown → unpriced
  ];
  const r = auditLegendSpent(char, costs, { knacks });
  const kn = r.sections.find((s) => s.key === 'knacks');
  assert.equal(kn.lines[0].cost, 300); // Hunting: talentRank[3].Novice
  assert.equal(kn.lines[0].detail, 'Rank 3');
  assert.equal(kn.lines[1].cost, null); // Mystery: no requiredRank
  assert.equal(kn.total, 300);
});

test('auditLegendSpent omits the knacks section when there are none', () => {
  const r = auditLegendSpent({ attributes: {}, disciplines: [], knacks: [] }, costs);
  assert.equal(r.sections.find((s) => s.key === 'knacks'), undefined);
});

// --- Thread Items ------------------------------------------------------------

// Thread ranks price against the cumulative talent-rank progression at the item's
// tier (GMG p.202). The catalog passes in via opts.threadItemCatalog.
const bracersCatalog = {
  'Bracers of Aras': { tier: 'Journeyman', threadRanks: [] },
  'Strange Boots': { tier: 'Warden', threadRanks: [] },
};

test('auditLegendSpent prices a thread item cumulatively at its tier', () => {
  const char = {
    attributes: {},
    disciplines: [],
    resources: { legend: { totalEarnt: 5000, totalSpent: 1000 } },
    items: [{ name: 'Bracers of Aras', threadRank: 3 }],
  };
  const r = auditLegendSpent(char, costs, { threadItemCatalog: bracersCatalog });
  const th = r.sections.find((s) => s.key === 'threads');
  assert.equal(th.lines[0].name, 'Bracers of Aras');
  assert.equal(th.lines[0].detail, 'Journeyman · Thread Rank 3');
  // talentRank: Novice 100, Journeyman 200/300/500 → 200+300+500 = 1000
  assert.equal(th.lines[0].cost, 1000);
  assert.equal(th.total, 1000);
  assert.equal(r.total, 1000);
});

test('auditLegendSpent shows a thread item with no thread as costing 0', () => {
  const char = {
    attributes: {},
    disciplines: [],
    items: [{ name: 'Bracers of Aras', threadRank: 0 }],
  };
  const r = auditLegendSpent(char, costs, { threadItemCatalog: bracersCatalog });
  const th = r.sections.find((s) => s.key === 'threads');
  assert.equal(th.lines[0].detail, 'no thread woven');
  assert.equal(th.lines[0].cost, 0);
});

test('auditLegendSpent flags a thread item whose tier is unknown (no fabricated price)', () => {
  const char = {
    attributes: {},
    disciplines: [],
    items: [{ name: 'Mystery Vessel', threadRank: 2 }],
  };
  // In the catalog but without a tier → the rank can't be priced.
  const r = auditLegendSpent(char, costs, { threadItemCatalog: { 'Mystery Vessel': {} } });
  const th = r.sections.find((s) => s.key === 'threads');
  assert.equal(th.lines[0].name, 'Mystery Vessel');
  assert.equal(th.lines[0].cost, null); // unknown tier → unpriced
});

test('auditLegendSpent omits the thread-items section when the character owns none', () => {
  const r = auditLegendSpent({ attributes: {}, disciplines: [] }, costs, {
    threadItemCatalog: bracersCatalog,
  });
  assert.equal(r.sections.find((s) => s.key === 'threads'), undefined);
});

test('auditLegendSpent handles a character with no legend inputs', () => {
  const r = auditLegendSpent({ attributes: {}, disciplines: [] }, costs);
  assert.equal(r.total, 0);
  assert.equal(r.recorded, null);
  assert.equal(r.delta, null);
});

// --- Spells sink (PLAN-LEARN-SPELLS §5.1, resolves PLAN-SPELLS A5) -----------

// Learning a spell spends Legend = a Novice talent step at Rank = the spell's
// Circle. The Circle is read off the catalog passed in via opts.spellCatalog
// (rules/spells.json `spells`), resolved apostrophe-insensitively.
const spellCatalog = {
  'Soul Armor': { discipline: 'Nethermancer', circle: 4 },
  'Death’s Head': { discipline: 'Nethermancer', circle: 5 },
};

test('auditLegendSpent prices every known[] spell at spellCost(circle)', () => {
  const char = {
    attributes: {},
    disciplines: [],
    spells: { known: [
      { name: 'Soul Armor', learntSuccess: 2 },
      { name: "Death's Head", learntSuccess: 0 },
    ] },
  };
  const r = auditLegendSpent(char, costs, { spellCatalog });
  const sp = r.sections.find((s) => s.key === 'spells');
  // Circle 4 Novice = 500; Circle 5 Novice = 800.
  assert.equal(sp.lines[0].name, 'Soul Armor');
  assert.equal(sp.lines[0].detail, 'Circle 4');
  assert.equal(sp.lines[0].cost, spellCost(4, costs.talentRank));
  assert.equal(sp.lines[1].detail, 'Circle 5'); // apostrophe-insensitive lookup
  assert.equal(sp.lines[1].cost, 800);
  assert.equal(sp.total, 500 + 800);
  assert.equal(r.total, 500 + 800);
});

test('auditLegendSpent flags an unknown spell as 0 (never a fabricated cost)', () => {
  const char = {
    attributes: {},
    disciplines: [],
    spells: { known: [{ name: 'Mystery Vessel', learntSuccess: 0 }] },
  };
  const r = auditLegendSpent(char, costs, { spellCatalog });
  const sp = r.sections.find((s) => s.key === 'spells');
  assert.equal(sp.lines[0].detail, 'not in the catalog');
  assert.equal(sp.lines[0].cost, 0);
  assert.equal(sp.total, 0);
});

test('auditLegendSpent omits the spells section when the character knows none', () => {
  const r = auditLegendSpent({ attributes: {}, disciplines: [], spells: { known: [] } }, costs, {
    spellCatalog,
  });
  assert.equal(r.sections.find((s) => s.key === 'spells'), undefined);
});

test('auditLegendSpent applies spellCostMultiplier to every spell (homebrew free learning = ×0)', () => {
  const char = {
    attributes: {},
    disciplines: [],
    spells: { known: [
      { name: 'Soul Armor', learntSuccess: 2 },
      { name: "Death's Head", learntSuccess: 0 },
    ] },
  };
  // enabled rule ships `?? 1` -> the multiplier arrives as 0 (a falsy number,
  // which `|| 1` would swallow — the whole point of the nullish-coalesce).
  const free = auditLegendSpent(char, costs, { spellCatalog, spellCostMultiplier: 0 });
  const sp = free.sections.find((s) => s.key === 'spells');
  assert.equal(sp.total, 0);
  assert.equal(sp.lines[0].cost, 0);
  assert.equal(sp.lines[1].cost, 0);
  assert.equal(free.total, 0);
  // absent opt -> ×1 (standard cost, the LEARN-SPELLS behaviour)
  const standard = auditLegendSpent(char, costs, { spellCatalog });
  assert.equal(standard.sections.find((s) => s.key === 'spells').total, 500 + 800);
  // a partial-cost house rule (×0.5) scales proportionally
  const half = auditLegendSpent(char, costs, { spellCatalog, spellCostMultiplier: 0.5 });
  assert.equal(half.sections.find((s) => s.key === 'spells').total, (500 + 800) * 0.5);
});

// --- Karma Rituals sink (homebrew Karma economy, plans/PLAN-HOMEBREW-KARMA.md) ----------

test('auditLegendSpent sinks `converted × cost` and splits it into historic + event lines', () => {
  const char = {
    attributes: {},
    disciplines: [],
    resources: { karma: { converted: 20, rituals: [
      { id: 'a', date: '2026-08-13T00:00:00Z', points: 3, cost: 6, legend: 18 },
      { id: 'b', date: '2026-08-13T01:00:00Z', points: 2, cost: 6, legend: 12 },
    ] } },
  };
  const r = auditLegendSpent(char, costs, { karmaRitualCost: 6 });
  const sec = r.sections.find((s) => s.key === 'karma-rituals');
  assert.equal(sec.total, 120); // converted 20 × 6
  assert.equal(sec.lines.length, 3); // historic(15) + a + b
  assert.equal(sec.lines[0].cost, 90); // (20 − 3 − 2) × 6
  assert.equal(r.total, 120); // only sink present → whole spent total
});

test('Karma-ritual sink prices the whole `converted` at the current cost (event snapshots ignored)', () => {
  const char = { attributes: {}, disciplines: [], resources: { karma: { converted: 4, rituals: [{ id: 'c', points: 4, cost: 5 }] } } };
  const r = auditLegendSpent(char, costs, { karmaRitualCost: 7 });
  assert.equal(r.sections.find((s) => s.key === 'karma-rituals').total, 28); // 4 × 7 at current cost
});

test('no karma-rituals section when absent cost or zero converted', () => {
  const r = auditLegendSpent({ attributes: {}, disciplines: [], resources: { karma: { converted: 5 } } }, costs);
  assert.equal(r.sections.find((s) => s.key === 'karma-rituals'), undefined);
});
