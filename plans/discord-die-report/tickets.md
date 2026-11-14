# Feature: Discord die report (discord-die-report)

## Summary
When a roll finishes, post a formatted plain-text report of it to a Discord channel through a per-character webhook. The webhook URL and an on/off toggle are configured per character in Settings and stored device-locally (localStorage), never in character data. The message is posted under the character's name and carries every detail of the roll.

## Goals / Non-goals
- Goal: every roll (all roll surfaces) posts one message when the roll interaction is complete, i.e. after the roll modal's Karma / optional-mod / add-Karma-die steps have finished and the modal ends (close, Apply, or auto-resolve).
- Goal: Settings gets a per-character Discord section: webhook URL, enabled toggle, "Send test message" button with inline result.
- Goal: message sent as the character (webhook `username` override), body in the approved layout: bold label, Step + dice, each die's exploding chain, Karma dice, Bonus Dice, Mods, bold Total vs Difficulty with outcome.
- Goal: a failed send shows a brief toast and never affects the roll or the Roll Log.
- Non-goal: embed format (later iteration), one webhook shared across characters, retry/queue, filtering which rolls send, storing the URL in character data or the repo.

## Guardrail alignment
Touches `ui/ed-settings.js`, `ui/ed-app.js`, a new pure engine module, a new device-local store module, and docs. No character-data shape, `rules/*.json`, taxonomy, or schema change; the webhook config lives in localStorage like the existing roll log and autosave prefs. Data flows down, events flow up: `ed-settings` dispatches up, `ed-app` persists and sends; the formatter is pure and DOM-free. Modal contract preserved (Escape closes, Enter saves). All tickets Tier 3; no Tier-1 sign-off required.

## Tickets
### T1 — Pure roll-report formatter
- **What:** `formatRollForDiscord(roll, { name })` in a new DOM-free engine module (e.g. `engine/discord-roll.js`), returning `{ username, content }`. Layout (lines omitted when not applicable): `🎲 **<label>** — Step N (<dice>)`; dice line with each die's chain `D10 [10↦7] = 17 · D6 [3] = 3`; `✦ Karma <dice> [..] = n`; `Bonus <dice> [..] = n`; `Mods: <label ±v> · …` (Step mods tagged "Step"); `**Total N** vs Difficulty D — **<outcome word>** ✅/❌`; aim rolls name their defence. Escapes Discord markdown in labels; keeps content within Discord's 2000-char limit.
- **Why:** The report text is a pure function of the completed roll, so it is unit-testable and stays out of the UI.
- **Tier:** 3
- **Acceptance criteria:** Unit tests cover plain roll, exploding dice, Karma (single and multiple dice), Bonus Dice, mods (result and Step), difficulty success/failure, no-difficulty roll, aim roll, custom win/lose words, truncation to 2000 chars, markdown/mention escaping. `username` is the character name.
- **Open questions:** The Roll Log entry stores only a summary of the Karma die (`step/dice/total`), not its individual rolls — the planner must decide whether the formatter consumes the full `ed-roll-logged` event detail (which carries `karmaResult.groups`) rather than the persisted log entry.

### T2 — Per-character Discord config store
- **What:** A localStorage module (alongside `store-rolllog.js`), keyed by character id, holding `{ url, enabled }`; load / save / clear; validates the URL is a Discord webhook (`https://discord.com/api/webhooks/<id>/<token>`, also `discordapp.com`, `ptb.`/`canary.` hosts); tolerant of missing/blocked storage.
- **Why:** Keeps the secret URL out of character data, the repo and exports, consistent with the device-local roll log.
- **Tier:** 3
- **Acceptance criteria:** Round-trips per character; one character's config never leaks to another; invalid URLs rejected; corrupt JSON or unavailable storage degrades to "not configured"; the URL is never written to character data or the roll log. Unit tests.
- **Open questions:** none.

### T3 — Settings UI: Discord section
- **What:** In the Settings modal, a per-character "Discord" section (shown only when a character is loaded) with the webhook URL input (masked once saved), an enabled switch (same switch component as autosave), and a "Send test message" button that posts a short test message as the character and shows success or the error inline. Save dispatches `ed-settings` up with the Discord values; `ed-app` persists them via T2. Escape/backdrop closes without change; Enter saves; theme-aware; two font weights; type-scale tokens only.
- **Why:** The owner-approved place to configure the feature.
- **Tier:** 3 (stays within UI-GUIDELINES §3/§7; modal contract preserved)
- **Acceptance criteria:** URL + toggle persist per character across reloads; switching characters shows that character's own values; invalid URL blocks Save with an inline message; test button reports ✅/❌ inline and never throws; no layout break on mobile; light and dark both correct.
- **Open questions:** none.

### T4 — Send on roll completion
- **What:** `ed-app` tracks the latest landing of each roll interaction (the modal re-logs on every Karma / optional-mod toggle and add-die) and, when the interaction ends — modal close (Escape/✕/backdrop/OK), Apply-and-close, auto-resolved Knockdown/Recovery, and the embedded day-reset roll — sends one message via `fetch` POST to the character's webhook if enabled and configured. Sent with `username` = character name and `allowed_mentions: { parse: [] }`. No send for a roll cancelled before it committed (set-dice / aim choosers with no result) and no duplicate for one interaction. A failure shows a brief toast (existing toast mechanism) with no retry or queue; the roll and Roll Log are unaffected.
- **Why:** Delivers the feature: the report goes out only after Karma has been settled, never mid-roll.
- **Tier:** 3 (data-down/dispatch-up kept: the modal still only dispatches events; `ed-app` owns the send)
- **Acceptance criteria:** Tests (pure parts) plus manual checks: roll + toggle Karma + close ⇒ exactly one message with the final total; Escape after a roll still sends it; a chooser cancelled before rolling sends nothing; disabled or blank URL sends nothing; offline/invalid URL ⇒ toast, roll unchanged; Karma spend is charged exactly as before.
- **Open questions:** Exact hook points for each ending path (close, Apply, embedded roll, auto-resolve) — planner to map against `ui/ed-app.js`.

### T5 — Docs
- **What:** Document the feature: Settings contents and the device-local webhook storage (UI-GUIDELINES / ARCHITECTURE as appropriate), the message format, the privacy note (URL is a secret, stored only in this browser), and a changelog entry.
- **Why:** Keeps docs true to the code (CLAUDE.md source-of-truth rule).
- **Tier:** 3
- **Acceptance criteria:** Docs describe the shipped behavior; no doc contradicts the code.
- **Open questions:** none.
