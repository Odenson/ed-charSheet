# Test Plan: Discord die report (discord-die-report)

## Test files
- engine/discord-roll.test.js
- discord-send.test.js
- store-discord.test.js

## Coverage
No Earthdawn rules apply (rules.md: 0 rules). Expected values are literals from fixtures.

### engine/discord-roll.test.js
- plain roll / exploding chains / modifier: header, dice line, `[10↦7]` chain, ` · Modifier +n` (I1/T1). Rule: n/a.
- Karma single and multiple dice, Bonus dice line, Mods line with Step tag: layout lines omitted when n/a.
- difficulty success/failure, custom words, aim roll `vs <vs> Defence D` (default Mystic), long aim word escaped and capped.
- escapeDiscord: markdown chars, backslash-first, leading `#`/`>`, `@everyone`/`@here`/`<@..>` get U+200B; applied to label, mod labels, outcome word.
- truncation to 2000 with Total line kept and `…`.
- safeUsername: trim, 80 cap, blank fallback `Character`, "discord"/"clyde" broken with ZWSP.
- formatTestMessage, buildWebhookPayload/buildTestPayload (`allowed_mentions:{parse:[]}`), discordSendDecision (disabled/blank/invalid).
- Why: pins the approved layout and the Discord-acceptance/safety invariants.

### discord-send.test.js
- 2xx ok with JSON POST; 429/404 give `HTTP <n>`; rejection and missing fetch give `Network error`; never throws; message never contains the URL; no console output.

### store-discord.test.js
- URL validator accept/reject (hosts, ptb/canary, query, lookalike hosts); discordReady; round trip under `ed-discord:<id>`; per-character isolation; invalid URL blocks write; blank allowed; enabled coerced; clear; corrupt JSON; blocked/missing storage; never touches the edits overlay.

## Not covered (and why)
UI has no browser harness. Owner verifies by hand:
- Settings Discord section: light/dark, mobile scroll, masked field replaceable, Enter saves, Escape closes without change, invalid URL shows inline message and blocks Save, Test button ✅/❌ inline and disabled while invalid/sending.
- ed-settings detail shape `{enabled, seconds, discord?}` (discord only when a character is loaded), and persistence per character across reload.
- ed-app flushing: roll + Karma toggle + close sends exactly one message with the final total; Escape after roll sends; cancelled chooser sends nothing; disabled/blank sends nothing; offline gives an error toast with roll/log unchanged; embedded day-reset Recovery sends once, no second after refused path; Knockdown sends once on close; character switch right after a roll sends to the original webhook only.

## How to run
`npm test`
