import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { learnableSkills } from './skill-options.js';
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

  test('empty known set yields near-full catalog', () => {
    const opts = learnableSkills(skillsFile.skills, new Set(), legendCosts);
    assert.equal(opts.length, skillsFile.skills.length);
  });

  test('handles missing tier as Novice', () => {
    const opts = learnableSkills([{ name: 'Custom Skill' }], new Set(), legendCosts);
    assert.equal(opts[0].tier, 'Novice');
    assert.equal(opts[0].rank1Cost, 200);
  });
});
