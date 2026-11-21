# Test Plan: Display free talents (display-free-talents)

## Test files
- engine/free-talents.test.js
- store-free-talents.test.js

## Coverage
### engine/free-talents.test.js
- **Archer Call Missile at rank = Circle** — T1; R1. Catches wrong rank/flag/granting circle.
- **Thief Danger Sense; Nethermancer two Standard Matrix (distinct rows)** — T1; R5. Catches de-duplication of the matrices.
- **Each discipline uses its own Circle** — T1; R3.
- **Same-discipline suppression; cross-name non-suppression** — T1; R6.
- **Circle 0/null/NaN/negative/non-numeric and missing ref give []** — T1 edge cases.
- **Fixture: circle filter, ascending order, duplicates, granting circle** — T1; n/a (structure only).
- **No mutation of rules data or the storedNames set** — purity.

### store-free-talents.test.js
- **Archer free row (rank, circle 1, free, required, last)** — T2; R1.
- **Call Missile Perception step/dice/Karma/strain 1 and catalog completion (strain 1, skillUse not allowed, summary, brief)** — T2, T5; R4, R7.
- **Step rises with Circle** — R1.
- **Thief Danger Sense rollable, strain 1** — T2; R4.
- **Nethermancer Standard Matrix: step null, karma null, no Enhanced Matrix row** — R5.
- **Second discipline at its own Circle** — R3.
- **Same-discipline stored Call Missile suppresses free row** — R6.
- **Thief option + Archer free Call Missile: two rows, own ranks, higher step on the free row, identical rollMods** — R6 (Combat picker precondition).
- **Pricing alignment: free pricing null, learned count/order equals raw, learned pricing shape** — T2 index-alignment gotcha.
- **circleStatus / optionSlots unaffected; character not mutated** — R2.
- **grant-ability rank bonus folds into free Danger Sense (rankBonus, stepBase, step, dice)** — T2.
- **Unknown discipline: no free rows, no throw** — edge case.

## Not covered (and why)
- Disciplines tab UI (Free chip, read-only rank, no stepper/remove in edit mode, info modal chip, legend entry, "—" step for Standard Matrix): no browser harness. Owner check: Chakka's Archer shows Call Missile in the Circle 1 group with a Free chip and working roll; a Nethermancer shows two Standard Matrix rows with a disabled roll; light and dark themes; no overflow on mobile width.
- Combat picker (`_allActions`, `_talentResultMods`): DOM-bound; model-level preconditions (higher-step row, identical rollMods, step null for matrices) are tested. Owner check: Call Missile/Danger Sense appear once, roll with Karma/Strain; Standard Matrix absent. If the dev extracts `ui/combat-actions.js`, a test for it is the dev's to propose via adjudication.
- Legend-spent totals: audit reads raw character, which the tests prove is not mutated; no separate assertion.
- `tools/rules-conformance.test.js` and the lint pretests cover the Call Missile data edit and imports (existing).

## How to run
`npm test`
