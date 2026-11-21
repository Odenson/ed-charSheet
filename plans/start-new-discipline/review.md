# Plan Review: Start a new Discipline (start-new-discipline)

## Summary
The plan is well grounded: referenced files, line numbers and helpers exist, all items are Tier 3, every rule traces to rules.md and the R4 NOT-COVERED entry has an owner Decision. The owner has already approved fixing the audit (I2). There are 0 blockers, 3 major and 4 minor findings. They concern an inconsistent "lowest Circle" definition between I1 and I2, a missed pricing call site, and unhandled seed edge cases.

## Findings
### F1 — I2 / I1 — "lowest Circle of OTHER Disciplines" is not the "before joining" set
- **Severity:** major
- **Problem:** R2 says the row is the lowest Circle among Disciplines present BEFORE the new one joined, so for a Discipline at index i that means indices below i. I2 uses all other Disciplines, including later ones. With Thief 4, Warrior 1 and Archer 1 as a 3rd Discipline, Warrior's row is derived from Archer's Circle 1, so the audit prices Warrior at 1300 instead of 300. I1's fresh case uses all existing Disciplines, which are all earlier, so it agrees with the audit. I1's seed-in-place case uses "the OTHER Disciplines", which for a non-last Discipline differs from the audit.
- **Fix:** Define the helper once as `lowestPriorCircle(disciplines, idx)`, the minimum Circle over indices `< idx`. Use it in the audit, `advanceCost`, `talentRankStepCost` callers and I1 (fresh and seed). Keep `feeBase` (sum of the OTHER Disciplines' Circles) separate, since R3 says "other Disciplines". Add a test with a later Discipline at Circle 1 proving the earlier one is not repriced.

### F2 — I2 — Pricing call sites are incomplete
- **Severity:** major
- **Problem:** `lowestDisciplineCircle` is also called at `store.js:1437-1444` (rank stepper increase/refund, the `talentRankStepCost` callers) and `ui/ed-app.js:1267` (`_learnTalent` log). I2 cites only `store.js:1053` and "ed-app.js ~1268 and the rank-edit paths". `_canAffordRank` is not a caller itself, because it calls `auditLegendSpent`. If 1437-1444 is missed, the rank stepper shows step costs that differ from the audit delta.
- **Fix:** List every call site explicitly: `legend-spent.js:325`, `store.js:1053`, `store.js:1437-1444`, `ed-app.js:1267`, plus the new `_startDiscipline` log. Add an acceptance test that `rankStepCost == audit(after) - audit(before)` for the stepper path. Note that `talentRankStepCost` takes the lowest Circle per Discipline, so its call sites must pass the per-index value rather than one global value.

### F3 — I1 — Circle-1 option pool when the slot is already filled (seed)
- **Severity:** major
- **Problem:** For seed-in-place of a partially seeded Discipline, a Circle-1 option may already be known. `optionPool` is defined only as `learnableTalents(...)` minus known, which still offers a second Circle-1 option. That would exceed the one-slot rule and could be dispatched.
- **Fix:** Have I1 derive the Circle-1 slot with `optionSlots` and return an empty `optionPool` (and no option in the fee) when it is already filled. Have I4 re-validate that the slot is open, not just that the option is in the pool. Add a test.

### F4 — I1 — Ordinal-1 seed candidate is unhandled
- **Severity:** minor
- **Problem:** A first Discipline sitting at Circle 1 with missing DTs qualifies as a seed candidate by the I1 inclusion rule. `newDisciplineRank1Cost` returns null for ordinal 1, so it would be unpriceable. The Approach only discusses a first-Discipline character with no others.
- **Fix:** Exclude ordinal 1 from candidates (state it in I1 and test it), or price it with `talentRanksCost` and a fee of 0. Pick one and say so.

### F5 — I1 — `perTalentLegend` source disagrees with the tierShift path
- **Severity:** minor
- **Problem:** The What section says `perTalentLegend` comes from `newDisciplineRank1Cost`, but the Approach says it uses `additionalDisciplineTalentCost` when `tierShift > 0`. The two conflict.
- **Fix:** State a single source: `talentRankStepCost`/`additionalDisciplineTalentCost` with `{tierShift, tier:'Novice'}` for all cases. Do the same for the I4 log cost.

### F6 — I1 / I5 — Fee constant and silver re-seeding
- **Severity:** minor
- **Problem:** Open question 3 leaves the constant's home undecided. Adding `costs.newDisciplineFeePerCircle` to `rules/legend.json` touches a rules data file. "Fits the schema shape" is unverified (`$schema`/`effectTaxonomy` refs). The R3 value is also cited as "PG p.456" in I1 but the rules.md R3 sources are PG:17261-17264, 17305-17315.
- **Fix:** Decide during planning: use a named engine constant citing rules.md R3 (Q038), or confirm a legend.json key is schema-valid first. Cite R3 precisely.

### F7 — I2 — Legend change for existing characters and test impact
- **Severity:** minor
- **Problem:** The audit fix intentionally changes Legend Spent for existing characters. The plan already schedules a before/after diff of `data/characters/*.json`. The owner approved the change in general, but the affected totals and `legend-spent.test.js` edits need to be recorded (and Open question 1 closed in plan.md, since qa-log.md answers it).
- **Fix:** Mark Open question 1 as resolved per qa-log.md (2026-11-21). In I2, require the diff output (character, old total, new total) in the PR notes. Also note that any `recorded`/delta display for those characters will shift.

### F8 — I5 — UI verification is manual-only
- **Severity:** minor
- **Problem:** Modal behaviour (Escape/Enter, light/dark, narrow viewport fold) cannot be covered by `node:test`. I6 does not explicitly assign it to the owner.
- **Fix:** Add a short owner manual-verification checklist to I5/I6: Escape, Enter confirm, disabled reasons, unpriceable pill, light and dark, mobile, and the seed launch from the Warrior card on kolon-v2.

## Checks passed
- Completeness: T1-T4 map to I1-I6 (I2 is a prerequisite not in the ticket list, and is justified and owner-approved).
- Sequencing: valid (I1/I2, then I3, I4, I5, I6).
- Guardrails: all Tier 3, with no Tier-1 or Tier-2 surface touched. The inputs-only storage shape is preserved.
- Rules grounding: R1-R4 and R6 are cited. R4 has an owner Decision. There are no unresolved NOT-COVERED, CONFLICT or APP-DIFFERS entries.
- Grounding: Warrior's Circle-1 list (Avoid Blow, Melee Weapon, Thread Weaving (Warrior), Tiger Spring, Wood Skin) confirms the "5 DTs at 300 each" expectation.

No NEEDS_RULES. No NEEDS_HUMAN.
