# Feature: Thumbnail in roll (thumbnail-in-roll)

## Summary
Adds a thumbnail image to the Discord **embed** die report (shipped by `embedded-die-roll`). The thumbnail is chosen automatically, with no setting and no stored field: the character's portrait on the Pages site, a shipped "local test" placeholder on a local run, and a shipped "no-image" placeholder when a character on Pages has no portrait. Plain-text messages are unchanged.

## Goals / Non-goals
- Goal: embeds carry `thumbnail:{url}` automatically for every character in Embed format.
- Goal: on Pages, the URL is the public portrait URL the app already resolves (`portraitUrlFor` in `store.js`, `raw.githubusercontent.com` on the character-data branch).
- Goal: on a local run (no public URL) the thumbnail is a shipped "local test" image, served from the production Pages site (`https://odenson.github.io/ed-charSheet/`).
- Goal: on Pages, a character with no portrait gets a shipped "no-image" placeholder (same production base).
- Goal: two simple generated PNGs (~256 px, neutral square, short label) committed to the repo.
- Non-goal: any Settings control or stored field; a per-character image URL; images in plain-text messages; large image, author or footer icons; changing when messages are sent; changing the embed's other fields.
- Non-goal: the placeholders appearing on the Settings test message beyond what falls out of the shared builder (decide in the spec; default: the test embed gets the same thumbnail logic).

## Guardrail alignment
Touches `engine/discord-roll.js` (one optional embed key, pure and DOM-free), `ui/ed-app.js` (resolves the URL and passes it down; data down), two new static image assets, tests and docs (`docs/UI-GUIDELINES.md` §8a if needed, `ARCHITECTURE.md` §7.6, `data/changelog.json`). No character data, `rules/*.json`, taxonomy or schema change; nothing new is stored. The placeholder URLs are absolute because Discord must fetch them; they are not app fetch paths, so the relative-path rule (WORKFLOW.md) is unaffected. All tickets Tier 3; no Tier-1 sign-off required.

## Tickets
### T1 — Thumbnail in the pure embed builder
- **What:** `engine/discord-roll.js` accepts an optional `thumbnailUrl` for the embed payload (`buildPayload` / `buildEmbedPayload` / `buildTestPayload` embed variant) and emits `thumbnail:{url}` on the embed only when given a non-empty string. Plain payloads ignore it. No footer, no other image keys.
- **Why:** The URL is computed by the UI layer and handed down; the formatter stays pure.
- **Tier:** 3
- **Acceptance criteria:** Unit tests: embed includes `thumbnail.url` when provided; omitted for missing/empty/non-string; plain format never includes it; existing embed tests unchanged; the 6000-char budget is unaffected (a URL is not embed text).
- **Open questions:** none.

### T2 — Resolve the thumbnail URL (portrait / local test / no-image)
- **What:** In the UI layer (`ui/ed-app.js`, with a small helper where it fits), choose the URL: on Pages and a portrait present → `portraitUrlFor(meta.portrait)` (public); on Pages with no portrait → the "no-image" placeholder; on a local run → the "local test" placeholder. Placeholder URLs are `https://odenson.github.io/ed-charSheet/<path>`. Wire it to real sends (`_flushRollReport`) and the Settings test message (`_discordSendTest`).
- **Why:** Discord can only fetch public https images; local runs and portrait-less characters need a defined fallback.
- **Tier:** 3
- **Acceptance criteria:** Real sends and the test message pass the right URL in embed format; plain format sends no thumbnail; the local/Pages decision reuses the existing `onPages()` logic rather than a second detector; failure to resolve never blocks a send.
- **Open questions:** none.

### T3 — Placeholder images
- **What:** Generate and commit two small PNGs (~256 px, neutral square with a short label): "local test" and "no-image". Place them under the existing static-asset convention (decided in the spec) so they deploy with the Pages bundle.
- **Why:** The placeholders must be real public images Discord can load.
- **Tier:** 3
- **Acceptance criteria:** Both files exist, are PNGs well under Discord's size limits, and deploy to the production site path the URLs point at (visible after the first release to `main`).
- **Open questions:** none.

### T4 — Docs
- **What:** Update `ARCHITECTURE.md` §7.6 (thumbnail rules and the three cases), `docs/UI-GUIDELINES.md` §8a only if user-facing text changes, and `data/changelog.json` `unreleased.changes`.
- **Why:** Keep docs true to the code.
- **Tier:** 3
- **Acceptance criteria:** Docs describe the shipped behaviour; embed "no thumbnail" statements from `embedded-die-roll` are corrected; no contradiction with code.
- **Open questions:** none.
