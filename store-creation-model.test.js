// store-creation-model.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slice A5, store half: `store.creationContext`, `deriveModel(...).creation`,
// `store.persistCreationEdit`, and the whole creation flow at store level, with NO UI (spec A5 "store.js"
// and Tests). Uses the builder output (engine/new-character.js, slice A3) and the REAL rules/*.json incl.
// the real homebrew file (hb-karma-economy, hb-uncon-death, hb-additional-tier-shift, hb-free-spell-learning).
// Imports of not-yet-existing modules are expected to fail until the dev builds them.
//
// Rules cited (plans/create-new-adept/rules.md): R1 (talent points; Durability seeded), R3 (attribute points,
// leftover -> Karma), R4 (Max Karma min(Modifier x Circle + leftover, cap), starts full; creation Karma free),
// R5 (skills), R6 (spell points = Perception Step), R7 (Legend 0/0/0), R10 (Finish forfeits the unspent).
// Per-race Karma numbers are READ from rules/races.json and rules/homebrew.json.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from './store.js';
import { buildNewCharacter } from './engine/new-character.js';
import {
  applyTalentRank,
  applyAttributePoints,
  applySkillAdd,
  applySkillRank,
  applySpellPick,
  finishPlan,
  finishCreation,
  spellBudget,
  skillBudget,
} from './engine/creation.js';
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
beforeEach(() => memory.clear());

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
const RACES = rules.racesFile.races.map((r) => r.name);
const DISCIPLINES = rules.disciplinesFile.disciplines.map((d) => d.name);
const economy = rules.homebrewFile.rules.find((r) => r.id === 'hb-karma-economy').set;
const modFor = (race) => rules.racesFile.races.find((r) => r.name === race).karmaModifier;
const capFor = (race) => economy['karma.maxCap'][race] ?? null;
const ritualFor = (race) => economy['karma.ritualCost'][race];
// R4: min(Karma Modifier x Circle + leftover, cap), computed here (not via the engine).
const expectedMax = (race, bonus = 0) => {
  const base = modFor(race) + bonus;
  return capFor(race) == null ? base : Math.min(base, capFor(race));
};
const isMagician = (disc) => rules.disciplinesFile.disciplines.find((d) => d.name === disc).circles.find((c) => c.circle === 1).talents.includes('Spellcasting');
const sinkOf = (model) => model.legend?.spent.sections.find((s) => s.key === 'karma-rituals')?.total ?? 0;
const perceptionStep = (model) => model.attributes.find((a) => a.name === 'Perception')?.step ?? null;

const build = (race, discipline, name = `Test ${race} ${discipline}`) =>
  buildNewCharacter({ name, race, discipline }, rules, { karmaMaxCap: capFor(race) });
const ctxOf = (character) => store.creationContext(rules, character, perceptionStep(deriveModel(character, rules)));
const sameSet = (actual, expected, msg) => assert.deepEqual([...actual].sort(), [...expected].sort(), msg);

describe('store.creationContext(rules, character, perceptionStep)', () => {
  test('assembles the engine ctx: files, catalogs, the skill resolver, the Perception step, the race Karma modifier and the house cap', () => {
    const c = build('Troll', 'Nethermancer');
    const ctx = store.creationContext(rules, c, 7);
    assert.equal(ctx.disciplinesFile, rules.disciplinesFile);
    assert.equal(ctx.attributesFile, rules.attributesFile);
    assert.deepEqual(ctx.skillCatalog, rules.skillsFile.skills);
    assert.deepEqual(ctx.spellCatalog, rules.spellsFile.spells);
    assert.equal(ctx.perceptionStep, 7);
    assert.equal(ctx.karmaModifier, modFor('Troll'));
    assert.equal(ctx.karmaMaxCap, capFor('Troll'));
    assert.equal(typeof ctx.resolveSkill, 'function');
  });

  test('resolveSkill is the existing lookup (exact name, then the bracket-stripped base)', () => {
    const { resolveSkill } = store.creationContext(rules, build('Human', 'Archer'), 5);
    assert.equal(resolveSkill('Speak Language (Ork)').name, 'Speak Language (Ork)');
    assert.equal(resolveSkill('Knowledge (Barsaive History)').name, 'Knowledge');
    assert.equal(resolveSkill('Knowledge (Barsaive History)').category, 'knowledge');
    assert.equal(resolveSkill('Basket Weaving (Reeds)'), null);
  });

  test('perceptionStep is passed through as given (a number or null); it is never read from the character', () => {
    const c = build('Human', 'Archer');
    assert.equal(store.creationContext(rules, c, null).perceptionStep, null);
    assert.equal(store.creationContext(rules, c, 11).perceptionStep, 11);
  });

  test('karmaMaxCap is null without the homebrew cap; karmaModifier is null for a race not in the table', () => {
    const { homebrewFile, ...noHomebrew } = rules;
    assert.equal(store.creationContext(noHomebrew, build('Troll', 'Warrior'), 4).karmaMaxCap, null);
    const gnome = { ...build('Troll', 'Warrior'), meta: { id: 'g', name: 'G', race: 'Gnome' } };
    const ctx = store.creationContext(rules, gnome, 4);
    assert.equal(ctx.karmaModifier, null);
    assert.equal(ctx.karmaMaxCap, null, 'the cap is race-keyed: an unknown race has none');
  });
});

describe('deriveModel for builder output: every race x Discipline, under the real rules', () => {
  for (const race of RACES) {
    for (const discipline of DISCIPLINES) {
      test(`${race} ${discipline}: Legend 0/0/0, no Karma sink, Karma starts full, model.creation is the open budgets view`, () => {
        const c = build(race, discipline);
        const model = deriveModel(c, rules);

        // R7 + R4 round-2: Legend 0 / 0 / 0, and the starting Karma is free under hb-karma-economy
        assert.ok(model.legend, 'a real Legend standing');
        assert.equal(model.legend.totalEarnt, 0);
        assert.equal(model.legend.spent.total, 0);
        assert.equal(model.legend.available, 0);
        assert.equal(sinkOf(model), 0);

        // R4: Max Karma = min(Modifier x Circle, cap); converted was seeded to it, so current == max
        assert.equal(model.characteristics.karma.max, expectedMax(race));
        assert.equal(model.characteristics.karma.available, expectedMax(race));

        // model.creation
        const status = model.creation;
        assert.equal(status.open, true);
        assert.deepEqual(status.free, c.creation.free);
        assert.equal(status.talents.total, 8);
        assert.equal(status.attributes.total, 25);
        assert.equal(status.canFinish, true);
        assert.deepEqual(status.blockers, []);
        assert.equal(status.spells === null, !isMagician(discipline));
        for (const row of status.talents.rows) {
          const cat = rules.talentsFile.talents[row.name];
          assert.equal(row.brief, cat?.presentation?.shortEffect ?? null, `${row.name}.brief is the catalog shortEffect`);
        }
        assert.ok(model.legendAuditOptions, 'the audit options are exposed');
        assert.equal(model.legendAuditOptions.creationKarma, expectedMax(race));
      });
    }
  }

  test('a character WITHOUT a creation block has model.creation === null and keeps the legend placeholder', () => {
    const c = build('Human', 'Archer');
    delete c.creation;
    const model = deriveModel(c, rules);
    assert.equal(model.creation, null);
    assert.equal(model.legend, null, 'no earned entry and no legacy total: the placeholder');
  });

  test('the model never mutates the draft it derives from', () => {
    const c = build('Dwarf', 'Nethermancer');
    const frozen = structuredClone(c);
    deriveModel(c, rules);
    assert.deepEqual(c, frozen);
  });
});

describe('a new Nethermancer is a caster; the others are not', () => {
  test('model.spells is non-null with exactly two empty Standard matrices (the Spells tab opens)', () => {
    const model = deriveModel(build('Elf', 'Nethermancer'), rules);
    assert.ok(model.spells, 'a SpellsContext exists');
    assert.deepEqual(model.spells.known, []);
    assert.deepEqual(model.spells.matrices, [{ type: 'Standard', spell: null }, { type: 'Standard', spell: null }]);
  });

  test('Archer, Thief and Warrior have no spells slice', () => {
    for (const d of ['Archer', 'Thief', 'Warrior']) assert.equal(deriveModel(build('Elf', d), rules).spells, null, d);
  });

  test('the spell budget total IS the derived Perception Step (never stored), and follows an attribute edit', () => {
    const c = build('Human', 'Nethermancer');
    const m1 = deriveModel(c, rules);
    assert.equal(m1.creation.spells.total, perceptionStep(m1));
    const raised = applyAttributePoints(c, ctxOf(c), { name: 'Perception', points: 4 });
    assert.equal(raised.ok, true);
    const m2 = deriveModel(raised.character, rules);
    assert.equal(m2.creation.spells.total, perceptionStep(m2));
    assert.ok(perceptionStep(m2) > perceptionStep(m1), 'more Perception, more spell points');
  });
});

describe('Durability is seeded: health ratings rise by the Durability talent (R1)', () => {
  const withoutDurability = (c) => ({ ...c, disciplines: [{ ...c.disciplines[0], talents: c.disciplines[0].talents.filter((t) => t.name !== 'Durability') }] });

  for (const discipline of DISCIPLINES) {
    test(`${discipline}, standard rules (no homebrew): Unconsciousness and Death rise by the Discipline durability x Rank 1`, () => {
      const { homebrewFile, ...standard } = rules;
      const durability = rules.disciplinesFile.disciplines.find((d) => d.name === discipline).durability;
      const c = build('Human', discipline);
      const withD = deriveModel(c, standard).characteristics;
      const without = deriveModel(withoutDurability(c), standard).characteristics;
      assert.equal(withD.unconsciousness.value - without.unconsciousness.value, durability * 1);
      assert.equal(withD.death.value - without.death.value, durability * 1);
    });

    test(`${discipline}, real homebrew hb-uncon-death: both ratings rise by Durability Rank 1 x Toughness Step (the formula in rules/homebrew.json)`, () => {
      const c = build('Human', discipline);
      const m = deriveModel(c, rules);
      const without = deriveModel(withoutDurability(c), rules).characteristics;
      const touStep = m.attributes.find((a) => a.name === 'Toughness').step;
      assert.ok(touStep > 0);
      assert.equal(m.characteristics.unconsciousness.value - without.unconsciousness.value, touStep * 1);
      assert.equal(m.characteristics.death.value - without.death.value, touStep * 1);
    });
  }
});

describe('Finish for every race x Discipline (nothing spent): Karma, Legend and the closed status', () => {
  for (const race of RACES) {
    for (const discipline of DISCIPLINES) {
      test(`${race} ${discipline}: converted becomes min(Modifier + 25, cap); Legend stays 0/0/0; Karma sink stays 0; available == max`, () => {
        const c = build(race, discipline);
        const model0 = deriveModel(c, rules);
        const ctx = store.creationContext(rules, c, perceptionStep(model0));
        const res = finishCreation(c, ctx);
        assert.equal(res.ok, true, JSON.stringify({ reason: res.reason }));
        sameSet(res.touched, ['creation', 'karma']);
        const done = res.character;
        assert.equal(done.resources.karma.converted, expectedMax(race, 25), 'R3/R4: 25 unspent points become Max Karma, inside the race cap');
        const model = deriveModel(done, rules);
        assert.deepEqual(model.creation, { open: false });
        assert.equal(model.legend.totalEarnt, 0);
        assert.equal(model.legend.spent.total, 0);
        assert.equal(model.legend.available, 0);
        assert.equal(sinkOf(model), 0, 'creation Karma is still free after Finish');
        assert.equal(model.characteristics.karma.max, expectedMax(race, 25));
        assert.equal(model.characteristics.karma.available, model.characteristics.karma.max);
        assert.equal(model0.characteristics.karma.max, expectedMax(race), 'before Finish: the Circle-1 value');
      });
    }
  }

  test('a Troll with 25 unspent ends at Max Karma 20 (3 + 25 = 28 is held by the cap), converted 20', () => {
    const c = build('Troll', 'Warrior');
    const done = finishCreation(c, ctxOf(c)).character;
    assert.equal(done.resources.karma.converted, 20);
    assert.equal(deriveModel(done, rules).characteristics.karma.max, 20);
  });
});

describe('store.persistCreationEdit(character, touched, id): maps each touched category to its overlay writer', () => {
  const ID = 'adept';
  const edits = () => JSON.parse(localStorage.getItem(`ed-character-edits:${ID}`) ?? 'null');

  test('advancements -> { disciplines, skills } only', () => {
    const c = build('Human', 'Archer');
    const res = applyTalentRank(c, ctxOf(c), { discipline: 'Archer', name: 'Missile Weapon', rank: 3 });
    store.persistCreationEdit(res.character, ['advancements'], ID);
    assert.deepEqual(Object.keys(edits()), ['advancements']);
    assert.deepEqual(edits().advancements.disciplines, res.character.disciplines);
    assert.deepEqual(edits().advancements.skills, res.character.skills);
  });

  test('attributes -> the whole attributes map', () => {
    const c = build('Human', 'Archer');
    const res = applyAttributePoints(c, ctxOf(c), { name: 'Dexterity', points: 4 });
    store.persistCreationEdit(res.character, ['attributes'], ID);
    assert.deepEqual(Object.keys(edits()), ['attributes']);
    assert.deepEqual(edits().attributes, res.character.attributes);
  });

  test('spells -> the spells block; creation -> the creation block; karma -> resources.karma', () => {
    const c = build('Human', 'Nethermancer');
    const res = applySpellPick(c, ctxOf(c), { name: 'Astral Spear' });
    assert.equal(res.ok, true);
    store.persistCreationEdit(res.character, ['spells'], ID);
    assert.deepEqual(edits().spells, res.character.spells);
    store.persistCreationEdit(res.character, ['creation'], ID);
    assert.deepEqual(edits().creation, res.character.creation);
    store.persistCreationEdit(res.character, ['karma'], ID);
    assert.deepEqual(edits().karma, res.character.resources.karma);
    assert.deepEqual(Object.keys(edits()).sort(), ['creation', 'karma', 'spells']);
  });

  test('a combined touched list (a talent edit) writes exactly those categories and marks the character dirty', () => {
    const c = build('Human', 'Archer');
    const res = applyTalentRank(c, ctxOf(c), { discipline: 'Archer', name: 'Mystic Aim', rank: 2 });
    store.persistCreationEdit(res.character, res.touched, ID);
    assert.deepEqual(Object.keys(edits()).sort(), [...res.touched].sort());
    assert.equal(store.hasPendingEdits(ID), true);
  });

  test('nothing else is ever written: no meta, wealth, items, health or legend category', () => {
    const c = build('Human', 'Nethermancer');
    const ctx = ctxOf(c);
    let character = c;
    for (const op of [
      (x) => applyTalentRank(x, ctx, { discipline: 'Nethermancer', name: 'Spellcasting', rank: 2 }),
      (x) => applyAttributePoints(x, ctx, { name: 'Perception', points: 2 }),
      (x) => applySkillAdd(x, ctx, { name: 'Knowledge', text: 'Barsaive History' }),
      (x) => applySpellPick(x, ctx, { name: 'Astral Spear' }),
    ]) {
      const res = op(character);
      assert.equal(res.ok, true);
      character = res.character;
      store.persistCreationEdit(character, res.touched, ID);
    }
    for (const forbidden of ['meta', 'wealth', 'items', 'health', 'legend', 'notes', 'history', 'traits']) assert.ok(!(forbidden in edits()), forbidden);
    assert.deepEqual(character.wealth, c.wealth, 'the creation steppers never touch wealth');
    assert.deepEqual(character.items, c.items);
  });

  test('a reload (applyEdits over the base) reproduces the edited character exactly', () => {
    const base = build('Ork', 'Nethermancer');
    let character = base;
    for (const fn of [
      (x, ctx) => applyTalentRank(x, ctx, { discipline: 'Nethermancer', name: 'Frighten', rank: 3 }),
      (x, ctx) => applyAttributePoints(x, ctx, { name: 'Strength', points: 3 }),
      (x, ctx) => applySkillAdd(x, ctx, { name: 'Speak Language (Ork)' }),
      (x, ctx) => applySpellPick(x, ctx, { name: 'Shadow Meld' }),
    ]) {
      const res = fn(character, ctxOf(character));
      assert.equal(res.ok, true);
      character = res.character;
      store.persistCreationEdit(character, res.touched, ID);
    }
    assert.deepEqual(store.applyEdits(base, store.loadEdits(ID)), character);
  });
});

describe('WALKTHROUGH: create -> spend every budget -> save overlay -> reload -> Finish -> Legend now costs Legend', () => {
  test('a Troll Nethermancer (cap 20) from a blank draft to a finished, playable character', () => {
    const ID = 'walker';
    const base = build('Troll', 'Nethermancer', 'Walker');
    assert.equal(base.meta.id, ID);
    let character = structuredClone(base);
    const apply = (fn) => {
      const res = fn(character, ctxOf(character));
      assert.equal(res.ok, true, JSON.stringify({ reason: res.reason }));
      character = res.character;
      store.persistCreationEdit(character, res.touched, ID);
    };
    const reload = () => {
      character = store.applyEdits(base, store.loadEdits(ID));
    };

    // -- spend every budget ------------------------------------------------------------------
    // R1: 8 talent points, max Rank 3 (Nethermancer Discipline Talents)
    apply((c, x) => applyTalentRank(c, x, { discipline: 'Nethermancer', name: 'Spellcasting', rank: 3 }));
    apply((c, x) => applyTalentRank(c, x, { discipline: 'Nethermancer', name: 'Frighten', rank: 3 }));
    apply((c, x) => applyTalentRank(c, x, { discipline: 'Nethermancer', name: 'Astral Sight', rank: 2 }));
    // R3: 20 of the 25 attribute points (Dex +5 = 7, Str +4 = 5, Tou +4 = 5, Per +2 = 2, Wil +1 = 1); 5 stay unspent
    for (const [name, points] of [['Dexterity', 5], ['Strength', 4], ['Toughness', 4], ['Perception', 2], ['Willpower', 1]]) {
      apply((c, x) => applyAttributePoints(c, x, { name, points }));
    }
    // R5: fixed ranks (Knowledge 2, Speak 2, Read/Write 1, Artisan from the Discipline list 1) + the 8 extra
    apply((c, x) => applySkillAdd(c, x, { name: 'Knowledge', text: 'Barsaive History' }));
    apply((c, x) => applySkillAdd(c, x, { name: 'Knowledge', text: 'Troll Lore' }));
    apply((c, x) => applySkillAdd(c, x, { name: 'Speak Language (Troll)' }));
    apply((c, x) => applySkillAdd(c, x, { name: 'Speak Language (Throalic)' }));
    apply((c, x) => applySkillAdd(c, x, { name: 'Read/Write Language (Throalic)' }));
    apply((c, x) => applySkillAdd(c, x, { name: 'Bone Carving (Artisan)' }));
    const general = [...new Set(rules.skillsFile.skills.filter((s) => s.category === 'general' && s.tier === 1).map((s) => s.name))].slice(0, 8);
    for (const name of general) apply((c, x) => applySkillAdd(c, x, { name }));
    // R6: spend every spell point on Circle-1 spells (a free pick: no roll, no silver, no prerequisite)
    for (let guard = 0; guard < 20; guard++) {
      const b = spellBudget(character, ctxOf(character));
      const next = b.candidates.find((s) => s.canPick && s.cost === 1);
      if (!next || b.left === 0) break;
      apply((c, x) => applySpellPick(c, x, { name: next.name }));
    }

    // -- the model before Finish --------------------------------------------------------------
    let model = deriveModel(character, rules);
    assert.equal(model.creation.open, true);
    assert.equal(model.creation.canFinish, true, JSON.stringify(model.creation.blockers));
    assert.equal(model.creation.talents.left, 0);
    assert.equal(model.creation.attributes.left, 5);
    assert.equal(model.creation.skills.extra.left, 0);
    assert.equal(model.creation.spells.left, 0);
    assert.equal(model.creation.spells.total, perceptionStep(model));
    assert.equal(character.spells.known.length, perceptionStep(model), 'one point per Circle-1 spell');
    assert.deepEqual([model.legend.totalEarnt, model.legend.spent.total, model.legend.available], [0, 0, 0]);
    assert.equal(sinkOf(model), 0);
    assert.equal(model.characteristics.karma.max, 3, 'before Finish: Troll Karma Modifier x Circle 1');
    assert.equal(model.characteristics.karma.available, 3);

    // -- the overlay survives a reload (nothing but localStorage) ---------------------------------
    const beforeReload = structuredClone(character);
    reload();
    assert.deepEqual(character, beforeReload);
    assert.equal(store.hasPendingEdits(ID), true);

    // -- Finish ------------------------------------------------------------------------------
    const ctx = ctxOf(character);
    const plan = finishPlan(character, ctx);
    assert.equal(plan.canFinish, true);
    assert.deepEqual(plan.forfeits, { talents: 0, skills: 0, spells: 0 });
    assert.equal(plan.karmaBonus, 5);
    assert.equal(plan.oldMaxKarma, 3);
    assert.equal(plan.newMaxKarma, 8, 'min(3 + 5, 20)');
    const res = finishCreation(character, ctx);
    assert.equal(res.ok, true);
    sameSet(res.touched, ['creation', 'karma']);
    character = res.character;
    store.persistCreationEdit(character, res.touched, ID);
    reload();
    assert.equal(character.creation.open, false);
    assert.equal(character.resources.karma.converted, 8);
    // attribute points are locked from now on
    const locked = applyAttributePoints(character, ctxOf(character), { name: 'Dexterity', points: 6 });
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, 'creation-closed');
    assert.equal(locked.character, character);

    // -- after Finish --------------------------------------------------------------------------
    model = deriveModel(character, rules);
    assert.deepEqual(model.creation, { open: false });
    assert.deepEqual([model.legend.totalEarnt, model.legend.spent.total, model.legend.available], [0, 0, 0], 'Legend is still 0/0/0: every creation rank is in the free ledger');
    assert.equal(sinkOf(model), 0);
    assert.equal(model.characteristics.karma.max, 8);
    assert.equal(model.characteristics.karma.available, 8);

    // Legend pricing applies from here on: only ranks ABOVE the free ones cost, at the normal step price
    const row = (name) => model.disciplines[0].talents.find((t) => t.name === name);
    assert.equal(row('Spellcasting').pricing.increaseCost, costs.talentRank['4'].Novice, 'Rank 3 -> 4 is a normal Legend step');
    assert.equal(row('Spellcasting').pricing.affordable, false, 'Available Legend is 0');
    assert.equal(row('Spellcasting').pricing.refund, 0, 'a free rank refunds nothing');
    assert.equal(row('Astral Sight').pricing.increaseCost, costs.talentRank['3'].Novice, 'Rank 2 -> 3 (2 free ranks)');
    assert.equal(row('Astral Sight').pricing.affordable, false);

    // ...and with Legend earned the raise is affordable and costs exactly the step (not the cumulative Rank-3 price)
    const rich = structuredClone(character);
    rich.resources.legend = { earned: [{ id: 'e1', amount: 1000, description: 'First adventure', date: '2026-01-01' }] };
    const richModel = deriveModel(rich, rules);
    assert.equal(richModel.legend.available, 1000);
    const aight = richModel.disciplines[0].talents.find((t) => t.name === 'Astral Sight');
    assert.equal(aight.pricing.affordable, true);
    const raised = structuredClone(rich);
    raised.disciplines[0].talents.find((t) => t.name === 'Astral Sight').rank = 3;
    const raisedModel = deriveModel(raised, rules);
    assert.equal(raisedModel.legend.spent.total, costs.talentRank['3'].Novice, 'exactly one paid step');
    assert.equal(richModel.legend.available - raisedModel.legend.available, aight.pricing.increaseCost);

    // Karma bought with Legend after Finish is charged beyond the creation Karma only
    const ritual = structuredClone(rich);
    ritual.resources.karma = { ...ritual.resources.karma, converted: 9 };
    assert.equal(sinkOf(deriveModel(ritual, rules)), (9 - 8) * ritualFor('Troll'));
  });

  test('a draft saved mid-creation resumes: the open block, the spend and the budgets survive the overlay round trip', () => {
    const ID = 'resume';
    const base = build('Dwarf', 'Warrior', 'Resume');
    let character = base;
    for (const fn of [
      (c, x) => applyTalentRank(c, x, { discipline: 'Warrior', name: 'Melee Weapon', rank: 3 }),
      (c, x) => applyAttributePoints(c, x, { name: 'Strength', points: 4 }),
      (c, x) => applySkillAdd(c, x, { name: 'Climbing' }),
    ]) {
      const res = fn(character, ctxOf(character));
      assert.equal(res.ok, true);
      character = res.character;
      store.persistCreationEdit(character, res.touched, ID);
    }
    const reloaded = store.applyEdits(base, store.loadEdits(ID));
    const m = deriveModel(reloaded, rules);
    assert.equal(m.creation.open, true);
    assert.equal(m.creation.talents.spent, 3);
    assert.equal(m.creation.attributes.spent, 5);
    assert.deepEqual(m.creation.skills.extra, { total: 8, spent: 1, left: 7 });
    assert.equal(m.legend.available, 0);
    assert.equal(skillBudget(reloaded, ctxOf(reloaded)).extra.spent, 1);
  });
});

describe('creation never perturbs the audit: free ledger totals match an independent audit', () => {
  test('after a mix of edits the model Legend spent equals auditLegendSpent with the exposed options (and is 0)', () => {
    let c = build('Windling', 'Thief');
    for (const fn of [
      (x, ctx) => applyTalentRank(x, ctx, { discipline: 'Thief', name: 'Lock Picking', rank: 3 }),
      (x, ctx) => applyTalentRank(x, ctx, { discipline: 'Thief', name: 'Awareness', rank: 2 }),
      (x, ctx) => applySkillAdd(x, ctx, { name: 'Acting' }),
      (x, ctx) => applySkillRank(x, ctx, { name: 'Acting', rank: 3 }),
    ]) {
      const res = fn(c, ctxOf(c));
      assert.equal(res.ok, true);
      c = res.character;
    }
    const model = deriveModel(c, rules);
    assert.equal(model.legend.spent.total, 0);
    assert.equal(auditLegendSpent(c, costs, model.legendAuditOptions).total, 0);
  });
});
