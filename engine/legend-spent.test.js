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
  equivalentTier,
  newDisciplineRank1Cost,
  additionalDisciplineTalentCost,
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
        { name: 'Avoid Blow', rank: 4, tier: 'Novice' },
        { name: 'Durability', rank: 5, tier: 'Novice' },
        { name: 'Karma Ritual', rank: 4, tier: 'Novice' },
        { name: 'Missile Weapon', rank: 5, tier: 'Novice' },
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
