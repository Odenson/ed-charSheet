# Test Plan: Homebrew optional circle advancement (homebrew-circle-adv)

## Test files
- engine/advancement-optional.test.js
- tools/homebrew-optional-advancement-data.test.js
- store-optional-advancement.test.js

(Existing `engine/advancement.test.js` is untouched and must stay green.)

## Coverage
### engine/advancement-optional.test.js
- normalizeOptionalTable (4 cases) - valid Map; null for null/empty/array; keys integer >= 2; row fields positive integers. Rule: R1 (table values from spec). Catches a bad table enabling the optional gate instead of falling back.
- countableTalents (5 cases) - DT + Talent Options count, free/Durability/Karma Ritual drop (R5); viaVersatility excluded (R2); duplicate collapse highest rank / tie first; exact-name matching; empty input.
- optionalRequirement (9 cases) - Mica example (R1); N-1 / rank-1 / from-Circle missing fail; strict from-Circle (null/undefined/above never match, R6 addendum); from talent must be at min rank; Talent Option at from-Circle counts (R6); free+Versatility don't reach N; duplicate can't fake N; unresolved for no row; every one of the 14 rows driven from real legend.json (R1).
- circleStatus with opts (13 cases) - eligible/consistent/supported invariants; no climb, attained+1 row only; Circles 12-15 lagging min rank (R1); top Circle / beyond table / beyond ref.circles cap; Circle 1/null attained; F2 (a)(b)(c); consistency ignores from-Circle clause; per-Discipline independence (R4); standard path deep-equal with undefined/{}/no-table opts.

### tools/homebrew-optional-advancement-data.test.js
- 14 legend rows equal R1; fromCircle === circle - 1; schema tag `ed-legend/1` and `circleTraining` unchanged; dormant homebrew rule (`enabled:false`, boolean set, overrides cites p.453, summary/note, source lists the target). Rule: R1.

### store-optional-advancement.test.js
- rule on vs off through deriveModel with real legend; `model.advancement.optional`; (a)/(e) raw `viaVersatility` reaches engine, off ignores flag; (b) null circle no false inconsistency; (c) table absent and (c2) invalid table fall back to standard; (d) non-boolean flag (1, "true") falls back; table never written onto the character.

## Not covered (and why)
- `describeRequirement` helper (name and return shape are "e.g." in the spec, not a committed contract); the dev should add its own unit test for it.
- UI (no browser harness); owner manual checks: (1) rule off: Disciplines tab/Train modal unchanged; (2) rule on: tooltip and Train modal show "N talents at rank R, one from Circle C" with correct progress for an eligible and a not-eligible character; (3) unresolved shows the muted `—` pill, no number; (4) light and dark themes legible; (5) Train modal: Enter confirms only when eligible, Escape closes, focus per docs/MODALS.md.
- Docs/changelog content.

## How to run
`npm test`
