# Feature: User image on Discord messages (user-image-discord)

## Summary
Adds the character's portrait as the Discord webhook **avatar** (`avatar_url`) on every die-roll message, in both Embed and Plain formats and on the Settings test message. Today the message poster's icon is Discord's default; with this feature it matches the thumbnail image already shown in the embed. Follow-up to `thumbnail-in-roll`.

## Goals / Non-goals
- Goal: every roll report (embed and plain) carries `avatar_url` = the character's public portrait URL when one exists.
- Goal: the Settings test message carries the same avatar.
- Goal: no avatar key at all when there is no portrait or on a local run (Discord shows the webhook's default icon).
- Non-goal: placeholder images as avatars (portrait only; Q2).
- Non-goal: any change to the embed thumbnail (stays exactly as shipped, placeholders included).
- Non-goal: a Settings control, stored field, or per-character avatar URL; new image assets; changing when messages are sent.

## Guardrail alignment
Touches `store.js` (a small URL helper beside `discordThumbnailUrl`), `engine/discord-roll.js` (one optional top-level payload key; pure, DOM-free), `ui/ed-app.js` (resolves the URL and passes it down; data down), tests, and docs (`ARCHITECTURE.md` §7.6, `docs/UI-GUIDELINES.md` §8a only if user-facing text changes, `data/changelog.json`). No character data, `rules/*.json`, taxonomy or schema change; nothing new is stored. The portrait URL is the existing absolute `raw.githubusercontent.com` URL Discord must fetch, so the relative-path rule (WORKFLOW.md) is unaffected. All tickets Tier 3; no Tier-1 sign-off required (qa-log Q1–Q3).

## Tickets
### T1 — Avatar in the pure payload builders
- **What:** `engine/discord-roll.js` accepts an optional `avatarUrl` and emits top-level `avatar_url` on the payload only when it is a non-empty string (trimmed). Applies to `buildPayload` for both formats (`buildWebhookPayload`, `buildEmbedPayload`) and to `buildTestPayload` (both variants). Never added inside the embed object; the embed's thumbnail handling is unchanged.
- **Why:** The URL is computed by the UI layer and handed down; the formatter stays pure.
- **Tier:** 3
- **Acceptance criteria:** Unit tests: `avatar_url` present on plain, embed and test payloads when given; omitted for missing/empty/whitespace/non-string; embed and plain content unchanged; the existing exact-shape test (`payload shape: username, one embed…`) updated deliberately; 6000-char embed budget unaffected.
- **Open questions:** none.

### T2 — Resolve the avatar URL (portrait only)
- **What:** Add a small helper in `store.js` (e.g. `discordAvatarUrl(portrait)`) returning the public portrait URL on Pages when the character has a portrait, else `null` (local run, no portrait, or any failure). Reuse `onPages()` and `portraitUrlFor`; no second detector. In `ui/ed-app.js`, pass it as `avatarUrl` to real sends (`_flushRollReport`) and the Settings test message (`_discordSendTest`), for both formats.
- **Why:** Discord can only fetch public https images; locally the portrait resolves to a relative path Discord cannot load, so no avatar is sent.
- **Tier:** 3
- **Acceptance criteria:** On Pages with a portrait: all sends and the test message include `avatar_url` equal to the thumbnail's portrait URL. On Pages without a portrait, and on local runs: no `avatar_url`. Failure to resolve never blocks a send. Unit tests for the helper (Pages/local, portrait/none, blank string).
- **Open questions:** none.

### T3 — Docs
- **What:** Update `ARCHITECTURE.md` §7.6 (avatar rules: portrait only, both formats, omitted when absent), `docs/UI-GUIDELINES.md` §8a only if user-facing text changes, and `data/changelog.json` `unreleased.changes`.
- **Why:** Keep docs true to the code; correct any "no avatar" / default-icon statements.
- **Tier:** 3
- **Acceptance criteria:** Docs describe the shipped behaviour with no contradiction with code.
- **Open questions:** none.
