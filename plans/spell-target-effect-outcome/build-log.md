# Build log — spell-target-effect-outcome

## Run 1 — 2026-10-02
- **Slug:** spell-target-effect-outcome (plan.md was `draft`, now `building`).
- **Alignment (Phase 0):** PASS.
  - Guardrails: I1 Tier 3; I2, I3, I4 Tier 1 with owner sign-off recorded in qa-log ("TIER-1 SIGN-OFF", 2026-10-02). No Tier-2.
  - Rules: R1–R5 sourced; R3 (NOT-COVERED partial) has the owner house-ruling Decision (also on RULES-FAQ Q013).
  - Open questions: only non-blocking text wording; designer to fix. Known inconsistency for the spec: plan I3 still says `otherCastOutcome(spell, record, { rank })` but I1 removed the rank input, so the engine takes no rank.
  - Tree: `docs/RULES-FAQ.md` (Q011–Q015, Q013 Decision) and `plans/spell-target-effect-outcome/` are this feature's own uncommitted files and ship with it. Nothing unrelated is dirty.

## Build — 2026-10-02
- Added `otherCastOutcome` to engine/spells.js; ui/ed-spells.js session state (`_otherCast`, seq, SCRATCH save/restore, reset on character switch) and `_targetEffects()` card; UI-GUIDELINES §4 Spells row; changelog line + summary.
- No test disputes. Gate: npm test (see result in report).

## Dev Lead review (Phase 4) — run 1
Commit 0d65e9a reviewed against spec, rules.md and the golden rule. Gate `npm test` green (756). Tester file `engine/spells.test.js` unchanged (sha matches snapshot).
- **R1 (major) — Effect roll is lost after a tab switch.** `_castOnOther` and `_castSeq` are instance fields set only in `_rollCast` and are NOT saved/restored through `SCRATCH`. Scenario: cast on Other (hit), switch tab and back (component rebuilt; `_prog.castDone` restored, `_otherCast` restored), roll Effect → `_onRoll` sees `_castOnOther === false` / `_castSeq === 0`, so `effectTotal` is never recorded and the card stays "Effect —". Violates plan I2 ("Effect roll after a toggle … still updates the Other record it belongs to") and owner checklist item 6. Fix: persist and restore `_castOnOther` and `_castSeq` with the other scratch fields (clear/reset them in `_resetWorkspace`), keep `_seqCounter` resuming above the saved seq.
- **R2 (minor) — stray lint pragma.** `// eslint-disable-line no-unused-vars` on `otherCastOutcome`: the repo has no ESLint config; remove the pragma (keep the unused reserved `opts` parameter documented in the JSDoc).
Otherwise clean: engine function matches the spec contract, UI composes no game values, dashed placeholder pill, existing tokens and two weights only, Active effects unchanged on This character, docs/changelog accurate.

## Revision (Dev Lead run 1)
- R1: `_castOnOther` and `_castSeq` now saved/restored via SCRATCH in `ui/ed-spells.js`, reset in `_resetWorkspace`; `_seqCounter` resumes above the saved seq.
- R2: removed the stray eslint pragma in `engine/spells.js`.
- Tester file untouched. Gate: npm test green (756 pass, 0 fail).

## Doc sync (Phase 5) — run 1
design-agent report: no Tier-1/2 doc change outstanding (UI-GUIDELINES §4 Spells row already updated, sign-off recorded).
- Applied (Tier 3): D1 plan frontmatter -> `status: implemented`, `shipped: unreleased`; D2 ARCHITECTURE.md §8 `ed-spells.js` line mentions self-cast active effects / target effects; D4 plan I3 no longer mentions a `{ rank }` argument.
- Skipped (optional): D3 ARCHITECTURE.md `engine/spells.js` inventory wording.
- Noted, out of scope: ARCHITECTURE §5.5 grandfathered list names exports that no longer exist (already in docs/TAXONOMY-AUDIT.md).
