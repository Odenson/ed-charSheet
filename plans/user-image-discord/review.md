# Plan Review: User image on Discord messages (user-image-discord)

## Summary
The plan is sound. The cited files, lines and patterns match the code, the sequencing is valid, every ticket is covered, and all items are Tier 3 with no rules dependency. There are 2 minor findings and no blockers.

## Findings
### F1 — I1 — "Deliberate update" of the exact-shape test contradicts the no-change criterion
- **Severity:** minor
- **Problem:** I1 says to update the exact-shape test at `engine/discord-embed.test.js` l.179. Its own acceptance criteria say a payload without `avatarUrl` is deep-equal to today's output. That test calls the builder without an avatar, so it should pass unchanged.
- **Fix:** Leave the existing test as is, because it proves the key is omitted by default. Put the "with avatar" shape assertion in the new `discord-avatar.test.js`. Alternatively, say explicitly that the old test is extended with an avatar case.

### F2 — I2 — Test message path is not inside a try block
- **Severity:** minor
- **Problem:** I2 says to compute the avatar "inside the existing try". `_discordSendTest` (ed-app.js l.1738) has no try block, unlike `_flushRollReport`. `discordAvatarUrl` has its own try/catch, so the risk is covered. The wording is inaccurate for the test path.
- **Fix:** Note that `discordAvatarUrl` never throws, so no extra wrapper is needed in `_discordSendTest`. Also note that the `portraitUrlFor` result is not URL-encoded, which is the same as the thumbnail, so a portrait path with spaces would fail in both. State that this is out of scope.
