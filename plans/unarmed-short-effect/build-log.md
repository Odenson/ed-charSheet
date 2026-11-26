# Build log: Unarmed Combat missing short effect (unarmed-short-effect)

## Run 1 — 2026-11-27 (since 2026-11-26T22:04:26Z)

### Phase 0 — Alignment
- Guardrails: T1, T2 and plan items I1, I2 all Tier 3 (data within schema + a test). No Tier-1/Tier-2 items; no sign-off needed.
- Rules: R1–R6 in rules.md all FAQ-HIT/ANSWERED with sources; no NOT-COVERED/CONFLICT/APP-DIFFERS.
- Open questions: none (plan.md, review.md F1 fixed in revision).
- Working tree: uncommitted /new-feature outputs for this feature (plans/unarmed-short-effect/, plans/backlog/BACKLOG.md tick, docs/RULES-FAQ.md Q025 item 7) — committed with the feature. No unrelated changes.
- Outcome: aligned; plan.md status → building.

### Phase 1 — Build (feature-dev)
- `rules/talents.json`: replaced the "Unarmed Combat" stub with the full entry per spec (Melee Weapon field order; em dash kept as the `—` escape; CRLF preserved; no karma/combatOptions/arms; header untouched).
- `data/changelog.json`: added the spec's `fixed` line to `unreleased.changes`.
- Tester test `engine/unarmed-combat-data.test.js` unmodified.
- Gate: `npm test` green — 2598 tests, 2598 pass, 0 fail (before the change: 7 fail, all in the new test as expected).
- Disputes: none.

### Phase 4 — Dev Lead review
- Clean. Diff b809225 matches spec.md exactly; values match rules.md R1–R6; only v6 vocabulary (`note`/`on-success`/`talent`); no karma/combatOptions/arms; no engine/UI/store change. Tester's test byte-identical to the snapshot. No revision needed.

### Phase 5 — Doc sync (design-agent, scoped)
- No doc edits needed: talents.json header note ("the rest are enriched incrementally") still true; UI-GUIDELINES Combat row already describes Strength-step unarmed damage; ARCHITECTURE unaffected. Nothing deferred.

### Phase 6 — Ship / owner handoff
PR checklist (GUARDRAILS.md):
- [x] No Tier-1 invariant changed — data + test only
- [x] Overview still fits the desktop viewport — no UI change (owner to eyeball)
- [x] Derived values still placeholder pills — no UI change
- [x] Light/dark, modals Escape/Enter — no UI change
- [x] Modals use ui/kit/; UI-kit check passes (in npm test)
- [x] Taxonomy change — N/A (v6 unchanged)
- [x] Asset/fetch paths relative — N/A (no paths touched)

Deferred Tier-1/2 doc edits: none.

Manual verification (no `ui/` files changed; data shows through existing views):
1. Dev site → Fighter Test (Troll) → Disciplines tab: Unarmed Combat row's Effect column reads "Unarmed close-combat attack".
2. Open Unarmed Combat's info: summary (vs Physical Defense, Strength Step damage), Strain 0, Skill Use Novice, the on-hit note.
3. Combat tab, Weapon = Unarmed: attack/damage pools unchanged from before.
4. Repeat 1–2 in dark mode.
