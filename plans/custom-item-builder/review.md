# Plan Review: Custom item builder: unarmed weapons (custom-item-builder)

## Summary
The plan is sound. All five tickets are covered, the code references check out (`cleanItemForm` dropping `0` at l.104, `REF_FIELDS`, `QUICK_TEMPLATES`, `_editItem`, `weaponPoolEffects` not double-counting the Damage effect, the engine already mapping `unarmed`, the validator not enumerating categories), and the tiering and rules grounding are correct. There are 3 findings, none blocking: 0 blockers, 1 major, 2 minor.

## Findings
### F1 — I2 — Negative / non-integer Damage Step left as a build-time decision
- **Severity:** major
- **Problem:** I2 offers three options ("add with negative", "subtract + abs", or `min=0` plus an error) and says "decide at build". `min="0"` on an `<input type=number>` does not stop typed negatives. The shared validator does not check `ref.damageStep` at all, so without an explicit clean-step check a negative or non-finite value would be stored. The generated effect's value and summary would then be inconsistent with `ref.damageStep`, which breaks the "field and effect never disagree" goal. The Open questions section calls it non-blocking, but the acceptance criteria do not cover it.
- **Fix:** Fix the decision in the plan. In `cleanItemForm`, push an error such as "Damage Step must be a whole number of 0 or more" when `ref.damageStep` is not a finite number >= 0 (and decide whether non-integers are allowed). Add it to the I2 and I5 test list, and keep `min=0` only as a UI hint.

### F2 — I2/I3 — Intermediate state between items
- **Severity:** minor
- **Problem:** After I2 alone, `_editItem` does not seed, so an old weapon with a template-created Damage effect and a field value shows an editable duplicate row. Save works but yields two Damage effects until I3 lands. This only matters if I2 is committed or released on its own.
- **Fix:** State that I2 and I3 must land in the same change or commit, or move `seedDamageStep` and the guard into I2. Also note that the Damage Step input uses `@change`, which fires on blur. "Updates live" in I2 means on commit of the field, not per keystroke. Either use `@input` or reword the criterion.

### F3 — I5 — Test file location and a pinned test
- **Severity:** minor
- **Problem:** The plan says `custom-item-builder.test.js` (root-level). That is correct (it exists at the repo root, while the builder lives in `ui/`). The l.70-78 test pins `cost 0 kept, empties dropped`, and the new rule that `damageStep` 0 is kept should get an explicit sibling test next to it. Also `docs/UI-GUIDELINES.md` and `PLAN-CUSTOM-ITEMS.md` l.306 say ranges appear "when missile/throwing", but the builder currently shows them always. The doc edit should state the true behaviour (hidden only for unarmed), not just append `unarmed`.
- **Fix:** Add the sibling test to the I5 list. Word the PLAN-CUSTOM-ITEMS l.306 edit as "short/long range shown except for unarmed".
