# Tech Spec: Delete character (delete-character)

## Overview
Add a `POST /delete-character` route to the save worker (and a mirror in the dev server) that deletes `data/characters/<id>.json`, drops the id's row from `index.json`, and optionally deletes the character's own unshared `meta.portrait` image. On the client a new pure helper plus `store-server.js` `deleteCharacterServer` perform the call, `ui/ed-app.js` orchestrates (draft path reuses the `_discardDraft` clean-up; saved path needs the save key and a base), and a new kit modal `ui/ed-delete-character.js` (type-the-name-to-confirm) is opened from a Delete button on every picker row. No schema, taxonomy or engine change.

## Guardrail alignment
- All changes **Tier 3** (worker, dev server, new modal and picker content, docs). No Tier-1 sign-off is needed or recorded; no Tier 2 ceremony.
- `ed-character/2` and `ed-characters-index/1` are untouched (an index row is removed, not reshaped). The engine is untouched and stays pure and DOM-free.
- Data-down/dispatch-up: the modal and picker dispatch `delete-character {id, deleteImage}` (composed, bubbling); `ed-app` performs the work and passes in-flight/error state down as properties. The modal never calls the network.
- Store only inputs: nothing derived is stored. Overlay/draft keys for the id are removed. The Overview and placeholder-pill rules are not touched.
- Tier-1 UI rules honored by the modal: Escape closes, Enter confirms only when the name matches, `light-dark()` tokens, font weights 400/500 only, kit (`ui/kit/`) plus `node tools/check-ui-kit.mjs`, relative `./` paths.
- No Tier-1 item was missed by the plan.

## Design
### Data / types
- No stored data or schema change.
- Request body `POST /delete-character`: `{ id: string, base: string|null (worker: non-empty string required), deleteImage?: string }`.
- Response `200 { ok:true, deleted: boolean, indexUpdated: boolean, imageDeleted?: boolean, imageSkipped?: 'shared'|'unverified'|'mismatch'|'none'|'unknown'|'error' }`.
- Errors: `400 invalid_id | invalid_base | invalid_image`, `401` (key), `409 stale_base` (with the current sha, via the existing `staleBase`), upstream errors via `GitHubError`/`upstreamResponse`.
- Client `deleteCharacterServer` returns `{deleted, indexUpdated, imageDeleted, imageSkipped}`.
- Modal state: `_deleteFor = {id, name, draft, hasPortrait}` in the picker.

### Modules & functions
1. `tools/worker/worker.js`
   - Add the route to the allow-list and the 404 text ("POST /save, /save-items, /save-image or /delete-character only") and the CORS comment. `Allow-Methods` stays `POST, OPTIONS`. Dispatch after shared auth/JSON parse, before the character-validation block.
   - New `updateIndex(repo, branch, gh, charsDir, mutate)`: shared read, mutate, PUT with the bounded 409 retry. `syncIndexEntry` is refactored onto it with unchanged behavior; its existing tests stay green unchanged.
   - New `handleDeleteCharacter(...)`:
     1. Validate `id` (`isValidId`), `base` (non-empty string), `deleteImage` if present (string, `isValidIndexPortrait(path, imagesDir)`, not null).
     2. `readCharacterFile` for the sha and content. If absent: skip the file delete, still remove the index row, return `{ok:true, deleted:false}` with `imageSkipped:'unknown'` if an image was requested.
     3. If `base !== sha` return `staleBase(cors, sha)` with zero writes (image untouched).
     4. I1b: if `deleteImage` requested, parse the target's `meta.portrait`. No portrait gives `imageSkipped:'none'`. `deleteImage !== meta.portrait` gives `'mismatch'` (this blocks catalog images). Otherwise compute sharing while the file still exists: the union of index rows' `portrait` and `meta.portrait` of every other character file listed in `charsDir` (skip `index.json` and the target). Any list/read/parse failure gives `'unverified'` (no delete). Shared gives `'shared'`.
     5. DELETE the character file `{message:'Delete character (serverless)', sha, branch}`. 409/422 returns `stale_base` with a freshly read sha.
     6. `updateIndex` removes the row (no-op if the file or row is absent). A failed write is logged and returns `indexUpdated:false`.
     7. Image delete only if the character file was deleted and the checks passed: GET the image sha, then DELETE (a 404 counts as `imageDeleted:true`). An image failure returns 200 with `imageDeleted:false, imageSkipped:'error'`.
2. `tools/dev-server.mjs`: route, `handleDeleteCharacter`, 404 text and header comment. Same contract, but `base` may be omitted or `null` (shape-checked only when supplied, mirroring `handleSave`); no stale detection. Sharing is checked by reading every other `data/characters/*.json`, with the same fail-safe. Use `enqueue` to serialize; no writes outside the root.
3. `store-server.js`: `export const DEFAULT_DELETE_ENDPOINT = DEFAULT_ENDPOINT.replace(/\/save$/, '/delete-character')`; `export async function deleteCharacterServer({id, base, deleteImage}, {endpoint, saveKey})`. Missing key gives `SaveError('no_key')`; fetch failure gives `offline`; `stale_base` gives `SaveConflictError`; other codes give `SaveError`. Add `invalid_base` and `invalid_image` to `messageForCode`, keeping the default text neutral.
4. `store.js`: export `onPages()` (currently a private function at ~L153) or add a small exported helper. Also export a base-returning reader for the confirm-time read (wrap the private `readCharacterFile(id)`, which returns `{character, base}`).
5. New `delete-action.js` (pure, like `save-action.js`): `nameMatches(typed, name)` (trim typed, case-sensitive, non-empty name) and `planDelete({draft, isOpen, baseSha, fileBase, onPages, portrait, deleteImage})` returning `{kind:'draft'}`, `{kind:'block', reason:'no_base'}` (base null on Pages), or `{kind:'server', body}`. Also a `noticeForResult(result)` mapping `imageSkipped` and `deleted:false` to text.
6. `ui/ed-app.js`: add a `delete-character` listener next to `discard-draft` (~L543) and `_deleteCharacter({id, deleteImage})`.
   - Extract the shared local reset from `_discardDraft` (~L699) into one helper used by both.
   - Draft path: `isDraft(id)` runs the existing clean-up, with no network.
   - Saved path: require the save key (existing `ed-save-key.js` prompt flow). Base is `_baseSha` for the open character, otherwise a confirm-time read, which also yields the authoritative `meta.portrait`. On Pages with a null base, block with a notice and do not delete. Call `deleteCharacterServer`.
   - Success: clear overlay (`editsKey(id)`), roll log, Discord config and staged portrait. Clear `_conflict` if it is for this id. Drop the id from `_indexRows`, call `_refreshRows()`. If it was the open character, reset to the loader state (`_noSelection`, clear `localStorage['ed-character']`). Show the `noticeForResult` toast via `_showNotice`.
   - `stale_base`: toast "changed on the branch, reload first"; local state is kept; the `ed-conflict` modal is not used. `unauthorized` re-prompts for the key. Other errors set the modal's inline error.
   - Passes `deleteBusy`, `deleteError` and `hasPendingEdits(id)` down to the picker.
7. `ui/ed-character-picker.js`: a trash Delete button on every row (`aria-label="Delete <name>"`, `title`); the draft keeps its Discard ✕. Renders `<ed-delete-character>`, stops child `close`/`confirm` propagation, and refocuses after the row disappears (as `_refocusAfterDiscard`).
8. New `ui/ed-delete-character.js`, modeled on `ed-new-character.js` (kit modal with a text input; `customElements.define('ed-delete-character', ...)`) and on `ed-confirm.js` visuals (`canConfirm: () => nameMatches(...) && !busy`).
   - Heading naming the character; a permanent-deletion warning.
   - Saved: "deletes the character from GitHub; recovery is only via git history". Draft: "removes the unsaved draft from this browser".
   - An unsaved-edits warning when `hasPendingEdits` or the character is a draft.
   - Name field (label, `autocomplete="off"`, initial focus).
   - Checkbox "Also delete the portrait image" (unchecked by default, shown only when `hasPortrait`) with a shared-image note.
   - Cancel and a danger-tone Delete (disabled until the name matches and while busy); an inline `role="alert"` error region.
   - Dispatches `delete-character {id, deleteImage}` (composed, bubbling).
9. Docs and changelog: `docs/UI-GUIDELINES.md`, `docs/MODALS.md` (only if a convention is added), `docs/GITHUB-SERVERLESS-SAVE.md`, `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md`, `ARCHITECTURE.md` §7.5, `data/changelog.json`.

### UI / behavior
- Picker rows: `[open][Delete]` for saved, `[open][Discard ✕][Delete]` for drafts. Check the 24rem width on a narrow screen (manual).
- Modal: opens on Delete, Escape closes (top modal only; the nested-modal rule), Enter confirms only when enabled. Focus goes to the name field first and returns to the row's Delete button (or `refocus()` if the row is gone).
- Deleting the open character empties the sheet to the loader state. Saved deletes need a worker redeploy (release-time owner step, noted in the runbook and changelog).
- Theme: `light-dark()` tokens (reuse `--danger`), weights 400/500 only.

### Rules
No Earthdawn game rules are used (`rules.md`). Table intentionally empty; the contract values above come from `plan.md`.

| Rule | Values | rules.md id/source |
|---|---|---|
| none | n/a | n/a |

### Edge cases & invariants
- A stale base writes nothing (character, index and image are all untouched); a bad id, base or image path is rejected before any GitHub call; a missing or wrong key gives 401, and an unset `SAVE_KEY` also gives 401.
- A missing file is idempotent: `ok:true, deleted:false`, and the index row is still removed.
- The image is deleted only when requested, equal to the target's file `meta.portrait`, unshared, and the character file was deleted. A catalog image path gives `mismatch`. Any unverifiable sharing check gives no delete. An image failure never fails the call.
- The image target is always read from the file, never from the overlay. A staged (unsaved) portrait is cleared and nothing is deleted on the branch for it.
- Index failure leaves a row without a file; the app tolerates this (the picker still lists it, and a later delete is idempotent).
- The name match is trimmed and case-sensitive; Enter with a mismatch does nothing.
- The draft path makes no network call. Other characters' overlays are untouched.
- Dev server: `base` omitted/`null` accepted; no writes outside the root.
- `hasPortrait` from the index may be stale: the checkbox is advisory and the worker's `imageSkipped:'none'` is surfaced neutrally.

## Testability notes
node:test, stubbed `fetch`/GitHub:
- `tools/worker/worker-delete.test.js` (modeled on `worker-portrait.test.js`): validation, 401, idempotent missing file, stale 409 with zero writes, DELETE 409 retry, index row removed (absent index no-op, failed write gives `indexUpdated:false`), and the image cases (`mismatch` incl. catalog path, `none`, `shared` via the index, `shared` via another file with a missing index row, `unverified`, image 404 as gone, image failure as `error`). The existing `worker.test.js` must stay green (the `syncIndexEntry` refactor).
- `tools/dev-server-delete.test.js` (modeled on `dev-server-portrait.test.js`): temp root, the same cases, `base` omitted/`null`.
- `store-server-delete.test.js`: the request body, `no_key`, `unauthorized`, `offline`, and `stale_base` giving `SaveConflictError`.
- `store-delete-character.test.js` plus a `delete-action` test: `nameMatches`, `planDelete` (the draft path with no network, the Pages `no_base` block, local null base sent), `noticeForResult`. Drafts and keys are cleared (use `store-drafts.test.js` patterns).
- `picker.test.js` extended only if it covers row rendering.

Owner manual verification (not unit-testable): focus return to the row, the narrow-width layout with three row buttons, nested-modal Escape, light and dark rendering, Enter gating, and the worker redeploy plus a live smoke delete.

## Changelog entry
`{"type": "added", "text": "Delete a character from the loader: type its name to confirm, and optionally delete its portrait image too (kept by default, and never removed while another character uses it)."}`

## Out of scope
In-app undo (recovery is via git history on `character-data`), bulk delete, deleting orphaned or other old images, schema or taxonomy changes, auto-switching to the next character (the loader is shown), and any engine change.
