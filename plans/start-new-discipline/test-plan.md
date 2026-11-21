# Test Plan: Start a new Discipline (start-new-discipline)

## Test files
- engine/legend-spent.test.js (changed: one existing assertion updated, import + 3 new tests appended)
- store-homebrew.test.js (pre-existing; 3 standard-model Nethermancer totals 1300 -> 1100 per rules.md R2, lowest PRIOR Circle 4 -> 300 Rank-1 row; adjudicated)
- engine/talent-options-initiation.test.js (new)
- store-start-discipline.test.js (new)

## Coverage
### engine/legend-spent.test.js::lowestPriorCircle ...
- **Validates:** I2 helper: min Circle over indices < idx, null at idx 0 / none, null circles ignored; `lowestDisciplineCircle` still exported.
- **Rule:** R2 (rules.md). **Why:** single definition of the "before joining" row.
### ::audit: Thief 4 + Warrior Circle 1 with 5 Rank-1 DTs prices 5 x 300 = 1500
- **Validates:** I2 acceptance (not 6500). **Rule:** R2. **Why:** audit used the lowest Circle including the new Discipline.
### ::audit: a LATER Circle-1 Discipline does not reprice an earlier one
- **Validates:** Thief 4 / Warrior 1 / Archer 1: Warrior 5 x 300; Archer (3rd) from `costs.newDisciplineRank1['3']['1']`. **Rule:** R2.
### ::auditLegendSpent prices a 2nd Discipline with the surcharge (CHANGED ASSERTION)
- Archer 4 + Nethermancer 3 (Spellcasting R3): Neth total 1300 -> 1100 (Rank-1 row now Archer's 4 = 300, not own Circle 3 = 500); r.total 1900+1100. Legitimate I2 change. Other existing assertions (explicit-lowest `talentRankStepCost`, tierShift audit which ignores the table) are unchanged by design. Other existing tests with multi-Discipline characters could shift if they assert Legend totals; run `npm test` and report any such to the tester.

### engine/talent-options-initiation.test.js (initiationQuote / addableDisciplines)
- fee constant is 100 (R3).
- Fresh Kolon Thief 4 -> Warrior: ordinal 2, lowestBefore 4, feeBase 4, 5 grants, 300 each, total 1500, silver 2000 (R1, R2, R3).
- Option picked: Legend 1800, silver 2400; skipped 1500; pool non-empty, no DTs in it (R4).
- 3rd Discipline ordinal/column/feeBase (price read from legend.json table) (R2, R3).
- Thread Weaving variant per Discipline; universals/free never granted (R6).
- Seed empty Warrior: mode seed, ordinal 2, feeBase from OTHER Disciplines (R1-R3).
- Partial seed grants only missing 3, Legend 900, silver 1200 (plan open question 2, Dev Lead decision).
- Seed with option slot filled: pool `{available:true, items:[]}`, `optionSlotOpen=false`, option not in fee/Legend (R4).
- Non-last seed (Thief 4, Warrior 1, Archer 1): Warrior stays 300, feeBase 5 (R2, R3).
- Exclusions: ordinal-1 at Circle 1; Circle > 1; complete at Circle 1.
- addableDisciplines mixed list; empty when none left.
- Null price (no newDisciplineRank1) -> perTalentLegend/legendTotal null, never 0.
- Quote equals audit delta in standard and tierShift=1 modes (R2).
- Inputs not mutated.

### store-start-discipline.test.js
- model.addableDisciplines: seed/new candidates, ordinal 3, 5 grants at 300; option items carry name + brief/shortEffect; `[]` when none; never in `forSave()`.
- Persistence shape through `saveAdvancementEdits` + `applyEdits` + `forSave`: `{name, rank:1, circle:1}` only, Circle unchanged, original untouched.
- Completed seed is no longer a candidate (duplicate dispatch no-op) and Available Legend drops by exactly 1500 (matches the quote) (R2).
- Stepper increaseCost / refund == available delta for a Circle-1 additional Discipline (I2 invariant).
- Single stored Rank-1 DT in a Circle-1 additional Discipline costs 300, not 1300 (R2).
- `logDisciplineStarted`: label `Started Warrior` / `Seeded Warrior Circle 1`, fields discipline, circle 1, grants, legendCost, silverFee, coinDelta, purseBefore/After.

## Assumptions the dev should know (contract gaps, adjudicable)
- `legendTotal` / `defaultSilver` are read as functions of `withOption` (spec allows fields or small functions; tests accept either only when a function, or a plain value).
- `initiationQuote` returns a falsy value for an excluded Discipline.
- `logDisciplineStarted(characterId, { discipline, mode: 'new'|'seed', grants, legendCost, silverFee, beforeCoins, afterCoins })` mirrors `logCircleTraining`; the `mode` key name is a tester assumption (spec fixes labels, not the argument name).
- Option-pool known-names for a fresh Discipline are not asserted (spec ambiguous).

## Not covered (and why)
- `_startDiscipline` (ui/ed-app.js, DOM component, not importable): refusal with no mutation for Legend short / purse short / invalid option / filled slot / NaN silver, `payFromPurse` change, log written once, `_markDirty`. Owner: try each refusal in dev and confirm Legend, coins and Disciplines are unchanged and no log row appears. No `buildDisciplineStart` helper is promised by the spec, so none is imported; if the dev extracts one, the tester can add tests.
- UI: Escape closes; Enter confirms only when allowed; disabled-confirm reasons; dashed placeholder pill for unpriceable; light and dark; mobile fold; Add button hidden when nothing addable; seed launch from the Warrior card; silver re-seeds on option change unless edited; Overview untouched. `tools/check-ui-kit.mjs`.
- Before/after Legend diff over `data/characters/*.json` (character, old, new) for PR notes.
- Docs / changelog (`data/changelog.json`) entries.

## How to run
`npm test` (red until implemented: the three files above currently fail to load on missing exports).
