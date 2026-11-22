# Test Plan: Delete character (delete-character)

No Earthdawn rules are involved (rules.md: none); every "Rule" below is n/a.

## Test files
- tools/worker/worker-delete.test.js
- tools/dev-server-delete.test.js
- store-server-delete.test.js
- delete-action.test.js

## Coverage
### tools/worker/worker-delete.test.js (30 cases, in-memory GitHub fake)
- **Validates:** I1a/I1b. Happy path (file + index row removed, other files untouched, DELETE carries sha/branch/message); no image touch without `deleteImage`; absent index and absent row are no-ops; index PUT 409 retry; failed index write gives 200 `indexUpdated:false`; missing file is idempotent (`deleted:false`, stale index row removed, `imageSkipped:'unknown'`); stale base gives 409 `stale_base` with current sha and zero writes; DELETE-window 409 gives `stale_base` with a re-read sha and keeps the index row; 400 `invalid_id`/`invalid_base`/`invalid_image` before any GitHub call; non-JSON 400; 401 for missing/wrong/unset key; 404/OPTIONS/404-text routing; upstream DELETE 500 is non-2xx. Image: unshared delete; `mismatch` (other character's image, catalog image); `none`; `shared` via index row, via another file with a missing row, and with no index file; target and `index.json` not counted as "another"; `unverified` on unreadable/unparseable file and on listing failure; 404 image counts as `imageDeleted:true`; image DELETE failure gives 200 `imageSkipped:'error'`; `GITHUB_IMAGES_DIR` pins the dir.
- **Rule:** n/a
- **Why:** catches wrong-image deletion, deletes against stale data, silent failure modes, and fail-open auth/validation.
- **Assumption on the GitHub fake:** directory listing is `GET contents/<charsDir>` returning an array of `{name, path, type, sha}`; file reads return `{sha, content(base64)}`.

### tools/dev-server-delete.test.js (16 cases, temp root)
- **Validates:** I2 mirror: delete file + row; `base` omitted/null/any string accepted (no stale detection), non-string base `invalid_base`; invalid id/image 400; non-JSON 400; idempotent missing file; absent index; image delete / not requested / `mismatch` (incl. catalog) / `none` / `shared` via file / `unverified` / already gone; 404 text names `/delete-character`.
- **Rule:** n/a
- **Why:** local dev contract matches the worker without a stale check.

### store-server-delete.test.js (11 cases)
- **Validates:** `DEFAULT_DELETE_ENDPOINT`; request body `{id, base, deleteImage}` + `x-save-key`; result fields incl. `imageSkipped`; null base / omitted image; custom endpoint; `no_key` before any request; `unauthorized`; `offline`; `stale_base` gives `SaveConflictError` with sha; `invalid_base`/`invalid_image`/`invalid_id` give plain `SaveError` with a non-empty message; non-JSON response is an error.
- **Rule:** n/a

### delete-action.test.js (10 cases)
- **Validates:** `nameMatches` (trim, case-sensitive, empty never matches); `planDelete` (draft = local only; open uses `baseSha`; non-open uses `fileBase`; Pages + null base gives `block/no_base`; off-Pages null base proceeds; `body.deleteImage` is the `portrait` path only when `deleteImage` is true); `noticeForResult` (non-empty, distinct for shared/unverified/error, shared mentions another character).
- **Rule:** n/a
- **Assumptions the dev may dispute (spec leaves these implicit):** `planDelete` `deleteImage` is a boolean and `portrait` the file's path; `body` contains `base` and `deleteImage` (the `id` is not asserted); `noticeForResult` returns a string for `deleted:false` and every `imageSkipped` value.

## Not covered (and why)
There is no browser harness. The owner verifies by hand:
- Delete button on every picker row (draft keeps Discard); layout of three buttons at narrow width.
- Modal: Delete disabled until the typed name matches (trimmed, case-sensitive); Enter gated; Escape closes only the top modal; initial focus in the name field; focus returns to the row's Delete button or `refocus()`.
- Portrait checkbox unchecked by default and hidden without a portrait; warnings (permanent, unsaved edits for draft/pending edits).
- ed-app wiring: draft path makes no network call and clears draft/overlay/roll log/Discord/staged portrait; saved path prompts for the key, clears local state, drops the row, resets to loader when the open character was deleted; `stale_base` toast keeps local state and does not open the conflict modal; Pages null-base block notice; image-skipped toasts.
- Light/dark rendering, 400/500 weights, `node tools/check-ui-kit.mjs`.
- Worker redeploy and a live smoke delete.

## How to run
`npm test`
