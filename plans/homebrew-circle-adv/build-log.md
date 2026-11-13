# Build log — homebrew-circle-adv

## Run 1 — 2026-11-14 (started 2026-11-13T22:03:29Z)
- Alignment: PASS. Whole plan Tier 3 (no Tier-1 item, no Tier-2); rules R1-R6 covered, R4 and R6-addendum carry recorded owner Decisions; no open technical questions (plan's shared-DT note is non-blocking).
- Branch: created local `dev` tracking `origin/dev` (was on `main`); stashed and restored working changes. Merge conflict in docs/RULES-FAQ.md: `dev` already has Shadow Meld as Q028, so this feature's FAQ entries were renumbered Q029/Q030 (rules.md refs updated). Original stash left as `stash@{0}` ("pre-build-feature homebrew-circle-adv").
- Unrelated uncommitted changes (NOT to be staged): .agents/feature-tester.claude.yml, .claude/agents/feature-tester.md, README.md, tools/token-report.mjs, tools/token-report.test.js, .opencode/package-lock.json, package-lock.json. docs/RULES-FAQ.md and plans/homebrew-circle-adv/ are this feature's (FAQ entries Q029/Q030).

## Build run — 2026-11-14
- Implemented: engine/advancement.js (normalizeOptionalTable, countableTalents, optionalRequirement, describeRequirement, circleStatus opts), talent-options.js export, store.js (target, table, model.advancement, call site), legend.json table, homebrew.json rule, ui/ed-disciplines.js (track tooltips + Train modal row), docs (HOMEBREW-RULES 5.5, ARCHITECTURE, UI-GUIDELINES), changelog line, engine/advancement-describe.test.js.
- Gate: all 3 tester files pass except one case. DISPUTE: engine/advancement-optional.test.js "every legend row boundary", `C2 above from-Circle`: for Circle 2 (fromCircle 1) the filler talents are all at circle 1, so they already satisfy the from-Circle clause; moving only the "From" talent to circle 2 cannot make it unsatisfied (spec: hasFromCircle = any counted talent at rank>=R with circle===fromCircle). Test is unsatisfiable for row 2 only.
- Other npm test failures are unrelated/pre-existing (plans-status custom-item-builder frontmatter; sync-agents design-agent.md frontmatter x2).
- Not committed (awaiting tester adjudication).
