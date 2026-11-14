---
status: building
---
# Delivery Plan: Discord die report (discord-die-report)

## Context & learnings
When a roll interaction finishes, post one formatted plain-text report to a Discord channel through a per-character webhook. Decisions from `qa-log.md`:
- Send only after the roll is complete: the Karma / optional-mod / add-Karma-die steps in the roll modal must be finished first, so the message carries the final total.
- Plain text for now (embed is a later iteration). Per character, all rolls, no filtering.
- Webhook URL and an enabled toggle are stored in localStorage (device-local), never in character data, the repo, exports or the Roll Log. They are edited in Settings.
- Sender is the character name via the webhook `username` override. The body does not repeat the name.
- Settings has a "Send test message" button with an inline result.
- A failed real send shows a brief toast with no retry or queue. The roll and Roll Log are unaffected.
- The sample layout was approved; wording is fine-tuned during build.

## Discoveries
- `ui/ed-roll-modal.js` `_log()` (l.345) fires `ed-roll-logged` on every landing: initial roll, Karma toggle, optional-mod toggle, `_commit`, `_addDie`, `_commitAim`. The detail carries the full data the report needs:
  - `result` (groups, step, dice, modifier)
  - `karmaResult` (full `groups`)
  - `bonusResult` (full detail)
  - `total`, `mods` (Step mods tagged `measure:'step'`), `outcome` ({word, ok}), and `difficulty` (aim only)
  - **Decision for T1:** the formatter consumes this event detail merged with the roll config (label, step, difficulty, win/lose words, aim vs-label). It does NOT use the persisted Roll Log entry, which keeps only `karma {step,dice,total}` and `bonusResult {dice,total}`.
- `ui/ed-app.js` ed-roll-logged handler (l.283) upserts the Roll Log. It early-returns when `!this._roll`. An embedded day-reset roll lives in `this._dayReset.roll` (`ed-day-reset.js` l.131), not `this._roll`. So embedded rolls are probably not logged today, and the report must not rely on `this._roll` for them.
- Roll-ending paths in `ui/ed-app.js` (each is a hook point):
  1. `_closeRoll()` (l.1540, from the modal's `@close`: Escape / ✕ / backdrop / OK).
  2. The `ed-roll-apply` handler (l.334): `recovery-heal` (refused path l.345, success l.353), `emergency-recovery-heal` (l.368 and l.374), and `knockdown-result` (modal stays open; the roll ends later via `_closeRoll`).
  3. The embedded roll: `recovery-heal` sets `_dayReset.roll = null` (l.360); `_dayResetDismissRoll()` (l.899; Escape / ✕ / OK without apply); and `_dayResetCancel()` / `_dayResetFinalize()` (which null `_dayReset`).
  4. A new `ed-roll` replacing `_roll` (l.262) while one is pending.
  5. Auto-resolved Knockdown: the modal applies at roll time, but the modal stays open until closed, so path 1 covers it. Recovery/Knockdown "auto-resolve" in the ticket maps to these same close and apply paths.
- `ed-roll-modal` `_close()` dispatches `close`. In embedded mode the host (`ed-day-reset`) owns Escape and calls `_dismissRoll()`, which emits `roll-dismiss`.
- Toast mechanism: `_notice` / `_showNotice` renders a green `toast ok` (l.1103, l.2038). `_saveError` renders `toast error` (l.2029). There is no auto-clearing error toast, so T4 adds a small `_discordError` with a timer, reusing the `.toast.error` CSS.
- `ui/ed-settings.js`: light-DOM portal modal; props `enabled` / `seconds`; dispatches `ed-settings` `{enabled, seconds}`; Escape closes; the `<form>` submit saves (Enter); has the `.eds-switch` component. `ed-app._applySettings` (l.1666) persists; the modal is mounted at l.1986.
- Device-local store pattern: root `store-rolllog.js` (key `ed-rolllog:<id>`, try/catch fail-open). New store goes beside it as `store-discord.js`, with a test file like `store-rolllog.test.js`.
- Engine modules are pure and DOM-free, tested with `node --test` (e.g. `engine/roll-mods.js`). `tools/check-imports.mjs` runs as `pretest` and will validate new imports and exports. Existing `engine/dice.js` (`rollTotal`, etc.) may be reused for totals. The formatter takes the already-computed `total` and does not re-derive game values.
- The character name lives in `meta.name` (`ui/ed-overview.js` l.960). Locate the equivalent on `ed-app`'s `_model` / `_character` during build.
- Changelog source: `data/changelog.json` `unreleased.changes`.
- Asset and `fetch` paths must stay relative. The Discord URL is external and absolute by nature, which is fine; the relative-path rule applies to app assets only.
- Browser CORS: Discord webhooks accept cross-origin POST with `Content-Type: application/json`. Add `?wait=false` only if needed. No auth header is needed.

## Guardrail classification
All items Tier 3, matching `tickets.md` "Guardrail alignment":
- No character-data, `rules/*.json`, taxonomy or schema change.
- The new engine module is pure and DOM-free.
- `ed-settings` and `ed-roll-modal` only dispatch up; `ed-app` owns the persistence and the send.
- The Settings modal keeps its Escape-closes / Enter-saves contract, two font weights, type-scale tokens and light/dark theming.
- No Tier-1 sign-off is required and none is recorded.
- Overview viewport fit is untouched.
- Re-check before finishing: the Settings modal on mobile, and both themes.

## Rules dependencies
None. `rules.md` records no Earthdawn rules for this feature. It reports values the app already computes. No `NEEDS_RULES`.

## Implementation items

### I1 — Pure roll-report formatter
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** `formatRollForDiscord(roll, { name })` returns `{ username, content }`, and `formatTestMessage({ name })` returns the test message.
- **Where:** new `engine/discord-roll.js` and `engine/discord-roll.test.js`; new root `discord-send.js` and `discord-send.test.js` (check `tools/check-imports.mjs` accepts the new modules).
- **Approach:**
  - **Input shape:** a plain "report" object assembled by `ed-app` from the `ed-roll-logged` detail plus the roll config: `{label, step, dice, groups, modifier, karmaResult, bonusResult, mods, total, difficulty, outcome, aim: {vs} | null}`.
  - **Layout:** as in T1. Lines are omitted when not applicable.
    - Header: `🎲 **label** — Step N (dice)`.
    - Dice line: each group's chain `D10 [10↦7] = 17 · D6 [3] = 3`.
    - Karma line: `✦ Karma dice [..] = n`; multiple dice are listed as multiple groups.
    - Bonus line: `Bonus dice [..] = n`.
    - Mods line: `Mods: label ±v · …`, with Step mods tagged "Step".
    - Total line: `**Total N** vs Difficulty D — **word** ✅/❌`. An aim roll names its defence, e.g. `vs Mystic Defence 9`. A roll with no difficulty omits the vs part and the outcome.
  - **Exploding-chain shape:** inspect the `rollStep` result shape in `engine/dice.js` (`groups[].rolls` or similar) before fixing the exact chain format. Do not invent fields.
  - **Escaping:** escape Discord markdown (`\` backslash first, then `* _ ~ \` | > #`) and neutralise `@everyone` / `@here` / `<@…>` mentions in labels, mod labels and the aim `outcome.word` by inserting a zero-width space. The long aim `outcome.word` is escaped and capped (about 200 characters, ending `…`) before it goes into the bold run, so it cannot break the bold or push the Total line out.
  - **Truncation:** cap `content` at 2000 characters, preserving the bold Total line and ending with `…` if truncated. Cut the dice detail first.
  - **Username:** `username` is the name, trimmed to Discord's 80-character limit. An empty name falls back to "Character". Discord rejects webhook usernames containing "discord" or "clyde" (case-insensitive substring); sanitise by inserting a zero-width space inside the offending substring so every send is accepted. This is Discord behaviour, not an Earthdawn rule.
  - **Payload builder (moved here from I4):** pure `buildWebhookPayload(report, {name})` returns `{username, content, allowed_mentions:{parse:[]}}`, and pure `discordSendDecision(cfg)` returns send/skip (disabled, blank, invalid URL).
  - **POST helper (moved here from I4):** `postWebhook(url, payload, fetchImpl = fetch)` in new `discord-send.js` (root, beside the stores; only I/O, `fetch` injected so it is testable). It resolves `{ok:true}` or `{ok:false, message}` and never throws. `message` is always a fixed string ("HTTP 429", "HTTP 404", "Network error", ...) and never contains the URL; the URL is never logged to the console.
- **Dependencies:** none.
- **Acceptance criteria:** unit tests (`node --test`) for every case listed in T1:
  - plain roll
  - exploding dice
  - Karma single and multiple
  - Bonus Dice
  - result mods and Step mods
  - difficulty success and failure
  - no difficulty
  - aim roll
  - custom win/lose words
  - 2000-character truncation
  - markdown (including backslash) and mention escaping
  - long aim `outcome.word` escaped and capped
  - `username` equals the character name; names containing "discord" / "clyde" are sanitised; 80-char cap; empty fallback
  - payload builder (`allowed_mentions`) and send/skip decisions
  - `postWebhook` with a stub `fetch`: 2xx, 429, network rejection; error messages never contain the URL
- **Risks / unknowns:** chain format depends on the real group shape. The wording is fine-tuned during build (QA log).

### I2 — Per-character Discord config store
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** `store-discord.js` exports `loadDiscordConfig(id)`, `saveDiscordConfig(id, {url, enabled})`, `clearDiscordConfig(id)`, `isDiscordWebhookUrl(url)` and `discordReady(cfg)`.
- **Where:** new `store-discord.js` and `store-discord.test.js` at the repo root, beside `store-rolllog.js`. Key `ed-discord:<id>`.
- **Approach:**
  - Copy the `store-rolllog.js` try/catch fail-open pattern.
  - Corrupt JSON or blocked storage gives `{url:'', enabled:false}`.
  - Accepted URL pattern: `^https://(discord|discordapp)\.com/api/webhooks/\d+/[\w-]+$`, plus `ptb.` and `canary.` hosts. An optional trailing query string is tolerated.
  - `save` rejects an invalid non-empty URL (returns a result or throws a typed error that the caller maps to an inline message); a blank URL is allowed and means "not configured".
  - `discordReady` is true only when `enabled` and the URL is valid.
- **Dependencies:** none.
- **Acceptance criteria:**
  - Round-trips per character.
  - One character's config never leaks to another.
  - Invalid URLs are rejected; corrupt JSON and missing storage degrade to "not configured".
  - Nothing is written to character data or the roll log.
  - Unit tests with a localStorage stub, as in `store-rolllog.test.js`.
- **Risks / unknowns:** `tools/check-imports.mjs` may keep a list of "known store exports"; check whether the new store must be registered there.

### I3 — Settings UI: Discord section
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** `ed-settings` gets a "Discord" section (only when a character is loaded):
  - a webhook URL input, masked (`type=password`) once saved, with Show/Hide only if trivial. It carries `autocomplete="off"`, `autocapitalize="off"`, `spellcheck="false"` and a non-credential `name` (e.g. `discord-hook`) so password managers do not capture it;
  - an enabled switch reusing `.eds-switch`;
  - a "Send test message" button with an inline ✅/❌ result.
- **Where:** `ui/ed-settings.js` (new props `discord: {url, enabled}`, `characterName`, `hasCharacter`, and a `sendTest` callback prop); `ui/ed-app.js` (mount at l.1986 passes the values and `_applySettings`).
- **Approach:**
  - **Validation:** the draft URL is validated through the I2 `isDiscordWebhookUrl`. An invalid value blocks Save and shows an inline message. Blank is allowed.
  - **Save:** the `ed-settings` detail becomes `{enabled, seconds, discord: {url, enabled}}`. `discord` is optional in the detail: `_applySettings` and any other `ed-settings` listener (grep for them at build) must tolerate it missing and then leave the stored Discord config untouched. `ed-app._applySettings` persists via I2 for the current `_characterId`. The existing autosave behaviour is unchanged. Extract any URL-draft validation/normalisation into pure code (I2 `isDiscordWebhookUrl` or a small helper) and cover the detail shape with a pure test.
  - **Draft lifecycle:** the Discord draft is reloaded from the store each time the modal opens (and on a `characterId` change), so a character switch while open never leaves a stale draft.
  - **Secrets:** inline test results and errors use the fixed messages from `postWebhook` only; the URL never appears in any displayed text or log.
  - **Test button:** the data-down/dispatch-up rule means the view must not do I/O itself. Options:
    - (a) dispatch an `ed-discord-test` event up with `{url}`, and `ed-app` performs the POST and writes the result back down as a property (`testResult`), or
    - (b) pass an async `onTest` callback down.
    - The plan picks (a) as the consistent pattern: a `.testResult` property `{state:'sending'|'ok'|'error', message}`.
    - The button uses the draft URL (not necessarily saved) and is disabled while the URL is invalid or while sending.
  - **Behaviour:** Escape / backdrop close with no change. Enter (form submit) saves; the test button is `type="button"` so Enter does not trigger it. Theme tokens only (`light-dark()`, `--fs-*`), font weights 400/500 only, and the modal body scrolls on small screens (max-height) so mobile does not break.
- **Dependencies:** I1 (`postWebhook`, `formatTestMessage`), I2.
- **Acceptance criteria:**
  - URL and toggle persist per character across reloads.
  - Switching characters shows that character's own values.
  - An invalid URL blocks Save with an inline message.
  - The test button shows ✅/❌ inline and never throws.
  - No layout break on mobile; light and dark both correct.
  - Manual verification (UI); the pure parts are covered by I2 tests.
- **Risks / unknowns:** the Settings modal's visible "no character" state. Section is hidden when `_characterId` is null. The masked field must still let the user replace the URL. Check the `tools/settings.test.js` expectations (it tests `.claude/settings.json`, so it is unrelated).

### I4 — Send on roll completion
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:** `ed-app` records the latest landing per interaction and sends one message when the interaction ends.
- **Where:** `ui/ed-app.js` only; it uses the I1 payload builder, send decision and `postWebhook`.
- **Approach:**
  - **State:** `_pendingReport = { rollId, report, characterId, name }`, with `characterId` and `name` captured at landing time. `_flushRollReport()` uses these captured values (not `this._characterId` or the current name) for `loadDiscordConfig` and the username, so a flush during or after a character switch can never go to the wrong webhook or name.
  - **No duplicate sends:** `_sentRollIds` (a Set) records each flushed `rollId`. The `ed-roll-logged` capture ignores a landing whose `rollId` is already in the set, so a later Karma toggle on an already-flushed roll (e.g. an embedded modal left open after the refused path) cannot send a second message. The refused-path flush stays (the roll did land) and the dedupe set is the chosen fix.
    - The `ed-roll-logged` handler is extended. Before the existing `if (!this._roll …) return`, derive the active config as `this._roll ?? this._dayReset?.roll`.
    - It then sets `_pendingReport`, overwriting the same rollId on each landing, so there is one pending report per interaction.
    - It does not alter Roll Log behaviour.
    - If the embedded roll is currently unlogged by design, only the report capture is added; do not start logging it to the Roll Log (flag this to the owner as an observation).
  - **`_flushRollReport()`:**
    - If `_pendingReport` exists, take and clear it first and add its `rollId` to `_sentRollIds` (so a double-call can never duplicate).
    - Then, if `discordReady(loadDiscordConfig(pending.characterId))`, send via `postWebhook` with the I1 payload `{username, content, allowed_mentions:{parse:[]}}`.
    - Failures (`{ok:false, message}`) go to `_discordError`, a new auto-clearing `toast error` showing only the fixed message, never the URL; no `console` logging of the URL or request.
    - The send is fire-and-forget, never awaited by the roll flow, and wrapped in try/catch so it can never throw into the UI.
  - **Call sites for `_flushRollReport()`** (all after the final landing, so it carries the final total):
    - `_closeRoll()`.
    - The `ed-roll-apply` branches: after `_roll = null` for recovery-heal success, emergency-heal success, and the refused and fail-closed returns (if a roll landed, it still reports).
    - `_dayResetDismissRoll()`.
    - After the embedded `recovery-heal` clears `_dayReset.roll`.
    - `_dayResetCancel()` and `_dayResetFinalize()`.
    - The `ed-roll` handler, before `this._roll = config`, if a report is pending (a safety net).
    - **Character load / any site that swaps `_character`** (`ed-app.js` ~l.530, which also sets `_dayReset = null`): flush before the swap. Grep for every assignment that replaces the character at build.
    - **`pagehide` / `disconnectedCallback`: explicitly dropped.** No keepalive flush; tab close mid-roll loses the report (no queue by design).
  - **Cancelled chooser:** a set-dice or aim chooser closed before commit never fired `ed-roll-logged`, so there is no pending report and nothing is sent.
  - **Karma:** the spend dispatches (`ed-edit-karma`) are untouched, so Karma is charged exactly as before.
  - **Name:** the character name comes from the loaded character meta.
  - **Test message:** the I3 `ed-discord-test` handler reuses the same POST helper and reports back via `testResult`.
- **Dependencies:** I1, I2, I3.
- **Acceptance criteria:**
  - Pure tests for the payload builder and ready/skip decisions live in I1; I4 adds a pure test for the dedupe/pending logic if it is extracted.
  - Manual checks:
    - Switching character (load) right after a roll, before closing: the report goes to the original character's webhook under its name, or nothing if unconfigured; never to the new character's.
    - Embedded Recovery refused path, then toggling Karma in the still-open modal: no second message.
    - Roll, toggle Karma, close: exactly one message with the final total.
    - Escape after a roll still sends it.
    - A chooser cancelled before rolling sends nothing.
    - Disabled or blank URL sends nothing.
    - Offline or invalid URL: a toast, and the roll and Roll Log are unchanged.
    - Karma is charged exactly as before.
    - An embedded day-reset Recovery roll sends once.
    - Knockdown sends once when its modal is closed.
- **Risks / unknowns:**
  - Missing a path produces a silent no-send. Mitigate with the exhaustive call-site list above and a grep for every `_roll =`, `_dayReset =`, `roll: null` and `_dayReset.roll` assignment.
  - An interaction left open and then superseded is covered by the `ed-roll` safety flush.
  - Tab close mid-roll may lose the report (acceptable; no queue by design).
  - `ed-combat` and `ed-spells` listen to the same event on `document`; no change there.

### I5 — Docs and changelog
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 3
- **What:** document the shipped behaviour.
- **Where:**
  - `docs/UI-GUIDELINES.md`: the Settings contents (Discord section) and its modal behaviour.
  - `ARCHITECTURE.md`: new `engine/discord-roll.js`, new `store-discord.js` in the file tree, and the device-local storage note.
  - The message format and the privacy note (the webhook URL is a secret, stored only in this browser, never exported or saved to GitHub).
  - `data/changelog.json` `unreleased.changes` entry.
  - `README.md` if it lists features or settings.
- **Approach:** write the docs after I1 to I4 are done so they describe what was built.
- **Dependencies:** I1 to I4.
- **Acceptance criteria:** docs describe the shipped behaviour, with no contradiction with the code. `npm test` passes, including the `check-imports` pretest.
- **Risks / unknowns:** none.

## Sequencing
1. **I1** and **I2** first. Both are pure or isolated and independently testable, and the other items build on them.
2. The payload builder, send decision and `postWebhook` are part of I1, so I3 and I4 both depend only on I1/I2 (no cycle).
3. **I3** next: Settings UI plus the `ed-app` wiring and the test-message POST. It is the first place the webhook can be exercised manually, which de-risks CORS and payload early.
4. **I4**: the roll-completion hooks, the riskiest part (many ending paths), built once the send path is proven by the test button.
5. **I5** last.

## Open questions
- Non-blocking: the embedded day-reset roll may not currently reach the Roll Log (the handler needs `_roll`). The plan captures it for Discord without changing the log. The owner may want the log fixed separately.
- Non-blocking: aim roll outcome text. The modal's `word` includes the armed-bonus summary ("Aim hit — 2 successes, +4 steps to Attack"). Use it as-is in the report; tune the wording at build.

## Review responses
- **F1 (major):** fixed. `_pendingReport` carries `characterId` and `name`; character-load path flushes before the swap; manual check added (I4).
- **F2 (major):** fixed. `_sentRollIds` dedupe chosen over skipping the refused-path flush; manual check added (I4).
- **F3 (minor):** fixed. Payload builder, send decision and `postWebhook` moved into I1; I3 depends on I1/I2, I4 on I1-I3; Sequencing updated.
- **F4 (minor):** fixed. Grep extended to `_roll =` / `_dayReset =`; `pagehide` flush explicitly dropped; character-load site added.
- **F5 (minor):** fixed. Backslash escaped, "discord"/"clyde" usernames sanitised, aim `outcome.word` escaped and capped, tests added (I1).
- **F6 (minor):** fixed. Fixed error messages that never contain the URL, no console logging, `autocomplete="off"` and non-credential field attributes (I1, I3, I4).
- **F7 (minor):** fixed. `discord` optional in the `ed-settings` detail, draft reloaded on open / character change, pure test for detail shape (I3).

## Q&A log reference
See `qa-log.md` for the full interrogation record.
