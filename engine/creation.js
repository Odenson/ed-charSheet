// engine/creation.js — pure, DOM-free creation-mode engine (create-new-adept).
//
// A new Circle-1 character carries the additive `creation` block { open, free } (docs:
// ARCHITECTURE.md §4.1). While `open`, the allotments — 8 talent points, 25 attribute points,
// the starting skill ranks and a magician's spell points — are spent through the `apply*`
// functions below; "Finish creation" closes the block. Nothing here reads names or display
// strings: it reads structured rule data (`rules/disciplines.json` circle-1 `talents` and
// `artisanSkills`, `rules/attributes.json` pointCost, the skill `category` / `artisanKey` /
// `generic` / `tier` fields, spell `discipline` / `circle`) handed in through `ctx`, and the
// store hands in the skill lookup (`ctx.resolveSkill`) so the engine never parses a name.
//
// Store only inputs: the only things ever written are the character's ordinary inputs
// (`disciplines`, `skills`, `attributes[n].points`, `spells`, `resources.karma.converted`)
// and the `creation` block { open, free: { talents, skills, spells } }. Budgets, costs, the
// Karma bonus and every Step are derived and never stored.
//
// ctx = {
//   disciplinesFile, attributesFile,        // parsed rules/disciplines.json, rules/attributes.json
//   skillCatalog,                           // rules/skills.json `skills` (array)
//   resolveSkill,                           // (name) -> catalog entry | null (store.makeSkillRef)
//   spellCatalog,                           // rules/spells.json `spells` (name -> entry)
//   perceptionStep,                         // number | null — derived by the store, never stored
//   karmaModifier, karmaMaxCap,             // race Karma Modifier; house cap (number | null)
// }
//
// Every `apply*` returns `{ ok: true, character, touched }` or `{ ok: false, reason, character }`
// where a refusal hands back the SAME character reference; `touched` is a subset of
// ['advancements', 'attributes', 'spells', 'creation', 'karma'] naming the overlay categories
// to persist (store.persistCreationEdit). No input is ever mutated.

import { maxKarma } from './characteristics.js';
import { ledgerTalentKey, normSpellName } from './legend-spent.js';
import { disciplineTalentSet, freeTalentSet } from './talent-options.js';

/**
 * The creation allotments (rules.md R1, R3, R5, R6). Constants of the rule, not data a
 * character stores.
 */
export const CREATION_RULES = {
  talentPoints: 8,
  talentMaxRank: 3,
  attributePoints: 25,
  skillExtraRanks: 8,
  skillMaxRank: 3,
  languageMaxRank: 1,
  skillFixed: { knowledge: 2, artisan: 1, 'language-speak': 2, 'language-readwrite': 1 },
  spellCircles: [1, 2],
};

/** The `creation.free.talents` ledger key for a talent: `${discipline}/${talent}`. */
export function freeKey(discipline, talent) {
  return ledgerTalentKey(discipline, talent);
}

// --- Slice A2 helpers: the attribute spend and the derived Karma bonus -------------------

/**
 * Cost of raising an attribute `points` over the racial value, read off the cumulative
 * `rules/attributes.json` `pointCost` table (`[{ points, cost }]`; rules.md R3: +1=1 ... +8=15,
 * -1/-2 give back 1/2). Exact lookup: `null` outside the table (the table's min/max `points` is
 * the -2..+8 house range), never an extrapolation.
 */
export function attributePointCost(points, attributesFile) {
  if (typeof points !== 'number') return null;
  const row = (attributesFile?.pointCost ?? []).find((r) => r.points === points);
  return row && typeof row.cost === 'number' ? row.cost : null;
}

/**
 * The creation attribute points left: `25 - sum(cost(attributes[n].points))` over the six
 * attributes in `attributesFile.order`. `null` when the table is missing or any attribute is
 * unpriceable (off the table) — flagged, never guessed. May be negative (over-spent).
 */
export function attributeLeftover(character, attributesFile) {
  const order = attributesFile?.order;
  if (!Array.isArray(order) || !Array.isArray(attributesFile?.pointCost)) return null;
  let spent = 0;
  for (const name of order) {
    const cost = attributePointCost(character?.attributes?.[name]?.points ?? 0, attributesFile);
    if (cost == null) return null;
    spent += cost;
  }
  return CREATION_RULES.attributePoints - spent;
}

/**
 * The Max Karma bonus from unspent creation attribute points (rules.md R3/R4): derived, never
 * stored. Only a FINISHED creation (`creation.open === false`) has one — `max(0, leftover)`;
 * while open, with no `creation` block, no table or any unpriceable attribute it is 0.
 */
export function karmaBonus(character, attributesFile) {
  if (character?.creation?.open !== false) return 0;
  const left = attributeLeftover(character, attributesFile);
  return left == null ? 0 : Math.max(0, left);
}

/**
 * The creation Max Karma (what the Legend audit treats as free): `maxKarma(modifier, 1, cap,
 * karmaBonus)` — the cap applies to the total (Troll 3 + 25 unspent => 20, never 28). `null`
 * when the race has no Karma Modifier.
 */
export function creationKarma(character, { karmaModifier, karmaMaxCap = null, attributesFile } = {}) {
  return maxKarma(karmaModifier, 1, karmaMaxCap, karmaBonus(character, attributesFile));
}

// --- shared internals --------------------------------------------------------------------

const isOpen = (character) => character?.creation?.open === true;
const refuse = (character, reason) => ({ ok: false, reason, character });
const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

// The character's first Discipline and its rules entry ("creation" always concerns the first).
function firstDiscipline(character, ctx) {
  const disc = character?.disciplines?.[0] ?? null;
  const entry = disc ? (ctx?.disciplinesFile?.disciplines ?? []).find((d) => d.name === disc.name) ?? null : null;
  return { disc, entry };
}

// The Discipline's Circle-1 Talents: the five a player spends talent points on (rules.md R1).
// Never the free talents (`freeTalents`), the Talent Option pool, Durability or Karma Ritual.
function creationTalentNames(entry) {
  return (entry?.circles ?? []).find((c) => c.circle === 1)?.talents ?? [];
}

// The Circle-1 Talent Option pool (PG p.67: "one talent from a pool of talents available at First
// Circle") — the Novice pool of the Discipline, minus any name the Discipline already grants.
// Owner ruling 2026-11-22: one option may be bought with the 8 talent points like the five.
function optionPool(entry) {
  const dts = disciplineTalentSet(entry);
  const frees = freeTalentSet(entry);
  return (entry?.talentOptions?.novice ?? []).filter((n) => !dts.has(n) && !frees.has(n));
}

// The held Circle-1 Talent Option row of the first Discipline (null when the slot is open): a
// Circle-1 talent that is neither a Discipline Talent, universal, nor free.
function heldOption(disc, entry) {
  const dts = disciplineTalentSet(entry);
  const frees = freeTalentSet(entry);
  return (disc?.talents ?? []).find((t) => t.circle === 1 && !dts.has(t.name) && !frees.has(t.name)) ?? null;
}

// A magician holds Spellcasting among its Circle-1 Discipline Talents (the engine's own
// caster test, engine/spells.js) — not `halfMagic`, which every Discipline carries.
const isMagicianEntry = (entry) => creationTalentNames(entry).includes('Spellcasting');

// A fresh copy of the ledger with exactly the three signed-off sections.
function ledgerOf(character) {
  const f = character?.creation?.free ?? {};
  return { talents: { ...(f.talents ?? {}) }, skills: { ...(f.skills ?? {}) }, spells: [...(f.spells ?? [])] };
}

const creationWith = (character, free) => ({ open: character.creation.open, free });

// --- talents -----------------------------------------------------------------------------

function talentSpent(disc, entry) {
  const names = new Set(creationTalentNames(entry));
  const opt = heldOption(disc, entry);
  if (opt) names.add(opt.name);
  return (disc?.talents ?? []).filter((t) => names.has(t.name)).reduce((s, t) => s + (Number(t.rank) || 0), 0);
}

/**
 * The talent-point budget (R1): 8 points over the five Circle-1 Discipline Talents of the first
 * Discipline, each Rank 0..3 (unassigned = Rank 0, never stored). The seeded Durability and
 * Karma Ritual sit outside the 8 and are not rows. `valid` is false when over-spent or a rank
 * exceeds 3 — shown, never auto-corrected.
 * @returns {{total, spent, left, valid, rows: Array<{discipline, name, rank, max, canRaise, canLower}>}}
 */
export function talentBudget(character, ctx) {
  const { disc, entry } = firstDiscipline(character, ctx);
  const total = CREATION_RULES.talentPoints;
  const max = CREATION_RULES.talentMaxRank;
  const open = isOpen(character);
  const spent = talentSpent(disc, entry);
  const left = total - spent;
  const rows = creationTalentNames(entry).map((name) => {
    const rank = Number((disc?.talents ?? []).find((t) => t.name === name)?.rank) || 0;
    return {
      discipline: disc?.name ?? null,
      name,
      rank,
      max,
      canRaise: open && rank < max && left >= 1,
      canLower: open && rank > 0,
    };
  });
  // The one Circle-1 Talent Option (owner ruling 2026-11-22): once chosen it is a stepper row like
  // the five (Rank 1..3; lowering to 0 returns the slot); while the slot is open the pool is offered.
  const held = heldOption(disc, entry);
  if (held) {
    const rank = Number(held.rank) || 0;
    rows.push({ discipline: disc.name, name: held.name, rank, max, option: true, canRaise: open && rank < max && left >= 1, canLower: open && rank > 0 });
  }
  const option = { open: !held, held: held?.name ?? null, candidates: held ? [] : optionPool(entry).filter((n) => !(disc?.talents ?? []).some((t) => t.name === n)) };
  return { total, spent, left, valid: spent <= total && rows.every((r) => r.rank <= max), rows, option };
}

/**
 * Set one Circle-1 Discipline Talent — or the single Circle-1 Talent Option, owner ruling
 * 2026-11-22 — to Rank 0..3 (R1). Raising from 0 appends
 * `{ name, rank, circle: 1 }`; lowering to 0 removes the row and its ledger key; the ledger
 * `free.talents["<Discipline>/<name>"]` always equals the rank. Touches advancements + creation.
 */
export function applyTalentRank(character, ctx, { discipline, name, rank }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  if (!isInt(rank) || rank < 0 || rank > CREATION_RULES.talentMaxRank) return refuse(character, 'bad-rank');
  const { disc, entry } = firstDiscipline(character, ctx);
  if (!disc || !entry || discipline !== disc.name) return refuse(character, 'unknown-discipline');
  const held = heldOption(disc, entry);
  if (!creationTalentNames(entry).includes(name)) {
    if (!optionPool(entry).includes(name) && held?.name !== name) return refuse(character, 'not-a-creation-talent');
    if (held && held.name !== name) return refuse(character, 'option-slot-full');
  }
  const row = (disc.talents ?? []).find((t) => t.name === name);
  const current = Number(row?.rank) || 0;
  if (rank === current) return refuse(character, 'no-change');
  if (rank > current && talentSpent(disc, entry) + (rank - current) > CREATION_RULES.talentPoints) {
    return refuse(character, 'over-budget');
  }
  const talents =
    rank === 0
      ? (disc.talents ?? []).filter((t) => t.name !== name)
      : row
        ? disc.talents.map((t) => (t === row ? { ...t, rank } : t))
        : [...(disc.talents ?? []), { name, rank, circle: 1 }];
  const free = ledgerOf(character);
  if (rank === 0) delete free.talents[freeKey(disc.name, name)];
  else free.talents[freeKey(disc.name, name)] = rank;
  return {
    ok: true,
    character: {
      ...character,
      disciplines: [{ ...disc, talents }, ...character.disciplines.slice(1)],
      creation: creationWith(character, free),
    },
    touched: ['advancements', 'creation'],
  };
}

// --- attributes --------------------------------------------------------------------------

function attributeRange(attributesFile) {
  const points = (attributesFile?.pointCost ?? []).map((r) => r.points);
  return points.length ? { min: Math.min(...points), max: Math.max(...points) } : { min: null, max: null };
}

/**
 * The attribute-point budget (R3): 25 points over the racial `base`, priced by the cumulative
 * `pointCost` table, range -2..+8 (the table's min/max). `leftover = max(0, left)` is what
 * Finish converts to Max Karma. `valid` is false when over-spent or any attribute is off the
 * table. Every row carries the price of the next/previous step and whether each is possible.
 * @returns {{total, spent, left, valid, min, max, leftover, rows}}
 */
export function attributeBudget(character, ctx) {
  const file = ctx?.attributesFile;
  const { min, max } = attributeRange(file);
  const open = isOpen(character);
  const priced = (file?.order ?? []).map((name) => {
    const points = Number(character?.attributes?.[name]?.points) || 0;
    return { name, points, cost: attributePointCost(points, file) };
  });
  const total = CREATION_RULES.attributePoints;
  const spent = priced.reduce((s, r) => s + (r.cost ?? 0), 0);
  const left = total - spent;
  const rows = priced.map(({ name, points, cost }) => {
    const up = attributePointCost(points + 1, file);
    const down = attributePointCost(points - 1, file);
    const raiseCost = cost != null && up != null ? up - cost : null;
    const lowerRefund = cost != null && down != null ? cost - down : null;
    return {
      name,
      points,
      cost,
      raiseCost,
      lowerRefund,
      canRaise: open && raiseCost != null && points + 1 <= max && raiseCost <= left,
      canLower: open && lowerRefund != null && points - 1 >= min,
    };
  });
  return { total, spent, left, valid: left >= 0 && priced.every((r) => r.cost != null), min, max, leftover: Math.max(0, left), rows };
}

/**
 * Set one attribute's creation `points` (the raise over the racial value; `base` and
 * `increases` are untouched). Judged on the whole change in cost: a raise needs its price to
 * fit in the points left, a lowering is always fine. Touches only `attributes`.
 */
export function applyAttributePoints(character, ctx, { name, points }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const file = ctx?.attributesFile;
  if (!(file?.order ?? []).includes(name) || !character.attributes?.[name]) return refuse(character, 'unknown-attribute');
  const { min, max } = attributeRange(file);
  if (!isInt(points) || points < min || points > max) return refuse(character, 'out-of-range');
  const current = Number(character.attributes[name].points) || 0;
  if (points === current) return refuse(character, 'no-change');
  const delta = attributePointCost(points, file) - (attributePointCost(current, file) ?? 0);
  if (delta > 0 && delta > attributeBudget(character, ctx).left) return refuse(character, 'over-budget');
  return {
    ok: true,
    character: { ...character, attributes: { ...character.attributes, [name]: { ...character.attributes[name], points } } },
    touched: ['attributes'],
  };
}

// --- skills ------------------------------------------------------------------------------

const FIXED_CATEGORIES = Object.keys(CREATION_RULES.skillFixed);
const isLanguage = (category) => category === 'language-speak' || category === 'language-readwrite';
const maxRankFor = (category) => (isLanguage(category) ? CREATION_RULES.languageMaxRank : CREATION_RULES.skillMaxRank);

// Which fixed pool a catalog entry draws from, or null (it then draws the 8 extra ranks).
// Knowledge and the language categories take any skill of that category; the fixed Artisan
// rank is consumed ONLY by an artisan whose structured `artisanKey` is on the Discipline's
// `artisanSkills` list — a non-list artisan (or `Artisan (<text>)`) is always extra.
function fixedPoolOf(resolved, artisanList) {
  const c = resolved?.category;
  if (c === 'knowledge' || isLanguage(c)) return c;
  if (c === 'artisan' && resolved.artisanKey != null && artisanList.includes(resolved.artisanKey)) return 'artisan';
  return null;
}

// Derive the allocation from the stored set (nothing about fixed-vs-extra is stored): every
// skill's ledger rank `f` counts; each fixed pool is consumed first up to its total by the
// eligible skills, every other rank (general, non-list artisan, ranks beyond a pool) is extra.
function allocate(entries, ctx, artisanList) {
  const sums = Object.fromEntries(FIXED_CATEGORIES.map((c) => [c, 0]));
  let all = 0;
  for (const { name, f } of entries) {
    all += f;
    const pool = fixedPoolOf(ctx?.resolveSkill?.(name), artisanList);
    if (pool) sums[pool] += f;
  }
  const fixed = {};
  let fixedUsed = 0;
  for (const c of FIXED_CATEGORIES) {
    const total = CREATION_RULES.skillFixed[c];
    const used = Math.min(total, sums[c]);
    fixed[c] = { total, used, left: total - used };
    fixedUsed += used;
  }
  return { fixed, extraSpent: all - fixedUsed };
}

const ledgerRank = (free, name) => {
  const n = Number(free?.skills?.[name]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const allocationOf = (character, ctx, artisanList) =>
  allocate((character?.skills ?? []).map((s) => ({ name: s.name, f: ledgerRank(character?.creation?.free, s.name) })), ctx, artisanList);

// The pool the NEXT rank (a new pick's first rank, or a +1 on a row) draws from.
function nextPool(open, resolved, artisanList, alloc) {
  if (!open) return null;
  const fixedPool = fixedPoolOf(resolved, artisanList);
  if (fixedPool && alloc.fixed[fixedPool].left > 0) return 'fixed';
  return CREATION_RULES.skillExtraRanks - alloc.extraSpent > 0 ? 'extra' : null;
}

/**
 * The starting-skill budget (R5): fixed free ranks first (Knowledge 2, the Discipline-list
 * Artisan 1, Speak Language 2, Read/Write 1), then 8 extra ranks across Knowledge, Artisan,
 * Language and General (General only `category: general` at Novice `tier: 1`); a skill's total
 * rank is <= 3 including the fixed ranks and each language is its own Rank-1 entry. The
 * allocation is derived from the stored set. `rows` are the stored skills; `candidates` the
 * catalog entries a player may pick (language templates are not offered — per-language entries
 * cover languages; generic Knowledge/Artisan carry `freeText`).
 * @returns {{extra, fixed, valid, problems, rows, candidates}}
 */
export function skillBudget(character, ctx) {
  const { entry } = firstDiscipline(character, ctx);
  const artisanList = entry?.artisanSkills ?? [];
  const open = isOpen(character);
  const alloc = allocationOf(character, ctx, artisanList);
  const extraTotal = CREATION_RULES.skillExtraRanks;
  const extra = { total: extraTotal, spent: alloc.extraSpent, left: extraTotal - alloc.extraSpent };

  const problems = [];
  const rows = (character?.skills ?? []).map((s) => {
    const resolved = ctx?.resolveSkill?.(s.name) ?? null;
    const category = resolved?.category ?? null;
    const max = maxRankFor(category);
    const rank = Number(s.rank) || 0;
    if (!resolved) problems.push(`${s.name} is not in the skill catalog.`);
    else if (rank > max) problems.push(`${s.name} is above Rank ${max}.`);
    if (category === 'general' && resolved.tier !== 1) problems.push(`${s.name} is not a Novice skill.`);
    const pool = rank < max ? nextPool(open, resolved, artisanList, alloc) : null;
    return { name: s.name, category, rank, max, canRaise: open && rank < max && pool != null, canLower: open && rank > 1, pool };
  });

  const stored = new Set((character?.skills ?? []).map((s) => String(s.name).toLowerCase()));
  const seen = new Set();
  const candidates = [];
  for (const e of ctx?.skillCatalog ?? []) {
    if (seen.has(e.name)) continue; // the catalog lists Bribery and Skinning twice
    seen.add(e.name);
    if (e.generic && isLanguage(e.category)) continue; // templates: per-language entries cover languages
    if (e.category === 'general' && e.tier !== 1) continue; // the Novice-only gate
    if (!e.generic && stored.has(e.name.toLowerCase())) continue; // already stored
    const pool = nextPool(open, e, artisanList, alloc);
    candidates.push({
      name: e.name,
      category: e.category,
      generic: e.generic === true,
      freeText: e.generic === true ? (e.category === 'knowledge' || e.category === 'artisan' ? e.category : null) : null,
      disciplineList: e.category === 'artisan' && e.artisanKey != null && artisanList.includes(e.artisanKey),
      pool,
      attribute: e.attribute ?? null,
      brief: e.presentation?.shortEffect ?? e.summary ?? null,
      canPick: pool != null,
    });
  }
  return { extra, fixed: alloc.fixed, valid: extra.spent <= extraTotal && problems.length === 0, problems, rows, candidates };
}

const MAX_TEXT = 40;

/**
 * Add a starting skill at Rank 1, free (no Legend, no silver). `name` is a catalog name; a
 * generic Knowledge / Artisan entry also takes `text` (trimmed, 1-40 chars, no parentheses) and
 * is stored as `<Entry> (<text>)`. The language templates never take text. A general skill must
 * be Novice tier. Refuses a duplicate stored name (case-insensitive) and a pick with no
 * capacity. Touches advancements + creation.
 */
export function applySkillAdd(character, ctx, { name, text } = {}) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const catalogEntry = (ctx?.skillCatalog ?? []).find((s) => s.name === name);
  if (!catalogEntry) return refuse(character, 'unknown-skill');
  let storedName = catalogEntry.name;
  if (catalogEntry.generic) {
    if (isLanguage(catalogEntry.category)) return refuse(character, 'generic-not-allowed');
    const t = typeof text === 'string' ? text.trim() : '';
    if (!t || t.length > MAX_TEXT || /[()]/.test(t)) return refuse(character, 'bad-text');
    storedName = `${catalogEntry.name} (${t})`;
  }
  if (catalogEntry.category === 'general' && catalogEntry.tier !== 1) return refuse(character, 'tier-not-novice');
  const lower = storedName.toLowerCase();
  if ((character.skills ?? []).some((s) => String(s.name).toLowerCase() === lower)) return refuse(character, 'duplicate');

  const { entry } = firstDiscipline(character, ctx);
  const artisanList = entry?.artisanSkills ?? [];
  const free = ledgerOf(character);
  free.skills[storedName] = 1;
  const next = { ...character, skills: [...(character.skills ?? []), { name: storedName, rank: 1, tier: 'Novice' }], creation: creationWith(character, free) };
  if (allocationOf(next, ctx, artisanList).extraSpent > CREATION_RULES.skillExtraRanks) return refuse(character, 'over-budget');
  return { ok: true, character: next, touched: ['advancements', 'creation'] };
}

/**
 * Set a stored skill's rank (>= 1; remove with applySkillRemove). Max Rank 3 including the
 * fixed ranks, a language stays Rank 1. The ledger follows the rank. Fixed ranks are consumed
 * first, so a raise is refused (`over-budget`) only when the 8 extra ranks cannot absorb it.
 */
export function applySkillRank(character, ctx, { name, rank }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  if (!isInt(rank) || rank < 1) return refuse(character, 'bad-rank');
  const row = (character.skills ?? []).find((s) => s.name === name);
  if (!row) return refuse(character, 'not-found');
  const category = ctx?.resolveSkill?.(name)?.category ?? null;
  if (rank > maxRankFor(category)) return refuse(character, 'rank-cap');
  if (rank === (Number(row.rank) || 0)) return refuse(character, 'no-change');

  const { entry } = firstDiscipline(character, ctx);
  const artisanList = entry?.artisanSkills ?? [];
  const before = allocationOf(character, ctx, artisanList);
  const free = ledgerOf(character);
  free.skills[name] = rank;
  const next = {
    ...character,
    skills: character.skills.map((s) => (s === row ? { ...s, rank } : s)),
    creation: creationWith(character, free),
  };
  const after = allocationOf(next, ctx, artisanList);
  if (after.extraSpent > CREATION_RULES.skillExtraRanks && after.extraSpent > before.extraSpent) return refuse(character, 'over-budget');
  return { ok: true, character: next, touched: ['advancements', 'creation'] };
}

/** Remove a stored skill and its ledger key (frees its capacity). Touches advancements + creation. */
export function applySkillRemove(character, ctx, { name }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const row = (character.skills ?? []).find((s) => s.name === name);
  if (!row) return refuse(character, 'not-found');
  const free = ledgerOf(character);
  delete free.skills[name];
  return {
    ok: true,
    character: { ...character, skills: character.skills.filter((s) => s !== row), creation: creationWith(character, free) },
    touched: ['advancements', 'creation'],
  };
}

// --- spells ------------------------------------------------------------------------------

// Look a spell up in the catalog apostrophe-insensitively (the audit's normalisation);
// returns the catalog entry plus its canonical (catalog) name.
function findSpell(catalog, name) {
  const want = normSpellName(name);
  const key = Object.keys(catalog ?? {}).find((k) => normSpellName(k) === want);
  return key ? { ...catalog[key], name: key } : null;
}

const perceptionOf = (ctx) => (typeof ctx?.perceptionStep === 'number' && Number.isFinite(ctx.perceptionStep) ? ctx.perceptionStep : null);
const spellNames = (character) => (character?.spells?.known ?? []).map((k) => normSpellName(k?.name));

function spellSpent(character, ctx) {
  const free = new Set((character?.creation?.free?.spells ?? []).map(normSpellName));
  return (character?.spells?.known ?? [])
    .filter((k) => free.has(normSpellName(k?.name)))
    .reduce((s, k) => s + (Number(findSpell(ctx?.spellCatalog, k?.name)?.circle) || 0), 0);
}

/**
 * The starting-spell budget (R6) — `null` unless the first Discipline is a magician. Spell
 * points = the derived Perception Step (`ctx.perceptionStep`, never stored; `null` leaves
 * total/left null and nothing pickable — never a fabricated budget); a spell costs its Circle
 * (1 or 2). Candidates: catalog spells of the Discipline at Circle 1-2 not yet known. A Circle-2
 * spell is known but not placeable in a matrix at Circle 1.
 * @returns {null | {total, spent, left, valid, rows, candidates}}
 */
export function spellBudget(character, ctx) {
  const { disc, entry } = firstDiscipline(character, ctx);
  if (!isMagicianEntry(entry)) return null;
  const open = isOpen(character);
  const total = perceptionOf(ctx);
  const spent = spellSpent(character, ctx);
  const left = total == null ? null : total - spent;
  const known = new Set(spellNames(character));
  const rows = (character.spells?.known ?? []).map((k) => {
    const circle = Number(findSpell(ctx?.spellCatalog, k?.name)?.circle) || null;
    return { name: k.name, circle, placeable: circle != null && circle <= (Number(disc.circle) || 1), canRemove: open };
  });
  const candidates = Object.entries(ctx?.spellCatalog ?? {})
    .filter(([n, s]) => s.discipline === disc.name && CREATION_RULES.spellCircles.includes(s.circle) && !known.has(normSpellName(n)))
    .map(([n, s]) => ({ name: n, circle: s.circle, cost: s.circle, canPick: open && left != null && s.circle <= left }));
  return { total, spent, left, valid: total == null ? spent === 0 : spent <= total, rows, candidates };
}

/**
 * Learn a starting spell: a free pick (no roll, no silver, no talent prerequisite) of a
 * Circle 1-2 spell of the Discipline, costing its Circle in spell points. Stores
 * `{ name: <catalog name>, learntSuccess: 0 }` and the catalog name in `free.spells`.
 * Touches spells + creation.
 */
export function applySpellPick(character, ctx, { name }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const { disc, entry } = firstDiscipline(character, ctx);
  if (!isMagicianEntry(entry)) return refuse(character, 'not-a-magician');
  const spell = findSpell(ctx?.spellCatalog, name);
  if (!spell) return refuse(character, 'unknown-spell');
  if (spell.discipline !== disc.name || !CREATION_RULES.spellCircles.includes(spell.circle)) return refuse(character, 'not-available');
  if (spellNames(character).includes(normSpellName(spell.name))) return refuse(character, 'duplicate');
  const total = perceptionOf(ctx);
  if (total == null || spellSpent(character, ctx) + spell.circle > total) return refuse(character, 'over-budget');
  const free = ledgerOf(character);
  free.spells.push(spell.name);
  const spells = { ...(character.spells ?? { matrices: [] }), known: [...(character.spells?.known ?? []), { name: spell.name, learntSuccess: 0 }] };
  return { ok: true, character: { ...character, spells, creation: creationWith(character, free) }, touched: ['spells', 'creation'] };
}

/** Forget a starting spell: drops it from `known` and the ledger and releases any matrix holding it. */
export function applySpellRemove(character, ctx, { name }) {
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const { entry } = firstDiscipline(character, ctx);
  if (!isMagicianEntry(entry)) return refuse(character, 'not-a-magician');
  const want = normSpellName(name);
  if (!spellNames(character).includes(want)) return refuse(character, 'not-found');
  const free = ledgerOf(character);
  free.spells = free.spells.filter((n) => normSpellName(n) !== want);
  const spells = {
    ...character.spells,
    known: character.spells.known.filter((k) => normSpellName(k?.name) !== want),
    matrices: (character.spells.matrices ?? []).map((m) => (normSpellName(m?.spell) === want ? { ...m, spell: null } : m)),
  };
  return { ok: true, character: { ...character, spells, creation: creationWith(character, free) }, touched: ['spells', 'creation'] };
}

/**
 * The matrix guard for the Spells tab while creation is open: a matrix may not hold a spell
 * whose Circle exceeds the Discipline's Circle (a Circle-2 spell is known, not placed, at
 * Circle 1). `{ ok: true }` when creation is closed or absent.
 * @returns {{ok: true} | {ok: false, reason: 'matrix-circle'}}
 */
export function checkSpellMatrices(character, nextSpells, ctx) {
  if (!isOpen(character)) return { ok: true };
  const circle = Number(character.disciplines?.[0]?.circle) || 1;
  for (const m of nextSpells?.matrices ?? []) {
    if (!m?.spell) continue;
    const found = findSpell(ctx?.spellCatalog, m.spell);
    if (found && Number(found.circle) > circle) return { ok: false, reason: 'matrix-circle' };
  }
  return { ok: true };
}

// --- status, Finish ----------------------------------------------------------------------

/**
 * The derived creation view the UI renders (`model.creation`): `null` without a `creation`
 * block, `{ open: false }` after Finish, else `{ open: true, free, talents, attributes,
 * skills, spells, canFinish, blockers }` (`spells` is null for a non-magician). `canFinish` is
 * every present budget valid; each invalid budget adds a blocker string naming it and the
 * overspend.
 */
export function creationStatus(character, ctx) {
  if (!character?.creation) return null;
  if (character.creation.open !== true) return { open: false };
  const talents = talentBudget(character, ctx);
  const attributes = attributeBudget(character, ctx);
  const skills = skillBudget(character, ctx);
  const spells = spellBudget(character, ctx);
  const blockers = [];
  if (!talents.valid) {
    blockers.push(talents.spent > talents.total ? `Talent points are over-spent by ${talents.spent - talents.total}.` : `A talent is above Rank ${CREATION_RULES.talentMaxRank}.`);
  }
  if (!attributes.valid) {
    blockers.push(attributes.left < 0 ? `Attribute points are over-spent by ${-attributes.left}.` : `An attribute is outside the ${attributes.min} to +${attributes.max} range.`);
  }
  if (!skills.valid) {
    if (skills.extra.spent > skills.extra.total) blockers.push(`Skill ranks are over-spent by ${skills.extra.spent - skills.extra.total}.`);
    blockers.push(...skills.problems);
  }
  if (spells && !spells.valid) {
    blockers.push(spells.total == null ? 'Spell points cannot be checked: the Perception Step is unresolved.' : `Spell points are over-spent by ${spells.spent - spells.total}.`);
  }
  return { open: true, free: character.creation.free, talents, attributes, skills, spells, canFinish: blockers.length === 0, blockers };
}

/**
 * What Finish would do, for the confirm dialog: `{ canFinish, blockers, forfeits: { talents,
 * skills, spells }, karmaBonus, newMaxKarma, oldMaxKarma }`. The forfeits are the unspent
 * talent points, skill ranks (extra + every unused fixed rank) and spell points (R10);
 * `karmaBonus` is the unspent attribute points (R3) — `newMaxKarma` is the Circle-1 maximum
 * with the bonus INSIDE the race cap (Troll 3 + 25 => 20), `oldMaxKarma` without it; both null
 * when the race has no Karma Modifier.
 */
export function finishPlan(character, ctx) {
  const status = creationStatus(character, ctx);
  if (!status?.open) {
    return {
      canFinish: false,
      blockers: [status ? 'Creation is already finished.' : 'This character has no creation to finish.'],
      forfeits: { talents: 0, skills: 0, spells: 0 },
      karmaBonus: 0,
      newMaxKarma: null,
      oldMaxKarma: null,
    };
  }
  const unspent = (n) => Math.max(0, n ?? 0);
  const fixedLeft = Object.values(status.skills.fixed).reduce((s, p) => s + p.left, 0);
  const bonus = status.attributes.leftover;
  const cap = ctx?.karmaMaxCap ?? null;
  return {
    canFinish: status.canFinish,
    blockers: status.blockers,
    forfeits: {
      talents: unspent(status.talents.left),
      skills: unspent(status.skills.extra.left) + fixedLeft,
      spells: unspent(status.spells?.left),
    },
    karmaBonus: bonus,
    newMaxKarma: maxKarma(ctx?.karmaModifier, 1, cap, bonus),
    oldMaxKarma: maxKarma(ctx?.karmaModifier, 1, cap, 0),
  };
}

/**
 * Close creation. Refuses `already-finished` when `open === false` and `invalid-budget` while
 * any budget is over-spent. Otherwise sets `creation.open = false` (the ledger is kept as is,
 * so the audit treats those ranks as free forever) and raises `resources.karma.converted` by
 * `newMaxKarma - oldMaxKarma` (an ordinary ledger gain, so current Karma stays full at the new
 * maximum and the Karma sink stays 0). Unspent talent, skill and spell points are forfeited
 * (`summary`); `attributes[n].points` are locked from now on. With no Karma Modifier the Karma
 * step is skipped (`touched` has no 'karma').
 */
export function finishCreation(character, ctx) {
  if (character?.creation?.open === false) return refuse(character, 'already-finished');
  if (!isOpen(character)) return refuse(character, 'creation-closed');
  const plan = finishPlan(character, ctx);
  if (!plan.canFinish) return refuse(character, 'invalid-budget');
  const next = { ...character, creation: { open: false, free: ledgerOf(character) } };
  const touched = ['creation'];
  if (plan.newMaxKarma != null && plan.oldMaxKarma != null) {
    const karma = character.resources?.karma ?? {};
    next.resources = {
      ...character.resources,
      karma: { ...karma, converted: (Number(karma.converted) || 0) + (plan.newMaxKarma - plan.oldMaxKarma) },
    };
    touched.push('karma');
  }
  return { ok: true, character: next, touched, summary: plan.forfeits };
}
