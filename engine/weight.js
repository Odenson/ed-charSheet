// engine/weight.js — carried weight, pure and DOM-free (ARCHITECTURE §3/§5).
//
// The rules catalog records weight as structured data (`ref.weight`, schema
// ed-items/3): `null` (unrecorded/unknown), `{ "negligible": true }`, or
// `{ "amount": n, "unit": "lb" | "oz" }`. The character sheet only ever *stores*
// those values (an input); the pound total is recomputed here and never stored
// ("store only inputs").
//
// Coins/gems are deliberately excluded: they live in `character.wealth`, not the
// owned-items list, so they never reach carriedWeight at all.

// Structured unit table — a data table the reader looks up (mirrors
// COIN_DENOMINATIONS in engine/wealth.js), not a hard-coded branch.
const WEIGHT_UNITS = [
  { key: 'lb', pounds: 1 },
  { key: 'oz', pounds: 1 / 16 },
];

/**
 * Resolve a catalog `ref.weight` into pounds, or `null` when the weight is
 * unknown (so it contributes nothing rather than a fabricated number).
 *
 *   { amount: 5, unit: 'lb' } → 5     { amount: 8, unit: 'oz' } → 0.5
 *   { negligible: true }      → 0     null → null
 *
 * A bare number is not a valid ed-items/3 weight (validator and reader agree);
 * it reads as unknown, never as pounds.
 *
 * @param {*} w  the stored `ref.weight` (structured object or null)
 * @returns {number|null} pounds (2-dp-safe), or null when unknowable
 */
export function weightPounds(w) {
  if (w == null) return null;
  if (typeof w === 'object') {
    if (w.negligible === true) return 0;
    const unit = WEIGHT_UNITS.find((u) => u.key === w.unit);
    if (unit && typeof w.amount === 'number' && Number.isFinite(w.amount) && w.amount >= 0) {
      return round2(w.amount * unit.pounds);
    }
  }
  return null; // bare number / legacy string / unknown shape — never fabricated
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Total carried weight of an owned-items list ({ ref: { weight } } each), plus
 * a count of the items whose weight is unknowable (null / unrecorded) so the UI
 * can say so rather than silently under-report.
 *
 * @param {Array<{name?: string, ref?: {weight?: *}}>} items  resolved owned items
 *        (all owned, equipped and stored alike — storage weight still rests on
 *        the back)
 * @returns {{carried: number, unweighed: number, unweighedItems: Array<{name: string|null, qty: number}>}}
 *          `unweighedItems` names each null-weight row (one entry per row, with
 *          its quantity) so the UI can list which items lack a recorded weight —
 *          judging "unweighed" is rule logic (weightPounds), never the UI's.
 */
export function carriedWeight(items = []) {
  let carried = 0;
  let unweighed = 0;
  const unweighedItems = [];
  for (const it of items ?? []) {
    // Quantity scales both the weight and the unknown-weight count: a stack of 3
    // unweighed items is 3 unknowns, not 1, so the UI never under-reports.
    const qty = Number.isFinite(it?.qty) ? Math.max(0, it.qty) : 1;
    const w = weightPounds(it?.ref?.weight);
    if (w == null) {
      unweighed += qty;
      unweighedItems.push({ name: it?.name ?? null, qty });
      continue;
    }
    carried += w * qty;
  }
  return { carried: round2(carried), unweighed, unweighedItems };
}
