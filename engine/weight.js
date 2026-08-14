// engine/weight.js — carried weight, pure and DOM-free (ARCHITECTURE §3/§5).
//
// The rules catalog records weight as free text with inconsistent units: "N lb",
// "N oz", bare numbers, ranges ("8-10 lb"), "Neg."/"—" for negligible, and "NA"
// for unknown. The character sheet only ever *stores* those strings (an input);
// the pound total is recomputed here and never stored ("store only inputs").
//
// Coins/gems are deliberately excluded: they live in `character.wealth`, not the
// owned-items list, so they never reach carriedWeight at all.

// Split on the unit — `N lb` / `N lbs` / `N pounds` / `N oz` / `N ounces` / bare
// number (treated as pounds, the only unit-less weights in the catalog).
const UNIT = /^([\d.]+)\s*(lbs?|pounds?|ounces?|oz)?$/;

/**
 * Parse one catalog weight string into pounds, or `null` when the weight is
 * unknown (so it contributes nothing rather than a fabricated number).
 *
 *   "5 lb"   → 5     "8 oz"   → 0.5   "8-10 lb" → 9   "Neg." → 0   "NA" → null
 *
 * @param {*} weight  the stored `ref.weight` (string, number, or undefined)
 * @returns {number|null} pounds (2-dp-safe), or null when unknowable
 */
export function parseWeight(weight) {
  if (weight == null) return null;
  const s = String(weight).trim().toLowerCase();
  if (!s || s === 'na' || s === 'n/a' || s === 'unknown') return null;
  if (s === 'neg.' || s === 'negligible' || s === '—' || s === '–' || s === '-') return 0;
  // Ranges ("8-10 lb") — a single item whose weight varies by material. Use the
  // midpoint as the sheet's expected value.
  const range = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)\s*(lbs?|pounds?)?$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return round2((lo + hi) / 2);
    return null;
  }
  const m = s.match(UNIT);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2];
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return round2(n / 16);
  return round2(n); // pounds, or a bare number read as pounds
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Total carried weight of an owned-items list ({ ref: { weight } } each), plus
 * a count of the items whose weight is unknowable (NA / unrecorded) so the UI
 * can say so rather than silently under-report.
 *
 * @param {Array<{ref?: {weight?: *}}>} items  resolved owned items (all owned,
 *        equipped and stored alike — storage weight still rests on the back)
 * @returns {{carried: number, unweighed: number}}
 */
export function carriedWeight(items = []) {
  let carried = 0;
  let unweighed = 0;
  for (const it of items ?? []) {
    // Quantity scales both the weight and the unknown-weight count: a stack of 3
    // unweighed items is 3 unknowns, not 1, so the UI never under-reports.
    const qty = Number.isFinite(it?.qty) ? Math.max(0, it.qty) : 1;
    const w = parseWeight(it?.ref?.weight);
    if (w == null) {
      unweighed += qty;
      continue;
    }
    carried += w * qty;
  }
  return { carried: round2(carried), unweighed };
}
