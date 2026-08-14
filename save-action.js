// save-action.js — pure mapping from a conflict-modal choice to the next save
// step. Kept dependency-free and DOM-free so ed-app's conflict transition is
// unit-testable (no DOM harness exists). See plans/PLAN-SAVE-CONCURRENCY.md
// Phase C.
//
// The modal offers three choices after a `stale_base` conflict (the character
// changed on the branch since this client last read or saved it):
//   keep-mine     → acknowledge the branch state and overwrite it with the local
//                   version. The conflict's current file sha becomes the base of
//                   the re-save, so the overwrite is explicit, not silent.
//   take-theirs   → discard the local draft and reload the branch version.
//   cancel        → close the modal; the local overlay stays dirty, nothing is
//                   written.
export function nextSaveAction({ choice, conflictSha } = {}) {
  switch (choice) {
    case 'keep-mine':
      return { action: 'resave', base: conflictSha };
    case 'take-theirs':
      return { action: 'reload' };
    default:
      return { action: 'none' };
  }
}
