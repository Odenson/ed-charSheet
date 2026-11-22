# Build log: delete-character

## Run 1 — 2026-11-22 (since 2026-11-22T10:00:28Z)

### Alignment
- Guardrails: all items Tier 3 (worker, new UI content; no schema/taxonomy change). No Tier-1/2 sign-off required.
- Rules: `rules.md` states no Earthdawn rules involved. Nothing to ground.
- Open questions: only the non-blocking note (base for a non-open character is read at confirm time). Treated as accepted by the owner running /build-feature; revisit only if the owner objects.
- Review: 4 findings, all accepted and folded into plan.md.
- Tree: only `plans/delete-character/` untracked (planning artifacts). `dev` is level with `origin/dev`.

## Run 2 - build (feature-dev)

### I1a/I1b (worker) - implemented, uncommitted
- `tools/worker/worker.js`: `POST /delete-character` (`deleteCharacter`, `imageVerdict`, `deleteImageFile`), shared `updateIndex` (`syncIndexEntry` refactored onto it, unchanged behavior), 404 text + CORS comment + header doc updated. `readCharacterFile` now also returns the raw `content`.
- Worker suite: 112 pass, 1 fail (disputed below). `worker.test.js` and `worker-portrait.test.js` green unchanged.

### Dispute raised (NEEDS_TESTER)
`tools/worker/worker-delete.test.js` case "image: another file unreadable or unparseable ..." (test #26) builds BOTH fakes up front in the `cases` object. `fakeGitHub()` installs itself on `globalThis.fetch` at construction, so the second fake ("unparseable") captures the first's fetch as its `original` and is the live fetch during iteration 1. Iteration 1 therefore runs against the second fake (deleting `chakka` there); `restore()` of the first fake then resets fetch to the real one; iteration 2 calls `gh.sha(P('chakka'))` on the second fake whose chakka file is already deleted -> `TypeError: Cannot read properties of undefined (reading 'v')` inside the test helper, before the worker is even called. No worker behavior can satisfy it. Fix: construct each fake inside the loop (e.g. cases as factory functions).

Work stopped here per protocol; I2, I3a, I3b, I4, I5 not started.

## Run 3 - resume after TESTER_UPDATED
- I2 dev-server mirror, I3a (`delete-action.js`, `deleteCharacterServer`, `onPages`/`readCharacterWithBase` exports in store.js), I3b (`ed-app.js` `_deleteCharacter`, `_resetIfOpen` shared reset, key-prompt replay), I4 (`ui/ed-delete-character.js`, picker Delete button), I5 (docs + changelog) done.
- Gate: `npm test` 2165 pass / 0 fail; `node tools/check-ui-kit.mjs` ok. No further disputes.

## Dev Lead review (commit 1e5ecbe)
Worker, dev server, client helpers, modal, docs: correct against spec; golden rule, tiers, kit use OK. Findings:
- R1 (minor): `_deleteError` in ed-app is never cleared when the delete modal is cancelled, so an old error reappears on the next open. Fix: picker dispatches a `delete-dismissed` event on the modal's close; ed-app clears `_deleteError` on it.
- R2 (minor): on `stale_base` the modal stays open with no inline message (toast only, which sits behind the modal). Fix: also set `_deleteError` to the stale message.

Revision: R1 (picker dispatches delete-dismissed on modal close; ed-app clears _deleteError) and R2 (stale_base also sets _deleteError) fixed. Gate green.

## Doc sync (design-agent)
Applied: MODALS.md (layer table, controller list, picker-nested modal), GITHUB-SERVERLESS-SAVE.md (§1 route framing, delete blast radius), RUNBOOK (dev-server mirror, test pointer).
Deferred for owner (Tier-1 doc surfaces, no sign-off recorded; descriptive only):
- ARCHITECTURE.md §8 layout: add `delete-action.js`, `ed-delete-character.js`, picker comment (Delete on every row), `store-server.js` comment (deleteCharacterServer).
- ARCHITECTURE.md §7.5: one clause on the app-side flow (draft local; saved needs key + base; null base blocked on Pages; stale_base toast, no ed-conflict).
- UI-GUIDELINES.md picker: draft row layout is [open][Discard ✕][Delete]; reword "draft: nothing was saved" to "removed from this browser only, no network call"; note stale_base toast and Pages null-base block.
- Also unapplied (minor): GITHUB-SERVERLESS-SAVE.md test-coverage bullet for delete; runbook smoke checklist row.

## Owner handoff — PR checklist (results)
- [x] No Tier-1 invariant changed (all Tier 3)
- [ ] Overview fits desktop viewport — untouched; owner to confirm
- [x] Derived values untouched (no engine change)
- [ ] Light/dark; modal Escape/Enter — implemented via kit; owner to verify visually
- [x] Modals use ui/kit; `check-ui-kit` passes (45 files)
- [x] No taxonomy change (N/A)
- [x] Relative paths
Gate: `npm test` 2165 pass / 0 fail.

## Manual UI verification
1. Open loader: every row has a trash button; draft rows show ✕ and trash. Check narrow width (~375px) layout, light and dark.
2. Click trash: modal shows warning; Delete disabled until name typed exactly; Escape closes, Enter confirms only when enabled; focus returns to the row.
3. Draft delete removes it locally, no network.
4. Saved delete (after worker redeploy): needs save key; file and index row vanish; deleting the open character returns to "No character selected".
5. Portrait checkbox is unchecked by default and only shown with a portrait; shared image is kept with a notice.
6. Stale: change the file elsewhere, then delete → inline + toast "reload first".
Release step: redeploy worker (`npx wrangler deploy`) before testing saved delete on Pages.
