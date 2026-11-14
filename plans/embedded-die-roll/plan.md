---
status: implemented
shipped: unreleased
---
# Delivery Plan: Embedded die roll (embedded-die-roll)

## Context & learnings
The shipped `discord-die-report` feature posts one plain-text Discord message per finished roll, through a per-character webhook stored device-locally (`ed-discord:<id>`). The owner deferred the embed ("plain text to begin with; try an embed later"). This feature adds the embed as an **alternative** format:
- One message per roll, in the chosen format. Never both.
- The choice is per character, stored beside the webhook. It defaults to Plain text, so configs saved by the shipped feature behave unchanged.
- The approved layout:
  - Title `🎲 <label> — Step N · Total T`.
  - Description `vs Difficulty D — **word** ✅/❌` (aim: `vs <X> Defence D`).
  - Colour bar: green on success, red on failure, grey when there is no difficulty.
  - Fields: Dice, ✦ Karma, Bonus dice, Mods, each only when applicable.
  - No footer, no thumbnail.
- The Settings control is a two-option "Plain text / Embed" under the URL field and above the test button, shown only when a character is loaded. The test message follows the draft format.
- Non-goals: no change to when messages are sent (flush logic untouched), no extra fields, no device-wide setting.

## Discoveries
- `engine/discord-roll.js` is pure and DOM-free. Exports: `escapeDiscord`, `safeUsername`, `formatRollForDiscord`, `formatTestMessage`, `buildWebhookPayload`, `buildTestPayload`, `discordSendDecision`. Private helpers: `signed`, `chain`, `groupText`, `cap`. Constants: `LIMIT=2000`, `WORD_CAP=200`. `withMentions` adds `allowed_mentions:{parse:[]}`. It imports `isDiscordWebhookUrl` from `store-discord.js`. Embed text can reuse `groupText`, `chain`, `signed`, `cap` and the escaping.
- `store-discord.js`:
  - `EMPTY()` returns `{url:'', enabled:false}`.
  - `loadDiscordConfig` returns `{url, enabled}` and never throws.
  - `saveDiscordConfig(id, {url, enabled})` rejects a non-blank invalid URL, otherwise writes `{url, enabled}`.
  - `discordReady(cfg)` is unaffected by `format`.
  - Tests live in `store-discord.test.js` and `engine/discord-roll.test.js`.
- `ui/ed-settings.js`:
  - Draft state `_dUrl`, `_dEnabled`, `_dMasked`, loaded by `_loadDiscordDraft()`.
  - `willUpdate` reloads the draft only when `url` or `enabled` moved, or `characterId` changed. The `moved` check must also compare `format`, or a format-only change would not reload the draft.
  - `_sendTest` dispatches `ed-discord-test` with `{url}`.
  - `_save` builds `detail.discord = {url, enabled}`.
  - `_renderDiscord` has the markup. Styles are inline in `render()`, using `--fs-*` tokens, `light-dark()` and weights 400/500. The Escape listener and the form submit (Enter saves) are in place.
- `ui/ed-app.js`:
  - Imports at l.38-40 (`buildWebhookPayload`, `buildTestPayload`).
  - `_flushRollReport` (~l.1714) builds the payload from `loadDiscordConfig(pending.characterId)`. `cfg` is already read there, so `cfg.format` is available.
  - `_discordSendTest(url)` (~l.1736) is wired at l.289 via `e.detail?.url`.
  - `_applySettings` persists the whole `discord` object through `saveDiscordConfig`, so `format` flows through once the store accepts it.
  - The Settings mount passes `.discord=${loadDiscordConfig(...)}` (l.2069), so `format` arrives down automatically.
- Docs to update: `docs/UI-GUIDELINES.md` §8a (l.133ff), `ARCHITECTURE.md` §7.6 (l.484), and `data/changelog.json` `unreleased.changes` (already holds the Discord line; add one).
- Discord embed limits (Discord API, not Earthdawn): title 256, description 4096, field name 256, field value 1024, at most 25 fields, total embed text 6000, colour an integer.
- `README.md` was modified in the working tree by an unrelated change. Do not touch it unless a Discord mention needs a sync (check at build).

## Guardrail classification
All items are **Tier 3** (`tickets.md` Guardrail alignment):
- No character data, `rules/*.json`, taxonomy or schema change.
- `format` is an input in localStorage next to the existing webhook config.
- The engine stays pure. `ed-settings` dispatches up. `ed-app` persists and sends.
- The Settings modal keeps its Escape/Enter contract.
- No Tier-1 sign-off is needed and none is recorded. No Tier-2 ceremony.

## Rules dependencies
None. `rules.md` records 0 Earthdawn rules. Discord API limits are not Earthdawn rules. Test expected values are literals derived from fixture reports.

## Implementation items
### I1 — Pure embed formatter and format-aware payloads
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Add to `engine/discord-roll.js`:
  - `formatRollEmbed(report, {name})`.
  - `buildEmbedPayload(report, opts)`, returning `{username, embeds:[{title, description?, color, fields}], allowed_mentions:{parse:[]}}`.
  - A format-aware `buildTestPayload({name, format})`.
  - A single entry point, `buildPayload(report, {name, format})`: `'embed'` gives the embed, anything else gives plain.
  - Keep `buildWebhookPayload` and `formatRollForDiscord` as they are (plain, backward compatible).
- **Where:** `engine/discord-roll.js`, `engine/discord-roll.test.js`.
- **Approach:**
  - **Title:** `🎲 ${escapeDiscord(label)} — Step N · Total T`, capped to 256 with `cap`.
  - **Description:** built only when `difficulty != null` or `outcome` is present.
    - `vs Difficulty D`, or `vs <aim.vs ?? 'Mystic'> Defence D` for an aim roll.
    - Then ` — **word** ✅/❌`, with the word escaped and capped at `WORD_CAP`.
    - Omitted when neither is present.
    - Description is capped at 4096.
  - **Colour:** green `0x2ecc71` when `outcome.ok`, red `0xe74c3c` when `outcome` is present and not ok, grey `0x95a5a6` otherwise. Fixed integers. Pin the exact values in tests.
  - **Fields**, each pushed only when applicable:
    - `Dice`, `inline:false`: groups via `groupText` joined by ` · `, plus ` · Modifier +n`.
    - `✦ Karma`, `inline:true`: as the plain Karma line without its prefix, including `Karma total = n` when there are several groups.
    - `Bonus dice`, `inline:true`: `D{sides} [chain] · … = total`.
    - `Mods`, `inline:false`: `label +v · …`, with ` Step` on Step mods, labels escaped.
  - **Limits:** cap each field value at 1024 with `…`. Compute the total of title + description + field names + values. If it exceeds 6000, truncate the Dice value first, then the other fields, always keeping title and description. Make the cut rule deterministic so tests can pin it.
  - **No footer or thumbnail keys.**
  - **`allowed_mentions` and username:** `safeUsername`, as with plain.
  - **Test payload:** the embed variant is a small embed, e.g. title `✅ Test message`, description `Discord die reports are connected.`, grey or green colour. The plain variant is unchanged.
  - **Format fallback:** `buildPayload` and `buildTestPayload` normalise with `normalizeFormat` imported from `store-discord.js` (acyclic; the engine already imports from it). Unknown, missing or non-string gives plain.
  - **Signature compatibility:** `buildTestPayload({name})` with no format returns exactly today's plain payload.
  - **Missing fields:** the embed formatter mirrors the plain formatter's tolerance (`report = report ?? {}`). A missing `step` or `total` renders without a bogus `undefined`/`NaN` (omit that segment). Escape the label first, then cap (so the ZWSP sequence is never cut mid-way, and an escaped-empty label falls back to a default such as `Roll`). Title is never empty.
- **Dependencies:** I2 (`normalizeFormat`).
- **Acceptance criteria:** the `node --test` cases in T1 all pass:
  - Plain roll, exploding chains, Karma single and multiple, Bonus dice, result and Step mods.
  - Difficulty success, failure and none; aim roll; custom win/lose words.
  - Escaping and mentions in title, description and field values.
  - Truncation at 256 / 1024 / 6000 with title and description kept.
  - Username rules, `allowed_mentions`, colours, no footer/thumbnail keys.
  - Test embed and format fallback.
  - Empty or minimal report (`{}`, missing step/total/label).
  - `buildTestPayload({name})` equals today's output; `buildPayload` with a bad format gives plain.
  - The existing plain tests still pass unchanged.
- **Risks / unknowns:** Discord rejects an empty-string field value or name. Never emit a field (Dice, Karma, Bonus dice or Mods) with an empty value, and cap the truncated detail so it is never `''`. `@` mentions are neutralised by ZWSP, which also works inside embed text.

### I2 — `format` in the per-character store
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** `store-discord.js` stores and returns `{url, enabled, format}`.
- **Where:** `store-discord.js`, `store-discord.test.js`.
- **Approach:**
  - Add `const FORMATS = ['plain', 'embed']` and a `normalizeFormat(v)` that returns `'embed'` only for exactly `'embed'`, else `'plain'`. Export `normalizeFormat` so the formatter and settings can share it.
  - `EMPTY()` gains `format:'plain'`. `loadDiscordConfig` returns `format: normalizeFormat(raw.format)`.
  - `saveDiscordConfig` writes `{url, enabled, format: normalizeFormat(format)}`. The invalid-URL rejection is unchanged.
  - Avoid a circular import: `engine/discord-roll.js` already imports from `store-discord.js`, so `normalizeFormat` stays in the store and the engine imports it.
- **Dependencies:** none. I1 imports `normalizeFormat` from here (no local copy, to avoid drift), so do I2 first.
- **Acceptance criteria:**
  - Round-trip per character.
  - Old `{url, enabled}` entries load as `plain`.
  - Invalid, non-string or absent format degrades to `plain`.
  - No leak across characters; corrupt JSON gives the default with `format:'plain'`.
  - Behaviour of the existing store tests is unchanged apart from the added `format` key.
- **Risks / unknowns:** `store-discord.test.js` `deepEqual`s loaded configs against `{url, enabled}` in several places (EMPTY and lines ~81, 90, 91, 105, 111). Every such `deepEqual` on a loaded config is updated to include `format:'plain'`, a legitimate extension.

### I3 — Settings control and send wiring
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:**
  - Add a "Message format" two-option control (Plain text / Embed) to `ed-settings`.
  - Include `format` in the Save detail and in the test event.
  - `ed-app` builds the payload by format for real sends and for the test.
- **Where:** `ui/ed-settings.js`, `ui/ed-app.js` (~l.289, ~l.1722, ~l.1738, the imports at l.40).
- **Approach:**
  - **`ed-settings`:**
    - Draft `_dFormat` (state), set in `_loadDiscordDraft` from `normalizeFormat(this.discord?.format)`.
    - `willUpdate`'s `moved` also compares `format`.
    - Control: radio group (`role="radiogroup"`, native `<input type="radio" name="discord-format">` labels) or a segmented control, placed in `_renderDiscord` directly after the URL `<div>` and before `.eds-test`.
    - Styling: `--fs-*` tokens, `light-dark()` colours, weights 400/500, reusing the `--accent` / `--accent-bg` / `--border` vars.
    - Escape and Enter behave as today. A radio must not swallow Enter (form submit stays), and the control must not be a `type=submit`.
    - `_save` adds `format: this._dFormat` to `detail.discord`.
    - `_sendTest` event detail becomes `{url, format: this._dFormat}`.
  - **`ed-app`:**
    - Import `buildPayload` (or `buildEmbedPayload` and the others).
    - The event listener at l.289 passes `e.detail?.url` and `e.detail?.format` to `_discordSendTest(url, format)`. The test builds `buildTestPayload({name, format})`.
    - `_flushRollReport` calls `buildPayload(pending.report, {name: pending.name, format: cfg.format})`.
    - `_applySettings` needs no change, since the whole `discord` object is saved. Verify it.
    - Flush logic, call sites and `_sentRollIds` are untouched.
- **Dependencies:** I1, I2.
- **Acceptance criteria:**
  - Default shows Plain text selected.
  - The choice persists per character across reloads, and each character shows its own.
  - The test button sends in the draft (unsaved) format.
  - Exactly one message per roll, in the chosen format.
  - Escape and backdrop discard the draft format. Enter saves.
  - Light and dark themes and mobile layout fine.
  - Manual UI verification by the owner. Add a small pure test for the Save detail shape if the repo already has an `ed-settings` detail test; otherwise skip.
- **Risks / unknowns:**
  - A format-only change not reloading the draft (handled in `willUpdate`).
  - Radio keyboard behaviour inside the form (arrow keys must work and Enter must still save). Check it manually.
  - The "Send test message" button stays disabled for a blank or invalid URL, as before.

### I4 — Docs and changelog
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:**
  - `docs/UI-GUIDELINES.md` §8a: describe the Message format control, its placement, the default and the test behaviour.
  - `ARCHITECTURE.md` §7.6: the stored `format` field, the embed shape and the fallback.
  - `data/changelog.json` `unreleased.changes`: add one line, e.g. "Discord die reports can now be sent as a Discord embed instead of plain text, chosen per character in Settings."
  - Check whether `docs/AI-WORKFLOWS.md` or `README.md` mention the Discord format and sync them if so.
- **Where:** the files above.
- **Dependencies:** I1-I3 (write against the shipped behaviour).
- **Acceptance criteria:** the docs match the code and contradict nothing. `data/changelog.json` stays valid JSON. `npm test` (including the `check-imports` pretest) passes.
- **Risks / unknowns:** `tools/check-imports.mjs` must see any new exports resolve. Run it at build.

## Sequencing
1. **I2** and **I1** (independent, pure, unit-testable; either order). I2 is tiny, so do it first so I1 can import `normalizeFormat`.
2. **I3**: UI and wiring, after the engine and the store exist.
3. **I4**: docs last, against the shipped behaviour.

## Open questions
- Exact hex values of the colour bar (suggested green `0x2ecc71`, red `0xe74c3c`, grey `0x95a5a6`). The owner approved "green / red / grey" only. Not blocking: the tests pin whatever is chosen.
- Test-embed wording and colour (small embed). Not blocking.
- Radio group vs segmented control for the format choice. Not blocking. Either is "two-option" and must keep the keyboard and focus contract.

## Review responses
- **F1 (major):** fixed. I2 now requires updating every `deepEqual` on a loaded config to include `format:'plain'`; criterion reworded.
- **F2 (minor):** fixed. I1 states null-safe tolerance, escape-then-cap, a non-empty title fallback, the no-empty-value rule for all fields, and a minimal-report test.
- **F3 (minor):** fixed. I1 imports `normalizeFormat` from the store (decided), and adds the `buildTestPayload({name})` unchanged-output test.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
