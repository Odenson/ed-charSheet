# Feature: Homebrew optional circle advancement (homebrew-circle-adv)

## Summary
A new homebrew rule that switches Circle advancement from the standard gate (all lower-Circle Discipline Talents at rank = target Circle) to the book's optional "Using All Talents To Advance" rule (PG p.453): a Discipline's adept must know N talents (Discipline Talents or Talent Options) at a minimum rank, one of them from his current Circle, per the Optional Advancement Table keyed by new Circle (rules.md R1). Toggled on/off like any homebrew rule.

## Goals / Non-goals
- Goal: rule `hb-optional-circle-advancement`, shipped dormant (`enabled: false`), toggled in the homebrew manager.
- Goal: evaluated per Discipline, counting only that Discipline's own talents (Discipline Talents + Talent Options) — owner decision, rules.md R4.
- Goal: when off, behaviour is exactly as today.
- Non-goal: Legend Award halving/third for Circles 11-15 (GM guidance, R3).
- Non-goal: any change to trainer, 40 hours, fees, new-Discipline talent pricing, or Circle used for derived values (R2).
- Non-goal: counting Versatility-learned talents or thread-rank bonuses (never count; R2).

## Guardrail alignment
Docs touched: ARCHITECTURE §5/§4.2, docs/HOMEBREW-RULES.md (§5.5 target registry), docs/UI-GUIDELINES (Disciplines tab), rules data. Owner chose the homebrew on/off toggle (qa-log): the existing `set` lever with one new registered target — no format change, so no Tier-1 sign-off needed. If the table's data placement would require changing a `rules/*.json` shape or the `ed-homebrew/3` schema, that is Tier 1: the planner must raise NEEDS_HUMAN rather than proceed. No taxonomy change (no Tier 2).

## Tickets
### T1 — Table data + homebrew rule + set target
- **What:** Add the p.453 table as rules data (14 rows: new Circle 2-15 → min talents, min rank, single-talent-from-circle) in a place that fits an existing schema; register `advancement.optionalTable` in `HOMEBREW_SET_TARGETS` (store.js) and thread it into the model; add dormant rule `hb-optional-circle-advancement` to `rules/homebrew.json`.
- **Why:** The rule must be data + toggle, per docs/HOMEBREW-RULES.md.
- **Tier:** 3 (owner chose homebrew toggle; sign-off n/a)
- **Acceptance criteria:** Rule appears in the homebrew manager, off by default; table values match rules.md R1 exactly; conformance tests pass.
- **Open questions:** table placement (planner to choose a shape-compatible home or NEEDS_HUMAN).

### T2 — Engine: optional gate per Discipline
- **What:** In `engine/advancement.js` (pure), when the option is on, `circleRequirement`/`supportedCircle`/`circleStatus` use the table: count the Discipline's own talents (Discipline Talents + Talent Options of that Discipline, excluding Versatility-learned) at rank ≥ minRank, require ≥ N, and at least one counted talent from the Circle being left.
- **Why:** Core behaviour (R1, R2, R4).
- **Tier:** 3
- **Acceptance criteria:** Tests with the Mica example (Third Circle needs 6 talents at Rank 3, one from Circle 2); every table row; Circles 12-15 where rank stops tracking Circle; off ⇒ identical to today; unresolvable data ⇒ no fabricated result.
- **Open questions:** none.

### T3 — Disciplines tab: advancement checklist
- **What:** When on, the advancement track/Train modal checklist shows "N talents at rank R, one from Circle C" progress instead of per-DT rank gates; Train eligibility and the "consistent/justified" warning use the new gate.
- **Why:** The UI must reflect the active rule.
- **Tier:** 3 (within UI-GUIDELINES; both themes, modal Escape/Enter unchanged)
- **Acceptance criteria:** Data flows down/events up unchanged (`ed-advance-circle`); no derived number fabricated; light + dark OK.
- **Open questions:** none.

### T4 — Docs and changelog
- **What:** Document the target in HOMEBREW-RULES §5.5, note the optional gate in ARCHITECTURE/UI-GUIDELINES where they describe advancement, add a changelog line.
- **Tier:** 3
- **Acceptance criteria:** docs and code agree; `npm test` green.
