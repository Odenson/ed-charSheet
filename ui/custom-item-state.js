// ui/custom-item-state.js — the custom-item manager modal's working-set logic as
// pure functions (plans/PLAN-CUSTOM-ITEMS.md §5.2 / §6). Extracted from
// ui/ed-custom-item.js so the modal's open → draft → save → reopen lifecycle is
// testable with `node --test`, no DOM, no Lit.
//
// These functions only rearrange data — the golden rule (data flows down,
// events up) is unchanged. The component keeps the view and the `dispatch`
// plumbing; the state transitions it performs are pinned here. In particular,
// the seed/diff rules are the exact behaviours that produced three regressions
// (PLAN-CUSTOM-ITEMS.md §6.6): an edit form seeded from a stale committed copy,
// an effect dropped on save, and an overlay reconciled away against a lagged
// branch read. Each one is a lifecycle test in custom-item-state.test.js.

import { applyCustomItemsMap } from '../store-custom-items.js';

/**
 * Seed the modal's working set from the committed catalog plus any pending
 * `ed-custom-items` overlay delta. Overlay wins on a name collision — a
 * just-saved edit that is still pending (its branch re-read lagged the PUT)
 * must come back as the freshest copy, never the stale committed one. Pure:
 * returns a new Map, never mutates either input.
 */
export function seedWorking(committed, overlay) {
  return new Map(Object.entries(applyCustomItemsMap(committed, overlay)));
}

/**
 * Diff the working set against the committed catalog, exactly like the overlay
 * semantics: `{ items (create/edit), delete }`. Matching the overlay is what
 * makes a reload-then-reopen and a draft re-derive agree on what still needs
 * saving. Deep-equality is JSON.stringify (same as isItemsReflected), so an
 * untouched committed item reads as unchanged. Pure — never mutates.
 */
export function deltaFrom(working, committed) {
  const items = {};
  for (const [name, item] of working) {
    const orig = committed?.[name];
    if (!orig || JSON.stringify(orig) !== JSON.stringify(item)) items[name] = item;
  }
  const del = Object.keys(committed ?? {}).filter((name) => !working.has(name));
  return { items, delete: del };
}

/** True when a delta holds any create/edit or delete still needing a save. */
export function hasChanges(delta) {
  return Object.keys(delta?.items ?? {}).length > 0 || (delta?.delete ?? []).length > 0;
}

/**
 * Commit a (cleaned) item form into the working set. Upsert semantics: a name
 * that matches an existing working item edits it in place; a rename
 * (`originalName !== item.name`) removes the old key. The item is stored under
 * `name` — the clean form's final trimmed name — which may differ from the
 * item object's own fields. Pure — returns a new Map.
 */
export function commitForm(working, originalName, name, item) {
  const next = new Map(working);
  if (originalName && originalName !== name) next.delete(originalName);
  next.set(name, item);
  return next;
}

/**
 * Stage a delete by dropping the name from the working set; the delta vs the
 * committed catalog derives the `delete` list. Pure — returns a new Map.
 */
export function removeWorking(working, name) {
  const next = new Map(working);
  next.delete(name);
  return next;
}

// --- structured weight (ref.weight, schema ed-items/3) ---------------------
// The editor edits `ref.weight` as a small form state — a unit/kind mode plus
// a numeric amount — and this module maps to/from the stored structured shape.
// The stored forms are exactly what engine/weight.js and validate-item.js read:
//   undefined | null               → unrecorded      → mode "none"
//   { negligible: true }           → no weight       → mode "negligible"
//   { amount: n, unit: 'lb'|'oz' } → a measured weight
// A legacy pre-migration string is *never parsed* (the app principle: rule data
// is structured, never recovered from display strings by regex). A purely
// numeric string ("0.1", "2") maps to pounds — a lossless reading of a unit-less
// legacy value, not a parse — and any other string degrades to mode "none" with
// `legacy` set so the UI can say "needs re-entry" instead of silently dropping
// the user's stored weight.

const isWeightNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Map a stored `ref.weight` into the editor's form state `{ mode, amount }`.
 * Returns `{ legacy }` (the raw string) when only a human re-entry can save the
 * value; the pure structural cases round-trip losslessly.
 * @param {*} w  the stored `ref.weight` (structured object, number, string, null)
 * @returns {{mode: 'none'|'negligible'|'lb'|'oz', amount: string, legacy?: string}}
 */
export function weightToForm(w) {
  if (w == null) return { mode: 'none', amount: '' };
  if (typeof w === 'number') return { mode: 'lb', amount: String(w), ...(isWeightNumber(w) ? {} : { legacy: String(w) }) };
  if (typeof w === 'object') {
    if (w.negligible === true) return { mode: 'negligible', amount: '' };
    const { amount, unit } = w;
    if (typeof amount === 'number' && (unit === 'lb' || unit === 'oz')) {
      return { mode: unit, amount: String(amount) };
    }
    return { mode: 'none', amount: '', legacy: JSON.stringify(w) };
  }
  if (typeof w === 'string') {
    const n = Number(w.trim());
    return Number.isFinite(n) && n >= 0 && String(n) === w.trim()
      ? { mode: 'lb', amount: String(n) }
      : { mode: 'none', amount: '', legacy: w };
  }
  return { mode: 'none', amount: '', legacy: String(w) };
}

/**
 * Map the editor's weight form state back into a stored `ref.weight`.
 * @param {'none'|'negligible'|'lb'|'oz'} mode  selected unit/kind
 * @param {string|number} amount  the entered amount (for lb/oz modes)
 * @returns {undefined | {negligible: true} | {amount: number, unit: 'lb'|'oz'}}
 */
export function weightFromForm(mode, amount) {
  if (mode === 'none') return undefined;
  if (mode === 'negligible') return { negligible: true };
  if (mode === 'lb' || mode === 'oz') {
    if (amount === '' || amount == null) return undefined;
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return { amount: Math.round(n * 100) / 100, unit: mode };
  }
  return undefined;
}
