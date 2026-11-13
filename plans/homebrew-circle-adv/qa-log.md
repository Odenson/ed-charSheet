# QA log — homebrew-circle-adv

## 2026-11-13 — asked by interrogator
**Q:** (feature brief from /new-feature args)
**A:** New homebrew rule overriding Circle advancement, using the book's optional advancement table (PG p.453, "Using All Talents To Advance"): based on number of disciplines and rank level, not the standard per-Discipline requirement.

## 2026-11-13 — rule-agent
Optional table contents NOT retrievable: `rulebook extracts/` (gitignored) is missing from this checkout. Only RULES-FAQ Q007 (docs/RULES-FAQ.md:266-331) is available; it confirms the rule exists ("N talents at a minimum rank, one from the current Circle") but stores no table.

## 2026-11-13 — rule-agent (extracts restored)
Table found (see rules.md R1). It is keyed by new Circle only; no multi-Discipline column. R4 (multi-Discipline evaluation) NOT-COVERED by the book.

## 2026-11-13 — asked by interrogator
**Q:** Multi-Discipline evaluation under the optional table?
**A:** Per Discipline, own talents only (that Discipline's Discipline Talents + its Talent Options).

## 2026-11-13 — asked by interrogator
**Q:** Lever: A (registered `set` target, Tier 3) or B (new lever, ed-homebrew/4, Tier 1)?
**A:** "we should use the homebrew option to set this optional rule on or off" — interpreted as a normal homebrew rule with an `enabled` toggle, i.e. option A (no Tier-1 sign-off given or needed). If the table's data placement would need a schema-shape change, planner must raise NEEDS_HUMAN.

## 2026-11-13 — asked by interrogator
**Q:** Scope T1-T4, non-goals Legend-award halving and trainer/fee changes — anything to add?
**A:** That's the full scope.

## 2026-11-13 — planner via interrogator (NEEDS_RULES, answered by rule-agent)
Free talents do not count (R5); "from current Circle" = gained at exactly the Circle left, Talent Options included (R6).

## 2026-11-13 — reviewer via interrogator
**Q:** Where should the p.453 table live (array-valued `set` vs rules/legend.json + boolean set)?
**A:** rules/legend.json costs.optionalAdvancement + boolean `advancement.optionalTable` set target.

## 2026-11-13 — reviewer via interrogator
**Q:** Eligibility/consistency evaluation under the optional gate?
**A:** Check attained+1 row only (eligibility = next-Circle row; consistency checks only the stored Circle's row); null/old talent circles must not wrongly flag a character.

## 2026-11-13 — reviewer via interrogator
**Q:** Circle of a later-learned Talent Option for the from-Circle clause (book silent)?
**A:** Use the stored talent Circle; nothing inferred, missing Circle never matches; Versatility-learned never counts.
