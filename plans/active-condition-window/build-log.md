# Build log: active-condition-window

## Run 1 — 2026-11-24 (since 2026-11-24T10:50:11Z)

### Alignment
- Guardrails: I1, I2a, I2b, I3, I7 Tier 3; I4, I5, I6 Tier 1 with recorded sign-off (qa-log "Tier-1 sign-off", 2026-11-24). No Tier 2. PASS.
- Rules: R1–R5 in rules.md all have sources; owner decisions recorded (R3 house ruling, R4 Taunt-only, Taunt `arms` route). PASS.
- Open questions: none (plan.md, review.md all responded). PASS.
- Tree: local dev in sync with origin/dev. Unrelated/uncommitted, NOT to be staged: `docs/RULES-FAQ.md` (Q048, rule-agent — belongs to this feature, may be staged with it), `plans/active-conditions/` (earlier mock exploration, not staged).

### Build
- Spec: spec.md (designer, no open questions). Tests: 6 files (test-plan.md), snapshotted; final diff vs snapshot identical.
- Dev commit 5a71408, amended to f1e2a35 after the single Dev Lead revision (mock-d fixes, defensive opponent skips in ed-combat, charm summaries from `presentation.shortEffect`; `.terow` dead CSS removed). No NEEDS_TESTER / NEEDS_HUMAN / NEEDS_RULES.
- Gate: `npm test` 2511 pass / 0 fail; check-imports, check-ui-kit pass.

### Dev Lead review
Findings (all fixed in the one revision): mock-d I7 corrections; dead CSS; defensive `opponent` skips; charm summaries.
Accepted deviations: cast-on-Other miss / no-duration now shows only the existing success banner (Target effects card removed per owner decision); Mystic Aim hidden from the "This attack" options mirror (shown once as the armed Aim).

### Doc sync
Applied (Tier 3, ARCHITECTURE.md): s8 layout entries (ed-active-effects, active-effects-state, active-effects engine, combat-mods-state note), ed-combat/ed-spells descriptions, session inputs/events paragraph. UI-GUIDELINES s4, EFFECT-TAXONOMY s6 already in the feature commit. Deferred Tier-1/2 edits: none.

### PR checklist (GUARDRAILS.md)
- Tier-1 changes (Combat/Spells tab contents): owner sign-off 2026-11-24 in qa-log; UI-GUIDELINES s4 updated. PASS
- Data down/events up: UI computes nothing; reducers/builder in pure engine. PASS
- Only inputs stored: all new state is session-only. PASS
- Taxonomy: no vocabulary change, no version bump (`"rank"` value note in s6). PASS
- Gate green. PASS

### Manual UI verification (owner, on dev)
See plan.md "Owner manual verification" and the final report.
