// engine/air-sailor-data.test.js — run with `npm test` (node --test, no deps).
//
// add-airSailor: data-conformance of the Air Sailor Discipline (rules/disciplines.json) and its 33
// talents (rules/talents.json), plus the Circle-1 creation path. Expected values come from
// plans/add-airSailor/spec.md (Rules R1-R9, RULES-FAQ Q042); stored action strings are compared
// verbatim ("Sustain" vs "Sustained"). Expected to fail until the data is added.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildNewCharacter } from './new-character.js';
import { freeTalentRows } from './free-talents.js';

const read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)));
const disciplinesFile = read('disciplines.json');
const talentsFile = read('talents.json');
const racesFile = read('races.json');
const attributesFile = read('attributes.json');
const rules = { racesFile, disciplinesFile, attributesFile };

const DISC = disciplinesFile.disciplines.find((d) => d.name === 'Air Sailor');
const T = talentsFile.talents;
const circle = (n) => DISC?.circles.find((c) => c.circle === n);

const NOVICE_OPTS = ['Acrobatic Defense', 'Distract', 'First Impression', 'Great Leap', 'Haggle', 'Maneuver', 'Navigation', 'Speak Language', 'Taunt', 'Throwing Weapon'];
const JOURNEYMAN_OPTS = ['Air Speaking', 'Battle Bellow', 'Conceal Object', 'Engaging Banter', 'Etiquette', 'Graceful Exit', 'Leadership', 'Resist Taunt', 'Second Weapon', 'Surprise Strike'];
const DTS = {
  1: ['Avoid Blow', 'Climbing', 'Melee Weapon', 'Thread Weaving (Air Sailor)', 'Wind Catcher'],
  2: ['Awareness'],
  3: ['Empathic Sense'],
  4: ['Wound Balance'],
  5: ['Heartening Laugh'],
  6: ['Air Dance'],
  7: ['Inspire Others'],
  8: ['Lion Heart'],
};

// name -> [action (as stored), attribute, strain, skillUse.allowed, skillUse.tier]
const N = 'Novice';
const J = 'Journeyman';
const EXPECTED = {
  'Air Sailing': ['Sustain', 'Willpower', 0, true, N],
  'Climbing': ['Standard', 'Dexterity', 0, true, N],
  'Thread Weaving (Air Sailor)': ['Standard', 'Perception', 0, false],
  'Wind Catcher': ['Standard', 'Willpower', 1, false],
  'Empathic Sense': ['Standard', 'Charisma', 1, false],
  'Heartening Laugh': ['Simple', 'Charisma', 1, true, N],
  'Inspire Others': ['Standard', 'Charisma', 0, false],
  'Lion Heart': ['Free', 'Willpower', 1, false],
  'Acrobatic Defense': ['Simple', 'Dexterity', 1, true, N],
  'Distract': ['Simple', 'Charisma', 1, true, N],
  'Great Leap': ['Free', 'Dexterity', 1, true, N],
  'Maneuver': ['Simple', 'Dexterity', 1, true, N],
  'Navigation': ['Sustain', 'Perception', 0, true, N],
  'Speak Language': ['Standard', 'Perception', 1, false],
  'Taunt': ['Simple', 'Charisma', 1, true, N],
  'Air Speaking': ['Simple', 'Perception', 1, false],
  'Battle Bellow': ['Simple', 'Charisma', 1, true, J],
  'Etiquette': ['Sustain', 'Charisma', 0, true, N],
  'Graceful Exit': ['Standard', 'Charisma', 0, true, N],
  'Leadership': ['Sustain', 'Charisma', 0, true, J],
  'Resist Taunt': ['Free', 'Willpower', 1, true, J],
  'Second Weapon': ['Simple', 'Dexterity', 1, true, J],
  'Surprise Strike': ['Free', 'Strength', 1, true, N],
  // already-full entries (not edited by the feature; must still match Q042)
  'Air Dance': ['Free', 'Dexterity', 2, false],
  'Avoid Blow': ['Free', 'Dexterity', 1, true, N],
  'Awareness': ['Simple', 'Perception', 0],
  'Wound Balance': ['Free', 'Strength', 0],
  'Melee Weapon': ['Standard', 'Dexterity', 0],
  'Throwing Weapon': ['Standard', 'Dexterity', 0],
  'First Impression': ['Standard', 'Charisma', 0],
  'Haggle': ['Sustained', 'Charisma', 0],
  'Conceal Object': ['Standard', 'Dexterity', 1, true, J],
  'Engaging Banter': ['Standard', 'Charisma', 0, true, N],
};
// the 23 stubs that must be upgraded and carry presentation.shortEffect
const NEWLY_WRITTEN = Object.keys(EXPECTED).slice(0, 23);

const ALL_NAMES = [...new Set(['Air Sailing', ...Object.values(DTS).flat(), ...NOVICE_OPTS, ...JOURNEYMAN_OPTS])];

describe('Air Sailor discipline header (R1, R3, R6)', () => {
  test('exists, is first (alphabetical order), and keeps the file ordered', () => {
    assert.ok(DISC, 'Air Sailor entry present');
    const names = disciplinesFile.disciplines.map((d) => d.name);
    assert.equal(names[0], 'Air Sailor');
    assert.deepEqual(names, [...names].sort());
  });

  test('attributes, artisan skills, durability 5, summaries present (R1)', () => {
    assert.deepEqual(DISC.importantAttributes, ['Charisma', 'Dexterity', 'Willpower']);
    assert.deepEqual(DISC.artisanSkills, ['Rune Carving', 'Sail Embroidery']);
    assert.equal(DISC.durability, 5);
    assert.ok(DISC.karmaRitual && typeof DISC.karmaRitual.summary === 'string' && DISC.karmaRitual.summary.length > 0);
    assert.ok(DISC.halfMagic && typeof DISC.halfMagic.summary === 'string' && DISC.halfMagic.summary.length > 0);
  });

  test('talent option lists match exactly, in order (R3)', () => {
    assert.deepEqual(DISC.talentOptions.novice, NOVICE_OPTS);
    assert.deepEqual(DISC.talentOptions.journeyman, JOURNEYMAN_OPTS);
  });

  test('eight circles with the Discipline Talents per Circle (R2)', () => {
    assert.deepEqual(DISC.circles.map((c) => c.circle), [1, 2, 3, 4, 5, 6, 7, 8]);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.deepEqual(circle(n).talents, DTS[n], `circle ${n}`);
  });

  test('C1 has exactly one free talent, Air Sailing; no other circle has free talents (R1)', () => {
    assert.deepEqual(circle(1).freeTalents, ['Air Sailing']);
    for (let n = 2; n <= 8; n++) assert.ok(!circle(n).freeTalents || circle(n).freeTalents.length === 0, `circle ${n}`);
  });

  test('not a caster: no Spellcasting / matrices / Patterncraft anywhere; no spells key (R6)', () => {
    const banned = ['Spellcasting', 'Standard Matrix', 'Enhanced Matrix', 'Patterncraft'];
    const all = [
      ...DISC.circles.flatMap((c) => [...(c.talents ?? []), ...(c.freeTalents ?? [])]),
      ...DISC.talentOptions.novice,
      ...DISC.talentOptions.journeyman,
    ];
    for (const b of banned) assert.ok(!all.includes(b), b);
    assert.ok(!('spells' in DISC));
  });

  test('no talent repeats across circles, free talents and option lists', () => {
    const all = [
      ...DISC.circles.flatMap((c) => [...(c.talents ?? []), ...(c.freeTalents ?? [])]),
      ...DISC.talentOptions.novice,
      ...DISC.talentOptions.journeyman,
    ];
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.length, 33);
  });
});

describe('Air Sailor talents resolve and are fully written', () => {
  test('talents.json key count unchanged (456)', () => {
    assert.equal(Object.keys(T).length, 456);
  });

  test('every Air Sailor name resolves to a talents.json key (33 talents)', () => {
    assert.equal(ALL_NAMES.length, 33);
    for (const n of ALL_NAMES) assert.ok(T[n], `"${n}" in talents.json`);
  });

  test('the expected table covers exactly the 33 talents', () => {
    assert.deepEqual(Object.keys(EXPECTED).sort(), [...ALL_NAMES].sort());
  });

  for (const [name, [action, attribute, strain, allowed, skillTier]] of Object.entries(EXPECTED)) {
    test(`${name}: non-stub, action/attribute/strain/skillUse match Q042 (R4, R5)`, () => {
      const t = T[name];
      assert.ok(t, 'present');
      assert.equal(t.name, name);
      assert.equal(t.action, action);
      assert.equal(t.attribute, attribute);
      assert.equal(typeof t.strain, 'number');
      assert.equal(t.strain, strain);
      assert.equal(typeof t.summary, 'string');
      assert.ok(t.summary.trim().length > 0, 'summary');
      assert.equal(typeof t.skillUse, 'object');
      assert.ok(t.skillUse && typeof t.skillUse.allowed === 'boolean');
      if (allowed !== undefined) {
        assert.equal(t.skillUse.allowed, allowed);
        if (allowed) assert.equal(t.skillUse.tier, skillTier);
      }
      assert.ok(['Novice', 'Journeyman'].includes(t.tier), `tier ${t.tier}`);
      assert.ok(Array.isArray(t.effects) && t.effects.length > 0, 'effects non-empty');
      for (const e of t.effects) {
        assert.ok(e && typeof e.type === 'string' && typeof e.summary === 'string' && e.summary.length > 0);
        assert.equal(e.source, 'talent');
      }
    });
  }

  test('the 23 newly written talents carry presentation.shortEffect', () => {
    assert.equal(NEWLY_WRITTEN.length, 23);
    for (const n of NEWLY_WRITTEN) {
      const s = T[n].presentation?.shortEffect;
      assert.ok(typeof s === 'string' && s.trim().length > 0, n);
    }
  });
});

describe('Air Sailor circle effects (R2)', () => {
  const eff = (n) => circle(n).effects ?? [];
  const defense = (n, name, value) => {
    const e = eff(n).filter((x) => x.type === 'defense-modifier');
    assert.equal(e.length, 1, `circle ${n} defense effects`);
    assert.deepEqual(e[0].target, { domain: 'defense', name });
    assert.equal(e[0].operation, 'add');
    assert.equal(e[0].value, value);
    assert.equal(e[0].measure, 'rating');
    assert.equal(e[0].stacking, 'highest');
    assert.equal(e[0].source, 'discipline');
  };

  test('Physical Defense +1 / +2 / +3 at C2 / C6 / C8; Social +1 at C4', () => {
    defense(2, 'Physical', 1);
    defense(6, 'Physical', 2);
    defense(8, 'Physical', 3);
    defense(4, 'Social', 1);
  });

  test('C1: Action karma scoped to being on board an airship', () => {
    const k = eff(1).filter((x) => x.type === 'grant-karma-use');
    assert.equal(k.length, 1);
    assert.deepEqual(k[0].target, { domain: 'test', name: 'Action' });
    assert.equal(k[0].scope, 'on board an airship');
    assert.equal(k[0].source, 'discipline');
  });

  test('C3: Initiative karma, unscoped', () => {
    const k = eff(3).filter((x) => x.type === 'grant-karma-use');
    assert.equal(k.length, 1);
    assert.deepEqual(k[0].target, { domain: 'test', name: 'Initiative' });
    assert.ok(!('scope' in k[0]));
  });

  test('C5: Interaction-tests karma plus a Collaborate note', () => {
    const k = eff(5).filter((x) => x.type === 'grant-karma-use');
    assert.equal(k.length, 1);
    assert.deepEqual(k[0].target, { domain: 'test', name: 'Action' });
    assert.equal(k[0].scope, 'Interaction tests');
    const notes = eff(5).filter((x) => x.type === 'note');
    assert.ok(notes.some((x) => /Collaborate/.test(x.summary)), 'Collaborate note');
    assert.ok(notes.every((x) => x.source === 'discipline'));
  });

  test('C7: one additional Recovery test (mirrors Warrior C7)', () => {
    const e = eff(7);
    assert.equal(e.length, 1);
    assert.equal(e[0].type, 'characteristic-modifier');
    assert.deepEqual(e[0].target, { domain: 'characteristic', name: 'RecoveryTests' });
    assert.equal(e[0].operation, 'add');
    assert.equal(e[0].value, 1);
    assert.equal(e[0].measure, 'rating');
    assert.equal(e[0].source, 'discipline');
  });

  test('every effect uses only the taxonomy-v6 types the spec lists, and each has a summary', () => {
    const allowed = new Set(['grant-karma-use', 'defense-modifier', 'characteristic-modifier', 'note']);
    for (const c of DISC.circles) {
      for (const e of c.effects ?? []) {
        assert.ok(allowed.has(e.type), `circle ${c.circle}: ${e.type}`);
        assert.equal(e.source, 'discipline');
        assert.ok(typeof e.summary === 'string' && e.summary.length > 0);
      }
    }
  });

  test('both rules files keep effectTaxonomy v6', () => {
    assert.ok(disciplinesFile.effectTaxonomy.includes('(v6)'));
    assert.ok(talentsFile.effectTaxonomy.includes('(v6)'));
  });
});

describe('Air Sailor Circle-1 creation (R1, R6, R7, R8)', () => {
  const c = () => buildNewCharacter({ name: 'Test Sailor', race: 'Human', discipline: 'Air Sailor' }, rules);

  test('non-magician path: no spells block, no Grimoire item', () => {
    const ch = c();
    assert.ok(!('spells' in ch));
    assert.ok(!ch.items.some((i) => i.name === 'Grimoire'));
  });

  test('stores only Durability and Karma Ritual at Rank 1, Circle 1; free talent not stored', () => {
    const ch = c();
    assert.equal(ch.disciplines.length, 1);
    assert.equal(ch.disciplines[0].name, 'Air Sailor');
    assert.equal(ch.disciplines[0].circle, 1);
    assert.deepEqual(ch.disciplines[0].talents, [
      { name: 'Durability', rank: 1, circle: 1 },
      { name: 'Karma Ritual', rank: 1, circle: 1 },
    ]);
  });

  test('free talent Air Sailing is derived at Rank 1 (crew requirement)', () => {
    const rows = freeTalentRows(DISC, 1, new Set(['Durability', 'Karma Ritual']));
    assert.deepEqual(rows, [{ name: 'Air Sailing', rank: 1, circle: 1, free: true }]);
  });

  test('Durability comes from the discipline file (5)', () => {
    assert.equal(disciplinesFile.disciplines.find((d) => d.name === 'Air Sailor').durability, 5);
  });
});
