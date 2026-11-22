# Q&A log: add-char-portrait

## 2026-11-22 — asked by interrogator
**Q:** (feature request, verbatim) In edit mode, click the portrait area (image or not) to open a modal to upload a new character image. An existing image stays in the character's assets within that same modal. You can pick existing images — any image in the character data list of images.
**A:** (initial brief — see above)

## 2026-11-22 — asked by interrogator
**Q:** How should an uploaded image persist? A: worker commits image file to character-data branch (meta.portrait stays a path; client-side downscale; worker redeploy). B: embed data URI in JSON (Tier 1 schema change; breaks Discord URLs). C: local only (no sync, no Discord).
**A:** Option A.

## 2026-11-22 — asked by interrogator
**Q:** Where does the existing-images pick-list come from? A: list images on the character-data branch (no new field); B: per-character gallery field meta.portraits (Tier 1); C: both.
**A:** Option A.

## 2026-11-22 — asked by interrogator
**Q:** When do image bytes go to GitHub? A: staged in edits overlay, uploaded with next Save; B: uploaded immediately on confirm.
**A:** Option A.

## 2026-11-22 — asked by interrogator
**Q:** Image limits: JPEG/PNG/WebP by MIME; downscale longest side to 1024px, re-encode JPEG ~0.85 (PNG kept if transparent); reject source >10MB; filename data/<charId>-<timestamp>.<ext> (never overwrites).
**A:** Yes.

## 2026-11-22 — asked by interrogator
**Q:** Modal includes "Remove portrait" (meta.portrait -> null, placeholder; file stays on branch)? Edit-mode click opens the modal; view mode keeps the lightbox.
**A:** Option A (yes).

## 2026-11-22 — asked by interrogator
**Q:** Update data/characters/index.json entry's portrait when a portrait is saved (worker rewrites only that field; shape unchanged; name stays create-only; docs updated) vs leave index alone?
**A:** Option A.

## 2026-11-22 — asked by interrogator
**Q:** Mobile: make header avatar (image or placeholder) the edit-mode click target too?
**A:** Option A (yes).

## 2026-11-22 — asked by interrogator
**Q:** Staged image never saved: overlay holds it until Save; Discard local changes drops it; placeholder fallback for missing file. Anything else material?
**A:** Nothing else (accepted).
