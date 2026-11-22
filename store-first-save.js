// store-first-save.js — the first Save of a draft, with the id re-check (create-new-adept).
//
// A draft has no file on the character-data branch, so its first Save posts with `base: null`
// (the worker's create path, which would overwrite an existing id). The owner's rule (plans/
// create-new-adept/qa-log.md): never suffix — re-read the index FRESH immediately before the
// post and, if the id is now taken (another device saved it meanwhile), stop with nothing
// posted so the caller can ask the player to rename. The residual window after the check is
// accepted by the owner ("extremely low", no worker change).
//
// I/O is injected so the id race is testable without a network:
//   fetchTakenIds() -> Promise<Iterable<string>>   a fresh index read (index ids only)
//   post(character, id) -> Promise<commit>          saveServer(..., { id, base: null })
// This module neither mutates the character nor touches the draft store: promotion after a
// confirmed save is the caller's job (store-drafts.js promoteDraft).

import { idTaken } from './engine/new-character.js';

/**
 * @returns {Promise<{ ok: true, commit: object } | { ok: false, reason: 'id-taken', id: string }>}
 *   Rejections (the index read or the post failing) propagate to the caller; a failed index
 *   read posts nothing.
 */
export async function saveDraftFirstTime({ character, id, fetchTakenIds, post }) {
  const taken = await fetchTakenIds();
  if (idTaken(id, taken)) return { ok: false, reason: 'id-taken', id };
  return { ok: true, commit: await post(character, id) };
}
