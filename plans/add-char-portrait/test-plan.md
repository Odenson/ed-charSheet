# Test Plan: Character portrait upload (add-char-portrait)

## Test files
- tools/worker/worker-portrait.test.js (new)
- tools/dev-server-portrait.test.js (new)
- store-server-image.test.js (new)
- store-portrait-save.test.js (new; `runPortraitSave` pinned seam)
- store-portrait.test.js (new)
- ui/portrait-image.test.js (new)
- ui/portrait-modal-state.test.js (new)
- tools/worker/worker.test.js (EDITED by the tester: 3 existing assertions that said "ordinary saves never touch the index" were relaxed to "never WRITE the index", because spec decision 2 makes the worker always read index.json after every 2xx character PUT. Nothing else changed; the file passes today.)

Rules: none involved (rules.md states none). Every limit asserted comes from spec.md (Build-time decisions, Design, Edge cases).

## Coverage
### tools/worker/worker-portrait.test.js (/save-image)
- ok JPEG: one PUT at `data/<filename>`, env-pinned branch, no `sha`, exact bytes, `{ok,path,sha,url}`. Catches wrong path/overwrite semantics.
- PNG and WebP accepted with matching magic.
- `GITHUB_IMAGES_DIR` override + a request `path` field ignored (path worker-pinned).
- Boundary: exactly 1,500,000 decoded bytes ok; 1,500,001 -> `too_large`.
- Identical content at existing path -> ok, NO PUT; different content -> 409 `exists`, NO PUT.
- Rejections with no PUT: magic/extension mismatch (JPEG name+PNG bytes, PNG name+JPEG bytes, RIFF without WEBP, no magic), bad base64 (`invalid_image`); bad filenames (no timestamp, 9/18-digit timestamp, gif/jpeg ext, other-character prefix, traversal, nested, `data/` path, empty) -> `invalid_name`; non-string filename, bad/missing id, missing content, non-JSON -> 400.
- 401 (missing/wrong key, unconfigured SAVE_KEY) with zero GitHub traffic; GET -> 404; OPTIONS 204 + CORS; upstream 500 -> non-ok.
### tools/worker/worker-portrait.test.js (/save index sync)
- Changed portrait updates ONLY `characters[id].portrait` (name untouched even if the character was renamed, other ids untouched, PUT carries read sha).
- Removal writes `null`; unchanged -> no index write; sync runs for an existing file (not only creates) and after the character PUT.
- Invalid portrait values (traversal, nested, wrong ext, absolute URL, non-string, etc.) skip the index write; character save still 200; also for the create case; valid create still writes name+portrait.
- `GITHUB_IMAGES_DIR` drives the accepted prefix.
- Index PUT 409 re-read and retried; index read/write 500 tolerated (save 200).
### tools/dev-server-portrait.test.js
- `/save-image` mirror: write to `data/`, PNG/WebP, identical retry ok, different content 409 `exists` file unchanged, same rejection codes, boundary 1,500,000, nothing written on reject.
- `GET /list-images`: only jpg/jpeg/png/webp directly in `data/` (excludes non-images, subdirs, dirs named like images, `data/characters/`); empty -> `{images:[]}`; includes a fresh upload.
- `/save` index rule mirror: update only portrait, name/other ids untouched, null removal, invalid strings ignored, create with invalid portrait writes no entry.
### store-server-image.test.js
- `DEFAULT_IMAGE_ENDPOINT` = `DEFAULT_ENDPOINT` host + `/save-image`; request shape `{id, filename, content}` (base64, no prefix, filename not path) + `x-save-key`; custom endpoint; `no_key` before request; `exists`/`unauthorized`/`too_large`/`invalid_image`/`invalid_name`/`offline`/`http_<n>` -> `SaveError`; a 2xx without `ok:true` is not success.
### store-portrait.test.js
- stage/load/clear/has round trip under `ed-character-image:<id>`, replace, per-character isolation, not in the edits overlay, corrupt/incomplete -> none, quota -> `{ok:false,error:'quota'}` with nothing staged and no throw.
- `parseImageListing` (images only, files only, newest-first by name desc, garbage -> `[]`), `parseLocalListing`.
- `listBranchImages`: exact contents-API URL on Pages, `./list-images` locally, `[]` on throw/non-ok/bad JSON/wrong shape. (Tests use unique owner/repo/branch to avoid the per-session cache.)
- `portraitUrlFor(portrait, id)`: staged path -> data URL, other path/other id/cleared -> committed URL, null -> null, id omitted unchanged; Discord avatar/thumbnail never return a data URL.
### store-portrait-save.test.js (`runPortraitSave`, spec "PINNED SEAM")
- Match: upload -> post -> clear order, returns `{skipped:false,result}`; upload throw propagates, no post, staged kept; post throw propagates, staged kept (no clear).
- keepalive + staged: `{skipped:true}`, zero calls (also when path mismatches); mismatch: clear without upload then post; no staged: post only (keepalive or not).
### ui/portrait-image.test.js
- `validateImageFile` (3 MIME types, exactly 10 MB ok, 10 MB+1 and other MIME rejected with message), `fitWithin` (scale, never upscale, round, min 1, custom max), `chooseOutput` (alpha -> PNG, else JPEG 0.85), `portraitFilename`, `portraitPath`.
- `processImage` with injected seams: JPEG/PNG choice, filename/path fields, no upscale, shrink ladder 1024->768->512, exactly-cap accepted, still-too-big -> "too detailed" Error after exactly 3 encodes, invalid source rejected before decode, decode failure -> Error with message.
### ui/portrait-modal-state.test.js
- Constructors' shapes, `isDirty` matrix, `toDetail` for existing/new/remove (staged payload only for new).

## Seam contracts the tester had to PIN (spec was silent; dev must conform or dispute via adjudication)
- `processImage(file, { charId, now, decode, encode })`: the spec signature omits `charId`, but `filename`/`path` need it. `decode(file)` -> `{ width, height, hasAlpha }`; `encode(decoded, { width, height, mime, quality })` -> `{ dataUrl, bytes }`.
- `isDirty(initial, selection)`: `initial` is the current portrait path or null.
- `toDetail`: existing -> `{portrait: path}`; new -> `{portrait: path, staged:{path,mime,dataUrl}}`; remove -> `{portrait:null}`.
- `listBranchImages` rows share the `{path,name,url}` shape of the parsers; `pages` is a boolean.
- Worker error codes for bad id are only asserted as HTTP 400 (spec lists no code).

## Not covered (and why)
- `_doSave` wiring of `runPortraitSave` (both draft and normal branches), discard/take-theirs calling `clearStagedPortrait`: ed-app is DOM-side; owner verifies (save with a staged image uploads then saves; Discard drops it).
- UI (no browser harness); owner verifies by hand:
  - Edit mode: click/Enter/Space on desktop `.portrait` and mobile avatar (image and placeholder) opens the modal; dashed outline; view mode still opens the lightbox.
  - Desktop Overview still fits the viewport with no vertical scroll, light and dark; mobile header does not shift when the placeholder avatar appears.
  - Modal: upload preview, invalid file inline error (modal stays open), thumbnail grid (current highlighted, staged labelled "unsaved"), Remove, listing-failure note with upload still working, Escape (dirty asks to discard), Enter confirms, Enter on a thumbnail selects.
  - After OK the new image shows at once and the Save dot lights; after Save it persists across reload; Discard drops it; a missing file shows the placeholder.
  - `node tools/check-ui-kit.mjs` passes (run by the dev/QA).
  - Real upload against a redeployed worker (runbook); post-save CDN lag fallback (F3).
- `processImage` default (browser) decode/encode and alpha sampling: canvas-only.

## How to run
`npm test`
