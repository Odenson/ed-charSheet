// engine/legend.js — pure, DOM-free Legend Point derivations.
//
// Legend Points are stored inputs (resources.legend: totalEarnt / totalSpent).
// Everything the Overview shows about a character's standing is derived from
// them here — the app never stores what these functions recompute.

/**
 * Available (spendable) Legend = totalEarnt − totalSpent.
 * (Resolves REVIEW-FINDINGS G1 for Legend: the stored `available` is dropped in
 * favour of this derivation.) Returns null when there is no earned total.
 */
export function legendAvailable(totalEarnt, totalSpent) {
  if (totalEarnt == null) return null;
  return totalEarnt - (totalSpent ?? 0);
}

/**
 * The Legendary Status band for a total Legend earned: the first band whose
 * `maxLegend` the total is below (the final, open-topped band has maxLegend
 * null). `bands` is rules/legend.json's `bands` array. Returns null when the
 * total is unknown or no bands are given.
 * @param {number|null|undefined} totalEarnt
 * @param {Array<{label:string, maxLegend:number|null, renown:number, reputation:number, definition:string}>} bands
 */
export function legendaryStatus(totalEarnt, bands) {
  if (totalEarnt == null || !Array.isArray(bands) || bands.length === 0) return null;
  return bands.find((b) => b.maxLegend == null || totalEarnt < b.maxLegend) ?? bands[bands.length - 1];
}
