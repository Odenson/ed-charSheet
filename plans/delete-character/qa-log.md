# QA log — delete-character

Feature brief (owner, /new-feature args): add the ability to delete a created character, with a warning against accidental deletes, deleting the character, and offering an option to also delete the portrait. By default NOT both are deleted unless the user specifies both.

## 2026-11-22 — asked by interrogator
**Q:** Where should the Delete action live?
**A:** Loader rows (a delete icon on each character row in the picker, beside the existing draft Discard action).

## 2026-11-22 — asked by interrogator
**Q:** Which characters can be deleted — saved on the branch, unsaved drafts, or both?
**A:** Both, one unified Delete (draft path just clears local storage; saved path deletes file + index row on the branch).

## 2026-11-22 — asked by interrogator
**Q:** How strong should the accidental-delete guard be?
**A:** Type the character's name to confirm; modal warns it is permanent; Delete stays disabled until the name matches.

## 2026-11-22 — asked by interrogator
**Q:** Which image files does "also delete the portrait" remove?
**A:** Current portrait (meta.portrait) only, and only if no other character's portrait references it (skip with a note if shared).

## 2026-11-22 — asked by interrogator
**Q:** Unsaved local edits / currently-open character being deleted?
**A:** Delete discards them; the modal warns about unsaved edits being lost; overlay/draft cleared and app returns to loader (or next character).

## 2026-11-22 — asked by interrogator
**Q:** Worker change acceptable (new delete route, redeploy), recovery via git history, no in-app undo?
**A:** Yes, worker change; no undo.

## 2026-11-22 — asked by interrogator
**Q:** If the file changed on the branch since this device last saw it, should delete proceed?
**A:** Block with a stale warning (send last-known base; mismatch -> stale_base; user must reload first).

## 2026-11-22 — asked by interrogator
**Q:** Anything else material / scope settled?
**A:** Scope is settled. Portrait checkbox is unchecked by default (brief: not both deleted unless user specifies both).
