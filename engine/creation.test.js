// engine/creation.test.js — run with `npm test` (node --test, no deps).
//
// create-new-adept slices A2 + A5: the pure allotment engine `engine/creation.js` (spec A2 helpers and A5
// "allotment engine"). Imports of a not-yet-existing module are expected to fail until the dev builds it.
//
// Every expected rules value comes from plans/create-new-adept/rules.md (R1 talents, R3 attributes,
// R4 Karma, R5 skills, R6 spells, R10 Finish) or the spec "Rules" table, or is READ from the real
// rules/*.json files. Where a number is the rule itself (8 talent points, max Rank 3, 25 attribute
// points, the R3 cost table, 8 + fixed skill ranks, Circle 1-2 spells) it is cited next to the assert.
// The engine never parses names: the test hands it the same `ctx` shape the store builds
// (`resolveSkill` = the existing exact-name-then-bracket-stripped lookup).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as creation from './creation.js';
import { auditLegendSpent } from './legend-spent.js';

// Namespace import on purpose: slice A2 creates engine/creation.js with ONLY the helpers (CREATION_RULES,
// freeKey, attributePointCost, attributeLeftover, karmaBonus, creationKarma); the allotment functions arrive
// in slice A5. A namespace import keeps the file loadable at A2, so the helper tests run green at A2 while
// each A5 test fails on its own ("... is not a function") until A5 builds it.
const {
  CREATION_RULES,
  freeKey,
  attributePointCost,
  attributeLeftover,
  karmaBonus,
  creationKarma,
  talentBudget,
  attributeBudget,
  skillBudget,
  spellBudget,
  creationStatus,
  applyTalentRank,
  applyAttributePoints,
  applySkillAdd,
  applySkillRank,
  applySkillRemove,
  applySpellPick,
  applySpellRemove,
  checkSpellMatrices,
  finishPlan,
  finishCreation,
} = creation;

const read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const disciplinesFile = read('disciplines.json');
const attributesFile = read('attributes.json');
const skillsFile = read('skills.json');
const spellsFile = read('spells.json');
const racesFile = read('races.json');
const costs = read('legend.json').costs;
const skillCatalog = skillsFile.skills;
const spellCatalog = spellsFile.spells;

// The store's lookup, reproduced: exact catalog name, then the bracket-stripped base ("Knowledge (X)" -> Knowledge).
const byName = Object.fromEntries(skillCatalog.map((s) => [s.name, s]));
const resolveSkill = (name) => byName[name] ?? byName[String(name).replace(/\s*\([^)]*\)\s*$/, '').trim()] ?? null;

const ctxFor = (over = {}) => ({
  disciplinesFile,
  attributesFile,
  skillCatalog,
  resolveSkill,
  spellCatalog,
  perceptionStep: 5,
  karmaModifier: 5,
  karmaMaxCap: 40,
  ...over,
});
const ctx = ctxFor();
const circle1 = (disc) => disciplinesFile.disciplines.find((d) => d.name === disc).circles.find((c) => c.circle === 1);
const DT = (disc) => circle1(disc).talents; // the five First-Circle Discipline Talents (R1)

const T = (name, rank, circle = 1) => ({ name, rank, circle });
function fresh(discipline = 'Archer', { race = 'Human', open = true } = {}) {
  const raceEntry = racesFile.races.find((r) => r.name === race);
  const magician = circle1(discipline).talents.includes('Spellcasting');
  return {
    schema: 'ed-character/2',
    meta: { id: 'adept', name: 'Adept', race },
    attributes: Object.fromEntries(attributesFile.order.map((n) => [n, { base: raceEntry.startingAttributes[n], points: 0, increases: 0 }])),
    disciplines: [{ name: discipline, circle: 1, talents: [T('Durability', 1), T('Karma Ritual', 1)] }],
    skills: [],
    knacks: [],
    traits: [],
    resources: { karma: { converted: raceEntry.karmaModifier, spent: 0 }, legend: { earned: [] }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
    items: [],
    wealth: { coins: { silver: 100 }, gems: [] },
    ...(magician ? { spells: { known: [], matrices: [{ type: 'Standard', spell: null }, { type: 'Standard', spell: null }] } } : {}),
    creation: { open, free: { talents: { [`${discipline}/Durability`]: 1, [`${discipline}/Karma Ritual`]: 1 }, skills: {}, spells: [] } },
  };
}

const sameSet = (actual, expected, msg) => assert.deepEqual([...actual].sort(), [...expected].sort(), msg);
const REASONS = ['creation-closed', 'no-change', 'bad-rank', 'over-budget', 'unknown-discipline', 'not-a-creation-talent', 'unknown-attribute', 'out-of-range', 'unknown-skill', 'duplicate', 'not-allowed-category', 'tier-not-novice', 'bad-text', 'generic-not-allowed', 'rank-cap', 'not-found', 'not-a-magician', 'unknown-spell', 'not-available', 'matrix-circle', 'invalid-budget', 'already-finished', 'option-slot-full'];

// A successful apply returns { ok: true, character, touched }; keep the new character.
function good(res, touched) {
  assert.equal(res.ok, true, `expected ok, got ${JSON.stringify({ ok: res.ok, reason: res.reason })}`);
  assert.ok(res.character && typeof res.character === 'object');
  if (touched) sameSet(res.touched, touched, 'touched');
  return res.character;
}
// A refusal returns { ok: false, reason, character } where character is the SAME reference.
function refused(res, character, reason) {
  assert.equal(res.ok, false, 'expected a refusal');
  assert.equal(res.character, character, 'a refusal returns the same character reference');
  if (reason) assert.equal(res.reason, reason);
  assert.ok(REASONS.includes(res.reason), `reason "${res.reason}" is one of the documented codes`);
  return res;
}
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
const rowOf = (c, name) => c.disciplines[0].talents.find((t) => t.name === name);
const talent = (c, discipline, name, rank) => applyTalentRank(c, ctx, { discipline, name, rank });
const attr = (c, name, points) => applyAttributePoints(c, ctx, { name, points });
const addSkill = (c, name, text) => applySkillAdd(c, ctx, text === undefined ? { name } : { name, text });
// Real general Novice skills (category general, tier 1) for filling the extra pool.
const GENERAL_NOVICE = [...new Set(skillCatalog.filter((s) => s.category === 'general' && s.tier === 1).map((s) => s.name))];

describe('constants and small helpers', () => {
  test('CREATION_RULES is exactly the spec literal (R1, R3, R5, R6)', () => {
    assert.deepEqual(CREATION_RULES, {
      talentPoints: 8,
      talentMaxRank: 3,
      attributePoints: 25,
      skillExtraRanks: 8,
      skillMaxRank: 3,
      languageMaxRank: 1,
      skillFixed: { knowledge: 2, artisan: 1, 'language-speak': 2, 'language-readwrite': 1 },
      spellCircles: [1, 2],
    });
  });

  test('freeKey is `${discipline}/${talent}`', () => {
    assert.equal(freeKey('Archer', 'Durability'), 'Archer/Durability');
    assert.equal(freeKey('Nethermancer', 'Thread Weaving (Nethermancer)'), 'Nethermancer/Thread Weaving (Nethermancer)');
  });

  test('attributePointCost is the exact R3 cumulative table, null outside it', () => {
    // R3: +1=1, +2=2, +3=3, +4=5, +5=7, +6=9, +7=12, +8=15; lowering -1/-2 gives back 1/2.
    const R3 = { '-2': -2, '-1': -1, 0: 0, 1: 1, 2: 2, 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 15 };
    for (const [points, cost] of Object.entries(R3)) assert.equal(attributePointCost(Number(points), attributesFile), cost, `points ${points}`);
    for (const out of [9, -3, 100, 1.5]) assert.equal(attributePointCost(out, attributesFile), null, `points ${out}`);
  });

  test('attributeLeftover = 25 - sum(cost), null if any attribute is unpriceable', () => {
    const c = fresh();
    assert.equal(attributeLeftover(c, attributesFile), 25);
    c.attributes.Dexterity.points = 4; // 5
    c.attributes.Strength.points = 2; // 2
    c.attributes.Willpower.points = -2; // -2
    assert.equal(attributeLeftover(c, attributesFile), 25 - (5 + 2 - 2));
    c.attributes.Charisma.points = 9; // off the table
    assert.equal(attributeLeftover(c, attributesFile), null);
  });

  test('karmaBonus: max(0, 25 - spent) only when creation.open === false; 0 otherwise or when unpriceable', () => {
    const open = fresh();
    assert.equal(karmaBonus(open, attributesFile), 0, 'open: no bonus yet');
    const closed = fresh('Archer', { open: false });
    assert.equal(karmaBonus(closed, attributesFile), 25);
    closed.attributes.Dexterity.points = 8; // 15
    closed.attributes.Strength.points = 6; // 9
    assert.equal(karmaBonus(closed, attributesFile), 1);
    closed.attributes.Toughness.points = 1;
    assert.equal(karmaBonus(closed, attributesFile), 0);
    closed.attributes.Perception.points = 3; // overspent: never negative
    assert.equal(karmaBonus(closed, attributesFile), 0);
    const bare = fresh('Archer', { open: false });
    delete bare.creation;
    assert.equal(karmaBonus(bare, attributesFile), 0, 'no creation block');
    assert.equal(karmaBonus(fresh('Archer', { open: false }), undefined), 0, 'table missing');
    assert.equal(karmaBonus(fresh('Archer', { open: false }), null), 0, 'table missing');
    const bad = fresh('Archer', { open: false });
    bad.attributes.Charisma.points = 9;
    assert.equal(karmaBonus(bad, attributesFile), 0, 'unpriceable');
  });

  test('creationKarma = maxKarma(modifier, 1, cap, karmaBonus): the Troll cap holds the bonus (3 + 25 -> 20)', () => {
    const closed = fresh('Archer', { open: false });
    const kc = (over) => creationKarma(closed, { karmaModifier: 3, karmaMaxCap: 20, attributesFile, ...over });
    assert.equal(kc({}), 20);
    assert.equal(kc({ karmaModifier: 5, karmaMaxCap: 40 }), 30);
    assert.equal(kc({ karmaMaxCap: null }), 28, 'no house cap');
    assert.equal(kc({ karmaModifier: null }), null, 'no modifier -> null');
    assert.equal(creationKarma(fresh(), { karmaModifier: 3, karmaMaxCap: 20, attributesFile }), 3, 'open: bonus 0');
  });
});

describe('talentBudget and applyTalentRank (R1: 8 points, max Rank 3, the five Circle-1 Discipline Talents only)', () => {
  test('a fresh character: total 8, spent 0, left 8, valid; rows are the five circle-1 talents at Rank 0', () => {
    const b = talentBudget(fresh('Archer'), ctx);
    assert.equal(b.total, 8);
    assert.equal(b.spent, 0);
    assert.equal(b.left, 8);
    assert.equal(b.valid, true);
    sameSet(b.rows.map((r) => r.name), DT('Archer'));
    for (const r of b.rows) {
      assert.equal(r.discipline, 'Archer');
      assert.equal(r.rank, 0);
      assert.equal(r.max, 3);
      assert.equal(r.canRaise, true);
      assert.equal(r.canLower, false);
    }
  });

  test('rows never include free talents, Talent Options, Durability or Karma Ritual', () => {
    const names = talentBudget(fresh('Archer'), ctx).rows.map((r) => r.name);
    for (const n of ['Durability', 'Karma Ritual', 'Call Missile']) assert.ok(!names.includes(n), n);
    const neth = talentBudget(fresh('Nethermancer'), ctx).rows.map((r) => r.name);
    assert.ok(!neth.includes('Standard Matrix'));
    sameSet(neth, DT('Nethermancer'));
  });

  test('spent counts stored ranks of those five names only (the seeded Durability and Karma Ritual are outside the 8)', () => {
    const c = fresh();
    c.disciplines[0].talents.push(T('Missile Weapon', 3), T('Mystic Aim', 2));
    const b = talentBudget(c, ctx);
    assert.equal(b.spent, 5);
    assert.equal(b.left, 3);
    assert.equal(b.valid, true);
    assert.equal(b.rows.find((r) => r.name === 'Missile Weapon').rank, 3);
    assert.equal(b.rows.find((r) => r.name === 'Missile Weapon').canRaise, false, 'max Rank 3');
    assert.equal(b.rows.find((r) => r.name === 'Missile Weapon').canLower, true);
    assert.equal(b.rows.find((r) => r.name === 'True Shot').canRaise, true);
  });

  test('canRaise is false for every row once all 8 points are spent; valid is still true at exactly 8', () => {
    let c = fresh();
    c = good(talent(c, 'Archer', 'Missile Weapon', 3), ['advancements', 'creation']);
    c = good(talent(c, 'Archer', 'Mystic Aim', 3));
    c = good(talent(c, 'Archer', 'True Shot', 2));
    const b = talentBudget(c, ctx);
    assert.equal(b.spent, 8);
    assert.equal(b.left, 0);
    assert.equal(b.valid, true);
    for (const r of b.rows) assert.equal(r.canRaise, false, r.name);
    assert.equal(b.rows.find((r) => r.name === 'True Shot').canLower, true);
  });

  test('over-spent stored ranks (e.g. 10) read as valid: false - shown, never auto-corrected', () => {
    const c = fresh();
    c.disciplines[0].talents.push(T('Missile Weapon', 3), T('Mystic Aim', 3), T('True Shot', 3), T('Avoid Blow', 1));
    const b = talentBudget(c, ctx);
    assert.equal(b.spent, 10);
    assert.equal(b.valid, false);
    assert.equal(rowOf(c, 'Missile Weapon').rank, 3, 'nothing was changed');
  });

  test('a stored rank above 3 is invalid even when the sum fits', () => {
    const c = fresh();
    c.disciplines[0].talents.push(T('Missile Weapon', 4));
    assert.equal(talentBudget(c, ctx).valid, false);
  });

  test('raising from Rank 0 appends { name, rank, circle: 1 } and writes the ledger key; touched is advancements + creation', () => {
    const c = fresh();
    const next = good(talent(c, 'Archer', 'Missile Weapon', 2), ['advancements', 'creation']);
    assert.deepEqual(rowOf(next, 'Missile Weapon'), { name: 'Missile Weapon', rank: 2, circle: 1 });
    assert.equal(next.creation.free.talents['Archer/Missile Weapon'], 2);
    assert.equal(next.creation.free.talents['Archer/Durability'], 1, 'seeded keys are kept');
    assert.equal(next.creation.open, true);
    assert.equal(rowOf(next, 'Durability').rank, 1);
    assert.equal(next.disciplines[0].talents.length, 3);
  });

  test('raising/lowering an existing row edits it in place (no duplicate) and keeps the ledger equal to the rank', () => {
    let c = fresh();
    c = good(talent(c, 'Archer', 'Missile Weapon', 1));
    c = good(talent(c, 'Archer', 'Missile Weapon', 3));
    assert.equal(c.disciplines[0].talents.filter((t) => t.name === 'Missile Weapon').length, 1);
    assert.equal(rowOf(c, 'Missile Weapon').rank, 3);
    assert.equal(c.creation.free.talents['Archer/Missile Weapon'], 3);
    c = good(talent(c, 'Archer', 'Missile Weapon', 2));
    assert.equal(c.creation.free.talents['Archer/Missile Weapon'], 2);
  });

  test('lowering to 0 removes the row AND deletes the ledger key (a zero is never stored)', () => {
    let c = fresh();
    c = good(talent(c, 'Archer', 'Missile Weapon', 2));
    c = good(talent(c, 'Archer', 'Missile Weapon', 0), ['advancements', 'creation']);
    assert.equal(rowOf(c, 'Missile Weapon'), undefined);
    assert.ok(!('Archer/Missile Weapon' in c.creation.free.talents));
    assert.deepEqual(c.creation.free.talents, { 'Archer/Durability': 1, 'Archer/Karma Ritual': 1 });
  });

  test('0 -> 3 in one call is allowed when it fits', () => {
    const next = good(talent(fresh(), 'Archer', 'Mystic Aim', 3));
    assert.equal(rowOf(next, 'Mystic Aim').rank, 3);
  });

  test('the input character is never mutated (frozen input) and the result is a new object', () => {
    const c = deepFreeze(fresh());
    const next = good(talent(c, 'Archer', 'Missile Weapon', 2));
    assert.notEqual(next, c);
    assert.equal(rowOf(c, 'Missile Weapon'), undefined);
    assert.equal(c.creation.free.talents['Archer/Missile Weapon'], undefined);
  });

  test('refusal: no creation block, or creation closed -> creation-closed (first, whatever else is wrong)', () => {
    const closed = fresh('Archer', { open: false });
    refused(talent(closed, 'Archer', 'Missile Weapon', 1), closed, 'creation-closed');
    refused(talent(closed, 'Archer', 'Missile Weapon', 99), closed, 'creation-closed');
    const bare = fresh();
    delete bare.creation;
    refused(talent(bare, 'Archer', 'Missile Weapon', 1), bare, 'creation-closed');
  });

  test('refusal: bad-rank for a rank outside 0..3 or not a whole number', () => {
    const c = fresh();
    for (const rank of [-1, 4, 1.5, NaN]) refused(talent(c, 'Archer', 'Missile Weapon', rank), c, 'bad-rank');
  });

  test('refusal: no-change when the rank already is the requested one (incl. an unrecorded Rank 0)', () => {
    const c = good(talent(fresh(), 'Archer', 'Missile Weapon', 2));
    refused(talent(c, 'Archer', 'Missile Weapon', 2), c, 'no-change');
    refused(talent(c, 'Archer', 'Mystic Aim', 0), c, 'no-change');
  });

  test('refusal: over-budget when the change needs more points than are left', () => {
    let c = fresh();
    c = good(talent(c, 'Archer', 'Missile Weapon', 3));
    c = good(talent(c, 'Archer', 'Mystic Aim', 3)); // 6 spent, 2 left
    refused(talent(c, 'Archer', 'True Shot', 3), c, 'over-budget'); // needs 3
    c = good(talent(c, 'Archer', 'True Shot', 2)); // 8 spent
    refused(talent(c, 'Archer', 'Avoid Blow', 1), c, 'over-budget');
    refused(talent(c, 'Archer', 'True Shot', 3), c, 'over-budget');
    const lowered = good(talent(c, 'Archer', 'Mystic Aim', 2));
    good(talent(lowered, 'Archer', 'Avoid Blow', 1)); // a refund frees a point
  });

  test('refusal: not-a-creation-talent for Durability, Karma Ritual, a free talent, a non-pool talent and a Discipline-less name', () => {
    const c = fresh('Archer');
    for (const name of ['Durability', 'Karma Ritual', 'Call Missile', 'Lock Picking', 'Basket Weaving']) {
      refused(talent(c, 'Archer', name, 1), c, 'not-a-creation-talent');
    }
    const neth = fresh('Nethermancer');
    refused(talent(neth, 'Nethermancer', 'Standard Matrix', 1), neth, 'not-a-creation-talent');
  });

  // Owner ruling 2026-11-22: one Novice-pool Talent Option may be bought with the 8 talent points.
  const novicePool = (d) => disciplinesFile.disciplines.find((x) => x.name === d).talentOptions.novice;

  test('the one Circle-1 Talent Option: offered while open, a stepper row once chosen, counted in the 8, slot-limited', () => {
    let c = fresh('Warrior');
    const pool = novicePool('Warrior');
    const before = talentBudget(c, ctx);
    assert.equal(before.option.open, true);
    assert.deepEqual([...before.option.candidates].sort(), [...pool].sort());
    c = good(talent(c, 'Warrior', pool[0], 1));
    const after = talentBudget(c, ctx);
    assert.equal(after.spent, 1);
    assert.equal(after.option.open, false);
    assert.equal(after.option.held, pool[0]);
    assert.ok(after.rows.some((r) => r.option && r.name === pool[0] && r.rank === 1 && r.canRaise && r.canLower));
    assert.equal(c.creation.free.talents[`Warrior/${pool[0]}`], 1);
    refused(talent(c, 'Warrior', pool[1], 1), c, 'option-slot-full');
    c = good(talent(c, 'Warrior', pool[0], 3));
    assert.equal(talentBudget(c, ctx).spent, 3);
    c = good(talent(c, 'Warrior', pool[0], 0)); // lowering to 0 returns the slot
    assert.equal(talentBudget(c, ctx).option.open, true);
    assert.equal(c.creation.free.talents[`Warrior/${pool[0]}`], undefined);
  });

  test('the Talent Option shares the 8 points with the five Discipline Talents', () => {
    let c = fresh('Warrior');
    const opt = novicePool('Warrior')[0];
    for (const n of DT('Warrior').slice(0, 2)) c = good(talent(c, 'Warrior', n, 3)); // 6 spent
    c = good(talent(c, 'Warrior', opt, 2)); // 8 spent
    refused(talent(c, 'Warrior', opt, 3), c, 'over-budget');
    assert.equal(talentBudget(c, ctx).left, 0);
  });

  test('refusal: unknown-discipline for a Discipline that does not exist', () => {
    const c = fresh();
    refused(talent(c, 'Wizard', 'Missile Weapon', 1), c, 'unknown-discipline');
  });

  test('a Discipline that exists but is not the character first Discipline is refused (not silently applied)', () => {
    const c = fresh('Archer');
    const res = talent(c, 'Warrior', 'Melee Weapon', 1);
    assert.equal(res.ok, false);
    assert.equal(res.character, c);
  });

  test('the five talents differ per Discipline (Nethermancer: Spellcasting is steppable here)', () => {
    const c = good(talent(fresh('Nethermancer'), 'Nethermancer', 'Spellcasting', 2));
    assert.equal(rowOf(c, 'Spellcasting').rank, 2);
    assert.equal(c.creation.free.talents['Nethermancer/Spellcasting'], 2);
  });
});

describe('attributeBudget and applyAttributePoints (R3: 25 points over racial base, cost table, -2..+8)', () => {
  test('fresh: total 25, spent 0, left 25, valid, min -2, max 8, leftover 25; one row per attribute in order', () => {
    const b = attributeBudget(fresh(), ctx);
    assert.equal(b.total, 25);
    assert.equal(b.spent, 0);
    assert.equal(b.left, 25);
    assert.equal(b.valid, true);
    assert.equal(b.min, -2);
    assert.equal(b.max, 8);
    assert.equal(b.leftover, 25);
    assert.deepEqual(b.rows.map((r) => r.name), attributesFile.order);
    for (const r of b.rows) {
      assert.deepEqual([r.points, r.cost, r.raiseCost, r.lowerRefund, r.canRaise, r.canLower], [0, 0, 1, 1, true, true], r.name);
    }
  });

  test('row costs and next/previous step prices follow the R3 table', () => {
    const c = fresh();
    c.attributes.Dexterity.points = 4; // cost 5
    c.attributes.Strength.points = 7; // cost 12
    const rows = Object.fromEntries(attributeBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.equal(rows.Dexterity.cost, 5);
    assert.equal(rows.Dexterity.raiseCost, 2); // +5 (7) - +4 (5)
    assert.equal(rows.Dexterity.lowerRefund, 2); // +4 (5) - +3 (3)
    assert.equal(rows.Strength.cost, 12);
    assert.equal(rows.Strength.raiseCost, 3); // +8 (15) - +7 (12)
    assert.equal(rows.Strength.lowerRefund, 3); // +7 (12) - +6 (9)
    const b = attributeBudget(c, ctx);
    assert.equal(b.spent, 17);
    assert.equal(b.left, 8);
    assert.equal(b.leftover, 8);
  });

  test('canRaise needs a point below +8 and raiseCost <= left; canLower is blocked only by -2', () => {
    const c = fresh();
    c.attributes.Dexterity.points = 8; // 15
    c.attributes.Strength.points = 6; // 9
    c.attributes.Willpower.points = -2; // -2 -> spent 22, left 3
    const rows = Object.fromEntries(attributeBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.equal(rows.Dexterity.canRaise, false, 'at +8');
    assert.equal(rows.Dexterity.canLower, true);
    assert.equal(rows.Willpower.canLower, false, 'at -2');
    assert.equal(rows.Willpower.canRaise, true);
    assert.equal(attributeBudget(c, ctx).left, 3);
    assert.equal(rows.Toughness.canRaise, true); // costs 1 <= 3
    assert.equal(rows.Strength.canRaise, true); // +7 costs 3 <= 3
    c.attributes.Charisma.points = 1; // spent 23, left 2
    const again = Object.fromEntries(attributeBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.equal(again.Strength.canRaise, false, '+7 costs 3 > 2 left');
    assert.equal(again.Toughness.canRaise, true);
  });

  test('over-spent points read valid: false and leftover 0 (never negative); left is negative', () => {
    const c = fresh();
    c.attributes.Dexterity.points = 8; // 15
    c.attributes.Strength.points = 6; // 9
    c.attributes.Toughness.points = 4; // 5 -> 29
    const b = attributeBudget(c, ctx);
    assert.equal(b.spent, 29);
    assert.equal(b.valid, false);
    assert.equal(b.leftover, 0);
    assert.ok(b.left < 0);
  });

  test('lowering below the racial value refunds: -2 on one attribute leaves 27 unspent', () => {
    const c = fresh();
    c.attributes.Willpower.points = -2;
    const b = attributeBudget(c, ctx);
    assert.equal(b.spent, -2);
    assert.equal(b.left, 27);
    assert.equal(b.leftover, 27);
    assert.equal(b.valid, true);
  });

  test('applyAttributePoints sets points only; base, increases, other attributes, creation and resources are untouched', () => {
    const c = deepFreeze(fresh());
    const next = good(attr(c, 'Dexterity', 3), ['attributes']);
    assert.deepEqual(next.attributes.Dexterity, { base: c.attributes.Dexterity.base, points: 3, increases: 0 });
    assert.deepEqual(next.attributes.Strength, c.attributes.Strength);
    assert.deepEqual(next.creation, c.creation, 'attribute spending is not in the ledger');
    assert.deepEqual(next.resources, c.resources);
    assert.notEqual(next, c);
  });

  test('refunds: lowering frees points that can be spent again', () => {
    let c = fresh();
    c = good(attr(c, 'Dexterity', 8)); // 15
    c = good(attr(c, 'Strength', 6)); // 9 -> 24 spent, left 1
    refused(attr(c, 'Toughness', 2), c, 'over-budget'); // costs 2
    c = good(attr(c, 'Dexterity', 7)); // 12 -> 21 spent, left 4
    assert.equal(attributeBudget(c, ctx).left, 4);
    c = good(attr(c, 'Toughness', 3)); // costs 3 -> left 1
    assert.equal(attributeBudget(c, ctx).left, 1);
    refused(attr(c, 'Toughness', 4), c, 'over-budget'); // +3 -> +4 costs 2 > 1
  });

  test('over-budget is judged on the whole change in cost, not per step', () => {
    let c = fresh();
    c = good(attr(c, 'Dexterity', 5)); // 7
    c = good(attr(c, 'Strength', 4)); // 5
    c = good(attr(c, 'Toughness', 4)); // 5
    c = good(attr(c, 'Perception', 2)); // 2
    c = good(attr(c, 'Willpower', 1)); // 1 -> 20 spent, 5 left
    refused(attr(c, 'Charisma', 5), c, 'over-budget'); // 7 > 5
    c = good(attr(c, 'Charisma', 4)); // 5 -> exactly 25
    assert.equal(attributeBudget(c, ctx).left, 0);
    assert.equal(attributeBudget(c, ctx).valid, true);
    refused(attr(c, 'Charisma', 5), c, 'over-budget');
    good(attr(c, 'Charisma', 3)); // lowering is always fine
  });

  test('refusals: out-of-range (+9, -3), unknown-attribute, no-change, creation-closed', () => {
    const c = fresh();
    refused(attr(c, 'Dexterity', 9), c, 'out-of-range');
    refused(attr(c, 'Dexterity', -3), c, 'out-of-range');
    refused(attr(c, 'Luck', 1), c, 'unknown-attribute');
    refused(attr(c, 'Dexterity', 0), c, 'no-change');
    const closed = fresh('Archer', { open: false });
    refused(attr(closed, 'Dexterity', 1), closed, 'creation-closed');
    const bare = fresh();
    delete bare.creation;
    refused(attr(bare, 'Dexterity', 1), bare, 'creation-closed');
  });

  test('the full range works: +8 costs 15 and -2 refunds 2', () => {
    const c = good(attr(good(attr(fresh(), 'Dexterity', 8)), 'Willpower', -2));
    assert.equal(c.attributes.Dexterity.points, 8);
    assert.equal(c.attributes.Willpower.points, -2);
    assert.equal(attributeBudget(c, ctx).spent, 13);
  });
});

describe('skillBudget (R5: fixed ranks first, then 8 extra; max Rank 3 incl. fixed; languages Rank 1)', () => {
  test('fresh Archer: extra 8/0/8; fixed knowledge 2, artisan 1, speak 2, read/write 1; valid; no rows', () => {
    const b = skillBudget(fresh('Archer'), ctx);
    assert.deepEqual(b.extra, { total: 8, spent: 0, left: 8 });
    assert.deepEqual(b.fixed.knowledge, { total: 2, used: 0, left: 2 });
    assert.deepEqual(b.fixed.artisan, { total: 1, used: 0, left: 1 });
    assert.deepEqual(b.fixed['language-speak'], { total: 2, used: 0, left: 2 });
    assert.deepEqual(b.fixed['language-readwrite'], { total: 1, used: 0, left: 1 });
    assert.equal(b.valid, true);
    assert.deepEqual(b.problems, []);
    assert.deepEqual(b.rows, []);
  });

  test('candidates: generic Knowledge and Artisan carry freeText; the two language templates are NOT offered; per-language entries are', () => {
    const cands = skillBudget(fresh('Archer'), ctx).candidates;
    const by = Object.fromEntries(cands.map((c) => [c.name, c]));
    assert.equal(by.Knowledge.generic, true);
    assert.equal(by.Knowledge.freeText, 'knowledge');
    assert.equal(by.Knowledge.category, 'knowledge');
    assert.equal(by.Artisan.generic, true);
    assert.equal(by.Artisan.freeText, 'artisan');
    assert.equal(by['Horror Lore'].freeText, null);
    assert.ok(!by['Horror Lore'].generic);
    assert.ok(!('Speak Language' in by), 'template not offered');
    assert.ok(!('Read/Write Language' in by), 'template not offered');
    assert.ok(by['Speak Language (Ork)'] && by['Read/Write Language (Throalic)']);
    for (const c of cands) for (const k of ['name', 'category', 'generic', 'freeText', 'disciplineList', 'pool', 'attribute', 'brief', 'canPick']) assert.ok(k in c, `${c.name}.${k}`);
  });

  test('candidates: Discipline-list artisans are marked and draw the fixed rank; other artisans and general skills draw the extra pool', () => {
    const by = Object.fromEntries(skillBudget(fresh('Archer'), ctx).candidates.map((c) => [c.name, c]));
    assert.equal(by['Wood Carving'].disciplineList, true);
    assert.equal(by['Wood Carving'].pool, 'fixed');
    assert.equal(by['Arrow Fletching (Artisan)'].disciplineList, true, 'matched through artisanKey, not the catalog name');
    assert.ok(!by.Painting.disciplineList);
    assert.equal(by.Painting.pool, 'extra');
    assert.equal(by['Acrobatic Defense'].pool, 'extra');
    assert.equal(by['Acrobatic Defense'].attribute, skillCatalog.find((s) => s.name === 'Acrobatic Defense').attribute);
    assert.equal(by.Knowledge.pool, 'fixed');
    assert.equal(by['Speak Language (Ork)'].pool, 'fixed');
    assert.equal(by['Read/Write Language (Ork)'].pool, 'fixed');
    // The Discipline list differs per Discipline.
    const thief = Object.fromEntries(skillBudget(fresh('Thief'), ctx).candidates.map((c) => [c.name, c]));
    assert.equal(thief.Acting.disciplineList, true);
    assert.equal(thief.Poetry.disciplineList, true);
    assert.ok(!thief['Wood Carving'].disciplineList);
  });

  test('candidates: only category general at Novice tier is offered from the general list (Impressive Display, Tactics, tier-2 skills are not pickable)', () => {
    const cands = skillBudget(fresh('Archer'), ctx).candidates;
    const pickable = new Set(cands.filter((c) => c.canPick).map((c) => c.name));
    for (const n of ['Impressive Display', 'Tactics', 'Aggressive Maneuver', 'Critical Hit']) assert.ok(!pickable.has(n), n);
    for (const n of GENERAL_NOVICE) assert.ok(pickable.has(n), `${n} is pickable`);
  });

  test('allocation is DERIVED from the stored set: fixed ranks are consumed first, the rest is extra', () => {
    const c = fresh('Archer');
    c.skills = [
      { name: 'Knowledge (Barsaive History)', rank: 3, tier: 'Novice' }, // 3 free -> 2 fixed + 1 extra
      { name: 'Knowledge (Elves)', rank: 1, tier: 'Novice' }, // knowledge pool already full -> extra
      { name: 'Speak Language (Ork)', rank: 1, tier: 'Novice' },
      { name: 'Wood Carving', rank: 2, tier: 'Novice' }, // Discipline list: 1 fixed + 1 extra
      { name: 'Painting', rank: 1, tier: 'Novice' }, // not on the list: extra
      { name: 'Climbing', rank: 1, tier: 'Novice' }, // general: extra
    ];
    c.creation.free.skills = { 'Knowledge (Barsaive History)': 3, 'Knowledge (Elves)': 1, 'Speak Language (Ork)': 1, 'Wood Carving': 2, Painting: 1, Climbing: 1 };
    const b = skillBudget(c, ctx);
    assert.deepEqual(b.fixed.knowledge, { total: 2, used: 2, left: 0 });
    assert.deepEqual(b.fixed['language-speak'], { total: 2, used: 1, left: 1 });
    assert.deepEqual(b.fixed['language-readwrite'], { total: 1, used: 0, left: 1 });
    assert.deepEqual(b.fixed.artisan, { total: 1, used: 1, left: 0 });
    // total ranks 3+1+1+2+1+1 = 9; fixed used 2+1+1 = 4 -> extra 5
    assert.deepEqual(b.extra, { total: 8, spent: 5, left: 3 });
    assert.equal(b.valid, true);
    const rowsByName = Object.fromEntries(b.rows.map((r) => [r.name, [r.rank, r.category]]));
    assert.deepEqual(rowsByName, {
      'Knowledge (Barsaive History)': [3, 'knowledge'],
      'Knowledge (Elves)': [1, 'knowledge'],
      'Speak Language (Ork)': [1, 'language-speak'],
      'Wood Carving': [2, 'artisan'],
      Painting: [1, 'artisan'],
      Climbing: [1, 'general'],
    });
  });

  test('a non-list artisan never consumes the fixed Artisan rank (it is only ever consumed by a Discipline-list skill)', () => {
    const c = fresh('Archer');
    c.skills = [{ name: 'Painting', rank: 2, tier: 'Novice' }, { name: 'Artisan (Candle Making)', rank: 1, tier: 'Novice' }];
    c.creation.free.skills = { Painting: 2, 'Artisan (Candle Making)': 1 };
    const b = skillBudget(c, ctx);
    assert.deepEqual(b.fixed.artisan, { total: 1, used: 0, left: 1 });
    assert.equal(b.extra.spent, 3);
    assert.equal(b.rows.find((r) => r.name === 'Artisan (Candle Making)').category, 'artisan', 'free-text Artisan resolves to the artisan template');
  });

  test('rows: max is 3 (1 for the language categories); canRaise/canLower are computed by simulating the change', () => {
    let c = fresh('Archer');
    c = good(addSkill(c, 'Speak Language (Ork)'));
    c = good(addSkill(c, 'Acrobatic Defense'));
    let rows = Object.fromEntries(skillBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.equal(rows['Speak Language (Ork)'].max, 1);
    assert.equal(rows['Speak Language (Ork)'].canRaise, false, 'a language is a Rank-1 entry');
    assert.equal(rows['Speak Language (Ork)'].canLower, false, 'removal is a separate action');
    assert.equal(rows['Acrobatic Defense'].max, 3);
    assert.equal(rows['Acrobatic Defense'].canRaise, true);
    assert.equal(rows['Acrobatic Defense'].canLower, false, 'Rank 1 is the floor: remove via applySkillRemove');
    c = good(applySkillRank(c, ctx, { name: 'Acrobatic Defense', rank: 3 }));
    rows = Object.fromEntries(skillBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.equal(rows['Acrobatic Defense'].canRaise, false, 'Rank 3 cap');
    assert.equal(rows['Acrobatic Defense'].canLower, true);
  });

  test('over-spent extra pool reads valid: false (shown, never auto-corrected)', () => {
    const c = fresh('Archer');
    c.skills = GENERAL_NOVICE.slice(0, 9).map((name) => ({ name, rank: 1, tier: 'Novice' }));
    c.creation.free.skills = Object.fromEntries(c.skills.map((s) => [s.name, 1]));
    const b = skillBudget(c, ctx);
    assert.equal(b.extra.spent, 9);
    assert.equal(b.valid, false);
    assert.equal(c.skills.length, 9, 'nothing was removed');
  });
});

describe('applySkillAdd / applySkillRank / applySkillRemove', () => {
  test('a non-generic pick stores { name, rank: 1, tier: Novice } under the exact catalog name, writes the ledger, touches advancements + creation', () => {
    const c = fresh();
    const next = good(addSkill(c, 'Acrobatic Defense'), ['advancements', 'creation']);
    assert.deepEqual(next.skills, [{ name: 'Acrobatic Defense', rank: 1, tier: 'Novice' }]);
    assert.deepEqual(Object.keys(next.skills[0]).sort(), ['name', 'rank', 'tier']);
    assert.equal(next.creation.free.skills['Acrobatic Defense'], 1);
    assert.deepEqual(c.skills, [], 'input untouched');
    const b = skillBudget(next, ctx);
    assert.deepEqual(b.extra, { total: 8, spent: 1, left: 7 });
  });

  test('generic Knowledge: stored as `Knowledge (<text>)` with the text trimmed; consumes the fixed Knowledge ranks first', () => {
    let c = good(addSkill(fresh(), 'Knowledge', '  Barsaive History  '));
    assert.equal(c.skills[0].name, 'Knowledge (Barsaive History)');
    assert.equal(c.creation.free.skills['Knowledge (Barsaive History)'], 1);
    assert.deepEqual(skillBudget(c, ctx).fixed.knowledge, { total: 2, used: 1, left: 1 });
    c = good(addSkill(c, 'Horror Lore')); // a knowledge entry, stored by its own name
    assert.equal(c.skills[1].name, 'Horror Lore');
    assert.deepEqual(skillBudget(c, ctx).fixed.knowledge, { total: 2, used: 2, left: 0 });
    assert.equal(skillBudget(c, ctx).extra.spent, 0);
    c = good(addSkill(c, 'Knowledge', 'Local Legends')); // a third Knowledge pick spends one of the 8
    assert.deepEqual(skillBudget(c, ctx).extra, { total: 8, spent: 1, left: 7 });
    assert.deepEqual(skillBudget(c, ctx).fixed.knowledge, { total: 2, used: 2, left: 0 });
  });

  test('generic Artisan: `Artisan (<text>)` spends the extra pool, never the fixed Artisan rank', () => {
    const c = good(addSkill(fresh('Archer'), 'Artisan', 'Candle Making'));
    assert.equal(c.skills[0].name, 'Artisan (Candle Making)');
    assert.deepEqual(skillBudget(c, ctx).fixed.artisan, { total: 1, used: 0, left: 1 });
    assert.equal(skillBudget(c, ctx).extra.spent, 1);
  });

  test('Discipline-list Artisan: the first pick takes the fixed rank, a second list pick takes an extra rank', () => {
    let c = good(addSkill(fresh('Archer'), 'Wood Carving'));
    assert.deepEqual(skillBudget(c, ctx).fixed.artisan, { total: 1, used: 1, left: 0 });
    assert.equal(skillBudget(c, ctx).extra.spent, 0);
    c = good(addSkill(c, 'Arrow Fletching (Artisan)'));
    assert.deepEqual(skillBudget(c, ctx).fixed.artisan, { total: 1, used: 1, left: 0 });
    assert.equal(skillBudget(c, ctx).extra.spent, 1);
    const by = Object.fromEntries(skillBudget(fresh('Archer'), ctx).candidates.map((x) => [x.name, x]));
    assert.equal(by['Wood Carving'].pool, 'fixed');
    const after = Object.fromEntries(skillBudget(good(addSkill(fresh('Archer'), 'Wood Carving')), ctx).candidates.map((x) => [x.name, x]));
    assert.equal(after['Arrow Fletching (Artisan)'].pool, 'extra', 'the fixed rank is gone');
  });

  test('a non-list artisan from the 8 is allowed and spends extra; per Discipline (Thief: Acting is the list)', () => {
    const c = good(addSkill(fresh('Archer'), 'Painting'));
    assert.deepEqual(skillBudget(c, ctx).fixed.artisan, { total: 1, used: 0, left: 1 });
    assert.equal(skillBudget(c, ctx).extra.spent, 1);
    const t = good(addSkill(fresh('Thief'), 'Acting'));
    assert.deepEqual(skillBudget(t, ctx).fixed.artisan, { total: 1, used: 1, left: 0 });
  });

  test('languages: two Speak Language entries are free (fixed), a third spends one of the 8; one Read/Write is free, a second spends extra', () => {
    let c = fresh();
    c = good(addSkill(c, 'Speak Language (Ork)'));
    c = good(addSkill(c, 'Speak Language (Troll)'));
    assert.deepEqual(skillBudget(c, ctx).fixed['language-speak'], { total: 2, used: 2, left: 0 });
    assert.equal(skillBudget(c, ctx).extra.spent, 0);
    c = good(addSkill(c, 'Speak Language (Throalic)'));
    assert.equal(skillBudget(c, ctx).extra.spent, 1);
    c = good(addSkill(c, 'Read/Write Language (Throalic)'));
    assert.deepEqual(skillBudget(c, ctx).fixed['language-readwrite'], { total: 1, used: 1, left: 0 });
    assert.equal(skillBudget(c, ctx).extra.spent, 1);
    c = good(addSkill(c, 'Read/Write Language (Ork)'));
    assert.equal(skillBudget(c, ctx).extra.spent, 2);
    for (const s of c.skills) assert.equal(s.rank, 1, `${s.name} stays at Rank 1`);
  });

  test('text rules: trimmed, 1-40 chars, no parentheses; 40 characters is accepted', () => {
    const c = fresh();
    for (const text of ['', '   ', 'a'.repeat(41), 'Dragons (Great)', 'Open (', 'Close)']) {
      refused(addSkill(c, 'Knowledge', text), c, 'bad-text');
      refused(addSkill(c, 'Artisan', text), c, 'bad-text');
    }
    refused(applySkillAdd(c, ctx, { name: 'Knowledge' }), c, 'bad-text');
    const ok = good(addSkill(c, 'Knowledge', 'a'.repeat(40)));
    assert.equal(ok.skills[0].name, `Knowledge (${'a'.repeat(40)})`);
    assert.equal(good(addSkill(c, 'Knowledge', ` ${'b'.repeat(40)} `)).skills[0].name, `Knowledge (${'b'.repeat(40)})`);
  });

  test('the language templates never take free text', () => {
    const c = fresh();
    refused(addSkill(c, 'Speak Language', 'Elvish'), c, 'generic-not-allowed');
    refused(addSkill(c, 'Read/Write Language', 'Elvish'), c, 'generic-not-allowed');
    const bare = applySkillAdd(c, ctx, { name: 'Speak Language' });
    assert.equal(bare.ok, false);
    assert.equal(bare.character, c);
  });

  test('refusals: unknown-skill, tier-not-novice (Impressive Display, Tactics, tier-2 skills), duplicate (case-insensitive)', () => {
    const c = fresh();
    refused(addSkill(c, 'Basket Weaving'), c, 'unknown-skill');
    for (const n of ['Impressive Display', 'Tactics', 'Aggressive Maneuver', 'Critical Hit']) refused(addSkill(c, n), c, 'tier-not-novice');
    const one = good(addSkill(c, 'Knowledge', 'Barsaive History'));
    refused(addSkill(one, 'Knowledge', 'barsaive history'), one, 'duplicate');
    refused(addSkill(one, 'Knowledge', 'Barsaive History'), one, 'duplicate');
    const two = good(addSkill(one, 'Acrobatic Defense'));
    refused(addSkill(two, 'Acrobatic Defense'), two, 'duplicate');
  });

  test('refusal: a pick with no capacity (extra pool full and no fixed rank for that category)', () => {
    let c = fresh();
    for (const n of GENERAL_NOVICE.slice(0, 8)) c = good(addSkill(c, n));
    assert.deepEqual(skillBudget(c, ctx).extra, { total: 8, spent: 8, left: 0 });
    // "over-budget" is the budget code; the spec also lists "not-allowed-category", so either is accepted for a capacity refusal.
    for (const name of [GENERAL_NOVICE[8], 'Painting']) {
      const res = addSkill(c, name);
      refused(res, c);
      assert.ok(['over-budget', 'not-allowed-category'].includes(res.reason), `${name}: ${res.reason}`);
    }
    // ...but a category with a fixed rank left is still pickable
    const k = good(addSkill(c, 'Knowledge', 'Barsaive History'));
    assert.deepEqual(skillBudget(k, ctx).fixed.knowledge, { total: 2, used: 1, left: 1 });
    assert.equal(skillBudget(k, ctx).extra.spent, 8);
    const w = good(addSkill(c, 'Wood Carving'));
    assert.deepEqual(skillBudget(w, ctx).fixed.artisan, { total: 1, used: 1, left: 0 });
  });

  test('applySkillRank: sets the rank and the ledger (>= 1); max Rank 3 including fixed ranks; languages stay Rank 1', () => {
    let c = good(addSkill(fresh(), 'Knowledge', 'Barsaive History'));
    c = good(applySkillRank(c, ctx, { name: 'Knowledge (Barsaive History)', rank: 3 }), ['advancements', 'creation']);
    assert.equal(c.skills[0].rank, 3);
    assert.equal(c.creation.free.skills['Knowledge (Barsaive History)'], 3);
    assert.deepEqual(skillBudget(c, ctx).fixed.knowledge, { total: 2, used: 2, left: 0 });
    assert.deepEqual(skillBudget(c, ctx).extra, { total: 8, spent: 1, left: 7 }, 'ranks 1-2 fixed, rank 3 extra');
    refused(applySkillRank(c, ctx, { name: 'Knowledge (Barsaive History)', rank: 4 }), c, 'rank-cap');
    const lowered = good(applySkillRank(c, ctx, { name: 'Knowledge (Barsaive History)', rank: 2 }));
    assert.equal(lowered.creation.free.skills['Knowledge (Barsaive History)'], 2);
    const lang = good(addSkill(fresh(), 'Speak Language (Ork)'));
    refused(applySkillRank(lang, ctx, { name: 'Speak Language (Ork)', rank: 2 }), lang, 'rank-cap');
  });

  test('applySkillRank refusals: bad-rank (0, negative, fractional), not-found, no-change, over-budget, creation-closed', () => {
    const c = good(addSkill(fresh(), 'Acrobatic Defense'));
    for (const rank of [0, -1, 1.5, NaN]) refused(applySkillRank(c, ctx, { name: 'Acrobatic Defense', rank }), c, 'bad-rank');
    refused(applySkillRank(c, ctx, { name: 'Climbing', rank: 2 }), c, 'not-found');
    refused(applySkillRank(c, ctx, { name: 'Acrobatic Defense', rank: 1 }), c, 'no-change');
    let full = fresh();
    for (const n of GENERAL_NOVICE.slice(0, 8)) full = good(addSkill(full, n));
    refused(applySkillRank(full, ctx, { name: GENERAL_NOVICE[0], rank: 2 }), full, 'over-budget');
    const closed = { ...c, creation: { ...c.creation, open: false } };
    refused(applySkillRank(closed, ctx, { name: 'Acrobatic Defense', rank: 2 }), closed, 'creation-closed');
  });

  test('a rank raise on a category with fixed ranks left spends the fixed rank even when the extra pool is full', () => {
    let c = good(addSkill(fresh(), 'Knowledge', 'Barsaive History'));
    for (const n of GENERAL_NOVICE.slice(0, 8)) c = good(addSkill(c, n));
    assert.equal(skillBudget(c, ctx).extra.left, 0);
    c = good(applySkillRank(c, ctx, { name: 'Knowledge (Barsaive History)', rank: 2 }));
    assert.equal(c.skills.find((s) => s.name === 'Knowledge (Barsaive History)').rank, 2);
    refused(applySkillRank(c, ctx, { name: 'Knowledge (Barsaive History)', rank: 3 }), c, 'over-budget');
  });

  test('applySkillRemove deletes the row and the ledger key and frees the capacity; unknown name -> not-found', () => {
    let c = good(addSkill(fresh(), 'Acrobatic Defense'));
    c = good(addSkill(c, 'Climbing'));
    const next = good(applySkillRemove(c, ctx, { name: 'Acrobatic Defense' }), ['advancements', 'creation']);
    assert.deepEqual(next.skills.map((s) => s.name), ['Climbing']);
    assert.ok(!('Acrobatic Defense' in next.creation.free.skills));
    assert.equal(skillBudget(next, ctx).extra.spent, 1);
    refused(applySkillRemove(next, ctx, { name: 'Acrobatic Defense' }), next, 'not-found');
    const closed = { ...c, creation: { ...c.creation, open: false } };
    refused(applySkillRemove(closed, ctx, { name: 'Climbing' }), closed, 'creation-closed');
  });

  test('applySkillAdd does not mutate its input and refuses after Finish', () => {
    const c = deepFreeze(fresh());
    good(addSkill(c, 'Acrobatic Defense'));
    const closed = fresh('Archer', { open: false });
    refused(addSkill(closed, 'Acrobatic Defense'), closed, 'creation-closed');
  });
});

describe('spellBudget and spell picks (R6: spell points = Perception Step, a spell costs its Circle, Circle 1-2, two Standard Matrices free)', () => {
  const nethermancerSpells = Object.entries(spellCatalog).filter(([, s]) => s.discipline === 'Nethermancer' && [1, 2].includes(s.circle));
  const pick = (c, name, over = {}) => applySpellPick(c, ctxFor(over), { name });

  test('non-magicians get null everywhere: spellBudget, creationStatus.spells, and picks are refused', () => {
    const c = fresh('Archer');
    assert.equal(spellBudget(c, ctx), null);
    assert.equal(creationStatus(c, ctx).spells, null);
    refused(pick(c, 'Astral Spear'), c, 'not-a-magician');
    const res = applySpellRemove(c, ctx, { name: 'Astral Spear' });
    assert.equal(res.ok, false);
    assert.equal(res.character, c);
  });

  test('a fresh Nethermancer: total = Perception Step, spent 0, left = total; candidates are the Discipline Circle 1-2 spells (cost = Circle)', () => {
    const b = spellBudget(fresh('Nethermancer'), ctx);
    assert.equal(b.total, 5);
    assert.equal(b.spent, 0);
    assert.equal(b.left, 5);
    assert.equal(b.valid, true);
    assert.deepEqual(b.rows, []);
    sameSet(b.candidates.map((c) => c.name), nethermancerSpells.map(([n]) => n));
    assert.ok(b.candidates.length >= 28);
    for (const c of b.candidates) {
      assert.equal(c.cost, spellCatalog[c.name].circle, c.name);
      assert.equal(c.circle, spellCatalog[c.name].circle, c.name);
      assert.equal(c.canPick, true, c.name);
    }
    assert.ok(!b.candidates.some((c) => spellCatalog[c.name].circle > 2), 'no Circle 3+ spell');
  });

  test('the budget follows the ctx Perception Step and never comes from the stored character', () => {
    assert.equal(spellBudget(fresh('Nethermancer'), ctxFor({ perceptionStep: 9 })).total, 9);
    assert.equal(spellBudget(fresh('Nethermancer'), ctxFor({ perceptionStep: 3 })).left, 3);
  });

  test('picking appends { name, learntSuccess: 0 } to spells.known and the catalog name to free.spells; touched is spells + creation', () => {
    const c = fresh('Nethermancer');
    const next = good(pick(c, 'Astral Spear'), ['spells', 'creation']);
    assert.deepEqual(next.spells.known, [{ name: 'Astral Spear', learntSuccess: 0 }]);
    assert.deepEqual(next.creation.free.spells, ['Astral Spear']);
    assert.deepEqual(next.spells.matrices, c.spells.matrices, 'matrices untouched');
    assert.deepEqual(c.spells.known, [], 'input untouched');
    const b = spellBudget(next, ctx);
    assert.equal(b.spent, 1);
    assert.equal(b.left, 4);
    assert.ok(!b.candidates.some((x) => x.name === 'Astral Spear'), 'a known spell is no longer a candidate');
  });

  test('a Circle-2 spell costs 2; the budget can be spent to exactly 0; the next pick is over-budget', () => {
    let c = fresh('Nethermancer');
    c = good(pick(c, 'Chilling Circle')); // Circle 2
    assert.equal(spellBudget(c, ctx).spent, 2);
    c = good(pick(c, 'Astral Spear')); // 1
    c = good(pick(c, 'Bone Circle')); // 1
    c = good(pick(c, 'Dark Messenger')); // 1 -> 5
    const b = spellBudget(c, ctx);
    assert.equal(b.left, 0);
    assert.equal(b.valid, true);
    refused(pick(c, 'Ethereal Darkness'), c, 'over-budget');
    for (const cand of b.candidates) assert.equal(cand.canPick, false, cand.name);
  });

  test('a Circle-2 spell that does not fit (1 point left) is over-budget while a Circle-1 one fits', () => {
    let c = fresh('Nethermancer');
    c = good(applySpellPick(c, ctxFor({ perceptionStep: 3 }), { name: 'Chilling Circle' })); // 2 of 3
    refused(applySpellPick(c, ctxFor({ perceptionStep: 3 }), { name: 'Shield Mist' }), c, 'over-budget');
    good(applySpellPick(c, ctxFor({ perceptionStep: 3 }), { name: 'Astral Spear' }));
  });

  test('the pick is matched apostrophe-insensitively and stores the catalog-canonical name', () => {
    const c = good(pick(fresh('Nethermancer'), "Death's Head")); // straight apostrophe in
    assert.equal(c.spells.known[0].name, 'Death’s Head'); // catalog (typographic) name stored
    assert.deepEqual(c.creation.free.spells, ['Death’s Head']);
    refused(pick(c, 'Death’s Head'), c, 'duplicate');
    refused(pick(c, "Death's Head"), c, 'duplicate');
  });

  test('rows: Circle-1 spells are placeable, Circle-2 spells are known but not placeable at Circle 1; canRemove while open', () => {
    let c = fresh('Nethermancer');
    c = good(pick(c, 'Astral Spear'));
    c = good(pick(c, 'Chilling Circle'));
    const rows = Object.fromEntries(spellBudget(c, ctx).rows.map((r) => [r.name, r]));
    assert.deepEqual([rows['Astral Spear'].circle, rows['Astral Spear'].placeable, rows['Astral Spear'].canRemove], [1, true, true]);
    assert.deepEqual([rows['Chilling Circle'].circle, rows['Chilling Circle'].placeable, rows['Chilling Circle'].canRemove], [2, false, true]);
  });

  test('spent counts only known spells that are in the free ledger', () => {
    const c = fresh('Nethermancer');
    c.spells.known = [{ name: 'Astral Spear', learntSuccess: 0 }, { name: 'Chilling Circle', learntSuccess: 0 }];
    c.creation.free.spells = ['Astral Spear'];
    assert.equal(spellBudget(c, ctx).spent, 1);
  });

  test('refusals: unknown-spell (not in the catalog), a Circle 3+ spell, duplicate, creation-closed', () => {
    const c = fresh('Nethermancer');
    refused(pick(c, 'Fireball of Doom'), c, 'unknown-spell');
    const circle3 = Object.entries(spellCatalog).find(([, s]) => s.circle === 3)[0];
    const res = pick(c, circle3);
    assert.equal(res.ok, false);
    assert.equal(res.character, c);
    const one = good(pick(c, 'Astral Spear'));
    refused(pick(one, 'Astral Spear'), one, 'duplicate');
    const closed = fresh('Nethermancer', { open: false });
    refused(pick(closed, 'Astral Spear'), closed, 'creation-closed');
  });

  test('applySpellRemove drops the spell from known and the ledger and RELEASES any matrix holding it', () => {
    let c = fresh('Nethermancer');
    c = good(pick(c, 'Astral Spear'));
    c = good(pick(c, 'Bone Circle'));
    c = { ...c, spells: { ...c.spells, matrices: [{ type: 'Standard', spell: 'Astral Spear' }, { type: 'Standard', spell: 'Bone Circle' }] } };
    const next = good(applySpellRemove(c, ctx, { name: 'Astral Spear' }), ['spells', 'creation']);
    assert.deepEqual(next.spells.known.map((k) => k.name), ['Bone Circle']);
    assert.deepEqual(next.creation.free.spells, ['Bone Circle']);
    assert.deepEqual(next.spells.matrices, [{ type: 'Standard', spell: null }, { type: 'Standard', spell: 'Bone Circle' }]);
    assert.equal(spellBudget(next, ctx).spent, 1);
    refused(applySpellRemove(next, ctx, { name: 'Astral Spear' }), next, 'not-found');
    const closed = { ...c, creation: { ...c.creation, open: false } };
    refused(applySpellRemove(closed, ctx, { name: 'Bone Circle' }), closed, 'creation-closed');
  });

  test('checkSpellMatrices refuses (matrix-circle) a matrix holding a spell above the Discipline Circle while creation is open', () => {
    const c = fresh('Nethermancer');
    const next = (spell) => ({ known: [], matrices: [{ type: 'Standard', spell }, { type: 'Standard', spell: null }] });
    for (const circle2 of ['Chilling Circle', 'Death’s Head']) {
      const res = checkSpellMatrices(c, next(circle2), ctx);
      assert.equal(res.ok, false, circle2);
      assert.equal(res.reason, 'matrix-circle', circle2);
    }
    assert.equal(checkSpellMatrices(c, next('Astral Spear'), ctx).ok, true);
    assert.equal(checkSpellMatrices(c, next(null), ctx).ok, true);
    const closed = fresh('Nethermancer', { open: false });
    assert.equal(checkSpellMatrices(closed, next('Chilling Circle'), ctx).ok, true, 'only enforced while creation is open');
  });

  test('perceptionStep == null never fabricates a budget: total/left null, nothing pickable, valid while nothing is picked', () => {
    const noStep = ctxFor({ perceptionStep: null });
    const c = fresh('Nethermancer');
    const b = spellBudget(c, noStep);
    assert.equal(b.total, null);
    assert.equal(b.left, null);
    assert.equal(b.valid, true, 'nothing picked');
    for (const cand of b.candidates) assert.equal(cand.canPick, false, cand.name);
    const res = applySpellPick(c, noStep, { name: 'Astral Spear' });
    assert.equal(res.ok, false);
    assert.equal(res.character, c);
    // anything picked while the Step is unresolvable is invalid
    const picked = good(applySpellPick(c, ctx, { name: 'Astral Spear' }));
    assert.equal(spellBudget(picked, noStep).valid, false);
  });

  test('Perception lowered after spells were picked: spells.valid is false, Finish is blocked, nothing is auto-removed', () => {
    let c = fresh('Nethermancer');
    for (const n of ['Chilling Circle', 'Shield Mist', 'Astral Spear']) c = good(pick(c, n)); // 5 points
    const low = ctxFor({ perceptionStep: 3 });
    const b = spellBudget(c, low);
    assert.equal(b.spent, 5);
    assert.equal(b.valid, false);
    assert.equal(c.spells.known.length, 3);
    const status = creationStatus(c, low);
    assert.equal(status.canFinish, false);
    assert.ok(status.blockers.some((s) => /spell/i.test(s)), JSON.stringify(status.blockers));
    refused(finishCreation(c, low), c, 'invalid-budget');
  });
});

describe('creationStatus', () => {
  test('null without a creation block; exactly { open: false } after Finish', () => {
    const bare = fresh();
    delete bare.creation;
    assert.equal(creationStatus(bare, ctx), null);
    assert.deepEqual(creationStatus(fresh('Archer', { open: false }), ctx), { open: false });
  });

  test('open: free ledger, the four budgets, canFinish and blockers', () => {
    const c = fresh('Archer');
    const s = creationStatus(c, ctx);
    assert.equal(s.open, true);
    assert.deepEqual(s.free, c.creation.free);
    assert.deepEqual(s.talents, talentBudget(c, ctx));
    assert.deepEqual(s.attributes, attributeBudget(c, ctx));
    assert.deepEqual(s.skills, skillBudget(c, ctx));
    assert.equal(s.spells, null, 'non-magician');
    assert.equal(s.canFinish, true);
    assert.deepEqual(s.blockers, []);
    const m = creationStatus(fresh('Nethermancer'), ctx);
    assert.deepEqual(m.spells, spellBudget(fresh('Nethermancer'), ctx));
  });

  test('canFinish is every present budget valid; each invalid budget adds a blocker naming it', () => {
    const talents = fresh();
    talents.disciplines[0].talents.push(T('Missile Weapon', 3), T('Mystic Aim', 3), T('True Shot', 3));
    let s = creationStatus(talents, ctx);
    assert.equal(s.canFinish, false);
    assert.ok(s.blockers.some((b) => /talent/i.test(b)), JSON.stringify(s.blockers));

    const attrs = fresh();
    attrs.attributes.Dexterity.points = 8;
    attrs.attributes.Strength.points = 6;
    attrs.attributes.Toughness.points = 4;
    s = creationStatus(attrs, ctx);
    assert.equal(s.canFinish, false);
    assert.ok(s.blockers.some((b) => /attribute/i.test(b)), JSON.stringify(s.blockers));

    const skills = fresh();
    skills.skills = GENERAL_NOVICE.slice(0, 9).map((name) => ({ name, rank: 1, tier: 'Novice' }));
    skills.creation.free.skills = Object.fromEntries(skills.skills.map((x) => [x.name, 1]));
    s = creationStatus(skills, ctx);
    assert.equal(s.canFinish, false);
    assert.ok(s.blockers.some((b) => /skill/i.test(b)), JSON.stringify(s.blockers));
    for (const b of s.blockers) assert.equal(typeof b, 'string');
  });
});

describe('finishPlan and finishCreation (R10: warn then forfeit unspent points; attribute leftovers -> Max Karma)', () => {
  test('a fresh Archer forfeits 8 talent points and 8 + 2 + 1 + 2 + 1 = 14 skill ranks, no spell points; karmaBonus 25', () => {
    const plan = finishPlan(fresh('Archer'), ctxFor({ karmaModifier: 5, karmaMaxCap: 40 }));
    assert.equal(plan.canFinish, true);
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.forfeits, { talents: 8, skills: 14, spells: 0 });
    assert.equal(plan.karmaBonus, 25);
    assert.equal(plan.oldMaxKarma, 5);
    assert.equal(plan.newMaxKarma, 30);
  });

  test('forfeits shrink as points are spent; a Nethermancer forfeits its unspent spell points', () => {
    let c = fresh('Nethermancer');
    c = good(talent(c, 'Nethermancer', 'Spellcasting', 3));
    c = good(talent(c, 'Nethermancer', 'Frighten', 3));
    c = good(talent(c, 'Nethermancer', 'Astral Sight', 2)); // 8 spent
    c = good(addSkill(c, 'Knowledge', 'Barsaive History')); // 1 fixed knowledge
    c = good(addSkill(c, 'Acrobatic Defense')); // 1 extra
    c = good(applySpellPick(c, ctx, { name: 'Astral Spear' })); // 1 of 5
    const plan = finishPlan(c, ctx);
    assert.deepEqual(plan.forfeits, { talents: 0, skills: (8 - 1) + (6 - 1), spells: 4 });
  });

  test('an unresolvable Perception Step forfeits 0 spell points (no fabricated budget)', () => {
    assert.equal(finishPlan(fresh('Nethermancer'), ctxFor({ perceptionStep: null })).forfeits.spells, 0);
  });

  test('a blocked plan says so: canFinish false with blockers', () => {
    const c = fresh();
    c.attributes.Dexterity.points = 8;
    c.attributes.Strength.points = 6;
    c.attributes.Toughness.points = 4;
    const plan = finishPlan(c, ctx);
    assert.equal(plan.canFinish, false);
    assert.ok(plan.blockers.length >= 1);
  });

  test('finishCreation closes the block, keeps the ledger, converts the Karma bonus, locks attribute points; touched creation + karma', () => {
    let c = fresh('Archer');
    c = good(talent(c, 'Archer', 'Missile Weapon', 3));
    c = good(addSkill(c, 'Acrobatic Defense'));
    c = good(attr(c, 'Dexterity', 4)); // 5 spent, 20 unspent
    const before = structuredClone(c);
    const plan = finishPlan(c, ctxFor({ karmaModifier: 5, karmaMaxCap: 40 }));
    assert.equal(plan.karmaBonus, 20);
    assert.equal(plan.newMaxKarma, 25);
    assert.equal(plan.oldMaxKarma, 5);
    const res = finishCreation(c, ctxFor({ karmaModifier: 5, karmaMaxCap: 40 }));
    const done = good(res, ['creation', 'karma']);
    assert.equal(done.creation.open, false);
    assert.deepEqual(done.creation.free, before.creation.free, 'the ledger is kept as it is');
    assert.deepEqual(Object.keys(done.creation).sort(), ['free', 'open']);
    assert.deepEqual(Object.keys(done.creation.free).sort(), ['skills', 'spells', 'talents']);
    assert.equal(done.resources.karma.converted, 5 + (25 - 5));
    assert.equal(done.resources.karma.spent, before.resources.karma.spent);
    assert.deepEqual(done.attributes, before.attributes, 'attributes[n].points are untouched');
    assert.deepEqual(done.disciplines, before.disciplines);
    assert.deepEqual(done.skills, before.skills);
    assert.deepEqual(done.resources.legend, before.resources.legend);
    assert.deepEqual(res.summary, plan.forfeits);
    assert.deepEqual(c, before, 'the input was not mutated');
  });

  test('Troll with 25 unspent: 3 + 17 = 20, never 28 (the cap holds the bonus)', () => {
    const troll = ctxFor({ karmaModifier: 3, karmaMaxCap: 20 });
    const c = fresh('Warrior', { race: 'Troll' });
    const plan = finishPlan(c, troll);
    assert.deepEqual([plan.oldMaxKarma, plan.newMaxKarma, plan.karmaBonus], [3, 20, 25]);
    const done = good(finishCreation(c, troll));
    assert.equal(done.resources.karma.converted, 20);
  });

  test('without a house cap the full bonus counts (3 + 25 = 28)', () => {
    const done = good(finishCreation(fresh('Warrior', { race: 'Troll' }), ctxFor({ karmaModifier: 3, karmaMaxCap: null })));
    assert.equal(done.resources.karma.converted, 28);
  });

  test('every attribute point spent: no bonus, converted stays the Circle-1 value', () => {
    let c = fresh('Archer');
    c = good(attr(c, 'Dexterity', 8)); // 15
    c = good(attr(c, 'Strength', 6)); // 9
    c = good(attr(c, 'Toughness', 1)); // 1
    const done = good(finishCreation(c, ctxFor({ karmaModifier: 5, karmaMaxCap: 40 })));
    assert.equal(done.resources.karma.converted, 5);
  });

  test('lowered attributes add to the bonus: -2 on one attribute -> 27 unspent', () => {
    const c = good(attr(fresh('Archer'), 'Willpower', -2));
    const plan = finishPlan(c, ctxFor({ karmaModifier: 5, karmaMaxCap: 40 }));
    assert.equal(plan.karmaBonus, 27);
    assert.equal(plan.newMaxKarma, 32);
  });

  test('no Karma modifier (race not in the table): Karma figures are null and Finish skips the Karma step', () => {
    const noMod = ctxFor({ karmaModifier: null, karmaMaxCap: null });
    const c = fresh('Archer', { race: 'Human' });
    const plan = finishPlan(c, noMod);
    assert.equal(plan.newMaxKarma, null);
    assert.equal(plan.oldMaxKarma, null);
    const res = finishCreation(c, noMod);
    const done = good(res, ['creation']);
    assert.ok(!res.touched.includes('karma'));
    assert.equal(done.resources.karma.converted, c.resources.karma.converted, 'converted is untouched');
    assert.equal(done.creation.open, false);
  });

  test('re-running Finish is a no-op refusal (already-finished, same reference)', () => {
    const done = good(finishCreation(fresh(), ctx));
    refused(finishCreation(done, ctx), done, 'already-finished');
  });

  test('Finish is refused while any budget is over-spent (invalid-budget, same reference)', () => {
    const c = fresh();
    c.disciplines[0].talents.push(T('Missile Weapon', 3), T('Mystic Aim', 3), T('True Shot', 3));
    refused(finishCreation(c, ctx), c, 'invalid-budget');
  });

  test('after Finish every apply* refuses with creation-closed (steppers lock; later gains use Legend)', () => {
    const done = good(finishCreation(fresh('Nethermancer'), ctx));
    refused(talent(done, 'Nethermancer', 'Spellcasting', 1), done, 'creation-closed');
    refused(attr(done, 'Dexterity', 1), done, 'creation-closed');
    refused(addSkill(done, 'Acrobatic Defense'), done, 'creation-closed');
    refused(applySkillRank(done, ctx, { name: 'Acrobatic Defense', rank: 2 }), done, 'creation-closed');
    refused(applySkillRemove(done, ctx, { name: 'Acrobatic Defense' }), done, 'creation-closed');
    refused(applySpellPick(done, ctx, { name: 'Astral Spear' }), done, 'creation-closed');
    refused(applySpellRemove(done, ctx, { name: 'Astral Spear' }), done, 'creation-closed');
  });

  test('Finish on a frozen input works without mutating it', () => {
    const c = deepFreeze(fresh());
    const done = good(finishCreation(c, ctx));
    assert.equal(c.creation.open, true);
    assert.equal(done.creation.open, false);
  });
});

describe('PROPERTY: random creation sessions keep the ledger, the budgets and the Legend audit consistent', () => {
  // Deterministic PRNG (mulberry32) so a failure is reproducible.
  const rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const choice = (r, list) => list[Math.floor(r() * list.length)];

  function session(discipline, seed, steps = 400) {
    const r = rng(seed);
    let c = fresh(discipline);
    const magician = discipline === 'Nethermancer';
    const TEXTS = ['Barsaive History', 'Elves', 'Local Legends', 'a'.repeat(40), 'bad(text)', '', 'Candle Making'];
    let applied = 0;
    for (let i = 0; i < steps; i++) {
      const op = Math.floor(r() * 8);
      const names = c.skills.map((s) => s.name);
      let res;
      if (op === 0) res = talent(c, discipline, choice(r, DT(discipline)), Math.floor(r() * 5) - 1);
      else if (op === 1) res = attr(c, choice(r, attributesFile.order), Math.floor(r() * 13) - 3);
      else if (op === 2) res = addSkill(c, choice(r, [...GENERAL_NOVICE.slice(0, 12), 'Knowledge', 'Artisan', 'Horror Lore', 'Wood Carving', 'Painting', 'Speak Language (Ork)', 'Speak Language (Troll)', 'Speak Language (Elf)', 'Read/Write Language (Ork)', 'Impressive Display']), choice(r, TEXTS));
      else if (op === 3 && names.length) res = applySkillRank(c, ctx, { name: choice(r, names), rank: Math.floor(r() * 5) });
      else if (op === 4 && names.length) res = applySkillRemove(c, ctx, { name: choice(r, names) });
      else if (op === 5 && magician) res = applySpellPick(c, ctx, { name: choice(r, Object.keys(spellCatalog)) });
      else if (op === 6 && magician && c.spells.known.length) res = applySpellRemove(c, ctx, { name: choice(r, c.spells.known).name });
      else continue;

      if (!res.ok) {
        assert.equal(res.character, c, `step ${i}: a refusal returns the same reference`);
        assert.ok(REASONS.includes(res.reason), `step ${i}: unknown reason ${res.reason}`);
        continue;
      }
      applied++;
      assert.notEqual(res.character, c);
      for (const t of res.touched) assert.ok(['advancements', 'attributes', 'spells', 'creation', 'karma'].includes(t), t);
      c = res.character;

      // key sets stay exact
      assert.deepEqual(Object.keys(c.creation).sort(), ['free', 'open']);
      assert.deepEqual(Object.keys(c.creation.free).sort(), ['skills', 'spells', 'talents']);
      assert.equal(c.creation.open, true);
      // while open, every stored talent / skill is in the ledger at exactly its rank; no zero is stored
      for (const t of c.disciplines[0].talents) assert.equal(c.creation.free.talents[`${discipline}/${t.name}`], t.rank, `step ${i}: ${t.name}`);
      assert.deepEqual(Object.keys(c.creation.free.talents).sort(), c.disciplines[0].talents.map((t) => `${discipline}/${t.name}`).sort());
      for (const s of c.skills) assert.equal(c.creation.free.skills[s.name], s.rank, `step ${i}: ${s.name}`);
      assert.deepEqual(Object.keys(c.creation.free.skills).sort(), c.skills.map((s) => s.name).sort());
      for (const v of [...Object.values(c.creation.free.talents), ...Object.values(c.creation.free.skills)]) assert.ok(Number.isInteger(v) && v >= 1);
      if (magician) assert.deepEqual([...c.creation.free.spells].sort(), c.spells.known.map((k) => k.name).sort());
      // seeded rows are never touched
      assert.deepEqual(rowOf(c, 'Durability'), T('Durability', 1));
      assert.deepEqual(rowOf(c, 'Karma Ritual'), T('Karma Ritual', 1));
      // no budget can be over-spent through the API, and the audit stays at 0 Legend
      const s = creationStatus(c, ctx);
      assert.equal(s.canFinish, true, `step ${i}: ${JSON.stringify(s.blockers)}`);
      assert.ok(s.talents.spent <= 8 && s.attributes.spent <= 25 && s.skills.extra.spent <= 8, `step ${i}: budgets`);
      if (magician) assert.ok(s.spells.spent <= s.spells.total);
      for (const sk of c.skills) assert.ok(sk.rank >= 1 && sk.rank <= (resolveSkill(sk.name).category.startsWith('language') ? 1 : 3), `step ${i}: ${sk.name} rank ${sk.rank}`);
      assert.equal(auditLegendSpent(c, costs, { spellCatalog, spellCostMultiplier: 1 }).total, 0, `step ${i}: creation costs 0 Legend`);
    }
    return { c, applied };
  }

  for (const discipline of ['Air Sailor', 'Archer', 'Nethermancer', 'Thief', 'Warrior']) {
    test(`${discipline}: 400 random edits (valid and invalid) never break an invariant`, () => {
      const { c, applied } = session(discipline, discipline.length * 7919);
      assert.ok(applied > 30, `only ${applied} edits applied; the session did not exercise the engine`);
      // and the session can always be finished and stays at 0 Legend afterwards
      const done = good(finishCreation(c, ctx));
      assert.equal(auditLegendSpent(done, costs, { spellCatalog, spellCostMultiplier: 1 }).total, 0);
    });
  }
});
