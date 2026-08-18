// engine/spells.test.js — run with `npm test` (node --test, no deps).
// Covers the pure spell derivations (PLAN-SPELLS.md §5): catalog joins, the
// cast-type lists (S2 definitions), the extra-thread Circle cap, effective
// thread forging with matrix hold, the §3.4 effect readout archetypes, and
// buildSpellsContext against the real rules/spells.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  joinSpell,
  knownSpells,
  knownByDisciplineCircle,
  castTypeList,
  matrixFor,
  extraThreadCap,
  matrixHeldThreads,
  effectiveThreads,
  effectReadout,
  isSustainedSelfEffect,
  castPlan,
  buildSpellsContext,
} from './spells.js';

const spellsFile = JSON.parse(readFileSync(new URL('../rules/spells.json', import.meta.url)));

// A compact hand-built context, independent of the real catalog where possible.
function ctx(overrides = {}) {
  return {
    catalog: {
      'Soul Armor': {
        name: 'Soul Armor', discipline: 'Nethermancer', circle: 1, threadsToWeave: 1,
        weavingDifficulty: { value: 5, reattune: 10 }, castingTarget: "Target's Mystic Defense",
        range: '10 yards', duration: 'Rank minutes', area: null,
        successes: [{ label: 'Increase Duration (+2 minutes)', effects: [] }],
        extraThreads: [{ label: 'Increase Effect (+2 Mystic Armor)', effects: [] }],
        effects: [{ type: 'armor-modifier', target: { domain: 'armor', name: 'Mystic' },
          operation: 'add', value: 3, measure: 'rating', duration: 'sustained', source: 'spell',
          summary: '+3 Mystic Armor while active.' }],
        summary: '+3 to Mystic Armor',
      },
      'Astral Spear': {
        name: 'Astral Spear', discipline: 'Nethermancer', circle: 1, threadsToWeave: 1,
        weavingDifficulty: { value: 5, reattune: 10 }, castingTarget: "Target's Mystic Defense",
        range: '40 yards', duration: '1 round', area: null, successes: [], extraThreads: [],
        effects: [
          { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' },
            operation: 'set', value: { ref: 'attribute|Willpower|Step' }, measure: 'step',
            duration: 'test', source: 'spell', summary: 'Effect = Willpower step.' },
          { type: 'attack-modifier', target: { domain: 'attack', name: 'Damage' },
            operation: 'add', value: 4, measure: 'step', duration: 'test', source: 'spell',
            summary: '+4 Effect step.' },
        ],
        summary: 'WIL + 4/Mystic',
      },
      'Pain': {
        name: 'Pain', discipline: 'Nethermancer', circle: 3, threadsToWeave: 0,
        weavingDifficulty: { value: 7, reattune: 12 }, castingTarget: "Target's Mystic Defense",
        range: '10 yards', duration: 'Rank rounds', area: null, successes: [], extraThreads: [],
        effects: [{ type: 'note', source: 'spell', gmDiscretion: true, summary: '3 temporary Wounds' }],
        summary: 'Cause the target 3 temporary Wounds and reduce movement',
      },
    },
    threadCap: [
      { minCircle: 1, maxCircle: 4, extraThreads: 1 },
      { minCircle: 5, maxCircle: 8, extraThreads: 2 },
      { minCircle: 9, maxCircle: 12, extraThreads: 3 },
      { minCircle: 13, maxCircle: 15, extraThreads: 4 },
    ],
    known: [
      { name: 'Soul Armor', learntSuccess: 2 },
      { name: 'Pain', learntSuccess: 1 },
    ],
    matrices: [{ type: 'Standard', spell: 'Soul Armor' }],
    disciplines: [{ name: 'Nethermancer', circle: 3 }],
    weavingStep: { Nethermancer: 9 },
    castingStep: 8,
    attrStep: { Willpower: 6 },
    karma: { weaving: { Nethermancer: true }, casting: true },
    ...overrides,
  };
}

test('joinSpell attaches learntSuccess; unknown → null', () => {
  assert.equal(joinSpell(ctx(), 'Soul Armor').learntSuccess, 2);
  assert.equal(joinSpell(ctx(), 'Nonexistent Spell'), null);
});

test('knownSpells returns only known, sorted by circle then name', () => {
  const ks = knownSpells(ctx());
  assert.deepEqual(ks.map((s) => s.name), ['Soul Armor', 'Pain']); // C1 then C3
});

test('knownByDisciplineCircle groups by discipline then circle', () => {
  const g = knownByDisciplineCircle(ctx());
  assert.deepEqual(Object.keys(g), ['Nethermancer']);
  assert.deepEqual(g.Nethermancer[1].map((s) => s.name), ['Soul Armor']);
  assert.deepEqual(g.Nethermancer[3].map((s) => s.name), ['Pain']);
});

test('castTypeList: matrix = placed, grimoire = known, raw = discipline lists', () => {
  const c = ctx();
  assert.deepEqual(castTypeList(c, 'matrix').map((s) => s.name), ['Soul Armor']);
  assert.deepEqual(castTypeList(c, 'grimoire').map((s) => s.name), ['Soul Armor', 'Pain']);
  // raw = any catalog spell in the caster's Disciplines (incl. Astral Spear, not learnt)
  assert.deepEqual(castTypeList(c, 'raw').map((s) => s.name), ['Astral Spear', 'Soul Armor', 'Pain']);
  assert.deepEqual(castTypeList(c, 'item'), []);
});

test('matrixFor finds the placement', () => {
  assert.equal(matrixFor(ctx(), 'Soul Armor').type, 'Standard');
  assert.equal(matrixFor(ctx(), 'Pain'), null);
});

test('extraThreadCap reads the Circle band (C3 → 1)', () => {
  assert.equal(extraThreadCap(ctx(), ctx().catalog['Soul Armor']), 1);
  // A Circle-9 caster → band 9-12 → 3
  const hi = ctx({ disciplines: [{ name: 'Nethermancer', circle: 9 }] });
  assert.equal(extraThreadCap(hi, hi.catalog['Soul Armor']), 3);
});

test('Standard matrix holds no threads — matrix cast still forges required', () => {
  const c = ctx();
  const soul = c.catalog['Soul Armor'];
  assert.equal(matrixHeldThreads(c, soul, 'matrix'), 0);
  assert.equal(effectiveThreads(c, soul, 'matrix'), 1); // NOT skipped
  assert.equal(effectiveThreads(c, soul, 'grimoire'), 1);
});

test('Enhanced/Armoured matrix holds one thread — a 1-thread spell skips forging', () => {
  const c = ctx({ matrices: [{ type: 'Enhanced', spell: 'Soul Armor' }] });
  const soul = c.catalog['Soul Armor'];
  assert.equal(matrixHeldThreads(c, soul, 'matrix'), 1);
  assert.equal(effectiveThreads(c, soul, 'matrix'), 0);
});

test('effectReadout: sustained static, instantaneous step, note → none', () => {
  const c = ctx();
  const armor = effectReadout(c, c.catalog['Soul Armor']);
  assert.equal(armor.kind, 'static');
  assert.equal(armor.value, 3);
  assert.equal(armor.label, 'Mystic armor');

  const spear = effectReadout(c, c.catalog['Astral Spear']);
  assert.equal(spear.kind, 'step');
  assert.equal(spear.base, 6);          // Willpower step
  assert.equal(spear.add, 4);
  assert.equal(spear.step, 10);

  assert.equal(effectReadout(c, c.catalog['Pain']).kind, 'none');
});

test('isSustainedSelfEffect flags folding buffs, not gmDiscretion debuffs', () => {
  assert.equal(isSustainedSelfEffect(ctx().catalog['Soul Armor']), true);
  assert.equal(isSustainedSelfEffect(ctx().catalog['Pain']), false);
});

test('castPlan aggregates the decision-support object', () => {
  const p = castPlan(ctx(), 'Soul Armor', 'matrix');
  assert.equal(p.threadsToWeave, 1);          // Standard matrix holds none
  assert.equal(p.weavingDifficulty, 5);
  assert.equal(p.weavingStep, 9);
  assert.equal(p.castingStep, 8);
  assert.equal(p.effect.kind, 'static');
  assert.equal(p.extraThreadCap, 1);
  assert.equal(p.canKarma.weaving, true);
  assert.equal(p.canKarma.casting, true);
  assert.equal(p.foldsOnSelf, true);
  // A 0-thread spell → no weaving karma offer (nothing to forge)
  assert.equal(castPlan(ctx(), 'Pain', 'grimoire').canKarma.weaving, false);
});

test('buildSpellsContext derives steps from the model; null for non-casters', () => {
  const character = {
    spells: {
      known: [{ name: 'Soul Armor', learntSuccess: 2 }],
      matrices: [{ type: 'Standard', spell: 'Soul Armor' }],
    },
  };
  const derived = {
    disciplines: [
      { name: 'Archer', circle: 4, talents: [{ name: 'Thread Weaving (Archer)', step: 11 }] },
      { name: 'Nethermancer', circle: 3, talents: [
        { name: 'Thread Weaving (Nethermancer)', step: 9, karma: {} },
        { name: 'Spellcasting', step: 8, karma: {} },
      ] },
    ],
    attrStepByName: { Willpower: 6 },
  };
  const c = buildSpellsContext(character, spellsFile, derived);
  assert.equal(c.castingStep, 8);
  assert.equal(c.weavingStep.Nethermancer, 9);
  assert.deepEqual(c.disciplines, [{ name: 'Nethermancer', circle: 3 }]); // only caster discs
  assert.equal(c.karma.casting, true);
  assert.equal(buildSpellsContext({}, spellsFile, derived), null); // no spells block
});

test('real catalog: 123 Nethermancer spells, threadCap present, effects non-empty', () => {
  assert.equal(spellsFile.schema, 'ed-spells/1');
  assert.equal(Object.keys(spellsFile.spells).length, 123);
  assert.equal(spellsFile.threadCap.length, 4);
  for (const s of Object.values(spellsFile.spells)) {
    assert.ok(s.effects.length >= 1, `${s.name} has no effects`);
  }
});
