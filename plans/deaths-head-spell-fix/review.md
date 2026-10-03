# Plan Review: Death's Head spell fix (deaths-head-spell-fix)

## Summary
The plan is sound: Tier 3 throughout, rules R1-R4 are cited and answered, tickets are fully covered and sequencing is valid. There are 3 findings (0 blocker, 1 major, 2 minor), all about I2 precision.

## Findings
### F1 — I2 — Step 2 exclusion heuristic would break existing spells
- **Severity:** major
- **Problem:** Step 2 offers "skip effects whose `target.domain === 'test'` with a non-spell-effect target" as a way to keep standalone effects out of `stepAdd`. Soulless Eyes (Intimidation) and Shield Mist (Avoid Blow) have `test-modifier`/`test`/step sustained option effects that ARE boosts of a matching base effect. That heuristic would drop their boosts and change their active records, which breaks the "byte-identical" acceptance criterion.
- **Fix:** Remove the domain-based wording. Specify a single helper, `isStandaloneOptionEffect(spell, e)`. It is true only when `e.duration === 'sustained'` and no numeric sustained base effect (as returned by `sustainedEffectsOf`) matches `e` on type, target domain, target name and measure. Both `sumOptionBoosts` (via `castBoosts`) and the new fold must use it. This means `sumOptionBoosts` needs the spell or base effects passed in.

### F2 — I2 — Audit list and regression tests should name the real precedents
- **Severity:** minor
- **Problem:** The plan cites only Soul Armor, Arrow of Night and Pain as regression targets. The relevant sustained option effects in `rules/spells.json` are:
  - Soul Armor
  - Soulless Eyes
  - Shield Mist
  - Aspect of the Fog Ghost
  - Aspect of the Casual Murderer
  I checked all five and each has a matching base sustained effect, so the rule is safe. Arrow of Night's option is `duration: test`, so it is not relevant to this fold.
- **Fix:** Name these five spells in the I2 audit and add at least Soulless Eyes and Shield Mist, which are `test-modifier` precedents, to the I3(d) regression assertions. Do this as a data-driven test that every spell with a sustained option effect and a matching base is unchanged.

### F3 — I2 — Tile label wording and a cast-path side effect
- **Severity:** minor
- **Problem:** `effectSubject` returns `"<name> <domain>"`, so the label would read "+2 Frighten test". The "+2 Frighten" in the plan is not what it produces. Separately, `castBoosts` still feeds `otherCastOutcome` and `effectStepBonus`. After the F1 helper the new option must contribute 0 `stepAdd` on both paths, which I3(c) covers for `effectStepBonus` only.
- **Fix:** Accept "+2 Frighten test" (or add the small case the plan mentions) and fix the Open Questions text to match. Extend I3(c) to assert that `otherCastOutcome` and `castPlan` show no Effect-step change for Death's Head with picks.
