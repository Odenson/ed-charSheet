# Build log: user-image-discord

## Run 1 — 2026-11-14 (since 2026-11-14T10:59:04Z)
- **Alignment: PASS.** All items (I1–I3) Tier 3; no Tier-1/2 sign-off needed (qa-log Q1–Q3). `rules.md`: no Earthdawn rules involved. No open questions in plan/review (F1, F2 resolved in plan). Tree: only `plans/user-image-discord/` untracked (this feature's folder).
- **Spec / tests / build:** spec.md, tester tests (`engine/discord-avatar.test.js`, `store-avatar.test.js`), feature commit 1e5639c. No NEEDS_TESTER / NEEDS_HUMAN. Tester files verified unchanged vs snapshot.
- **Dev Lead review:** clean, no revision. Cosmetic: changelog entry has odd indentation (valid JSON).
- **Doc sync:** applied ARCHITECTURE.md §8 `discord-roll.js` layout line + §7.6 plain-text bullet pointer (D3, D4). **Deferred for owner (UI-GUIDELINES is Tier-1 doc; no sign-off recorded):**
  - D1: `docs/UI-GUIDELINES.md` §8a (l.159-163): replace "plain-text messages are unchanged" with: "Every message in either format, including the test message, also uses the character's portrait as its Discord avatar, but only on the Pages site and only when a portrait exists; no placeholder is used as the avatar, so otherwise Discord shows the webhook's default icon. There is no Settings control for the thumbnail or the avatar, and the text of plain-text messages is unchanged."
  - D2: `docs/UI-GUIDELINES.md` §6 (l.90): "…used as the Discord embed thumbnail and, on the Pages site, as the Discord message avatar (§8a)."
- **Gate:** `npm test` 1222 pass, 0 fail. `dev` not behind `origin/dev`.

## Owner handoff
**PR checklist (results):**
- [x] No Tier-1 invariant changed (engine pure, URL handed down; nothing stored)
- [x] Overview viewport fit — N/A, no layout change
- [x] Placeholder pills — N/A, no derived values touched
- [x] Light/dark, modals — N/A, no UI markup change (only `ed-app.js` wiring)
- [x] No taxonomy change — N/A
- [x] No asset/fetch path changes

**Manual verification (Pages deploy needed; ed-app wiring has no unit tests):** see final report.
