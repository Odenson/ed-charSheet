# Tech Spec: User image on Discord messages (user-image-discord)

## Overview
Add an optional top-level `avatar_url` to Discord webhook payloads (plain, embed, and Settings test message, both formats). The pure engine builders emit it only when handed a non-blank string. A new `store.js` helper `discordAvatarUrl(portrait)` resolves the character's public portrait URL (Pages only, portrait only, never throws), and `ui/ed-app.js` passes it down regardless of format. The embed thumbnail is untouched.

## Guardrail alignment
- All changes Tier 3 (qa-log Q1-Q3); no Tier-1 sign-off needed. No schema, `rules/*.json`, taxonomy or character-data change.
- Data down: the UI resolves the URL and passes it to the pure, DOM-free engine, which only emits what it is given. Nothing new is stored. No derived values/pills involved. URL is already absolute on Pages, so the relative-path rule is unaffected. No UI markup change (Settings modal Escape/Enter untouched; theme/viewport n/a).

## Design
### Data / types
None stored. New optional builder option `avatarUrl?: string` on `buildPayload`, `buildTestPayload` (and optionally `buildWebhookPayload`/`buildEmbedPayload` opts). New payload key `avatar_url: string` (trimmed), top-level only.

### Modules & functions
- `engine/discord-roll.js`
  - Add `withAvatar(payload, url)`: if `typeof url === 'string' && url.trim()` set `payload.avatar_url = url.trim()`; return payload. Mirrors `withThumbnail` (l.103).
  - `buildPayload(report, { name, format, thumbnailUrl, avatarUrl })`: wrap the result of both branches with `withAvatar(..., avatarUrl)` (plain branch currently receives only `{name}`, so wrap at the `buildPayload` level). Apply in exactly one place per path so the key is set once.
  - `buildTestPayload({ name, format, thumbnailUrl, avatarUrl })`: wrap both variants with `withAvatar`.
  - Do not modify `withThumbnail`, `formatRollEmbed`, `withMentions`. Never place the key inside an embed.
- `store.js` (beside `discordThumbnailUrl`, l.189), exported:
  `discordAvatarUrl(portrait)`: `try { if (!onPages()) return null; const p = typeof portrait === 'string' && portrait.trim() ? portrait : null; return portraitUrlFor(p); } catch { return null; }`
- `ui/ed-app.js`
  - l.3 import: add `discordAvatarUrl` (check `tools/check-imports.mjs`).
  - `_flushRollReport` (l.1715): inside the existing try compute `const avatarUrl = discordAvatarUrl(pending.portrait);` (all formats) and pass `avatarUrl` to `buildPayload`. Leave `thumbnailUrl` expression unchanged.
  - `_discordSendTest` (l.1738): `const avatarUrl = discordAvatarUrl(this._character?.meta?.portrait);` pass to `buildTestPayload`. No try needed (helper never throws).

### UI / behavior
No visible UI change in the app. In Discord, the poster icon becomes the portrait on Pages when a portrait exists; otherwise no `avatar_url` key and Discord shows the webhook default icon. Embed thumbnail behavior (placeholders) identical with/without avatar.

### Rules
None. No Earthdawn rules are involved (`rules.md`).

### Edge cases & invariants
- `avatar_url` omitted (`'avatar_url' in p === false`) for undefined, null, '', whitespace-only, and non-string (number, object) values.
- Value is trimmed.
- Payload without `avatarUrl` is deep-equal to today's output (existing exact-shape tests in `engine/discord-embed.test.js` l.179 and l.305-324 pass unchanged).
- `avatar_url` is top-level; embed object has no `avatar_url`; `allowed_mentions`, content and the 6000-char embed budget are unchanged.
- Plain path must not lose the key (buildPayload previously dropped opts for plain).
- Helper: Pages + portrait returns exactly `portraitUrlFor(portrait)` (same as thumbnail's portrait URL); Pages + null/undefined/''/whitespace returns null; non-Pages returns null even with a portrait; throwing `location` returns null.
- A resolve failure never blocks a send. Known, out of scope: `portraitUrlFor` does not URL-encode (same as thumbnail).

## Testability notes
- New `engine/discord-avatar.test.js` (node:test; pattern from `engine/discord-thumbnail.test.js`): plain/embed/test payloads with avatar (both formats), trimming, omission cases, embed has no avatar key, thumbnail identical with/without avatar, no-avatar output deep-equals prior shape.
- New `store-avatar.test.js` (stub `location` as in `store-thumbnail.test.js`): Pages/local, portrait/none/blank, throwing location.
- Run `npm test` and the import check.
- Manual (owner): `ed-app.js` wiring has no unit tests. Verify on a Pages deploy with Plain and Embed rolls and the Settings test message that the avatar shows; and on a local run that no avatar is set and sends still work.

## Changelog entry
Discord die reports now use your character's portrait as the message avatar (when a portrait is set).

## Out of scope
Placeholder images as avatars; any change to the embed thumbnail; Settings control, stored field or per-character avatar URL; new image assets; changing when messages are sent; URL-encoding portrait paths. Docs: update `ARCHITECTURE.md` §7.6 and the §8 layout lines for `store.js`/`discord-roll.js`; `docs/UI-GUIDELINES.md` §8a only if user-facing text changes (not expected).
