# Plan Review: Embedded die roll (embedded-die-roll)

## Summary
The plan is sound. It is Tier 3 throughout, it needs no rules, and its code references match the real files. There are 3 findings, none blocking: 1 major and 2 minor.

## Findings
### F1 — I2 — Existing store tests need updating, not just the empty case
- **Severity:** major
- **Problem:** I2 says "existing store tests still pass" and only flags the empty-config `deepEqual`. `store-discord.test.js` lines 81, 90, 91, 105 and 111 also `deepEqual` loaded configs against `{url, enabled}`. They fail once load returns `format:'plain'`. The two statements conflict.
- **Fix:** Say that every `deepEqual` on a loaded config (not only `EMPTY`) is updated to include `format:'plain'`. Reword the criterion to "behaviour is unchanged apart from the added `format` key".

### F2 — I1 — Embed title and description when report fields are missing
- **Severity:** minor
- **Problem:** The plain formatter tolerates missing report fields. The plan does not say how `Step N · Total T` renders for a missing `step` or `total`. It also does not say how a label that is empty after escaping is handled. A cap at 256 could cut the ZWSP sequence from `escapeDiscord` mid-way. Discord rejects an empty title only when the title key is present.
- **Fix:** State that the embed formatter mirrors the plain formatter's tolerance (a null-safe `report ?? {}`). Add a test for an empty or minimal report. Compute the cap after escaping. Add `Karma` and `Mods` to the "never emit an empty value" rule, not only the truncated Dice field.

### F3 — I1/I3 — Signature compatibility of `buildTestPayload`
- **Severity:** minor
- **Problem:** `buildTestPayload(opts)` is currently called with `{name}`. The plan makes it format-aware and adds `buildPayload`. The existing plain tests must keep passing, so `buildTestPayload({name})` with no format must return the unchanged plain payload. `format` must also be normalised on the engine side. The plan leaves open whether the engine imports `normalizeFormat` or keeps a local copy ("or keep its own local equivalent"). A local copy risks drift, and the import is acyclic.
- **Fix:** Decide on one approach. Import `normalizeFormat` from `store-discord.js`, since `engine/discord-roll.js` already imports from it. Add a test that `buildTestPayload({name})` equals today's output.
