# Plan Review: Add Air Sailor discipline (add-airSailor)

## Summary
The plan is sound. It is all Tier 3, every rules claim traces to RULES-FAQ Q042 via rules.md, and the cited files and tests exist. There are 3 minor findings and no blockers.

## Findings
### F1 — I1 — Unresolved "see Risks" text in the C5 effect spec
- **Severity:** minor
- **Problem:** The C5 effect line is a half-written thought ("target Interaction... see Risks ... unless taxonomy lists..."). EFFECT-TAXONOMY already lists the `test` target names as `Action|Attack|Damage|Effect|Initiative|<named ability>`, so the question is already answerable. There is no "Interaction" name. The repo has scoped-karma precedents on `Action` (Thief/Warrior) and on a named ability, `Charisma` (Thief C1).
- **Fix:** Fix the representation in the plan instead of deferring it to build time. For example, use `grant-karma-use` target `{domain:"test",name:"Action"}` with `scope:"Interaction tests"`. Then remove the matching entry from Open questions.

### F2 — I4 — Golden `addable` line references are fragile
- **Severity:** minor
- **Problem:** `store-creation-golden.test.js:216-219` are very long literal lines. The plan says to update only those four literals, but other tests may also embed discipline lists. For example, `knacks-catalog.test.js:55` mentions the four Disciplines in a comment, and `store-start-discipline.test.js` and `talent-options-initiation.test.js` use disciplines.json.
- **Fix:** Keep the "run `npm test` after I1" step as a hard gate, and require recording every test file touched in the build log. The `dev-server.test.js` title "(4 Disciplines)" also needs updating (the plan already says so).

### F3 — I2/I3 — Adding `tier` to stub talents is unverified
- **Severity:** minor
- **Problem:** The plan itself flags that existing full entries carry a `tier` that follows the Circle learned, and that PLAN-TALENT-TIER-DERIVATION exists. It leaves open whether code reads `talents.json` `tier` for pricing. Shared talents such as Navigation, Distract and Etiquette are used by Archer options, so a wrong `tier` on them could change behaviour.
- **Fix:** Before writing, grep the engine and store for readers of `talent.tier`. Record the result in the plan so I2/I3 are known to be additive, not discover it during `npm test`.
