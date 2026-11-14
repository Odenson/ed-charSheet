# Tech Spec: Thumbnail in roll (thumbnail-in-roll)

## Overview
Add an optional `thumbnailUrl` input to the pure Discord embed builders in `engine/discord-roll.js`, emitted as `embed.thumbnail = {url}`. A new resolver `discordThumbnailUrl(portrait)` in `store.js` picks the URL (public portrait on Pages, a shipped "no-image" PNG on Pages without a portrait, a shipped "local test" PNG on a local run). `ui/ed-app.js` computes it and passes it down for embed format only. Two generated 256x256 PNGs ship in `data/`.

## Guardrail alignment
- All changes Tier 3 (plan classification confirmed): new optional key in a pure formatter, UI passes data down, static assets, tests, docs. No Tier-1 sign-off required.
- Engine stays pure/DOM-free (URL computed in `store.js`/UI, passed as data). Nothing stored; no schema, `rules/*.json`, taxonomy or Settings change. No new events or UI surface.
- Absolute placeholder URLs are Discord-fetched links, not app fetch paths; WORKFLOW.md relative-path rule unaffected.
- No Tier-1 item missed.

## Design
### Data / types
None stored. Constants in `store.js`: `PLACEHOLDER_BASE = 'https://odenson.github.io/ed-charSheet/'`, `LOCAL_TEST_IMAGE = 'data/discord-local-test.png'`, `NO_IMAGE_IMAGE = 'data/discord-no-image.png'` (exported so the test can locate the files). `_pendingReport` gains a transient `portrait` field (in-memory, not persisted).

### Modules & functions
1. `engine/discord-roll.js`
   - private `withThumbnail(embed, url)`: if `typeof url === 'string' && url.trim()` set `embed.thumbnail = { url: url.trim() }`; return embed. Set after existing construction (key order unchanged when absent).
   - `formatRollEmbed(report, { name, thumbnailUrl })`, `buildEmbedPayload` (opts pass-through already), `buildPayload(report, { name, format, thumbnailUrl })` (forward only on the embed branch), `buildTestPayload({ name, format, thumbnailUrl })` (embed variant only). Plain payloads and `buildWebhookPayload` ignore it.
   - The 6000 budget (`size()`) is not changed; the URL is not counted.
2. `store.js` (next to `portraitUrlFor`, ~line 177): `export function discordThumbnailUrl(portrait)`:
   - try { if `!onPages()` return `PLACEHOLDER_BASE + LOCAL_TEST_IMAGE`; normalise: non-string or blank/whitespace portrait is "no portrait"; `return portraitUrlFor(portrait) ?? PLACEHOLDER_BASE + NO_IMAGE_IMAGE` } catch { return null }.
   - Reuses existing `onPages()`; no second detector. Portrait is not URL-encoded (same as picker).
3. `ui/ed-app.js`
   - line 3 import: add `discordThumbnailUrl`.
   - `_captureRollReport` (~1693): add `portrait: this._character?.meta?.portrait ?? null` beside `name` (character may switch before flush; `meta` is the overlay-folded value, `store.js:1708/1713`).
   - `_flushRollReport` (~1722): inside the existing try, `const thumbnailUrl = cfg.format === 'embed' ? discordThumbnailUrl(pending.portrait) : undefined;` pass `{ name, format, thumbnailUrl }`.
   - `_discordSendTest` (~1738): same, using `this._character?.meta?.portrait`, passed to `buildTestPayload`.
4. `data/discord-local-test.png` ("LOCAL TEST") and `data/discord-no-image.png` ("NO IMAGE"): 256x256, neutral grey, high-contrast label, a few KB. Generated once by a dependency-free Node script (zlib + fixed 5x7 font); script is throwaway (scratchpad) unless the build log says otherwise. Confirm tracked with `git check-ignore`; do not place under `tools/` (excluded from deploy).
5. New test `store-thumbnail.test.js` and additions to `engine/discord-embed.test.js` (see Testability).

### UI / behavior
- No visible Settings change. Embed format real rolls and the Settings test message carry a thumbnail; plain format unchanged. No theme, modal or viewport impact.
- Cases: Pages + portrait -> raw.githubusercontent.com portrait URL; Pages + no portrait -> production `data/discord-no-image.png`; local (any portrait) -> production `data/discord-local-test.png`.
- Placeholders 404 on Discord until the first release to `main`; the message still posts (owner-accepted). `/dev/` on Pages is still `*.github.io`, so it sends portrait or no-image.
- Send failure/timing unchanged; resolution failure yields no thumbnail.

### Rules
No Earthdawn rules. `rules.md`: 0 rules.

| Rule | Value | rules.md id |
|---|---|---|
| none | n/a | n/a |

### Edge cases & invariants
- `thumbnailUrl` of undefined, `''`, whitespace, `null`, number, object -> no `thumbnail` key.
- Plain payloads (`buildPayload`/`buildTestPayload`/`buildWebhookPayload`) never contain `thumbnail`; deep-equal to current output.
- Existing embed outputs without a URL are deep-equal to before.
- Max-size report with thumbnail still within 6000 budget.
- Resolver: whitespace/non-string portrait -> no-image (on Pages); missing `location` -> `null`; local never returns a `./` relative URL.
- A report for a switched-away character uses its own captured portrait.

## Testability notes
- `engine/discord-embed.test.js` (node:test): thumbnail present for `formatRollEmbed`, `buildEmbedPayload`, `buildPayload` embed, `buildTestPayload` embed; absent for invalid inputs; plain paths unchanged; budget test.
- `store-thumbnail.test.js`: stub `globalThis.location` (restore after). Cases: Pages+portrait; Pages+null/''/whitespace/undefined/number/object -> no-image URL; http localhost, `file:`, non-github.io https, with and without portrait -> local-test URL; location undefined -> `null`. Also read both PNG files from `data/` using the exported constants: assert 8-byte PNG signature and IHDR width/height 256x256, size < 100 KB.
- `npm test` (runs `tools/check-imports.mjs`): new `store.js` export must be imported in `ed-app.js`.
- Manual owner verification (no DOM harness): local run, Embed format, a real roll and the Settings test message each show the "LOCAL TEST" thumbnail in Discord (after release to `main`); `_pendingReport.portrait` untested; production URLs checked after first release.

## Changelog entry
Discord Embed die reports now show a thumbnail: the character's portrait, or a placeholder image when there is none or on a local run.

(Also docs: `ARCHITECTURE.md` §7.6 - drop "no thumbnail", add the three-case rule, asset paths, embed-only, test message same logic, resolver in `store.js`; `docs/UI-GUIDELINES.md` §8a one clause only if user-facing, else unchanged.)

## Out of scope
Any Settings control or stored field; per-character image URL; thumbnails in plain-text messages; large image, author or footer icons; changing when messages send; changing other embed fields; encoding portrait paths; committing the generator script (default throwaway).
