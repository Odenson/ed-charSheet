# Plan Review: Discord die report (discord-die-report)

## Summary
The plan is well grounded: the cited lines and handlers in `ui/ed-app.js`, `ui/ed-roll-modal.js` and `engine/dice.js` exist, and the embedded day-reset roll does carry a `rollId`, so it fires `ed-roll-logged`. All items are Tier 3 and no rules are needed. There are 0 blockers, 2 major and 5 minor findings. They are mostly about gaps in the flush call-site list and the item dependency cycle.

## Findings
### F1 — I4 — Report must carry characterId and name captured at landing time
- **Severity:** major
- **Problem:** `_flushRollReport()` reads `loadDiscordConfig(this._characterId)` and the name at flush time. Several ending paths run while the character is changing. `ed-app.js` l.530 (character load) sets `_dayReset = null`, and nothing there flushes. A flush after a switch would send the roll to the wrong character's webhook or under the wrong name. The `ed-roll-logged` handler already guards on `_characterId`.
- **Fix:** Store `characterId` and `name` inside `_pendingReport` at capture, and have the flush use those values. Add the character-load path (l.530, and any other site that swaps `_character`) to the call-site list so it flushes before the swap. Add the same case to the manual checks.

### F2 — I4 — Embedded refused path and duplicate sends after a flush
- **Severity:** major
- **Problem:** The plan flushes on the `recovery-heal` "refused" return (l.345). For an embedded day-reset roll, that path sets `_roll = null` but does not clear `_dayReset.roll`, so the embedded modal stays open. The player can then toggle Karma, which re-logs the same `rollId`, and the interaction sends a second message. Clearing `_pendingReport` on flush stops a double-call but not a later landing for the same `rollId`.
- **Fix:** Keep a `_sentRollIds` set (or a last-sent `rollId`) and ignore a landing for an already-flushed `rollId`. Alternatively, do not flush on the refused path when `_dayReset?.roll` is still showing. State which in the plan, and add a manual check.

### F3 — I3/I4 — Circular dependency between items
- **Severity:** minor
- **Problem:** I3 depends on the I4 send helper for the test POST, while I4 depends on I3. The Sequencing section says the I4 pure helper ships with I1, but the item headers contradict this.
- **Fix:** Move the payload builder and POST helper into I1 (or a separate small item). Then I3 depends on I1 and I2, and I4 depends on I1 to I3.

### F4 — I4 — Pre-existing close paths not in the call-site list
- **Severity:** minor
- **Problem:** The list covers `_closeRoll` and the apply and day-reset paths. It omits the `pagehide` / `disconnectedCallback` flush, which is marked optional, and the l.530 reset above. The grep mitigation ("every `_roll = null` and `roll: null`") also misses ancillary assignments of `_dayReset`.
- **Fix:** Extend the grep to `_dayReset =` and `_roll =`. Decide on the `pagehide` flush now: either include it with `keepalive: true` or state that it is explicitly dropped.

### F5 — I1 — Formatter edge cases
- **Severity:** minor
- **Problem:**
  - The escape list omits the backslash, which is a Discord markdown escape character.
  - Discord rejects webhook usernames that contain "discord" or "clyde" (substring, case-insensitive). A character with such a name would fail every send. This is Discord behaviour, not an Earthdawn rule.
  - The aim `outcome.word` is long and goes into a bold run. It must be escaped and truncated safely.
- **Fix:** Add backslash to the escapes. Sanitise or substitute such usernames (for example, insert a zero-width space). Add tests for these cases.

### F6 — I3/I4 — Secret handling and error text
- **Severity:** minor
- **Problem:** The webhook URL is a secret. The plan does not say that it is excluded from toast and inline error text, from console logging, and from browser password-manager prompts. The masked field uses `type=password`.
- **Fix:** Map errors to fixed messages (for example, "HTTP 429", "Network error") that never contain the URL. Set `autocomplete="off"` on the field, with `name` and `autocapitalize` attributes that avoid password-manager capture.

### F7 — I3 — Settings detail shape change
- **Severity:** minor
- **Problem:** The `ed-settings` event detail grows to `{enabled, seconds, discord}`. The plan does not check that `_applySettings` and any other `ed-settings` listener tolerate a missing `discord`. It also does not say whether a character switch while the modal is open resets the draft.
- **Fix:** Note in I3 that `discord` is optional in the detail. Specify that the draft is reloaded when the modal opens. Cover the detail shape with a pure test if the validation or normalisation logic is extracted.

No `NEEDS_RULES` and no `NEEDS_HUMAN`.
