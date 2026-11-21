// engine/legend-spent-creation.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A2: the Legend audit and the rank-step pricing helpers honour the
// additive `creation` block { open, free: { talents, skills, spells } } (spec "creation.free
// ledger semantics (normative)" 1-6). These are the NEW-FEATURE tests: they fail until the dev
// builds the feature. The pre-existing behaviour is pinned separately in
// engine/legend-spent-golden.test.js (GOLDEN, must stay green).
//
// Rules cited: rules.md R1 (Durability / Karma Ritual seeded free), R4 (free creation Karma,
// round-2), R5/R6 (free skill ranks / spells), R7 (Legend 0). Cost tables are read from the real
// rules/legend.json; spell Circles from the real rules/spells.json. No Earthdawn number is
// asserted from memory: every expected sum is built from the table rows in the test itself.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as legend from './legend-spent.js';

const { auditLegendSpent, talentRankStepCost, skillRankStepCost } = legend;
const read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const costs = read('legend.json').costs;
const spellCatalog = read('spells.json').spells;

const T = (name, rank, circle = 1) => ({ name, rank, circle });
const S = (name, rank, tier = 'Novice') => ({ name, rank, tier });

// Sum of the table steps (from, to] in one column: independent of the code under test.
const stepSum = (table, column, from, to) => {
  let sum = 0;
  for (let i = from + 1; i <= to; i++) sum += table[String(i)][column];
  return sum;
};
// "Net" cost of a ranked line with `free` free ranks: only the ranks above the free ones cost Legend.
const talentNet = (rank, free, tier = 'Novice') => stepSum(costs.talentRank, tier, Math.min(free, rank), rank);
const skillNet = (rank, free, tier = 'Novice') => stepSum(costs.skillRank, tier, Math.min(free, rank), rank);

const ledger = (f = {}, open = true) => ({ open, free: { talents: {}, skills: {}, spells: [], ...f } });
const archer = (talents, circle = 1) => ({ name: 'Archer', circle, talents });
const character = (over = {}) => ({
  schema: 'ed-character/2',
  meta: { id: 't', name: 'T', race: 'Human' },
  attributes: {},
  disciplines: [], // each test names the lines it prices, so the totals isolate one sink
  skills: [],
  knacks: [],
  resources: { karma: { converted: 0, spent: 0 }, legend: { earned: [] } },
  creation: ledger(),
  ...over,
});
const section = (a, key) => a.sections.find((s) => s.key === key);
const line = (a, key, name) => section(a, key).lines.find((l) => l.name === name);
const total = (c, opts = {}) => auditLegendSpent(c, costs, opts).total;

describe('talent ledger (first Discipline): cost = cum(rank) - cum(min(free, rank)) at the talent own tier', () => {
  test('ranks up to the free count cost 0 Legend', () => {
    const c = character({ disciplines: [archer([T('Missile Weapon', 3)])], creation: ledger({ talents: { 'Archer/Missile Weapon': 3 } }) });
    const a = auditLegendSpent(c, costs, {});
    assert.equal(line(a, 'talents:0', 'Missile Weapon').cost, 0);
    assert.equal(section(a, 'talents:0').total, 0);
    assert.equal(a.total, 0);
  });

  test('ranks above the free count cost the normal step: Rank 4 with 2 free = steps 3 and 4 only', () => {
    const c = character({ disciplines: [archer([T('Missile Weapon', 4)])], creation: ledger({ talents: { 'Archer/Missile Weapon': 2 } }) });
    const cost = line(auditLegendSpent(c, costs, {}), 'talents:0', 'Missile Weapon').cost;
    assert.equal(cost, stepSum(costs.talentRank, 'Novice', 2, 4));
    assert.equal(cost, costs.talentRank['3'].Novice + costs.talentRank['4'].Novice);
  });

  test('a free count above the stored rank clamps: never negative, never a refund', () => {
    for (const rank of [0, 1, 2]) {
      const c = character({ disciplines: [archer([T('Missile Weapon', rank)])], creation: ledger({ talents: { 'Archer/Missile Weapon': 3 } }, false) });
      const l = line(auditLegendSpent(c, costs, {}), 'talents:0', 'Missile Weapon');
      assert.equal(l.cost, 0, `rank ${rank} under 3 free`);
    }
  });

  test('raising back up to the free count is free again; one more rank costs a normal step', () => {
    const costAt = (rank) => line(auditLegendSpent(character({ disciplines: [archer([T('Missile Weapon', rank)])], creation: ledger({ talents: { 'Archer/Missile Weapon': 2 } }, false) }), costs, {}), 'talents:0', 'Missile Weapon').cost;
    assert.deepEqual([0, 1, 2].map(costAt), [0, 0, 0]);
    assert.equal(costAt(3), costs.talentRank['3'].Novice);
  });

  test('free ranks are priced in the tier they came from: a Circle-5 (Journeyman) talent, Rank 3, 1 free', () => {
    const c = character({ disciplines: [archer([T('Long Shot', 3, 5)], 5)], creation: ledger({ talents: { 'Archer/Long Shot': 1 } }, false) });
    const cost = line(auditLegendSpent(c, costs, {}), 'talents:0', 'Long Shot').cost;
    assert.equal(cost, talentNet(3, 1, 'Journeyman'));
    assert.equal(cost, costs.talentRank['2'].Journeyman + costs.talentRank['3'].Journeyman);
  });

  test('the seeded Durability and Karma Ritual (Rank 1, free) cost 0 Legend (R1 round-2 decision)', () => {
    const c = character({
      disciplines: [archer([T('Durability', 1), T('Karma Ritual', 1)])],
      creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 } }),
    });
    assert.equal(total(c), 0);
  });

  test('the ledger key is `${discipline}/${talent}`: a key for another Discipline or another talent discounts nothing', () => {
    const base = character({ disciplines: [archer([T('Missile Weapon', 2)])], creation: ledger() });
    const full = total(base);
    assert.equal(full, talentNet(2, 0));
    for (const key of ['Warrior/Missile Weapon', 'Archer/Mystic Aim', 'Missile Weapon']) {
      assert.equal(total({ ...base, creation: ledger({ talents: { [key]: 2 } }) }), full, key);
    }
    assert.equal(total({ ...base, creation: ledger({ talents: { 'Archer/Missile Weapon': 2 } }) }), 0);
  });

  test('keys of a Discipline at ordinal > 1 are ignored (second-Discipline path untouched)', () => {
    const two = (free) => character({
      disciplines: [archer([T('Missile Weapon', 3)], 3), { name: 'Warrior', circle: 1, talents: [T('Melee Weapon', 2)] }],
      creation: ledger({ talents: free }),
    });
    for (const opts of [{}, { tierShift: 1 }]) {
      const without = auditLegendSpent(two({}), costs, opts);
      const withKey = auditLegendSpent(two({ 'Warrior/Melee Weapon': 2 }), costs, opts);
      assert.equal(section(withKey, 'talents:1').total, section(without, 'talents:1').total, JSON.stringify(opts));
      assert.equal(section(withKey, 'talents:1').total > 0, true);
      // ...while the ordinal-1 key still applies
      const first = auditLegendSpent(two({ 'Archer/Missile Weapon': 3, 'Warrior/Melee Weapon': 2 }), costs, opts);
      assert.equal(section(first, 'talents:0').total, 0);
      assert.equal(section(first, 'talents:1').total, section(without, 'talents:1').total);
    }
  });

  test('Line detail gains " · N free" when free ranks apply, and only then (display only)', () => {
    const c = character({
      disciplines: [archer([T('Missile Weapon', 3), T('Mystic Aim', 1)])],
      creation: ledger({ talents: { 'Archer/Missile Weapon': 2 } }),
    });
    const a = auditLegendSpent(c, costs, {});
    assert.ok(line(a, 'talents:0', 'Missile Weapon').detail.includes(' · 2 free'), line(a, 'talents:0', 'Missile Weapon').detail);
    assert.ok(!/free/.test(line(a, 'talents:0', 'Mystic Aim').detail));
  });
});

describe('skill ledger: same rule with the Skill Training table and the stored tier', () => {
  test('ranks up to the free count are free; above it the normal step (Novice Rank 3, 1 free = steps 2 and 3)', () => {
    const mk = (rank) => character({ skills: [S('Climbing', rank)], creation: ledger({ skills: { Climbing: 1 } }) });
    assert.equal(line(auditLegendSpent(mk(1), costs, {}), 'skills', 'Climbing').cost, 0);
    const three = line(auditLegendSpent(mk(3), costs, {}), 'skills', 'Climbing').cost;
    assert.equal(three, skillNet(3, 1));
    assert.equal(three, costs.skillRank['2'].Novice + costs.skillRank['3'].Novice);
  });

  test('the key is the full stored name (e.g. Knowledge (Barsaive History)); a free count above the rank clamps', () => {
    const c = character({
      skills: [S('Knowledge (Barsaive History)', 1), S('Speak Language (Ork)', 1)],
      creation: ledger({ skills: { 'Knowledge (Barsaive History)': 3, 'Speak Language (Ork)': 1 } }),
    });
    const a = auditLegendSpent(c, costs, {});
    assert.equal(line(a, 'skills', 'Knowledge (Barsaive History)').cost, 0);
    assert.equal(line(a, 'skills', 'Speak Language (Ork)').cost, 0);
    assert.equal(a.total, 0);
    // The base catalog name does NOT discount the free-text entry.
    const wrongKey = character({ skills: [S('Knowledge (Barsaive History)', 1)], creation: ledger({ skills: { Knowledge: 1 } }) });
    assert.equal(total(wrongKey), skillNet(1, 0));
  });

  test('the stored tier is used: a Journeyman skill, Rank 2, 1 free', () => {
    const c = character({ skills: [S('Aggressive Maneuver', 2, 'Journeyman')], creation: ledger({ skills: { 'Aggressive Maneuver': 1 } }) });
    assert.equal(line(auditLegendSpent(c, costs, {}), 'skills', 'Aggressive Maneuver').cost, skillNet(2, 1, 'Journeyman'));
  });

  test('a skill with no stored tier defaults to Novice, exactly as before', () => {
    const c = character({ skills: [{ name: 'Climbing', rank: 2 }], creation: ledger({ skills: { Climbing: 1 } }) });
    assert.equal(line(auditLegendSpent(c, costs, {}), 'skills', 'Climbing').cost, skillNet(2, 1, 'Novice'));
  });

  test('Line detail gains " · N free" for a skill with free ranks only', () => {
    const c = character({ skills: [S('Climbing', 2), S('Swimming', 1)], creation: ledger({ skills: { Climbing: 2 } }) });
    const a = auditLegendSpent(c, costs, {});
    assert.ok(line(a, 'skills', 'Climbing').detail.includes(' · 2 free'), line(a, 'skills', 'Climbing').detail);
    assert.ok(!/free/.test(line(a, 'skills', 'Swimming').detail));
  });
});

describe('spell ledger: a spell named in free.spells costs 0 whatever the homebrew multiplier', () => {
  const known = (...names) => ({ known: names.map((n) => ({ name: n, learntSuccess: 0 })), matrices: [] });
  const circle1 = costs.talentRank['1'].Novice; // Astral Spear is Circle 1 in rules/spells.json
  const circle2 = costs.talentRank['2'].Novice; // Death’s Head is Circle 2

  test('sanity: the catalog circles this test relies on', () => {
    assert.equal(spellCatalog['Astral Spear'].circle, 1);
    assert.equal(spellCatalog['Death’s Head'].circle, 2);
  });

  test('free spell 0, the other spell at its Circle cost (multiplier 1)', () => {
    const c = character({ spells: known('Astral Spear', 'Death’s Head'), creation: ledger({ spells: ['Astral Spear'] }) });
    const a = auditLegendSpent(c, costs, { spellCatalog, spellCostMultiplier: 1 });
    assert.equal(line(a, 'spells', 'Astral Spear').cost, 0);
    assert.equal(line(a, 'spells', 'Death’s Head').cost, circle2);
    assert.equal(section(a, 'spells').total, circle2);
  });

  test('multiplier 2 scales only the non-free spell; multiplier 0 makes everything 0', () => {
    const c = character({ spells: known('Astral Spear', 'Death’s Head'), creation: ledger({ spells: ['Astral Spear'] }) });
    const two = auditLegendSpent(c, costs, { spellCatalog, spellCostMultiplier: 2 });
    assert.equal(line(two, 'spells', 'Astral Spear').cost, 0);
    assert.equal(line(two, 'spells', 'Death’s Head').cost, circle2 * 2);
    const zero = auditLegendSpent(c, costs, { spellCatalog, spellCostMultiplier: 0 });
    assert.equal(section(zero, 'spells').total, 0);
  });

  test('matching is apostrophe-insensitive in both directions (typographic vs straight)', () => {
    const typographicLedger = character({ spells: known("Death's Head"), creation: ledger({ spells: ['Death’s Head'] }) });
    assert.equal(total(typographicLedger, { spellCatalog, spellCostMultiplier: 1 }), 0);
    const straightLedger = character({ spells: known('Death’s Head'), creation: ledger({ spells: ["Death's Head"] }) });
    assert.equal(total(straightLedger, { spellCatalog, spellCostMultiplier: 1 }), 0);
  });

  test('a known spell that is not in the ledger still costs its Circle (learned after Finish)', () => {
    const c = character({ spells: known('Astral Spear'), creation: ledger({ spells: [] }, false) });
    assert.equal(total(c, { spellCatalog, spellCostMultiplier: 1 }), circle1);
  });
});

describe('Karma sink with a creation block (R4 round-2: creation Karma is free)', () => {
  const withKarma = (converted, creation = ledger(), rituals) => character({ resources: { karma: { converted, spent: 0, ...(rituals ? { rituals } : {}) }, legend: { earned: [] } }, creation });
  const sink = (a) => section(a, 'karma-rituals')?.total ?? 0;

  test('converted == creationKarma: the sink is 0 and the audit total is 0', () => {
    const a = auditLegendSpent(withKarma(5), costs, { karmaRitualCost: 10, creationKarma: 5 });
    assert.equal(sink(a), 0);
    assert.equal(a.total, 0);
  });

  test('converted above creationKarma: only the excess is charged, at the ritual cost', () => {
    assert.equal(sink(auditLegendSpent(withKarma(8), costs, { karmaRitualCost: 10, creationKarma: 5 })), 30);
    assert.equal(sink(auditLegendSpent(withKarma(25, ledger({}, false)), costs, { karmaRitualCost: 10, creationKarma: 20 })), 50);
  });

  test('converted below creationKarma never goes negative', () => {
    assert.equal(sink(auditLegendSpent(withKarma(2), costs, { karmaRitualCost: 10, creationKarma: 5 })), 0);
  });

  test('a non-finite (or null) creationKarma charges nothing: no race modifier means no fabricated sink', () => {
    for (const creationKarma of [undefined, null, NaN, Infinity]) {
      const a = auditLegendSpent(withKarma(8), costs, { karmaRitualCost: 10, creationKarma });
      assert.equal(sink(a), 0, String(creationKarma));
      assert.equal(a.total, 0, String(creationKarma));
    }
  });

  test('the Karma section lines add up to the section total (historic line plus dated events)', () => {
    const a = auditLegendSpent(withKarma(8, ledger({}, false), [{ date: '2025-01-01T00:00:00Z', points: 2 }]), costs, { karmaRitualCost: 10, creationKarma: 5 });
    const s = section(a, 'karma-rituals');
    assert.equal(s.total, 30);
    assert.equal(s.lines.reduce((sum, l) => sum + l.cost, 0), 30);
  });

  test('without karmaRitualCost (rule off) no sink is charged, with or without creationKarma', () => {
    assert.equal(sink(auditLegendSpent(withKarma(8), costs, { creationKarma: 5 })), 0);
    assert.equal(sink(auditLegendSpent(withKarma(8), costs, { karmaRitualCost: 0, creationKarma: 5 })), 0);
  });
});

describe('absent creation block / empty ledger: byte-identical to today', () => {
  const plain = {
    attributes: { Dexterity: { base: 10, points: 3, increases: 1 } },
    disciplines: [archer([T('Missile Weapon', 3), T('Durability', 1)], 2), { name: 'Warrior', circle: 1, talents: [T('Melee Weapon', 1)] }],
    skills: [S('Climbing', 2), S('Knowledge (Elves)', 1)],
    spells: { known: [{ name: 'Astral Spear', learntSuccess: 0 }], matrices: [] },
    resources: { karma: { converted: 9, spent: 0 }, legend: { totalSpent: 1 } },
  };
  const strip = (a) => JSON.stringify({ total: a.total, recorded: a.recorded, delta: a.delta, sections: a.sections });

  test('no creation key vs an empty ledger (open or closed) vs a creation-less clone: same sections, lines and totals', () => {
    const opts = { spellCatalog, spellCostMultiplier: 1, tierShift: 1 };
    const bare = character({ ...plain });
    delete bare.creation;
    const reference = strip(auditLegendSpent(bare, costs, opts));
    for (const open of [true, false]) {
      assert.equal(strip(auditLegendSpent(character({ ...plain, creation: ledger({}, open) }), costs, opts)), reference, `open=${open}`);
    }
  });

  test('a creation-less character is never touched by stray ledger-looking keys elsewhere', () => {
    const bare = character({ ...plain, creation: undefined });
    const stray = { ...bare, free: { talents: { 'Archer/Missile Weapon': 3 } } };
    assert.equal(total(stray), total(bare));
  });
});

describe('rank-step helpers take opts.freeRank (first Discipline / skills): step == audit(after) - audit(before)', () => {
  test('talentRankStepCost with freeRank: the free steps are 0, the next step is the normal one', () => {
    const t = { circle: 1 };
    const step = (to, f) => talentRankStepCost(t, 1, null, costs, to, { freeRank: f });
    assert.deepEqual([1, 2].map((to) => step(to, 2)), [0, 0]);
    assert.equal(step(3, 2), costs.talentRank['3'].Novice);
    assert.equal(step(4, 2), costs.talentRank['4'].Novice);
    assert.equal(step(1, 0), costs.talentRank['1'].Novice, 'freeRank 0 is no free rank');
    assert.equal(step(3, 3), 0, 'the step that bought the last free rank is free (refund of a free rank is 0)');
    assert.equal(step(1, 3), 0, 'a free count above the rank clamps');
  });

  test('skillRankStepCost with freeRank, default opts, and the stored tier', () => {
    assert.equal(skillRankStepCost({ tier: 'Novice' }, costs, 2, { freeRank: 2 }), 0);
    assert.equal(skillRankStepCost({ tier: 'Novice' }, costs, 3, { freeRank: 2 }), costs.skillRank['3'].Novice);
    assert.equal(skillRankStepCost({ tier: 'Journeyman' }, costs, 2, { freeRank: 1 }), costs.skillRank['2'].Journeyman);
    assert.equal(skillRankStepCost({ tier: 'Novice' }, costs, 2), costs.skillRank['2'].Novice, 'opts is optional');
  });

  test('ordinal > 1: freeRank is ignored by the step helper, exactly as the audit ignores the keys', () => {
    for (const tierShift of [0, 1]) {
      const without = talentRankStepCost({ circle: 1 }, 2, 3, costs, 2, { tierShift });
      const withFree = talentRankStepCost({ circle: 1 }, 2, 3, costs, 2, { tierShift, freeRank: 2 });
      assert.equal(withFree, without, `tierShift ${tierShift}`);
      assert.ok(without > 0);
    }
  });

  test('PROPERTY (talents): for every tier, rank and free count, the step into a rank == audit(rank) - audit(rank - 1)', () => {
    let checked = 0;
    for (const circle of [1, 5, 9, 13]) {
      const tierName = costs.tiers.find((b) => circle >= b.minCircle && circle <= b.maxCircle).label;
      for (let free = 0; free <= 7; free++) {
        const key = 'Archer/Missile Weapon';
        const build = (rank) => character({
          disciplines: [archer([T('Missile Weapon', rank, circle)], circle)],
          creation: ledger(free ? { talents: { [key]: free } } : {}, false),
        });
        for (let rank = 1; rank <= 8; rank++) {
          const step = talentRankStepCost({ circle }, 1, null, costs, rank, free ? { freeRank: free } : {});
          const diff = total(build(rank)) - total(build(rank - 1));
          assert.equal(step, diff, `circle ${circle}, free ${free}, step into rank ${rank}`);
          assert.ok(step >= 0, 'a step is never negative');
          // ...and the ledger really discounts: free steps are 0, later ones are the plain table step.
          assert.equal(step, rank <= free ? 0 : costs.talentRank[String(rank)][tierName], `circle ${circle}, free ${free}, rank ${rank}`);
          checked++;
        }
      }
    }
    assert.ok(checked > 100);
  });

  test('PROPERTY (skills): for both tiers, every rank and free count, the step == audit(rank) - audit(rank - 1)', () => {
    let checked = 0;
    for (const tier of ['Novice', 'Journeyman']) {
      for (let free = 0; free <= 8; free++) {
        const build = (rank) => character({
          skills: [S('Climbing', rank, tier)],
          creation: ledger(free ? { skills: { Climbing: free } } : {}, false),
        });
        for (let rank = 1; rank <= 8; rank++) {
          const step = skillRankStepCost({ tier }, costs, rank, free ? { freeRank: free } : {});
          const diff = total(build(rank)) - total(build(rank - 1));
          assert.equal(step, diff, `${tier}, free ${free}, step into rank ${rank}`);
          assert.equal(step, rank <= free ? 0 : costs.skillRank[String(rank)][tier], `${tier}, free ${free}, rank ${rank}`);
          checked++;
        }
      }
    }
    assert.ok(checked > 100);
  });
});

test('the audit never mutates the character or its creation block', () => {
  const c = character({
    disciplines: [archer([T('Missile Weapon', 3)])],
    skills: [S('Climbing', 2)],
    creation: ledger({ talents: { 'Archer/Missile Weapon': 2 }, skills: { Climbing: 1 } }),
  });
  const frozen = structuredClone(c);
  auditLegendSpent(c, costs, { karmaRitualCost: 10, creationKarma: 5, spellCatalog });
  assert.deepEqual(c, frozen);
});
