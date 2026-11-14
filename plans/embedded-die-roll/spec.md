# Tech Spec: Embedded die roll (embedded-die-roll)

## Overview
Add a per-character "Plain text / Embed" format for the Discord die report. `store-discord.js` gains a `format` input (`'plain'|'embed'`, default plain) and an exported `normalizeFormat`. `engine/discord-roll.js` gains a pure embed formatter, `buildEmbedPayload`, a format-aware `buildTestPayload`, and a single entry point `buildPayload`. `ed-settings` adds a radio-group control and dispatches `format` up. `ed-app` builds the payload by format for real sends and for the test. One message per roll, flush logic untouched.

## Guardrail alignment
All Tier 3 (no character data, `rules/*.json`, taxonomy or schema change; no Tier-1 sign-off needed). `format` is an input in device-local localStorage (`ed-discord:<id>`), stored beside the webhook. Engine stays pure and DOM-free; it imports only `normalizeFormat` and `isDiscordWebhookUrl` from `store-discord.js` (acyclic, as today). `ed-settings` dispatches up and `ed-app` persists and sends. The UI computes no game values. There are no derived-value pills involved. The Settings modal keeps Escape-closes / Enter-saves. No Tier-1 item missed.

## Design
### Data / types
- Stored config becomes `{url: string, enabled: boolean, format: 'plain'|'embed'}`. Old entries load as `plain`. Nothing derived is stored.
- Embed payload: `{username, embeds:[{title, description?, color:int, fields:[{name, value, inline}]}], allowed_mentions:{parse:[]}}`. No `content`, `footer` or `thumbnail` keys.
- Pinned colours (integers): success `0x2ecc71` (3066993), failure `0xe74c3c` (15158332), none/grey `0x95a5a6` (9807270).

### Modules & functions
- `store-discord.js` (do first)
  - `export function normalizeFormat(v)` returns `'embed'` only when `v === 'embed'`, else `'plain'`.
  - `EMPTY()` becomes `{url:'', enabled:false, format:'plain'}`.
  - `loadDiscordConfig` returns `{url, enabled, format: normalizeFormat(raw.format)}`.
  - `saveDiscordConfig(id, {url, enabled, format})` writes `{url, enabled, format: normalizeFormat(format)}`. The invalid-URL rejection is unchanged. `discordReady` is unchanged.
- `engine/discord-roll.js`
  - Add `import { isDiscordWebhookUrl, normalizeFormat } from '../store-discord.js'`.
  - `export function formatRollEmbed(report, {name} = {})` returns `{username: safeUsername(name), embed}`. It uses `r = report ?? {}`.
    - Title: `🎲 ${label} — Step ${step} · Total ${total}`. `label = escapeDiscord(r.label)`; if that is blank after trim, use `Roll`. Escape first, then `cap(…,256)`.
    - Omit the ` — Step N` segment when `r.step` is null or undefined, and the ` · Total T` segment when `r.total` is null or undefined. Join the remaining segments sensibly. No `undefined` or `NaN` text. The title is never empty.
    - Description: present only if `r.difficulty != null || r.outcome`. It is built as `vs ${vs} ${difficulty}` when difficulty is set, where `vs` is `Difficulty`, or `${escapeDiscord(aim.vs ?? 'Mystic')} Defence` for an aim roll. If an outcome is present, append ` — **${escapeDiscord(cap(String(word ?? ''),200))}** ✅|❌`. With an outcome but no difficulty, the description is just `**word** ✅|❌`. Cap at 4096.
    - Colour: `outcome` present and `ok` gives green. `outcome` present and not ok gives red. Anything else gives grey.
    - Fields, each pushed only when its value is non-empty. Reuse `groupText`, `chain` and `signed`.
      - `{name:'Dice', value: groups.map(groupText).join(' · ') + ' · Modifier +n', inline:false}`. The modifier part is present only when `r.modifier` is truthy.
      - `{name:'✦ Karma', value: 'groups' or 'groups · Karma total = N' when >1 group, inline:true}`.
      - `{name:'Bonus dice', value:'D8 [3↦5] · … = total', inline:true}`.
      - `{name:'Mods', value:'label +v · … ' with ' Step' suffix when measure==='step', labels escaped, inline:false}`.
    - Limits: cap each value at 1024 using `cap` (`…`). Then compute the total length of title + description + every field name + every value. If it exceeds 6000, shrink in this fixed order: Dice, then Mods, then Bonus dice, then Karma. Each field is truncated by the overflow amount with `cap`, to a minimum of 1 char, which is `…`. A value is never `''`. The title and description are never cut (beyond their own caps).
  - `export function buildEmbedPayload(report, opts)` returns `{username, embeds:[embed], allowed_mentions:{parse:[]}}`.
  - `export function buildPayload(report, {name, format} = {})` returns `buildEmbedPayload` when `normalizeFormat(format) === 'embed'`, else `buildWebhookPayload(report, {name})`.
  - `export function buildTestPayload({name, format} = {})`: embed gives `{username, embeds:[{title:'✅ Test message', description:'Discord die reports are connected.', color:0x2ecc71, fields:[]}], allowed_mentions:{parse:[]}}`. Plain (or missing or bad format) gives today's exact payload.
  - `formatRollForDiscord`, `formatTestMessage`, `buildWebhookPayload` and `discordSendDecision` are unchanged.
- `ui/ed-settings.js`
  - Import `normalizeFormat`. Add the `_dFormat: {state:true}` property.
  - Set `this._dFormat = normalizeFormat(this.discord?.format)` in `_loadDiscordDraft`.
  - `willUpdate`'s `moved` also compares `prev?.format !== this.discord?.format`.
  - `_sendTest` detail becomes `{url, format: this._dFormat}`.
  - `_save` sets `detail.discord = {url, enabled, format: this._dFormat}`.
  - `_renderDiscord` adds the control between the URL `<div>` and `.eds-test`.
- `ui/ed-app.js`
  - Replace the `buildWebhookPayload`/`buildTestPayload` imports (l.~38-40) with `buildPayload, buildTestPayload`. Check `tools/check-imports.mjs`; drop `buildWebhookPayload` only if it is unused there.
  - `_flushRollReport` uses `buildPayload(pending.report, {name: pending.name, format: cfg.format})`.
  - The test listener (l.~289) passes `e.detail?.url` and `e.detail?.format`. `_discordSendTest(url, format)` uses `buildTestPayload({name, format})`.
  - `_applySettings` is unchanged (the whole `discord` object goes to `saveDiscordConfig`). Verify it only.

### UI / behavior
- Decision: a **radio group** (not a segmented control).
- Markup: `<div class="eds-fmt" role="radiogroup" aria-label="Discord message format">`. It has a lbl "Message format" and two `<label>`s each wrapping `<input type="radio" name="discord-format" value="plain|embed" .checked=${this._dFormat===…} @change=${…}>`. The labels read "Plain text" and "Embed". Native arrow-key navigation is kept.
- Styling: `--fs-body` / `--fs-small` tokens only, weights 400/500, `--border`, `--accent` and `--muted` vars (all `light-dark()` already). The group wraps on the 26rem modal and on mobile. Radios use `accent-color: var(--accent)`.
- Not a submit control. Enter keeps submitting the form, which saves. Escape and backdrop discard the draft.
- Shown only when `hasCharacter` (inside `_renderDiscord`). Default is Plain text selected. Switching characters reloads the draft via `characterId`.
- The test button sends in the draft format and stays disabled for a blank or invalid URL.
- Overview viewport fit is not affected (modal only).

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| None. No Earthdawn rule is implemented. | n/a | rules.md records 0 rules |

The Discord embed limits (title 256, description 4096, field value 1024, total 6000) and the colour integers above are Discord API/design constants, not Earthdawn rules. Tests use literals derived from fixture reports.

### Edge cases & invariants
- Exactly one message per roll. Never both formats.
- `buildTestPayload({name})` is deep-equal to today's output. A bad, missing or non-string format gives plain.
- Neither `footer` nor `thumbnail` keys appear. No field has an empty `name` or `value`.
- `@everyone`, `@here` and `<@` are ZWSP-neutralised in the title, description and fields. `allowed_mentions.parse` is `[]`.
- Username rules are as for plain (`safeUsername`).
- `{}`, null and undefined reports give a valid embed (title `🎲 Roll`, grey, no description, no fields).
- Over-limit rolls keep the title and description, and the truncation order is deterministic as above.
- Store: corrupt JSON gives `EMPTY()` with `format:'plain'`. There is no leak across characters. Invalid-URL save is rejected unwritten.

## Testability notes
- `engine/discord-roll.test.js` (node:test): the T1 acceptance list. Pin the colour integers, the title and description strings, the field order and `inline` flags, the truncation cases (a 1024 field, and >6000 total with the Dice-first order), the test embed, and `buildPayload` fallback. Existing plain tests stay unchanged.
- `store-discord.test.js`: update every `deepEqual` on a loaded config (EMPTY and the ~81/90/91/105/111 cases) to include `format:'plain'`. Add round-trip, legacy-entry, invalid-format and per-character-isolation cases for `format`.
- Manual (owner): radio keyboard and focus (arrows work, Enter saves, Escape discards), light and dark themes, mobile fold, per-character persistence, test button in the draft format, a real embed in Discord.

## Changelog entry
Discord die reports can now be sent as a Discord embed instead of plain text, chosen per character in Settings.

(Also update docs: `docs/UI-GUIDELINES.md` §8a and `ARCHITECTURE.md` §7.6. Check `README.md` and `docs/AI-WORKFLOWS.md` for Discord mentions.)

## Out of scope
Sending both formats; a device-wide setting; colours beyond success/failure/none; thumbnail, avatar or footer; fields beyond Dice, Karma, Bonus dice and Mods; any change to when messages are sent (flush logic); Strain or step-dice fields.
