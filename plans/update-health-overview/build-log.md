# Build log: update-health-overview

## Run 1 — 2026-11-15 (since 2026-11-14T23:25:38Z)

### Phase 0 — Alignment
- Slug: `update-health-overview`. Guardrails: all items I1–I6 Tier 3; no Tier-1/2 item, no sign-off needed.
- Rules coverage: R1–R5 all FAQ-HIT/ANSWERED, no NOT-COVERED/CONFLICT/APP-DIFFERS; amber margin is an owner UI choice (recorded in qa-log).
- Open questions: only the non-blocking amber-token location (start local). review.md F1–F5 fixed in plan.
- Tree: `docs/RULES-FAQ.md` modified (rule-agent ledger from planning) and `plans/update-health-overview/` untracked — both belong to this feature and will be staged by explicit path. No unrelated changes.

## Build — 2026-11-15
- Engine: `healthDanger`, `resolveHit` in engine/health.js; `model.healthDanger` in store.js.
- New shared `ui/ed-damage-modal.js` (ModalController); Combat's hand-rolled damage modal removed.
- Overview Health card redrawn (V1); free-entry modal and plus button deleted; Recovery dice on Recoveries row.
- Docs: UI-GUIDELINES, MODALS; changelog line added. Gate: `npm test` green (1242 pass). No disputes.
- Manual UI checks (themes, no-scroll fit, mobile) left to the owner.
