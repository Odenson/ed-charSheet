# Build log — discord-die-report

## Run 1 — 2026-11-14 (since 2026-11-14T09:06:58Z)

### Phase 0 — Alignment
- Guardrails: I1–I5 all Tier 3; no Tier-1/2 item, no sign-off needed.
- Rules coverage: `rules.md` records no Earthdawn rules (0 rules); no `NEEDS_RULES`.
- Open questions: none blocking (two non-blocking observations in plan.md: embedded day-reset roll not in Roll Log; aim outcome wording tuned at build). `review.md` F1–F7 all answered in plan.
- Clean tree: unrelated uncommitted changes present and must NOT be staged:
  `.agents/feature-tester.claude.yml`, `.claude/agents/feature-tester.md`, `README.md`,
  `tools/token-report.mjs`, `tools/token-report.test.js`, `.opencode/package-lock.json`, `package-lock.json`.
- Outcome: aligned. `plan.md` status set to `building`.

### Phases 1–5
- Spec: `spec.md` (designer). Tests: tester wrote `engine/discord-roll.test.js`, `discord-send.test.js`, `store-discord.test.js` (~50 cases); snapshot diffed at ship — unchanged.
- Build: commit `be4e6df` (feature-dev). No `NEEDS_TESTER`; adjudication and revision cycles unused.
- Dev Lead review: clean against spec, golden rule (data down/events up; engine pure; only `{url, enabled}` stored, device-local), flush call sites, secret handling.
  Observations (not blocking): `engine/discord-roll.js` imports `isDiscordWebhookUrl` from root `store-discord.js` (layer crossing, function is pure); `discordSendDecision` is exported/tested but `ed-app` uses `discordReady`; header gear tooltip still says "Settings (autosave)".
- Doc sync applied: `data/changelog.json`, `docs/UI-GUIDELINES.md` (new §8a + roll-affordance line), `ARCHITECTURE.md` (§7.6, layout), plan status → implemented.
- Deferred for owner: (D6) ARCHITECTURE §2 goal 1 / §7.5 / §10 say the serverless save is the "only" exception to "no external runtime dependency" — Discord is now a second outbound (opt-in, third-party) call; wording change amends a DECIDED statement. (D7) README.md one-line mentions (lines 5, 36–37); README has unrelated uncommitted owner edits so it was not touched.

### Gate result — NOT green (pushed: no)
`npm test`: 1138 pass / 3 fail, all unrelated to this feature and also failing without it:
`tools/plans-status.test.js` ("plans/custom-item-builder/plan.md: missing frontmatter"), `tools/sync-agents.test.js` ×2 ("design-agent.md: missing frontmatter"). Cause: working copies are CRLF (`core.autocrlf=true`), so the frontmatter parser sees `---\r\n`. All three tester suites pass. Push withheld per workflow.

### GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (all Tier 3)
- [x] Overview fit untouched (no Overview change)
- [x] No derived value stored or fabricated
- [~] Light/dark + modal contract: Settings keeps Escape/Enter, `light-dark()` tokens, weights 400/500 — owner to verify visually
- [x] No taxonomy change (N/A)
- [x] Asset/fetch paths: only the external Discord URL; app assets unchanged
