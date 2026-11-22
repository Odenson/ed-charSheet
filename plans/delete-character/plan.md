---
status: implemented
shipped: unreleased
---
# Delivery Plan: Delete character (delete-character)

## Context & learnings
The owner wants to delete a character from the loader (picker): a saved one on the `character-data` branch or an unsaved local draft. Decisions recorded in `qa-log.md`:
- A delete icon sits on every picker row, beside the existing draft Discard. Saved and draft rows share one unified Delete.
- Accident guard: a kit modal that warns the deletion is permanent and requires typing the character's name. Delete stays disabled until the name matches. It also warns that unsaved local edits are lost.
- An "Also delete the portrait image" checkbox is **unchecked by default** and shown only when the character has a portrait. It removes only `meta.portrait`, and only if no other character references it; otherwise it is skipped with a note.
- A new worker route `POST /delete-character` sits behind the same `x-save-key` gate. It sends `base`. A stale base gives `409 stale_base` and writes nothing, and the user must reload first. The dev server mirrors it.
- No in-app undo. Recovery is via git history on `character-data`.
- After a delete, the overlay/draft for that id is cleared and the app returns to the loader (or the next character) if that character was open.
- Non-goals: bulk delete, deleting orphaned images, schema or taxonomy changes.

## Discoveries
- Worker `tools/worker/worker.js`: a single `fetch` handler. The route allow-list and 404 text are at ~L67-68, CORS `Allow-Methods` is `POST, OPTIONS`, and SAVE_KEY auth is constant-time (fail closed). After auth and JSON parse, the routes are `/save-image`, `/save-items`, then the save path. Reusable helpers: `ID_RE`/`isValidId`, `readCharacterFile` (returns `{sha, exists}`), `staleBase`, `GitHubError`/`upstreamResponse`, `isValidIndexPortrait(portrait, imagesDir)`, `toBase64`/`base64ToString`, and the index read, merge and PUT with bounded 409 retry inside `syncIndexEntry`. There is no DELETE helper yet. GitHub's contents API DELETE needs `{message, sha, branch}`. Env: `GITHUB_CHARS_DIR` (default `data/characters`) and `GITHUB_IMAGES_DIR` (default `data`). Tests: `tools/worker/worker.test.js` and `worker-portrait.test.js`.
- Dev server `tools/dev-server.mjs`: routing at ~L244-247 (404 text duplicated), with `handleSave`, `handleSaveImage`, `writePretty`, `readJsonFile`, and a serialized `enqueue` write chain. Tests: `tools/dev-server.test.js` and `dev-server-portrait.test.js`.
- Client I/O `store-server.js`: `saveServer` and `saveImage` show the pattern. They check for a missing key, map fetch failure to `offline`, and map `stale_base` to `SaveConflictError`. `messageForCode` holds the code-to-text map. `DEFAULT_IMAGE_ENDPOINT` is derived from `DEFAULT_ENDPOINT`.
- `store.js` `readCharacterFile(id)` (not exported; `loadCharacter(id)` is) reads the file through the contents API and extracts the base from the ETag. `listCharacters()` returns index rows `{id, name, portrait}`.
- `ui/ed-app.js`:
  - `_discardDraft(id)` (~L699) is the model for local clean-up: `discardDraft`, `clearRollLog`, `clearDiscordConfig`, `clearStagedPortrait`, `_refreshRows`, then reset the open character state and clear `localStorage['ed-character']`.
  - It holds `_baseSha`, `_indexRows`, `_characters`, `_isDraft`, `_conflict`, and the `discard-draft` listener (~L543).
  - The save key lives in `ui/ed-save-key.js` and the in-memory key.
  - The overlay is per id via `editsKey(id)` in `store.js`. `store-drafts.js` has `discardDraft`, `isDraft`, `listDrafts`, `mergeRows`.
- `ui/ed-character-picker.js`: presentational. A row is a wrapper with sibling buttons, and a draft has the `.rdiscard` ✕ button that opens an inline `<ed-confirm>`. Child modal `close`/`confirm` events must be `stopPropagation()`'d here. It refocuses after a row disappears (`_refocusAfterDiscard`).
- Kit: `ui/kit/modal.js`, `modal-controller.js` (Escape/Enter routing, focus, stack), `docs/MODALS.md`, and `tools/check-ui-kit.mjs` (baseline in `tools/ui-kit-baseline.json`). `ui/ed-confirm.js` is a presentational confirm with `disabled` and `warn` props, but has no input field. `ui/ed-new-character.js` is the existing kit modal with a text input and is the pattern to copy.
- Docs to update: `docs/GITHUB-SERVERLESS-SAVE.md` (route sections ~L140, 404 row ~L175, contract tables ~L620, tests ~L532, blast radius ~L570), `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` (route list ~L348 and the redeploy note ~L379), ARCHITECTURE §7.5, `docs/UI-GUIDELINES.md` (picker), `data/changelog.json`.
- Gotcha: a saved row that is not the open character has no stored base. Only the open character has `_baseSha`, and a CDN-fallback read yields `base = null`.
- Gotcha: the index is best-effort ("the file is truth, the index is never trusted for save bases"), so an image-sharing check built only from index portraits can miss a character whose index row is missing or stale.

## Guardrail classification
Per the tickets, all items are **Tier 3**. No Tier-1 sign-off is needed, and none is recorded or required.
- No schema shape change. Removing an `index.json` row leaves `ed-characters-index/1` as is, and `ed-character/2` is untouched.
- No taxonomy change, so no Tier 2 ceremony.
- Engine untouched: it stays pure and DOM-free.
- Data-down/dispatch-up: the modal and picker dispatch `delete-character` up, and ed-app performs it.
- Tier-1 rules to honor in I4: Escape closes, Enter confirms (only when the name matches), light and dark via `light-dark()`, two font weights (400/500), the kit and the UI-kit check, relative `./` paths.
- Re-confirm in I4 that the Overview and placeholder-pill rules are unaffected (they are untouched).

## Rules dependencies
None. `rules.md` states that no Earthdawn game rules are used. No NEEDS_RULES.

## Implementation items
### I1a — Worker: `POST /delete-character` (file + index delete, validation, stale handling)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Add the route. Body: `{ id, base, deleteImage? }`. I1a delivers steps 1-5 and 7 below (no image handling beyond validating the field); I1b adds step 6.
- **Where:** `tools/worker/worker.js`. Update the route allow-list, the 404 message ("POST /save, /save-items, /save-image or /delete-character only"), and the CORS comment. `Allow-Methods` stays `POST, OPTIONS`. New tests go in `tools/worker/worker-delete.test.js`, modeled on `worker-portrait.test.js`.
- **Approach:**
  1. Auth and JSON parse are shared and unchanged, so it is fail-closed. Dispatch before the character validation block.
  2. Validate `id` with `isValidId`, otherwise 400 `invalid_id`. Require `base` to be a non-empty string, otherwise 400 `invalid_base` (a delete always sends a base). If `deleteImage` is present, it must be a string passing `isValidIndexPortrait(path, imagesDir)` and must not be `null`, otherwise 400 `invalid_image`. The path is never taken from the request beyond that check, so it is pinned to `imagesDir`.
  3. Read the file sha with `readCharacterFile`.
     - If the file does not exist, treat it as idempotent: skip the file delete, still remove any index row, and return `{ok:true, deleted:false}`. Decision: a missing file is not an error, so a retry after a partial failure succeeds. Do not delete the image when the file was already absent. The reference check is cheap but the portrait owner is unknown, so skip with `imageSkipped:'unknown'`.
     - If `base !== sha`, return `staleBase(cors, sha)`. Nothing is written, and the image is not touched.
  4. Before deleting, if `deleteImage` was requested, compute sharing (below) while the file still exists, then DELETE the character file (`{message:'Delete character (serverless)', sha, branch}`). A DELETE 409 or 422 (sha moved in the window) returns `stale_base` with a freshly read sha. Other failures go through `GitHubError`/`upstreamResponse`.
  5. Remove the id from `index.json` with the same bounded read, modify, PUT 409-retry loop as `syncIndexEntry`. Factor out a small shared `updateIndex(repo, branch, gh, charsDir, mutate)` helper rather than copy-pasting. Do not change `syncIndexEntry`'s behavior (or its tests). An absent index file or row is a no-op. A failed index write is logged and reported as `indexUpdated:false`, since the file is already gone and the index is only a discovery aid. The app tolerates a row without a file (see I3).
  6. (Built as I1b.) Image delete, only when requested, and only if the character file was deleted. **Target pinning (review F2):** `isValidIndexPortrait` admits any `imagesDir/<name>.(jpg|jpeg|png|webp)`, including catalog images, so shape validation is not enough. The worker reads the target file's content (the same read that yields the sha; parse `meta.portrait`) before the delete and requires `deleteImage === target.meta.portrait`; otherwise it skips with `imageSkipped:'mismatch'` (the character is still deleted; the image is untouched). If the file has no `meta.portrait`, `deleteImage` is a no-op with `imageSkipped:'none'` (review F3). **Sharing decision (resolves the T1 open question):** the image is shared if any *other* character references it, checked by the union of (a) index rows' `portrait` and (b) `meta.portrait` read from each other character file in `charsDir` (list the dir via the contents API, skip `index.json` and the target id). The file is the truth and the index is best-effort, so the index alone is not enough. Fail safe: if any read or list fails, or any other file is unparseable, skip with `imageSkipped:'unverified'` and do **not** delete. If shared, `imageSkipped:'shared'`. Otherwise GET the image sha and DELETE it (a 404 means already gone and counts as `imageDeleted:true`), and report `imageDeleted:true`. An image failure after the character delete never fails the whole call. It returns 200 `ok:true` with `imageDeleted:false, imageSkipped:'error'` so the user is not told the character failed to delete.
  7. Response: `200 { ok:true, deleted, indexUpdated, imageDeleted?, imageSkipped? }`.
- **Dependencies:** none (first). Split: **I1a** = steps 1-5, 7 plus the `updateIndex` refactor (kept behind `syncIndexEntry`'s existing tests, which must stay green unchanged); **I1b** = step 6 (target pinning, sharing scan, image delete), depends on I1a.
- **Acceptance criteria:**
  - I1a: a valid delete removes the file and the index row. A missing file is idempotent, with no error. A stale base gives 409 `stale_base` with the current sha and makes zero writes. Bad id, bad `base`, and bad image paths (a traversal, a wrong dir, or a non-image extension) are rejected. A missing or wrong key gives 401 and an unset `SAVE_KEY` also gives 401. Existing `/save*` tests are unaffected.
  - I1b: the image is deleted only when requested, equal to the target's `meta.portrait`, and unshared. A `deleteImage` that differs from `meta.portrait` (including a valid catalog image path) is never deleted (`imageSkipped:'mismatch'`, test it). A file without `meta.portrait` gives `imageSkipped:'none'` (test it). A shared image is never deleted. An unverifiable sharing check never deletes.
  - `npm test` is green.
- **Risks / unknowns:**
  - Reading every character file costs N+1 GitHub calls, which is acceptable for a small roster (a handful of characters).
  - Worker redeploy is required, and the runbook notes it.
  - The DELETE contents API needs the exact file sha and branch.

### I2 — Dev server mirror
- **Covers tickets:** T2 (server half)
- **Rules:** none
- **Tier:** 3
- **What:** `POST /delete-character` in the local dev server with the same contract (validation, stale detection, idempotency, image sharing, responses).
- **Where:** `tools/dev-server.mjs` (route, `handleDeleteCharacter`, 404 text, header comment). Add tests to a new `tools/dev-server-delete.test.js`, following `dev-server-portrait.test.js`.
- **Approach (review F1):** the dev server contract is: `base` may be omitted or `null` (local reads carry no ETag, so the client never has one; see the `tools/dev-server.mjs` header and the legacy overwrite path), and is validated only for shape as `/save` does when supplied. No blob-sha computation. If a non-null `base` is supplied, it is only shape-checked (non-empty string), not compared. Read `handleSave` first and mirror its `base` handling exactly. The worker, by contrast, requires a real `base`. Use `enqueue` to serialize. Sharing is checked by reading every other `data/characters/*.json` (no index-only shortcut locally). The fail-safe rule matches the worker.
- **Dependencies:** I1a/I1b (contract).
- **Acceptance criteria:** the same behaviors as I1a/I1b against a temp root, with no writes outside it, except that `base` omitted/`null` is accepted (tested) and stale detection does not apply. Include the `mismatch`/`none` image cases.
- **Risks / unknowns:** none beyond mirroring `handleSave`'s `base` handling; confirm it by reading the code before writing tests. See Open questions.

### I3 — Client: `store-server.js` `deleteCharacterServer` + ed-app delete flow
Split for review (F4): **I3a** = pure `delete-action.js` + `store-server.js` `deleteCharacterServer` + their tests; **I3b** = the `ed-app.js` wiring (listener, `_deleteCharacter`, shared reset helper, notices). I3b depends on I3a.
- **Covers tickets:** T2 (client half)
- **Rules:** none
- **Tier:** 3
- **What:**
  1. `store-server.js`: `deleteCharacterServer({id, base, deleteImage}, {endpoint, saveKey})`. The default endpoint is derived like `DEFAULT_IMAGE_ENDPOINT`. It returns `{deleted, indexUpdated, imageDeleted, imageSkipped}`. It throws `SaveConflictError` on `stale_base` and `SaveError` otherwise (`no_key`, `unauthorized`, `offline`, a worker code). Add messages to `messageForCode` (`invalid_base`, `invalid_image`) and make the default message neutral enough for deletion, or use a delete-specific wrapper.
  2. `ui/ed-app.js`: a `delete-character` listener (`{ id, deleteImage }`) and `_deleteCharacter`.
     - **Draft** (`isDraft(id)`): reuse the `_discardDraft` clean-up (the draft has no branch file, no image upload and no base). Extract the shared reset to one helper and do not duplicate it.
     - **Saved:**
       - Require the save key. Reuse the existing prompt flow in `ed-save-key.js` as the save path does.
       - Take the base: for the open character use `this._baseSha`. For a non-open saved row, read the file via the existing store read (`loadCharacter` path or an exported base-returning reader) at confirm time to get a base and the authoritative `meta.portrait`. Decision: the base for a non-open character is fetched when the user confirms, so the stale check protects against changes racing between that read and the DELETE. The "reload first" stale guard applies fully to the open character and to any device that has loaded it. If the read yields `base:null` **and the app is on Pages** (the existing `onPages()` check in `store.js`, which should be exported or mirrored by a small helper; a null base there means the CDN fallback and the worker would reject it), block with a clear message and do not delete. Off Pages (local dev server), `base:null` is expected and is sent as `null`/omitted; the delete proceeds. Test both cases.
       - Call `deleteCharacterServer`.
       - On success, clear the overlay for the id (`editsKey`), the roll log, the Discord config and the staged portrait (as `_discardDraft` does), clear `_conflict` if it is for this id, drop the id from `_indexRows`, `_refreshRows()`, and if it was open, reset to the loader state (the same reset as `_discardDraft`, reusing the existing `_noSelection` path, then open the picker; "next character" means the picker with the remaining rows, which is the current no-selection behavior, so no auto-switch is added).
       - On `stale_base`, show a notice that the character changed on the branch and must be reloaded first. Do not clear local state. Do not open the existing keep-mine/take-theirs `ed-conflict` modal, because those options do not apply. Surface a toast through `_showNotice`.
       - `unauthorized` re-prompts for the key. Other errors show a notice and keep the modal's inline error (see I4).
       - Surface the `imageSkipped` outcomes as a notice ("Character deleted. Portrait image kept (still used by another character)." / "...could not be verified" / "...could not be removed").
  3. Failure reporting to the modal: ed-app owns the async result and passes the in-flight and error state down via properties on the picker. The modal stays presentational.
- **Where:** `store-server.js`, `ui/ed-app.js`, plus a new test file `store-server-delete.test.js` and `store-delete-character.test.js`, following `store-server.test.js` and `store-drafts.test.js`.
- **Approach:** keep the I/O in `store-server.js`, and keep ed-app as the orchestrator. The engine is untouched, and the paths are relative.
- **Dependencies:** I1 (contract), I2 for local dev.
- **Acceptance criteria:** unit tests (with stubbed `fetch`) cover: the draft path (the draft and its keys are gone, no network); the saved path (the request body carries `base` and `deleteImage`, the overlay and local keys are cleared, the index row is dropped); `stale_base` (nothing local cleared, a clear message); `no_key`/`unauthorized`/`offline`; shared-image skip; the open-character fallback to the loader. `ed-app` logic that can be unit-tested is kept in a small pure helper (for example `delete-action.js`, following `save-action.js`) so it is testable without the DOM. The engine stays DOM-free. `npm test` is green.
- **Risks / unknowns:**
  - `ed-app.js` is large, so keep the diff local to the listener and the helper.
  - A saved character may have a staged (unsaved) portrait upload. This is cleared on delete. The branch image behind it was never uploaded, so nothing is deleted for it. Delete only the committed `meta.portrait`.
  - `meta.portrait` should come from the freshly read file, not the overlay, so the "also delete" target is the committed portrait and not an unsaved edit.

### I4 — Delete modal + picker affordance
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3 (honor the Tier-1 modal/theme/font rules)
- **What:** A Delete icon on every picker row, and a kit modal `ed-delete-character`.
- **Where:** new `ui/ed-delete-character.js` (modeled on `ed-new-character.js` for the input and on `ed-confirm.js` for the visual language); edit `ui/ed-character-picker.js` and wire the property passing in `ui/ed-app.js` (listener from I3); update `tools/ui-kit-baseline.json` only if the check requires it (it should not, since this is a kit modal).
- **Approach:**
  - Picker: keep the sibling-buttons row layout. Add a Delete button (a trash icon with `aria-label="Delete <name>"` and a `title`) on **every** row. Keep the draft's Discard ✕ per the goals ("beside the existing draft Discard") but route both to the same flow. Open question: whether Discard is kept for drafts or replaced. The decision is to keep it (the goal says "beside"), so a draft row has Discard and Delete, with the same local effect, so there is no regression. Opening the modal sets `_deleteFor = {id, name, draft, hasPortrait}`. The picker stops the child `close`/`confirm` events and refocuses after the row disappears, as it does for discard.
  - `hasPortrait` comes from the row's `portrait` (index row). It is `false` for drafts, so the checkbox is hidden for them. The index is best-effort (F3): it may be stale, so the checkbox can be shown or hidden wrongly. This is accepted and documented; the authoritative `meta.portrait` is the freshly read file at confirm time (I3), and if it has none, the worker returns `imageSkipped:'none'` and ed-app shows a neutral notice.
  - Modal content:
    - A heading naming the character.
    - A permanent-deletion warning.
    - Saved: "This deletes the character from GitHub; recovery is only via git history." Draft: "This removes the unsaved draft from this browser."
    - An unsaved-local-edits warning, shown when `hasPendingEdits(id)` or the character is a draft. ed-app passes a boolean down. The picker does not compute it.
    - A name-entry field (label, `autocomplete=off`, compared after trimming and case-sensitively against the character's name).
    - The checkbox "Also delete the portrait image", unchecked by default, with a note about the shared-image skip.
    - Cancel and Delete (danger tone). Delete is `disabled` until the typed name matches, and while an async delete is in flight.
    - An inline error region (`role="alert"`) for failures, and an "image kept (shared)" notice for the result.
  - Keys: Escape closes through the kit. Enter confirms only when the name matches (the kit's Enter routing must be gated: when disabled, Enter does nothing, so there is no accidental delete). Initial focus goes to the name field. Focus returns to the row's Delete button, or is re-run via `refocus()` if the row is gone.
  - Dispatches `delete-character {id, deleteImage}` up (composed, bubbling). It does not call the network.
  - The fonts are only 400/500, and the colors use `light-dark()` tokens (reuse `--danger` and friends).
- **Manual verification (owner):** focus return to the row, narrow-width layout with three row buttons, nested-modal Escape, and light/dark rendering cannot be covered by `node:test`; the owner verifies them by hand before release. Automated coverage is limited to `nameMatches` and picker row rendering helpers.
- **Dependencies:** I3 (event contract). Can be built in parallel with I3 against the agreed event shape.
- **Acceptance criteria:** Delete is disabled until the typed name matches. Escape closes. Enter confirms only when enabled. The checkbox is hidden without a portrait and unchecked by default. The warnings render. The modal is keyboard reachable with a visible focus order. It works in both light and dark. Only two font weights are used. `node tools/check-ui-kit.mjs` (the UI-kit check) passes. The modal is covered by a lightweight test for the pure name-match helper (extract `nameMatches(typed, name)` so it is unit-tested, in the style of `picker.test.js`), and `picker.test.js` is extended if it covers row rendering.
- **Risks / unknowns:**
  - Enter-routing of the kit for a disabled primary. Read `docs/MODALS.md` and `modal-controller.js` for how `ed-confirm`'s `disabled` handles it, and copy that.
  - The picker is 24rem wide, so row layout with a third button needs a check on a narrow screen.
  - The picker stack and focus handling are already delicate, so test nested-modal Escape (only the top modal closes).

### I5 — Docs, changelog, final test pass
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** Make the docs match the code.
- **Where:**
  - `docs/UI-GUIDELINES.md` (picker: the Delete affordance and the modal).
  - `docs/MODALS.md` (a short mention of the type-to-confirm pattern, only if it adds a kit convention).
  - `docs/GITHUB-SERVERLESS-SAVE.md` (the route section, the 404 row, the contract table, the tests section, and the blast radius: a key-holder can now delete character files, index rows and unshared images on `character-data`; recoverable via git).
  - `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` (the route list, the redeploy note, a smoke step).
  - `ARCHITECTURE.md` §7.5.
  - `data/changelog.json` (an unreleased entry, in the existing format).
  - Also update the dev-server header comment and the `CLAUDE.md`-listed docs only if they enumerate routes.
- **Approach:** read each section first and edit in place. Run `npm test` and the UI-kit check at the end. Do not bump any schema or taxonomy version.
- **Dependencies:** I1 to I4.
- **Acceptance criteria:** `npm test` is green. The docs match the code (routes, error codes, response fields, the redeploy requirement). The changelog entry exists.
- **Risks / unknowns:** the changelog shape (check `tools/release.mjs` and `release.test.js` for the unreleased format, and `tools/plans-status.test.js` for plan-status rules).

## Sequencing
1. **I1a** then **I1b** (worker): the contract is the foundation, and it is testable alone. I1a first so the file/index delete lands before the image logic.
2. **I2** (dev server mirror): so local development and the client tests have a target.
3. **I3a** then **I3b** (client I/O and ed-app flow): depends on the contract, and it defines the event shape.
4. **I4** (modal and picker): needs the I3 event contract. It can overlap with I3 once the event shape is agreed.
5. **I5** (docs and changelog): last, so docs describe the final behavior.

The worker must be redeployed (runbook, `npx wrangler deploy`) before a saved delete works on Pages. This is a release-time owner step and is noted in the runbook and the changelog. It is not a build step.

## Open questions
- **Not blocking (decided here, reviewable):**
  - Idempotent delete of a missing file, returning `ok` with `deleted:false`.
  - The image-sharing check reads every other character file in addition to the index, and fails safe by never deleting when unverifiable.
  - The base for a non-open saved row is fetched at confirm time (the open character uses `_baseSha`). A `null` base (CDN fallback) blocks the delete on Pages.
  - The dev server accepts an omitted or `null` base (no blob-sha computation, no stale check), since local reads never produce one. The worker requires a base. The client blocks a `null` base only on Pages.
  - The draft's Discard ✕ is kept beside the new Delete.
  - "Return to the next character" is implemented as the existing no-selection state plus the picker, with no auto-switch.
- Tickets T2 and the Q&A say "last-known base". For a character that is not open, this device has no earlier base, so the confirm-time read is the closest available. The owner may prefer to restrict Delete to characters already loaded in this session, which would be stricter but would defeat "delete from the loader". Raising this as a non-blocking note.

## Review responses
- **F1 (major) — fixed.** I2 now accepts omitted/`null` base and drops the blob-sha computation. I3 blocks a `null` base only when `onPages()`; local dev proceeds. Both cases are tested. Environment detection reuses `store.js`'s `onPages()`.
- **F2 (major) — fixed.** I1b requires `deleteImage === target.meta.portrait` (read from the file before delete), else `imageSkipped:'mismatch'`. Confirmed `isValidIndexPortrait` admits any `imagesDir/<name>.<img ext>` (worker.js ~L263), so it would allow catalog images; the pinning is therefore required. Tests added in I1b and I2.
- **F3 (minor) — fixed.** Discrepancy documented in I4; no `meta.portrait` gives `imageSkipped:'none'`, with a test in I1b.
- **F4 (minor) — fixed.** I1 split into I1a/I1b; I3 split into I3a/I3b; `syncIndexEntry` refactor stays behind its existing tests; I4 states that UI behaviors are verified manually by the owner. Item count is now I1a, I1b, I2, I3a, I3b, I4, I5 (7).

## Q&A log reference
See `qa-log.md` for the full interrogation record.
