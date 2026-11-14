# QA log — thumbnail-in-roll

## 2026-11-14 — context (from embedded-die-roll)
The shipped `embedded-die-roll` feature sends an embed with no thumbnail (explicit non-goal there). The owner then asked about images in the embed; a thumbnail with the character portrait was proposed. Finding: on Pages, `portraitUrlFor` (`store.js`) already resolves `meta.portrait` to a public `raw.githubusercontent.com` URL; locally it is bundle-relative (`./data/…`, not reachable by Discord).

## 2026-11-14 — asked by interrogator
**Q:** Should the thumbnail always be the character's own portrait, automatic with no new setting, for every character in Embed format? Or a separate on/off switch in Settings?
**A:** Automatic, no setting.

## 2026-11-14 — asked by interrogator
**Q:** When run locally, or a character has no portrait, there is no public image URL. Send the embed without a thumbnail, silently?
**A:** It should go out with a placeholder stating local test.

## 2026-11-14 — asked by interrogator
**Q:** Ship a small static "local test" image in the repo and point the embed at its public Pages URL (vs an external placeholder service)?
**A:** Yes, ship the image.

## 2026-11-14 — asked by interrogator
**Q:** For a Pages character with no portrait: no thumbnail, or the same "local test" placeholder (misleading)? (Recommended: no thumbnail.)
**A:** Yes (to no misleading placeholder), but generate a new default "no-image" image for that case. So two shipped images: "local test" (local runs) and "no-image" (no portrait on Pages).

## 2026-11-14 — asked by interrogator
**Q:** Serve the two placeholder images from the production Pages site (visible only after the first release to main) or the dev site? (Recommended: production.)
**A:** Production site is fine.

## 2026-11-14 — asked by interrogator
**Q:** Anything else? (Summary of plan: embed-only thumbnail; portrait on Pages, "local test" image locally, "no-image" for no portrait on Pages; two generated ~256px PNGs; no setting, no stored field; engine pure; nothing else changes.)
**A:** Nothing else, go ahead.
