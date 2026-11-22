---
status: implemented
shipped: unreleased
---
# Delivery Plan: Character portrait upload (add-char-portrait)

## Context & learnings
In edit mode the player clicks the portrait (desktop `.portrait` panel, mobile header avatar; image or placeholder) and a modal lets them upload a new image, pick any image already on the `character-data` branch, or remove the portrait. View mode keeps the lightbox. Owner decisions (qa-log): images are committed to the `character-data` branch by the Cloudflare worker (option A; `meta.portrait` stays a path, no schema change); the pick-list is the images present on the branch (no new field); bytes are staged in the local edits overlay and uploaded with the next Save; limits are JPEG/PNG/WebP, source <= 10 MB, longest side downscaled to 1024 px, JPEG ~0.85 (PNG kept if transparent), file `data/<charId>-<timestamp>.<ext>`, never overwritten; "Remove portrait" sets `meta.portrait = null` (file stays); the worker also rewrites that character's `portrait` in `data/characters/index.json` when `meta.portrait` changes (name stays create-only); mobile avatar is also a click target; Discard drops staged bytes; missing file falls back to the placeholder. Non-goals: deleting old images, a gallery field, embedding image data in JSON, a crop UI.

## Discoveries
- `store.js`: `portraitUrlFor(portrait)` (l.187) maps a path to `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` on Pages, `./<path>` locally; the view-model exposes `portraitUrl` (l.2041). `saveMetaEdits(patch, id)` (l.359) merges into `ed-character-edits:<id>`. `SAVED_CATEGORIES` (l.608), `hasPendingEdits`, `reconcileOverlay` (l.628), `forSave` (l.510). A staged-bytes overlay should be a SEPARATE localStorage key (e.g. `ed-character-image:<id>`), not a `SAVED_CATEGORIES` entry and not inside character JSON; `meta.portrait` in the `meta` overlay already makes the Save dot dirty.
- `ui/ed-app.js`: `_doSave` (l.2123) calls `saveServer(forSave(...), {endpoint, saveKey, id, base, keepalive})` (store-server.js l.74) in the normal path and `saveDraftFirstTime` (store-first-save.js) for drafts; success runs `reconcileOverlay`; `_discardLocal` (l.2266) and the conflict take-theirs path (l.2239) both call `reconcileOverlay(undefined, id)` then `_reloadSaved`. `_endpointFor('save', DEFAULT_ENDPOINT)` resolves endpoints (dev override `?save=`). `_editMeta(patch)` at l.750 handles the `ed-edit-meta` event (l.440); a new `ed-edit-portrait` event is added alongside.
- `ui/ed-overview.js`: `.portrait` (css l.69, markup l.974) and mobile `.avatar` (css l.73, markup l.948) both open the lightbox; `_portraitBroken`/`_portraitError` already give a placeholder fallback; `editMode` property and an existing edit-affordance pattern at l.242-251 (click + Enter/Space keyboard). Overlay-level `HIDE` set (l.663) already hides `portrait` from the details list.
- Modal kit: `ui/kit/{modal,modal-controller,modal-stack}.js`, `docs/MODALS.md`; `ui/ed-edit-meta.js` is the template (ModalController, `modalFrame`, `modalCss`, `isDirty`, stacked `ed-confirm`, dispatch-up). `tools/check-ui-kit.mjs` enforces kit usage.
- `tools/worker/worker.js`: only `POST /save` and `/save-items` (route guard l.66, CORS methods l.60); `/save` -> `upsertCharacterFile` -> `ensureIndexEntry` (l.209) which is create-only (l.234 returns if already indexed). Env pins `GITHUB_CHARS_DIR` (default `data/characters`), branch, repo. Tests in `tools/worker/worker.test.js`. `tools/dev-server.mjs` mirrors `/save` and the create-only index (l.259) and must mirror the new endpoint/rule so local runs behave the same (`tools/dev-server.test.js`).
- Existing portraits live at `data/<name>.jpg` on the branch; local copies are gitignored working copies (`scripts/sync-local-data.sh`, ARCHITECTURE l.698). `listCharacters` reads `data/characters/index.json`.
- Gotchas: localStorage quota (~5 MB) so staged bytes must stay small (1024 px JPEG is fine; a transparent 1024 px PNG may not be, so cap the stored size and surface an inline error). Image listing on Pages needs the GitHub contents API (`GET /repos/<o>/<r>/contents/data?ref=character-data`, unauthenticated, rate limited, CORS ok); the listing must be filtered to image extensions and exclude `data/characters/`. The staged image's path must also appear in the pick-list/current highlight before it is committed.
- Autosave/flush-on-hide silent saves call `_doSave` too, so the image upload must live inside `_doSave` (covers manual, silent, keep-mine re-save and draft first-save).

## Guardrail classification
All items Tier 3 (tickets T1-T5; no sign-off required). No schema shape change (`meta.portrait` is an existing path; `ed-characters-index/1` shape unchanged; only the update rule for an existing field changes), no taxonomy change, engine untouched and DOM-free (image processing lives in a UI/store-side module, never `engine/*`), data-down/dispatch-up kept (modal dispatches `ed-edit-portrait`; ed-app persists). Staged bytes are an input kept in the overlay, not derived and not in character JSON. Tier-1 re-checks for the build: Overview still fits the desktop viewport (no new visible chrome beyond a dashed outline), modal honors Escape/Enter and light+dark, placeholder pills untouched, all `fetch`/asset paths relative or absolute-external, UI-kit check passes. No Tier-1 item, so no blocking sign-off gap. Note: the doc change to GITHUB-SERVERLESS-SAVE.md's "create-only index" wording is a doc update to match new behavior, not a schema change.

## Rules dependencies
None. `rules.md` records that no Earthdawn rules are involved. No open NEEDS_RULES.

## Implementation items

### I1 - Worker: `POST /save-image` endpoint
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Add a route that commits an uploaded image to `character-data`.
- **Where:** `tools/worker/worker.js` (route guard l.66, CORS), `tools/worker/worker.test.js`.
- **Approach:** Body `{ id, filename, content: <base64> }` (or `{ path }` = `<charId>-<ts>.<ext>`), key-gated by the same `x-save-key` check. Validate: `id` via `isValidId`; filename regex `^<id>-\d{10,17}\.(jpg|png|webp)$` (id must equal the filename prefix); decode base64, enforce a size cap (e.g. 1.5 MB post-downscale, well under the 10 MB source limit); magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF....WEBP`) must match the extension. Path = `${env.GITHUB_IMAGES_DIR ?? 'data'}/<filename>`, pinned to env, never from the request. Create-only: GET contents first; if the file exists, compute the git blob sha of the uploaded content (`sha1("blob <len>\0" + bytes)`) and compare to the existing sha: identical returns `{ ok: true, path, sha, url }` (idempotent retry, no PUT); different returns 409 `exists` (no PUT). The client treats ONLY ok as success and `exists` as a hard failure (decision for F2). PUT with no `sha`. Return `{ ok: true, path, sha, url }` like other commits; error codes `invalid_image`, `too_large`, `invalid_name`, `exists`. Reuse `ensureBranch`, `upstreamResponse`, `ok()`.
- **Dependencies:** none.
- **Acceptance criteria:** valid JPEG/PNG/WebP upload commits one file and returns ok; re-upload of identical content to an existing path returns ok with no PUT; different content at an existing path returns `exists` with no PUT; bad magic bytes, mismatched extension, oversize, bad/other-character filename, and path traversal attempts are rejected with codes and no GitHub PUT; 401 without key; existing worker tests still pass.
- **Risks / unknowns:** Worker request body limit (100 MB, fine); base64 in JSON is ~33% overhead (acceptable at <= ~1.5 MB). Idempotency on retry after a half-failed Save (image landed, JSON failed) is handled by the server-side blob-sha comparison above; the client does not special-case `exists`.

### I2 - Worker: index portrait update on `/save`
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** When a saved character's `meta.portrait` differs from the indexed entry's `portrait`, rewrite only `characters[id].portrait` in `index.json`.
- **Where:** `tools/worker/worker.js` (`upsertCharacterFile` l.140-163, `ensureIndexEntry` l.209), `tools/worker/worker.test.js`, `tools/dev-server.mjs` (l.259 area) + `tools/dev-server.test.js`.
- **Approach:** Generalise `ensureIndexEntry` into `syncIndexEntry`: create case unchanged (name+portrait); existing entry case updates ONLY `portrait` (null when removed) if it differs, leaving `name` and shape alone, then PUT with the bounded 409 retry already there; no write when equal. Run it on every successful 2xx character PUT (not only creates), still best-effort (logged, tolerated). Validate the client-supplied value first: accept only `null` or a string matching `^data/[^/]+\.(jpg|jpeg|png|webp)$` (the data dir taken from env `GITHUB_IMAGES_DIR`, default `data`); anything else skips the index write entirely (character save still succeeds). Mirror in dev-server.
- **Dependencies:** none (independent of I1).
- **Acceptance criteria:** changed portrait updates only that id's `portrait`; unchanged portrait causes no index write; name untouched; other ids untouched; failed index write does not fail the save; tests cover create, update, no-op, removal to null, index 409 retry, and rejection of invalid `meta.portrait` strings (traversal, wrong extension, nested path, non-string) with no index write.
- **Risks / unknowns:** An extra GET of index.json per save adds latency and a GitHub API call per save (autosave-heavy); mitigate by checking only when the client signals a change, e.g. optional body field `portraitChanged`, or by always reading (simplest, one GET). Decide in build; prefer always-read for correctness since the worker cannot otherwise know the prior value. Also note a stale picker cache for index.json (raw CDN caching) is acceptable.
- **Also:** redeploy per `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` (owner action; flag in the build report).

### I3 - Client image processing module
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** A DOM-side module that validates and downscales a chosen file.
- **Where:** new `ui/portrait-image.js` (or `store-portrait.js`; keep out of `engine/*`) plus `*.test.js`.
- **Approach:** Pure helpers separated from the canvas call: `validateImageFile({type,size})` (JPEG/PNG/WebP by MIME, <= 10 MB, error messages), `fitWithin(w,h,1024)` (never upscale), `chooseOutput(hasAlpha)` (PNG if transparent else JPEG q0.85), `portraitFilename(charId, now, ext)` -> `<charId>-<timestamp>.<ext>`. A thin async `processImage(file)` uses `createImageBitmap` + `OffscreenCanvas`/canvas `toBlob`, alpha detection by sampling pixel data, and returns `{ blob/dataUrl, ext, width, height }`; enforce a stored-size cap after encoding with a clear error.
- **Dependencies:** none.
- **Acceptance criteria:** unit tests (node, canvas call injected/stubbed) for MIME/size limits, fit math, output choice, filename pattern; engine untouched.
- **Risks / unknowns:** WebP encode support varies; output only JPEG/PNG, so WebP input is re-encoded to JPEG (or PNG if alpha). Animated GIF not supported (not in list). EXIF orientation: `createImageBitmap` with `imageOrientation: 'from-image'`.

### I4 - Store: staged-image overlay, listing, URL resolution
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Overlay storage for staged bytes, branch image listing, and portrait URL resolution for a staged path.
- **Where:** `store.js` (near `saveMetaEdits`, `portraitUrlFor`, `reconcileOverlay`) or a new `store-portrait.js` imported by it; tests `store-portrait.test.js`; update `store-avatar.test.js`/`store-thumbnail.test.js` only if they break.
- **Approach:** Key `ed-character-image:<id>` holds `{ path, mime, dataUrl }` (one staged image per character; staging again replaces it, choosing an existing/removing drops it). API: `stagePortraitImage(id, {path, mime, dataUrl})`, `loadStagedPortrait(id)`, `clearStagedPortrait(id)`; wrap `localStorage.setItem` in try/catch and report a quota failure to the caller (modal shows the error, nothing half-staged). `portraitUrlFor(portrait, id)` (or a store-level wrapper used by `deriveModel`) returns the staged data URL when `portrait` equals the staged path, so the staged image displays before any commit; Discord thumbnail/avatar helpers must NOT use the data URL (they need a public URL) so keep them on the raw URL path and fall back to placeholder/null until committed. `listBranchImages()`: on Pages, contents API for the data dir filtered to `.jpg|.jpeg|.png|.webp` (`download_url`/path pairs; sorted newest first by name), locally call a dev-server `GET /list-images` route (DECIDED, F4; implemented in I9) that returns image filenames in `data/`; returns `[]` on any failure. `hasStagedPortrait(id)` feeds the Save dot (a staged image implies `meta.portrait` is set, already dirty, but include for safety). Include the staged entry in the picker list marked "unsaved". Discard: extend `reconcileOverlay`'s callers (see I5) rather than SAVED_CATEGORIES.
- **Dependencies:** I3 (shape of staged data).
- **Acceptance criteria:** unit tests for stage/clear/load incl. corrupt value and quota error, list-response parsing (filters non-images and subdirs, handles API failure -> `[]`), staged URL resolution vs committed URL, Discord helpers unaffected by staged paths; local listing via the dev-server `GET /list-images` route (parsed in a pure helper, tested with a stubbed fetch; the route itself is tested in I9).
- **Risks / unknowns:** localStorage quota (base64 data URL is ~1.33x the blob; confirm the cap against a worst-case transparent 1024 px PNG in build); contents API 60 req/hr unauthenticated (cache the listing per modal open / short TTL; failure degrades gracefully). Post-save CDN lag (F3): after a successful save the staged data URL is cleared and the view flips to the raw.githubusercontent URL, which may lag or negatively cache a fresh file, so `_portraitBroken` could briefly show the placeholder. Mitigation: keep an in-memory (session only, not persisted) copy of the just-saved data URL keyed by path and serve it from `portraitUrlFor` until the raw URL loads once; if that proves complex in build, accept and document the brief fallback.

### I5 - Save flow: upload staged image before the JSON; discard/conflict handling
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** `_doSave` uploads a staged image (if any, and if `meta.portrait` still equals its path) before posting the character; clears it on success; Discard and take-theirs drop it.
- **Where:** `store-server.js` (new `saveImage(...)` next to `saveServer`, same error classes, `SaveError` codes), `ui/ed-app.js` (`_doSave` l.2123, `_discardLocal` l.2266, conflict reload l.2239, draft first-save l.2142), `store-server.test.js`, `store-first-save.test.js` if affected.
- **Approach:** `saveImage(staged, {endpoint, saveKey, id})` POSTs to `_endpointFor('save-image', DEFAULT_IMAGE_ENDPOINT)` (derive default from `DEFAULT_ENDPOINT`). In `_doSave`, before the character POST (both draft and normal branches): if staged and `character.meta.portrait === staged.path`, upload; success only on an ok response (the worker makes identical-content retries ok; `exists` means different content and is a hard failure); on any failure throw (JSON NOT sent, overlay stays dirty, error toast; silent saves leave dirty). If a staged image is pending and `keepalive` is true, `_doSave` returns early: no image upload, no JSON POST, no index write, overlay left dirty (F1), so `meta.portrait` never points at an uncommitted file. After a confirmed JSON save, `clearStagedPortrait`. If `meta.portrait` no longer equals the staged path (user switched/removed), drop the stale staged image without uploading. `_discardLocal` and take-theirs call `clearStagedPortrait(id)`. Conflict (stale_base) keeps the staged image (still pending); a keep-mine re-save re-uses the same staged path (idempotent upload).
- **Dependencies:** I1, I4.
- **Acceptance criteria:** tests for ordering (image then JSON), JSON not sent when image upload fails, no upload when nothing staged or path mismatch, staged cleared only after JSON success, discard clears, retry after image-ok/JSON-fail succeeds (worker returns ok for identical content), `exists` (different content) aborts the save without a JSON POST, a `keepalive` save with a staged image makes no network calls and leaves the overlay dirty, a `keepalive` save with no staged image proceeds as before, unauthorized drops key like other saves.
- **Risks / unknowns:** Half-failure leaves an orphan image on the branch (accepted; no GC is a non-goal). `keepalive` flush saves have a ~64 KB body limit in browsers, which a staged image would exceed; the early return (not a JSON-only send) is the chosen, simpler design.

### I6 - Portrait modal (`ui/ed-edit-portrait.js`)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Kit modal with: file input (accept `image/jpeg,image/png,image/webp`), thumbnail grid of branch images (current highlighted; staged image shown as unsaved), "Remove portrait", OK/Cancel, inline errors.
- **Where:** new `ui/ed-edit-portrait.js`, imported by `ui/ed-app.js` (or the overview), modelled on `ui/ed-edit-meta.js`; tests only for any pure helpers (selection state) in a `ui/portrait-modal-state.js` + test.
- **Approach:** Properties down: `current` (path), `images` (listing), `staged`. Local state: selection (existing path | new processed image | removed), `_error`, `_busy`. Choosing a file runs I3 `processImage`, shows a preview, inline error on failure. OK dispatches `ed-edit-portrait` with `{ portrait: <path|null>, staged?: {path,mime,dataUrl} }`; modal itself persists nothing. Escape closes (dirty selection asks via stacked `ed-confirm` like ed-edit-meta), Enter confirms (kit routing; grid cells are buttons/radio group so Enter on a focused thumbnail selects). Listing load failure shows a short note and keeps upload and Remove working. Theme tokens only, no hardcoded colors; two font weights; keyboard operable thumbnails with `aria-pressed`/radio semantics.
- **Dependencies:** I3, I4.
- **Acceptance criteria:** uses `ui/kit/` (`node tools/check-ui-kit.mjs` passes); Escape/Enter behave per MODALS.md; light and dark; listing failure degrades gracefully; invalid file shows an inline error without closing.
- **Risks / unknowns:** Grid of many branch images includes every image (item images? any `data/*.jpg|png`); acceptable per "any image already on the branch", but lazy-load thumbnails (`loading="lazy"`).

### I7 - Overview click targets and ed-app wiring
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** In edit mode, `.portrait` (image or placeholder) and the mobile `.avatar` (image or a new placeholder avatar in edit mode) open the modal; view mode unchanged. `ed-app` handles `ed-edit-portrait`.
- **Where:** `ui/ed-overview.js` (css l.69-73, markup l.948 and l.974, keyboard pattern l.242-251), `ui/ed-app.js` (listener near l.440, handler near `_editMeta` l.750).
- **Approach:** Overview dispatches `ed-edit-portrait-open` up (or renders the modal itself via `_editPortrait` state as `_edit` does for meta - follow whichever pattern ed-overview uses for the meta modal at l.242-251). Edit mode adds a dashed outline, `role="button"`, `tabindex=0`, Enter/Space, and a title/aria-label ("Change portrait"); the lightbox opens only when not in edit mode. The mobile header gets a placeholder avatar element in edit mode when there is no image (currently hidden/absent) sized like `.avatar` so the header layout does not shift. ed-app handler: if `staged`, `stagePortraitImage`; else `clearStagedPortrait`; then `saveMetaEdits({ portrait }, id)`, update `_character`, re-derive the model, mark `_dirty`, mirroring `_editMeta`. Ensure `_portraitBroken` resets when the portrait changes (already reset on `model` change).
- **Dependencies:** I4, I6.
- **Acceptance criteria:** Overview still fits desktop viewport with no vertical scroll; placeholder case clickable and keyboard accessible; view-mode lightbox unchanged; mobile layout unchanged apart from the edit-mode affordance; no placeholder-pill/derived-value regression; new image shows immediately (staged data URL) and the Save dot lights.
- **Risks / unknowns:** Hit target of a dashed outline on a 52 px avatar; keep within UI-GUIDELINES.

### I8 - Docs
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** Update docs to match behavior.
- **Where:** `docs/UI-GUIDELINES.md` (section 6 portrait: edit-mode modal, limits; section 6a index text at l.113 about create-only rows), `ARCHITECTURE.md` (section 7.5 and l.542 index description, l.617 file map for new modules), `docs/GITHUB-SERVERLESS-SAVE.md` (new `/save-image`, env `GITHUB_IMAGES_DIR` if added, index rule at l.112/133/230/344/487/613: index is created on create and its `portrait` is refreshed on a portrait change; name stays create-only), `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` (worker redeploy note), `docs/MODALS.md` list if it enumerates modals, `README.md`/`data/changelog.json` per the release workflow.
- **Dependencies:** I1-I7 (document final behavior).
- **Acceptance criteria:** docs state the new behavior; grep for "create-only" shows no contradiction; no stale statement that "portrait changes never touch the index".
- **Risks / unknowns:** Many scattered "create-only" statements; search exhaustively.

### I9 - Dev-server parity (support item)
- **Covers tickets:** T1, T2 (local-run support)
- **Rules:** none
- **Tier:** 3
- **What:** Mirror `/save-image` and the index portrait rule in `tools/dev-server.mjs`, and provide whatever the local image listing needs.
- **Where:** `tools/dev-server.mjs`, `tools/dev-server.test.js`.
- **Approach:** Same validation helpers as the worker (share if the repo already shares code between them; otherwise duplicate minimally, as for `/save`), write to `data/`, log the route in the startup banner. Local listing: add `GET /list-images` returning image filenames in `data/` (jpg/jpeg/png/webp only, no subdirs), used by `listBranchImages` locally (decided, F4). Mirror the identical-sha/`exists` rule and the index portrait validation regex.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** local upload round-trips and the new portrait shows after reload; dev-server tests cover `/save-image` (ok, identical retry, exists, invalid), `GET /list-images` (filters non-images and subdirs), and the index portrait rule incl. invalid-string rejection.
- **Risks / unknowns:** Local `data/` images are gitignored working copies; none of this commits.

## Sequencing
1. I1, I2 (worker; independent, testable alone), then I9 (parity).
2. I3 (pure/DOM image module) in parallel with the worker work.
3. I4 (store overlay/list/URL) after I3.
4. I5 (save flow) after I1 and I4; riskiest integration, so test before the UI.
5. I6 (modal) after I3, I4.
6. I7 (Overview wiring) after I6 and I5.
7. I8 (docs) last. Worker redeploy (owner action, runbook) is required before a Pages run can upload; call it out in the final report.
Rationale: bottom-up so each layer is unit-testable before the UI consumes it; the save-ordering contract is settled before the modal can create data that depends on it.

## Open questions
- Exact byte cap for `/save-image` and staged storage (proposed 1.5 MB encoded; confirm in build against a worst-case transparent PNG at 1024 px and the localStorage quota, since the data URL is ~1.33x).
- Owner manual verification needed for UI work (I6, I7), to be listed in the build report: desktop no-scroll fit, light and dark themes, mobile avatar, Escape/Enter behavior.
- Whether to always read `index.json` on every `/save` or only when the client flags a portrait change (proposed: always read, one GET).
- Non-blocking; no `NEEDS_HUMAN`/`NEEDS_RULES` required.

## Review responses
- **F1 (major, keepalive skips whole save):** fixed. I5 now returns early from `_doSave` on `keepalive` with a staged image (no upload, no JSON, no index write, stays dirty), with tests.
- **F2 (`exists` too loose):** fixed. Worker compares blob sha: identical = ok, different = `exists` (409); the client treats only ok as success. I1, I5, I9 updated with tests for both cases.
- **F3 (post-save URL flip flash):** fixed as a documented risk in I4 with an optional session-only in-memory data-URL fallback; brief placeholder accepted if that is too complex.
- **F4 (local listing undecided):** fixed. Decided on dev-server `GET /list-images`; recorded in I4 and I9 with a dev-server test.
- **F5 (index trusts client portrait):** fixed. `syncIndexEntry` accepts only null or `^data/[^/]+\.(jpg|jpeg|png|webp)$`, else skips the index write; tests in I2 (worker) and I9 (dev-server).
- **Notes:** byte cap and quota check kept under Open questions/I4 risks; owner manual UI verification added to Open questions for the build report.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
