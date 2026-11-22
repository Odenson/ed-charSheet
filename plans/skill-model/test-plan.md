# Test Plan: Skill model (skill-model)

## Test files
- engine/skill-options.test.js

## Coverage
### engine/skill-options.test.js
- resolveSkillName: trim/compose, 40 ok / 41 bad, empty/whitespace/parentheses, language templates refused, non-generic ignores text, unknown entry, case-insensitive duplicate. Rule: R1, R3, R4.
- learnableSkills (existing tests kept; "near-full catalog" test adjusted to catalog minus duplicates and language templates): freeText/generic/category, templates absent and per-language present, Bribery/Skinning once, case-insensitive known filter, `Knowledge (X)` known does not hide free-text row (R4), Journeyman retained at Journeyman rank1Cost (R2, values from rules/legend.json).
- learnSkillPlan: Knowledge free text -> rank 1 Novice, legendCost from legend.json, fee, coins equal payFromPurse (R1, R2); fee 0 for negative/non-numeric silver; Journeyman pricing; refusals (unknown, bad-text, language template, case-insensitive duplicate, insufficient-silver); purity.

## Not covered (and why)
- Insufficient Legend refusal: stays UI-side (`_canAffordRank`), per spec. Manual: adding with insufficient Legend is blocked.
- UI (manual): Escape closes; Enter activates focused option; Enter in free-text adds when affordable; Enter in fee input does not submit; light/dark; search filters; Add disabled for empty text or unaffordable Legend/silver; creation picker unchanged; log shows full `Knowledge (<text>)`.
- Creation behavior: existing creation tests are unchanged and must stay green (guards the creation.js refactor).

## How to run
`npm test`
