# Build log: embedded-die-roll
- I1 store-discord.js: normalizeFormat, format in load/save/EMPTY.
- I2 engine/discord-roll.js: formatRollEmbed, buildEmbedPayload, buildPayload, format-aware buildTestPayload.
- I3 ui/ed-settings.js radio group; ui/ed-app.js uses buildPayload / format for test.
- I4 docs (UI-GUIDELINES 8a, ARCHITECTURE 7.6) and changelog line.
- Gate: tester tests green. Full `npm test` has 3 unrelated failures (plans-status custom-item-builder frontmatter; sync-agents design-agent frontmatter) from pre-existing working-tree state.
