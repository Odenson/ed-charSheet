// store-creation-audit.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A2, store half: how deriveModel treats a character that carries the
// additive `creation` block { open, free } (spec A2 "store.js" + "Rules"). NEW-FEATURE tests:
// they fail until the dev builds the feature. Existing-character behaviour is pinned by the
// GOLDEN files (engine/legend-spent-golden.test.js, store-creation-golden.test.js).
//
// Covered here:
//  - Legend derives 0 earned / 0 spent / 0 available while `creation` exists (R7), under the REAL
//    homebrew `hb-karma-economy` (R4 round-2: creation Karma costs no Legend), for every race;
//  - the placeholder (model.legend === null) is kept for a character WITHOUT `creation`;
//  - PROPERTY: for every talent and skill row, pricing.increaseCost / refund equal
//    audit(after) - audit(before), with and without free ranks, and `affordable` agrees with the
//    ed-app `_canAffordRank` rule when that guard audits with `model.legendAuditOptions`;
//  - model.legendAuditOptions; Karma max with the derived leftover-attribute bonus inside the
//    race cap (R3/R4: min(Karma Modifier x Circle + bonus, cap)); deriveModel without
//    attributesFile / spellsFile; the extracted store helpers homebrewSetsFor and makeSkillRef.
//
// Expected race numbers (karmaModifier, karma.maxCap, karma.ritualCost) are READ from
// rules/races.json and rules/homebrew.json, never restated (spec "Rules": "Tests read the files").

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from './store.js';
import { auditLegendSpent } from './engine/legend-spent.js';

const { deriveModel } = store;

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

const read = (p) => JSON.parse(readFileSync(new URL('./rules/' + p, import.meta.url)));
const rules = {
  steps: read('steps.json').steps,
  talentsFile: read('talents.json'),
  disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'),
  characteristicsFile: read('characteristics.json'),
  itemsFile: read('items.json'),
  legendFile: read('legend.json'),
  skillsFile: read('skills.json'),
  knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'),
  homebrewFile: read('homebrew.json'),
  spellsFile: read('spells.json'),
  attributesFile: read('attributes.json'),
};
const costs = rules.legendFile.costs;
const RACES = rules.racesFile.races;
const economy = rules.homebrewFile.rules.find((r) => r.id === 'hb-karma-economy').set;
const modFor = (race) => RACES.find((r) => r.name === race).karmaModifier;
const capFor = (race) => economy['karma.maxCap'][race] ?? null;
const ritualFor = (race) => economy['karma.ritualCost'][race];
// Max Karma at Circle 1 per R4: min(Karma Modifier x Circle + leftover, cap). Computed here, not via the engine.
const expectedMax = (race, bonus = 0) => {
  const base = modFor(race) * 1 + bonus;
  const cap = capFor(race);
  return cap == null ? base : Math.min(base, cap);
};

const T = (name, rank, circle = 1) => ({ name, rank, circle });
const S = (name, rank, tier = 'Novice') => ({ name, rank, tier });
const wealth = { coins: { copper: 0, silver: 100, gold: 0, earth: 0, water: 0, air: 0, fire: 0, orichalcum: 0 }, gems: [] };
const ledger = (f = {}, open = true) => ({ open, free: { talents: {}, skills: {}, spells: [], ...f } });
const sinkOf = (model) => model.legend?.spent.sections.find((s) => s.key === 'karma-rituals')?.total ?? 0;

// A builder-shaped draft written inline (the builder itself lands in slice A3).
function draft({ race = 'Human', discipline = 'Archer', creation = ledger({ talents: { [`${discipline}/Durability`]: 1, [`${discipline}/Karma Ritual`]: 1 } }), converted, points = {}, talents, skills = [], extra = {} } = {}) {
  const raceEntry = RACES.find((r) => r.name === race);
  return {
    schema: 'ed-character/2',
    meta: { id: 'tester', name: 'Tester', race },
    attributes: Object.fromEntries(rules.attributesFile.order.map((n) => [n, { base: raceEntry.startingAttributes[n], points: points[n] ?? 0, increases: 0 }])),
    disciplines: [{ name: discipline, circle: 1, talents: talents ?? [T('Durability', 1), T('Karma Ritual', 1)] }],
    skills,
    knacks: [],
    traits: [],
    resources: {
      karma: { converted: converted ?? expectedMax(race), spent: 0 },
      legend: { earned: [] },
      health: { damage: 0, wounds: 0, recoveriesUsed: 0 },
    },
    items: [],
    wealth,
    creation,
    ...extra,
  };
}

describe('Legend derives 0 / 0 / 0 while a creation block exists (R7, R4 round-2) - under the real hb-karma-economy', () => {
  for (const { name: race } of RACES) {
    test(`${race}: a new character shows Legend earned 0, spent 0, available 0 and a zero Karma sink`, () => {
      memory.clear();
      const model = deriveModel(draft({ race }), rules);
      assert.ok(model.legend, 'Legend is a real standing, not the placeholder');
      assert.equal(model.legend.totalEarnt, 0);
      assert.equal(model.legend.spent.total, 0);
      assert.equal(model.legend.available, 0);
      assert.equal(sinkOf(model), 0, `${race}: starting Karma is free (ritual cost ${ritualFor(race)}/pt is not charged)`);
      assert.equal(model.characteristics.karma.max, expectedMax(race));
      assert.equal(model.characteristics.karma.available, expectedMax(race), 'starts at full Karma');
    });
  }

  test('control (passes before and after): WITHOUT a creation block the same Karma IS charged as Legend', () => {
    memory.clear();
    const c = draft({ race: 'Ork', creation: undefined });
    delete c.creation;
    c.resources.legend = { earned: [{ id: 'e1', amount: 1000, description: 'x', date: '2025-01-01' }] };
    const model = deriveModel(c, rules);
    assert.equal(sinkOf(model), expectedMax('Ork') * ritualFor('Ork'));
  });

  test('a creation character with legacy totalEarnt keeps it; with an earned entry the entries are summed (0 is only the fallback)', () => {
    memory.clear();
    const legacy = draft();
    legacy.resources.legend = { totalEarnt: 500 };
    assert.equal(deriveModel(legacy, rules).legend.totalEarnt, 500);
    assert.equal(deriveModel(legacy, rules).legend.available, 500);
    const entries = draft();
    entries.resources.legend = { earned: [{ id: 'e1', amount: 300, description: 'x', date: '2025-01-01' }] };
    assert.equal(deriveModel(entries, rules).legend.totalEarnt, 300);
    assert.equal(deriveModel(entries, rules).legend.available, 300);
  });

  test('a Legend raise after creation draws on a zero Available: not affordable', () => {
    memory.clear();
    const c = draft({ talents: [T('Durability', 1), T('Karma Ritual', 1), T('Missile Weapon', 3)], creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 3 } }, false) });
    const model = deriveModel(c, rules);
    assert.equal(model.legend?.available, 0, 'Available Legend is a real 0, not the placeholder');
    const row = model.disciplines[0].talents.find((t) => t.name === 'Missile Weapon');
    assert.equal(row.pricing.increaseCost, costs.talentRank['4'].Novice, 'only Rank 4 costs: the three free ranks are not re-bought');
    assert.equal(row.pricing.affordable, false);
  });
});

describe('model.legendAuditOptions: the exact opts deriveModel hands to auditLegendSpent', () => {
  const SIX = ['knacks', 'threadItemCatalog', 'spellCatalog', 'spellCostMultiplier', 'karmaRitualCost', 'tierShift'];

  test('carries the six existing options with their derived values and exposes creationKarma for a creation character', () => {
    memory.clear();
    const model = deriveModel(draft({ race: 'Troll' }), rules);
    const o = model.legendAuditOptions;
    assert.ok(o && typeof o === 'object', 'model.legendAuditOptions exists');
    for (const k of [...SIX, 'creationKarma']) assert.ok(k in o, `option ${k}`);
    assert.equal(o.karmaRitualCost, ritualFor('Troll'));
    assert.equal(o.tierShift, 1, 'hb-additional-tier-shift');
    assert.equal(o.spellCostMultiplier, 0, 'hb-free-spell-learning');
    assert.deepEqual(o.knacks, model.knacks, 'resolved knacks, as the audit receives them');
    assert.equal(o.spellCatalog, rules.spellsFile.spells);
    assert.equal(o.creationKarma, expectedMax('Troll'), 'open: creation Karma is the Circle-1 maximum');
  });

  test('creationKarma is set only when the character has a creation block', () => {
    memory.clear();
    const c = draft({ creation: undefined });
    delete c.creation;
    const o = deriveModel(c, rules).legendAuditOptions;
    for (const k of SIX) assert.ok(k in o, `option ${k}`);
    assert.ok(o.creationKarma == null, 'no creation block => no creationKarma');
  });

  test('auditing with the exposed options reproduces model.legend.spent exactly (creation, caster with spells, and plain)', () => {
    memory.clear();
    const caster = draft({
      race: 'Elf',
      discipline: 'Nethermancer',
      talents: [T('Durability', 1), T('Karma Ritual', 1), T('Spellcasting', 2)],
      creation: ledger({ talents: { 'Nethermancer/Durability': 1, 'Nethermancer/Karma Ritual': 1, 'Nethermancer/Spellcasting': 2 }, spells: ['Astral Spear'] }),
      extra: { spells: { known: [{ name: 'Astral Spear', learntSuccess: 0 }, { name: 'Death’s Head', learntSuccess: 0 }], matrices: [{ type: 'Standard', spell: 'Astral Spear' }, { type: 'Standard', spell: null }] } },
    });
    const finished = draft({ race: 'Human', creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 } }, false), converted: expectedMax('Human', 25) });
    const plain = draft({ race: 'Ork', creation: undefined, converted: 20 });
    delete plain.creation;
    plain.resources.legend = { totalEarnt: 9000 };
    for (const c of [caster, finished, plain]) {
      const model = deriveModel(c, rules);
      const again = auditLegendSpent(c, costs, model.legendAuditOptions);
      assert.equal(again.total, model.legend.spent.total, c.meta.race);
      assert.deepEqual(again.sections.map((s) => [s.key, s.total]), model.legend.spent.sections.map((s) => [s.key, s.total]), c.meta.race);
    }
  });
});

describe('PROPERTY: pricing.increaseCost / refund equal audit(after) - audit(before); `affordable` agrees with the ed-app guard', () => {
  // Raw rank edit helpers on a CLONE of the character: row index i in disc d, or skill index i.
  const withTalentRank = (c, d, i, rank) => {
    const next = structuredClone(c);
    next.disciplines[d].talents[i].rank = rank;
    return next;
  };
  const withSkillRank = (c, i, rank) => {
    const next = structuredClone(c);
    next.skills[i].rank = rank;
    return next;
  };

  // `_canAffordRank(next)` after the A2 fix: Available stays >= 0 when audited with model.legendAuditOptions.
  const guard = (model, nextChar) => model.legend.totalEarnt - auditLegendSpent(nextChar, costs, model.legendAuditOptions).total >= 0;

  function checkProperty(label, c, r = rules) {
    memory.clear();
    const model = deriveModel(c, r);
    assert.ok(model.legend, `${label}: a Legend standing exists`);
    const opts = model.legendAuditOptions;
    const audit = (x) => auditLegendSpent(x, costs, opts).total;
    const base = audit(c);
    assert.equal(base, model.legend.spent.total, `${label}: audit agrees with the model`);
    let rows = 0;
    model.disciplines.forEach((disc, di) => {
      disc.talents.forEach((t, ti) => {
        if (t.free || ti >= c.disciplines[di].talents.length) return; // derived free-talent rows have no pricing
        const up = audit(withTalentRank(c, di, ti, t.rank + 1)) - base;
        assert.equal(t.pricing.increaseCost, up, `${label}: ${disc.name}/${t.name} rank ${t.rank} increaseCost`);
        assert.equal(t.pricing.affordable, guard(model, withTalentRank(c, di, ti, t.rank + 1)), `${label}: ${disc.name}/${t.name} affordable == guard`);
        if (t.rank > 1) {
          const down = base - audit(withTalentRank(c, di, ti, t.rank - 1));
          assert.equal(t.pricing.refund, down, `${label}: ${disc.name}/${t.name} rank ${t.rank} refund`);
        } else {
          assert.equal(t.pricing.refund, null, `${label}: ${disc.name}/${t.name} refund is null at Rank 1`);
        }
        rows++;
      });
    });
    model.skills.forEach((s, si) => {
      const up = audit(withSkillRank(c, si, s.rank + 1)) - base;
      assert.equal(s.pricing.increaseCost, up, `${label}: skill ${s.name} rank ${s.rank} increaseCost`);
      assert.equal(s.pricing.affordable, guard(model, withSkillRank(c, si, s.rank + 1)), `${label}: skill ${s.name} affordable == guard`);
      if (s.rank > 1) assert.equal(s.pricing.refund, base - audit(withSkillRank(c, si, s.rank - 1)), `${label}: skill ${s.name} refund`);
      else assert.equal(s.pricing.refund, null);
      rows++;
    });
    assert.ok(rows >= 6, `${label}: the fixture exercised ${rows} rows`);
    return model;
  }

  const rich = { earned: [{ id: 'e1', amount: 100000, description: 'x', date: '2025-01-01' }] };
  const talents = [T('Durability', 1), T('Karma Ritual', 1), T('Missile Weapon', 2), T('Mystic Aim', 3), T('Avoid Blow', 1), T('True Shot', 4), T('Thread Weaving (Archer)', 2)];
  const skills = [S('Climbing', 1), S('Knowledge (Barsaive History)', 3), S('Swimming', 2), S('Acting', 2), S('Aggressive Maneuver', 2, 'Journeyman')];
  const key = (d, n) => `${d}/${n}`;

  const mid = { earned: [{ id: 'e1', amount: 3000, description: 'x', date: '2025-01-01' }] };

  test('creation OPEN with a mixed ledger: free below, equal to and clamped above the stored rank; zero, middling and rich purses', () => {
    for (const available of [null, mid, rich]) {
      const c = draft({
        talents,
        skills,
        creation: ledger({
          talents: { [key('Archer', 'Durability')]: 1, [key('Archer', 'Karma Ritual')]: 1, [key('Archer', 'Missile Weapon')]: 2, [key('Archer', 'Mystic Aim')]: 3, [key('Archer', 'True Shot')]: 2, [key('Archer', 'Thread Weaving (Archer)')]: 5 },
          skills: { Climbing: 1, 'Knowledge (Barsaive History)': 3, Swimming: 1 },
        }),
      });
      if (available) c.resources.legend = available;
      checkProperty(available ? `open+purse ${available.earned[0].amount}` : 'open+zero', c);
    }
  });

  test('creation FINISHED (open: false), including ranks lowered below the free count (clamped, never a refund)', () => {
    const c = draft({
      talents: [T('Durability', 1), T('Karma Ritual', 1), T('Missile Weapon', 2), T('Mystic Aim', 1), T('Avoid Blow', 1), T('True Shot', 4)],
      skills: [S('Climbing', 1), S('Swimming', 4)],
      creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 2, 'Archer/Mystic Aim': 3, 'Archer/True Shot': 3 }, skills: { Climbing: 3, Swimming: 3 } }, false),
      converted: expectedMax('Human', 25),
    });
    c.resources.legend = rich;
    const model = checkProperty('finished', c);
    const aim = model.disciplines[0].talents.find((t) => t.name === 'Mystic Aim');
    assert.equal(aim.pricing.increaseCost, 0, 'Rank 1 -> 2 is still inside the 3 free ranks');
    const climbing = model.skills.find((s) => s.name === 'Climbing');
    assert.equal(climbing.pricing.increaseCost, 0);
    assert.equal(climbing.pricing.affordable, true, 'a free step is affordable at any Available >= 0');
  });

  test('a caster with learned spells and the Karma economy on (the old _canAffordRank omitted both sinks)', () => {
    // Free-spell-learning switched off so the spell sink is real (Shadow Meld is a paid Circle-1 spell).
    const paidSpells = {
      ...rules,
      homebrewFile: { ...rules.homebrewFile, rules: rules.homebrewFile.rules.map((r) => (r.id === 'hb-free-spell-learning' ? { ...r, enabled: false } : r)) },
    };
    // Dex +5 (7) + Str +4 (5) + Tou +4 (5) + Per +2 (2) + Wil +1 (1) = 20 spent => leftover 5 (R3 cost table).
    const c = draft({
      race: 'Ork',
      discipline: 'Nethermancer',
      points: { Dexterity: 5, Strength: 4, Toughness: 4, Perception: 2, Willpower: 1 },
      talents: [T('Durability', 1), T('Karma Ritual', 1), T('Spellcasting', 2), T('Astral Sight', 1), T('Frighten', 3), T('Patterncraft', 1)],
      skills: [S('Climbing', 2), S('Swimming', 1)],
      creation: ledger({ talents: { 'Nethermancer/Durability': 1, 'Nethermancer/Karma Ritual': 1, 'Nethermancer/Spellcasting': 2, 'Nethermancer/Frighten': 3 }, skills: { Climbing: 2 }, spells: ['Astral Spear'] }, false),
      converted: expectedMax('Ork', 5) + 3, // creationKarma is 10; 3 more points bought with Legend after Finish
      extra: { spells: { known: [{ name: 'Astral Spear', learntSuccess: 0 }, { name: 'Shadow Meld', learntSuccess: 0 }], matrices: [{ type: 'Standard', spell: null }, { type: 'Standard', spell: null }] } },
    });
    c.disciplines[0].circle = 2;
    c.resources.legend = { earned: [{ id: 'e1', amount: 2500, description: 'x', date: '2025-01-01' }] };
    const model = checkProperty('caster', c, paidSpells);
    assert.equal(sinkOf(model), 3 * ritualFor('Ork'), 'the three extra Karma points are charged at the Ork ritual cost');
    const spells = model.legend.spent.sections.find((s) => s.key === 'spells');
    assert.equal(spells.total, costs.talentRank['1'].Novice, 'only Shadow Meld is paid; Astral Spear is in the free ledger');
  });

  test('a second Discipline: its ordinal-2 rows are priced from the tier tables and ignore any ledger key', () => {
    const c = draft({
      talents: [T('Durability', 1), T('Karma Ritual', 1), T('Missile Weapon', 3), T('Mystic Aim', 2), T('Avoid Blow', 1)],
      skills: [S('Climbing', 2)],
      creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1, 'Archer/Missile Weapon': 3, 'Warrior/Melee Weapon': 2 }, skills: { Climbing: 1 } }, false),
      converted: expectedMax('Human', 25),
    });
    c.disciplines.push({ name: 'Warrior', circle: 1, talents: [T('Melee Weapon', 2), T('Wood Skin', 1)] });
    c.resources.legend = rich;
    const model = checkProperty('two disciplines', c);
    const melee = model.disciplines[1].talents.find((t) => t.name === 'Melee Weapon');
    assert.ok(melee.pricing.refund > 0, 'a ledger key for an ordinal-2 Discipline discounts nothing');
  });

  test('a character without a creation block: the same property holds (nothing regressed)', () => {
    const c = draft({ creation: undefined, talents, skills });
    delete c.creation;
    c.resources.legend = rich;
    checkProperty('no creation', c);
  });
});

describe('Karma maximum with the derived leftover-attribute bonus inside the race cap (R3, R4)', () => {
  const closed = (race, points, converted) => draft({ race, points, creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 } }, false), converted });

  test('Troll, 25 unspent: min(3 + 25, 20) = 20, never 28 (the cap holds the bonus)', () => {
    memory.clear();
    assert.equal(capFor('Troll'), 20, 'house cap read from rules/homebrew.json');
    const model = deriveModel(closed('Troll', {}, 20), rules);
    assert.equal(model.characteristics.karma.max, 20);
    assert.equal(model.characteristics.karma.available, 20);
    assert.equal(sinkOf(model), 0, 'converted == creationKarma: still no Karma sink after Finish');
  });

  test('Human, 25 unspent: 5 + 25 = 30 (inside the cap); the audit charges nothing while converted equals it', () => {
    memory.clear();
    const model = deriveModel(closed('Human', {}, expectedMax('Human', 25)), rules);
    assert.equal(model.characteristics.karma.max, expectedMax('Human', 25));
    assert.equal(model.characteristics.karma.max, 30);
    assert.equal(sinkOf(model), 0);
  });

  test('partly spent attributes: leftover = 25 - cost(points) per the rules/attributes.json table', () => {
    memory.clear();
    // Dexterity +4 costs 5, Strength +2 costs 2 (R3) => leftover 25 - 7 = 18.
    const model = deriveModel(closed('Human', { Dexterity: 4, Strength: 2 }, expectedMax('Human', 18)), rules);
    assert.equal(model.characteristics.karma.max, expectedMax('Human', 18));
    assert.equal(model.characteristics.karma.max, 23);
    assert.equal(sinkOf(model), 0);
  });

  test('Karma bought with Legend after Finish (converted above creationKarma) is charged at the race ritual cost', () => {
    memory.clear();
    // All 25 attribute points spent (Dex +8 = 15, Str +6 = 9, Tou +1 = 1) => leftover 0, creationKarma = the Circle-1 value.
    const bought = closed('Human', { Dexterity: 8, Strength: 6, Toughness: 1 }, modFor('Human'));
    assert.equal(deriveModel(bought, rules).legend.spent.total, 0, 'before any purchase: nothing charged');
    // Advanced to Circle 2 and bought one more Circle of Karma with Legend: converted = 2 x modifier.
    bought.disciplines[0].circle = 2;
    bought.resources.karma.converted = modFor('Human') * 2;
    const model = deriveModel(bought, rules);
    assert.equal(model.characteristics.karma.max, expectedMax('Human') * 2);
    assert.equal(sinkOf(model), modFor('Human') * ritualFor('Human'));
  });

  test('while creation is OPEN the bonus is 0 even with unspent points: max stays the Circle-1 value', () => {
    memory.clear();
    const model = deriveModel(draft({ race: 'Troll', converted: expectedMax('Troll') }), rules);
    assert.equal(model.characteristics.karma.max, expectedMax('Troll'));
    assert.equal(model.characteristics.karma.max, modFor('Troll'));
  });

  test('a character without a creation block never gets a bonus, whatever its attribute points', () => {
    memory.clear();
    const c = draft({ race: 'Human', converted: 3 });
    delete c.creation;
    c.resources.legend = { totalEarnt: 1000 };
    assert.equal(deriveModel(c, rules).characteristics.karma.max, expectedMax('Human'));
  });

  test('unpriceable attribute points give no bonus rather than a guess (table is -2..+8)', () => {
    memory.clear();
    const model = deriveModel(closed('Human', { Dexterity: 9 }, expectedMax('Human')), rules);
    assert.equal(model.characteristics.karma.max, expectedMax('Human'));
  });
});

describe('deriveModel keeps working when rules.attributesFile or rules.spellsFile is undefined (older store tests omit them)', () => {
  test('a closed creation character without attributesFile: no throw, no bonus, Legend still 0/0/0', () => {
    memory.clear();
    const { attributesFile, ...noAttr } = rules;
    const c = draft({ race: 'Human', creation: ledger({ talents: { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 } }, false), converted: expectedMax('Human') });
    const model = deriveModel(c, noAttr);
    assert.equal(model.characteristics.karma.max, expectedMax('Human'));
    assert.equal(model.legend.available, 0);
  });

  test('a Nethermancer with a spells block and no spellsFile: no throw (spells simply price at 0 / no catalog)', () => {
    memory.clear();
    const { spellsFile, ...noSpells } = rules;
    const c = draft({
      discipline: 'Nethermancer',
      extra: { spells: { known: [], matrices: [{ type: 'Standard', spell: null }, { type: 'Standard', spell: null }] } },
      creation: ledger({ talents: { 'Nethermancer/Durability': 1, 'Nethermancer/Karma Ritual': 1 } }),
    });
    assert.doesNotThrow(() => deriveModel(c, noSpells));
    assert.equal(deriveModel(c, noSpells).legend.spent.total, 0);
  });
});

describe('store.homebrewSetsFor(homebrewFile, raceName): the homebrewSets block lifted out of deriveModel', () => {
  const file = rules.homebrewFile;

  test('resolves race-keyed and scalar `set` targets against the race, exactly as deriveModel did', () => {
    const sets = store.homebrewSetsFor(file, 'Troll');
    assert.equal(sets['karma.maxCap'], capFor('Troll'));
    assert.equal(sets['karma.ritualCost'], ritualFor('Troll'));
    assert.equal(sets['karma.step'], economy['karma.step'].Troll);
    assert.equal(sets['legend.additionalTierShift'], 1);
    assert.equal(sets['legend.spellLearnCostMultiplier'], 0, 'a falsy 0 is kept, never dropped');
    assert.equal(sets['advancement.optionalTable'], true);
  });

  test('a race absent from a race-keyed map (or no race) leaves that target un-overridden; scalars still apply', () => {
    for (const race of ['Gnome', null, undefined]) {
      const sets = store.homebrewSetsFor(file, race);
      assert.equal(sets['karma.maxCap'], undefined, String(race));
      assert.equal(sets['legend.additionalTierShift'], 1, String(race));
    }
  });

  test('missing or empty homebrew file gives an empty set', () => {
    assert.deepEqual(store.homebrewSetsFor(undefined, 'Troll'), {});
    assert.deepEqual(store.homebrewSetsFor(null, 'Troll'), {});
    assert.deepEqual(store.homebrewSetsFor({ rules: [] }, 'Troll'), {});
  });

  test('only enabled rules count, unknown targets are ignored, and the last enabled rule wins', () => {
    const f = {
      rules: [
        { id: 'a', enabled: true, set: { 'karma.step': 4, 'not.a.target': 99 } },
        { id: 'b', enabled: false, set: { 'karma.step': 9 } },
        { id: 'c', set: { 'karma.step': 6 } }, // `enabled` absent => active (enabled !== false)
      ],
    };
    const sets = store.homebrewSetsFor(f, 'Human');
    assert.equal(sets['karma.step'], 6);
    assert.ok(!('not.a.target' in sets));
  });

  test('deriveModel agrees with it (one source of truth)', () => {
    memory.clear();
    const model = deriveModel(draft({ race: 'Dwarf', converted: expectedMax('Dwarf') }), rules);
    const sets = store.homebrewSetsFor(rules.homebrewFile, 'Dwarf');
    assert.equal(model.characteristics.karma.ritualCost, sets['karma.ritualCost']);
    assert.equal(model.characteristics.karma.step, sets['karma.step']);
  });
});

describe('store.makeSkillRef(skillsFile): the existing skill lookup, moved (exact name, then bracket-stripped base)', () => {
  const ref = () => store.makeSkillRef(rules.skillsFile);
  const entry = (name) => rules.skillsFile.skills.find((s) => s.name === name);

  test('an exact catalog name resolves to that entry', () => {
    assert.equal(ref()('Speak Language (Ork)'), entry('Speak Language (Ork)'));
    assert.equal(ref()('Wood Carving'), entry('Wood Carving'));
    assert.equal(ref()('Horror Lore').category, 'knowledge');
  });

  test('a free-text name falls back to its bracket-stripped base entry', () => {
    const k = ref()('Knowledge (Barsaive History)');
    assert.equal(k.name, 'Knowledge');
    assert.equal(k.category, 'knowledge');
    assert.equal(k.generic, true);
    const a = ref()('Artisan (Candle Making)');
    assert.equal(a.name, 'Artisan');
    assert.equal(a.category, 'artisan');
    assert.equal(a.artisanKey, undefined, 'the template carries no artisanKey');
  });

  test('an unknown name resolves to null; the exact name wins over the stripped base', () => {
    assert.equal(ref()('Basket Weaving'), null);
    assert.equal(ref()('Basket Weaving (Reeds)'), null);
    assert.equal(ref()('Arrow Fletching (Artisan)').artisanKey, 'Arrow Fletching', 'a catalog name that itself ends in a bracket matches exactly');
  });

  test('deriveModel still resolves a specialised skill through it (Speak Language (Ork) keeps its derived step)', () => {
    memory.clear();
    const model = deriveModel(draft({ skills: [S('Knowledge (Barsaive History)', 1), S('Speak Language (Ork)', 1)], creation: ledger({ skills: { 'Knowledge (Barsaive History)': 1, 'Speak Language (Ork)': 1 } }) }), rules);
    for (const s of model.skills) assert.equal(s.known, true, s.name);
  });
});
