# Plan Review: Thumbnail in roll (thumbnail-in-roll)

## Summary
The plan is sound and grounded: the cited functions, line numbers, `.gitignore` and deploy facts check out, all items are Tier 3, and no Earthdawn rules are used. No blockers; 3 minor findings.

## Findings
### F1 — I2 — Dependency wording and non-string portrait
- **Severity:** minor
- **Problem:** I2 lists "Dependencies: I3 file names", but I2 itself fixes the names, and the Sequencing section runs I3 before I2. Also `portraitUrlFor` only checks truthiness, so a non-string `meta.portrait` (e.g. a number or object) would be interpolated into a URL.
- **Fix:** State that I2 owns the file names and I3 conforms (or drop the dependency line). In `discordThumbnailUrl`, treat a non-string or whitespace-only portrait as "no portrait" before calling `portraitUrlFor`, and add a test case for it.

### F2 — I4 — Overlay-fold risk left as an open check
- **Severity:** minor
- **Problem:** The risk says to "confirm" that `this._character.meta` is the overlay-folded value. `store.js:1708` shows `meta: character.meta ?? {}` in the derived model, and `portraitUrl` at line 1713 reads `character.meta?.portrait` from the same input, so the check can be settled now. The plan also adds `portrait` to `_pendingReport` but has no test. `ed-app` has no DOM harness.
- **Fix:** Record the line 1708/1713 finding as confirmed and drop it from Risks. Name the manual owner check explicitly: embed format on a local run shows the "LOCAL TEST" thumbnail in Discord, for both a real roll and the Settings test message.

### F3 — I3 — Image generation scope
- **Severity:** minor
- **Problem:** Hand-rolling a zlib PNG writer and a bitmap font is the most effort-prone part of the plan, and the build log must say how the images were made. The plan defaults to a throwaway script, which leaves no reproducible source.
- **Fix:** Keep the cap small (a fixed 5x7 font, two label strings). Either commit the script under `tools/` (excluded from deploy) or record in the build log that it was throwaway. Have the test also check the IHDR width and height, as the acceptance criteria already say.
