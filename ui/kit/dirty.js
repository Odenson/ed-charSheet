// ui/kit/dirty.js — pure dirty check for free-text modals: compares a snapshot
// taken at open with the current draft (plain objects). Values are normalised
// (null/undefined -> '', numbers/booleans -> String, objects -> JSON); no
// trimming, so a trailing space is a change. No lit, no DOM. See docs/MODALS.md.
const norm = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function isDirty(snapshot, draft) {
  const a = snapshot ?? {}, b = draft ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (norm(a[k]) !== norm(b[k])) return true;
  return false;
}
