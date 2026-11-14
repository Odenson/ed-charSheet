# Build log — embedded-die-roll

## Run 1 — 2026-11-14 (since 2026-11-14T09:39:49Z)

### Alignment
- All items (I1–I4) Tier 3; no Tier-1/2 change, no sign-off needed. Rules: 0 Earthdawn rules. `review.md` F1–F3 already answered in the plan.
- Unrelated uncommitted changes left unstaged: `.agents/feature-tester.claude.yml`, `.claude/agents/feature-tester.md`, `README.md`, `tools/token-report*`, `package-lock.json`, `.opencode/package-lock.json`.

### Build
- I2 `store-discord.js`: `normalizeFormat`, `format` in EMPTY/load/save.
- I1 `engine/discord-roll.js`: `formatRollEmbed`, `buildEmbedPayload`, `buildPayload`, format-aware `buildTestPayload`.
- I3 `ui/ed-settings.js` radio group; `ui/ed-app.js` uses `buildPayload` / format for test.
- I4 docs (UI-GUIDELINES §8a, ARCHITECTURE §7.6/§8) and changelog line.
- Tests: tester's `engine/discord-embed.test.js` and `store-discord.test.js` green and unmodified (verified against snapshot).
- Dev Lead review: no findings; no revision needed.

### Gate
`npm test`: 1179 pass, 3 fail — all pre-existing and unrelated (also fail at the commit with the working tree stashed):
- plans-status: `plans/custom-item-builder/plan.md` missing frontmatter.
- sync-agents ×2: `design-agent.md` missing frontmatter.
Owner approved pushing despite these.

### Doc sync (design-agent)
Applied: UI-GUIDELINES §8a closing paragraph (format wording); ARCHITECTURE §7.6 (plain-text bullet label, test-embed sentence) and §8 layout line; `engine/discord-roll.js` header comment; plan status `implemented` / `shipped: unreleased`. Deferred Tier-1/2 edits: none.

### GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (format is a device-local input; engine pure; dispatch-up kept)
- [ ] Overview fits viewport — owner to verify (Settings modal only; Overview not touched)
- [x] No derived values added; placeholder pills untouched
- [ ] Light/dark and modal Escape/Enter — owner to verify (uses `light-dark()`/`--accent`; form submit unchanged)
- [x] Taxonomy untouched (N/A)
- [x] No fetch/asset paths added

### Manual UI verification (owner)
See "UI test requirements" in the final report: Settings → Discord section, radio group placement, persistence per character, test button follows draft format, Escape discards, Enter saves, light/dark, mobile fold.
