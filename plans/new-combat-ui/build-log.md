# Build log: New-Combat-UI (new-combat-ui)

## Run 1 — 2026-10-04
- **Alignment:** passed. All items Tier 1 with owner sign-off (qa-log entry 1; details entries 2-6). No Tier 2. rules.md: 0 rules, nothing to ground. Plan open-question defaults confirmed by owner (qa-log, dev-lead entry).
- **Working tree:** untracked `plans/new-combat-ui/` only; branch `dev`.
- plan.md status set to `building`.

## Build run — 2026-10-04
- Added ui/combat-mods-state.js and ui/combat-log-rows.js; recomposed ui/ed-combat.js (header line, top2, modsrow, log table, modTab scratch wiring incl. both reset paths); UI-GUIDELINES §4 + superseded note in PLAN-COMBAT-TAB.md.
- Gate: npm test green (870 pass). No disputes.

## Dev Lead review — 2026-10-04
- Clean: diff matches spec; view-only; pure DOM-free helpers; no dispatch/engine/store change; collapse mechanism fully removed; gate green (870).

## Doc sync — 2026-10-04
- Applied: changelog `unreleased` line; ARCHITECTURE.md ui/ list (two new modules); UI-GUIDELINES §4 Stand-up mention (covered by sign-off entry 1); plan/spec changelog wording; plan.md `status: implemented`, `shipped: unreleased`.
- Deferred: none.

## Owner handoff — PR checklist (GUARDRAILS.md)
- [x] No Tier-1 invariant changed without sign-off (qa-log entry 1; data-down/dispatch-up intact; engine untouched; no stored derived values; no schema change)
- [ ] Overview still fits desktop viewport — not touched; owner to confirm
- [x] Derived values still placeholder pills (`_combatRating`, `_pend()` in header line) — owner to eyeball
- [ ] Light and dark mode; modals Escape/Enter — owner to verify (no modal logic changed)
- [x] No taxonomy change (Tier 2 N/A)
- [x] No new asset/fetch paths

## Manual UI verification
See "UI test requirements" in the build report and test-plan.md.
