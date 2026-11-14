# Test Plan: User image on Discord messages (user-image-discord)

## Test files
- engine/discord-avatar.test.js
- store-avatar.test.js

## Coverage
### engine/discord-avatar.test.js (each per format: plain, embed)
- buildPayload: avatar_url present, trimmed, omitted for undefined/null/''/whitespace/number/object/array/boolean; with-avatar payload equals no-avatar payload plus the key. Rule: n/a. Catches the plain path dropping opts and the key leaking when blank.
- buildTestPayload: same present/trim/omit/unchanged-content cases. Rule: n/a.
- Embed object has no avatar_url; thumbnail, content, username, allowed_mentions identical with/without avatar; avatar does not alter embeds (6000 budget). Rule: n/a.
- Existing exact-shape tests in engine/discord-embed.test.js remain the no-avatar deep-equal guard (unchanged).

### store-avatar.test.js
- Pages + portrait equals the thumbnail's portrait URL; Pages + null/blank/non-string gives null; local hosts give null even with a portrait; missing or throwing location gives null. Rule: n/a.

## Not covered (and why)
- ui/ed-app.js wiring (_flushRollReport, _discordSendTest) has no harness. Owner: on a Pages deploy, send Plain and Embed rolls and the Settings test message with a portrait set; the poster icon should be the portrait. With no portrait, or on a local run, there is no avatar (Discord default icon), sends still work, and the embed thumbnail is unchanged.
- Docs and changelog (T3).

## How to run
`npm test`
