# Tech Spec: Discord die report (discord-die-report)

## Overview
A pure formatter (`engine/discord-roll.js`) turns a completed roll's `ed-roll-logged` detail plus its roll config into a plain-text Discord message. A device-local per-character store (`store-discord.js`) holds `{url, enabled}`. A tiny I/O helper (`discord-send.js`) POSTs to the webhook, and never throws. `ed-settings` gets a Discord section that dispatches up. `ed-app` captures the latest landing per roll interaction and flushes exactly one message when the interaction ends.

## Guardrail alignment
- All items are Tier 3 (plan "Guardrail classification"). No Tier-1 sign-off applies and none is recorded. No Tier-2 ceremony.
- No change to character data, `rules/*.json`, the taxonomy or any schema. Nothing derived is stored. Only the input `{url, enabled}` is stored, in localStorage `ed-discord:<characterId>`.
- The engine module is pure and DOM-free. The I/O sits in root `discord-send.js`, with `fetch` injected.
- `ed-settings` and `ed-roll-modal` only dispatch up. `ed-app` persists and sends. The view never does I/O: the test message goes up as the `ed-discord-test` event, and the result comes back down as the `.testResult` property.
- The Settings modal keeps its Escape-closes / Enter-saves contract, weights 400/500, `--fs-*` tokens and `light-dark()` theming. Overview viewport fit is untouched.
- The URL is a secret. It is never in character data, exports, the Roll Log, the GitHub save, toasts, inline text or console output.

## Design
### Data / types
- New localStorage key `ed-discord:<id>` holding `{url:string, enabled:boolean}`. Nothing else is added anywhere.
- Report object (assembled by `ed-app`, consumed by the formatter): `{label, step, dice, groups, modifier, karmaResult, bonusResult, mods, total, difficulty, outcome, aim}`.
  - `groups` is `[{label, die, rolls[], subtotal, exploded}]` (real `rollStep` shape, `engine/dice.js`).
  - `karmaResult` is `{step, dice, groups[], total}` or null/undefined.
  - `bonusResult` is `{dice:[{sides, rolls[]}], total}` or undefined (`rollDiceList` shape).
  - `mods` is `[{label, value, measure?}]`, with `measure:'step'` for Step mods.
  - `outcome` is `{word, ok}` or null.
  - `difficulty` is a number or null.
  - `aim` is `{vs}` or null. The vs-label is `` `${aim.vs ?? 'Mystic'} Defence` `` (same as `_aimVsLabel`).
- `ed-settings` event detail becomes `{enabled, seconds, discord?: {url, enabled}}`. `discord` is optional.

### Modules & functions
- **`engine/discord-roll.js`** (new, pure). Exports:
  - `formatRollForDiscord(report, {name}) -> {username, content}`.
  - `formatTestMessage({name}) -> {username, content}`.
  - `buildWebhookPayload(report, {name}) -> {username, content, allowed_mentions:{parse:[]}}`.
  - `buildTestPayload({name})`, same shape.
  - `discordSendDecision(cfg) -> {send:boolean, reason?:'disabled'|'blank'|'invalid'}`.
  - Helpers (exported for tests): `escapeDiscord`, `safeUsername`.
- **`discord-send.js`** (new, root). Exports `postWebhook(url, payload, fetchImpl = globalThis.fetch) -> Promise<{ok:true}|{ok:false,message}>`.
  - It POSTs `Content-Type: application/json` with `JSON.stringify(payload)`.
  - 2xx gives ok. Non-2xx gives `message:"HTTP <status>"`. A rejection or missing fetch gives `"Network error"`.
  - It never throws and never includes the URL in `message`. It does no `console` output.
- **`store-discord.js`** (new, root, beside `store-rolllog.js`). Exports `loadDiscordConfig(id)`, `saveDiscordConfig(id, {url, enabled})`, `clearDiscordConfig(id)`, `isDiscordWebhookUrl(url)` and `discordReady(cfg)`.
  - It copies the `store-rolllog.js` try/catch fail-open pattern. Corrupt JSON or blocked storage gives `{url:'', enabled:false}`.
  - `isDiscordWebhookUrl` regex is `^https://(?:(?:ptb|canary)\.)?(?:discord|discordapp)\.com/api/webhooks/\d+/[\w-]+(?:\?.*)?$`.
  - `saveDiscordConfig` returns `{ok:true}` or `{ok:false, error:'invalid-url'}` and does not write when the URL is non-empty and invalid. A blank URL is allowed. `enabled` is coerced to boolean.
  - `discordReady(cfg)` is `cfg.enabled && isDiscordWebhookUrl(cfg.url)`.
  - Whether `tools/check-imports.mjs` needs the new exports registered is to be checked at build. It will at least validate imports and exports.
- **`ui/ed-settings.js`** (change).
  - New props: `discord {url, enabled}`, `characterName`, `hasCharacter`, `testResult {state:'sending'|'ok'|'error', message}`.
  - The draft is reloaded from `.discord` on open and when `characterId` / `discord` changes.
  - Save detail is `{enabled, seconds, discord}`. `discord` is only included when `hasCharacter` is true.
  - It dispatches `ed-discord-test` with `{url}` (the draft URL).
- **`ui/ed-app.js`** (change).
  - Settings mount at ~l.1987 passes the new props. `_applySettings` (~l.1666) persists via `saveDiscordConfig(this._characterId, discord)` only when `discord` is present, and leaves stored config untouched otherwise.
  - New `@ed-discord-test` handler: sets `_discordTest={state:'sending'}`, runs `postWebhook` with `buildTestPayload`, then sets `ok` or `error` with the fixed message.
  - `ed-roll-logged` handler (~l.283): before the existing `if (!this._roll || ...) return`, capture the report.
    - Active config is `this._roll ?? this._dayReset?.roll`.
    - Skip if `rollId` is in `_sentRollIds`.
    - Set `_pendingReport = {rollId, report, characterId, name}`, using the character name from `this._character.meta.name`.
    - Roll Log behaviour is unchanged. The embedded roll is not newly logged.
  - `_flushRollReport()`:
    - Take and clear `_pendingReport` first, and add its `rollId` to `_sentRollIds`.
    - If `discordReady(loadDiscordConfig(pending.characterId))`, then fire-and-forget `postWebhook(url, buildWebhookPayload(report, {name}))`, inside try/catch.
    - On `{ok:false}`, set `_discordError`, an auto-clearing (~4s) `toast error` that shows only the fixed message. It reuses the existing `.toast.error` CSS.
  - Flush call sites, listed under UI / behavior.

### UI / behavior
- Settings "Discord" section is visible only when a character is loaded.
  - A webhook URL `<input>` (`type=password` once a URL is saved) with `autocomplete="off" autocapitalize="off" spellcheck="false" name="discord-hook"`.
  - An enabled `.eds-switch`.
  - A "Send test message" `type="button"`, disabled while the draft URL is invalid or a test is sending. The inline result is ✅/❌ plus the fixed message, with `role="status"`.
  - An invalid non-blank draft URL shows an inline message and blocks Save. Blank is allowed.
  - Enter submits the form (Save). Escape and backdrop close with no change. The body scrolls on small screens.
- Flush call sites (each after the final landing):
  - `_closeRoll()`.
  - `ed-roll-apply` branches: recovery-heal (refused and success), emergency-recovery-heal (both returns), and the fail-closed return. Flush after `_roll = null`.
  - Embedded `recovery-heal`, after it clears `_dayReset.roll`.
  - `_dayResetDismissRoll()`, `_dayResetCancel()` and `_dayResetFinalize()`.
  - The `ed-roll` handler, before `this._roll = config`, as a safety net.
  - `_loadCharacter` and any other site that swaps `_character`, before the swap. Build must grep for every `_roll =`, `_dayReset =`, `roll: null` and `_dayReset.roll`.
- `pagehide` / `disconnectedCallback` flush is explicitly dropped.
- A chooser cancelled before commit sends nothing, because no `ed-roll-logged` fired.
- Karma charging (`ed-edit-karma`) is untouched.
- Message layout. Lines are omitted when not applicable.
  - Header: `🎲 **label** — Step N (dice)`.
  - Dice line: each group as `D10 [10↦7] = 17`, joined by ` · `.
    - `[a↦b↦c]` is the explosion chain, and a single roll is `[3]`.
    - A nonzero `modifier` is appended as ` · Modifier +n`.
  - Karma line: `✦ Karma <dice> [..] = n`, with multiple Karma dice listed as multiple groups.
  - Bonus line: `Bonus dice` with each die's chain, `= n`.
  - Mods line: `Mods: label +v · …`, with Step mods marked `Step`.
  - Total line: `**Total N** vs Difficulty D — **word** ✅|❌`.
    - An aim roll uses `vs <aim.vs> Defence D`, with the escaped and capped (~200 chars, `…`) `outcome.word`.
    - With no difficulty and no outcome, only `**Total N**`.
- Wording is fine-tuned at build, but the tests pin the layout above.

### Rules
No Earthdawn rules (`rules.md`: 0 rules). The feature only reports values the app already computes. Test expected values are literals derived from the fixture reports, not from the rulebook.

| Item | Value | Source |
|---|---|---|
| Discord content limit | 2000 chars | Discord API, not Earthdawn |
| Discord username limit | 80 chars; may not contain "discord" or "clyde" (case-insensitive) | Discord API, not Earthdawn |

### Edge cases & invariants
- Escaping: escape `\` first, then `* _ ~ \` | > #` and a leading-line markdown marker.
  - Neutralise `@everyone`, `@here` and `<@…>` by inserting a zero-width space (U+200B). This applies to the label, mod labels, dice labels and `outcome.word`.
- Truncation: `content` is capped at 2000 chars. Cut the dice detail first. The bold Total line is kept, and `…` ends a truncated body.
- Username: trimmed to 80 chars. An empty or blank name falls back to `Character`. A U+200B is inserted inside any "discord" / "clyde" substring (case-insensitive) so Discord accepts it.
- `allowed_mentions: {parse: []}` is always present.
- `postWebhook` error text never contains the URL, and nothing logs it.
- A landing for an already-sent `rollId` is ignored. One message per interaction, carrying the final total.
- The character id and name are captured at landing time. A flush after a character switch uses those and never the new character's.
- `loadDiscordConfig` for one character never returns another's data. A disabled, blank or invalid config sends nothing.
- A send failure never affects the roll, the Roll Log or Karma.

## Testability notes
- `node --test`:
  - `engine/discord-roll.test.js`: every layout case above, escaping and mentions, truncation, username rules, payload builder, `discordSendDecision`.
  - `discord-send.test.js`: stub `fetch` for 2xx, 429, 404 and rejection, plus a URL-leak check.
  - `store-discord.test.js`: localStorage stub as in `store-rolllog.test.js`; round-trip, per-character isolation, invalid URL, corrupt JSON, missing storage.
  - A pure test for the `ed-settings` detail shape and URL draft validation. Extract any pending/dedupe logic as a pure helper if it simplifies testing.
  - `npm test` runs the `check-imports` pretest.
- Owner's manual verification (UI):
  - Settings section in light and dark themes and on mobile; Enter saves, Escape closes; the masked field is replaceable.
  - Test button ✅/❌.
  - Roll, toggle Karma, close: exactly one message with the final total.
  - Escape after a roll still sends it.
  - A cancelled chooser sends nothing; a disabled or blank config sends nothing.
  - Offline or bad URL gives a toast, and the roll and log are unchanged.
  - An embedded day-reset Recovery roll sends once. After the refused path, a Karma toggle sends no second message.
  - Knockdown sends once on close.
  - Switching character right after a roll sends to the original character's webhook only.

## Changelog entry
"Discord die reports: post each finished roll to a Discord channel through a per-character webhook, configured in Settings (stored only in this browser)."

## Out of scope
- Embed format, a webhook shared across characters, retry or queue, filtering which rolls send, and storing the URL in character data or the repo.
- `pagehide` keepalive flush.
- Logging embedded day-reset rolls to the Roll Log (flagged to the owner as an observation only).
- Docs updates (I5): `docs/UI-GUIDELINES.md`, `ARCHITECTURE.md`, `README.md` and `data/changelog.json`. These are written after I1 to I4 and are not part of the code spec.
