// store.js — loads data and builds the derived view-model the UI renders.
//
// Load character.json + the rules files we need, compute display values, and
// hand a plain object to the UI. Phase 2 adds editing of *inputs*: edits are
// dispatched up to the app layer, persisted here, and the model is re-derived
// from inputs (data flows back down). Derived values are never stored.

import { attributeValue, valueToStep, talentStep, makeDiceForStep } from './engine/derive.js';
import { deriveWealth } from './engine/wealth.js';
import {
  makeCharacteristics,
  defense,
  DEFENSE_ATTRIBUTE,
  physicalArmor,
  mysticArmor,
  adeptHealthEffects,
  unconsciousnessRating,
  deathRating,
  recoveryTests,
  carryingCapacity,
  initiative,
  knockdown,
  maxKarma,
  KARMA_STEP,
  karmaUse,
  talentKarmaUse,
} from './engine/characteristics.js';

// Talents every adept receives automatically at First Circle, regardless of
// Discipline — so they count as "required" (Discipline) talents, not options.
const UNIVERSAL_TALENTS = new Set(['Durability', 'Karma Ritual']);

// Relative paths so the app works from both "/" and the "/dev/" subpath.
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// The character file is source info, not app code: a serverless save commits it
// to the `character-data` branch, which the deploy workflow does not watch, so
// a save never rebuilds the app (docs/GITHUB-SERVERLESS-SAVE.md §3). On the
// Pages site we read it LIVE from that branch so a save shows up immediately;
// everywhere else (local dev, file://) we read the working copy in the bundle.
const CHARACTER_OWNER = 'odenson';
const CHARACTER_REPO = 'ed-charSheet';
const CHARACTER_BRANCH = 'character-data';

function onPages() {
  return location.protocol === 'https:' && location.hostname.endsWith('.github.io');
}

function characterDataUrl() {
  return onPages()
    ? `https://raw.githubusercontent.com/${CHARACTER_OWNER}/${CHARACTER_REPO}/${CHARACTER_BRANCH}/data/character.json`
    : './data/character.json';
}

async function loadCharacterData() {
  const base = characterDataUrl();
  if (base === './data/character.json') return loadJSON(base);
  try {
    // Cache-bust the raw CDN (~5-min edge TTL): without a unique query the edge
    // may serve a stale copy, so a fresh serverless save wouldn't show up until
    // the TTL lapsed. A per-load timestamp forces a cache miss and a fresh read.
    return await loadJSON(`${base}?t=${Date.now()}`);
  } catch {
    // No save on the data branch yet (or raw is unreachable): fall back to the
    // deployed copy rather than failing the whole app.
    return loadJSON('./data/character.json');
  }
}

// --- Persistence (Phase 2) -------------------------------------------------
// ARCHITECTURE §7/§10: localStorage now, file export/import later. We store an
// *edits overlay* — only the inputs the player changed — not a whole character
// snapshot. The repo's character.json stays the source of truth for everything
// untouched; the overlay is merged on top at load. "Store only inputs" holds:
// meta fields are raw inputs, never derived values.
const EDITS_KEY = 'ed-character-edits';

function loadEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') || {};
  } catch {
    return {}; // corrupt/absent overlay must never block loading the character
  }
}

/** Merge a `meta` patch into the saved edits overlay and persist it. */
export function saveMetaEdits(patch) {
  const edits = loadEdits();
  edits.meta = { ...(edits.meta || {}), ...patch };
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's item list to the edits overlay. Items are pure inputs
 * — a name (referencing rules/items.json) plus per-instance state like
 * `equipped` — so the whole array is stored as-is; the reference stats stay in
 * the catalog. "Store only inputs, never derived" holds.
 */
export function saveItemEdits(items) {
  const edits = loadEdits();
  edits.items = items;
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's wealth to the edits overlay. Wealth is pure input —
 * coin counts and gems ({ name, valueSilver, qty }) — so it's stored as-is; the
 * per-coin silver value, running total, and gem resale are derived at render
 * time (deriveWealth), never stored. "Store only inputs, never derived" holds.
 */
export function saveWealthEdits(wealth) {
  const edits = loadEdits();
  edits.wealth = wealth;
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  return edits;
}

// The overlay categories a save persists to GitHub. Reconciliation and the
// dirty indicator both reason over exactly these keys.
const SAVED_CATEGORIES = ['meta', 'items', 'wealth'];

/**
 * True when the overlay holds edits not yet committed to GitHub. Drives the
 * Save button's unsaved indicator: any local edit sets a category; a successful
 * save clears them (reconcileOverlay), so this reads false again. Survives a
 * reload, so an edit made but never saved still shows as unsaved.
 */
export function hasPendingEdits() {
  const edits = loadEdits();
  return SAVED_CATEGORIES.some((k) => edits[k] != null);
}

/**
 * After a confirmed GitHub save the branch holds these exact inputs, so the
 * overlay's saved categories are now redundant — and would mask the branch on
 * the next (cache-busted) load, including edits saved from another device
 * (design §4.5). Clear them so the branch read becomes the source of truth.
 * Call only on save success.
 */
export function reconcileOverlay(categories = SAVED_CATEGORIES) {
  const edits = loadEdits();
  for (const k of categories) delete edits[k];
  if (Object.keys(edits).length) localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  else localStorage.removeItem(EDITS_KEY);
  return edits;
}

/** Apply the saved edits overlay onto a freshly-fetched character. */
function applyEdits(character, edits) {
  if (!edits) return character;
  let next = character;
  if (edits.meta) next = { ...next, meta: { ...(next.meta || {}), ...edits.meta } };
  if (edits.items) next = { ...next, items: edits.items };
  if (edits.wealth) next = { ...next, wealth: edits.wealth };
  return next;
}

/**
 * Fetch the character (with any saved edits overlaid) and the rules files.
 * Returns { character, rules } — the raw *inputs* the app layer holds and
 * re-derives from. Keep this separate from deriveModel so an edit can rebuild
 * the model without re-fetching.
 */
export async function loadCharacter() {
  const [character, steps, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile] = await Promise.all([
    loadCharacterData(),
    loadJSON('./rules/steps.json'),
    loadJSON('./rules/talents.json'),
    loadJSON('./rules/disciplines.json'),
    loadJSON('./rules/races.json'),
    loadJSON('./rules/characteristics.json'),
    loadJSON('./rules/items.json'),
  ]);
  const rules = { steps, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile };
  return { character: applyEdits(character, loadEdits()), rules };
}

/**
 * Derive the view-model the UI renders from raw inputs (pure — no fetch, no DOM):
 * { meta, attributes[], resources, disciplines[], skills[], knacks[] }
 */
export function deriveModel(character, rules) {
  const { steps, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile } = rules;

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
    // "Required" (Discipline) talents = every talent the Discipline grants at any
    // circle (its per-circle `talents` + `freeTalents`), plus Durability and Karma
    // Ritual which every adept receives automatically. Anything else the character
    // knows here was a chosen Talent Option (optional). Data-driven from
    // disciplines.json; no separate flag on the character's talents.
    const requiredTalents = new Set([
      ...UNIVERSAL_TALENTS,
      ...(ref.circles ?? []).flatMap((c) => [...(c.talents ?? []), ...(c.freeTalents ?? [])]),
    ]);
    const talents = (d.talents ?? []).map((t) => {
      const cat = talentCatalog[t.name] || {};
      const attribute = cat.attribute || null;
      const aStep = attribute ? attrStepByName[attribute] : undefined;
      const step = attribute != null && aStep != null ? talentStep(aStep, t.rank) : null;
      // Talent tests are Karma-eligible by default (core rule); only rollable
      // talents (those with a step) carry a karma context. The talent catalog may
      // opt out (`karma: false`), as may a Versatility-learned instance.
      const karma = step != null ? talentKarmaUse({ karma: cat.karma, viaVersatility: t.viaVersatility }) : null;
      return {
        name: t.name,
        rank: t.rank,
        attribute,
        action: cat.action || null,
        step,
        dice: step != null ? diceForStep(step) : '',
        karma,
        required: requiredTalents.has(t.name),
        // Terse one-line effect for the Effect column, and the paraphrased detail
        // the info modal shows. `documented` is false for talents not yet enriched
        // (the modal then shows only the basics we have).
        brief: cat.brief || null,
        detail: {
          summary: cat.summary || null,
          versus: cat.versus || null,
          strain: cat.strain ?? null,
          tier: cat.tier || t.tier || null,
          skillUse: cat.skillUse || null,
          notes: (cat.effects || []).map((e) => e.summary).filter(Boolean),
          documented: !!cat.summary,
        },
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

  // Equipment (Phase 3, armour slice). The character owns items by name; their
  // mechanics live in the rules/items.json catalog as taxonomy `effects`. Resolve
  // each owned item against the catalog for display, and gather the effects of
  // *equipped* items so they fold onto armour/defence/initiative exactly like
  // racial and discipline effects. Unknown names degrade gracefully (kept, but
  // contribute nothing) so a typo or a future custom item never breaks the sheet.
  const itemCatalog = itemsFile?.items ?? {};
  const items = (character.items ?? []).map((owned) => {
    const ref = itemCatalog[owned.name] ?? null;
    const equipped = owned.equipped !== false; // default to equipped
    return {
      name: owned.name,
      equipped,
      known: ref != null,
      kind: ref?.kind ?? owned.kind ?? 'item',
      living: ref?.living ?? false,
      ref: ref?.ref ?? {},
      effects: ref?.effects ?? owned.effects ?? [],
      // Display-only strings for the UI (never engine-read). See rules/items.json
      // notes.presentation — carries the tile's curated `shortEffect` for note items.
      presentation: ref?.presentation ?? {},
    };
  });

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
    // Only equipped items contribute — unequipping is just dropping the effects.
    ...items
      .filter((it) => it.equipped)
      .flatMap((it) => it.effects.map((e) => ({ ...e, origin: { kind: 'item', name: it.name } }))),
  ];
  const attrVal = (name) => attributeValue(character.attributes?.[name]);
  // Combat steps come from the governing attribute's Step (already derived above).
  const dexStep = attrStepByName.Dexterity;
  const strStep = attrStepByName.Strength;
  // Karma scales with the character's highest Discipline Circle.
  const highestCircle = Math.max(0, ...(character.disciplines ?? []).map((d) => d.circle ?? 0));
  const karmaMod = raceEntry?.karmaModifier ?? null;

  // Health ratings (Toughness). Death/Unconsciousness gain the adept bonuses
  // (Durability × rank, and +Circle on Death) — the engine synthesizes those as
  // effects from these per-Discipline inputs: the Discipline's Durability value
  // paired with the rank of its Durability talent (a value with no ranks in the
  // talent contributes nothing). Folded alongside any always-on health effects.
  const healthDisciplines = (character.disciplines ?? []).map((d) => ({
    name: d.name,
    circle: d.circle ?? 0,
    durability: (discByName[d.name] ?? {}).durability ?? 0,
    durabilityRank: (d.talents ?? []).find((t) => t.name === 'Durability')?.rank ?? 0,
  }));
  const healthEffects = [...activeEffects, ...adeptHealthEffects(healthDisciplines)];
  const touVal = attrVal('Toughness');

  const characteristics = {
    physicalDefense: defense('Physical', attrVal(DEFENSE_ATTRIBUTE.Physical), activeEffects, lookupChar),
    mysticDefense: defense('Mystic', attrVal(DEFENSE_ATTRIBUTE.Mystic), activeEffects, lookupChar),
    socialDefense: defense('Social', attrVal(DEFENSE_ATTRIBUTE.Social), activeEffects, lookupChar),
    physicalArmor: physicalArmor(activeEffects),
    mysticArmor: mysticArmor(attrVal('Willpower'), activeEffects, lookupChar),
    unconsciousness: unconsciousnessRating(touVal, healthEffects, lookupChar),
    death: deathRating(touVal, healthEffects, lookupChar),
    recoveries: recoveryTests(touVal, healthEffects, lookupChar),
    carryingCapacity: carryingCapacity(attrVal('Strength'), activeEffects, lookupChar),
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
    items,
    itemCatalog,
    // Wealth: pass the stored inputs through the pure deriver so the view gets
    // coin/gem silver values, the running total and the resale hint (all derived).
    wealth: deriveWealth(character.wealth ?? {}),
    skills: character.skills ?? [],
    knacks: character.knacks ?? [],
    traits: character.traits ?? [],
  };
}
