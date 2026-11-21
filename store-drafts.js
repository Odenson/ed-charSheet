// store-drafts.js — localStorage drafts of brand-new characters (create-new-adept).
//
// A draft is a BASE ENVELOPE plus the ordinary edits overlay:
//   `ed-character-draft:<id>`  = { v: 1, createdAt: <ISO>, character: <ed-character/2> }
//   `ed-character-edits:<id>`  = the usual overlay store.js already keeps per character id
// so every edit handler, `hasPendingEdits` and `reconcileOverlay` work for a draft exactly as
// for a saved character. A draft never reaches the character-data branch until the first
// manual Save (store-first-save.js); then `promoteDraft` drops the base and the overlay is
// reconciled like any confirmed save. Device-local keys (`ed-rolllog:<id>`, `ed-discord:<id>`)
// are not this module's business — the ed-app handlers clear them.
//
// This module imports from store.js, never the reverse (store.js knows nothing of drafts).
// Nothing here throws on corrupt storage: a bad envelope reads as absent, like `loadEdits`.

import { applyEdits, editsKey, loadEdits, loadRules, reconcileOverlay } from './store.js';

export const DRAFT_PREFIX = 'ed-character-draft:';

/** The localStorage key of the draft base envelope for `id`. */
export function draftKey(id) {
  return `${DRAFT_PREFIX}${id}`;
}

// Parse an envelope; anything that is not `{ v: 1, character: {...} }` is absent (null).
function readEnvelope(id) {
  try {
    const env = JSON.parse(localStorage.getItem(draftKey(id)));
    if (!env || typeof env !== 'object' || Array.isArray(env)) return null;
    if (env.v !== 1) return null;
    if (!env.character || typeof env.character !== 'object' || Array.isArray(env.character)) return null;
    return env;
  } catch {
    return null; // absent or corrupt: never blocks anything (loadEdits precedent)
  }
}

/**
 * Write (or replace) the draft base for `character.meta.id` and return the envelope. An
 * existing draft keeps its `createdAt`. Throws without an id — nothing is stored then.
 */
export function saveDraft(character) {
  const id = character?.meta?.id;
  if (typeof id !== 'string' || !id) throw new Error('A draft needs meta.id');
  const existing = readEnvelope(id);
  const envelope = { v: 1, createdAt: existing?.createdAt ?? new Date().toISOString(), character };
  localStorage.setItem(draftKey(id), JSON.stringify(envelope));
  return envelope;
}

/** The draft envelope for `id`, or null when absent, corrupt or `v !== 1`. Never throws. */
export function loadDraft(id) {
  return readEnvelope(id);
}

/** True when a readable draft base exists for `id`. */
export function isDraft(id) {
  return readEnvelope(id) != null;
}

/**
 * The picker rows for every readable draft, sorted by id:
 * `{ id, name, portrait: null, draft: true, race, discipline, createdAt }` — an index row
 * (`{ id, name, portrait }`) plus the draft flag and the facts the row shows. Corrupt
 * envelopes are skipped; every other localStorage key is ignored.
 */
export function listDrafts() {
  const rows = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (typeof key !== 'string' || !key.startsWith(DRAFT_PREFIX)) continue;
    const id = key.slice(DRAFT_PREFIX.length);
    const env = readEnvelope(id);
    if (!env) continue;
    const c = env.character;
    rows.push({
      id,
      name: typeof c.meta?.name === 'string' && c.meta.name ? c.meta.name : id,
      portrait: null,
      draft: true,
      race: c.meta?.race ?? null,
      discipline: c.disciplines?.[0]?.name ?? null,
      createdAt: env.createdAt ?? null,
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

/** Remove the draft base AND its overlay for `id` — exactly those two keys, nothing else. */
export function discardDraft(id) {
  localStorage.removeItem(draftKey(id));
  localStorage.removeItem(editsKey(id));
}

/**
 * Re-key a draft: move the base and the overlay from `oldId` to `newId`, patching
 * `meta.id` / `meta.name` in the base and (when the overlay carries a `meta`) in the overlay.
 * Returns false — and changes nothing — when `oldId` has no draft or `newId` already is one.
 */
export function renameDraft(oldId, newId, name) {
  const env = readEnvelope(oldId);
  if (!env || readEnvelope(newId)) return false;
  const patchMeta = (meta) => ({ ...(meta ?? {}), id: newId, name });
  const moved = { ...env, character: { ...env.character, meta: patchMeta(env.character.meta) } };
  const overlayText = localStorage.getItem(editsKey(oldId));
  localStorage.setItem(draftKey(newId), JSON.stringify(moved));
  if (overlayText != null) {
    let overlay = null;
    try {
      overlay = JSON.parse(overlayText);
    } catch {
      overlay = null; // a corrupt overlay is dropped, as loadEdits would have ignored it
    }
    if (overlay && typeof overlay === 'object' && !Array.isArray(overlay)) {
      if (overlay.meta) overlay.meta = patchMeta(overlay.meta);
      localStorage.setItem(editsKey(newId), JSON.stringify(overlay));
    }
  }
  localStorage.removeItem(draftKey(oldId));
  localStorage.removeItem(editsKey(oldId));
  return true;
}

/**
 * After a CONFIRMED first save: the file is on the branch, so the overlay's saved
 * categories are redundant (reconcileOverlay, like any confirmed save) and the draft base
 * is removed. Touches only this id's base and overlay.
 */
export function promoteDraft(id) {
  reconcileOverlay(undefined, id);
  localStorage.removeItem(draftKey(id));
}

/**
 * The picker's merged row list: index rows plus draft rows, sorted by id. An id present in
 * both keeps the INDEX row (a draft shadowed by a saved character is hidden). Pure; inputs
 * are not mutated.
 */
export function mergeRows(indexRows, draftRows) {
  const byId = new Map();
  for (const r of draftRows ?? []) byId.set(r.id, r);
  for (const r of indexRows ?? []) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Load a draft for the app: `{ character, rules, base: null }` — the draft base with the
 * ordinary edits overlay applied, plus the rules bundle. `base: null` is what makes the
 * first Save take the create path. Throws when there is no readable draft for `id`.
 */
export async function loadDraftCharacter(id) {
  const env = readEnvelope(id);
  if (!env) throw new Error(`No draft for "${id}"`);
  const rules = await loadRules();
  return { character: applyEdits(env.character, loadEdits(id)), rules, base: null };
}
