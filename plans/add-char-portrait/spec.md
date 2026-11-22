# Tech Spec: Character portrait upload (add-char-portrait)

## Overview
In edit mode the Overview portrait (desktop `.portrait`, mobile `.avatar`) opens a kit modal (`ui/ed-edit-portrait.js`) to upload, pick a branch image, or remove the portrait. An upload is downscaled client-side (`ui/portrait-image.js`), staged in a separate localStorage key (`ed-character-image:<id>`, helpers in new root `store-portrait.js`), and `meta.portrait` (an existing path field) is set through `saveMetaEdits`. `_doSave` uploads the staged bytes via a new worker route `POST /save-image` BEFORE posting the character JSON. `/save` additionally syncs `characters[id].portrait` in `index.json`. `tools/dev-server.mjs` mirrors both and adds `GET /list-images`.

## Guardrail alignment
- All Tier 3 (plan tickets T1-T5, no sign-off needed). No schema shape change (`meta.portrait` exists; `ed-characters-index/1` shape unchanged), no taxonomy change, `engine/*` untouched.
- Data down / dispatch up: modal gets `current`, `images`, `staged` as properties and dispatches `ed-edit-portrait`; only `ed-app` persists. UI computes no game values.
- Store only inputs: staged bytes are an input in the overlay, never in character JSON; no derived value stored. Placeholder pills untouched.
- Modal must use `ui/kit/` (`node tools/check-ui-kit.mjs`), Escape/Enter per docs/MODALS.md, light + dark tokens only. Overview must still fit the desktop viewport (only a dashed outline added). All fetch paths relative or absolute-external.
- No Tier-1 item found.

## Build-time decisions (settled here)
1. **Byte cap.** Two caps. Worker hard ceiling: decoded image <= **1,500,000 bytes** (`too_large`). Client stored-size cap: encoded blob <= **1,000,000 bytes** (so the data URL is ~1.33 M chars, about a quarter of the ~5 M-char localStorage budget, leaving room for the other overlays, which share the origin quota). Because a transparent 1024 px PNG can exceed 1 MB, `processImage` retries at progressively smaller longest sides (1024, 768, 512) until the blob fits; if the 512 px result still exceeds the cap it returns a clear error ("Image is too detailed to store; try a simpler image"). JPEG q0.85 at 1024 px is normally far below the cap. Constants live in one place (`ui/portrait-image.js`: `MAX_STORED_BYTES = 1_000_000`, `MAX_SOURCE_BYTES = 10 * 1024 * 1024`, `MAX_SIDE = 1024`, `JPEG_QUALITY = 0.85`); the worker has its own `MAX_IMAGE_BYTES = 1_500_000`.
2. **Index read on `/save`.** The worker ALWAYS reads `index.json` after every successful 2xx character PUT (one GET; PUT only when the validated portrait differs). No `portraitChanged` flag. Best-effort, logged and tolerated on failure.

## Design
### Data / types
- `meta.portrait`: existing `string | null` path (`data/<charId>-<ts>.<ext>` for new uploads). No schema change.
- New localStorage key `ed-character-image:<id>` = JSON `{ path, mime, dataUrl }`. One staged image per character. NOT in `SAVED_CATEGORIES`, not in character JSON, not derived.
- `/save-image` request: `{ id, filename, content }` (`content` = base64, no data-URL prefix). Response: `{ ok: true, path, sha, url }`; error `{ ok:false, error:{ code, message } }` with codes `invalid_image`, `too_large`, `invalid_name`, `exists`, `unauthorized`, plus existing upstream codes.
- Worker env: optional `GITHUB_IMAGES_DIR` (default `data`).

### Modules & functions
**`tools/worker/worker.js`**
- Route guard (l.66) and CORS: allow `POST /save-image`; update the 404 message. Same `x-save-key` gate (`safeEqual`) before body parsing.
- `saveImage(env, body, cors)`: validate `id` with `ID_RE`; `filename` must match `^<id>-\d{10,17}\.(jpg|png|webp)$` with the id prefix equal to `body.id`; decode base64 (invalid base64 -> `invalid_image`); `bytes.length <= MAX_IMAGE_BYTES` else `too_large`; magic bytes must match the extension (JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF` at 0 and `WEBP` at 8). Path = `${env.GITHUB_IMAGES_DIR ?? 'data'}/${filename}` (never from the request). Create-only: GET contents; if it exists, compute blob sha `sha1("blob " + len + "\0" + bytes)` (crypto.subtle) and compare to the existing `sha`: equal -> `{ok:true,path,sha,url}` with NO PUT; different -> 409 `exists`, NO PUT. If absent: `ensureBranch`, PUT with no `sha`. Reuse `upstreamResponse`/`ok()`.
- `syncIndexEntry(repo, branch, gh, charsDir, id, character, imagesDir)` replacing `ensureIndexEntry`: create case unchanged (name + portrait); for an existing entry, update ONLY `portrait` when different, leaving `name` and other ids alone. Portrait value is accepted only if `null` or string matching `^<imagesDir>/[^/]+\.(jpg|jpeg|png|webp)$`; otherwise skip the index write entirely (character save still succeeds). For the create case with an invalid portrait, skip as well. Called on EVERY 2xx character PUT in `upsertCharacterFile` (not only `!exists`). Keep the bounded 409 retry; no write when equal.

**`tools/dev-server.mjs`**: mirror `/save-image` (same validation helpers duplicated minimally, writes under `data/`, same identical/`exists` rule), the index portrait rule (same regex), and add `GET /list-images` returning `{ images: ["<filename>", ...] }` for jpg/jpeg/png/webp files directly in `data/` (no subdirs). Log routes in the startup banner.

**`ui/portrait-image.js`** (new, DOM-side, outside `engine/*`)
- Pure: `validateImageFile({ type, size })` -> `{ ok:true } | { ok:false, error }` (MIME in `image/jpeg|png|webp`; `size <= MAX_SOURCE_BYTES`); `fitWithin(w, h, max=1024)` -> `{width,height}` (never upscales, rounds, min 1); `chooseOutput(hasAlpha)` -> `{ mime, ext, quality }` (`image/png`/`png` if alpha else `image/jpeg`/`jpg`/0.85); `portraitFilename(charId, now, ext)` -> `<charId>-<now>.<ext>` (`now` = ms epoch integer); `portraitPath(filename)` -> `data/<filename>`.
- `processImage(file, { now = Date.now(), decode, encode } = {})` async: `decode`/`encode` injectable seams (default `createImageBitmap(file, { imageOrientation:'from-image' })` and canvas/`OffscreenCanvas` `toBlob`); detects alpha by sampling pixel data; applies the shrink ladder from decision 1; returns `{ path, filename, mime, ext, dataUrl, width, height, bytes }`. Rejects with an `Error` carrying a user-facing message.

**`store-portrait.js`** (new, root, imported by `store.js` where needed)
- `stagePortraitImage(id, { path, mime, dataUrl })` -> `{ ok:true } | { ok:false, error:'quota' }` (try/catch around `localStorage.setItem`; nothing half-staged on failure).
- `loadStagedPortrait(id)` -> object | null (corrupt JSON or missing fields -> null).
- `clearStagedPortrait(id)`; `hasStagedPortrait(id)`.
- `parseImageListing(json)` (contents-API array -> `[{ path, name, url }]`, image extensions only, files only, newest first by name desc) and `parseLocalListing(json)` for the dev-server shape.
- `listBranchImages({ fetchFn, pages, owner, repo, branch })`: Pages -> `GET https://api.github.com/repos/<o>/<r>/contents/data?ref=<branch>`; local -> `GET ./list-images` against the dev-server base. Returns `[]` on any failure. Short per-session cache.
- Staged URL resolution: `portraitUrlFor(portrait, id)` in `store.js` returns the staged `dataUrl` when `portrait === staged.path`, else the existing raw URL. Optional session-only in-memory map `path -> dataUrl` of just-saved images served until the raw URL has loaded once (F3 mitigation; accept brief placeholder fallback if complex and document). Discord avatar/thumbnail helpers keep using the raw public URL only and never a data URL (`null`/placeholder until committed).

**`store-server.js`**: add `DEFAULT_IMAGE_ENDPOINT` (same host as `DEFAULT_ENDPOINT` with `/save-image`) and `saveImage(staged, { endpoint, saveKey, id })` POSTing `{ id, filename, content }` with `x-save-key`; mirrors `saveServer` error handling (`no_key`, `offline`, worker codes -> `SaveError`). Success ONLY on `ok:true`; `exists` is a hard failure (`SaveError('exists')`).

**`ui/ed-app.js`**
- Listener `ed-edit-portrait` near l.440 -> `_editPortrait({ portrait, staged })`: if `staged`, `stagePortraitImage` (on quota failure surface a toast and do not change `meta.portrait`); else `clearStagedPortrait(id)`; then `saveMetaEdits({ portrait }, id)`, update `_character`, re-derive model, mark `_dirty` (mirror `_editMeta` l.750).
- `_doSave` (l.2123): at the top, if a staged image exists and `keepalive` is true, return early (no upload, no JSON, no index write; overlay stays dirty). Otherwise, before the character POST in BOTH the draft first-save branch (l.2154) and the normal branch (l.2165): if staged and `character.meta.portrait === staged.path`, `await saveImage(...)`; on throw, abort (JSON not sent, overlay dirty, error toast; silent saves leave dirty). If `meta.portrait !== staged.path`, `clearStagedPortrait` without uploading. After a confirmed JSON save, `clearStagedPortrait(id)`. `stale_base` conflict keeps the staged image; keep-mine re-save re-uploads the same path (worker identical-sha -> ok).
- `_discardLocal` (l.2266) and take-theirs (l.2239) call `clearStagedPortrait(id)`.
- Pass `images` (from `listBranchImages`, loaded on modal open) and `staged` to the modal.

**`ui/ed-edit-portrait.js`** (new; template `ui/ed-edit-meta.js`: `ModalController`, `modalFrame`, `modalCss`, `isDirty`, stacked `ed-confirm`)
- Props: `current` (path|null), `images` (array), `staged` (object|null), `loadingImages`. State: `_selection` (`{kind:'existing',path}|{kind:'new',processed}|{kind:'remove'}|null`), `_error`, `_busy`.
- Events: `ed-edit-portrait` `{ portrait: path|null, staged?: {path,mime,dataUrl} }` on OK; `close`.
**`ui/portrait-modal-state.js`** (new, pure, tested): `selectExisting`, `selectNew`, `selectRemove`, `isDirty(initial, selection)`, `toDetail(selection)`.

**`ui/ed-overview.js`**: in edit mode `.portrait` (css l.69, markup l.974) and mobile `.avatar` (l.948) get a dashed outline, `role="button"`, `tabindex=0`, Enter/Space (pattern l.242-251), `aria-label`/title "Change portrait", and open the modal (follow the existing `_edit` pattern for ed-edit-meta at l.1074). Lightbox only when not in edit mode. Mobile with no image renders a placeholder avatar in edit mode, same size as `.avatar` (no header shift).

### UI / behavior
- View mode: unchanged (lightbox). Edit mode: click/Enter/Space on portrait or avatar opens the modal.
- Modal: file input (`accept="image/jpeg,image/png,image/webp"`), preview of the chosen file, thumbnail grid (`loading="lazy"`, radio/`aria-pressed` buttons, current highlighted, staged entry labelled "unsaved"), "Remove portrait", OK/Cancel. Invalid file or processing failure -> inline `_error`, modal stays open. Listing failure -> short note; upload and Remove still work. Escape closes (dirty -> stacked `ed-confirm`), Enter confirms; Enter on a focused thumbnail selects it. Theme tokens only, two font weights.
- After OK: image shows immediately (staged data URL), Save dot lights (existing `meta` overlay dirtiness). Missing file -> existing `_portraitBroken` placeholder. Save uploads image then JSON.
- Owner manual verification list: desktop Overview no-scroll fit, light and dark, mobile avatar target and placeholder, Escape/Enter in the modal, real upload against a deployed worker.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| None. No Earthdawn game rules are involved. | n/a | rules.md (states none) |

Technical limits are product decisions from qa-log (all values above), not game rules.

### Edge cases & invariants
- `meta.portrait` never points at an uncommitted file on the branch: keepalive with a staged image sends nothing; image upload failure aborts the JSON POST.
- Staged image is cleared only after JSON success; Discard and take-theirs clear it; changing/removing the portrait drops a stale staged image.
- Worker never overwrites: identical content -> ok (retry-safe, no PUT); different content at same path -> 409 `exists`, no PUT.
- Path is worker-pinned; traversal, nested paths, other-character prefix, wrong extension/magic bytes, oversize (> 1,500,000), 401 without key all rejected with no GitHub PUT.
- Index: only `characters[id].portrait` changes; `name` and other ids untouched; invalid portrait strings (traversal, wrong ext, nested, non-string) skip the index write but the character save succeeds; failed index write never fails the save; no write when equal; removal writes `null`.
- Source > 10 MB or non-JPEG/PNG/WebP rejected before decode; never upscaled; output JPEG q0.85 or PNG if alpha; filename `<charId>-<ms>.<ext>`.
- Corrupt/missing staged key -> treated as none; quota failure on stage leaves nothing staged and `meta.portrait` unchanged.
- Listing excludes `data/characters/` and non-image files; any failure -> `[]`.
- Engine remains pure; no DOM/canvas code in `engine/*`.

## Testability notes
node:test units:
- `tools/worker/worker.test.js`: `/save-image` (ok, identical retry, exists, bad magic, ext mismatch, oversize, bad/other-id filename, traversal, 401, no PUT in each reject case); `/save` index sync (create, update, no-op, null removal, 409 retry, invalid portrait strings, name untouched, other ids untouched, index failure tolerated). Existing tests must pass.
- `tools/dev-server.test.js`: `/save-image`, `GET /list-images` (filters), index portrait rule.
- `ui/portrait-image.test.js` (pure helpers; `processImage` with injected `decode`/`encode` incl. shrink ladder and cap error); `ui/portrait-modal-state.test.js`.
- `store-portrait.test.js`: stage/load/clear, corrupt value, quota (stub storage whose `setItem` throws), listing parse, `[]` on failure, staged vs committed URL, Discord helpers ignore staged paths. Update `store-avatar.test.js`/`store-thumbnail.test.js` only if broken.
- `store-server.test.js`: `saveImage` success/`exists`/`unauthorized`/`offline`. PINNED SEAM (Dev Lead): `store-portrait.js` exports `async runPortraitSave({ id, portrait, staged, keepalive, uploadImage, postCharacter, clearStaged })` where `portrait` is `character.meta.portrait`, `uploadImage(staged)` and `postCharacter()` are injected async fns, `clearStaged(id)` is sync. Behavior: if `staged` and `keepalive` -> return `{ skipped: true }` with no calls; if `staged` and `staged.path !== portrait` -> `clearStaged(id)` (no upload) then `postCharacter()`; if `staged` matches -> `await uploadImage(staged)` (throw propagates, `postCharacter` NOT called, staged kept), then `await postCharacter()`, then `clearStaged(id)` only after it resolves (if it throws, staged kept); no staged -> `postCharacter()`. Returns `{ skipped: false, result }`. `_doSave` calls it in both draft and normal branches. Save-ordering logic (image then JSON, no JSON on image failure, keepalive early return, discard/take-theirs clear) should be factored into a small pure/injectable function used by `_doSave` so it is node-testable (seam like `saveDraftFirstTime`'s `post` injection).
Manual (owner): everything listed under UI / behavior; worker redeploy per `docs/GITHUB-SERVERLESS-SAVE-RUNBOOK.md` is required before a Pages upload works.

## Changelog entry
`{"type": "added", "text": "Change your character's portrait in edit mode: upload a new image, pick one already saved, or remove it."}`

## Out of scope
Deleting or garbage-collecting old images; a per-character gallery field; embedding image data in character JSON; image crop/edit UI; animated GIF; worker name sync in the index (name stays create-only); doc updates are part of I8 (UI-GUIDELINES §6, ARCHITECTURE §7.5, GITHUB-SERVERLESS-SAVE.md "create-only" wording, runbook).
