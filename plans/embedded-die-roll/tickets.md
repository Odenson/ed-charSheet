# Feature: Embedded die roll (embedded-die-roll)

## Summary
Adds an alternative Discord message format to the shipped Discord die report (`discord-die-report`): a Discord embed instead of plain text. The format is chosen per character in Settings, stored device-locally next to the webhook URL, and defaults to Plain text. Exactly one message is sent per roll, in the chosen format, with the same details as the plain-text report.

## Goals / Non-goals
- Goal: per-character "Plain text / Embed" format choice, stored with the webhook config (`ed-discord:<id>`), default Plain text (existing saved configs keep working unchanged).
- Goal: embed shows the roll like the approved sketch, with the total in the title and no footer.
- Goal: the "Send test message" button follows the chosen format.
- Non-goal: sending both formats; a device-wide setting; per-roll-type colours beyond success / failure / none; thumbnail or avatar image; footer; embed fields beyond Dice, Karma, Bonus dice, Mods; any change to when messages are sent (flush logic is untouched).

## Guardrail alignment
Touches `engine/discord-roll.js`, `store-discord.js`, `ui/ed-settings.js`, `ui/ed-app.js` (pass-through only) and docs. No character-data, `rules/*.json`, taxonomy or schema change; the format is an input stored in localStorage with the existing webhook config. Engine stays pure and DOM-free; `ed-settings` dispatches up, `ed-app` persists and sends. Settings modal keeps Escape-closes / Enter-saves. All tickets Tier 3; no Tier-1 sign-off required.

## Tickets
### T1 — Pure embed formatter
- **What:** In `engine/discord-roll.js` add `formatRollEmbed(report, {name})` and `buildEmbedPayload`, producing `{username, embeds:[{title, description, color, fields}], allowed_mentions:{parse:[]}}`.
  - Title: `🎲 <label> — Step N · Total T`.
  - Description: `vs Difficulty D — **word** ✅/❌` (aim: `vs <X> Defence D`); omitted when there is no difficulty and no outcome.
  - Colour bar: green on success, red on failure, neutral grey when no difficulty.
  - Fields, each only when applicable: `Dice` (chains + modifier, full width), `✦ Karma` (inline), `Bonus dice` (inline), `Mods` (Step mods tagged, full width).
  - No footer, no thumbnail.
  - Reuse the existing escaping, mention neutralisation, username sanitising and outcome-word cap; respect Discord embed limits (title 256, field value 1024, total 6000) by truncating the dice detail first and keeping title and description.
  - A format-aware test payload (`buildTestPayload` takes the format; embed variant is a small embed).
  - A single entry point choosing the payload by format (`plain` default; unknown value falls back to plain).
- **Why:** The embed text is a pure function of the completed roll, so it is unit-testable and stays out of the UI.
- **Tier:** 3
- **Acceptance criteria:** Unit tests cover plain roll, exploding chains, Karma single and multiple, Bonus dice, result and Step mods, difficulty success / failure / none, aim roll, custom win/lose words, escaping and mentions, truncation at each embed limit, username rules, `allowed_mentions`, colours, test-embed, and format fallback.
- **Open questions:** none.

### T2 — Format in the per-character config store
- **What:** `store-discord.js` stores `{url, enabled, format}` with `format` in `'plain' | 'embed'`, default `'plain'` when missing, unknown or the stored config is older. `saveDiscordConfig` validates/coerces it; load never throws.
- **Why:** Keeps the format next to the webhook, device-local, and backward compatible with configs saved by the shipped feature.
- **Tier:** 3
- **Acceptance criteria:** Round-trips per character; old `{url, enabled}` entries load as `plain`; invalid values degrade to `plain`; no leak across characters; unit tests extended (the existing `store-discord.test.js` must keep passing).
- **Open questions:** none.

### T3 — Settings control and send wiring
- **What:** In the Discord section of `ed-settings`, a two-option "Message format: Plain text / Embed" control directly under the URL field and above the test button, only when a character is loaded. The Save detail gains `discord.format`. `ed-app` persists it, builds the payload by format for real sends (`_flushRollReport`) and the test message (`_discordSendTest`). Escape / backdrop closes unchanged; Enter saves; theme-aware; two font weights; type-scale tokens only.
- **Why:** The owner-approved place and behaviour for the choice.
- **Tier:** 3
- **Acceptance criteria:** Format persists per character across reloads; switching characters shows each one's own format; default Plain text; the test button follows the draft format; exactly one message per roll in the chosen format; light and dark and mobile fold correct. Manual UI verification.
- **Open questions:** none.

### T4 — Docs
- **What:** Update `docs/UI-GUIDELINES.md` §8a (format control), `ARCHITECTURE.md` §7.6 (stored `format`, embed shape) and `data/changelog.json` `unreleased.changes`.
- **Why:** Keep docs true to the code.
- **Tier:** 3
- **Acceptance criteria:** Docs describe the shipped behaviour; no contradiction with code.
- **Open questions:** none.
