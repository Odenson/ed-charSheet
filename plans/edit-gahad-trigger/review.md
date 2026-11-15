# Plan Review: Edit Gahad trigger (edit-gahad-trigger)

## Summary
The plan is sound. It is Tier 3 throughout, grounded in the real code (store.js lines 504, 585 and 1777, `_traitsFor` at ed-overview.js:639, and `"Ork"` in rules/races.json:82), and it covers T1 to T3. There are 2 minor findings and no blockers.

## Findings
### F1 — I3 / Sequencing — contradictory dependency
- **Severity:** minor
- **Problem:** I3 lists "Dependencies: I1 and I2", but the Sequencing section builds I3 before I2. I2 in turn depends on I3 for the event handler. That is circular on paper.
- **Fix:** Set I3's dependency to I1 only. I2's dependency on I3 stays as it is.

### F2 — I2 — "unchanged" comparison needs normalisation
- **Severity:** minor
- **Problem:** The "no spurious dirty" check compares field values to the prefilled values. `applyGahadTrigger` trims its inputs. If the comparison does not trim, whitespace-only differences or a trait that is missing `summary` or `description` (undefined against `""`) could dispatch a spurious event.
- **Fix:** Compare trimmed values, and treat undefined as `""`, on both sides. Add a unit-testable pure comparison, or state this in the item.
