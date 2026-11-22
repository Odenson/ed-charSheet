// ui/portrait-modal-state.js — the pure selection state behind ui/ed-edit-portrait.js
// (plans/add-char-portrait). No DOM; unit-tested in portrait-modal-state.test.js.
//
// A selection is one of:
//   { kind: 'existing', path }   an image already on the branch (or the current one)
//   { kind: 'new', processed }   a freshly processed upload (ui/portrait-image.js)
//   { kind: 'remove' }           clear the portrait
// or null (nothing chosen yet).

export const selectExisting = (path) => ({ kind: 'existing', path });
export const selectNew = (processed) => ({ kind: 'new', processed });
export const selectRemove = () => ({ kind: 'remove' });

/** Would confirming change anything? `initial` is the current portrait path or null. */
export function isDirty(initial, selection) {
  if (!selection) return false;
  if (selection.kind === 'new') return true;
  if (selection.kind === 'remove') return (initial ?? null) !== null;
  return selection.path !== initial;
}

/** The `ed-edit-portrait` event detail for a selection (the staged payload only
 *  for a new upload; the modal itself persists nothing). */
export function toDetail(selection) {
  if (selection.kind === 'remove') return { portrait: null };
  if (selection.kind === 'existing') return { portrait: selection.path };
  const { path, mime, dataUrl } = selection.processed;
  return { portrait: path, staged: { path, mime, dataUrl } };
}
