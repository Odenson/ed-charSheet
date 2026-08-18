// store.js — loads data and builds the derived view-model the UI renders.
//
// Load the grouped character store (data/characters.json) + the rules files we
// need, compute display values, and hand a plain object to the UI. Phase 2 adds
// editing of *inputs*: edits are dispatched up to the app layer, persisted here,
// and the model is re-derived from inputs (data flows back down). Derived values
// are never stored.

import { attributeValue, valueToStep, talentStep, makeDiceForStep } from './engine/derive.js';
import { deriveWealth } from './engine/wealth.js';
import { legendAvailable, legendaryStatus } from './engine/legend.js';
import { auditLegendSpent, talentRankStepCost, skillRankStepCost, lowestDisciplineCircle } from './engine/legend-spent.js';
import { damageState, KNOCKED_DOWN_EFFECT, KNOCKED_DOWN_DEFENSE_EFFECTS } from './engine/health.js';
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
  woundThreshold,
  carryingCapacity,
  movementRate,
  initiative,
  knockdown,
  maxKarma,
  KARMA_STEP,
  karmaUse,
  talentKarmaUse,
  collapseByTarget,
} from './engine/characteristics.js';
import { carriedWeight, parseWeight } from './engine/weight.js';
import { encumbranceStage, encumbranceEffects, ENCUMBRANCE } from './engine/encumbrance.js';
import { foldAbilityGrants } from './engine/ability-ranks.js';
import { buildSpellsContext } from './engine/spells.js';
import { applyCustomEdits, loadCustomEdits } from './store-custom-items.js';

// Talents every adept receives automatically at First Circle, regardless of
// Discipline — so they count as "required" (Discipline) talents, not options.
const UNIVERSAL_TALENTS = new Set(['Durability', 'Karma Ritual']);

// Relative paths so the app works from both "/" and the "/dev/" subpath.
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// Like loadJSON but tolerant of a missing file — for a rules catalog that may not be
// authored yet (e.g. rules/knacks.json). Returns `fallback` instead of throwing.
async function loadJSONOptional(path, fallback) {
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

// Resolve one owned knack against the knack catalog (rules/knacks.json), mirroring how
// items resolve. A knack references a catalog entry by `name` and optionally names the
// parent it hangs off via `via` (when the catalog lists several). The catalog supplies
// the fixed rules — parent(s), requiredRank (its Legend cost), action, description.
// A catalog parent is a NAME-ONLY binding key: the Companion lets a knack be governed
// by the skill OR the talent of the same name, so which kind binds is resolved here
// against the character's owned abilities — owned as a talent → 'talent', else owned
// as a skill → 'skill', else the Companion's default labeling ('talent').
// Transitional fallback: if there's no catalog entry and the name is the legacy
// "Knack (Parent)" string, parse the parent out here — the ONE place that parsing
// lives, so consumers always get a structured knack. `skillNames`/`talentNames` are
// the character's owned skill/talent names, used to tag the parent's kind.
export function resolveKnack(owned, catalog = {}, skillNames = new Set(), talentNames = new Set()) {
  const ref = catalog[owned.name] ?? null;
  let name = owned.name;
  let parent = null;
  const parentOf = (p) => {
    const pname = typeof p === 'string' ? p : p?.name ?? null;
    if (!pname) return null;
    const type = talentNames.has(pname) ? 'talent' : skillNames.has(pname) ? 'skill' : 'talent';
    return { type, name: pname };
  };
  if (ref) {
    const chosen = owned.via
      ? (ref.parents ?? []).find((p) => (typeof p === 'string' ? p : p.name) === owned.via)
      : (ref.parents ?? [])[0];
    parent = parentOf(chosen);
  } else {
    const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(owned.name ?? '');
    if (m) {
      name = m[1].trim();
      parent = parentOf(m[2].trim());
    }
  }
  return {
    name,
    rawName: owned.name,
    known: ref != null,
    parent,
    requiredRank: ref?.requiredRank ?? owned.rank ?? null,
    action: ref?.action ?? null,
    brief: ref?.brief ?? null,
    detail: { summary: ref?.summary ?? null, strain: ref?.strain ?? null, documented: !!ref?.summary },
  };
}

// The character store is source info, not app code: a serverless save commits it
// to the `character-data` branch, which the deploy workflow does not watch, so a
// save never rebuilds the app (docs/GITHUB-SERVERLESS-SAVE.md §3). The bundle
// ships no character data — `data/characters/<id>.json` (one raw ed-character/1
// file per character), the discovery index `data/characters/index.json`, and the
// portrait images live only on that branch (PLAN-SAVE-CONCURRENCY). On the Pages
// site we read them LIVE from the branch so a save shows up immediately;
// everywhere else (local dev, file://) we read the local working copies, which
// are gitignored (see .gitignore / WORKFLOW.md).
const CHARACTER_OWNER = 'odenson';
const CHARACTER_REPO = 'ed-charSheet';
const CHARACTER_BRANCH = 'character-data';
const CHARACTERS_DIR = 'data/characters';

function onPages() {
  return location.protocol === 'https:' && location.hostname.endsWith('.github.io');
}

const CONTENTS_API = `https://api.github.com/repos/${CHARACTER_OWNER}/${CHARACTER_REPO}/contents/${CHARACTERS_DIR}`;
const RAW_CDN = `https://raw.githubusercontent.com/${CHARACTER_OWNER}/${CHARACTER_REPO}/${CHARACTER_BRANCH}/${CHARACTERS_DIR}`;

// Normalize a contents-API `Accept: raw` ETag to the bare git blob sha — the
// ETag equals the blob sha (confirmed 2026-08-12), wrapped in HTTP framing
// (`"sha"` or `W/"sha"`). Strip the framing; a missing/malformed ETag yields
// null so the save degrades to the overwrite path — never an error (plan
// Decision 3, ETag hardening).
export function baseFromEtag(etag) {
  if (typeof etag !== 'string') return null;
  const bare = etag.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
  return /^[0-9a-fA-F]{40}$/.test(bare) ? bare.toLowerCase() : null;
}

// Parse the discovery index (ed-characters-index/1) into the picker's row list
// `[{ id, name, portrait }]`, sorted by id for a stable order. An entry's name
// falls back to the id; portrait stays optional (absent → the UI's name-initial
// placeholder). The index is discovery only — never trusted for save bases.
export function indexToRows(index) {
  return Object.entries(index?.characters ?? {})
    .map(([id, entry]) => ({ id, name: entry?.name ?? id, portrait: entry?.portrait ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Resolve a `meta.portrait` path (e.g. `data/chakka.jpg`) to a loadable URL.
// On the Pages site the portrait lives on the character-data branch like the
// character store (the bundle ships no character data), so we hit the raw CDN
// directly — a static repo asset doesn't need the git-consistent contents API
// tier that the store does (docs/GITHUB-SERVERLESS-SAVE.md §4.5). Locally the
// working copy is served from the bundle. The UI handles a load failure with
// its placeholder fallback (docs/UI-GUIDELINES.md §6).
export function portraitUrlFor(portrait) {
  if (!portrait) return null;
  if (onPages()) return `https://raw.githubusercontent.com/${CHARACTER_OWNER}/${CHARACTER_REPO}/${CHARACTER_BRANCH}/${portrait}`;
  return `./${portrait}`;
}

// Discover the available characters from the discovery index
// (data/characters/index.json, ed-characters-index/1) → `[{ id, name, portrait }]`
// — the picker's one-fetch list. On the Pages site, read the index LIVE from the
// character-data branch: prefer the GitHub **contents API** (`Accept: raw`; it
// reads the git database directly, so a just-saved commit is visible immediately)
// with the **raw CDN** as a cache-busted fallback (its ~5-minute path-keyed
// cache can race a save-then-reload; the `?t=` query doesn't reliably bust it,
// so the API is the primary). Elsewhere read the gitignored
// `./data/characters/index.json` working copy. There is deliberately **no legacy
// grouped-store fallback** (plan Decision 6): a missing index is a
// not-yet-migrated store and surfaces a clear error, never a silent legacy read.
export async function listCharacters() {
  let index;
  if (!onPages()) return indexToRows(await loadJSON(`./${CHARACTERS_DIR}/index.json`));
  try {
    const res = await fetch(`${CONTENTS_API}/index.json?ref=${CHARACTER_BRANCH}`, {
      headers: { Accept: 'application/vnd.github.raw' },
      cache: 'no-store',
    });
    if (res.ok) index = await res.json(); // git-consistent: reflects the latest save
  } catch {
    /* network/CORS hiccup — fall through to the CDN */
  }
  if (!index) index = await loadJSON(`${RAW_CDN}/index.json?t=${Date.now()}`);
  return indexToRows(index);
}

// Read one character file: `{ character, base }` (the raw ed-character/1 entry).
// On Pages prefer the contents API (`Accept: raw` — git-consistent) and capture
// the **base sha from the response ETag** (confirmed == blob sha) for the save's
// optimistic-concurrency check; fall back to the cache-busted raw CDN, which
// carries no usable ETag ⇒ `base = null` (the save then takes the overwrite
// path — accepted caveat, plan Decision 5). A 404 from either is an "unknown
// character" error (thrown), never a silent legacy read.
async function readCharacterFile(id) {
  if (!onPages()) return { character: await loadJSON(`./${CHARACTERS_DIR}/${id}.json`), base: null };
  try {
    const res = await fetch(`${CONTENTS_API}/${id}.json?ref=${CHARACTER_BRANCH}`, {
      headers: { Accept: 'application/vnd.github.raw' },
      cache: 'no-store',
    });
    if (res.ok) return { character: await res.json(), base: baseFromEtag(res.headers.get('ETag')) };
  } catch {
    /* network/CORS hiccup — fall through to the CDN */
  }
  return { character: await loadJSON(`${RAW_CDN}/${id}.json?t=${Date.now()}`), base: null };
}

const CUSTOM_ITEMS_API_URL = `https://api.github.com/repos/${CHARACTER_OWNER}/${CHARACTER_REPO}/contents/data/custom-items.json?ref=${CHARACTER_BRANCH}`;
const CUSTOM_ITEMS_RAW_URL = `https://raw.githubusercontent.com/${CHARACTER_OWNER}/${CHARACTER_REPO}/${CHARACTER_BRANCH}/data/custom-items.json`;

/**
 * Load the player-created custom-item catalog (ed-items/2, PLAN-CUSTOM-ITEMS).
 * Mirrors loadCharacters: on Pages read `data/custom-items.json` LIVE from the
 * character-data branch — contents API first (git-consistent, reflects the
 * latest /save-items commit), raw CDN cache-busted fallback — and the bundled
 * `rules/custom-items.json` as the offline fallback (unlike the character store
 * the bundle may carry a folded copy). Elsewhere read the gitignored
 * `./data/custom-items.json` working copy, then the bundled catalog. Never
 * throws: a missing/unreadable catalog is an empty one.
 */
export async function loadCustomItems() {
  const bundled = () => loadJSONOptional('./rules/custom-items.json', { schema: 'ed-items/2', items: {} });
  if (!onPages()) return (await loadJSONOptional('./data/custom-items.json', null)) ?? bundled();
  try {
    const res = await fetch(CUSTOM_ITEMS_API_URL, {
      headers: { Accept: 'application/vnd.github.raw' },
      cache: 'no-store',
    });
    if (res.ok) return await res.json(); // git-consistent: reflects the latest save
  } catch {
    /* network/CORS hiccup — fall through to the CDN */
  }
  try {
    const res = await fetch(`${CUSTOM_ITEMS_RAW_URL}?t=${Date.now()}`);
    if (res.ok) return await res.json();
  } catch {
    /* fall through to the bundled catalog */
  }
  return bundled();
}

// --- Persistence (Phase 2) -------------------------------------------------
// ARCHITECTURE §7/§10: localStorage now, file export/import later. We store an
// *edits overlay* — only the inputs the player changed — not a whole character
// snapshot. The branch store stays the source of truth for everything
// untouched; the overlay is merged on top at load. "Store only inputs" holds:
// meta fields are raw inputs, never derived values. Overlays are keyed per
// character id (`ed-character-edits:<id>`), so each character's local draft is
// isolated and survives switching between characters.
function editsKey(id) {
  return `ed-character-edits:${id}`;
}

function loadEdits(id) {
  try {
    return JSON.parse(localStorage.getItem(editsKey(id)) || '{}') || {};
  } catch {
    return {}; // corrupt/absent overlay must never block loading the character
  }
}

/** Merge a `meta` patch into the saved edits overlay for `id` and persist it. */
export function saveMetaEdits(patch, id) {
  const edits = loadEdits(id);
  edits.meta = { ...(edits.meta || {}), ...patch };
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's item list to the edits overlay. Items are pure inputs
 * — a name (referencing rules/items.json) plus per-instance state like
 * `equipped` — so the whole array is stored as-is; the reference stats stay in
 * the catalog. "Store only inputs, never derived" holds.
 */
export function saveItemEdits(items, id) {
  const edits = loadEdits(id);
  edits.items = items;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's wealth to the edits overlay. Wealth is pure input —
 * coin counts and gems ({ name, valueSilver, qty }) — so it's stored as-is; the
 * per-coin silver value, running total, and gem resale are derived at render
 * time (deriveWealth), never stored. "Store only inputs, never derived" holds.
 */
export function saveWealthEdits(wealth, id) {
  const edits = loadEdits(id);
  edits.wealth = wealth;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's spells block to the edits overlay (PLAN-SPELLS §4).
 * Pure inputs: `known` (learnt spells + learntSuccess) and `matrices` (which
 * spell each matrix holds). Stored whole like items/wealth — steps, difficulties
 * and effect numbers are all derived in engine/spells.js, never stored.
 */
export function saveSpellEdits(spells, id) {
  const edits = loadEdits(id);
  edits.spells = spells;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist a single trade to the edits overlay (plans/PLAN-TRADE-ITEMS.md): one
 * write for BOTH the item list and the resulting wealth purse, so a buy/sell is
 * stored atomically and the app can run one re-derive. Both categories are the
 * exact input shapes `saveItemEdits` / `saveWealthEdits` write — no trade ledger,
 * no price fields (the accepted amount was a session fact, never a property of
 * the item). "Store only inputs, never derived" holds.
 */
export function saveTradeEdits({ items, wealth }, id) {
  const edits = loadEdits(id);
  edits.items = items;
  edits.wealth = wealth;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's health inputs to the edits overlay. Health is pure
 * input — current Damage, Wounds, and Recovery tests used today — so the object
 * is stored as-is; the ratings and the conscious/dead standing are derived by
 * the engine (store.js + engine/health.js), never stored. "Store only inputs,
 * never derived" holds.
 */
export function saveHealthEdits(health, id) {
  const edits = loadEdits(id);
  edits.health = health;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's Karma resource to the edits overlay. `resources.karma`
 * is a set of stored *inputs* (the ledger — `converted`, lifetime gained, and
 * `spent`, lifetime spent; see PLAN-LEGEND-KARMA-RITUAL-LOG.md). The spendable
 * balance and the `max`/`step` figures are derived and never stored, so only the
 * input object is written as-is. "Store only inputs" holds. A later save
 * replaces the whole object (health precedent).
 */
export function saveKarmaEdits(karma, id) {
  const edits = loadEdits(id);
  edits.karma = karma;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's advancement inputs (ranked talents + skills) to the
 * edits overlay. Both arrays are pure input — each discipline's circle and its
 * talents' { name, rank, tier, circle }, and each skill's { name, rank, tier } —
 * so the whole arrays are stored as-is; every step and dice figure is derived
 * by the engine, never stored. "Store only inputs, never derived" holds, and a
 * later save replaces the whole arrays (items/wealth precedent — a partial
 * patch must never drop the recorded ranks on replay).
 */
export function saveAdvancementEdits({ disciplines, skills }, id) {
  const edits = loadEdits(id);
  edits.advancements = { disciplines, skills };
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's hand-written notes to the edits overlay (PLAN-NOTES-
 * TAB). Notes are pure input — free-form `{ id, text, updatedAt }` cards — so
 * the whole array is stored as-is; nothing is derived from it.
 */
export function saveNotesEdits(notes, id) {
  const edits = loadEdits(id);
  edits.notes = notes;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's event timeline to the edits overlay (PLAN-NOTES-TAB).
 * History entries are pure input — dated `{ id, date, text }` events — so the
 * whole array is stored as-is; reverse-chronological ordering is a render
 * concern, never stored.
 */
export function saveHistoryEdits(history, id) {
  const edits = loadEdits(id);
  edits.history = history;
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

/**
 * Persist the character's Legend-earned entries to the edits overlay (PLAN-
 * NOTES-TAB, decisions #1/#6). Only the real `{ id, amount, description, date }`
 * entries ride the overlay — the legacy `totalEarnt` input stays in the branch
 * file (surfaced as a derived virtual "Starting total" row by deriveModel) and
 * is never written here. The overlay stores the FULL `earned` array (items/
 * wealth/advancements precedent — a partial patch must never drop entries).
 */
export function saveLegendEdits(earned, id) {
  const edits = loadEdits(id);
  edits.legend = { earned };
  localStorage.setItem(editsKey(id), JSON.stringify(edits));
  return edits;
}

// The overlay categories a save persists to GitHub. Reconciliation and the
// dirty indicator both reason over exactly these keys.
const SAVED_CATEGORIES = ['meta', 'items', 'wealth', 'health', 'karma', 'advancements', 'notes', 'history', 'legend'];

/**
 * True when the overlay for `id` holds edits not yet committed to GitHub.
 * Drives the Save button's unsaved indicator: any local edit sets a category; a
 * successful save clears them (reconcileOverlay), so this reads false again.
 * Survives a reload, so an edit made but never saved still shows as unsaved.
 */
export function hasPendingEdits(id) {
  const edits = loadEdits(id);
  return SAVED_CATEGORIES.some((k) => edits[k] != null);
}

/**
 * After a confirmed GitHub save the branch holds these exact inputs, so the
 * overlay's saved categories are now redundant — and would mask the branch on
 * the next (cache-busted) load, including edits saved from another device
 * (design §4.5). Clear them so the branch read becomes the source of truth.
 * Call only on save success.
 */
export function reconcileOverlay(categories = SAVED_CATEGORIES, id) {
  const edits = loadEdits(id);
  for (const k of categories) delete edits[k];
  if (Object.keys(edits).length) localStorage.setItem(editsKey(id), JSON.stringify(edits));
  else localStorage.removeItem(editsKey(id));
  return edits;
}

/** Apply the saved edits overlay onto a freshly-fetched character. */
export function applyEdits(character, edits) {
  if (!edits) return character;
  let next = character;
  if (edits.meta) next = { ...next, meta: { ...(next.meta || {}), ...edits.meta } };
  if (edits.items) next = { ...next, items: edits.items };
  if (edits.wealth) next = { ...next, wealth: edits.wealth };
  // Spells block (known[] + matrices[]) — pure inputs (PLAN-SPELLS §4), stored
  // whole like items/wealth; all derivation happens in engine/spells.js.
  if (edits.spells) next = { ...next, spells: edits.spells };
  if (edits.health) {
    // `knockedDown` is session-only state (decision I), never a persisted health
    // input — strip any stale copy an older build wrote to the overlay so the
    // fact can't leak back into the character on load.
    const mergedHealth = { ...(next.resources?.health || {}), ...edits.health };
    delete mergedHealth.knockedDown;
    next = {
      ...next,
      resources: {
        ...(next.resources || {}),
        health: mergedHealth,
      },
    };
  }
  if (edits.karma) {
    next = {
      ...next,
      resources: {
        ...(next.resources || {}),
        karma: { ...(next.resources?.karma || {}), ...edits.karma },
      },
    };
  }
  if (edits.advancements) {
    next = { ...next, disciplines: edits.advancements.disciplines, skills: edits.advancements.skills };
  }
  if (edits.notes) next = { ...next, notes: edits.notes };
  if (edits.history) next = { ...next, history: edits.history };
  if (edits.legend) {
    next = {
      ...next,
      resources: {
        ...(next.resources || {}),
        legend: { ...(next.resources?.legend || {}), ...edits.legend },
      },
    };
  }
  return next;
}

/**
 * Fetch one character file (with any saved edits for `id` overlaid) and the
 * rules files. Returns `{ character, rules, base }` — the raw *inputs* the app
 * layer holds and re-derives from, plus the file's blob sha (from the read's
 * ETag; `null` when the read carried no usable ETag — see readCharacterFile) as
 * the concurrency token the save layer sends as `base`. Keep this separate from
 * deriveModel so an edit can rebuild the model without re-fetching.
 */
export async function loadCharacter(id) {
  const { character: fileCharacter, base } = await readCharacterFile(id);
  const rules = await loadRules();
  return { character: applyEdits(fileCharacter, loadEdits(id)), rules, base };
}

async function loadRules() {
  const [stepsFile, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile, legendFile, skillsFile] = await Promise.all([
    loadJSON('./rules/steps.json'),
    loadJSON('./rules/talents.json'),
    loadJSON('./rules/disciplines.json'),
    loadJSON('./rules/races.json'),
    loadJSON('./rules/characteristics.json'),
    loadJSON('./rules/items.json'),
    loadJSON('./rules/legend.json'),
    loadJSON('./rules/skills.json'),
  ]);
  // Knack catalog is optional — it may not be authored yet (resolveKnack degrades
  // gracefully). Loaded separately so a 404 here never rejects the required files.
  const knacksFile = await loadJSONOptional('./rules/knacks.json', { knacks: {} });
  // Thread-item catalog is optional too (rules/thread-items.json, ed-thread-items/1).
  const threadItemsFile = await loadJSONOptional('./rules/thread-items.json', { items: {} });
  // Homebrew rules (rules/homebrew.json, ed-homebrew/2 — docs/HOMEBREW-RULES.md)
  // are optional and data-only. Rules ship disabled; only `enabled` ones apply.
  const homebrewFile = await loadJSONOptional('./rules/homebrew.json', { rules: [] });
  // Combat options + situational effects (rules/combat.json, ed-combat/1 —
  // PLAN-COMBAT-TAB Phase A). The Combat tab renders its chips from these and
  // feeds the selected bundles to engine/combat.js; they are never auto-folded.
  const combatFile = await loadJSONOptional('./rules/combat.json', { options: [], situations: [] });
  // Spell catalog (rules/spells.json, ed-spells/1 — PLAN-SPELLS §3). Optional:
  // non-casters and older bundles simply have no spells slice.
  const spellsFile = await loadJSONOptional('./rules/spells.json', { spells: {}, threadCap: [] });
  // Custom items (ed-items/2, PLAN-CUSTOM-ITEMS): read live from character-data
  // (contents API → CDN → bundled rules/custom-items.json). The raw branch read
  // is kept as `customItemsCommittedFile` — the manager modal's delta baseline —
  // while the `ed-custom-items` overlay (pending, unsaved edits) is applied on
  // top as `customItemsFile` so a pending item renders and survives until its
  // confirmed save.
  const customItemsCommittedFile = await loadCustomItems();
  const customItemsFile = applyCustomEdits(customItemsCommittedFile, loadCustomEdits());
  // steps.json is now { schema: "ed-steps/1", steps: [...] }; the array fallback
  // keeps an unwrapped file working.
  const steps = stepsFile.steps ?? stepsFile;
  return { steps, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile, legendFile, skillsFile, knacksFile, threadItemsFile, customItemsFile, customItemsCommittedFile, homebrewFile, combatFile, spellsFile };
}

// Registry of homebrew `set` targets the engine honours (ed-homebrew/2). A rule
// may only override these; any other target name is ignored. Kept here (not in a
// rule file) so the code that consumes each target and the registry stay together.
export const HOMEBREW_SET_TARGETS = new Set(['karma.step', 'karma.maxCap', 'karma.ritualCost', 'legend.additionalTierShift']);

/**
 * Derive the view-model the UI renders from raw inputs (pure — no fetch, no DOM):
 * { meta, attributes[], resources, disciplines[], skills[], knacks[] }
 */
export function deriveModel(character, rules, session = {}) {
  const { steps, talentsFile, disciplinesFile, racesFile, characteristicsFile, itemsFile, legendFile, skillsFile, knacksFile, threadItemsFile, customItemsFile, customItemsCommittedFile, homebrewFile, combatFile, spellsFile } = rules;

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
  let disciplines = (character.disciplines ?? []).map((d) => {
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
        // (the modal then shows only the basics we have). Same source as items/skills.
        brief: cat.presentation?.shortEffect ?? null,
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
  const canonItems = itemsFile?.items ?? {};
  // Custom items (ed-items/2, PLAN-CUSTOM-ITEMS) merge LAST so a player-created
  // item wins over a canon entry of the same name. The merged map is what owned
  // items and the add-picker resolve against; the raw custom map is exposed
  // separately as `customCatalog` for the manager modal to edit (and already
  // carries any pending `ed-custom-items` overlay edits from loadCharacter).
  const customItems = customItemsFile?.items ?? {};
  const itemCatalog = { ...canonItems, ...customItems };
  const threadItemsCatalog = threadItemsFile?.items ?? {};
  // A thread item resolves from rules/thread-items.json (schema ed-thread-items/1):
  // its `effects` are the unthreaded `base` effects plus the effects of each Thread
  // Rank up to the character's woven `threadRank` (an input; 0 = no thread). Rank
  // effects combine by `stacking: "replace"` in the engine fold — a higher rank's
  // effect replaces the previous rank's on the same target (GMG p. 208), never adds.
  // The extra `thread` block carries display/reference data for the UI (tier, mystic
  // defense, maximum threads, per-rank key knowledges) — never engine-read.
  const resolveThreadItem = (owned) => {
    const ref = threadItemsCatalog[owned.name] ?? null;
    const threadRank = owned.threadRank ?? 0;
    const woven = (ref?.threadRanks ?? []).filter((r) => r.rank <= threadRank);
    return {
      name: owned.name,
      equipped: owned.equipped !== false,
      // Thread items are unique — the quantity model never applies. Pinned to 1
      // so the Equipment UI shows no stepper and the consume flow skips them.
      qty: 1,
      consumable: null,
      known: ref != null,
      kind: ref?.kind ?? owned.kind ?? 'item',
      living: false,
      ref: ref?.ref ?? {},
      effects: [...(ref?.base?.effects ?? []), ...woven.flatMap((r) => r.effects ?? [])],
      // The weave collapsed to its currently-in-force survivors, per fold target
      // (engine/characteristics.js collapseByTarget): rank effects that share a
      // target with `stacking: "replace"` keep only the last (Orc Stinger rank 4
      // → Damage +7 AND Attack +2, never the accumulated +5/+6/+1/+7/+2). The
      // Equipment modal renders THESE; the static/combat folds consume the full
      // `effects` list the same way the engine already does.
      currentEffects: collapseByTarget([...(ref?.base?.effects ?? []), ...woven.flatMap((r) => r.effects ?? [])]),
      // Item-scoped combat/action option bundles (rules/thread-items.json
      // `combatOptions`): offered on the Combat tab only while this item is the
      // selected weapon. Same bundle shape as rules/combat.json options; the
      // model carries them through so the Combat tab never reads the rules file.
      combatOptions: ref?.combatOptions ?? [],
      presentation: {},
      // The parsed carried weight in pounds (engine/weight.js), for the per-section
      // totals. Derived, never stored.
      weight: parseWeight(ref?.ref?.weight),
      thread: ref
        ? {
            tier: ref.tier ?? null,
            maximumThreads: ref.maximumThreads ?? null,
            mysticDefense: ref.mysticDefense ?? null,
            legendary: ref.legendary ?? false,
            threadRank,
            threadRanks: ref.threadRanks ?? [],
          }
        : null,
    };
  };
  const items = (character.items ?? []).map((owned) => {
    if (threadItemsCatalog[owned.name]) return resolveThreadItem(owned);
    const ref = itemCatalog[owned.name] ?? null;
    const equipped = owned.equipped !== false; // default to equipped
    return {
      name: owned.name,
      equipped,
      // Quantity is an input (default 1). One row per item name with an amount;
      // the consume flow decrements it, `engine/weight.js` multiplies by it.
      qty: owned.qty ?? 1,
      // The catalog's consumable marker (rules/items.json), null when the item
      // has none. Read by the Equipment/Combat Use button + engine/potions.js;
      // never engine-folded like `effects`.
      consumable: ref?.consumable ?? null,
      known: ref != null,
      kind: ref?.kind ?? owned.kind ?? 'item',
      living: ref?.living ?? false,
      ref: ref?.ref ?? {},
      effects: ref?.effects ?? owned.effects ?? [],
      // Display-only strings for the UI (never engine-read). See rules/items.json
      // notes.presentation — carries the tile's curated `shortEffect` for note items.
      presentation: ref?.presentation ?? {},
      // The parsed carried weight in pounds (engine/weight.js) — derived, never stored.
      weight: parseWeight(ref?.ref?.weight),
      thread: null,
    };
  });

  // Homebrew rules (rules/homebrew.json, ed-homebrew/2 — docs/HOMEBREW-RULES.md):
  // a file-based, data-only list of rating overrides + effects. Only `enabled`
  // rules apply; the last enabled rule wins per rating (no merge). A rule's own
  // `effects` fold like any always-on effect, tagged `kind: 'homebrew'` so a
  // tooltip can name the rule. Rules ship disabled.
  const homebrewRules = (homebrewFile?.rules ?? []).filter((r) => r.enabled !== false);
  const homebrewEffects = homebrewRules.flatMap((rule) =>
    (rule.effects ?? []).map((e) => ({ ...e, origin: { kind: 'homebrew', name: rule.name } })),
  );
  const homebrewOverrides = {};
  for (const rule of homebrewRules) {
    for (const [rating, formula] of Object.entries(rule.formula ?? {})) {
      homebrewOverrides[rating] = formula;
    }
  }
  // `set` overrides (ed-homebrew/2, docs/HOMEBREW-RULES.md): a flat or race-keyed
  // value override for a named engine target. Only targets in this registry are
  // honoured — an unknown target is ignored (never a silent override of the wrong
  // thing). A race-keyed value resolves against the character's race; a race
  // absent from the map leaves the target un-overridden. Last-enabled-wins.
  const raceName = raceEntry?.name ?? character.meta?.race ?? null;
  const homebrewSets = {};
  for (const rule of homebrewRules) {
    for (const [target, value] of Object.entries(rule.set ?? {})) {
      if (!HOMEBREW_SET_TARGETS.has(target)) continue;
      const resolved =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (raceName != null ? value[raceName] : undefined) // race-keyed
          : value; // scalar
      if (resolved !== undefined) homebrewSets[target] = resolved;
    }
  }

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
    // Thread items tag their origin `thread` (with the woven rank) so a tooltip can
    // name the exact rank the effect came from.
    ...items
      .filter((it) => it.equipped)
      .flatMap((it) =>
        it.effects.map((e) => ({
          ...e,
          origin: it.thread
            ? { kind: 'thread', name: it.name, rank: it.thread.threadRank }
            : { kind: 'item', name: it.name },
        })),
      ),
    ...homebrewEffects,
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
  // A homebrew formula (docs/HOMEBREW-RULES.md) replaces a rating's base AND its
  // adept synthesis — the formula's refs (Durability rank, Step, Circle) already
  // account for them, so overridden ratings fold the always-on effects only and
  // nothing is double-counted. Rule `effects` are inside `activeEffects`.
  const effectsForRating = (name) => (homebrewOverrides[name] ? activeEffects : healthEffects);
  // Knocked Down is a live condition, not a stored/derived static number and
  // NOT a persisted character input: it arrives through the session-only
  // `session.knockedDown` flag (decision I, PLAN-END-OF-DAY-RESET) that ed-app
  // holds and passes in. It shows in Active Effects, applies a roll-time −3 to
  // every test (PG p.389), and its −3 to Physical/Mystic Defense folds into the
  // derived ratings below — purely because the flag is set; clear it and the
  // condition folds back out of every derived readout.
  const conditionEffects = session?.knockedDown
    ? [{ ...KNOCKED_DOWN_EFFECT, origin: { kind: 'condition', name: 'Knocked Down' } }]
    : [];
  const conditionDefenseEffects = session?.knockedDown
    ? KNOCKED_DOWN_DEFENSE_EFFECTS.map((e) => ({ ...e, origin: { kind: 'condition', name: 'Knocked Down' } }))
    : [];
  const touVal = attrVal('Toughness');

  // Refs for homebrew formulas (docs/HOMEBREW-RULES.md §4) resolve against the
  // stored inputs — an attribute's value/step, the highest owned rank of a named
  // talent (an untrained talent is rank 0), or a column of the Characteristics
  // table at the character's Toughness. An unresolvable ref (e.g. a missing
  // attribute) makes the rating null — a placeholder pill, never a guess.
  const resolveRef = (ref) => {
    const [domain, a, b] = String(ref).split('|');
    if (domain === 'attribute') {
      if (a == null) return undefined;
      if (b === 'Step') return attrStepByName[a];
      if (b === 'Value') return attrVal(a);
      return undefined;
    }
    if (domain === 'talent') {
      if (a == null) return undefined;
      const rank = (character.disciplines ?? [])
        .flatMap((d) => (d.talents ?? []).filter((t) => t.name === a).map((t) => t.rank))
        .reduce((highest, r) => Math.max(highest, r ?? 0), 0);
      return rank;
    }
    if (domain === 'characteristics') {
      const row = lookupChar(touVal);
      return row?.[a];
    }
    return undefined;
  };

  // Carrying Capacity drives encumbrance, so it derives before the rest. The
  // carried total counts every owned item — equipped and stored alike, a stowed
  // load still rests on the back (engine/weight.js); coins/gems are not items
  // and never reach this sum. The stage's effects then fold into Movement and
  // the Defences exactly like the Knocked Down condition and surface in the
  // Active Effects panel — present only while the stage holds.
  const carryingCapacityResult = carryingCapacity(attrVal('Strength'), activeEffects, lookupChar);
  const { carried, unweighed } = carriedWeight(items);
  const weightStanding = encumbranceStage(carried, carryingCapacityResult?.value ?? null);
  const encumbranceConditionEffects = encumbranceEffects(weightStanding.stage).map((e) => ({
    ...e,
    origin: { kind: 'condition', name: weightStanding.label },
  }));
  const foldedEffects = [...activeEffects, ...conditionDefenseEffects, ...encumbranceConditionEffects];

  // Karma ledger (plans/PLAN-LEGEND-KARMA-RITUAL-LOG.md): `available` is DERIVED from the
  // stored inputs `resources.karma.converted` (lifetime gained) minus `spent` (lifetime
  // spent rolling dice), clamped to `[0, max]` — never stored. Rule-off and legacy
  // characters simply have no ledger inputs ⇒ 0. `karmaRitualCost` (rule on) feeds both
  // the Legend sink and the Legend-log spend rows below.
  const karmaMax = karmaMod != null ? maxKarma(karmaMod, highestCircle, homebrewSets['karma.maxCap'] ?? null) : null;
  const karmaAvailable =
    karmaMax != null
      ? Math.max(0, Math.min(karmaMax, (Number(character.resources?.karma?.converted) || 0) - (Number(character.resources?.karma?.spent) || 0)))
      : null;
  const karmaRitualCost = homebrewSets['karma.ritualCost'] ?? null;
  // Homebrew additional-Discipline tier shift (plans/PLAN-HOMEBREW-LEGEND-TIER.md):
  // with the `legend.additionalTierShift` set target, an additional-Discipline
  // talent prices each rank at its own tier bumped up (Novice→Journeyman→Warden→
  // Master) instead of the New-Discipline/Equivalent-Tier tables. Absent/0 ⇒
  // standard tables. Fed to the audit and to the rank-editing pricing below, so
  // step costs always equal audit(after) − audit(before) under the rule.
  const tierShift = Number(homebrewSets['legend.additionalTierShift']) || 0;

  const characteristics = {
    physicalDefense: defense('Physical', attrVal(DEFENSE_ATTRIBUTE.Physical), foldedEffects, lookupChar),
    mysticDefense: defense('Mystic', attrVal(DEFENSE_ATTRIBUTE.Mystic), foldedEffects, lookupChar),
    socialDefense: defense('Social', attrVal(DEFENSE_ATTRIBUTE.Social), foldedEffects, lookupChar),
    physicalArmor: physicalArmor(activeEffects),
    mysticArmor: mysticArmor(attrVal('Willpower'), activeEffects, lookupChar),
    unconsciousness: unconsciousnessRating(touVal, effectsForRating('unconsciousness'), lookupChar, homebrewOverrides.unconsciousness ?? null, resolveRef),
    death: deathRating(touVal, effectsForRating('death'), lookupChar, homebrewOverrides.death ?? null, resolveRef),
    recoveries: recoveryTests(touVal, healthEffects, lookupChar),
    woundThreshold: woundThreshold(touVal, healthEffects, lookupChar),
    carryingCapacity: carryingCapacityResult,
    movementRate: movementRate(raceEntry?.movement?.walk, foldedEffects),
    initiative: initiative(dexStep, activeEffects),
    knockdown: knockdown(strStep, activeEffects),
    karma:
      karmaMod != null
        ? {
            // Homebrew Karma economy (ed-homebrew/2, plans/PLAN-HOMEBREW-KARMA.md): a race
            // `karma.maxCap` caps the max, `karma.step` overrides the die, and
            // `karma.ritualCost` (when present) switches the ritual to the paid
            // Legend buy-back flow. Absent overrides ⇒ the standard values. `available`
            // is the derived ledger clamp (converted − spent); the stored `available`
            // input was dropped with the ledger (PLAN-LEGEND-KARMA-RITUAL-LOG.md).
            max: karmaMax,
            available: karmaAvailable,
            step: homebrewSets['karma.step'] ?? KARMA_STEP,
            ritualCost: karmaRitualCost,
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

  // Legend: derived standing from the stored inputs (totalEarnt) plus the engine's
  // audit of all spent (engine/legend-spent.js). `available` and the Legendary Status
  // band are recomputed here — never stored (the sheet's `resources.legend.available`
  // is now ignored; REVIEW-FINDINGS G1).
  // Skills resolved against the rules/skills.json catalog, mirroring talents: the
  // catalog supplies attribute/action/summary/versus/strain, and the step/dice are
  // derived (skill step = attribute step + rank). A character skill name that carries a
  // specialisation, e.g. "Speak Language (Ork)", falls back to its base skill entry.
  // Unknown skills degrade gracefully (kept, no derived values).
  const skillCatalog = Object.fromEntries((skillsFile.skills ?? []).map((s) => [s.name, s]));
  const skillRef = (name) =>
    skillCatalog[name] ?? skillCatalog[String(name).replace(/\s*\([^)]*\)\s*$/, '').trim()] ?? null;
  let skills = (character.skills ?? []).map((s) => {
    const cat = skillRef(s.name) ?? {};
    const attribute = cat.attribute ?? null;
    const aStep = attribute ? attrStepByName[attribute] : undefined;
    const step = attribute != null && aStep != null ? talentStep(aStep, s.rank) : null;
    return {
      name: s.name,
      rank: s.rank,
      tier: s.tier ?? null,
      attribute,
      action: cat.action ?? null,
      step,
      dice: step != null ? diceForStep(step) : '',
      known: skillRef(s.name) != null,
      // Terse effect for the table column — the curated presentation.shortEffect wins,
      // falling back to the full summary (the modal always shows the full summary).
      brief: cat.presentation?.shortEffect ?? cat.summary ?? null,
      detail: {
        summary: cat.summary ?? null,
        versus: cat.versus ?? null,
        strain: cat.strain ?? null,
        documented: !!cat.summary,
      },
    };
  });

  // Knacks resolved against the catalog (rules/knacks.json), like items. The catalog
  // supplies the fixed rules (parent, requiredRank, description); resolveKnack degrades
  // gracefully — and transitionally parses the legacy "Knack (Parent)" name — so the UI
  // and the audit always receive structured knacks.
  const knackCatalog = knacksFile?.knacks ?? {};
  const skillNames = new Set((character.skills ?? []).map((s) => s.name));
  const talentNames = new Set(
    (character.disciplines ?? []).flatMap((d) => (d.talents ?? []).map((t) => t.name)),
  );
  const knacks = (character.knacks ?? []).map((k) => resolveKnack(k, knackCatalog, skillNames, talentNames));

  // Rank grants (engine/ability-ranks.js, plans/PLAN-RANK-GRANTS.md): always-on
  // `grant-ability` effects (measure `rank`, EFFECT-TAXONOMY §5) fold into the
  // derived talent/skill step AFTER the rows are built (Path A — the build
  // order is untouched). Two operations: `set` → *possession* (the ability is
  // available), `add`/`subtract` → *rank bonus* on a possessed ability
  // (effectiveRank = rank + bonus). All derived: the Legend audit prices the
  // learned rank from raw input, so the fold can never change Legend costs, and
  // the stored `rank` is never touched.
  const grantedRanks = foldAbilityGrants(activeEffects);
  const foldBonusIntoRow = (row) => {
    const grant = grantedRanks.bonuses[row.name];
    if (!grant) return;
    row.rankBonus = grant.bonus;
    row.grantSources = grant.sources;
    const aStep = row.attribute ? attrStepByName[row.attribute] : undefined;
    if (row.attribute != null && aStep != null) {
      // The pre-grant derived step, so the Combat tab's step audit can itemise
      // base + grant instead of folding the grant invisibly into the number.
      row.stepBase = row.step;
      row.step = talentStep(aStep, row.rank + grant.bonus);
      row.dice = diceForStep(row.step);
    }
  };
  for (const d of disciplines) for (const t of d.talents) foldBonusIntoRow(t);
  for (const s of skills) foldBonusIntoRow(s);
  // `set`-granted abilities the character hasn't learned materialize as derived
  // granted-ability rows (possessed, unranked until promoted by `set: N>0` or a
  // rank bonus). Learned talents/skills keep their own rows, never duplicated.
  const learnedAbilityNames = new Set([...talentNames, ...skillNames]);
  const grantedAbilities = [];
  for (const [name, possession] of Object.entries(grantedRanks.possessed)) {
    if (learnedAbilityNames.has(name)) continue;
    const grant = grantedRanks.bonuses[name] ?? null;
    const cat = talentCatalog[name] ?? {};
    const attribute = cat.attribute ?? skillRef(name)?.attribute ?? null;
    const rank = (possession.setValue ?? 0) + (grant?.bonus ?? 0);
    const aStep = attribute ? attrStepByName[attribute] : undefined;
    const step = rank > 0 && aStep != null ? talentStep(aStep, rank) : null;
    grantedAbilities.push({
      name,
      rank,
      attribute,
      step,
      dice: step != null ? diceForStep(step) : '',
      grantSources: [...(possession.sources ?? []), ...(grant?.sources ?? [])],
    });
  }

  const legendInput = character.resources?.legend ?? {};
  const legendBands = legendFile?.bands ?? [];
  // `spent` is the engine's audit of every priced advancement; `available` derives
  // from it — total earned minus all spent the engine can price — so the readout
  // tracks the sheet's actual advancements rather than the recorded `totalSpent`
  // input. Unpriced sinks (spells) stay in the reconciliation delta.
  const threadItemCatalog = threadItemsFile?.items ?? {};
  const spent = auditLegendSpent(character, legendFile?.costs, {
    knacks,
    threadItemCatalog,
    karmaRitualCost,
    tierShift,
  });
  // Legend-earned log (PLAN-NOTES-TAB, decisions #1/#6): `totalEarnt` is the PURE
  // SUM of a display list — one synthesized, non-persisted virtual "Starting
  // total" row (amount = any legacy `totalEarnt` still in the branch file;
  // `virtual: true`, so the UI renders it read-only / non-deletable) followed by
  // the real `earned` entries in order. Single derivation path: no separate
  // legacy-fallback branch. Nothing recomputable is stored — `totalEarnt` is
  // never written to the overlay (saveLegendEdits writes `earned` only).
  const legacyTotal = typeof legendInput.totalEarnt === 'number' ? legendInput.totalEarnt : null;
  const earned = Array.isArray(legendInput.earned) ? legendInput.earned : [];
  const legendEarned = [
    ...(legacyTotal != null
      ? [{ id: '__starting_total__', amount: legacyTotal, description: 'Starting total', date: null, virtual: true }]
      : []),
    ...earned,
  ];
  const totalEarnt = legendEarned.length
    ? legendEarned.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : null;
  // Karma-on-Legend display rows (PLAN-LEGEND-KARMA-RITUAL-LOG.md): display-only, never
  // stored or summed into `totalEarnt`. With the rule on (`karmaRitualCost` present),
  // derived from the ledger — one virtual historic seed row (converted before the dated
  // ritual log) plus one row per dated ritual event, all at the current cost, so
  // `Σ legend = converted × cost` (exactly the audit sink above). Rule off ⇒ []. Not on
  // `legendEarned` (that list stays earned-only for the add/delete flows).
  const convertedKarma = Number(character.resources?.karma?.converted) || 0;
  const karmaRituals = Array.isArray(character.resources?.karma?.rituals) ? character.resources.karma.rituals : [];
  const hasKarmaCost = () => Number.isFinite(Number(karmaRitualCost)) && Number(karmaRitualCost) > 0;
  const legendSpends = () => {
    if (!hasKarmaCost() || convertedKarma <= 0) return [];
    const eventsPoints = karmaRituals.reduce((s, r) => s + (Number(r?.points) || 0), 0);
    const historic = convertedKarma - eventsPoints;
    const cost = Number(karmaRitualCost);
    return [
      ...(historic > 0
        ? [{ id: '__karma_historic__', date: null, virtual: true, points: historic, cost, legend: historic * cost }]
        : []),
      ...karmaRituals.map((r) => ({
        id: r.id,
        date: r.date ?? null,
        points: Number(r?.points) || 0,
        cost,
        legend: (Number(r?.points) || 0) * cost,
      })),
    ];
  };
  const legend =
    totalEarnt != null
      ? {
          totalEarnt,
          totalSpent: legendInput.totalSpent ?? 0,
          available: legendAvailable(totalEarnt, spent.total),
          status: legendaryStatus(totalEarnt, legendBands),
          bands: legendBands,
          spent,
          spends: legendSpends(),
          tierShift, // homebrew additional-Discipline tier shift (0 = standard), read by the UI's rank guard
        }
      : null;

  // Rank-editing pricing (PLAN-RANK-EDITING, Tier 3): attach to every derived
  // talent/skill the Legend cost of the step up (`increaseCost`), the refund for
  // one step down (`refund` — null at Rank 1, the decrease floor), and
  // `affordable` = the next step fits in the derived Available Legend. All three
  // come from the same pure engine the audit prices with, so a step's cost
  // always equals audit(after) − audit(before); unpriceable steps (missing tier,
  // a rank beyond the cost tables) are null — flagged, never fabricated. The
  // helper reads the *raw* character inputs (tier/circle), exactly as the audit
  // does. Derived, never stored.
  if (legendFile?.costs) {
    const costs = legendFile.costs;
    const available = legend?.available ?? null;
    const discInputs = character.disciplines ?? [];
    const lowestCircle = lowestDisciplineCircle(discInputs);
    disciplines = disciplines.map((disc, di) => ({
      ...disc,
      talents: disc.talents.map((t, ti) => {
        const raw = discInputs[di]?.talents?.[ti] ?? {};
        const increaseCost = talentRankStepCost(raw, di + 1, lowestCircle, costs, t.rank + 1, { tierShift });
        const refund = t.rank > 1 ? talentRankStepCost(raw, di + 1, lowestCircle, costs, t.rank, { tierShift }) : null;
        return {
          ...t,
          pricing: {
            increaseCost,
            refund,
            affordable: available != null && increaseCost != null && increaseCost <= available,
          },
        };
      }),
    }));
    const skillInputs = character.skills ?? [];
    skills = skills.map((s, si) => {
      const raw = skillInputs[si] ?? {};
      const increaseCost = skillRankStepCost(raw, costs, s.rank + 1);
      const refund = s.rank > 1 ? skillRankStepCost(raw, costs, s.rank) : null;
      return {
        ...s,
        pricing: {
          increaseCost,
          refund,
          affordable: available != null && increaseCost != null && increaseCost <= available,
        },
      };
    });
  }

  // Combat surface (PLAN-COMBAT-TAB Phase C): the pieces the Combat tab renders,
  // all derived from values already folded above — no new stored values. Attack
  // talents resolve from the character's owned talents by canonical name (the
  // singular catalog names the Disciplines actually grant); an unowned talent
  // derives `step: null` so the tab shows a placeholder pill, never a fabricated
  // number. Weapons come from the derived items restricted to the equipped
  // `weapon` kind; melee weapons carry no range entry, so `shortRange`/`longRange`
  // are null. The live combat conditions (Knocked Down / encumbrance Harried) are
  // already folded into the sheet's derived ratings, so the tab can pre-select and
  // lock those situation chips (B11) — the player must not add them a second time.
  // `damageKarma` surfaces any Damage-test karma-use grant (B13) — e.g. the Archer
  // ranged-weapon grant (rules/disciplines.json:57) — the way attribute tests do.
  const COMBAT_ATTACK_TALENTS = ['Melee Weapon', 'Missile Weapon', 'Unarmed Combat', 'Throwing Weapon'];
  const combat = {
    attackTalents: COMBAT_ATTACK_TALENTS.map((name) => {
      const owned = disciplines
        .flatMap((d) => d.talents)
        .filter((t) => t.name === name)
        .reduce((best, t) => (best == null || t.rank > best.rank ? t : best), null);
      return {
        name,
        known: owned != null,
        rank: owned?.rank ?? null,
        step: owned?.step ?? null,
        dice: owned?.dice ?? '',
        karma: owned?.karma ?? null,
      };
    }),
    equippedWeapons: items
      .filter((it) => it.equipped && (it.kind === 'weapon' || (it.thread && it.ref?.category)))
      .map((it) => {
        // A thread weapon's Damage step comes from the woven effects carried on
        // the item itself: the base sets the step and each woven rank replaces
        // it (stacking: "replace" with the new set value, in ascending order).
        // Fall back to the reference damageStep for plain weapons.
        let damageStep = it.ref?.damageStep ?? null;
        if (it.thread) {
          for (const e of it.effects ?? []) {
            if (
              e.type === 'attack-modifier' &&
              e.target?.domain === 'attack' &&
              e.target?.name === 'Damage' &&
              e.measure === 'step' &&
              e.operation === 'add' &&
              e.stacking === 'replace'
            ) {
              damageStep = e.value;
            }
          }
        }
        return {
          name: it.name,
          known: it.known,
          category: it.ref?.category ?? null,
          damageStep,
          shortRange: it.ref?.shortRange ?? null,
          longRange: it.ref?.longRange ?? null,
          image: it.ref?.image ?? null,
          combatOptions: it.combatOptions ?? [],
          // The weapon's own effects ride along so the Combat tab can fold its
          // always-on woven test modifiers into the roll pool (engine/combat.js
          // `collectCombatEffects` collapses them per target).
          effects: it.effects ?? [],
        };
      }),
    // Item-scoped combat-option bundles from equipped thread items that are NOT
    // weapons (armour, trinkets — no `ref.category`, so they never join
    // `equippedWeapons`). These surface on the Combat tab independent of the
    // weapon pick, so a defensive reaction like Dark Archer Armour's Horror-ward
    // is a toggle the player arms on demand. Weapon-scoped bundles still ride
    // `equippedWeapons[].combatOptions` (offered only while that weapon is
    // selected) — this list deliberately excludes them to avoid double-offering.
    itemOptions: items
      .filter((it) => it.equipped && (it.combatOptions?.length ?? 0) > 0 && it.kind !== 'weapon' && !it.ref?.category)
      .flatMap((it) => it.combatOptions ?? []),
    // Talent-scoped combat-option bundles (a talent may declare `combatOptions`
    // in rules/talents.json — e.g. True Shot). The talent's current rank is
    // resolved into each bundle's `karmaDice.max`, so the roll modal can cap the
    // extra Karma dice without looking the talent up. Only owned talents at rank
    // ≥ 1 contribute; a talent held in two Disciplines is deduped keeping the
    // highest rank (plans/PLAN-TALENT-COMBAT-OPTIONS.md §4).
    talentOptions: (() => {
      const byName = new Map();
      for (const d of disciplines) {
        for (const t of d.talents ?? []) {
          const defs = talentCatalog[t.name]?.combatOptions;
          if (!defs?.length || (t.rank ?? 0) < 1) continue;
          for (const o of defs) {
            const prev = byName.get(o.name);
            if (prev && (prev._rank ?? 0) >= t.rank) continue;
            byName.set(o.name, {
              ...o,
              // True Shot: cap the extra Karma dice at the talent rank.
              karmaDice: o.karmaDice ? { ...o.karmaDice, max: t.rank } : null,
              // Mystic Aim: the aim test is the talent's own test — inject its
              // derived Step and karma context so the Combat tab can roll it
              // (Karma-eligible) without re-deriving.
              aimRoll: o.aimRoll ? { ...o.aimRoll, step: t.step ?? null, karma: t.karma ?? null } : null,
              grantedBy: t.name,
              _rank: t.rank,
            });
          }
        }
      }
      return [...byName.values()].map(({ _rank, ...o }) => o);
    })(),
    strengthStep: strStep,
    conditions: {
      // Knocked Down is session-only state (decision I) — never read from the
      // stored health inputs, which must not carry the fact.
      knockedDown: session?.knockedDown === true,
      harried: weightStanding.stage === ENCUMBRANCE.BURDENED,
    },
    damageKarma: karmaUse('Damage', activeEffects),
  };

  return {
    meta: character.meta ?? {},
    legend,
    // Derived, never stored: the loadable URL for `meta.portrait` (branch raw
    // CDN on Pages, bundle-relative working copy locally).
    portraitUrl: portraitUrlFor(character.meta?.portrait),
    attributes,
    resources: character.resources ?? {},
    disciplines,
    // Spells slice (PLAN-SPELLS §5): the SpellsContext the Spells tab renders
    // from and drives the cast flow with. null for non-casters (no spells block).
    spells: buildSpellsContext(character, spellsFile, { disciplines, attrStepByName }),
    racialAbilities,
    characteristics,
    stepByNumber,
    items,
    itemCatalog,
    // Player-created items only (ed-items/2) — the manager modal's edit set.
    // The add-picker still sees them: `itemCatalog` merges canon + custom, custom
    // winning on a name collision.
    customCatalog: customItems,
    // The branch-truth custom set (pre-overlay) and the canon item names — the
    // manager modal's delta baseline and collision-warning list respectively
    // (plans/PLAN-CUSTOM-ITEMS.md §5.2 / §5.4).
    customCommittedCatalog: customItemsCommittedFile?.items ?? {},
    customCanonKeys: Object.keys(canonItems),
    // Thread-item catalogue (rules/thread-items.json) — the add-picker offers its
    // entries just like items; the resolved `items` carry the `thread` metadata.
    threadItemCatalog,
    // Wealth: pass the stored inputs through the pure deriver so the view gets
    // coin/gem silver values, the running total and the resale hint (all derived).
    wealth: deriveWealth(character.wealth ?? {}),
    skills,
    knacks,
    // `set`-granted abilities the character doesn't learn (engine/ability-ranks.js
    // plans/PLAN-RANK-GRANTS.md D2/D5): derived possession rows for the
    // Disciplines tab's "Granted abilities" group. Never stored.
    grantedAbilities,
    traits: character.traits ?? [],
    // Health standing: the stored damage/wounds inputs, run through the pure
    // engine (engine/health.js) against the derived Unconsciousness/Death ratings
    // — conscious/unconscious/dead state + headroom. Derived, never stored.
    healthState: damageState(character.resources?.health ?? {}, characteristics),
    // Combat surface (PLAN-COMBAT-TAB Phase C): attack talents, equipped weapons,
    // Strength step, live combat conditions and the Damage-test karma grant for
    // the Combat tab (derived, never stored). Initiative/P-M Defense/Armor/Health
    // live in `characteristics` and `healthState` above.
    combat,
    // The Combat tab's rule bundles (rules/combat.json, ed-combat/1) — the chips
    // render from data, never hardcoded numbers. Selection happens in the tab;
    // the effects feed engine/combat.js, never the static fold.
    combatRules: { options: combatFile?.options ?? [], situations: combatFile?.situations ?? [] },
    // Carried weight and its encumbrance standing (engine/weight.js + engine/
    // encumbrance.js): the pound total across every owned item, the count of
    // items with unrecorded weight, the carrying capacity they're judged
    // against, and the stage/label the banner renders. All derived, never stored.
    weight: {
      carried,
      unweighed,
      capacity: carryingCapacityResult?.value ?? null,
      stage: weightStanding.stage,
      label: weightStanding.label,
      ratio: weightStanding.ratio,
    },
    // Every active effect for the Active Effects panel: the always-on fold
    // (race/discipline/equipped items, each tagged with its origin) plus any
    // live condition effects (Knocked Down, and the encumbrance stage's). All
    // derived, never stored.
    activeEffects: [...activeEffects, ...conditionEffects, ...encumbranceConditionEffects],
    // The enabled homebrew rules (rules/homebrew.json — docs/HOMEBREW-RULES.md),
    // passed through as pure data for the footer pill + modal: { id, name,
    // overrides, summary, formula }. Nothing derived; the rule payloads are
    // inputs only.
    homebrewRules,
    // Notes-tab data (PLAN-NOTES-TAB): pure pass-through of the hand-written
    // notes and the dated history timeline, plus the Legend-earned display list
    // (virtual "Starting total" row + real entries — see Phase B above). All
    // inputs (or the derived display list); nothing recomputed into new stores.
    notes: character.notes ?? [],
    history: character.history ?? [],
    legendEarned,
  };
}
