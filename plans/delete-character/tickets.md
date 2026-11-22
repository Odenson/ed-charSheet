# Feature: Delete character (delete-character)

## Summary
From the character loader, the owner can delete a character — a saved one on the `character-data` branch or an unsaved local draft — via a warning modal that requires typing the character's name. The modal offers an "Also delete the portrait image" checkbox, unchecked by default, so the character and its portrait are only both deleted when the user asks. Saved deletes go through a new worker route that removes the character file and its index row (and the image when requested and unshared).

## Goals / Non-goals
- Goal: delete icon on every picker row (saved and draft), beside the existing draft Discard; unified Delete for both kinds.
- Goal: type-the-name-to-confirm modal (ui/kit), permanent-deletion warning, unsaved-local-edits warning; Escape closes, Enter confirms only when the name matches.
- Goal: "Also delete portrait image" checkbox, default unchecked, shown only when the character has a portrait; deletes only `meta.portrait`, and only if no other character references it (skipped with a note otherwise).
- Goal: worker `POST /delete-character` (same `x-save-key` gate): deletes `data/characters/<id>.json` and the `index.json` row, optionally the image; sends `base`, stale mismatch -> `409 stale_base` (no write); local dev server mirrors it.
- Goal: after delete, clear overlay/draft for that id and return to loader (or next character) if it was open.
- Non-goal: in-app undo (recovery via git history on `character-data`); deleting other old/orphaned images; bulk delete; schema or taxonomy changes.

## Guardrail alignment
Touches UI-GUIDELINES (picker, modal), MODALS.md (kit modal), ARCHITECTURE §7.5 and docs/GITHUB-SERVERLESS-SAVE.md (new route), store/overlay, the worker and dev server. No schema shape change (`ed-character/2`, `ed-characters-index/1` unchanged — an index row is removed, not reshaped), no taxonomy change, data-down/dispatch-up kept (modal dispatches `delete-character` up; ed-app/store performs it), engine pure. All tickets Tier 3; no Tier-1 sign-off needed.

## Tickets
### T1 — Worker: `/delete-character` route
- **What:** New route validating id (`^[a-z0-9][a-z0-9-]{0,63}$`), `base`, optional `deleteImage` path (must match the image filename rule and be pinned to the images dir). GET file sha, compare `base` (stale -> 409 `stale_base`), DELETE file, remove the id from `index.json`; if `deleteImage` and no other character (from the index and files) references it, delete the image and report `imageDeleted`/`imageSkipped: shared`. Update CORS methods/404 text, worker tests, redeploy per runbook.
- **Why:** The worker currently only creates/updates; deletion needs a server-side path (token never in browser).
- **Tier:** 3 (worker is outside protected surfaces)
- **Acceptance criteria:** valid delete removes file + index row; unknown id handled (idempotent/not_found per planner decision); stale base -> 409 no write; shared image never deleted; bad id/image path rejected; fail-closed auth; tests pass.
- **Open questions:** whether to verify image sharing from index portraits only or by reading each character file (planner).

### T2 — Dev server mirror + client delete flow
- **What:** Local dev server mirrors `/delete-character`. Client store/ed-app: `deleteCharacter({id, deleteImage})` — draft: clear localStorage draft; saved: POST with last-known base then clear overlay/conflict state, drop from loaded index, return to loader/next character if open. Surfaces stale/upstream/skipped-image outcomes.
- **Why:** Wires the UI to the worker for both saved and draft characters.
- **Tier:** 3
- **Acceptance criteria:** unit tests for draft path, saved path, stale_base handling, overlay cleared, open-character fallback; engine stays DOM-free; relative paths.
- **Open questions:** none.

### T3 — Delete modal + picker affordance
- **What:** Delete icon on every picker row; kit-based modal naming the character, permanent-deletion + unsaved-edits warnings, name-entry field, unchecked "Also delete portrait image" checkbox (hidden without a portrait), Cancel/Delete. Dispatches `delete-character` up.
- **Why:** The accident-proof UX the owner requested.
- **Tier:** 3 (must honor Tier-1 modal/theme/font rules)
- **Acceptance criteria:** Delete disabled until typed name matches; Escape closes, Enter confirms only when enabled; light + dark; two font weights; keyboard reachable; UI-kit check passes; inline error and "image kept (shared)" notice.
- **Open questions:** none.

### T4 — Docs, tests, changelog
- **What:** Update UI-GUIDELINES (picker), GITHUB-SERVERLESS-SAVE.md and ARCHITECTURE §7.5 (route, contract table, runbook redeploy note), `data/changelog.json` unreleased entry; supplement tests.
- **Why:** Docs must match code.
- **Tier:** 3
- **Acceptance criteria:** `npm test` green; docs match code.
- **Open questions:** none.
