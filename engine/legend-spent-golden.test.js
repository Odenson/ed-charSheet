// engine/legend-spent-golden.test.js — run with `npm test` (node --test, no deps).
//
// ============================  GOLDEN TESTS  ============================
// create-new-adept, slice A2 "step 0" (plans/create-new-adept/spec.md). These tests
// PIN TODAY'S output of the UNMODIFIED Legend audit and the rank-step pricing helpers
// for inline fixtures modelled on kolon-v2, chakka and test-char (data/characters/ is
// gitignored; no test reads it). They are NOT red-first: they PASS on the current engine
// and MUST KEEP PASSING after the creation-block changes - a character without a
// `creation` block must behave byte-identically (spec "Edge cases & invariants").
// If one of these goes red the dev changed behaviour for existing characters: fix the code,
// never the golden. The failing (new-feature) tests live in engine/legend-spent-creation.test.js.
// =========================================================================
//
// Expected values were captured by running the unmodified engine on these fixtures
// against the real rules/legend.json and rules/spells.json, then hand-checked (e.g.
// Kolon-like: attributes 4200+4200+800 = 9200; Thief 8 Rank-1 Novice talents = 800;
// ten skills = 5000; knacks 300+200+200+300 = 1000; Karma 125 x 7 = 875).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditLegendSpent, talentRankStepCost, skillRankStepCost, lowestPriorCircle } from './legend-spent.js';

const read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const costs = read('legend.json').costs;
const spellCatalog = read('spells.json').spells;
const threadItemCatalog = read('thread-items.json').items;
const knackCatalog = read('knacks.json').knacks;

const t = (name, rank, circle = 1) => ({ name, rank, circle });
const sk = (name, rank, tier = 'Novice') => ({ name, rank, tier });
const wealth = { coins: { copper: 0, silver: 0, gold: 0, earth: 0, water: 0, air: 0, fire: 0, orichalcum: 0 }, gems: [] };

const KOLON_LIKE = {
  schema: 'ed-character/2',
  meta: { name: 'Kolon Like', race: 'Ork' },
  attributes: {
    Dexterity: { base: 10, points: 6, increases: 3 },
    Strength: { base: 13, points: 6, increases: 3 },
    Toughness: { base: 11, points: 5, increases: 0 },
    Perception: { base: 10, points: 0, increases: 1 },
    Willpower: { base: 8, points: 5, increases: 0 },
    Charisma: { base: 9, points: 4, increases: 0 },
  },
  resources: {
    karma: { converted: 125, spent: 105 },
    legend: { totalSpent: 43380, totalEarnt: 45386 },
    health: { damage: 1, wounds: 0, recoveriesUsed: 1 },
  },
  disciplines: [
    {
      name: 'Thief',
      circle: 1,
      talents: [
        t('Awareness', 1), t('Durability', 1), t('Karma Ritual', 1), t('Lock Picking', 1),
        t('Picking Pockets', 1), t('Stealthy Stride', 1), t('Thread Weaving (Thief)', 1), t('Melee Weapon', 1),
      ],
    },
  ],
  skills: [
    sk('Acrobatic Defense', 4), sk('Air Sailing', 2), sk('Animal Handling', 1),
    sk('Read/Write Language (Throalic)', 1), sk('Speak Language (Ork)', 1), sk('Speak Language (Theran)', 1),
    sk('Speak Language (Throalic)', 1), sk('Swimming', 1), sk('Tailor', 2), sk('Wilderness Survival', 3),
  ],
  knacks: [{ name: 'Lip Reading' }, { name: 'Animal Tracking' }, { name: 'Hunting' }, { name: 'Riding' }],
  traits: [],
  items: [],
  wealth,
};

const CHAKKA_LIKE = {
  schema: 'ed-character/2',
  meta: { name: 'Chakka Like', race: 'Ork' },
  attributes: {
    Dexterity: { base: 10, points: 8, increases: 2 },
    Strength: { base: 13, points: 5, increases: 2 },
    Toughness: { base: 11, points: 4, increases: 2 },
    Perception: { base: 10, points: 3, increases: 1 },
    Willpower: { base: 8, points: 4, increases: 1 },
    Charisma: { base: 9, points: 2, increases: 2 },
  },
  resources: {
    karma: {
      converted: 123,
      spent: 105,
      rituals: [
        { date: '2025-03-01T10:00:00Z', points: 3 },
        { date: '2025-04-12T10:00:00Z', points: 2 },
      ],
    },
    legend: {
      totalSpent: 45261,
      totalEarnt: 45315,
      earned: [{ id: 'e1', amount: 500, description: 'story', date: '2025-05-20' }],
    },
    health: { damage: 3, wounds: 0, recoveriesUsed: 0 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 4,
      talents: [
        t('Avoid Blow', 4), t('Durability', 5), t('Karma Ritual', 4), t('Missile Weapon', 5), t('Mystic Aim', 5),
        t('Thread Weaving (Archer)', 4), t('True Shot', 4), t('Awareness', 4), t('Mystic Pursuit', 4, 2),
        t('Throwing Weapon', 3, 2), t('Anticipate Blow', 4, 3), t('Stealthy Stride', 4, 3), t('Long Shot', 3, 4),
        t('First Impression', 2, 4),
      ],
    },
    {
      name: 'Nethermancer',
      circle: 3,
      talents: [
        t('Astral Sight', 3), t('Frighten', 3), t('Patterncraft', 3), t('Spellcasting', 4),
        t('Thread Weaving (Nethermancer)', 3), t('Dispel Magic', 3), t('Steel Thought', 3, 2),
        t('Standard Matrix', 3, 2), t('Spirit Talk', 2, 3), t('Suppress Curse', 1, 3), t('Command Nightflyer', 2, 2),
      ],
    },
  ],
  skills: [
    sk('Speak Language (Ork)', 2), sk('Speak Language (Theran)', 1), sk('Speak Language (Throalic)', 1),
    sk('Read/Write Language (Theran)', 1), sk('Navigation', 1), sk('Tracking', 2), sk('Air Sailing', 2),
    sk('Public Speaking', 1), sk('Tattooist', 3), sk('Unarmed Combat', 2), sk('Melee Weapon', 1),
    sk('Wilderness Survival', 2), sk('Horror Lore', 1),
  ],
  knacks: [{ name: 'Hunting' }],
  spells: {
    known: [
      { name: 'Soul Armor', learntSuccess: 2 }, { name: 'Shadow Meld', learntSuccess: 2 },
      { name: 'Spirit Grip', learntSuccess: 0 }, { name: 'Astral Spear', learntSuccess: 1 },
      { name: 'Death\'s Head', learntSuccess: 1 }, { name: 'Night\'s Edge', learntSuccess: 0 },
      { name: 'Summon Fog Ghost', learntSuccess: 2 }, { name: 'Arrow of Night', learntSuccess: 0 },
    ],
    matrices: [
      { type: 'Standard', spell: 'Astral Spear' },
      { type: 'Standard', spell: 'Death\u2019s Head' },
      { type: 'Standard', spell: 'Arrow of Night' },
    ],
  },
  traits: [],
  items: [{ name: 'Braces Of Defence', equipped: true, threadRank: 1 }, { name: 'Bracers of Aras', equipped: true, threadRank: 2 }],
  wealth,
};

const TESTCHAR_LIKE = {
  schema: 'ed-character/2',
  meta: { name: 'Test Like', race: 'Ork' },
  attributes: {
    Dexterity: { base: 10, points: 8, increases: 2 },
    Strength: { base: 13, points: 5, increases: 2 },
    Toughness: { base: 11, points: 4, increases: 2 },
    Perception: { base: 10, points: 3, increases: 1 },
    Willpower: { base: 8, points: 4, increases: 1 },
    Charisma: { base: 9, points: 2, increases: 2 },
  },
  resources: {
    karma: { converted: 123, spent: 105 },
    legend: { totalSpent: 44661, totalEarnt: 45315 },
    health: { damage: 39, wounds: 2, recoveriesUsed: 0 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 3,
      talents: [
        t('Avoid Blow', 4), t('Durability', 5), t('Karma Ritual', 4), t('Missile Weapon', 5), t('Mystic Aim', 5),
        t('Thread Weaving (Archer)', 4), t('True Shot', 4), t('Awareness', 4), t('Mystic Pursuit', 4, 2),
        t('Throwing Weapon', 3, 2), t('Anticipate Blow', 4, 3), t('Stealthy Stride', 4, 3),
      ],
    },
  ],
  skills: [
    sk('Speak Language (Ork)', 2), sk('Speak Language (Theran)', 1), sk('Speak Language (Throalic)', 1),
    sk('Read/Write Language (Theran)', 1), sk('Navigation', 1), sk('Tracking', 3), sk('Air Sailing', 2),
    sk('Public Speaking', 1), sk('Tattooist', 2), sk('Unarmed Combat', 2), sk('Melee Weapon', 1),
    sk('Wilderness Survival', 1), sk('Horror Lore', 1),
  ],
  knacks: [{ name: 'Hunting' }],
  traits: [],
  items: [],
  wealth,
};

// Resolved knacks the way store.resolveKnack hands them to the audit (requiredRank from the catalog).
const knacksFor = (c) => (c.knacks ?? []).map((k) => ({ name: k.name, requiredRank: knackCatalog[k.name]?.requiredRank ?? null }));

const VARIANTS = {
  // Kolon-like Ork Thief: Karma economy off.
  A_plain: [KOLON_LIKE, { knacks: knacksFor(KOLON_LIKE) }],
  // Kolon-like with the Karma-economy sink (Ork Legend-per-Karma = 7).
  A_karma: [KOLON_LIKE, { knacks: knacksFor(KOLON_LIKE), karmaRitualCost: 7 }],
  // Chakka-like Archer 4 + Nethermancer 3: standard additional-Discipline tables, spells at full price, thread items.
  B_standard: [CHAKKA_LIKE, { threadItemCatalog, spellCatalog, spellCostMultiplier: 1, tierShift: 0 }],
  // Chakka-like with additional-Discipline tier shift, Karma economy (rituals ledger) and knacks.
  B_shift_karma: [CHAKKA_LIKE, { knacks: knacksFor(CHAKKA_LIKE), threadItemCatalog, spellCatalog, spellCostMultiplier: 1, karmaRitualCost: 7, tierShift: 1 }],
  // Chakka-like with the free-spell-learning house rule (multiplier 0).
  B_free_spells: [CHAKKA_LIKE, { threadItemCatalog, spellCatalog, spellCostMultiplier: 0, tierShift: 1 }],
  // Test-char-like single Archer 3, no options.
  C_plain: [TESTCHAR_LIKE, {}],
};

const GOLD_TOTALS = {
  A_plain: {"total":16000,"recorded":43380,"delta":27380,"sections":[["attributes",9200],["talents:0",800],["skills",5000],["knacks",1000]]},
  A_karma: {"total":16875,"recorded":43380,"delta":26505,"sections":[["attributes",9200],["talents:0",800],["skills",5000],["knacks",1000],["karma-rituals",875]]},
  B_standard: {"total":43900,"recorded":45261,"delta":1361,"sections":[["attributes",10000],["talents:0",16000],["talents:1",11100],["skills",4900],["knacks",0],["threads",600],["spells",1300]]},
  B_shift_karma: {"total":43861,"recorded":45261,"delta":1400,"sections":[["attributes",10000],["talents:0",16000],["talents:1",10000],["skills",4900],["knacks",200],["threads",600],["spells",1300],["karma-rituals",861]]},
  B_free_spells: {"total":41500,"recorded":45261,"delta":3761,"sections":[["attributes",10000],["talents:0",16000],["talents:1",10000],["skills",4900],["knacks",0],["threads",600],["spells",0]]},
  C_plain: {"total":29700,"recorded":44661,"delta":14961,"sections":[["attributes",10000],["talents:0",15100],["skills",4600],["knacks",0]]},
};

const GOLD_LINES_A_KARMA = {
  "attributes": [
    ["Dexterity","+3",4200],
    ["Strength","+3",4200],
    ["Perception","+1",800],
  ],
  "talents:0": [
    ["Awareness","Novice · Rank 1",100],
    ["Durability","Novice · Rank 1",100],
    ["Karma Ritual","Novice · Rank 1",100],
    ["Lock Picking","Novice · Rank 1",100],
    ["Picking Pockets","Novice · Rank 1",100],
    ["Stealthy Stride","Novice · Rank 1",100],
    ["Thread Weaving (Thief)","Novice · Rank 1",100],
    ["Melee Weapon","Novice · Rank 1",100],
  ],
  "skills": [
    ["Acrobatic Defense","Novice · Rank 4",1800],
    ["Air Sailing","Novice · Rank 2",500],
    ["Animal Handling","Novice · Rank 1",200],
    ["Read/Write Language (Throalic)","Novice · Rank 1",200],
    ["Speak Language (Ork)","Novice · Rank 1",200],
    ["Speak Language (Theran)","Novice · Rank 1",200],
    ["Speak Language (Throalic)","Novice · Rank 1",200],
    ["Swimming","Novice · Rank 1",200],
    ["Tailor","Novice · Rank 2",500],
    ["Wilderness Survival","Novice · Rank 3",1000],
  ],
  "knacks": [
    ["Lip Reading","Rank 3",300],
    ["Animal Tracking","Rank 2",200],
    ["Hunting","Rank 2",200],
    ["Riding","Rank 3",300],
  ],
  "karma-rituals": [
    ["Karma conversions (historic)","+125 Karma @ 7/pt",875],
  ],
};

const GOLD_LINES_B_SHIFT_KARMA = {
  "attributes": [
    ["Dexterity","+2",2100],
    ["Strength","+2",2100],
    ["Toughness","+2",2100],
    ["Perception","+1",800],
    ["Willpower","+1",800],
    ["Charisma","+2",2100],
  ],
  "talents:0": [
    ["Avoid Blow","Novice · Rank 4",1100],
    ["Durability","Novice · Rank 5",1900],
    ["Karma Ritual","Novice · Rank 4",1100],
    ["Missile Weapon","Novice · Rank 5",1900],
    ["Mystic Aim","Novice · Rank 5",1900],
    ["Thread Weaving (Archer)","Novice · Rank 4",1100],
    ["True Shot","Novice · Rank 4",1100],
    ["Awareness","Novice · Rank 4",1100],
    ["Mystic Pursuit","Novice · Rank 4",1100],
    ["Throwing Weapon","Novice · Rank 3",600],
    ["Anticipate Blow","Novice · Rank 4",1100],
    ["Stealthy Stride","Novice · Rank 4",1100],
    ["Long Shot","Novice · Rank 3",600],
    ["First Impression","Novice · Rank 2",300],
  ],
  "talents:1": [
    ["Astral Sight","Novice → Journeyman · Rank 3",1000],
    ["Frighten","Novice → Journeyman · Rank 3",1000],
    ["Patterncraft","Novice → Journeyman · Rank 3",1000],
    ["Spellcasting","Novice → Journeyman · Rank 4",1800],
    ["Thread Weaving (Nethermancer)","Novice → Journeyman · Rank 3",1000],
    ["Dispel Magic","Novice → Journeyman · Rank 3",1000],
    ["Steel Thought","Novice → Journeyman · Rank 3",1000],
    ["Standard Matrix","Novice → Journeyman · Rank 3",1000],
    ["Spirit Talk","Novice → Journeyman · Rank 2",500],
    ["Suppress Curse","Novice → Journeyman · Rank 1",200],
    ["Command Nightflyer","Novice → Journeyman · Rank 2",500],
  ],
  "skills": [
    ["Speak Language (Ork)","Novice · Rank 2",500],
    ["Speak Language (Theran)","Novice · Rank 1",200],
    ["Speak Language (Throalic)","Novice · Rank 1",200],
    ["Read/Write Language (Theran)","Novice · Rank 1",200],
    ["Navigation","Novice · Rank 1",200],
    ["Tracking","Novice · Rank 2",500],
    ["Air Sailing","Novice · Rank 2",500],
    ["Public Speaking","Novice · Rank 1",200],
    ["Tattooist","Novice · Rank 3",1000],
    ["Unarmed Combat","Novice · Rank 2",500],
    ["Melee Weapon","Novice · Rank 1",200],
    ["Wilderness Survival","Novice · Rank 2",500],
    ["Horror Lore","Novice · Rank 1",200],
  ],
  "knacks": [
    ["Hunting","Rank 2",200],
  ],
  "threads": [
    ["Braces Of Defence","Novice · Thread Rank 1",100],
    ["Bracers of Aras","Journeyman · Thread Rank 2",500],
  ],
  "spells": [
    ["Soul Armor","Circle 1",100],
    ["Shadow Meld","Circle 1",100],
    ["Spirit Grip","Circle 1",100],
    ["Astral Spear","Circle 1",100],
    ["Death's Head","Circle 2",200],
    ["Night's Edge","Circle 2",200],
    ["Summon Fog Ghost","Circle 2",200],
    ["Arrow of Night","Circle 3",300],
  ],
  "karma-rituals": [
    ["Karma conversions (historic)","+118 Karma @ 7/pt",826],
    ["2025-03-01","+3 Karma @ 7/pt",21],
    ["2025-04-12","+2 Karma @ 7/pt",14],
  ],
};

const GOLD_STEPS = {"talentFirst":[100,200,300,500,800,1300],"talentFirstJourneyman":[200,300,500],"talentSecond":[300,300,500],"talentSecondShift":[200,300,500],"skillNovice":[200,300,500,800],"skillJourneyman":[300,500,800],"skillDefault":[200,300]};

const allLines = (a) => Object.fromEntries(a.sections.map((s) => [s.key, s.lines.map((l) => [l.name, l.detail, l.cost])]));

describe('GOLDEN (pre-existing behaviour, must stay green): auditLegendSpent without a creation block', () => {
  for (const [name, [character, opts]] of Object.entries(VARIANTS)) {
    test(`${name}: total, recorded, delta and per-section totals are unchanged`, () => {
      const a = auditLegendSpent(character, costs, opts);
      assert.deepEqual(
        { total: a.total, recorded: a.recorded, delta: a.delta, sections: a.sections.map((s) => [s.key, s.total]) },
        GOLD_TOTALS[name],
      );
    });
  }

  test('A_karma: every line (name, detail, cost) is unchanged - incl. the historic Karma line', () => {
    const [character, opts] = VARIANTS.A_karma;
    assert.deepEqual(allLines(auditLegendSpent(character, costs, opts)), GOLD_LINES_A_KARMA);
  });

  test('B_shift_karma: every line is unchanged - 2nd-Discipline tier shift, spells, threads, ritual events', () => {
    const [character, opts] = VARIANTS.B_shift_karma;
    assert.deepEqual(allLines(auditLegendSpent(character, costs, opts)), GOLD_LINES_B_SHIFT_KARMA);
  });

  test('Karma sink is converted x ritualCost for a character without a creation block (creationKarma offered or not)', () => {
    const plain = auditLegendSpent(KOLON_LIKE, costs, { karmaRitualCost: 7 });
    assert.equal(plain.sections.find((s) => s.key === 'karma-rituals').total, 125 * 7);
    // The free-creation-Karma deduction applies ONLY when a creation block is present.
    const offered = auditLegendSpent(KOLON_LIKE, costs, { karmaRitualCost: 7, creationKarma: 5 });
    assert.equal(offered.sections.find((s) => s.key === 'karma-rituals').total, 125 * 7);
  });

  test('an existing character is never mutated by the audit', () => {
    const frozen = structuredClone(CHAKKA_LIKE);
    auditLegendSpent(CHAKKA_LIKE, costs, VARIANTS.B_shift_karma[1]);
    assert.deepEqual(CHAKKA_LIKE, frozen);
  });
});

describe('GOLDEN (pre-existing behaviour, must stay green): rank-step pricing helpers without freeRank', () => {
  test('first-Discipline talent steps (Novice and Journeyman columns)', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((r) => talentRankStepCost({ circle: 1 }, 1, null, costs, r)), GOLD_STEPS.talentFirst);
    assert.deepEqual([1, 2, 3].map((r) => talentRankStepCost({ circle: 5 }, 1, null, costs, r)), GOLD_STEPS.talentFirstJourneyman);
  });

  test('additional-Discipline talent steps (standard tables and the tier-shift rule)', () => {
    const low = lowestPriorCircle(CHAKKA_LIKE.disciplines, 1);
    assert.deepEqual([1, 2, 3].map((r) => talentRankStepCost({ circle: 1 }, 2, low, costs, r)), GOLD_STEPS.talentSecond);
    assert.deepEqual([1, 2, 3].map((r) => talentRankStepCost({ circle: 1 }, 2, low, costs, r, { tierShift: 1 })), GOLD_STEPS.talentSecondShift);
  });

  test('skill steps (Novice, Journeyman, default tier)', () => {
    assert.deepEqual([1, 2, 3, 4].map((r) => skillRankStepCost({ tier: 'Novice' }, costs, r)), GOLD_STEPS.skillNovice);
    assert.deepEqual([1, 2, 3].map((r) => skillRankStepCost({ tier: 'Journeyman' }, costs, r)), GOLD_STEPS.skillJourneyman);
    assert.deepEqual([1, 2].map((r) => skillRankStepCost({}, costs, r)), GOLD_STEPS.skillDefault);
  });

  test('a step that is not a rank (<= 0) costs nothing', () => {
    assert.equal(talentRankStepCost({ circle: 1 }, 1, null, costs, 0), 0);
    assert.equal(skillRankStepCost({ tier: 'Novice' }, costs, 0), 0);
  });
});
