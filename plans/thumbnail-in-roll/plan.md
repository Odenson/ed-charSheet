---
status: implemented
shipped: unreleased
---
# Delivery Plan: Thumbnail in roll (thumbnail-in-roll)

## Context & learnings
`embedded-die-roll` shipped a per-character Embed format for Discord die reports, deliberately with no thumbnail. The owner now wants an automatic thumbnail on the embed. Decisions from `qa-log.md`:
- Automatic: no Settings control, no stored field, no per-character URL.
- Pages (https `*.github.io`) + character has a portrait: the public portrait URL the app already resolves (`portraitUrlFor`, raw.githubusercontent.com on `character-data`).
- Local run (no public URL, even if a portrait exists): a shipped "local test" PNG.
- Pages + no portrait: a shipped "no-image" PNG (not the misleading "local test").
- Two generated ~256 px PNGs (neutral square, short label) committed to the repo and served from the PRODUCTION Pages base `https://odenson.github.io/ed-charSheet/` (so they only resolve after the first release to `main`; accepted by the owner).
- Plain-text messages are unchanged. Nothing else in the embed changes.

## Discoveries
- `engine/discord-roll.js`: `formatRollEmbed(report,{name})` returns `{username, embed}`; `buildEmbedPayload(report, opts)` wraps it into `{username, embeds:[embed], allowed_mentions}`; `buildPayload(report,{name,format})` dispatches (currently drops everything but `name` when calling the builders); `buildTestPayload({name,format})` builds the embed test message inline (title `✅ Test message`, green, `fields: []`). The 6000-char budget only sums title/description/field name+value, so a thumbnail URL does not affect it.
- `ui/ed-app.js` (imports `buildPayload, buildTestPayload` at line 40; `store.js` import at line 3): `_flushRollReport` (~1714) calls `buildPayload(pending.report, {name: pending.name, format: cfg.format})` inside a try/catch that must never affect the roll; `pending.characterId`/`name` captured in `_captureRollReport`. `_discordSendTest(url, format)` (~1736) calls `buildTestPayload({name, format})`. The portrait lives at `this._character.meta.portrait` (the model also exposes `portraitUrl` at `store.js:1713`, but that is the app-display URL, bundle-relative locally; do not use it for Discord). For `_flushRollReport` the character may have switched by flush time (flush occurs before swap at line 529, and a pending report is bound to `pending.characterId`), so capture the portrait path in `_captureRollReport` alongside `name` rather than reading `this._character` at flush.
- `store.js`: `onPages()` (line 142) is module-private; `portraitUrlFor(portrait)` (line 177) returns `null` for blank, raw CDN URL on Pages, `./<portrait>` locally. Existing `onPages()` must be reused (ticket: no second detector). `store.js` already hosts URL resolvers (`portraitUrlFor`, item-image resolver), so the new resolver belongs there.
- Static-asset convention: bundled rule images (item PNGs such as `data/spear.png`) live flat in `data/` and ship in the bundle. `.gitignore` ignores only `data/chakka.jpg`, `data/kolon.jpeg`, `data/characters/`, etc., so new `data/*.png` files are tracked. `.github/workflows/deploy-pages.yml` rsyncs `main` to the site root and `dev` to `/dev/`, excluding only `.git`, `.github`, `tools`, `node_modules`, `package*.json`, `*.xlsx`. So `data/<file>.png` on `main` is served at `https://odenson.github.io/ed-charSheet/data/<file>.png`. Do not put the PNGs under `tools/`.
- Pages includes the `/dev/` instance (still `*.github.io`), so dev builds send portrait or no-image thumbnails; the placeholders always point at the production base and 404 on Discord's side until the first release to `main` (a missing thumbnail simply does not render; the message still posts).
- Existing tests: `engine/discord-embed.test.js` (embed builders/test payload), `discord-send.test.js`, `store-discord.test.js`. `npm test` runs `tools/check-imports.mjs` first (new `store.js` export must be imported where used). `.claude`-style guardrail hook not relevant.
- Docs to touch: `ARCHITECTURE.md` §7.6 "Embed format" currently says "no `content`/footer/thumbnail" and the test-message sentence; `docs/UI-GUIDELINES.md` §8a (user-facing text unchanged, but the Embed radio/test-message description may merit one clause; optional); `data/changelog.json` `unreleased.changes`.
- Image generation: no image library in `package.json` (zero deps). PNGs must be produced without adding a runtime dependency; use a one-off script (kept outside the shipped bundle, e.g. scratch or a Node script using `zlib` to write a minimal PNG with a hand-rolled bitmap font), or a local tool at generation time. Only the PNGs are committed.

## Guardrail classification
- All items Tier 3 (new optional embed key in the pure formatter, UI passes data down, new static assets, tests, docs). No Tier-1 sign-off required or recorded.
- Tier-1 checks: engine stays pure/DOM-free (the URL is computed in UI/store layer and passed in as data); nothing derived is stored; no schema/`rules/*.json`/taxonomy change; no new UI surface. The absolute placeholder URLs are Discord-fetched links, not app fetch paths, so the relative-path rule (WORKFLOW.md) is unaffected.
- If implementation seems to need a Settings control or stored field, stop: that would be Tier 1 and is out of scope.

## Rules dependencies
None. `rules.md` records 0 Earthdawn rules; no NEEDS_RULES.

## Implementation items
### I1 — Thumbnail key in the pure embed builders
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Accept an optional `thumbnailUrl` and emit `embed.thumbnail = {url}` only when it is a non-empty string (after trim). Plain payloads ignore it.
- **Where:** `engine/discord-roll.js`: `formatRollEmbed(report,{name, thumbnailUrl})`, `buildEmbedPayload`, `buildPayload(report,{name, format, thumbnailUrl})` (forward it only on the embed branch), `buildTestPayload({name, format, thumbnailUrl})` (embed variant only). Add a tiny private `withThumbnail(embed, url)` helper.
- **Approach:** Set `embed.thumbnail` after the existing embed construction; no change to size accounting, no footer or other image keys. Keep key order stable so existing deep-equal tests still pass when no URL is supplied.
- **Dependencies:** none
- **Acceptance criteria:** Tests in `engine/discord-embed.test.js`: thumbnail present with the given URL for `formatRollEmbed`, `buildEmbedPayload`, `buildPayload` (embed) and `buildTestPayload` (embed); absent for undefined, `''`, whitespace, `null`, number, object; plain `buildPayload`/`buildTestPayload` and `buildWebhookPayload` never include it (payload deep-equal to current); all existing embed tests unchanged and green; a max-size report still stays within the 6000 budget with a thumbnail present.
- **Risks / unknowns:** none.

### I2 — Thumbnail URL resolver (portrait / local test / no-image)
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** One small function choosing the URL for a character.
- **Where:** `store.js`, next to `portraitUrlFor`: export `discordThumbnailUrl(portrait)` plus two exported/private constants `PLACEHOLDER_BASE = 'https://odenson.github.io/ed-charSheet/'`, `LOCAL_TEST_IMAGE = 'data/discord-local-test.png'`, `NO_IMAGE_IMAGE = 'data/discord-no-image.png'` (I2 owns the final names; I3 conforms).
- **Approach:** `if (!onPages()) return BASE + LOCAL_TEST;` then normalise the portrait: a non-string or whitespace-only value is treated as "no portrait" (never passed to `portraitUrlFor`, which only checks truthiness); `const url = portraitUrlFor(portrait); return url ?? BASE + NO_IMAGE;` Uses the existing `onPages()`, no second detector. Wrap in try/catch returning `null` on any throw (e.g. `location` undefined) so a failure yields no thumbnail rather than blocking a send. Pure of side effects.
- **Dependencies:** none (I2 defines the file names; I3 conforms).
- **Acceptance criteria:** New `store-thumbnail.test.js` (node:test, stubbing `globalThis.location`) covers: Pages + portrait -> raw.githubusercontent.com URL on the character-data branch; Pages + null/blank/whitespace/undefined/number/object portrait -> `.../data/discord-no-image.png`; non-Pages (http localhost, file://, non-github.io https) with and without portrait -> `.../data/discord-local-test.png` (never a `./` relative URL); missing `location` -> `null`.
- **Risks / unknowns:** Portrait paths with spaces or special characters: `portraitUrlFor` does not encode today; keep identical to the picker's behaviour and note it (a non-loading thumbnail is harmless). If the existing item-image resolver already exports a shared base, reuse; otherwise constants stay local.

### I3 — Generate and commit the two placeholder PNGs
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** `data/discord-local-test.png` (label "LOCAL TEST") and `data/discord-no-image.png` (label "NO IMAGE"): ~256x256, neutral grey square, short high-contrast label, a few KB each.
- **Where:** `data/` (flat, alongside bundled item images). Not tracked by `.gitignore`; confirm with `git check-ignore`.
- **Approach:** Generate once with a dependency-free Node script (zlib-based PNG writer plus a fixed 5x7 bitmap font, only the two label strings, kept deliberately small). Default: throwaway script in the scratchpad, and the build log records that it was throwaway; alternatively commit it under `tools/` (deploy excludes it). Test verifies PNG signature and IHDR width/height.
- **Dependencies:** none (file names are defined by I2; I3 conforms).
- **Acceptance criteria:** Both files exist, valid PNG (8-byte signature, IHDR ~256x256), well under 100 KB (Discord limit is far larger), visually legible when opened. A test (can live in `store-thumbnail.test.js`) asserts both files exist at the paths I2 uses and have a PNG signature and IHDR 256x256, so a rename cannot silently break the URL. Deployment visibility at the production URL is only confirmable after the first release to `main` (note in build log).
- **Risks / unknowns:** Images 404 on Discord until released to `main`; accepted by owner. Discord shows the embed without a thumbnail meanwhile.

### I4 — Wire the URL into real sends and the Settings test message
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Pass the resolved URL down in embed format only.
- **Where:** `ui/ed-app.js`: add `discordThumbnailUrl` to the `store.js` import (line 3); in `_captureRollReport` record `portrait: this._character?.meta?.portrait ?? null` on `_pendingReport` next to `name`; in `_flushRollReport` compute `thumbnailUrl` (only when `cfg.format === 'embed'`) and pass `{name, format, thumbnailUrl}` to `buildPayload`; in `_discordSendTest` do the same with the current character's portrait for `buildTestPayload`.
- **Approach:** Resolve inside the existing try/catch in `_flushRollReport`; helper already swallows errors, so a failed resolution means no thumbnail and the send proceeds. Plain format passes nothing (and the builders ignore it regardless). Test message follows the ticket default: same thumbnail logic as a real send. No new events, no Settings change, no stored field.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** Embed format real sends and test message carry the right `thumbnail.url` in the three cases (verified by running the app locally = local test image URL, and by unit tests of I1/I2 plus a code read; ed-app has no DOM unit harness, so add a small extracted pure helper only if one is cheap); plain sends and test have no thumbnail; the pending report for a character that was switched away still uses that character's portrait; `npm test` (including `lint:imports`) passes; send behaviour/timing unchanged.
- **Manual owner check:** on a local run with Embed format, a real roll and the Settings test message each show the "LOCAL TEST" thumbnail in Discord (once the image is reachable; see open questions). `_pendingReport.portrait` has no unit test (no DOM harness).
- **Risks / unknowns:** Confirmed: `store.js:1708` builds `meta: character.meta ?? {}` in the derived model and `portraitUrl` (line 1713) reads `character.meta?.portrait` from the same input, so `this._character.meta.portrait` is the overlay-folded value. No open risk.

### I5 — Docs and changelog
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** Make the docs true to the shipped behaviour.
- **Where:** `ARCHITECTURE.md` §7.6 (Embed format bullet: drop "no ... thumbnail"; add the three-case thumbnail rule, production-base placeholder paths in `data/`, local = placeholder even with a portrait, embed-only, not stored, test message uses the same logic, resolver in `store.js`, passed down as data); also §8 repo layout if it lists `data/` assets. `docs/UI-GUIDELINES.md` §8a: add one clause that an Embed carries a small image (portrait, or a placeholder) only if it reads as user-facing; otherwise leave unchanged and say so in the build log. `data/changelog.json` `unreleased.changes`: one line (e.g. "Discord Embed die reports now show a thumbnail: the character's portrait, or a placeholder image when there is none or on a local run.").
- **Approach:** Edit in place; grep the docs for other "no thumbnail" statements from `embedded-die-roll` (also `plans/embedded-die-roll` is historical and stays as-is).
- **Dependencies:** I1-I4.
- **Acceptance criteria:** No doc claims the embed has no thumbnail; docs match the code names and paths; changelog JSON stays valid (a changelog/release test exists in `tools/release.test.js`); `npm test` passes.
- **Risks / unknowns:** none.

## Sequencing
1. I1 (pure builder + tests): no dependencies, safest to land first.
2. I3 (PNGs): fixes the file names.
3. I2 (resolver + tests): needs the names from I3.
4. I4 (UI wiring): needs I1 and I2.
5. I5 (docs and changelog): last, written against the final code.
Run `npm test` after each item.

## Open questions
- Placeholder visibility: images resolve on the production site only after the first release to `main`; until then Discord shows no thumbnail for the two placeholder cases. Accepted by the owner; verify after release.
- Whether the generation script is committed (`tools/`) or throwaway: defaulted to throwaway; owner may say otherwise.

## Review responses
- F1 (I2 dependency wording, non-string portrait): fixed. I2 owns the file names, I3 conforms; dependency lines updated. Resolver treats non-string/whitespace portrait as no portrait; test cases added.
- F2 (I4 overlay-fold risk): fixed. Recorded as confirmed (`store.js:1708/1713`), removed from risks; manual owner check named.
- F3 (I3 scope): fixed. Fixed 5x7 font, two labels only; build log must state throwaway vs committed script; test checks IHDR width/height.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
