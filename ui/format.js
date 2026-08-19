// ui/format.js — shared display-only formatters (Tier 3: they never compute a
// game value, they only format data the engine already resolved). Pure and
// DOM-free, so the equipment/trade/overview/custom-item views read from one
// definition instead of four local copies.

/** Round to 2dp and thousand-separate a number for display. */
export const numFmt = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US');

/** Uppercase the first character of a string. */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Split a camelCase identifier into words ("shortRange" → "short Range"). */
export const prettyName = (n) => (n ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');

/** camelCase → Title Case for display ("sourceSheetVersion" → "Source Sheet Version"). */
export const humanize = (k) => cap(prettyName(k));
