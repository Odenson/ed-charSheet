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

## Resolution and ship (Dev Lead)
- Dispute resolved: tester adjudicated TESTER_UPDATED (row-2 filler talents moved to circle F+2; no assertion or rules value changed). Dev finished; commit 21c7b2e. Test files verified byte-identical to the tester's final snapshot.
- Dev Lead review: clean, no revision needed.
- Doc sync (design-agent) applied: UI-GUIDELINES §4 table restored (our added paragraph had split it) and the Circle-track note moved below the table with corrected wording (D1/D2); ARCHITECTURE advancement.js layout line (D3); plan.md status implemented/shipped unreleased (D5); this log (D6); engine/advancement.js header p.452 + JSDoc (D8).
- DEFERRED (pre-existing staleness, not caused by this feature): D4 ARCHITECTURE §4.2 still says `ed-homebrew/1` (should be /3, mention `set`/`knackParents`, legend.json); D7 HOMEBREW-RULES §5.5 registry omits `legend.spellLearnCostMultiplier` and `spells.learnSilverMultiplier` (TAXONOMY-AUDIT T-041, "six" -> "seven"). UI-GUIDELINES §4 is a Tier-1 doc: owner should eyeball the moved note.
- Gate: `npm test` 1099 tests, 1096 pass, 3 fail. The 3 (plans-status frontmatter, sync-agents x2) fail identically on a clean `origin/dev` worktree (CRLF checkout, autocrlf=true) and are unrelated.

### GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (engine pure/DOM-free, nothing stored, no schema tag change; legend `ed-legend/1`, homebrew `ed-homebrew/3` unchanged; boolean `set` target)
- [ ] Overview fits desktop viewport — not touched; owner to confirm
- [x] Derived values: unresolved/no-next Circle renders `—`, never a number
- [ ] Light/dark and modal Escape/Enter — owner to verify (Train modal gained a read-only row; no new colours/classes)
- [x] Taxonomy: N/A (no change)
- [x] Paths relative: no fetch/asset paths added

### Manual UI verification (owner, on dev)
1. Rule off: Disciplines tab + Train modal unchanged. 2. Enable rule in Homebrew: Circle-track tooltip and Train modal show "N talents at rank R, one from Circle C" with progress; check an eligible and a not-eligible character. 3. Top Circle/no row: `—`. 4. Light and dark themes. 5. Train modal: Enter confirms only when eligible; Escape closes. 6. Mobile fold; Overview fit.
