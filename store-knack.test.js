// store-knack.test.js — run with `npm test` (node --test, no deps).
// Covers resolveKnack: the single place a knack is turned into a structured object,
// resolving against the rules/knacks.json catalog with a legacy-string fallback.
// Also covers the knackParents homebrew lever (ed-homebrew/3 §5.6) wiring in
// deriveModel: when an enabled rule declares `knackParents: true`, the character's
// owned skills govern knacks (`skillKnackEnabled`, skill-parented candidates), and
// the talent-only default holds when the lever is absent/disabled.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveKnack, deriveModel } from './store.js';

const realCatalog = JSON.parse(readFileSync(new URL('./rules/knacks.json', import.meta.url))).knacks;

const catalog = {
  Hunting: { parents: ['Tracking'], requiredRank: 3, action: 'Sustained', summary: 'Bring down game.' },
  'Thread Weaving': {
    parents: ['Elementalism', 'Nethermancy'],
    requiredRank: 5,
  },
};
const skillNames = new Set(['Tracking']);
const talentNames = new Set();

test('resolveKnack pulls fixed rules from the catalog', () => {
  const k = resolveKnack({ name: 'Hunting' }, catalog, skillNames);
  assert.equal(k.known, true);
  assert.deepEqual(k.parent, { type: 'skill', name: 'Tracking' });
  assert.equal(k.requiredRank, 3);
  assert.equal(k.action, 'Sustained');
  assert.equal(k.detail.documented, true);
});

test('resolveKnack picks the parent named by `via` when several exist', () => {
  const k = resolveKnack({ name: 'Thread Weaving', via: 'Nethermancy' }, catalog, skillNames);
  assert.deepEqual(k.parent, { type: 'talent', name: 'Nethermancy' });
  // Without `via`, it defaults to the first listed parent.
  const d = resolveKnack({ name: 'Thread Weaving' }, catalog, skillNames);
  assert.equal(d.parent.name, 'Elementalism');
});

test('resolveKnack falls back to parsing the legacy "Knack (Parent)" string', () => {
  const k = resolveKnack({ name: 'Skinning (Tracking)' }, {}, skillNames);
  assert.equal(k.name, 'Skinning');
  assert.equal(k.rawName, 'Skinning (Tracking)');
  assert.equal(k.known, false);
  assert.deepEqual(k.parent, { type: 'skill', name: 'Tracking' }); // Tracking is a skill
  assert.equal(k.requiredRank, null); // no catalog → unpriced
});

test('resolveKnack tags an unknown parent as a talent (not a skill)', () => {
  const k = resolveKnack({ name: 'Down Strike (Melee Weapons)' }, {}, skillNames);
  assert.deepEqual(k.parent, { type: 'talent', name: 'Melee Weapons' });
});

test('resolveKnack keeps a bare unknown knack, with no parent', () => {
  const k = resolveKnack({ name: 'Mystery Knack' }, {}, skillNames);
  assert.equal(k.name, 'Mystery Knack');
  assert.equal(k.known, false);
  assert.equal(k.parent, null);
});

// --- real rules/knacks.json catalog ------------------------------------------

test('real knacks catalog: 145 entries, ed-knacks/2 shape', () => {
  const names = Object.keys(realCatalog);
  assert.equal(names.length, 145);
  assert.ok(names.includes('Lip Reading'));
  assert.ok(names.includes('Point-Blank Shot'));
  assert.ok(names.includes('Detect Spirit'));
  assert.ok(names.includes('Hunting'));
  assert.ok(names.includes('Skinning'));
  assert.ok(names.includes('Animal Tracking'));
  assert.ok(names.includes('Riding'));
  for (const k of Object.values(realCatalog)) {
    assert.ok(Array.isArray(k.parents) && k.parents.length > 0, k.summary);
    for (const p of k.parents) assert.equal(typeof p, 'string'); // name-only binding keys
    assert.equal(typeof k.requiredRank, 'number');
    assert.equal(typeof k.summary, 'string');
  }
});

test('real knacks catalog: restrictions are structured objects (no bare strings)', () => {
  // PLAN-KNACK-RESTRICTIONS §2: every restriction migrated string→object. A bare
  // string would break the structured gate. Empty {} = no restriction.
  const knacksFile = read('knacks.json');
  assert.equal(knacksFile.schema, 'ed-knacks/2', 'schema bumped with the field type change');
  assert.equal(knacksFile.restrictionTaxonomy, 'docs/RESTRICTION-TAXONOMY.md (v1)');
  for (const [name, k] of Object.entries(realCatalog)) {
    const r = k.restrictions;
    assert.equal(typeof r, 'object', `${name}: restrictions must be an object`);
    assert.ok(!Array.isArray(r), `${name}: restrictions is an object, not array`);
    if (r?.note === 'Any Discipline') continue;
    if (r?.attribute || r?.race || r?.ability || r?.note) continue; // GM types fine
    if (!Object.keys(r).length) continue; // {} = none
    if (typeof r.discipline === 'string') {
      assert.ok(r.discipline.length > 0, `${name}: non-empty discipline name`);
    } else {
      assert.ok(Array.isArray(r.discipline) && r.discipline.length > 0, `${name}: discipline array non-empty`);
      for (const d of r.discipline) {
        if (typeof d === 'string') continue;
        assert.equal(typeof d.name, 'string', `${name}: array entry has a name`);
        if (d.circle != null) assert.equal(typeof d.circle, 'number', `${name}: circle is numeric`);
      }
    }
  }
});

test('real catalog: resolveKnack prices a Companion knack from the catalog', () => {
  const k = resolveKnack({ name: 'Lip Reading' }, realCatalog);
  assert.equal(k.known, true);
  assert.equal(k.parent.name, 'Awareness');
  assert.equal(k.requiredRank, 3);
  assert.equal(k.action, 'Standard');
  assert.equal(k.detail.documented, true);
});

test('real catalog: a parent binds to whichever kind the character owns', () => {
  const asSkill = resolveKnack({ name: 'Lip Reading' }, realCatalog, new Set(['Awareness']), new Set());
  assert.deepEqual(asSkill.parent, { type: 'skill', name: 'Awareness' });
  const asTalent = resolveKnack({ name: 'Lip Reading' }, realCatalog, new Set(), new Set(['Awareness']));
  assert.deepEqual(asTalent.parent, { type: 'talent', name: 'Awareness' });
  // Owned as both → talent wins (Companion default labeling); `via` disambiguates.
  const both = resolveKnack(
    { name: 'Point-Blank Shot' },
    realCatalog,
    new Set(['Missile Weapons', 'Throwing Weapons']),
    new Set(['Missile Weapons']),
  );
  assert.deepEqual(both.parent, { type: 'talent', name: 'Missile Weapons' });
  const via = resolveKnack(
    { name: 'Point-Blank Shot', via: 'Throwing Weapons' },
    realCatalog,
    new Set(['Throwing Weapons']),
    new Set(),
  );
  assert.deepEqual(via.parent, { type: 'skill', name: 'Throwing Weapons' });
});

test('real catalog: multi-parent knack defaults to first, `via` picks another', () => {
  const k = resolveKnack({ name: 'Point-Blank Shot' }, realCatalog);
  assert.equal(k.parent.name, 'Missile Weapons');
  const v = resolveKnack({ name: 'Point-Blank Shot', via: 'Throwing Weapons' }, realCatalog);
  assert.equal(v.parent.name, 'Throwing Weapons');
  assert.equal(v.requiredRank, 3);
});

// --- knackParents homebrew lever in deriveModel (ed-homebrew/3 §5.6) -----------

const read = (p) => JSON.parse(readFileSync(new URL(`./rules/${p}`, import.meta.url)));
const baseRules = {
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

// A Warrior with only the Melee Weapon talent; owns Wilderness Survival as a skill
// (not a Discipline-taught talent). With the knackParents lever on, Hunting/
// Skinning/Animal Tracking (parents Wilderness Survival, req 2) become learnable.
const skillChar = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Ranger' },
  attributes: { Toughness: { base: 17 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [{ name: 'Warrior', circle: 1, talents: [{ name: 'Melee Weapon', rank: 3 }] }],
  skills: [{ name: 'Wilderness Survival', rank: 2 }],
  knacks: [],
  items: [],
});

const knackRule = ({ on = true } = {}) => ({
  schema: 'ed-homebrew/3',
  rules: [
    {
      id: 'hb-skill-knacks',
      name: 'Skills may govern knacks',
      summary: 'Skills govern knacks.',
      ...(on ? { knackParents: true } : {}),
    },
  ],
});

test('deriveModel: knackParents lever surfaces skill-named parent candidates', () => {
  const model = deriveModel(skillChar(), { ...baseRules, homebrewFile: knackRule() });
  assert.equal(model.skillKnackEnabled, true, 'flag on when an enabled rule declares knackParents');
  const names = model.knackOptions.map((o) => o.name).sort();
  assert.deepEqual(names, ['Animal Tracking', 'Hunting', 'Skinning'], 'Wilderness Survival skill (rank 2 >= req 2) qualifies all three');
  const hunting = model.knackOptions.find((o) => o.name === 'Hunting');
  assert.deepEqual(hunting.qualifies, [{ name: 'Wilderness Survival', rank: 2, kind: 'skill' }]);
});

test('deriveModel: no knackParents lever keeps the talent-only default', () => {
  const model = deriveModel(skillChar(), { ...baseRules, homebrewFile: { schema: 'ed-homebrew/3', rules: [] } });
  assert.equal(model.skillKnackEnabled, false);
  assert.ok(!model.knackOptions.some((o) => o.name === 'Hunting'), 'skill never qualifies without the lever');
});

test('deriveModel: rule present but NOT knackParents keeps the talent-only default', () => {
  const model = deriveModel(skillChar(), { ...baseRules, homebrewFile: knackRule({ on: false }) });
  assert.equal(model.skillKnackEnabled, false);
  assert.ok(!model.knackOptions.some((o) => o.name === 'Hunting'), 'skill never qualifies without the lever');
});

test('deriveModel: no homebrew file at all keeps the talent-only default', () => {
  const model = deriveModel(skillChar(), baseRules);
  assert.equal(model.skillKnackEnabled, false);
  assert.ok(!model.knackOptions.some((o) => o.name === 'Hunting'));
});

test('deriveModel: skill-knack cap respects the skill rank (per-parent cap)', () => {
  // New char — owns W. Survival at rank 1 and has already learned 1 knack under it
  // (cap = rank 1). No more skill-governed knacks are offered.
  const char = { ...skillChar(), skills: [{ name: 'Wilderness Survival', rank: 1 }], knacks: [{ name: 'Hunting', via: 'Wilderness Survival' }] };
  const model = deriveModel(char, { ...baseRules, homebrewFile: knackRule() });
  assert.ok(!model.knackOptions.some((o) => o.name === 'Skinning'), 'at the cap under the skill');
});

// --- discipline restriction gate in deriveModel (PLAN-KNACK-RESTRICTIONS §2) ----

// A Nethermancer whose Spellcasting talent governs the Spellcasting-parented knacks.
// Only Nethermancer-gated ones should surface; Elementalist-gated (Spellcasting
// parent, e.g. Acid Splash) must be excluded by the character's own discipline.
const nethChar = () => ({
  schema: 'ed-character/1',
  meta: { name: 'Sorceress' },
  attributes: { Willpower: { base: 15 } },
  resources: { health: { damage: 0, wounds: 0, recoveriesUsed: 0 } },
  disciplines: [{ name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank: 3 }] }],
  skills: [],
  knacks: [],
  items: [],
});

test('deriveModel: only the character’s own-discipline Spellcasting knacks surface', () => {
  const model = deriveModel(nethChar(), baseRules);
  const names = model.knackOptions.map((o) => o.name);
  assert.ok(names.includes('Astral Strain'), 'Nethermancer Spellcasting knack (req 2) shown');
  assert.ok(names.includes('Bleed'), 'Nethermancer Spellcasting knack (req 3) shown');
  assert.ok(names.includes('Unsettle'), 'Nethermancer Spellcasting knack (req 2) shown');
  assert.ok(!names.includes('Acid Splash'), 'Elementalist-gated Spellcasting knack excluded for a Nethermancer');
  assert.ok(!names.includes('Fortify Armor'), 'Elementalist-gated knack excluded');
  assert.ok(!names.includes('Befuddle'), 'Illusionist-gated knack excluded');
});
