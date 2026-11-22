# Plan Review: Character portrait upload (add-char-portrait)

## Summary
The plan is well grounded and every item is Tier 3 with no rules dependency (`rules.md` correctly says none). There are 5 findings, none blocking: 1 major (a data-integrity hole in the keepalive path) and 4 minor.

## Findings
### F1 — I5 — Keepalive skip must skip the whole save, not just the image
- **Severity:** major
- **Problem:** I5 says to "skip the image upload for `keepalive` saves (leave dirty)". The flush-on-hide path (`ed-app.js` ~l.2009) calls `_doSave({ silent: true, keepalive: true })`. If only the image upload is skipped and the character JSON is still POSTed, the branch gets `meta.portrait` pointing at a file that was never committed. Other devices, the index rewrite (I2) and Discord then see a dead path.
- **Fix:** State explicitly that when a staged image is pending and `keepalive` is true, `_doSave` returns early with no image upload, no JSON POST and no index write, leaving the overlay dirty. Add a test for this. Alternatively, keepalive saves could send the JSON with the previous committed portrait, but that adds complexity. The early return is simpler.

### F2 — I5 — `exists` treated as success is too loose
- **Severity:** minor
- **Problem:** The client treats any `exists` as success for retry-safety. A filename collision with different content would silently point `meta.portrait` at someone else's image. The collision is unlikely with timestamp names, but I1 already offers a sha comparison.
- **Fix:** Pick one rule. Either the worker compares the blob sha computed from the content and returns ok only if identical, or it returns `exists`, and the client treats that as success only for the same staged filename. Test both the identical and the different-content case.

### F3 — I4 — Post-save URL flip may flash a broken image
- **Severity:** minor
- **Problem:** After a successful save, the staged data URL is cleared and the view switches to the raw.githubusercontent URL. That CDN can lag or negatively cache a freshly committed file. The user would see the placeholder via `_portraitBroken` right after saving.
- **Fix:** Note the risk. Optionally keep serving the staged data URL for the session until the raw URL loads, or accept and document the brief fallback.

### F4 — I4 / I9 — Local listing mechanism left open while I4 is specified
- **Severity:** minor
- **Problem:** I4 and I9 leave the local listing mechanism undecided. The sequencing places I9 before I4, so it can be decided there, but the acceptance criteria of I4 and I9 do not pin either choice.
- **Fix:** Decide before build (a dev-server `GET /list-images` route is simplest). Record the choice in the plan and cover it with a dev-server test.

### F5 — I2 — Index sync trusts client `meta.portrait`
- **Severity:** minor
- **Problem:** `/save` writes the client-supplied `meta.portrait` string into the shared `index.json`. Nothing constrains it to an image path under the data dir. The pick-list also comes from the branch, so an arbitrary string could reach the index.
- **Fix:** In `syncIndexEntry`, accept only null or a string matching `^data/[^/]+\.(jpg|jpeg|png|webp)$`. Otherwise skip the index write, and test that case.

### Notes (not findings)
- I3 (client image module) and I1 (worker endpoint) both enforce size and format limits. The 1.5 MB cap is a proposed value and is listed under Open questions. Confirm it in build against a worst-case 1024 px PNG, and against the localStorage quota, since the base64 data URL is about 1.33x the size.
- UI work (I6, I7) needs owner manual verification: the desktop no-scroll fit, light and dark themes, the mobile avatar, and the Escape/Enter behavior. Add this explicitly to the build report.
