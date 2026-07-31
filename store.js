// store.js — loads data and builds the derived view-model the UI renders.
//
// Phase 1 is read-only: load character.json + the rules files we need, compute
// display values, and hand a plain object to the UI. Editing, persistence, and
// the reactive cascade come in later phases.

import { attributeValue, valueToStep, talentStep, makeDiceForStep } from './engine/derive.js';

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
  const [character, steps, talentsFile, disciplinesFile] = await Promise.all([
    loadJSON('./data/character.json'),
    loadJSON('./rules/steps.json'),
    loadJSON('./rules/talents.json'),
    loadJSON('./rules/disciplines.json'),
  ]);

  // talents.json is now { schema, …, talents: { name: {…} } }.
  const talentCatalog = talentsFile.talents ?? talentsFile;
  const discByName = Object.fromEntries((disciplinesFile.disciplines ?? []).map((d) => [d.name, d]));
  const diceForStep = makeDiceForStep(steps);

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
      .flatMap((c) => (c.effects ?? []).map((e) => ({ circle: c.circle, summary: e.summary })))
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

  return {
    meta: character.meta ?? {},
    attributes,
    resources: character.resources ?? {},
    disciplines,
    skills: character.skills ?? [],
    knacks: character.knacks ?? [],
    extraTraits: character.extraTraits ?? [],
  };
}
