# Test Plan: Embedded die roll (embedded-die-roll)

## Test files
- engine/discord-embed.test.js (new)
- store-discord.test.js (existing deepEquals extended with `format:'plain'`; new format cases)

## Coverage
rules.md records 0 rules, so Rule is n/a for every case. Limits and colours are Discord/design constants from spec.md.

### engine/discord-embed.test.js (T1)
- formatRollEmbed shape; plain roll title/Dice field/no description/grey; chains + modifier; Karma single and multiple; Bonus dice; Mods with Step tag; field order; empty karma/bonus/mods/groups omit fields.
- Description and colour: success (green), failure (red), difficulty only (grey), outcome only, aim roll with Mystic default, custom word and 200 cap.
- Escaping and mentions in title/description/fields; payload shape (no content/footer/thumbnail, allowed_mentions); username rules.
- Minimal reports ({}, null, undefined), missing step/total, blank label fallback to Roll.
- Limits: title 256, field 1024, description 4096, over-6000 truncation order (Dice, then Mods, Bonus and Karma untouched, title/description kept, deterministic), no-shrink under limit.
- buildPayload format selection and fallback; buildTestPayload embed variant; plain variant equals the existing payload exactly.

### store-discord.test.js (T2)
- normalizeFormat; per-character round trip; legacy entries load as plain; invalid/absent format coerced to plain on save and load; rejected save leaves stored format; discordReady ignores format; all existing loaded-config deepEquals updated for `format:'plain'`.

## Not covered (and why)
UI (T3) and docs (T4) have no test harness; owner checks by hand:
- Settings: "Message format" radio group (Plain text / Embed) sits under the URL field, above the test button, only with a character loaded; default Plain text.
- Arrow keys move the selection, Enter saves, Escape and backdrop discard the draft format.
- Format persists per character and switching characters shows each one's own.
- Test button sends in the unsaved draft format and stays disabled for blank/invalid URL.
- ed-app wiring (cfg.format in `_flushRollReport`, test event format): one message per roll in the chosen format.
- Light/dark and mobile fold; a real embed in Discord shows title, coloured bar, fields, no footer.

## How to run
`npm test`
