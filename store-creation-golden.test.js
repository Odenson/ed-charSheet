// store-creation-golden.test.js — run with `npm test` (node --test, no deps).
//
// ============================  GOLDEN TESTS  ============================
// create-new-adept, slice A2 "step 0" (plans/create-new-adept/spec.md). These pin TODAY'S
// store-level output (deriveModel, the edits overlay, forSave, indexToRows) for inline
// fixtures modelled on kolon-v2, chakka and test-char, captured from the UNMODIFIED code.
// They are NOT red-first: they PASS now and MUST KEEP PASSING after the creation-block,
// pricing and Legend-0 changes - an existing character (no `creation` block) must behave
// byte-identically; only a character carrying a `creation` block may change.
// If one goes red the dev changed existing behaviour: fix the code, never the golden.
// The failing (new-feature) store tests are store-creation-audit.test.js,
// store-overlay-creation.test.js and store-creation-model.test.js.
// data/characters/ is gitignored: nothing here reads it.
// =========================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveModel,
  indexToRows,
  forSave,
  applyEdits,
  saveAdvancementEdits,
  saveKarmaEdits,
  hasPendingEdits,
  reconcileOverlay,
} from './store.js';

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
// Deliberately WITHOUT attributesFile (store tests that predate the creation feature omit it;
// deriveModel must keep working) but WITH the real homebrew file (Karma economy, additional-
// Discipline tier shift and free spell learning are all enabled in it) and the spell catalog.
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
};

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

// What the model must keep reporting (captured from the unmodified deriveModel).
const GOLD_MODEL = {
  A: {"legend":{"totalEarnt":45386,"totalSpent":43380,"available":28511,"tierShift":1,"status":"Recognised","spent":{"total":16875,"recorded":43380,"delta":26505,"sections":[["attributes",9200],["talents:0",800],["skills",5000],["knacks",1000],["karma-rituals",875]]}},"legendEarned":[["__starting_total__",45386,true]],"karma":{"max":5,"available":5,"step":5,"ritualCost":7},"uncon":39,"death":53,"attrSteps":[["Dexterity",19,8],["Strength",22,9],["Toughness",16,7],["Perception",11,5],["Willpower",13,6],["Charisma",13,6]],"talentPricing":[["Thief",[["Awareness",1,200,null,true],["Durability",1,200,null,true],["Karma Ritual",1,200,null,true],["Lock Picking",1,200,null,true],["Picking Pockets",1,200,null,true],["Stealthy Stride",1,200,null,true],["Thread Weaving (Thief)",1,200,null,true],["Melee Weapon",1,200,null,true]]]],"skillPricing":[["Acrobatic Defense",4,1300,800,true],["Air Sailing",2,500,300,true],["Animal Handling",1,300,null,true],["Read/Write Language (Throalic)",1,300,null,true],["Speak Language (Ork)",1,300,null,true],["Speak Language (Theran)",1,300,null,true],["Speak Language (Throalic)",1,300,null,true],["Swimming",1,300,null,true],["Tailor",2,500,300,true],["Wilderness Survival",3,800,500,true]],"addable":["Air Sailor","Archer","Nethermancer","Warrior"],"spells":null},
  B: {"legend":{"totalEarnt":45815,"totalSpent":45261,"available":3254,"tierShift":1,"status":"Recognised","spent":{"total":42561,"recorded":45261,"delta":2700,"sections":[["attributes",10000],["talents:0",16000],["talents:1",10000],["skills",4900],["knacks",200],["threads",600],["spells",0],["karma-rituals",861]]}},"legendEarned":[["__starting_total__",45315,true],["e1",500,false]],"karma":{"max":20,"available":18,"step":5,"ritualCost":7},"uncon":69,"death":83,"attrSteps":[["Dexterity",20,8],["Strength",20,8],["Toughness",17,7],["Perception",14,6],["Willpower",13,6],["Charisma",13,6]],"talentPricing":[["Archer",[["Avoid Blow",4,800,500,true],["Durability",5,1300,800,true],["Karma Ritual",4,800,500,true],["Missile Weapon",5,1300,800,true],["Mystic Aim",5,1300,800,true],["Thread Weaving (Archer)",4,800,500,true],["True Shot",4,800,500,true],["Awareness",4,800,500,true],["Mystic Pursuit",4,800,500,true],["Throwing Weapon",3,500,300,true],["Anticipate Blow",4,800,500,true],["Stealthy Stride",4,800,500,true],["Long Shot",3,500,300,true],["First Impression",2,300,200,true]]],["Nethermancer",[["Astral Sight",3,800,500,true],["Frighten",3,800,500,true],["Patterncraft",3,800,500,true],["Spellcasting",4,1300,800,true],["Thread Weaving (Nethermancer)",3,800,500,true],["Dispel Magic",3,800,500,true],["Steel Thought",3,800,500,true],["Standard Matrix",3,800,500,true],["Spirit Talk",2,500,300,true],["Suppress Curse",1,300,null,true],["Command Nightflyer",2,500,300,true]]]],"skillPricing":[["Speak Language (Ork)",2,500,300,true],["Speak Language (Theran)",1,300,null,true],["Speak Language (Throalic)",1,300,null,true],["Read/Write Language (Theran)",1,300,null,true],["Navigation",1,300,null,true],["Tracking",2,500,300,true],["Air Sailing",2,500,300,true],["Public Speaking",1,300,null,true],["Tattooist",3,800,500,true],["Unarmed Combat",2,500,300,true],["Melee Weapon",1,300,null,true],["Wilderness Survival",2,500,300,true],["Horror Lore",1,300,null,true]],"addable":["Air Sailor","Thief","Warrior"],"spells":{"known":8,"matrices":3}},
  C: {"legend":{"totalEarnt":45315,"totalSpent":44661,"available":14554,"tierShift":1,"status":"Recognised","spent":{"total":30761,"recorded":44661,"delta":13900,"sections":[["attributes",10000],["talents:0",15100],["skills",4600],["knacks",200],["karma-rituals",861]]}},"legendEarned":[["__starting_total__",45315,true]],"karma":{"max":15,"available":15,"step":5,"ritualCost":7},"uncon":69,"death":83,"attrSteps":[["Dexterity",20,8],["Strength",20,8],["Toughness",17,7],["Perception",14,6],["Willpower",13,6],["Charisma",13,6]],"talentPricing":[["Archer",[["Avoid Blow",4,800,500,true],["Durability",5,1300,800,true],["Karma Ritual",4,800,500,true],["Missile Weapon",5,1300,800,true],["Mystic Aim",5,1300,800,true],["Thread Weaving (Archer)",4,800,500,true],["True Shot",4,800,500,true],["Awareness",4,800,500,true],["Mystic Pursuit",4,800,500,true],["Throwing Weapon",3,500,300,true],["Anticipate Blow",4,800,500,true],["Stealthy Stride",4,800,500,true]]]],"skillPricing":[["Speak Language (Ork)",2,500,300,true],["Speak Language (Theran)",1,300,null,true],["Speak Language (Throalic)",1,300,null,true],["Read/Write Language (Theran)",1,300,null,true],["Navigation",1,300,null,true],["Tracking",3,800,500,true],["Air Sailing",2,500,300,true],["Public Speaking",1,300,null,true],["Tattooist",2,500,300,true],["Unarmed Combat",2,500,300,true],["Melee Weapon",1,300,null,true],["Wilderness Survival",1,300,null,true],["Horror Lore",1,300,null,true]],"addable":["Air Sailor","Nethermancer","Thief","Warrior"],"spells":null},
  B_noHomebrew: {"legend":{"totalEarnt":45815,"totalSpent":45261,"available":1715,"tierShift":0,"status":"Recognised","spent":{"total":44100,"recorded":45261,"delta":1161,"sections":[["attributes",10000],["talents:0",16000],["talents:1",11100],["skills",4900],["knacks",200],["threads",600],["spells",1300]]}},"legendEarned":[["__starting_total__",45315,true],["e1",500,false]],"karma":{"max":20,"available":18,"step":4,"ritualCost":null},"uncon":59,"death":70,"attrSteps":[["Dexterity",20,8],["Strength",20,8],["Toughness",17,7],["Perception",14,6],["Willpower",13,6],["Charisma",13,6]],"talentPricing":[["Archer",[["Avoid Blow",4,800,500,true],["Durability",5,1300,800,true],["Karma Ritual",4,800,500,true],["Missile Weapon",5,1300,800,true],["Mystic Aim",5,1300,800,true],["Thread Weaving (Archer)",4,800,500,true],["True Shot",4,800,500,true],["Awareness",4,800,500,true],["Mystic Pursuit",4,800,500,true],["Throwing Weapon",3,500,300,true],["Anticipate Blow",4,800,500,true],["Stealthy Stride",4,800,500,true],["Long Shot",3,500,300,true],["First Impression",2,300,200,true]]],["Nethermancer",[["Astral Sight",3,800,500,true],["Frighten",3,800,500,true],["Patterncraft",3,800,500,true],["Spellcasting",4,1300,800,true],["Thread Weaving (Nethermancer)",3,800,500,true],["Dispel Magic",3,800,500,true],["Steel Thought",3,800,500,true],["Standard Matrix",3,800,500,true],["Spirit Talk",2,500,300,true],["Suppress Curse",1,300,null,true],["Command Nightflyer",2,500,300,true]]]],"skillPricing":[["Speak Language (Ork)",2,500,300,true],["Speak Language (Theran)",1,300,null,true],["Speak Language (Throalic)",1,300,null,true],["Read/Write Language (Theran)",1,300,null,true],["Navigation",1,300,null,true],["Tracking",2,500,300,true],["Air Sailing",2,500,300,true],["Public Speaking",1,300,null,true],["Tattooist",3,800,500,true],["Unarmed Combat",2,500,300,true],["Melee Weapon",1,300,null,true],["Wilderness Survival",2,500,300,true],["Horror Lore",1,300,null,true]],"addable":["Air Sailor","Thief","Warrior"],"spells":{"known":8,"matrices":3}},
};

const slice = (m) => ({
  legend: m.legend && {
    totalEarnt: m.legend.totalEarnt,
    totalSpent: m.legend.totalSpent,
    available: m.legend.available,
    tierShift: m.legend.tierShift,
    status: m.legend.status?.label ?? m.legend.status,
    spent: {
      total: m.legend.spent.total,
      recorded: m.legend.spent.recorded,
      delta: m.legend.spent.delta,
      sections: m.legend.spent.sections.map((s) => [s.key, s.total]),
    },
  },
  legendEarned: m.legendEarned.map((e) => [e.id, e.amount, !!e.virtual]),
  karma: {
    max: m.characteristics.karma.max,
    available: m.characteristics.karma.available,
    step: m.characteristics.karma.step,
    ritualCost: m.characteristics.karma.ritualCost,
  },
  uncon: m.characteristics.unconsciousness?.value,
  death: m.characteristics.death?.value,
  attrSteps: m.attributes.map((a) => [a.name, a.value, a.step]),
  talentPricing: m.disciplines.map((d) => [
    d.name,
    d.talents.filter((x) => !x.free).map((x) => [x.name, x.rank, x.pricing.increaseCost, x.pricing.refund, x.pricing.affordable]),
  ]),
  skillPricing: m.skills.map((s) => [s.name, s.rank, s.pricing.increaseCost, s.pricing.refund, s.pricing.affordable]),
  addable: m.addableDisciplines.map((c) => c.discipline),
  spells: m.spells ? { known: m.spells.known.length, matrices: m.spells.matrices.length } : null,
});

describe('GOLDEN (pre-existing behaviour, must stay green): deriveModel for characters without a creation block', () => {
  test('Kolon-like (single Thief 1, legacy totalEarnt, Karma economy on): Legend, Karma, health, pricing', () => {
    memory.clear();
    assert.deepEqual(slice(deriveModel(KOLON_LIKE, rules)), GOLD_MODEL.A);
  });

  test('Chakka-like (Archer 4 + Nethermancer 3, spells, rituals, thread items, earned entry): same', () => {
    memory.clear();
    assert.deepEqual(slice(deriveModel(CHAKKA_LIKE, rules)), GOLD_MODEL.B);
  });

  test('Test-char-like (single Archer 3, recorded totals): same', () => {
    memory.clear();
    assert.deepEqual(slice(deriveModel(TESTCHAR_LIKE, rules)), GOLD_MODEL.C);
  });

  test('Chakka-like WITHOUT the homebrew file (standard rules: no Karma sink, no tier shift, spells priced)', () => {
    memory.clear();
    const { homebrewFile, ...noHomebrew } = rules;
    assert.deepEqual(slice(deriveModel(CHAKKA_LIKE, noHomebrew)), GOLD_MODEL.B_noHomebrew);
  });

  test('Legend stays the placeholder (model.legend === null) with no earned entry and no legacy total', () => {
    memory.clear();
    const c = structuredClone(KOLON_LIKE);
    c.resources.legend = {};
    assert.equal(deriveModel(c, rules).legend, null);
    c.resources.legend = { earned: [] };
    assert.equal(deriveModel(c, rules).legend, null);
  });

  test('the model never mutates the character it derives from', () => {
    memory.clear();
    const frozen = structuredClone(CHAKKA_LIKE);
    deriveModel(CHAKKA_LIKE, rules);
    assert.deepEqual(CHAKKA_LIKE, frozen);
  });
});

describe('GOLDEN (pre-existing behaviour, must stay green): overlay, forSave and indexToRows', () => {
  test('forSave stamps ed-character/2, strips talent tier, and adds no creation key', () => {
    const c = structuredClone(KOLON_LIKE);
    c.disciplines[0].talents[0].tier = 'Novice';
    const out = forSave(c);
    assert.equal(out.schema, 'ed-character/2');
    assert.ok(!('tier' in out.disciplines[0].talents[0]));
    assert.ok(!('creation' in out));
  });

  test('applyEdits on a character without a creation block never invents one; advancements round-trip', () => {
    memory.clear();
    const edits = saveAdvancementEdits({ disciplines: KOLON_LIKE.disciplines, skills: KOLON_LIKE.skills }, 'k');
    const next = applyEdits(KOLON_LIKE, edits);
    assert.ok(!('creation' in next));
    assert.deepEqual(next.skills, KOLON_LIKE.skills);
  });

  test('hasPendingEdits / reconcileOverlay cover the existing categories (advancements, karma)', () => {
    memory.clear();
    assert.equal(hasPendingEdits('k'), false);
    saveAdvancementEdits({ disciplines: KOLON_LIKE.disciplines, skills: KOLON_LIKE.skills }, 'k');
    saveKarmaEdits({ converted: 126, spent: 105 }, 'k');
    assert.equal(hasPendingEdits('k'), true);
    reconcileOverlay(undefined, 'k');
    assert.equal(hasPendingEdits('k'), false);
    assert.equal(localStorage.getItem('ed-character-edits:k'), null);
  });

  test('indexToRows: sorted by id, name falls back to the id, a missing portrait is null', () => {
    assert.deepEqual(
      indexToRows({ characters: { zed: { name: 'Zed', portrait: 'data/z.jpg' }, anna: {}, bob: { name: 'Bob' } } }),
      [
        { id: 'anna', name: 'anna', portrait: null },
        { id: 'bob', name: 'Bob', portrait: null },
        { id: 'zed', name: 'Zed', portrait: 'data/z.jpg' },
      ],
    );
    assert.deepEqual(indexToRows({}), []);
  });
});
