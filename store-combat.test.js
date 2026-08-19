// store-combat.test.js — run with `npm test` (node --test, no deps).
// Covers the Phase C Combat model surface in deriveModel (PLAN-COMBAT-TAB):
// attack talents, equipped weapons, Strength step, live combat conditions, and
// the Damage-test karma grant — derived against the REAL rules files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveModel } from './store.js';
import { collectCombatEffects, foldCombatRatings } from './engine/combat.js';

const rules = {
  steps: JSON.parse(readFileSync(new URL('./rules/steps.json', import.meta.url))).steps,
  talentsFile: JSON.parse(readFileSync(new URL('./rules/talents.json', import.meta.url))),
  disciplinesFile: JSON.parse(readFileSync(new URL('./rules/disciplines.json', import.meta.url))),
  racesFile: JSON.parse(readFileSync(new URL('./rules/races.json', import.meta.url))),
  characteristicsFile: JSON.parse(readFileSync(new URL('./rules/characteristics.json', import.meta.url))),
  itemsFile: JSON.parse(readFileSync(new URL('./rules/items.json', import.meta.url))),
  legendFile: JSON.parse(readFileSync(new URL('./rules/legend.json', import.meta.url))),
  skillsFile: JSON.parse(readFileSync(new URL('./rules/skills.json', import.meta.url))),
  knacksFile: JSON.parse(readFileSync(new URL('./rules/knacks.json', import.meta.url))),
  threadItemsFile: JSON.parse(readFileSync(new URL('./rules/thread-items.json', import.meta.url))),
  customItemsFile: { schema: 'ed-items/3', items: {} },
  customItemsCommittedFile: { schema: 'ed-items/3', items: {} },
  homebrewFile: { rules: [] },
  combatFile: JSON.parse(readFileSync(new URL('./rules/combat.json', import.meta.url))),
};

// A low-Strength (STR 4 → carry 25 lb) Archer circle 5. Carried load: Medium
// Crossbow 7 lb + Ork Dagger 1 lb + Hardened Leather 20 lb + stored Broadsword
// 4 lb = 32 lb → past the 25 lb capacity (within 1.5×) → Burdened/Harried. The
// Archer circle-5 grant makes Damage-test karma available for ranged weapons.
const charA = {
  meta: { name: 'Tester', race: 'Ork' },
  attributes: {
    Dexterity: { base: 20 },
    Strength: { base: 4 },
    Toughness: { base: 10 },
    Perception: { base: 14 },
    Willpower: { base: 12 },
    Charisma: { base: 8 },
  },
  disciplines: [
    {
      name: 'Archer',
      circle: 5,
      talents: [
        { name: 'Missile Weapon', rank: 5 },
        { name: 'Throwing Weapon', rank: 3 },
        { name: 'Durability', rank: 1 },
        { name: 'Karma Ritual', rank: 1 },
      ],
    },
  ],
  items: [
    { name: 'Medium Crossbow' },
    { name: 'Ork Dagger' },
    { name: 'Hardened Leather' },
    { name: 'Broadsword', equipped: false },
  ],
  resources: { health: { damage: 5, wounds: 0 }, karma: { available: 3 } },
  skills: [],
  knacks: [],
  traits: [],
  wealth: {},
  notes: [],
  history: [],
};

// Knocked Down arrives through the session flag (decision I) — never stored.
const modelA = deriveModel(charA, rules, { knockedDown: true });

test('attack talents: canonical order, owned ones carry rank/step/dice/karma', () => {
  const names = modelA.combat.attackTalents.map((t) => t.name);
  assert.deepEqual(names, ['Melee Weapon', 'Missile Weapon', 'Unarmed Combat', 'Throwing Weapon']);

  const missile = modelA.combat.attackTalents.find((t) => t.name === 'Missile Weapon');
  assert.equal(missile.known, true);
  assert.equal(missile.rank, 5);
  assert.equal(missile.step, 13); // DEX step 8 + rank 5
  assert.equal(missile.dice, 'D12+D10');
  assert.equal(missile.karma.grants.length, 1); // talent tests are karma-eligible by default

  const throwing = modelA.combat.attackTalents.find((t) => t.name === 'Throwing Weapon');
  assert.equal(throwing.known, true);
  assert.equal(throwing.rank, 3);
  assert.equal(throwing.step, 11); // DEX step 8 + rank 3
  assert.equal(throwing.dice, 'D10+D8');
});

test('attack talents: unowned talents derive null step (placeholder pill), never a number', () => {
  for (const name of ['Melee Weapon', 'Unarmed Combat']) {
    const t = modelA.combat.attackTalents.find((x) => x.name === name);
    assert.equal(t.known, false, name);
    assert.equal(t.rank, null, name);
    assert.equal(t.step, null, name);
    assert.equal(t.dice, '', name);
    assert.equal(t.karma, null, name);
  }
});

test('equipped weapons: only the equipped weapon kind, with category/damage/range/image', () => {
  const names = modelA.combat.equippedWeapons.map((w) => w.name);
  assert.deepEqual(names, ['Medium Crossbow', 'Ork Dagger']); // stored Broadsword excluded

  const crossbow = modelA.combat.equippedWeapons.find((w) => w.name === 'Medium Crossbow');
  assert.deepEqual(
    { category: crossbow.category, damageStep: crossbow.damageStep, shortRange: crossbow.shortRange, longRange: crossbow.longRange, image: crossbow.image },
    { category: 'missile', damageStep: 5, shortRange: '2-40', longRange: '41-80', image: 'data/medium-crossbow.png' },
  );

  // Ork Dagger is a melee dagger (rules/items.json) — a melee weapon carries no
  // range, so shortRange/longRange derive null (the missile crossbow above covers
  // the ranged case). Its repo image still resolves.
  const dagger = modelA.combat.equippedWeapons.find((w) => w.name === 'Ork Dagger');
  assert.equal(dagger.category, 'melee');
  assert.equal(dagger.damageStep, 2);
  assert.equal(dagger.shortRange, null);
  assert.equal(dagger.longRange, null);
  assert.equal(dagger.image, 'data/Std-ork-dagger.png');
});

test('strength step, live conditions and the Damage-test karma grant are exposed', () => {
  assert.equal(modelA.combat.strengthStep, 3); // STR 4 → step 3

  assert.deepEqual(modelA.combat.conditions, { knockedDown: true, harried: true });

  const dmg = modelA.combat.damageKarma;
  assert.ok(dmg, 'Archer circle 5 grants Damage-test karma');
  assert.equal(dmg.grants[0].scope, 'ranged weapons');
  assert.equal(dmg.grants[0].via.name, 'Archer');
});

test('the tab pieces already derived elsewhere stay real numbers (never pills)', () => {
  const c = modelA.characteristics;
  assert.equal(typeof c.physicalDefense.value, 'number');
  assert.equal(typeof c.mysticDefense.value, 'number');
  assert.equal(typeof c.physicalArmor.value, 'number');
  assert.equal(typeof c.initiative.value, 'number');
  assert.ok(modelA.healthState.state === 'conscious' || modelA.healthState.state === 'unhurt');
});

test('clear load: conditions both false, only light weapons equipped', () => {
  const charB = {
    ...charA,
    items: [{ name: 'Ork Dagger' }],
    resources: { health: { damage: 0, wounds: 0 }, karma: { available: 3 } },
  };
  const modelB = deriveModel(charB, rules);
  assert.deepEqual(modelB.combat.conditions, { knockedDown: false, harried: false });
  assert.deepEqual(modelB.combat.equippedWeapons.map((w) => w.name), ['Ork Dagger']);
});

test('combatRules exposes the rule bundles the chips render from (ed-combat/1)', () => {
  assert.equal(modelA.combatRules.options.length, 10);
  assert.equal(modelA.combatRules.situations.length, 12);
  assert.equal(modelA.combatRules.options[0].name, 'Aggressive Attack');
  const harried = modelA.combatRules.situations.find((s) => s.name === 'Harried');
  assert.equal(harried.mapsToCondition, 'harried');
  assert.ok(harried.effects.some((e) => e.type === 'test-modifier'));
});

test('a woven thread weapon joins equippedWeapons with folded damage step', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Orc Stinger', equipped: true, threadRank: 3 }],
  };
  const modelC = deriveModel(charC, rules);
  const weapon = modelC.combat.equippedWeapons.find((w) => w.name === 'Orc Stinger');
  assert.ok(weapon, 'Orc Stinger should appear as an equipped weapon');
  assert.equal(weapon.category, 'missile');
  // Damage step = the woven attack-modifier (rank 3 replaces base 5) → 7.
  assert.equal(weapon.damageStep, 7);
  assert.equal(weapon.shortRange, '2-30');
  assert.equal(weapon.longRange, '31-60');
  // The item-scoped option rides along for the Combat tab to render.
  assert.ok(Array.isArray(weapon.combatOptions) && weapon.combatOptions.length === 1);
  assert.equal(weapon.combatOptions[0].name, 'Double Bolt');
});

test('a woven thread weapon carries its effects so the pool can fold rank test-modifiers', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Orc Stinger', equipped: true, threadRank: 4 }],
  };
  const modelC = deriveModel(charC, rules);
  const weapon = modelC.combat.equippedWeapons.find((w) => w.name === 'Orc Stinger');
  // The weave at rank 4: +1 (rank 2) and +2 (rank 4) Attack step test
  // modifiers — both ride on equippedWeapons.effects; engine/combat.js collapses
  // them (replace → only +2 folds, never +3), so the Attack step rises +2.
  const attackMods = (weapon.effects ?? []).filter((e) => e.type === 'test-modifier' && e.target?.name === 'Attack');
  assert.equal(attackMods.length, 2);
  assert.equal(attackMods[1].measure, 'step');
  assert.equal(weapon.damageStep, 7);
});

test('a thread item with no ref.category stays out of equippedWeapons', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Bracers of Aras', equipped: true, threadRank: 1 }],
  };
  const modelC = deriveModel(charC, rules);
  const names = modelC.combat.equippedWeapons.map((w) => w.name);
  assert.ok(!names.includes('Bracers of Aras'), 'non-weapon thread items are not weapons');
});

test('an equipped non-weapon thread item surfaces its combatOptions in combat.itemOptions', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Dark Archer Armour', equipped: true, threadRank: 0 }],
  };
  const modelC = deriveModel(charC, rules);
  const ward = modelC.combat.itemOptions.find((o) => o.name === 'Horror Defence');
  assert.ok(ward, 'Horror Defence should be offered as an item-scoped combat option');
  // The bundle carries the two situational Defence modifiers — never folded into
  // the static Defence pills (condition: situational), applied only on toggle.
  const defs = ward.effects.filter((e) => e.type === 'defense-modifier');
  assert.equal(defs.length, 2);
  assert.ok(defs.every((e) => e.condition === 'situational'));
});

test('an equipped item-option is not offered while stored (unequipped)', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Dark Archer Armour', equipped: false, threadRank: 0 }],
  };
  const modelC = deriveModel(charC, rules);
  assert.ok(!modelC.combat.itemOptions.some((o) => o.name === 'Horror Defence'));
});

test('a thread weapon keeps its combatOptions off itemOptions (weapon-scoped, no double-offer)', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Orc Stinger', equipped: true, threadRank: 1 }],
  };
  const modelC = deriveModel(charC, rules);
  assert.ok(!modelC.combat.itemOptions.some((o) => o.name === 'Double Bolt'));
});

test('toggling Horror Defence folds +1 PD / +1 MD onto the Combat-tab Defence readout only', () => {
  const charC = {
    ...charA,
    items: [{ name: 'Dark Archer Armour', equipped: true, threadRank: 0 }],
  };
  const modelC = deriveModel(charC, rules);
  const { defenseMods } = collectCombatEffects({
    selectedOptions: ['Horror Defence'],
    rules: { options: modelC.combat.itemOptions, situations: [] },
    conditions: {},
  });
  assert.equal(defenseMods.length, 2);
  const r = foldCombatRatings({ physicalDefense: 9, mysticDefense: 7 }, defenseMods, []);
  assert.equal(r.defence.Physical.value, 10); // base 9 + toggled 1
  assert.equal(r.defence.Mystic.value, 8); //  base 7 + toggled 1
});

// --- talent-granted combat options (True Shot) --------------------------------

test('an owned talent with combatOptions surfaces in combat.talentOptions, rank injected', () => {
  const charT = {
    ...charA,
    disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'Missile Weapon', rank: 5 }, { name: 'True Shot', rank: 3 }] }],
  };
  const m = deriveModel(charT, rules);
  const ts = m.combat.talentOptions.find((o) => o.name === 'True Shot');
  assert.ok(ts, 'True Shot should be offered as a talent-scoped combat option');
  assert.equal(ts.karmaDice.max, 3); // resolved from the talent rank
  assert.equal(ts.karmaDice.source, 'rank');
  assert.deepEqual(ts.appliesTo, ['missile', 'throwing']);
  assert.equal(ts.grantedBy, 'True Shot');
});

test('a talent combatOption is absent when the talent is unowned / rank 0', () => {
  const m = deriveModel(charA, rules); // charA has no True Shot
  assert.ok(!m.combat.talentOptions.some((o) => o.name === 'True Shot'));
  const charZero = {
    ...charA,
    disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'True Shot', rank: 0 }] }],
  };
  const mz = deriveModel(charZero, rules);
  assert.ok(!mz.combat.talentOptions.some((o) => o.name === 'True Shot'));
});

test('True Shot across two Disciplines dedupes to the highest rank', () => {
  const charT = {
    ...charA,
    disciplines: [
      { name: 'Archer', circle: 5, talents: [{ name: 'True Shot', rank: 2 }] },
      { name: 'Warrior', circle: 4, talents: [{ name: 'True Shot', rank: 4 }] },
    ],
  };
  const m = deriveModel(charT, rules);
  const opts = m.combat.talentOptions.filter((o) => o.name === 'True Shot');
  assert.equal(opts.length, 1);
  assert.equal(opts[0].karmaDice.max, 4);
});

test('True Shot bundle carries its 2-Strain effect (folds via the pool like any option)', () => {
  const charT = {
    ...charA,
    disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'Missile Weapon', rank: 5 }, { name: 'True Shot', rank: 3 }] }],
  };
  const m = deriveModel(charT, rules);
  const ts = m.combat.talentOptions.find((o) => o.name === 'True Shot');
  const strain = ts.effects.find((e) => e.type === 'resource-modifier' && e.target?.name === 'Strain');
  assert.ok(strain);
  assert.equal(strain.value, 2);
});

// --- Mystic Aim (aim-roll talent option) --------------------------------------

test('Mystic Aim surfaces as a talent option with the talent Step injected into aimRoll', () => {
  const charT = {
    ...charA,
    disciplines: [{ name: 'Archer', circle: 5, talents: [{ name: 'Missile Weapon', rank: 5 }, { name: 'Mystic Aim', rank: 4 }] }],
  };
  const m = deriveModel(charT, rules);
  const aim = m.combat.talentOptions.find((o) => o.name === 'Mystic Aim');
  assert.ok(aim, 'Mystic Aim should be offered as a talent-scoped combat option');
  assert.deepEqual(aim.appliesTo, ['missile', 'throwing']);
  assert.equal(aim.aimRoll.vs, 'Mystic');
  assert.equal(aim.aimRoll.strain, 1);
  // Perception 14 → step 6; + rank 4 = step 10. The aim test rolls this Step.
  assert.equal(aim.aimRoll.step, 10);
  // The aim test is Karma-eligible: the talent's karma context rides aimRoll.
  assert.ok(aim.aimRoll.karma, 'aimRoll carries the talent karma context');
  // Its on-success +2-STEP perSuccess bundle effect is present (folds, scaled by
  // successes, only once armed).
  const onSuccess = aim.effects.find((e) => e.condition === 'on-success' && e.measure === 'step');
  assert.ok(onSuccess);
  assert.equal(onSuccess.value, 2);
  assert.equal(onSuccess.perSuccess, true);
});

test('Mystic Aim is absent when the talent is unowned', () => {
  const m = deriveModel(charA, rules); // charA has no Mystic Aim
  assert.ok(!m.combat.talentOptions.some((o) => o.name === 'Mystic Aim'));
});

// --- rollMods: consistent active-test-modifier surfacing across measures -------

test('rollMods badges every applied test-modifier on a skill, regardless of measure', () => {
  const shadowMeld = {
    name: 'Shadow Meld',
    effects: [
      {
        type: 'test-modifier',
        target: { domain: 'test', name: 'Stealthy Stride' },
        operation: 'add',
        value: 4,
        measure: 'step',
        duration: 'sustained',
        source: 'spell',
        summary: '+4 steps to Stealthy Stride tests while active.',
      },
      {
        type: 'test-modifier',
        target: { domain: 'test', name: 'Stealthy Stride' },
        operation: 'add',
        value: 2,
        measure: 'result',
        duration: 'sustained',
        source: 'spell',
        summary: '+2 to the result of Stealthy Stride tests.',
      },
    ],
  };
  const charS = {
    ...charA,
    skills: [{ name: 'Stealthy Stride', rank: 1 }],
  };
  const m = deriveModel(charS, rules, { activeSpells: [shadowMeld] });
  const skill = m.skills.find((s) => s.name === 'Stealthy Stride');
  assert.ok(skill, 'Stealthy Stride should be an owned skill');
  // Both measures fold and are surfaced measure-tagged — the DEX-20 base step 8
  // + rank 1 + the +4 step bonus = 13, carrying the result mod as rollMods.
  assert.equal(skill.step, 13);
  assert.deepEqual(skill.rollMods, [
    { value: 4, source: 'Shadow Meld', measure: 'step' },
    { value: 2, source: 'Shadow Meld', measure: 'result' },
  ]);
});
