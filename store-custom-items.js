// store-custom-items.js — save + overlay plumbing for the player-created custom
// item catalog (docs/PLAN-CUSTOM-ITEMS.md). Mirrors the character save split:
// store-server.js owns the /save POST; this module owns the /save-items POST plus
// the local `ed-custom-items` overlay the manager modal writes instantly (pending
// edits survive a reload and an offline worker) and a confirmed save reconciles
// away (the branch read then becomes the source of truth, like store.js
// reconcileOverlay for the character overlay).
//
// Not an engine module: pure I/O plumbing (no game logic, no DOM), the same
// separation store-server.js keeps for the character save.

import { SaveError } from './store-server.js';

// The deployed worker (runbook §7). Overridable per call, but hardcoded here so
// the app needs no configuration to save.
export const DEFAULT_ITEMS_ENDPOINT = 'https://ed-charsheet-save.edsavechar.workers.dev/save-items';

const OVERLAY_KEY = 'ed-custom-items';

// Human-readable fallback for a worker error code when it sends no message.
function messageForCode(code) {
  switch (code) {
    case 'unauthorized':
      return 'Your save key was rejected. Re-enter it and try again.';
    case 'invalid_items':
      return 'One or more items failed validation and were not saved.';
    case 'conflict':
      return 'The catalog kept changing under us — try saving again.';
    case 'upstream':
      return 'GitHub rejected the save. Check the token, then try again.';
    default:
      return 'The save did not complete.';
  }
}

/**
 * Save the custom-item delta to GitHub via the worker. Returns the commit
 * `{ sha, url }` on success; throws a typed {@link SaveError} otherwise. `saveKey`
 * is required (the worker fails closed) — a missing key throws `no_key` before
 * any request. `deleteNames` lists catalog entries to remove; the worker merges
 * `items` onto `data/custom-items.json` (custom wins on a canon-name collision),
 * applies the deletes, and commits the whole ed-items/2 file to character-data.
 */
export async function saveCustomItems(items, { endpoint = DEFAULT_ITEMS_ENDPOINT, saveKey, deleteNames = [] } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ items, delete: deleteNames }),
    });
  } catch {
    // The fetch itself failed — offline, DNS, CORS, or the worker is unreachable.
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) {
    const code = out?.error?.code ?? `http_${res.status}`;
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return out.commit; // { sha, url }
}

// --- local overlay (pending edits, key `ed-custom-items`) ---------------------
// The manager modal writes its working-set delta here on every change so a
// pending item is never lost (reload, offline worker). A confirmed save calls
// reconcileCustomEdits() to clear it — the branch read then becomes the source
// of truth, exactly like the character overlay (store.js reconcileOverlay).

/**
 * The pending custom-item delta `{ items: { <name>: <item> }, delete?: string[] }`,
 * or null when nothing is pending. Corrupt/absent storage reads as null (a bad
 * overlay must never block loading the catalog).
 */
export function loadCustomEdits() {
  try {
    const raw = JSON.parse(localStorage.getItem(OVERLAY_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.items != null && (typeof raw.items !== 'object' || Array.isArray(raw.items))) return null;
    if (raw.delete != null && !Array.isArray(raw.delete)) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * True while a custom-item delta is pending a confirmed save. An overlay that
 * holds no actual changes (empty `items` and `delete`) reads as not pending.
 */
export function hasCustomPendingEdits() {
  const d = loadCustomEdits();
  if (!d) return false;
  return Object.keys(d.items ?? {}).length > 0 || (d.delete ?? []).length > 0;
}

/** Persist the working-set delta `{ items?, delete? }`. */
export function saveCustomEdits(delta) {
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(delta));
}

/** Clear the overlay — call only on a confirmed save success. */
export function reconcileCustomEdits() {
  localStorage.removeItem(OVERLAY_KEY);
}

/**
 * Apply a pending delta onto a freshly-loaded catalog (pure — returns a new
 * object, never mutates). Custom wins on a canon-name collision; the delete list
 * is applied last, so a name in both is removed (matches the manager modal's
 * per-row last-write-wins semantics).
 */
export function applyCustomEdits(file, delta) {
  if (!delta) return file;
  const next = { ...(file ?? {}), items: { ...(file?.items ?? {}) } };
  for (const [name, item] of Object.entries(delta.items ?? {})) next.items[name] = item;
  for (const name of delta.delete ?? []) delete next.items[name];
  return next;
}

/**
 * Apply a pending delta onto an items *map* `{ name: item }` (the shape
 * `deriveModel.customCommittedCatalog` and the manager modal's `committed` prop
 * carry, vs the ed-items file shape applyCustomEdits takes). Same semantics:
 * custom wins on a collision, delete applied last. Pure — returns a new object.
 */
export function applyCustomItemsMap(base, delta) {
  const items = { ...(base ?? {}) };
  for (const [name, item] of Object.entries(delta?.items ?? {})) items[name] = item;
  for (const name of delta?.delete ?? []) delete items[name];
  return items;
}
