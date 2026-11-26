// ui/notes-state.js — pure note-list helpers for the Notes sub-view (plans/update-notes-edit).
// No DOM, no lit: ed-notes builds the next full notes list with these and dispatches it up
// (`ed-edit-notes`); ed-app applies, persists and re-derives. Neither helper mutates its input
// array or its entries, and a null/undefined list is treated as [].

/** New note (id == null) → [{ id: makeId(), text }, ...list].
 *  Existing id → copy of list with that entry's text replaced (other fields and order kept).
 *  Missing id → shallow copy, unchanged. `text` is stored as given. */
export function upsertNote(list, id, text, makeId) {
  const src = list ?? [];
  if (id == null) return [{ id: makeId(), text }, ...src];
  return src.map((n) => (n.id === id ? { ...n, text } : n));
}

/** Copy of list without the entry whose id === id (an unchanged copy if absent). */
export function removeNote(list, id) {
  return (list ?? []).filter((n) => n.id !== id);
}
