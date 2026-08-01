// store.js — loads data and builds the derived view-model the UI renders.
//
// Phase 1 is read-only: load character.json + the rules files we need, compute
// display values, and hand a plain object to the UI. Editing, persistence, and
// the reactive cascade come in later phases.

import { attributeValue, valueToStep, talentStep, makeDiceForStep } from './engine/derive.js';
import {
  makeCharacteristics,
  defense,
  DEFENSE_ATTRIBUTE,
  initiative,
  knockdown,
  maxKarma,
  KARMA_STEP,
  karmaUse,
} from './engine/characteristics.js';

// Relative paths so the app works from both "/" and the "/dev/" subpath.
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

/**
 * Load everything and return a derived view-model:
 * { meta, attributes[], resources, disciplines[], skills[], knacks[] }
 */
export async function loadCharacterModel() {
  const [character, steps, talentsFile, disciplinesFile, racesFile, characteristicsFile] = await Promise.all([
    loadJSON('./data/character.json'),
    loadJSON('./rules/steps.json'),
    loadJSON('./rules/talents.json'),
    loadJSON('./rules/disciplines.json'),
    loadJSON('./rules/races.json'),
    loadJSON('./rules/characteristics.json'),
  ]);

  // talents.json is now { schema, …, talents: { name: {…} } }.
  const talentCatalog = talentsFile.talents ?? talentsFile;
  const discByName = Object.fromEntries((disciplinesFile.disciplines ?? []).map((d) => [d.name, d]));
  const diceForStep = makeDiceForStep(steps);
  const stepByNumber = Object.fromEntries(steps.map((s) => [s.step, s])); // for the dice roller

  // Racial special abilities for the character's race.
  const raceEntry = (racesFile.races ?? []).find((r) => r.name === character.meta?.race);
  const racialAbilities = (raceEntry?.abilities ?? []).map((a) => ({ name: a.name, summary: a.summary }));

  // Attributes -> value/step/dice, preserving the canonical order.
  const order = ['Dexterity', 'Strength', 'Toughness', 'Perception', 'Willpower', 'Charisma'];
  const attrStepByName = {};
  const attributes = order
    .filter((name) => character.attributes?.[name])
    .map((name) => {
      const a = character.attributes[name];
      const value = attributeValue(a);
      const step = valueToStep(value);
      attrStepByName[name] = step;
      return { name, value, step, dice: diceForStep(step), ...a };
    });

  // Disciplines -> talents with derived step/dice, plus reference detail
  // (durability, half-magic, artisan skills, per-circle abilities) from rules.
  const disciplines = (character.disciplines ?? []).map((d) => {
    const ref = discByName[d.name] ?? {};
    const talents = (d.talents ?? []).map((t) => {
      const cat = talentCatalog[t.name] || {};
      const attribute = cat.attribute || null;
      const aStep = attribute ? attrStepByName[attribute] : undefined;
      const step = attribute != null && aStep != null ? talentStep(aStep, t.rank) : null;
      return {
        name: t.name,
        rank: t.rank,
        attribute,
        action: cat.action || null,
        step,
        dice: step != null ? diceForStep(step) : '',
      };
    });
    // Discipline abilities granted at circles up to the character's current circle.
    const abilities = (ref.circles ?? [])
      .filter((c) => c.circle <= d.circle)
      .flatMap((c) => (c.effects ?? []).map((e) => ({ circle: c.circle, type: e.type, summary: e.summary })))
      .filter((a) => a.summary);
    return {
      name: d.name,
      circle: d.circle,
      durability: ref.durability ?? null,
      halfMagic: ref.halfMagic?.summary ?? null,
      artisanSkills: ref.artisanSkills ?? [],
      talents,
      abilities,
    };
  });

  // Derived characteristics (Phase 3). The engine reads the ED4 Characteristics
  // Table and layers taxonomy `effects` on top. Only always-on effects auto-apply.
  // Sources the engine currently knows about: race + discipline circles reached.
  // Items / threads / spells join this list in later slices.
  const lookupChar = makeCharacteristics(characteristicsFile);
  // Each effect carries an `origin` so a modifier can name its exact source
  // (e.g. distinguish an Archer bonus from a Nethermancer one in a tooltip).
  const activeEffects = [
    ...(raceEntry?.abilities ?? []).flatMap((a) =>
      (a.effects ?? []).map((e) => ({ ...e, origin: { kind: 'race', name: raceEntry.name, ability: a.name } })),
    ),
    ...(character.disciplines ?? []).flatMap((d) =>
      ((discByName[d.name] ?? {}).circles ?? [])
        .filter((c) => c.circle <= d.circle)
        .flatMap((c) =>
          (c.effects ?? []).map((e) => ({ ...e, origin: { kind: 'discipline', name: d.name, circle: c.circle } })),
        ),
    ),
  ];
  const attrVal = (name) => attributeValue(character.attributes?.[name]);
  // Combat steps come from the governing attribute's Step (already derived above).
  const dexStep = attrStepByName.Dexterity;
  const strStep = attrStepByName.Strength;
  // Karma scales with the character's highest Discipline Circle.
  const highestCircle = Math.max(0, ...(character.disciplines ?? []).map((d) => d.circle ?? 0));
  const karmaMod = raceEntry?.karmaModifier ?? null;

  const characteristics = {
    physicalDefense: defense('Physical', attrVal(DEFENSE_ATTRIBUTE.Physical), activeEffects, lookupChar),
    mysticDefense: defense('Mystic', attrVal(DEFENSE_ATTRIBUTE.Mystic), activeEffects, lookupChar),
    socialDefense: defense('Social', attrVal(DEFENSE_ATTRIBUTE.Social), activeEffects, lookupChar),
    initiative: initiative(dexStep, activeEffects),
    knockdown: knockdown(strStep, activeEffects),
    karma:
      karmaMod != null
        ? {
            max: maxKarma(karmaMod, highestCircle),
            available: character.resources?.karma?.available ?? null,
            step: KARMA_STEP,
          }
        : null,
  };

  // Karma-use eligibility per rollable (a test may spend Karma only where a
  // grant-karma-use permission covers it). Attribute tests match by name;
  // Initiative matches its granted test. Deferred: talent tests (default-eligible).
  attributes.forEach((a) => {
    a.karma = karmaUse(a.name, activeEffects);
  });
  if (characteristics.initiative) {
    characteristics.initiative.karma = karmaUse('Initiative', activeEffects);
  }

  return {
    meta: character.meta ?? {},
    attributes,
    resources: character.resources ?? {},
    disciplines,
    racialAbilities,
    characteristics,
    stepByNumber,
    skills: character.skills ?? [],
    knacks: character.knacks ?? [],
    traits: character.traits ?? [],
  };
}
