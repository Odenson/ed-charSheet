## 2026-11-14 — asked by interrogator
**Q:** Should the avatar (webhook `avatar_url`) appear on embed format only, or on both embed and plain-text messages?
**A:** Both formats, so every roll gets the icon.

## 2026-11-14 — asked by interrogator
**Q:** Which image should the avatar use: reuse discordThumbnailUrl exactly (placeholders included), or portrait only (no avatar_url when no portrait / local run)?
**A:** Option 2 — portrait only; omit avatar_url when there is no portrait or on a local run (Discord shows the webhook default icon).

## 2026-11-14 — asked by interrogator
**Q:** Should the Settings test message also carry the avatar? (Assumed: embed thumbnail stays exactly as shipped, avatar added alongside.)
**A:** Yes — the test message sends the portrait avatar too.
