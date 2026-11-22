// engine/validate-skill.test.js — run with `npm test` (node --test, no deps).
// Shared custom-skill validator (plans/gen-skill-other I1): used by the UI form, the
// worker and the CI fold. Rules: R1 (Knowledge/Artisan Novice, Strain 0), R4 (General:
// owner-chosen attribute, Novice or Journeyman — owner house rule 2026-11-22).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSkill, validateSkillsFile, SKILL_KINDS, MAX_DESCRIPTION } from './validate-skill.js';

const ATTRS = ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'];
const CORE = ['Acrobatic Defense', 'Knowledge', 'Artisan', 'Alchemy'];
const OPTS = { coreNames: CORE, attributeNames: ATTRS, customNames: [] };

const knowledge = (over = {}) => ({ name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true, ...over });
const artisan = (over = {}) => ({ name: 'Glass Blowing', category: 'artisan', tier: 1, strain: 0, attribute: 'Charisma', custom: true, ...over });
const general = (over = {}) => ({ name: 'Rope Dancing', category: 'general', tier: 1, strain: 0, attribute: 'Dexterity', custom: true, ...over });

const check = (skill, opts = OPTS, name = skill.name) => validateSkill(name, skill, opts);
const bad = (skill, opts, name) => {
  const r = check(skill, opts, name);
  assert.equal(r.ok, false, JSON.stringify(skill) + ' should be rejected');
  assert.ok(Array.isArray(r.errors) && r.errors.length > 0, 'errors explain the rejection');
  return r;
};

test('constants: three kinds and a 500-char description cap', () => {
  assert.deepEqual(SKILL_KINDS, ['knowledge', 'artisan', 'general']);
  assert.equal(MAX_DESCRIPTION, 500);
});

test('valid minimal entries pass for every kind (summary optional)', () => {
  for (const s of [knowledge(), artisan(), general()]) {
    const r = check(s);
    assert.equal(r.ok, true, r.errors.join('; '));
    assert.deepEqual(r.errors, []);
  }
});

test('valid full entry (with description) passes', () => {
  const r = check(general({ tier: 2, summary: 'Walk a rope strung between rooftops.' }));
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('name: empty and whitespace-only are rejected', () => {
  bad(knowledge({ name: '' }), OPTS, '');
  bad(knowledge({ name: '   ' }), OPTS, '   ');
});

test('name: 40 chars is the limit (R: matches resolveSkillName), 41 is rejected', () => {
  const ok40 = 'a'.repeat(40);
  assert.equal(check(knowledge({ name: ok40 }), OPTS, ok40).ok, true);
  const n41 = 'a'.repeat(41);
  bad(knowledge({ name: n41 }), OPTS, n41);
});

test('name: parentheses are rejected (would collide with the "Name (text)" stored form)', () => {
  for (const n of ['Lore (Dwarves)', 'Lore (', 'Lore )', ') Lore']) {
    bad(knowledge({ name: n }), OPTS, n);
  }
});

test('name: key must equal skill.name', () => {
  bad(knowledge({ name: 'Other Name' }), OPTS, 'Dwarven Mining Lore');
});

test('uniqueness vs core names is case-insensitive (incl. the generic Knowledge/Artisan templates)', () => {
  for (const n of ['Acrobatic Defense', 'acrobatic defense', 'ACROBATIC DEFENSE', 'Knowledge', 'artisan']) {
    bad(general({ name: n }), OPTS, n);
  }
});

test('uniqueness vs existing custom names is case-insensitive', () => {
  const opts = { ...OPTS, customNames: ['Rope Dancing'] };
  bad(general(), opts);
  bad(general({ name: 'rope dancing' }), opts, 'rope dancing');
});

test('attribute must be one of attributeNames', () => {
  bad(knowledge({ attribute: 'Luck' }));
  bad(knowledge({ attribute: '' }));
  bad(knowledge({ attribute: undefined }));
  bad(knowledge({ attribute: 'perception' }));
});

test('category must be one of the three kinds', () => {
  bad(knowledge({ category: 'language-speak' }));
  bad(knowledge({ category: 'spell' }));
  bad(knowledge({ category: undefined }));
});

test('tier: Knowledge and Artisan are Novice (1) only (R1)', () => {
  bad(knowledge({ tier: 2 }));
  bad(artisan({ tier: 2 }));
  bad(knowledge({ tier: 0 }));
  bad(knowledge({ tier: '1' }));
});

test('tier: General may be Novice (1) or Journeyman (2), nothing else (R4)', () => {
  assert.equal(check(general({ tier: 1 })).ok, true);
  assert.equal(check(general({ tier: 2 })).ok, true);
  bad(general({ tier: 3 }));
  bad(general({ tier: 0 }));
  bad(general({ tier: 'Novice' }));
});

test('strain must be 0 (R1)', () => {
  bad(knowledge({ strain: 1 }));
  bad(knowledge({ strain: undefined }));
});

test('custom must be exactly true', () => {
  bad(knowledge({ custom: false }));
  bad(knowledge({ custom: undefined }));
  bad(knowledge({ custom: 'true' }));
});

test('summary: optional string up to MAX_DESCRIPTION; longer or non-string rejected', () => {
  assert.equal(check(knowledge({ summary: 'x'.repeat(MAX_DESCRIPTION) })).ok, true);
  bad(knowledge({ summary: 'x'.repeat(MAX_DESCRIPTION + 1) }));
  bad(knowledge({ summary: 42 }));
});

test('unknown keys are rejected (the worker endpoint is public)', () => {
  bad(knowledge({ action: 'Standard' }));
  bad(knowledge({ effects: [] }));
  bad(knowledge({ versus: 'x' }));
  bad(knowledge({ presentation: {} }));
  bad(knowledge({ artisanKey: 'x' }));
  bad(knowledge({ extra: 1 }));
});

test('non-object entries are rejected', () => {
  for (const s of [null, undefined, 'skill', 7, [], true]) bad(s, OPTS, 'Whatever');
});

test('options absent: attribute and uniqueness checks are skipped, shape checks stay', () => {
  assert.equal(validateSkill('Acrobatic Defense', general({ name: 'Acrobatic Defense', attribute: 'Luck' })).ok, true);
  assert.equal(validateSkill('Acrobatic Defense', general({ name: 'Acrobatic Defense' }), {}).ok, true);
  assert.equal(validateSkill('X', knowledge({ name: 'X', tier: 2 })).ok, false, 'tier rule still applies');
});

test('never mutates its input', () => {
  const s = Object.freeze(knowledge({ summary: 'ok' }));
  const opts = Object.freeze({ coreNames: Object.freeze([...CORE]), attributeNames: Object.freeze([...ATTRS]), customNames: Object.freeze([]) });
  assert.doesNotThrow(() => validateSkill(s.name, s, opts));
});

// --- whole-file check ----------------------------------------------------------

const file = (skills, over = {}) => ({ schema: 'ed-skills/1', source: 'custom', notes: '', skills, ...over });

test('validateSkillsFile: empty file and a valid file pass', () => {
  assert.equal(validateSkillsFile(file([]), OPTS).ok, true);
  const r = validateSkillsFile(file([knowledge(), artisan(), general({ tier: 2 })]), OPTS);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateSkillsFile: wrong or missing schema tag fails', () => {
  assert.equal(validateSkillsFile(file([], { schema: 'ed-skills/2' }), OPTS).ok, false);
  assert.equal(validateSkillsFile(file([], { schema: undefined }), OPTS).ok, false);
  assert.equal(validateSkillsFile(file([], { schema: 'ed-items/3' }), OPTS).ok, false);
});

test('validateSkillsFile: skills must be an array', () => {
  assert.equal(validateSkillsFile(file(undefined), OPTS).ok, false);
  assert.equal(validateSkillsFile(file({}), OPTS).ok, false);
  assert.equal(validateSkillsFile(null, OPTS).ok, false);
});

test('validateSkillsFile: one invalid entry fails the file with an error', () => {
  const r = validateSkillsFile(file([knowledge(), general({ attribute: 'Luck' })]), OPTS);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('validateSkillsFile: duplicate names fail (exact and case-variant)', () => {
  assert.equal(validateSkillsFile(file([knowledge(), knowledge()]), OPTS).ok, false);
  assert.equal(validateSkillsFile(file([knowledge(), knowledge({ name: 'dwarven mining lore' })]), OPTS).ok, false);
});

test('validateSkillsFile: a core-name collision fails the file', () => {
  assert.equal(validateSkillsFile(file([general({ name: 'Alchemy' })]), OPTS).ok, false);
});
