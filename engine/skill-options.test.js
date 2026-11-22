import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { learnableSkills, resolveSkillName, learnSkillPlan, MAX_TEXT, isLanguage } from './skill-options.js';
import { payFromPurse } from './wealth.js';
import { readFileSync } from 'node:fs';

const legendCosts = JSON.parse(readFileSync(new URL('../rules/legend.json', import.meta.url), 'utf8')).costs;
const skillsFile = JSON.parse(readFileSync(new URL('../rules/skills.json', import.meta.url), 'utf8'));

describe('learnableSkills', () => {
  test('excludes already-known names', () => {
    const known = new Set(['Alchemy', 'Tracking']);
    const opts = learnableSkills(skillsFile.skills, known, legendCosts);
    assert.equal(opts.some((o) => o.name === 'Alchemy'), false);
    assert.equal(opts.some((o) => o.name === 'Tracking'), false);
    assert.ok(opts.length < skillsFile.skills.length);
  });

  test('includes tier/attribute/brief and rank1Cost from costs', () => {
    const opts = learnableSkills(skillsFile.skills, new Set(), legendCosts);
    const alchemy = opts.find((o) => o.name === 'Alchemy');
    assert.ok(alchemy);
    assert.equal(alchemy.tier, 'Novice');
    assert.equal(alchemy.tierNumeric, 1);
    assert.equal(alchemy.attribute, 'Perception');
    assert.ok(alchemy.brief);
    assert.equal(alchemy.rank1Cost, 200);
    assert.equal(alchemy.trainingSilver, 10);
    const aggressive = opts.find((o) => o.name === 'Aggressive Maneuver');
    assert.ok(aggressive);
    assert.equal(aggressive.tier, 'Journeyman');
    assert.equal(aggressive.rank1Cost, 300);
  });

  test('sorted Novice first then Journeyman, alphabetical within tier', () => {
    const opts = learnableSkills(skillsFile.skills, new Set(), legendCosts);
    let seenJourneyman = false;
    for (let i = 1; i < opts.length; i++) {
      const prev = opts[i - 1], cur = opts[i];
      if (cur.tier === 'Journeyman') seenJourneyman = true;
      if (prev.tier === 'Journeyman' && cur.tier === 'Novice') assert.fail('Novice after Journeyman');
      if (prev.tier === cur.tier) assert.ok(prev.name.localeCompare(cur.name) <= 0, `${prev.name} should be <= ${cur.name}`);
    }
    assert.ok(seenJourneyman);
  });

  test('costs absent yields null rank1Cost/trainingSilver (placeholder)', () => {
    const opts = learnableSkills(skillsFile.skills.slice(0, 2), new Set(), null);
    assert.equal(opts[0].rank1Cost, null);
    assert.equal(opts[0].trainingSilver, null);
  });

  test('empty known set yields the catalog minus duplicates and language templates', () => {
    const opts = learnableSkills(skillsFile.skills, new Set(), legendCosts);
    const uniq = new Set(skillsFile.skills.map((s) => s.name));
    const templates = new Set(skillsFile.skills.filter((s) => s.generic && isLanguage(s.category)).map((s) => s.name));
    assert.equal(opts.length, uniq.size - templates.size);
  });

  test('handles missing tier as Novice', () => {
    const opts = learnableSkills([{ name: 'Custom Skill' }], new Set(), legendCosts);
    assert.equal(opts[0].tier, 'Novice');
    assert.equal(opts[0].rank1Cost, 200);
  });
});

const CAT = [
  { name: 'Knowledge', category: 'knowledge', generic: true, tier: 1 },
  { name: 'Artisan', category: 'artisan', generic: true, tier: 1 },
  { name: 'Speak Language', category: 'language-speak', generic: true, tier: 1 },
  { name: 'Read/Write Language', category: 'language-readwrite', generic: true, tier: 1 },
  { name: 'Speak Language (Elf)', category: 'language-speak', tier: 1 },
  { name: 'Bribery', category: 'general', tier: 1 },
  { name: 'Bribery', category: 'general', tier: 1 },
  { name: 'Alchemy', category: 'general', tier: 1 },
  { name: 'Fancy Footwork', category: 'general', tier: 2 },
];
const entry = (n) => CAT.find((e) => e.name === n);

describe('resolveSkillName', () => {
  test('exports MAX_TEXT = 40 and isLanguage', () => {
    assert.equal(MAX_TEXT, 40);
    assert.equal(isLanguage('language-speak'), true);
    assert.equal(isLanguage('language-readwrite'), true);
    assert.equal(isLanguage('knowledge'), false);
  });
  test('composes and trims generic names', () => {
    assert.deepEqual(resolveSkillName(entry('Knowledge'), '  Barsaive History ', []), { ok: true, storedName: 'Knowledge (Barsaive History)' });
    assert.deepEqual(resolveSkillName(entry('Artisan'), 'Tanning', []), { ok: true, storedName: 'Artisan (Tanning)' });
  });
  test('text length 40 ok, 41 bad', () => {
    assert.equal(resolveSkillName(entry('Knowledge'), 'a'.repeat(40), []).ok, true);
    assert.deepEqual(resolveSkillName(entry('Knowledge'), 'a'.repeat(41), []), { ok: false, reason: 'bad-text' });
  });
  test('empty, whitespace and parentheses are bad-text', () => {
    for (const t of ['', '   ', undefined, 'a(b', 'a)b', '(x)']) {
      assert.deepEqual(resolveSkillName(entry('Knowledge'), t, []), { ok: false, reason: 'bad-text' }, String(t));
    }
  });
  test('language templates refused', () => {
    assert.deepEqual(resolveSkillName(entry('Speak Language'), 'Elf', []), { ok: false, reason: 'generic-not-allowed' });
    assert.deepEqual(resolveSkillName(entry('Read/Write Language'), 'Elf', []), { ok: false, reason: 'generic-not-allowed' });
  });
  test('non-generic ignores text', () => {
    assert.deepEqual(resolveSkillName(entry('Alchemy'), 'junk(', []), { ok: true, storedName: 'Alchemy' });
    assert.deepEqual(resolveSkillName(entry('Speak Language (Elf)'), '', []), { ok: true, storedName: 'Speak Language (Elf)' });
  });
  test('unknown entry', () => {
    assert.deepEqual(resolveSkillName(undefined, 'x', []), { ok: false, reason: 'unknown-skill' });
  });
  test('duplicate is case-insensitive (array or Set)', () => {
    assert.deepEqual(resolveSkillName(entry('Knowledge'), 'X', ['knowledge (x)']), { ok: false, reason: 'duplicate' });
    assert.deepEqual(resolveSkillName(entry('Alchemy'), '', new Set(['ALCHEMY'])), { ok: false, reason: 'duplicate' });
    assert.equal(resolveSkillName(entry('Knowledge'), 'Y', ['Knowledge (X)']).ok, true);
  });
});

describe('learnableSkills (skill model)', () => {
  const opts = learnableSkills(CAT, new Set(), legendCosts);
  const by = (n) => opts.filter((o) => o.name === n);
  test('freeText / generic / category fields', () => {
    assert.equal(by('Knowledge')[0].freeText, 'knowledge');
    assert.equal(by('Artisan')[0].freeText, 'artisan');
    assert.equal(by('Knowledge')[0].generic, true);
    assert.equal(by('Knowledge')[0].category, 'knowledge');
    assert.equal(by('Alchemy')[0].freeText, null);
    assert.equal(by('Alchemy')[0].generic, false);
    assert.equal(by('Alchemy')[0].category, 'general');
  });
  test('language templates absent, per-language present', () => {
    assert.equal(by('Speak Language').length, 0);
    assert.equal(by('Read/Write Language').length, 0);
    assert.equal(by('Speak Language (Elf)').length, 1);
  });
  test('duplicate catalog names appear once', () => {
    assert.equal(by('Bribery').length, 1);
    const real = learnableSkills(skillsFile.skills, new Set(), legendCosts);
    assert.equal(real.filter((o) => o.name === 'Skinning').length, 1);
    assert.equal(real.filter((o) => o.name === 'Bribery').length, 1);
  });
  test('known ordinary and per-language names hidden, case-insensitively', () => {
    const o = learnableSkills(CAT, new Set(['alchemy', 'SPEAK LANGUAGE (ELF)']), legendCosts);
    assert.equal(o.some((x) => x.name === 'Alchemy'), false);
    assert.equal(o.some((x) => x.name === 'Speak Language (Elf)'), false);
  });
  test('known Knowledge (X) does not hide the free-text row', () => {
    const o = learnableSkills(CAT, ['Knowledge (X)', 'Artisan (Y)', 'Knowledge'], legendCosts);
    assert.equal(o.some((x) => x.name === 'Knowledge'), true);
    assert.equal(o.some((x) => x.name === 'Artisan'), true);
  });
  test('Journeyman general retained at Journeyman price', () => {
    const j = by('Fancy Footwork')[0];
    assert.equal(j.tier, 'Journeyman');
    assert.equal(j.rank1Cost, legendCosts.skillRank['1'].Journeyman);
    assert.ok(opts.indexOf(j) > opts.indexOf(by('Alchemy')[0]));
  });
});

describe('learnSkillPlan', () => {
  const base = { catalog: CAT, costs: legendCosts, character: { skills: [] }, coins: { silver: 50 } };
  test('free-text Knowledge: rank 1 Novice, legendCost, fee', () => {
    const p = learnSkillPlan({ ...base, name: 'Knowledge', text: 'Barsaive History', silver: 10 });
    assert.equal(p.ok, true);
    assert.deepEqual(p.skill, { name: 'Knowledge (Barsaive History)', rank: 1, tier: 'Novice' });
    assert.equal(p.tier, 'Novice');
    assert.equal(p.legendCost, legendCosts.skillRank['1'].Novice);
    assert.equal(p.trainingFee, 10);
    assert.deepEqual(p.coins, payFromPurse({ silver: 50 }, 10).coins);
  });
  test('ordinary skill with no fee leaves coins unchanged', () => {
    const p = learnSkillPlan({ ...base, name: 'Alchemy', silver: 0 });
    assert.equal(p.ok, true);
    assert.equal(p.skill.name, 'Alchemy');
    assert.equal(p.trainingFee, 0);
    assert.deepEqual(p.coins, { silver: 50 });
  });
  test('negative or non-numeric silver means fee 0; fractions round', () => {
    for (const s of [-5, 'abc', undefined, NaN]) {
      assert.equal(learnSkillPlan({ ...base, name: 'Alchemy', silver: s }).trainingFee, 0, String(s));
    }
    assert.equal(learnSkillPlan({ ...base, name: 'Alchemy', silver: 2.6 }).trainingFee, 3);
  });
  test('Journeyman General priced Journeyman', () => {
    const p = learnSkillPlan({ ...base, name: 'Fancy Footwork', silver: 0 });
    assert.equal(p.ok, true);
    assert.equal(p.tier, 'Journeyman');
    assert.equal(p.skill.tier, 'Journeyman');
    assert.equal(p.legendCost, legendCosts.skillRank['1'].Journeyman);
  });
  test('refusals', () => {
    const r = (o) => learnSkillPlan({ ...base, silver: 0, ...o });
    assert.deepEqual(r({ name: 'Nope' }), { ok: false, reason: 'unknown-skill' });
    assert.equal(r({ name: 'Knowledge', text: '' }).reason, 'bad-text');
    assert.equal(r({ name: 'Knowledge', text: 'a(b' }).reason, 'bad-text');
    assert.equal(r({ name: 'Speak Language', text: 'Elf' }).reason, 'generic-not-allowed');
    assert.equal(r({ name: 'Alchemy', character: { skills: [{ name: 'alchemy', rank: 1, tier: 'Novice' }] } }).reason, 'duplicate');
    assert.equal(r({ name: 'Knowledge', text: 'x', character: { skills: [{ name: 'KNOWLEDGE (X)', rank: 1, tier: 'Novice' }] } }).reason, 'duplicate');
    assert.deepEqual(r({ name: 'Alchemy', silver: 10, coins: { silver: 5 } }), { ok: false, reason: 'insufficient-silver' });
  });
  test('is pure: inputs not mutated', () => {
    const character = { skills: [] };
    const coins = { silver: 50 };
    learnSkillPlan({ ...base, character, coins, name: 'Alchemy', silver: 10 });
    assert.deepEqual(character, { skills: [] });
    assert.deepEqual(coins, { silver: 50 });
  });
});
