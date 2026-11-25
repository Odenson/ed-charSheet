// store.effect-window.test.js — run with `npm test` (node --test, no deps).
// plans/active-condition-window: deriveModel builds model.effectWindow from the
// session, passes through targetName/toggledOptions, leaves model.activeEffects
// untouched, and resolves Taunt's arms (rounds "rank" -> number, opponent, text).
// Rules: R1 Taunt (rounds = Taunt rank), R2 Aim, R3/R5. Real rules files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';

const rd = (p) => JSON.parse(readFileSync(new URL('./rules/' + p, import.meta.url)));
const rules = {
  steps: rd('steps.json').steps,
  talentsFile: rd('talents.json'),
  disciplinesFile: rd('disciplines.json'),
  racesFile: rd('races.json'),
  characteristicsFile: rd('characteristics.json'),
  itemsFile: rd('items.json'),
  legendFile: rd('legend.json'),
  skillsFile: rd('skills.json'),
  knacksFile: rd('knacks.json'),
  threadItemsFile: rd('thread-items.json'),
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: rd('combat.json'),
};

const attrs = {
  Dexterity: { base: 20 }, Strength: { base: 12 }, Toughness: { base: 10 },
  Perception: { base: 14 }, Willpower: { base: 12 }, Charisma: { base: 14 },
};
const base = {
  meta: { name: 'Tester', race: 'Ork' },
  attributes: attrs,
  disciplines: [],
  items: [],
  resources: { health: { damage: 0, wounds: 0 }, karma: { available: 3 } },
  skills: [], knacks: [], traits: [], wealth: {}, notes: [], history: [],
};
const sailor = (rank) => ({
  ...base,
  disciplines: [{ name: 'Air Sailor', circle: 1, talents: [{ name: 'Taunt', rank }, { name: 'Melee Weapon', rank: 1 }] }],
});
const caster = {
  ...base,
  disciplines: [{ name: 'Nethermancer', circle: 3, talents: [{ name: 'Spellcasting', rank: 5 }] }],
  spells: { known: [{ name: 'Bone Dance' }], matrices: [] },
};
const tauntNode = (rank) =>
  deriveModel(sailor(rank), rules).disciplines[0].talents.find((t) => t.name === 'Taunt');

const rec = { id: 'opp:1', kind: 'talent', name: 'Taunt', effectLabel: '2 successes', text: 'x', targetName: 'Bob', roundsLeft: 3, roundsTotal: 3 };
const spellRec = { name: 'Haste', effectLabel: '+2 Physical Defense', roundsLeft: 4, roundsTotal: 8, options: { picks: [], success: null } };
const aimRec = { name: 'Mystic Aim', successes: 2, roundsLeft: 1, roundsTotal: 1, effects: [] };

test('no session -> effectWindow is [], targetName "", toggledOptions []', () => {
  const m = deriveModel(base, rules);
  assert.deepEqual(m.effectWindow, []);
  assert.equal(m.targetName, '');
  assert.deepEqual(m.toggledOptions, []);
});

test('effectWindow folds spells, Aim, opponent record and toggled option from the session', () => {
  const m = deriveModel(base, rules, {
    activeSpells: [spellRec], armedTalents: [aimRec], opponentEffects: [rec],
    toggledOptions: ['Aggressive Attack'], targetName: 'Bob',
  });
  const byId = Object.fromEntries(m.effectWindow.map((e) => [e.id, e]));
  assert.equal(byId['spell:Haste'].side, 'you');
  assert.equal(byId['talent:Mystic Aim'].side, 'you');
  assert.equal(byId['opp:1'].side, 'tgt');
  assert.equal(byId['opp:1'].targetName, 'Bob');
  assert.equal(byId['option:Aggressive Attack'], undefined, 'single-attack options are not listed');
  assert.equal(m.targetName, 'Bob');
  assert.deepEqual(m.toggledOptions, ['Aggressive Attack']);
});

test('a blank targetName labels the opponent entry "target"', () => {
  const m = deriveModel(base, rules, { opponentEffects: [{ ...rec, targetName: '' }] });
  assert.equal(m.effectWindow.find((e) => e.id === 'opp:1').targetName, 'target');
});

test('knockedDown session flag adds the locked Knocked Down entry', () => {
  const m = deriveModel(base, rules, { knockedDown: true });
  const kd = m.effectWindow.find((e) => e.id === 'condition:Knocked Down');
  assert.ok(kd);
  assert.equal(kd.endable, false);
});

test('a Burdened character gets the locked encumbrance Harried entry', () => {
  const heavy = {
    ...base,
    attributes: { ...attrs, Strength: { base: 4 } },
    items: [{ name: 'Medium Crossbow' }, { name: 'Ork Dagger' }, { name: 'Hardened Leather' }, { name: 'Broadsword', equipped: false }],
  };
  const m = deriveModel(heavy, rules);
  const h = m.effectWindow.find((e) => e.id === 'condition:Encumbered Harried');
  assert.ok(h, 'Burdened -> Harried entry');
  assert.equal(h.endable, false);
  const light = deriveModel(base, rules);
  assert.ok(!light.effectWindow.some((e) => e.id === 'condition:Encumbered Harried'));
});

test('an active situation appears as an endable situation entry on "you"', () => {
  const sit = rules.combatFile.situations.find((s) => s.name === 'Blindsided');
  assert.ok(sit, 'combat.json has the Blindsided situation');
  const m = deriveModel(base, rules, { situations: [sit.name] });
  const e = m.effectWindow.find((x) => x.kind === 'situation');
  assert.ok(e, 'situation entry present');
  assert.equal(e.side, 'you');
  assert.equal(e.name, sit.name);
});

test('model.activeEffects is unchanged by the new session keys (Overview strip untouched)', () => {
  const s0 = { activeSpells: [spellRec], armedTalents: [aimRec], activeCharms: [] };
  const a = deriveModel(base, rules, s0).activeEffects;
  const b = deriveModel(base, rules, {
    ...s0, opponentEffects: [rec], toggledOptions: ['Aggressive Attack'], targetName: 'Bob',
  }).activeEffects;
  assert.deepEqual(b, a);
  assert.deepEqual(deriveModel(base, rules).activeEffects, deriveModel(base, rules, {}).activeEffects);
});

test('spells slice exposes effectWindow and targetName for the Spells tab', () => {
  const m = deriveModel(caster, rules, { opponentEffects: [rec], targetName: 'Bob' });
  assert.ok(m.spells);
  assert.deepEqual(m.spells.effectWindow, m.effectWindow);
  assert.equal(m.spells.targetName, 'Bob');
});

// ---- Taunt arms --------------------------------------------------------------

test('Taunt node arms: rounds resolve to the talent rank as a number, opponent true, vs Social', () => {
  for (const rank of [1, 3, 5]) {
    const a = tauntNode(rank).arms;
    assert.ok(a, 'Taunt exposes arms');
    assert.equal(a.rounds, rank);
    assert.equal(typeof a.rounds, 'number');
    assert.equal(a.opponent, true);
    assert.equal(a.roll.vs, 'Social');
    assert.equal(a.roll.strain, 1);
  }
});

test('Taunt arms carries the note text and no folded payload (display-only, R1)', () => {
  const a = tauntNode(2).arms;
  assert.equal(typeof a.text, 'string');
  assert.ok(a.text.length > 0);
  assert.deepEqual(a.effects, []);
});

test('Mystic Aim arms is not an opponent arm and keeps rounds 1 (R2)', () => {
  const aimer = {
    ...base,
    disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'Missile Weapon', rank: 5 }, { name: 'Mystic Aim', rank: 4 }] }],
  };
  const aim = deriveModel(aimer, rules).disciplines[0].talents.find((t) => t.name === 'Mystic Aim');
  assert.equal(aim.arms.rounds, 1);
  assert.ok(!aim.arms.opponent);
});

test('"rank" never reaches the session: every arms.rounds in the model is a number >= 1', () => {
  const m = deriveModel(sailor(4), rules);
  for (const d of m.disciplines) {
    for (const t of d.talents) {
      if (t.arms) {
        assert.equal(typeof t.arms.rounds, 'number', t.name);
        assert.ok(t.arms.rounds >= 1, t.name);
      }
    }
  }
});

test('a Taunt record in session.armedTalents folds nothing (no castingArmed, no armed entry)', () => {
  const stray = {
    name: 'Taunt', opponent: true, successes: 3, roundsLeft: 3,
    effects: [{ type: 'test-modifier', target: { domain: 'test', name: 'Spellcasting' }, operation: 'add', value: 2, measure: 'step', condition: 'on-success', perSuccess: true }],
  };
  const m = deriveModel(caster, rules, { armedTalents: [stray] });
  assert.ok(m.spells);
  assert.ok(!m.spells.castingArmed, 'opponent records never arm Spellcasting');
  assert.ok(!m.effectWindow.some((e) => e.id === 'talent:Taunt'), 'an opponent record never shows as an armed talent');
});
