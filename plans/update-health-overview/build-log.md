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

## Dev Lead review — clean (no revision needed)
Engine, modal and Overview/Combat diffs match spec and rules.md. Note: `.hl .l` keeps the mock's fixed `width:50px` label (plan said not to copy it); harmless for "Damage"/"Wounds", flagged for the owner's visual check.

## Doc sync
Applied (Tier 3, descriptive): ARCHITECTURE §8 layout (ed-damage-modal, healthDanger/resolveHit); MODALS.md (self-contained modal element, restoreFocus hand-off, reverted the inline-recipe mention); UI-GUIDELINES (edit-mode text, Combat row, dated redesign note); plan status.
Deferred for owner: D6 — add a "warning colours" convention to UI-GUIDELINES (new rule on a locked doc → Tier 1, needs sign-off). Amber/red pairs are duplicated locally in ed-overview.js and ed-custom-item.js.
Plan-internal drift: spec.md names `engine/health.test.js`/`store-health.test.js`; tests shipped as `engine/health-danger.test.js`/`store-health-danger.test.js`. Verify the changelog's "fix a miscount in edit mode" wording before release.

## Owner handoff — GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (all items Tier 3; no sign-off needed)
- [~] Overview fits viewport, no vertical scroll — NOT verified by agents; owner to check at 1280×720 and smallest size
- [x] Placeholder pills: missing Death → dashed `.pend` instead of gauge; modal ratings use `.pend`
- [~] Light/dark + modal Escape/Enter — implemented via `light-dark()` and ModalController; owner to verify visually
- [x] Taxonomy: N/A
- [x] Paths relative: N/A (no fetch/asset paths added)

Gate: `npm test` 1242 pass, 0 fail. Tester's tests unchanged vs snapshot.
