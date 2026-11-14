---
status: implemented
shipped: v1.34.0
---
# Delivery Plan: User image on Discord messages (user-image-discord)

## Context & learnings
Die-roll reports and the Settings test message are posted to a Discord webhook. Today the poster's icon is Discord's default. The owner wants the character's portrait as the webhook `avatar_url` on every message, in both Plain and Embed formats and on the test message (qa-log Q1, Q3). Portrait only (Q2): no placeholder images as avatars, and no `avatar_url` key when there is no portrait or on a local run (Discord then shows the webhook's default icon). The embed thumbnail is untouched (placeholders included). No Settings control, stored field or new asset. Follow-up to `thumbnail-in-roll`.

## Discoveries
- `engine/discord-roll.js` is pure. `withMentions(m)` (l.93) rebuilds `{username, content, allowed_mentions}`. `buildWebhookPayload` (l.95), `buildEmbedPayload` (l.174), `buildPayload(report, {name, format, thumbnailUrl})` (l.180) and `buildTestPayload({name, format, thumbnailUrl})` (l.184) are the entry points. `buildPayload` passes only `{name}` to the plain builder, so the plain path needs `avatarUrl` plumbed explicitly. `withThumbnail` (l.103) is the trim/non-empty-string pattern to mirror.
- `store.js`: `onPages()` (l.142, private), `portraitUrlFor(portrait)` (l.177: absolute raw.githubusercontent URL on Pages, `./<portrait>` locally), `discordThumbnailUrl` (l.189, try/catch, returns null on error). The new helper sits beside it and reuses both.
- `ui/ed-app.js`: `_flushRollReport` (l.1715) computes `thumbnailUrl` only when `cfg.format === 'embed'`, using `pending.portrait`. `_discordSendTest(url, format)` (l.1738) does the same with `this._character?.meta?.portrait`. The avatar must be computed regardless of format. The import on l.3 needs the new helper.
- Tests: `engine/discord-thumbnail.test.js` (payload thumbnail tests; the pattern to follow), `engine/discord-embed.test.js` l.179 (`payload shape: username, one embed…` exact-shape test) and l.305-324 (test payload shape), `engine/discord-roll.test.js` l.295, `store-thumbnail.test.js` (how `onPages()` is stubbed via location; reuse its approach).
- Docs: `ARCHITECTURE.md` §7.6 (l.503-521) describes the embed thumbnail and the repo-layout line for `discord-roll.js` (l.575) and `store.js` (l.533). `docs/UI-GUIDELINES.md` has no avatar/default-icon statement (grep found none), so no change unless user-facing text changes. `data/changelog.json` `unreleased.changes`.
- Local run: `portraitUrlFor` yields a relative path Discord cannot fetch, so the helper must return null when `!onPages()`.
- Check `tools/check-imports.mjs` for the `store.js` import list when adding the import to `ed-app.js`.

## Guardrail classification
- Whole plan Tier 3 (qa-log Q1-Q3; no Tier-1 sign-off needed). Engine stays pure and DOM-free with the URL handed down (data down). No character data, `rules/*.json`, taxonomy, schema or UI-guideline change; nothing new is stored. The URL is already absolute on Pages, so the relative-path rule is unaffected.
- I1 touches `engine/*` and I2 touches the UI file: run the guardrail pre-flight; both stay Tier 3.

## Rules dependencies
None. `rules.md` confirms no Earthdawn rules are involved.

## Implementation items
### I1 — Avatar in the pure payload builders
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** `engine/discord-roll.js` accepts optional `avatarUrl` and emits top-level `avatar_url` (trimmed) only when it is a non-empty string, on plain, embed and test payloads (both variants).
- **Where:** `engine/discord-roll.js`; tests in new `engine/discord-avatar.test.js` (including the "with avatar" shape assertions). The existing exact-shape test in `engine/discord-embed.test.js` l.179 is left unchanged: it calls the builder without an avatar and so proves the key is omitted by default.
- **Approach:** Add a tiny `withAvatar(payload, url)` helper (mirrors `withThumbnail`) that sets `payload.avatar_url` on the top-level object and returns it. Apply it in `buildPayload` (both branches; pass `avatarUrl` through to the builders or wrap the result there), in `buildTestPayload` (both variants), and optionally in `buildWebhookPayload`/`buildEmbedPayload` via `opts.avatarUrl` so direct callers also get it. Choose one place per path so the key is never set twice. Never add it inside the embed. Do not touch `withThumbnail` or `formatRollEmbed`.
- **Dependencies:** none.
- **Acceptance criteria:** `avatar_url` present on plain, embed and test payloads (both formats) when given, with the value trimmed. Omitted for missing, empty, whitespace-only and non-string values (including `'avatar_url' in p === false`). Embed and plain content and `allowed_mentions` unchanged. A payload without `avatarUrl` is deep-equal to today's output. 6000-char embed budget unaffected (avatar is outside the embed). The embed thumbnail behaves identically with and without an avatar. Existing tests pass.
- **Risks / unknowns:** `buildPayload` currently drops opts for the plain path; make sure the key is not lost there.

### I2 — Resolve the avatar URL and pass it down
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Add `discordAvatarUrl(portrait)` in `store.js`: returns `portraitUrlFor(portrait)` when `onPages()` and the portrait is a non-blank string, else `null`; wrapped in try/catch returning null. Pass it as `avatarUrl` in `_flushRollReport` and `_discordSendTest`, for both formats.
- **Where:** `store.js` (beside `discordThumbnailUrl`, export it); `ui/ed-app.js` l.3 import, l.1723-1724, l.1740-1741; new `store-avatar.test.js` modelled on `store-thumbnail.test.js`.
- **Approach:** Helper: `try { if (!onPages()) return null; const p = typeof portrait === 'string' && portrait.trim() ? portrait : null; return portraitUrlFor(p); } catch { return null; }`. In `ed-app.js` compute `avatarUrl = discordAvatarUrl(pending.portrait)` (in `_flushRollReport` this sits inside the existing try; `_discordSendTest` has no try block, and none is needed because `discordAvatarUrl` has its own try/catch and never throws) and pass it alongside `thumbnailUrl`. Leave the `thumbnailUrl` expression unchanged. Same for the test message using `this._character?.meta?.portrait`.
- **Dependencies:** I1.
- **Acceptance criteria:** Helper tests: Pages plus portrait returns the same URL as `portraitUrlFor` (and equals the thumbnail's portrait URL); Pages with null, undefined, empty or whitespace portrait returns null; local run returns null even with a portrait; a throwing `location` returns null. In the app, on Pages with a portrait every real send and the test message carry `avatar_url` in both formats; no key without a portrait or locally. Settings-modal behaviours (Escape, Enter) untouched. `npm test` and the import check pass.
- **Risks / unknowns:** `ed-app.js` has no unit tests for the wiring, so verify manually: a Pages run with Plain and Embed, and a local run. The `pending.portrait` capture at roll time is existing behaviour and is reused as is.

### I3 — Docs and changelog
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Update `ARCHITECTURE.md` §7.6: new bullet on `avatar_url` (portrait only, both formats incl. the test message, top-level key, omitted with no portrait or on a local run, thumbnail unchanged, engine only emits the passed URL, `discordAvatarUrl` in `store.js`). Update the §8 layout lines for `store.js` and `discord-roll.js`. Add an entry to `data/changelog.json` `unreleased.changes`. Update `docs/UI-GUIDELINES.md` §8a only if user-facing text changed (not expected).
- **Where:** `ARCHITECTURE.md`, `data/changelog.json`.
- **Approach:** Follow the existing changelog entry format. Grep docs for "default icon"/"avatar" to catch contradictions.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** Docs match the shipped behaviour with no contradiction; the changelog JSON stays valid and any changelog test passes.
- **Risks / unknowns:** none.

## Sequencing
I1 (pure builders, testable alone) then I2 (needs the engine option) then I3 (documents the final behaviour). Run `npm test` after I2.

## Open questions
None blocking. Manual Pages check of the avatar in a real Discord channel happens after release to a Pages deploy.

## Review responses
- **F1 (I1 exact-shape test contradiction):** fixed. The l.179 test stays unchanged; "with avatar" assertions go in the new `discord-avatar.test.js`.
- **F2 (I2 test path not in a try):** fixed. Wording corrected: `discordAvatarUrl` never throws, so `_discordSendTest` needs no wrapper. Also noted: `portraitUrlFor` does not URL-encode, same as the existing thumbnail, so a portrait path with spaces would fail for both. Out of scope for this feature.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
