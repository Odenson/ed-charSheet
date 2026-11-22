// store-custom-skills-catalog.test.js — run with `npm test` (node --test, no deps).
// Custom skills as catalog entries (plans/gen-skill-other I2, I6):
//   mergeSkillCatalog, the `custom` flag on learnableSkills / creation candidates /
//   model.skills, deriveModel step + attribute for a custom skill, creationContext,
//   and the strict `skills.allowCustom` homebrew gate (model.customSkills.enabled).
// Rules: R3 (Step = Rank + attribute Step), R2 (tier prints per skill; costs from
// rules/legend.json, never hard-coded here), R4 (custom General Journeyman allowed;
// creation offers Novice only — existing engine gate).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from './store.js';
import { learnableSkills } from './engine/skill-options.js';
import { buildNewCharacter } from './engine/new-character.js';
import { skillBudget } from './engine/creation.js';

const { deriveModel, mergeSkillCatalog } = store;
const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const baseRules = () => ({
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
  spellsFile: read('spells.json'),
  attributesFile: read('attributes.json'),
});

const LORE = { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', summary: 'Tunnels and ore.', custom: true };
const BARE = { name: 'Plain Craft', category: 'artisan', tier: 1, strain: 0, attribute: 'Charisma', custom: true };
const NOVICE_GEN = { name: 'Rope Dancing', category: 'general', tier: 1, strain: 0, attribute: 'Dexterity', custom: true };
const JOURNEY_GEN = { name: 'Sky Surfing', category: 'general', tier: 2, strain: 0, attribute: 'Willpower', custom: true };
const customFile = (skills) => ({ schema: 'ed-skills/1', source: 'custom', notes: '', skills });

// --- mergeSkillCatalog ---------------------------------------------------------------

test('mergeSkillCatalog: no custom file returns the core file itself', () => {
  const core = read('skills.json');
  assert.equal(mergeSkillCatalog(core, undefined), core);
  assert.equal(mergeSkillCatalog(core, null), core);
  assert.equal(mergeSkillCatalog(core, customFile([])), core);
  assert.equal(mergeSkillCatalog(core, {}), core);
});

test('mergeSkillCatalog: core elements keep their identity; custom entries follow, as given', () => {
  const core = read('skills.json');
  const merged = mergeSkillCatalog(core, customFile([LORE, NOVICE_GEN]));
  assert.equal(merged.skills.length, core.skills.length + 2);
  core.skills.forEach((s, i) => assert.equal(merged.skills[i], s, `core[${i}] is the same reference`));
  assert.deepEqual(merged.skills.slice(-2), [LORE, NOVICE_GEN], 'custom entries unchanged, nothing added');
  assert.equal(merged.schema, core.schema, 'other file fields carried over');
  assert.equal(core.skills.length, read('skills.json').skills.length, 'core file not mutated');
});

test('mergeSkillCatalog: core wins on a name collision (case-insensitive)', () => {
  const core = read('skills.json');
  const coreName = core.skills.find((s) => s.category === 'general').name;
  const clash = { ...NOVICE_GEN, name: coreName.toUpperCase() };
  const clashExact = { ...NOVICE_GEN, name: 'Knowledge' };
  const merged = mergeSkillCatalog(core, customFile([clash, clashExact, LORE]));
  assert.equal(merged.skills.length, core.skills.length + 1, 'both colliding customs dropped');
  assert.equal(merged.skills.at(-1), LORE);
});

// --- learnableSkills `custom` flag -------------------------------------------------------

test('learnableSkills: custom option carries custom:true; core options have no custom key at all', () => {
  const core = read('skills.json');
  const costs = read('legend.json').costs;
  const merged = mergeSkillCatalog(core, customFile([LORE, JOURNEY_GEN]));
  const opts = learnableSkills(merged.skills, new Set(), costs);
  const lore = opts.find((o) => o.name === LORE.name);
  assert.equal(lore.custom, true);
  assert.equal(lore.attribute, 'Perception');
  assert.equal(lore.brief, 'Tunnels and ore.');
  assert.equal(lore.rank1Cost, costs.skillRank['1'].Novice, 'Novice cost comes from legend.json (R2)');
  const sky = opts.find((o) => o.name === JOURNEY_GEN.name);
  assert.equal(sky.custom, true);
  assert.equal(sky.tier, 'Journeyman');
  assert.equal(sky.rank1Cost, costs.skillRank['1'].Journeyman, 'Journeyman cost comes from legend.json (R2)');
  for (const o of opts.filter((x) => !x.custom)) assert.equal('custom' in o, false, `${o.name} has no custom key`);
});

test('learnableSkills: a custom skill with no description has a null brief (no fabricated text)', () => {
  const merged = mergeSkillCatalog(read('skills.json'), customFile([BARE]));
  const opt = learnableSkills(merged.skills, new Set(), read('legend.json').costs).find((o) => o.name === BARE.name);
  assert.equal(opt.brief, null);
});

test('learnableSkills: an already-held custom skill is not offered again', () => {
  const merged = mergeSkillCatalog(read('skills.json'), customFile([LORE]));
  const opts = learnableSkills(merged.skills, new Set([LORE.name]), read('legend.json').costs);
  assert.equal(opts.some((o) => o.name === LORE.name), false);
});

// --- creationContext + creation candidates ----------------------------------------------

const creationChar = () => buildNewCharacter({ name: 'T', race: 'Human', discipline: 'Archer' }, baseRules(), { karmaMaxCap: null });

test('creationContext: skillCatalog and resolveSkill include custom skills', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([LORE]) };
  const ctx = store.creationContext(rules, creationChar(), 5);
  assert.ok(ctx.skillCatalog.some((s) => s.name === LORE.name && s.custom === true));
  assert.equal(ctx.resolveSkill(LORE.name).attribute, 'Perception');
});

test('creationContext: no custom file leaves the catalog exactly the core list', () => {
  const rules = baseRules();
  const ctx = store.creationContext(rules, creationChar(), 5);
  assert.deepEqual(ctx.skillCatalog, rules.skillsFile.skills);
});

test('creation candidates: Novice custom skills appear with custom:true; core candidates carry no custom key', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([LORE, NOVICE_GEN]) };
  const c = creationChar();
  const { candidates } = skillBudget(c, store.creationContext(rules, c, 5));
  const lore = candidates.find((x) => x.name === LORE.name);
  const gen = candidates.find((x) => x.name === NOVICE_GEN.name);
  assert.equal(lore?.custom, true);
  assert.equal(gen?.custom, true);
  assert.equal(lore.attribute, 'Perception');
  for (const x of candidates.filter((k) => k.name !== LORE.name && k.name !== NOVICE_GEN.name)) {
    assert.equal('custom' in x, false, `${x.name} has no custom key`);
  }
});

test('creation candidates: a Journeyman custom General skill is NOT offered (Novice-only gate, R2)', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([JOURNEY_GEN]) };
  const c = creationChar();
  const { candidates } = skillBudget(c, store.creationContext(rules, c, 5));
  assert.equal(candidates.some((x) => x.name === JOURNEY_GEN.name), false);
});

// --- deriveModel -------------------------------------------------------------------------

const character = (skills) => ({
  schema: 'ed-character/1',
  meta: { name: 'Test', race: 'Human' },
  attributes: { Strength: { base: 15 }, Dexterity: { base: 15 }, Willpower: { base: 14 }, Perception: { base: 13 }, Charisma: { base: 12 }, Toughness: { base: 12 } },
  resources: { legend: { totalEarnt: 5000, totalSpent: 0 } },
  disciplines: [],
  skills,
  knacks: [],
  items: [],
});
const stepOf = (model, attr) => model.attributes.find((a) => a.name === attr).step;

test('deriveModel: a held custom skill resolves with its own attribute, Step = Rank + attribute Step (R3), description and custom:true', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([LORE]) };
  const model = deriveModel(character([{ name: LORE.name, rank: 3, tier: 'Novice' }]), rules);
  const row = model.skills.find((s) => s.name === LORE.name);
  assert.equal(row.known, true);
  assert.equal(row.attribute, 'Perception');
  assert.equal(row.step, stepOf(model, 'Perception') + 3);
  assert.equal(row.custom, true);
  assert.equal(row.detail.summary, 'Tunnels and ore.');
  assert.equal(row.detail.strain, 0);
});

test('deriveModel: a custom skill without a description shows no summary (documented:false)', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([BARE]) };
  const row = deriveModel(character([{ name: BARE.name, rank: 1, tier: 'Novice' }]), rules).skills[0];
  assert.equal(row.known, true);
  assert.equal(row.brief, null);
  assert.equal(row.detail.summary, null);
  assert.equal(row.detail.documented, false);
});

test('deriveModel: core skill rows have no custom key; the stored character skill is untouched', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([LORE]) };
  const ch = character([{ name: 'Alchemy', rank: 1, tier: 'Novice' }, { name: LORE.name, rank: 2, tier: 'Novice' }]);
  const before = JSON.stringify(ch);
  const model = deriveModel(ch, rules);
  assert.equal('custom' in model.skills.find((s) => s.name === 'Alchemy'), false);
  assert.equal(JSON.stringify(ch), before, 'character not mutated');
  assert.deepEqual(Object.keys(ch.skills[1]).sort(), ['name', 'rank', 'tier'], 'stored shape stays {name, rank, tier}');
});

test('deriveModel: a held custom skill whose entry is gone degrades to unknown (known:false)', () => {
  const model = deriveModel(character([{ name: LORE.name, rank: 1, tier: 'Novice' }]), baseRules());
  const row = model.skills[0];
  assert.equal(row.known, false);
  assert.equal(row.step, null);
});

test('deriveModel: skillOptions include custom skills flagged custom:true', () => {
  const rules = { ...baseRules(), customSkillsFile: customFile([LORE, JOURNEY_GEN]) };
  const model = deriveModel(character([]), rules);
  assert.equal(model.skillOptions.find((o) => o.name === LORE.name)?.custom, true);
  assert.equal(model.skillOptions.find((o) => o.name === JOURNEY_GEN.name)?.tier, 'Journeyman');
});

test('deriveModel: no custom file behaves exactly as before (no custom keys anywhere)', () => {
  const model = deriveModel(character([{ name: 'Alchemy', rank: 1, tier: 'Novice' }]), baseRules());
  assert.ok(model.skillOptions.every((o) => !('custom' in o)));
  assert.ok(model.skills.every((s) => !('custom' in s)));
});

// --- homebrew gate: skills.allowCustom -----------------------------------------------------

const hb = (value, enabled = true) => ({
  schema: 'ed-homebrew/3',
  rules: [{ id: 'hb-custom-skills', name: 'Custom skills', summary: 'x', enabled, set: { 'skills.allowCustom': value } }],
});
const enabledFor = (homebrewFile) => deriveModel(character([]), { ...baseRules(), homebrewFile }).customSkills.enabled;

test('HOMEBREW_SET_TARGETS registers skills.allowCustom', () => {
  assert.ok(store.HOMEBREW_SET_TARGETS.has('skills.allowCustom'));
});

test('model.customSkills.enabled is true only for a strict boolean true on an enabled rule', () => {
  assert.equal(enabledFor(hb(true)), true);
  assert.equal(enabledFor(hb(false)), false);
  assert.equal(enabledFor(hb('true')), false);
  assert.equal(enabledFor(hb(1)), false);
  assert.equal(enabledFor(hb(true, false)), false, 'disabled rule');
  assert.equal(enabledFor(undefined), false, 'no homebrew file');
  assert.equal(enabledFor({ schema: 'ed-homebrew/3', rules: [] }), false, 'rule absent');
});

test('the real shipped homebrew file enables custom skills', () => {
  assert.equal(enabledFor(read('homebrew.json')), true);
});

test('toggle off does not hide existing custom skills (they still resolve)', () => {
  const rules = { ...baseRules(), homebrewFile: hb(false), customSkillsFile: customFile([LORE]) };
  const model = deriveModel(character([{ name: LORE.name, rank: 1, tier: 'Novice' }]), rules);
  assert.equal(model.customSkills.enabled, false);
  assert.equal(model.skills[0].known, true);
  assert.equal(model.skills[0].custom, true);
});
