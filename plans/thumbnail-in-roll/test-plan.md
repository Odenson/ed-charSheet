# Test Plan: Thumbnail in roll (thumbnail-in-roll)

## Test files
- engine/discord-thumbnail.test.js (new; thumbnail cases kept separate from the existing discord-embed.test.js so that file is untouched)
- store-thumbnail.test.js (new)

## Coverage
No Earthdawn rules are used (rules.md: 0 rules); every rule cite is n/a.

### engine/discord-thumbnail.test.js::*
- **Validates:** T1 - thumbnail.url on formatRollEmbed / buildEmbedPayload / buildPayload embed / buildTestPayload embed; trimmed; omitted for undefined, '', whitespace, null, number, object, array, boolean; no other embed field changes; plain payloads and webhook payload never contain it; a long URL does not alter the text content.
- **Rule:** n/a
- **Why:** Catches leaking the key into plain format, changed existing embeds, or budget miscounting.

### store-thumbnail.test.js::*
- **Validates:** T2/T3 - Pages+portrait -> raw portrait URL; Pages+no/blank/non-string portrait -> production no-image URL; local (localhost, 127.0.0.1, file:, non-github.io) -> production local-test URL, never `./`; no location -> null; both PNGs exist with PNG signature, 256x256 IHDR, < 100 KB; exported constants.
- **Rule:** n/a
- **Why:** Catches a second/incorrect local-vs-Pages detector, relative URLs Discord cannot fetch, missing or wrong assets.

## Not covered (and why)
- ed-app.js wiring (`_captureRollReport`, `_flushRollReport`, `_discordSendTest`, embed-only gating, captured portrait for a switched-away character): no DOM harness. Manually: in Embed format a real roll and the Settings test message carry a thumbnail; plain format has none; switching character before the report flushes uses the original portrait.
- Placeholder visuals ("LOCAL TEST" / "NO IMAGE") and production URLs resolving: check after first release to main.
- `npm test` import lint verifies the new store.js export is imported in ed-app.js.

## How to run
`npm test`
