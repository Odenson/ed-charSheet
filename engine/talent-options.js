// engine/talent-options.js — pure, DOM-free helpers for learning Talent Options
// and training a Circle (PLAN-LEARN-TALENTS §7). Reads structured discipline rule
// data (`rules/disciplines.json` + `rules/legend.json` costs); never touches the
// DOM or the store overlay. The store persists only inputs; these derive the
// slot/pool/grant facts the UI and guards need.

import { tierForCircle } from './legend-spent.js';

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

function freeTalentSet(ref) {
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
