# Plan Review: Delete character (delete-character)

## Summary
The plan is mostly sound. All items are correctly Tier 3 and no rules are involved. There are 4 findings: 0 blockers, 2 major and 2 minor. The major ones are a contradiction about the dev-server `base`, and an image-delete path that the worker does not tie to the target character.

## Findings
### F1 — I2 / I3 — Dev-server `base` semantics contradict each other and would block local deletes
- **Severity:** major
- **Problem:** `tools/dev-server.mjs` (header, ~L17-20 and L270-274) says local reads carry no ETag, so the app never sends a `base` and the legacy overwrite path is used. I2's Approach says to compute `base` as a git blob sha, and its Risks section says to accept `null`. These are inconsistent. I3 also says "if the read yields `base:null`, block with a clear message and do not delete". Locally `base` is always `null`, so that rule would block every local delete of a non-open character and of the open character, and the dev server could never be exercised. The plan describes the `null` block only as a "CDN fallback on Pages" case.
- **Fix:**
  - Pick one dev-server contract: accept `base` omitted or `null`, and validate it only for mirror-shape as `/save` does. Drop the blob-sha computation, or make it apply only when a `base` is supplied.
  - Make I3's block rule depend on the environment. Block on `base===null` only when the endpoint is the Pages worker, and allow it on the local dev server. Test both cases.
  - Say how the client tells the two apart, for example the existing off-Pages detection that `store.js` already uses.

### F2 — I1 — `deleteImage` path is not tied to the target character's `meta.portrait`
- **Severity:** major
- **Problem:** The worker accepts any path that passes `isValidIndexPortrait` for `imagesDir` and only checks that no other character references it. The ticket says only the character's own `meta.portrait` may be removed. As written, a key-holder or a buggy client could delete any unreferenced image under `imagesDir`, for example an item or catalog image if `isValidIndexPortrait` allows those. This widens the blast radius that I5 documents.
- **Fix:**
  - In I1, read the target file's content before the delete and require `deleteImage === target.meta.portrait`. Otherwise skip with `imageSkipped:'mismatch'` or return 400 `invalid_image`.
  - Alternatively take a boolean and derive the path from the file only.
  - Add a worker test for this, and confirm that `isValidIndexPortrait` does not admit non-portrait image locations.

### F3 — I4 — `hasPortrait` comes from the index row, but I3 deletes the file's `meta.portrait`
- **Severity:** minor
- **Problem:** The index is best-effort (a plan Discovery says so). A stale or missing index `portrait` would hide the checkbox, or show it when the file has no portrait. I3 correctly uses the freshly read file at delete time.
- **Fix:** Document the discrepancy. If the confirm-time read finds no `meta.portrait`, `deleteImage` is a no-op that returns `imageSkipped:'none'`. Add a test for that case.

### F4 — I1 / I3 — Scope of the items
- **Severity:** minor
- **Problem:**
  - I1 combines the route, the shared `updateIndex` refactor, the sharing scan and the image delete.
  - I3 combines the client I/O, the key prompt, the stale handling, the base fetch for non-open rows and the open-character reset in the large `ed-app.js`.
  - Both are heavy for one focused review.
- **Fix:**
  - Split I1 into I1a (file and index delete plus validation and stale handling) and I1b (the image sharing scan and image delete).
  - Optionally split I3 into the pure `delete-action.js` plus `store-server.js` part and the `ed-app.js` wiring.
  - Keep the `syncIndexEntry` refactor behind its existing tests.
  - UI behavior (focus return, narrow-width row layout with three buttons, nested-modal Escape, light and dark) cannot be covered by `node:test`. I4 should say explicitly that the owner verifies these manually.
