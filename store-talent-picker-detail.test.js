// store-talent-picker-detail.test.js — talent-info-bubbles I1/I2 store slice.
// Every talent listed by the three Disciplines-tab pickers (edit-mode option slots,
// Add Discipline / Seed Circle 1, creation "+ add option") is a PickerTalent:
//   { name, required, brief, action, attribute, detail }
// with `detail` the same shape as a Disciplines-tab row's (talentDetail), whose
// derived `notes` key is renamed `effects`. Rules: none computed (plans/talent-info-bubbles/rules.md);
// every expected text value is read from rules/talents.json, and the tier is compared with
// tierForCircle's own output, never a literal. UI/modal behaviour is owner-verified (test-plan.md).
// Expected to fail until the feature is built (red-first).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import { buildNewCharacter } from './engine/new-character.js';
import { tierForCircle } from './engine/legend-spent.js';

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

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
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
};
const creationRules = {
  ...rules,
  homebrewFile: read('homebrew.json'),
  spellsFile: read('spells.json'),
  attributesFile: read('attributes.json'),
};
const catalog = rules.talentsFile.talents ?? rules.talentsFile;
const costs = rules.legendFile.costs;

const PICKER_KEYS = ['action', 'attribute', 'brief', 'detail', 'name', 'required'];
const DETAIL_KEYS = ['documented', 'effects', 'skillUse', 'strain', 'summary', 'tier', 'versus'];

const t1 = (name, rank = 1) => ({ name, rank, circle: 1 });
// Thief 4 + an empty seed Warrior (store-start-discipline.test.js fixture).
const kolonLike = () => ({
  schema: 'ed-character/2',
  meta: { name: 'Kolon' },
  attributes: {},
  resources: { legend: { totalEarnt: 50000 } },
  disciplines: [
    { name: 'Thief', circle: 4, talents: [t1('Lock Picking', 5)] },
    { name: 'Warrior', circle: 1, talents: [] },
  ],
  skills: [],
  knacks: [],
  items: [],
});
// Archer Circle 6 with only Missile Weapon: open option slots at Circles 1-6 (Novice and
// Journeyman pools), so the per-slot tier is exercised on more than one band.
const archer6 = () => ({
  schema: 'ed-character/2',
  meta: { name: 'Chakka' },
  attributes: {},
  resources: { legend: { totalEarnt: 500000 } },
  disciplines: [{ name: 'Archer', circle: 6, talents: [t1('Missile Weapon', 5)] }],
  skills: [],
  knacks: [],
  items: [],
});

const warriorCandidate = (model) => model.addableDisciplines.find((c) => c.discipline === 'Warrior');

// Asserts one PickerTalent against the catalog: keys, the catalog-derived fields, and the detail
// for the given Circle. `required` is the expected flag.
function assertPickerTalent(item, circle, required, where) {
  const msg = `${where}: ${item?.name}`;
  assert.deepEqual(Object.keys(item).sort(), PICKER_KEYS, `${msg} has exactly the PickerTalent keys`);
  assert.equal(typeof item.name, 'string', msg);
  assert.equal(item.required, required, `${msg} required`);
  const cat = catalog[item.name];
  if (!cat) {
    assert.equal(item.detail, null, `${msg} unknown name -> detail null`);
    return;
  }
  assert.equal(item.brief, cat.presentation?.shortEffect ?? null, `${msg} brief`);
  assert.equal(item.action, cat.action || null, `${msg} action`);
  assert.equal(item.attribute, cat.attribute || null, `${msg} attribute`);
  assert.ok(item.detail && typeof item.detail === 'object', `${msg} detail present`);
  assert.deepEqual(Object.keys(item.detail).sort(), DETAIL_KEYS, `${msg} detail keys (effects, no notes)`);
  assert.equal('notes' in item.detail, false, `${msg} detail.notes renamed`);
  assert.equal(item.detail.tier, tierForCircle(circle, costs), `${msg} tier for Circle ${circle}`);
  assert.deepEqual(item.detail.effects, (cat.effects || []).map((e) => e.summary).filter(Boolean), `${msg} effects`);
  assert.equal(item.detail.summary, cat.summary || null, `${msg} summary`);
  assert.equal(item.detail.versus, cat.versus || null, `${msg} versus`);
  assert.equal(item.detail.strain, cat.strain ?? null, `${msg} strain`);
  assert.deepEqual(item.detail.skillUse, cat.skillUse || null, `${msg} skillUse`);
  assert.equal(item.detail.documented, !!cat.summary, `${msg} documented`);
}

test('edit-mode option slots: every learnable is a PickerTalent with the slot-Circle tier', () => {
  memory.clear();
  const d = deriveModel(archer6(), rules).disciplines[0];
  const open = d.optionSlots.filter((s) => s.open && s.available);
  assert.ok(open.length >= 2, 'fixture has open slots');
  assert.ok(new Set(open.map((s) => tierForCircle(s.circle, costs))).size >= 2, 'fixture spans more than one tier band');
  for (const s of open) {
    assert.ok(s.learnable.length > 0, `Circle ${s.circle} has a pool`);
    for (const item of s.learnable) assertPickerTalent(item, s.circle, false, `slot ${s.circle}`);
  }
});

test('Add Discipline / Seed: grants stays string[]; grantItems parallels it with required: true', () => {
  memory.clear();
  const w = warriorCandidate(deriveModel(kolonLike(), rules));
  assert.ok(Array.isArray(w.grants) && w.grants.length > 0);
  assert.ok(
    w.grants.every((g) => typeof g === 'string'),
    'grants is still string[]',
  );
  assert.ok(Array.isArray(w.grantItems), 'grantItems added');
  assert.equal(w.grantItems.length, w.grants.length);
  assert.deepEqual(
    w.grantItems.map((g) => g.name),
    w.grants,
    'same names, same order',
  );
  for (const g of w.grantItems) assertPickerTalent(g, 1, true, 'grantItems');
});

test('Add Discipline / Seed: every candidate exposes grantItems matching grants', () => {
  memory.clear();
  const model = deriveModel(kolonLike(), rules);
  assert.ok(model.addableDisciplines.length > 1);
  for (const c of model.addableDisciplines) {
    assert.ok(Array.isArray(c.grantItems), `${c.discipline} grantItems`);
    assert.deepEqual(
      c.grantItems.map((g) => g.name),
      c.grants,
      `${c.discipline} grantItems names`,
    );
    assert.ok(
      c.grantItems.every((g) => g.required === true),
      `${c.discipline} grants required`,
    );
  }
});

test('Add Discipline / Seed: option pool items are PickerTalents with required: false, Circle-1 tier', () => {
  memory.clear();
  const w = warriorCandidate(deriveModel(kolonLike(), rules));
  assert.ok(w.optionPool.items.length > 0);
  for (const item of w.optionPool.items) assertPickerTalent(item, 1, false, 'optionPool');
});

test('Anticipate Blow (Warrior novice pool) carries its catalog effects, strain, action and attribute', () => {
  memory.clear();
  const w = warriorCandidate(deriveModel(kolonLike(), rules));
  const ab = w.optionPool.items.find((i) => i.name === 'Anticipate Blow');
  assert.ok(ab, 'Anticipate Blow is in the Warrior Circle 1 option pool');
  assert.deepEqual(ab.detail.effects, [
    "+2 Physical Defense vs that foe's attacks until end of round (per success).",
    '+2 per success to your first Attack test against the target.',
  ]);
  assert.equal('notes' in ab.detail, false);
  assert.equal(ab.detail.strain, 1);
  assert.equal(ab.action, 'Simple');
  assert.equal(ab.attribute, 'Perception');
  assert.equal(ab.required, false);
});

test('a catalog talent with no effect summaries gets effects: [] (not undefined)', () => {
  memory.clear();
  // Replace a Warrior pool talent's catalog entry with an effect-less one (like `Acting`).
  const tf = structuredClone(rules.talentsFile);
  const cat = tf.talents ?? tf;
  cat['Anticipate Blow'] = { name: 'Anticipate Blow', action: 'Sustain' };
  const w = warriorCandidate(deriveModel(kolonLike(), { ...rules, talentsFile: tf }));
  const ab = w.optionPool.items.find((i) => i.name === 'Anticipate Blow');
  assert.deepEqual(ab.detail.effects, []);
  assert.equal(ab.detail.strain, null);
  assert.equal(ab.brief, null);
  assert.equal(ab.action, 'Sustain');
  assert.equal(ab.attribute, null);
});

test('creation "+ add option": candidates are PickerTalents with the Circle-1 tier', () => {
  memory.clear();
  const c = buildNewCharacter({ name: 'Test Human Warrior', race: 'Human', discipline: 'Warrior' }, creationRules, {
    karmaMaxCap: null,
  });
  const status = deriveModel(c, creationRules).creation;
  assert.equal(status.open, true);
  const cands = status.talents.option.candidates;
  assert.ok(cands.length > 0, 'creation offers option candidates');
  for (const item of cands) assertPickerTalent(item, 1, false, 'creation candidate');
});

test('creation rows and Disciplines-tab rows: detail.effects is an array, notes is gone', () => {
  memory.clear();
  const c = buildNewCharacter({ name: 'Test Human Warrior', race: 'Human', discipline: 'Warrior' }, creationRules, {
    karmaMaxCap: null,
  });
  for (const r of deriveModel(c, creationRules).creation.talents.rows) {
    assert.ok(Array.isArray(r.detail.effects), `creation row ${r.name} effects`);
    assert.equal('notes' in r.detail, false, `creation row ${r.name} has no notes`);
  }
  const model = deriveModel(archer6(), rules);
  const rows = model.disciplines.flatMap((d) => d.talents ?? []).filter((t) => t.detail);
  assert.ok(rows.length > 0, 'fixture has Disciplines-tab rows with detail');
  for (const t of rows) {
    assert.ok(Array.isArray(t.detail.effects), `${t.name} effects`);
    assert.equal('notes' in t.detail, false, `${t.name} has no notes`);
    const cat = catalog[t.name];
    if (cat) assert.deepEqual(t.detail.effects, (cat.effects || []).map((e) => e.summary).filter(Boolean));
  }
});

test('a name missing from the catalog yields brief/action/attribute/detail all null', () => {
  memory.clear();
  const tf = structuredClone(rules.talentsFile);
  const cat = tf.talents ?? tf;
  delete cat['Anticipate Blow']; // Warrior Circle 1 option pool
  delete cat['Wood Skin']; // Warrior Circle 1 grant
  const model = deriveModel(kolonLike(), { ...rules, talentsFile: tf });
  const w = warriorCandidate(model);
  const expectOpt = {
    name: 'Anticipate Blow',
    required: false,
    brief: null,
    action: null,
    attribute: null,
    detail: null,
  };
  assert.deepEqual(
    w.optionPool.items.find((i) => i.name === 'Anticipate Blow'),
    expectOpt,
  );
  assert.deepEqual(
    w.grantItems.find((i) => i.name === 'Wood Skin'),
    {
      name: 'Wood Skin',
      required: true,
      brief: null,
      action: null,
      attribute: null,
      detail: null,
    },
  );
  assert.ok(w.grants.includes('Wood Skin'), 'grants unaffected by the catalog');
  // The seed Warrior's own open Circle 1 slot lists the same pool.
  const warrior = model.disciplines.find((d) => d.name === 'Warrior');
  const slotItem = warrior.optionSlots.flatMap((s) => s.learnable ?? []).find((i) => i.name === 'Anticipate Blow');
  assert.deepEqual(slotItem, expectOpt);
});

test('deriveModel writes nothing to the character for the picker enrichment', () => {
  memory.clear();
  const ch = kolonLike();
  const before = structuredClone(ch);
  deriveModel(ch, rules);
  assert.deepEqual(ch, before);
  const ar = archer6();
  const arBefore = structuredClone(ar);
  deriveModel(ar, rules);
  assert.deepEqual(ar, arBefore);
});
