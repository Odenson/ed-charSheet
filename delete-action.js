// delete-action.js — pure helpers for the delete-character flow (no DOM, no
// network), unit-testable like save-action.js. plans/delete-character.

/** Type-the-name confirm: trimmed typed text, case-sensitive, non-empty name. */
export function nameMatches(typed, name) {
  if (typeof typed !== 'string' || typeof name !== 'string' || name === '') return false;
  const t = typed.trim();
  return t !== '' && t === name;
}

/**
 * Decide how to delete. A draft is local-only. Otherwise pick the base (the open
 * character's `baseSha`, else the confirm-time `fileBase`); a null base is blocked
 * on Pages (the worker requires one) and proceeds off-Pages (local dev).
 * `deleteImage` (boolean) sends the committed `portrait` path.
 */
export function planDelete({ draft, isOpen, baseSha = null, fileBase = null, onPages = false, portrait = null, deleteImage = false } = {}) {
  if (draft) return { kind: 'draft' };
  const base = (isOpen ? baseSha : fileBase) ?? null;
  if (base === null && onPages) return { kind: 'block', reason: 'no_base' };
  const body = { base };
  if (deleteImage && portrait) body.deleteImage = portrait;
  return { kind: 'server', body };
}

/** Toast text for a completed delete. */
export function noticeForResult(result = {}) {
  if (result.deleted === false) return 'That character was already gone from GitHub; it was removed from the list.';
  switch (result.imageSkipped) {
    case 'shared':
      return 'Character deleted. Its portrait image was kept because another character still uses it.';
    case 'unverified':
      return 'Character deleted. The portrait image was kept because sharing could not be verified.';
    case 'error':
      return 'Character deleted, but the portrait image could not be removed.';
    case 'mismatch':
      return 'Character deleted. The portrait image was kept (it is not this character’s own image).';
    case 'none':
      return 'Character deleted. It had no portrait image to remove.';
    case 'unknown':
      return 'Character deleted. The portrait image was left untouched.';
    default:
      return 'Character deleted.';
  }
}
