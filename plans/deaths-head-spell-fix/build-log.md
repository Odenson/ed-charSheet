# Build log: deaths-head-spell-fix

## Run 1 — 2026-10-03
- **Alignment:** passed. I1/I2/I3 all Tier 3; no sign-offs needed. rules.md R1-R4 all ANSWERED with sources. No open questions in plan/review.
- **Working tree:** branch `dev`. `docs/RULES-FAQ.md` modified (rule-agent Q017 entry from /new-feature) — belongs to this feature; staged by explicit path with the commit. `plans/deaths-head-spell-fix/` untracked (feature folder).

## Build — 2026-10-03
- engine/spells.js: added isStandaloneOptionEffect; sumOptionBoosts now spell-aware (standalone effects add 0 boosts); buildActiveSpell folds standalone option effects stacked per pick; docblock updated.
- rules/spells.json: Death's Head extraThreads replaced by the single "+2 bonus to Frighten" test-modifier.
- data/changelog.json: unreleased line added.
- Gate: npm test green (805 pass, 0 fail). No disputes.

## Dev Lead (2026-10-03)
- Phase 4 review: clean, no revision. Tester's test files byte-identical to snapshot. Dev also staged data/changelog.json (unreleased line) — accepted.
- Phase 5 doc sync (design-agent): no design-doc edits needed. Applied D1 (plan status -> implemented, shipped: unreleased). Skipped optional D2 (TAXONOMY-AUDIT snapshot note).
- Manual owner checks: store-level Frighten +step while active, tile wording "+2 Frighten test", no double-count in ed-spells.js.
