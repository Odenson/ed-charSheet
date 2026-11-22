# Build log: skill-model

## Run 1 — 2026-11-22 (since 2026-11-22T12:55:25Z)
- **Alignment:** PASS. All 5 plan items Tier 3 (no sign-off needed). rules.md R1-R4 ANSWERED with sources (RULES-FAQ Q043), no outstanding decisions. No open questions in plan.md/review.md (6 findings all resolved in Review responses). 
- **Tree:** `dev` in sync with origin. Uncommitted: `docs/RULES-FAQ.md` (Q043, this feature's rule-agent entry) and `plans/skill-model/` (this feature). Both belong to this feature; staged by explicit path.

## Run 2 - build
- Implemented resolveSkillName/learnSkillPlan/MAX_TEXT/isLanguage in engine/skill-options.js; creation.js uses the resolver (tier check kept before duplicate); _learnSkill thin via plan (Legend guard stays _canAffordRank); sectioned learn picker in ui/ed-disciplines.js. No docs referenced PLAN-LEARN-SKILLS. Gate: npm test green (2267 pass). No disputes.

## Dev Lead review and ship
- **Review:** clean. Diff matches spec; tests unchanged vs tester snapshot; creation refusal order preserved; engine pure; no Tier-1 change. Minor note (not fixed): a duplicate free-text subject is only refused after Add (picker closes, no toast).
- **Doc sync:** applied ARCHITECTURE.md layout lines (creation.js, skill-options.js). **Deferred (Tier-1 doc, needs owner sign-off):** add a sentence to docs/UI-GUIDELINES.md ~:189 describing the edit-mode add-skill picker (sectioned, searchable, free-text Knowledge/Artisan, Novice Rank 1 Legend + editable silver fee). Skipped RULES-FAQ Decision line (R1-R4 are book-answered, no house rule).
- **Deviation from plan:** insufficient-Legend refusal is not tested on `learnSkillPlan` (Legend check stays UI-side `_canAffordRank`); on the manual checklist.
- **Gate:** `npm test` 2267 pass / 0 fail; `dev` not behind origin.

### PR checklist
- [x] No Tier-1 invariant changed
- [ ] Overview viewport fit — owner to verify (not touched)
- [x] Derived values: no new derived display
- [ ] Light and dark; Escape/Enter — owner to verify
- [x] Modals use ui/kit (`modalFrame`); UI-kit check is part of `npm test` (green)
- [x] No taxonomy change (N/A)
- [x] No new fetch/asset paths

### Manual UI checklist
See "UI test requirements" in the final report.
