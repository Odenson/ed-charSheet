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
  sustainedEffectsOf,
  durationRounds,
  buildActiveSpell,
  tickActiveSpells,
  activeSpellEffects,
  effectStepBonus,
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

test('joinSpell matches apostrophe style (straight vs curly) → canonical name', () => {
  const c = {
    catalog: { 'Death’s Head': { name: 'Death’s Head', discipline: 'Nethermancer', circle: 2, effects: [] } },
    known: [{ name: "Death's Head", learntSuccess: 1 }], // straight apostrophe, as a player types
  };
  const s = joinSpell(c, "Death's Head");
  assert.ok(s, 'straight-apostrophe name should find the curly catalog entry');
  assert.equal(s.name, 'Death’s Head'); // returns the CANONICAL catalog spelling
  assert.equal(s.learntSuccess, 1);
  assert.equal(matrixFor({ matrices: [{ type: 'Standard', spell: 'Death’s Head' }] }, "Death's Head").type, 'Standard');
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

// --- phase 6b: sustained self-cast fold + countdown ---

test('durationRounds: 1 min = 10 rounds; +N and pure numbers; non-round → null', () => {
  assert.equal(durationRounds('Rank minutes', 3), 30);
  assert.equal(durationRounds('Rank rounds', 3), 3);
  assert.equal(durationRounds('Rank + 5 rounds', 3), 8);
  assert.equal(durationRounds('Rank+5 rounds', 3), 8);
  assert.equal(durationRounds('Rank + 10 minutes', 2), 120);
  assert.equal(durationRounds('2 rounds', 3), 2);
  assert.equal(durationRounds('1 round', 3), 1);
  assert.equal(durationRounds('Rank months', 3), null);
  assert.equal(durationRounds(null, 3), null);
});

test('sustainedEffectsOf: buff yes, instantaneous/gmDiscretion no', () => {
  const c = ctx();
  assert.equal(sustainedEffectsOf(c.catalog['Soul Armor']).length, 1);
  assert.equal(sustainedEffectsOf(c.catalog['Astral Spear']).length, 0); // duration:test
  assert.equal(sustainedEffectsOf(c.catalog['Pain']).length, 0);         // note only
});

test('buildActiveSpell: sustained effects, label, round countdown', () => {
  const s = buildActiveSpell(ctx().catalog['Soul Armor'], 3);
  assert.equal(s.name, 'Soul Armor');
  assert.equal(s.roundsLeft, 30);        // Rank(3) minutes → 30 rounds
  assert.equal(s.roundsTotal, 30);
  assert.equal(s.effects.length, 1);
  assert.equal(s.effectLabel, '+3 Mystic armor');
});

test('buildActiveSpell folds structured extra-thread effect + success duration boosts', () => {
  // Real Soul Armor (options migrated to structured effects): 1 extra thread
  // "Increase Effect (+2 Mystic Armor)" (rating +2) + 3 successes → 2 extra ×
  // "Increase Duration (+2 minutes)" = +40 rounds.
  const s = buildActiveSpell(spellsFile.spells['Soul Armor'], 3, {
    extraPicks: ['Increase Effect (+2 Mystic Armor)'],
    successLevels: 3,
  });
  assert.equal(s.effects[0].value, 5);        // +3 base + 2 extra thread
  assert.equal(s.effectLabel, '+5 Mystic armor');
  assert.equal(s.roundsLeft, 70);             // 30 base + 2 extra successes × 20
});

test('tickActiveSpells: decrements, drops at 0, keeps null', () => {
  const active = [
    { name: 'A', roundsLeft: 2 },
    { name: 'B', roundsLeft: 1 },
    { name: 'C', roundsLeft: null },
  ];
  const next = tickActiveSpells(active);
  assert.deepEqual(next.map((s) => s.name), ['A', 'C']); // B expired
  assert.equal(next.find((s) => s.name === 'A').roundsLeft, 1);
  assert.equal(next.find((s) => s.name === 'C').roundsLeft, null);
});

test('activeSpellEffects: flattens + tags origin', () => {
  const active = [buildActiveSpell(ctx().catalog['Soul Armor'], 3)];
  const fx = activeSpellEffects(active);
  assert.equal(fx.length, 1);
  assert.equal(fx[0].type, 'armor-modifier');
  assert.deepEqual(fx[0].origin, { kind: 'spell', name: 'Soul Armor' });
});

test('effectStepBonus: structured extra-thread + success step boosts (real catalog)', () => {
  const spear = spellsFile.spells['Astral Spear']; // options structured to attack-modifier step
  // Astral Spear bug case: 1 extra thread (+2 step) + 4 successes (3 extra × +2 = +6) = +8
  assert.equal(effectStepBonus(spear, ['Increase Effect (+2 Effect Step)'], 4), 8);
  assert.equal(effectStepBonus(spear, [], 1), 0);           // no extra successes, no picks
  assert.equal(effectStepBonus(spear, ['Increase Effect (+2 Effect Step)'], 1), 2); // thread only
  // Soul Armor's success is a DURATION boost → contributes no effect steps
  assert.equal(effectStepBonus(spellsFile.spells['Soul Armor'], [], 4), 0);
});

test('real catalog: 123 Nethermancer spells, threadCap present, effects non-empty', () => {
  assert.equal(spellsFile.schema, 'ed-spells/1');
  assert.equal(Object.keys(spellsFile.spells).length, 123);
  assert.equal(spellsFile.threadCap.length, 4);
  for (const s of Object.values(spellsFile.spells)) {
    assert.ok(s.effects.length >= 1, `${s.name} has no effects`);
  }
});
