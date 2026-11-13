# Plan Review: Homebrew optional circle advancement (homebrew-circle-adv)

## Summary
The plan is well grounded in the code and in rules.md. It has one real tier-classification problem (array-valued `set`), one semantic problem (climb-until-fail applied to a non-monotone gate that drives `eligible`/`consistent`), and several test and documentation gaps. 0 blockers, 3 major, 3 minor.

## Findings
### F1 — I1 / Guardrail classification — array-valued `set` is a documented value-form change
- **Severity:** major
- **Problem:** docs/HOMEBREW-RULES.md §5.5 defines the `set` value forms as exactly "a scalar or a race-keyed map" and says a `set` value is "a constant". §5.5's "Adding a target is not a format change" covers only the target registry, not new value forms. An array value is a new value form of the `ed-homebrew/3` `set` lever, and it is only safe because `deriveModel` (store.js:777-780) happens to pass arrays through. This falls under the "schema shapes" part of Tier 1, or at least a gray area. The plan resolves the gray area itself ("No NEEDS_HUMAN") and writes no owner decision into the Q&A log. The plan also admits that an object-by-circle table would be silently misread as race-keyed, which makes the pass-through fragile.
- **Fix:** Take the fallback now. Make `advancement.optionalTable` a scalar boolean `true`, a plain scalar target that is clearly Tier 3. Put the 14-row table in `rules/legend.json` `costs.optionalAdvancement`, keyed by Circle like `circleTraining` (additive, within `ed-legend/1`), or in another additive `rules/*.json` home. Confirm in the plan that this addition does not touch any schema validator or tag. Or keep the array and record explicit owner sign-off. The cost of the fallback is small: the `homebrew.json` rule keeps carrying `overrides` and `summary`, and the store reads the table from the legend rules.

### F2 — I2 — climb-until-fail on a non-monotone gate drives eligibility and a false "inconsistent" warning
- **Severity:** major
- **Problem:** The existing `supportedCircle` is valid only because the standard gate is monotone (advancement.js:46-50). The optional gate is not monotone, because the from-Circle clause is an exact match that changes per level (R6) and `circle` may be null. Turning the rule on would affect existing characters in three ways:
  - A character with a null `circle`, or one whose option talents were stored at a later Circle, fails at some low Circle. `supported` then drops to 1 and `consistent` goes false for a legitimately advanced character.
  - Because `eligible = supported > attained`, one failing low level also hides the real next-Circle eligibility.
  - Under the rule, a real character can hold Circle N having no talent stored at exactly Circle N-1, such as a character built under the standard rule and then switched.
  The plan notes the risk (I2 risk 1) but only "documents and tests" it. The user-visible effect is a wrongly red warning on every legacy character when the rule is switched on, plus a wrongly suppressed Train button.
- **Fix:**
  - For the optional path, compute eligibility directly as `optionalRequirement(ref, attained+1, ...).satisfied`, with no climb below the attained Circle.
  - Compute `supported` as `max(attained if its own gate holds, climb result)`, or define `consistent` for the optional path as only "the stored Circle's own row is met".
  - Alternatively, drop the climb for the optional path and have `supported` mean "highest target whose own row is satisfied, scanning all rows" (not stopping at the first failure).
  - Add tests: a legacy character with null `circle` at Circle 5, and a gap at one Circle, with the rule on, must not become `consistent:false`-by-accident or lose `eligible`.
  - State the chosen semantics in the plan, and flag it for the owner if it differs from the standard path.

### F3 — I2 / R6 — rules-uncovered area relied on without a recorded Decision
- **Severity:** major
- **Problem:** R6 says the Circle of a later-learned option (Specific Training/Versatility) is "Not covered" and gives only a "natural reading". I2 builds `hasFromCircle` on the stored `circle` of such talents. Per the review rules, an item built on a NOT-COVERED area without an owner `Decision` is a blocker. Here the entry is `ANSWERED` with an uncovered carve-out, so it is not formally flagged, but the plan's "No open rules points remain" is inaccurate. Specific Training is also a plausible path in this app. A talent taken later at lower rank could have its stored `circle` set to the learning Circle rather than the slot Circle, which is the exact case where the from-Circle clause fails.
- **Fix:** Add a recorded owner `Decision` to R6 for the later-learned option's Circle (use the stored `circle`, null never matches). Alternatively emit it as NEEDS_RULES or NEEDS_HUMAN. Correct "No open rules points remain" in the plan.

### F4 — I2 — no-regex / purity / signature details unspecified
- **Severity:** minor
- **Problem:** `countableTalents` needs the Discipline Talent / Talent Option / free-talent classification. The plan cites `engine/talent-options.js` helpers and `store.js:844-847` but does not say whether the engine imports `talent-options.js` or whether the store pre-classifies. `UNIVERSAL_TALENTS` must not be duplicated. The plan also never states that names are matched by exact string equality (no regex or substring), which is the standing rule. The return shape for `circleRequirement` under the optional path has no `gating`/`missing` fields, and existing UI code reads `nextRequirement.gating`.
- **Fix:** Reuse the existing exports and state that matching is by exact name. Keep `gating: []` and `missing: []` (or an equivalent) on the optional result so un-updated callers do not throw. Add the optional rule to the I3 acceptance check for every reader of `nextRequirement`.

### F5 — I2 / I4 — test coverage gaps
- **Severity:** minor
- **Problem:**
  - The coverage list lacks a test for `supportedCircle` capping when the table's max row (15) exceeds the highest Circle in `ref.circles`.
  - It lacks a duplicate-name and stored-talent test (two list entries for the same talent).
  - It lacks the F2 cases above.
  - It lacks a row-by-row test for `fromCircle === circle-1` consistency of the data.
  - I4 covers only `viaVersatility`, not null `circle` through `deriveModel`.
  - `viaVersatility` is documented only for `talentKarmaUse`; the plan should cite the doc line as the only authority (rules/talents.json:8) and test that the flag is read from the raw `d.talents`.
- **Fix:** Add the listed cases to I2/I4.

### F6 — I3 / I5 — UI and docs verification
- **Severity:** minor
- **Problem:** I3 has no owner manual-check step for the Train modal and tooltips in both themes (tests cannot cover it); it only says "checked in light and dark". I5 only "confirms" the homebrew modal handles array `set`, so it is a verification, not a task. That item disappears under the F1 fix. The doc updates in I5 must also state that the table is not stored on the character.
- **Fix:** List the manual owner checks explicitly (rule off, rule on, unresolved placeholder, light/dark, Enter/Escape in the Train modal). Add an automated test that `ui/ed-homebrew.js` can render the rule if the `set` shape is kept.

## Answers to the specific concerns
- (a) Array `set` value: a documented value-form widening, not merely a target addition. Prefer the legend.json fallback with a boolean `set` (F1).
- (b) Rules grounding: R1/R2/R5 trace correctly. R4 has an owner Decision. R6 has an uncovered carve-out the plan relies on (F3).
- (c) Purity: the plan keeps the engine pure (talents passed in) and adds no DOM. It does not mention exact-name matching, so confirm no regex (F4).
- (d) Non-monotone climb: a real risk with a user-visible effect (F2).
- (e) Test coverage: broadly good, with gaps in F2/F5.

NEEDS_HUMAN: Is a constant array value for a homebrew `set` target acceptable as a Tier-3 target addition, or should the table go in `rules/legend.json` with a boolean `set` target (the plan's own fallback)? Also, for the optional gate, should `eligible`/`consistent` evaluate only the attained+1 row, so characters with older or null talent Circles are not marked inconsistent, or keep the strict climb from Circle 2?
