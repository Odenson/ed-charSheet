// engine/new-character.js — pure, DOM-free builder for a brand-new Circle-1 character
// (create-new-adept). It turns { name, race, discipline } plus the rule files into an
// `ed-character/2` object: racial attributes, a Circle-1 Discipline holding only the seeded
// Durability and Karma Ritual, the starting kit and 100 silver, and the additive `creation`
// block that opens creation mode (ARCHITECTURE.md §4.1).
//
// "Store only inputs": nothing derived is written — no Step, Value, Max Karma, Legend total
// or free-talent row (free talents and the five Circle-1 Discipline Talents are derived /
// Rank 0 and stay unrecorded until creation mode spends points on them). The id helpers here
// are the only place a character name becomes an id; the views call them, never reimplement.

import { maxKarma } from './characteristics.js';
import { freeKey } from './creation.js';

/** Starting silver (rules.md R8). */
export const STARTING_SILVER = 100;

/**
 * The starting kit (rules.md R8): owned-item shape `{ name, equipped }`, each name resolvable
 * in rules/items.json. Dagger and Traveler's Garb start equipped; the rest are carried.
 */
export const STARTING_KIT = [
  { name: 'Adventuring Kit', equipped: false },
  { name: 'Dagger', equipped: true },
  { name: "Traveler's Garb", equipped: true },
  { name: 'Trail Rations (1 week)', equipped: false },
];

/** A magician also starts with a Grimoire (rules.md R8/R9; house stat block, cost 0). */
export const GRIMOIRE = { name: 'Grimoire', equipped: false };

const ID_MAX = 64;

/**
 * The id for a character name: NFKD-normalised, combining marks stripped, lower-cased, runs
 * of anything outside `[a-z0-9]` collapsed to one `-`, trimmed, cut to 64, trimmed again (the
 * cut can expose a hyphen). A name with no Latin letters or digits falls back to
 * `'character'`. Always matches the worker's `^[a-z0-9][a-z0-9-]{0,63}$`.
 */
export function slugifyId(name) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ID_MAX)
    .replace(/-+$/g, '');
  return slug || 'character';
}

/**
 * True when `id` is already in `takenIds` (any iterable of ids — an array or a Set; the index
 * ids plus the draft ids). An exact match only: the id is already a slug, and there is NO
 * suffixing, ever (owner decision, plans/create-new-adept/qa-log.md).
 */
export function idTaken(id, takenIds) {
  if (takenIds == null) return false;
  if (typeof takenIds.has === 'function') return takenIds.has(id) === true;
  for (const t of takenIds) if (t === id) return true;
  return false;
}

/**
 * Validate a typed character name against the taken ids. Returns codes only — the views
 * compose the wording: `{ ok, id, reason }` with `reason` null, `'empty'` (blank after
 * trimming) or `'taken'` (the slug clashes; `id` names the clashing id so "Kolon" and
 * "kolon!" are explained). The name is trimmed before slugging.
 */
export function validateNewName(name, takenIds) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return { ok: false, id: '', reason: 'empty' };
  const id = slugifyId(trimmed);
  if (idTaken(id, takenIds)) return { ok: false, id, reason: 'taken' };
  return { ok: true, id, reason: null };
}

/**
 * Build the Circle-1 draft character. `rules` is `{ racesFile, disciplinesFile,
 * attributesFile }` (the parsed rules/*.json); `karmaMaxCap` is the race's house Karma cap
 * (rules/homebrew.json `karma.maxCap`) or null. Throws `Error('unknown race')` /
 * `Error('unknown discipline')` for a name the files do not list. Pure: the rules are never
 * mutated and nothing is shared between two builds.
 *
 * Max Karma starts full (R4): `resources.karma.converted` is seeded to
 * `min(Karma Modifier × 1, cap)`; the unused-attribute bonus joins it at Finish.
 */
export function buildNewCharacter({ name, race, discipline }, rules, { karmaMaxCap = null } = {}) {
  const raceEntry = (rules?.racesFile?.races ?? []).find((r) => r.name === race);
  if (!raceEntry) throw new Error('unknown race');
  const disciplineEntry = (rules?.disciplinesFile?.disciplines ?? []).find((d) => d.name === discipline);
  if (!disciplineEntry) throw new Error('unknown discipline');

  const trimmed = String(name ?? '').trim();
  const circleOne = (disciplineEntry.circles ?? []).find((c) => c.circle === 1) ?? {};
  // A magician holds Spellcasting among its Circle-1 Discipline Talents (the engine's own
  // caster test, engine/spells.js) — not `halfMagic`, which every Discipline carries.
  const magician = (circleOne.talents ?? []).includes('Spellcasting');
  const matrixCount = (circleOne.freeTalents ?? []).filter((n) => n === 'Standard Matrix').length;

  const order = rules?.attributesFile?.order ?? Object.keys(raceEntry.startingAttributes ?? {});
  const attributes = Object.fromEntries(
    order.map((n) => [n, { base: raceEntry.startingAttributes?.[n], points: 0, increases: 0 }]),
  );

  return {
    schema: 'ed-character/2',
    meta: { id: slugifyId(trimmed), name: trimmed, race },
    attributes,
    disciplines: [
      {
        name: discipline,
        circle: 1,
        talents: [
          { name: 'Durability', rank: 1, circle: 1 },
          { name: 'Karma Ritual', rank: 1, circle: 1 },
        ],
      },
    ],
    skills: [],
    knacks: [],
    traits: [],
    resources: {
      karma: { converted: maxKarma(raceEntry.karmaModifier, 1, karmaMaxCap) ?? 0, spent: 0 },
      legend: { earned: [] },
      health: { damage: 0, wounds: 0, recoveriesUsed: 0 },
    },
    items: [...STARTING_KIT, ...(magician ? [GRIMOIRE] : [])].map((it) => ({ ...it })),
    wealth: {
      coins: { copper: 0, silver: STARTING_SILVER, gold: 0, earth: 0, water: 0, air: 0, fire: 0, orichalcum: 0 },
      gems: [],
    },
    ...(magician
      ? { spells: { known: [], matrices: Array.from({ length: matrixCount }, () => ({ type: 'Standard', spell: null })) } }
      : {}),
    creation: {
      open: true,
      free: {
        talents: { [freeKey(discipline, 'Durability')]: 1, [freeKey(discipline, 'Karma Ritual')]: 1 },
        skills: {},
        spells: [],
      },
    },
  };
}
