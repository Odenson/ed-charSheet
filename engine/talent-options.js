// engine/talent-options.js — pure, DOM-free helpers for learning Talent Options
// and training a Circle (PLAN-LEARN-TALENTS §7). Reads structured discipline rule
// data (`rules/disciplines.json` + `rules/legend.json` costs); never touches the
// DOM or the store overlay. The store persists only inputs; these derive the
// slot/pool/grant facts the UI and guards need.

import { tierForCircle, lowestPriorCircle, talentRankStepCost } from './legend-spent.js';

// Talents every adept receives automatically — neither discipline-pool options
// nor gating Discipline Talents in the "N in total" advancement rule. Single
// source of truth: the store imports this instead of redeclaring it.
export const UNIVERSAL_TALENTS = new Set(['Durability', 'Karma Ritual']);

// The gating Discipline-Talent name set: the universals plus every talent the
// Discipline grants at any Circle (`circles[].talents`). Free talents are
// excluded — they advance with Circle and never occupy an option slot.
export function disciplineTalentSet(ref) {
  const set = new Set(UNIVERSAL_TALENTS);
  for (const c of ref?.circles ?? []) for (const t of c.talents ?? []) set.add(t);
  return set;
}

export function freeTalentSet(ref) {
  const set = new Set();
  for (const c of ref?.circles ?? []) for (const t of c.freeTalents ?? []) set.add(t);
  return set;
}

/**
 * Per-Circle option-slot state for Circles 1..attained. Each Circle has one slot
 * (decision Q2: one option per Circle); it is FILLED when a learned talent
 * recorded at that Circle is an option — not a Discipline Talent, not universal,
 * not free — and OPEN otherwise.
 * @returns {{circle:number, filledBy:string|null, open:boolean}[]} ascending
 */
export function optionSlots(ref, characterTalents, attained) {
  const dts = disciplineTalentSet(ref);
  const frees = freeTalentSet(ref);
  const isOption = (t) => !dts.has(t.name) && !frees.has(t.name);
  const filledAt = new Map();
  for (const t of characterTalents ?? []) {
    if (t.circle == null || !isOption(t)) continue;
    if (!filledAt.has(t.circle)) filledAt.set(t.circle, t.name); // first option at that Circle holds the slot
  }
  const cap = attained ?? Math.max(0, ...(characterTalents ?? []).map((t) => t.circle ?? 0));
  const slots = [];
  for (let c = 1; c <= cap; c++) {
    const filledBy = filledAt.get(c) ?? null;
    slots.push({ circle: c, filledBy, open: filledBy == null });
  }
  return slots;
}

// Tier label → the `talentOptions` pool key in rules/disciplines.json.
const poolKey = (tier) => (tier ? tier.toLowerCase() : null);
const TIER_ORDER = ['Novice', 'Journeyman', 'Warden', 'Master'];

/**
 * The talents that may fill an open slot at `circle`. Eligible pools are every
 * status pool at or below the slot's status tier (decision: lower pools allowed,
 * higher forbidden), with already-known names excluded (no duplicates). If the
 * slot's own tier has no pool data (Warden+ / Circles 9+, Q7), returns
 * `{ available: false }` so the UI can show the "pool data not yet added" note.
 * @returns {{available:boolean, items:string[]}}
 */
export function learnableTalents(ref, circle, { costs, knownNames = new Set() } = {}) {
  const tier = tierForCircle(circle, costs);
  const pools = ref?.talentOptions ?? {};
  // Restrict to available pool data: the slot's own tier pool must exist.
  if (!tier || !Array.isArray(pools[poolKey(tier)])) return { available: false, items: [] };
  const maxIdx = TIER_ORDER.indexOf(tier);
  const names = [];
  for (let i = 0; i <= maxIdx; i++) {
    const pool = pools[poolKey(TIER_ORDER[i])];
    if (Array.isArray(pool)) for (const n of pool) if (!names.includes(n)) names.push(n);
  }
  return { available: true, items: names.filter((n) => !knownNames.has(n)) };
}

/**
 * The Discipline Talent name(s) newly available on training to `attained + 1`:
 * the DTs granted at that Circle (`circles[circle === next].talents`) not already
 * known. Each is granted at Rank 1 by the train action.
 * @returns {string[]}
 */
export function nextCircleGrant(ref, attained, knownNames = new Set()) {
  const next = (attained ?? 0) + 1;
  const circleDef = (ref?.circles ?? []).find((c) => c.circle === next);
  return (circleDef?.talents ?? []).filter((n) => !knownNames.has(n));
}

// Silver an adept pays to start a Discipline, per Circle summed across the OTHER
// Disciplines, per talent learned (rules.md R3; Q038; PG:17261-17264, 17305-17315).
// Only a default: the fee is editable and negotiable at the table.
export const NEW_DISCIPLINE_FEE_PER_CIRCLE = 100;

/**
 * Pure quote for starting a Discipline (fresh) or seeding Circle 1 of a Discipline
 * already at Circle 1 that lacks Circle-1 Discipline Talents. Derived, never stored.
 * Returns null when the Discipline is not addable (absent, Circle > 1, complete, or
 * ordinal 1 which has no New-Discipline price).
 * @returns {null|{discipline:string, mode:'new'|'seed', ordinal:number,
 *   lowestCircleBefore:number|null, feeBase:number, grants:string[],
 *   optionPool:{available:boolean, items:string[]}, optionSlotOpen:boolean,
 *   perTalentLegend:number|null, legendTotal:(withOption?:boolean)=>number|null,
 *   defaultSilver:(withOption?:boolean)=>number}}
 */
export function initiationQuote(ref, disciplines, costs, { tierShift = 0 } = {}) {
  if (!ref?.name) return null;
  const ds = disciplines ?? [];
  const idx = ds.findIndex((d) => d?.name === ref.name);
  const existing = idx >= 0 ? ds[idx] : null;
  if (existing && existing.circle !== 1) return null;
  const mode = existing ? 'seed' : 'new';
  const at = existing ? idx : ds.length;
  if (at === 0) return null; // ordinal 1: no New-Discipline Rank-1 price

  const circle1 = (ref.circles ?? []).find((c) => c.circle === 1);
  const frees = freeTalentSet(ref);
  const known = new Set();
  for (const d of ds) for (const t of d?.talents ?? []) known.add(t.name);
  const grants = (circle1?.talents ?? []).filter((n) => !known.has(n) && !UNIVERSAL_TALENTS.has(n) && !frees.has(n));
  if (existing && grants.length === 0) return null;

  const ordinal = at + 1;
  const lowestCircleBefore = lowestPriorCircle(ds, at);
  const feeBase = ds.reduce((sum, d, i) => (i === idx ? sum : sum + (Number(d?.circle) || 0)), 0);

  const slotOpen = existing ? (optionSlots(ref, existing.talents ?? [], 1)[0]?.open ?? true) : true;
  const pool = learnableTalents(ref, 1, { costs, knownNames: known });
  const optionPool = slotOpen ? pool : { available: true, items: [] };

  const perTalentLegend = talentRankStepCost({ circle: 1 }, ordinal, lowestCircleBefore, costs, 1, { tierShift });
  const count = (withOption) => grants.length + (withOption && slotOpen ? 1 : 0);
  return {
    discipline: ref.name,
    mode,
    ordinal,
    lowestCircleBefore,
    feeBase,
    grants,
    optionPool,
    optionSlotOpen: slotOpen,
    perTalentLegend,
    legendTotal: (withOption = false) => (perTalentLegend == null ? null : perTalentLegend * count(withOption)),
    defaultSilver: (withOption = false) => NEW_DISCIPLINE_FEE_PER_CIRCLE * feeBase * count(withOption),
  };
}

/** Every rules Discipline that can be started or seeded, as quotes. */
export function addableDisciplines(refs, disciplines, costs, opts = {}) {
  return (refs ?? []).map((r) => initiationQuote(r, disciplines, costs, opts)).filter(Boolean);
}

/**
 * Discipline Talents of `ref` (Circles <= `circle`) that the character does not hold
 * under this Discipline but knows through ANOTHER Discipline. Shared talents are
 * learned once and count for every Discipline that lists them (rules.md R6; Q038 (5),
 * PG p.457), so they gate Circle advancement here and show as read-only rows.
 * Highest rank across the other Disciplines wins; `circle` is the Circle at which
 * `ref` grants the talent (never stored). Free and universal talents are excluded.
 * @param {object} ref  rules entry for this Discipline
 * @param {number} circle  attained Circle
 * @param {{name:string,rank:number}[]} ownTalents  talents stored under this Discipline
 * @param {{name:string,talents?:{name:string,rank:number}[]}[]} others  the character's OTHER Disciplines
 * @returns {{name:string,rank:number,circle:number,from:string}[]}
 */
export function sharedDisciplineTalents(ref, circle, ownTalents, others) {
  const own = new Set((ownTalents ?? []).map((t) => t.name));
  const frees = freeTalentSet(ref);
  const out = [];
  for (const c of ref?.circles ?? []) {
    if (c.circle > (circle ?? 1)) continue;
    for (const name of c.talents ?? []) {
      if (own.has(name) || frees.has(name) || UNIVERSAL_TALENTS.has(name) || out.some((o) => o.name === name)) continue;
      let best = null;
      for (const d of others ?? []) {
        for (const t of d?.talents ?? []) {
          if (t.name === name && t.viaVersatility !== true && (!best || t.rank > best.rank)) best = { rank: t.rank, from: d.name };
        }
      }
      if (best) out.push({ name, rank: best.rank, circle: c.circle, from: best.from });
    }
  }
  return out;
}
