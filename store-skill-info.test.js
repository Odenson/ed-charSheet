// model.skillInfo: catalog descriptions by skill name for the picker rows' info icon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const read = (p) => JSON.parse(readFileSync(new URL('./rules/' + p, import.meta.url)));
const rules = {
  steps: read('steps.json').steps, talentsFile: read('talents.json'), disciplinesFile: read('disciplines.json'),
  racesFile: read('races.json'), characteristicsFile: read('characteristics.json'), itemsFile: read('items.json'),
  legendFile: read('legend.json'), skillsFile: read('skills.json'), knacksFile: read('knacks.json'),
  threadItemsFile: read('thread-items.json'), homebrewFile: read('homebrew.json'), spellsFile: read('spells.json'),
  attributesFile: read('attributes.json'),
};
const character = {
  schema: 'ed-character/1',
  meta: { name: 'Chakka' },
  attributes: {},
  resources: { legend: { totalEarnt: 10000 } },
  disciplines: [{ name: 'Archer', circle: 4, talents: [{ name: 'Missile Weapon', rank: 5, circle: 1 }] }],
  skills: [{ name: 'Tracking', rank: 3, tier: 'Novice' }],
  knacks: [],
  items: [],
};

test('skillInfo carries summary (and versus) for catalog skills, including the new Knowledge examples', () => {
  const m = deriveModel(character, rules, {});
  assert.ok(m.skillInfo['Barsaive History'].summary);
  assert.ok(m.skillInfo['Knowledge'].summary);
  assert.match(m.skillInfo['Trade Routes'].versus, /gamemaster/);
});

test('skillInfo includes custom skills and omits entries with no description', () => {
  const customSkillsFile = { schema: 'ed-skills/1', skills: [
    { name: 'Rope Dancing', category: 'general', tier: 1, strain: 0, attribute: 'Dexterity', summary: 'Dance on ropes.', custom: true },
    { name: 'Bare One', category: 'general', tier: 1, strain: 0, attribute: 'Dexterity', custom: true },
  ] };
  const m = deriveModel(character, { ...rules, customSkillsFile }, {});
  assert.equal(m.skillInfo['Rope Dancing'].summary, 'Dance on ropes.');
  assert.equal('Bare One' in m.skillInfo, false);
});
