# Feature: Character portrait upload (add-char-portrait)

## Summary
In edit mode, clicking the portrait area (image or placeholder, desktop panel and mobile header avatar) opens a modal to upload a new character image, pick any image already on the `character-data` branch, or remove the portrait. Uploads are downscaled client-side, staged in the local edits overlay, and committed to the branch (with the JSON) on the next Save by the Cloudflare worker. Previous images are never deleted.

## Goals / Non-goals
- Goal: edit-mode click on portrait (desktop `.portrait`, mobile header avatar) opens the modal; view mode keeps the lightbox.
- Goal: upload (JPEG/PNG/WebP, source <=10 MB, downscale longest side to 1024 px, JPEG ~0.85 or PNG if transparent), pick from all images on the branch, remove portrait (`meta.portrait` = null).
- Goal: new file `data/<charId>-<timestamp>.<ext>`, never overwrites; `meta.portrait` stays a path.
- Goal: worker commits images; on a save whose `meta.portrait` changed, it updates that character's `portrait` in `data/characters/index.json` (name stays create-only).
- Goal: staged image survives reload in the overlay, uploaded with next Save, cleared on success, dropped by "Discard local changes"; missing file falls back to the placeholder.
- Non-goal: deleting/garbage-collecting old images; per-character gallery field; embedding image data in character JSON; image cropping/editing UI.

## Guardrail alignment
Touches UI-GUIDELINES §6 (portrait), ARCHITECTURE §7.5 / GITHUB-SERVERLESS-SAVE.md (worker, index rule), the Overview tab, store/overlay, and the save worker. No schema shape change (`meta.portrait` is an existing path field; index shape `ed-characters-index/1` unchanged), no taxonomy change, no data-down/dispatch-up violation (modal dispatches up; ed-app persists). Staged bytes live in the overlay (an input), not in character JSON. All tickets Tier 3; the modal must use `ui/kit/` (MODALS.md), honor Escape/Enter, light+dark, relative paths.

## Tickets
### T1 — Worker: image commit + index portrait update
- **What:** Add a worker endpoint (e.g. `POST /save-image`) that validates (magic bytes JPEG/PNG/WebP, size cap, filename pattern `<charId>-<ts>.<ext>`, path pinned to env data dir, never overwrite) and commits to `character-data`. Extend `/save` so a changed `meta.portrait` also updates `characters[id].portrait` in `index.json`. Redeploy per runbook.
- **Why:** Worker currently commits JSON only; images need a path to the branch (owner chose option A, Q1; index follows, Q6).
- **Tier:** 3 (sign-off: n/a; worker is outside protected surfaces)
- **Acceptance criteria:** valid upload commits file and returns ok; invalid type/oversize/bad name/overwrite rejected with codes; index portrait updated only for that id, name untouched; existing worker tests extended and passing.
- **Open questions:** none.

### T2 — Client: downscale, staging overlay, branch image listing, save flow
- **What:** DOM-side image processing module (validate, downscale 1024 px, re-encode); overlay storage for staged image bytes keyed per character; list branch images (contents API on Pages, local `data/` listing locally); portrait URL resolution for a staged path (object/data URL); Save uploads staged images before the JSON and clears them on success; Discard/reconcile drops them; conflict flow treats them as pending.
- **Why:** Q3 (stage until Save), Q4 (limits), Q2 (list from branch), Q8.
- **Tier:** 3
- **Acceptance criteria:** unit tests for processing limits, overlay stage/clear/discard, save ordering (image then JSON; JSON not sent if image upload fails), list parsing, staged URL resolution; engine stays DOM-free.
- **Open questions:** none.

### T3 — Portrait modal (ui/kit)
- **What:** Modal with upload control, thumbnail grid of branch images (current highlighted), "Remove portrait", confirm/cancel; inline errors; dispatches `ed-edit-portrait` up.
- **Why:** Core UX (Q5, Q2).
- **Tier:** 3
- **Acceptance criteria:** uses ui/kit modal; Escape closes, Enter confirms; theme-aware; UI-kit check passes; load/list failure degrades gracefully (upload still possible).
- **Open questions:** none.

### T4 — Overview click targets (desktop + mobile)
- **What:** In edit mode the `.portrait` panel (image or placeholder) and the mobile header avatar become editable regions (dashed affordance, keyboard accessible) opening T3; view mode unchanged (lightbox). ed-app handles `ed-edit-portrait` via `saveMetaEdits`.
- **Why:** Q7 (mobile too).
- **Tier:** 3
- **Acceptance criteria:** Overview still fits desktop viewport; placeholder case clickable; no placeholder-pill/derived-value regression.
- **Open questions:** none.

### T5 — Docs
- **What:** Update UI-GUIDELINES §6, ARCHITECTURE §7.5, GITHUB-SERVERLESS-SAVE.md (image endpoint, index portrait rule change), runbook note for worker redeploy.
- **Why:** Docs must match code.
- **Tier:** 3
- **Acceptance criteria:** docs state the new behavior; no contradictions with the create-only index text.
- **Open questions:** none.
