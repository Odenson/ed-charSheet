# Plan Review: Night's Edge (spell-nights-edge)

## Summary
The plan is mostly sound: Tier 2 is complete, R2/R3 have owner Decisions, and there are no Tier-1 items. There are 6 findings: 1 blocker, 2 major, 3 minor. The blocker is a rules claim (bonus-die explosion) that has no `rules.md` entry.

## Findings
### F1 — I4 / I5 — Bonus-die explosion has no rules entry
- **Severity:** blocker
- **Problem:** I4 adds `rollDiceList` ("exploding, same `rollDie`"). That is an Earthdawn rules claim about whether a D4 Bonus Die explodes on its max roll, and whether it is rolled and totalled separately from the step dice. `rules.md` R1-R4 do not cover it, and RULES-FAQ Q019 does not either. It rests on engine precedent and reviewer knowledge, not a cited entry.
- **Fix:** Add a rules entry (R5) for how a Bonus Die is rolled, answered by the rule-agent. Then cite it in I4/I5. If the answer is NOT-COVERED, get an owner Decision.

### F2 — I3 — Record shape is inconsistent (`object` vs `chosen`)
- **Severity:** major
- **Problem:** The "What" says the record stores `object: {kind:'weapon', name}`. The "Approach" says the record stores `chosen: {name}`, and I4 matches `chosen.name`. I3, I4 and I6 each describe a different field.
  - T3 says "weapon id", but the plan uses the name.
  - `activeSpellBundlesFor` currently filters on `e.scope` (category), and the plan does not say how `scope` interacts with `object.kind`.
- **Fix:** Fix one concrete shape. For example, each effect keeps the data-level `object {kind, require}`, and `activeSpellEffects` stamps `chosen: {name}` on each effect. State exactly which fields `activeSpellEffects` copies. Update T3's wording ("id" to "name"). Decide whether `object.kind` replaces `scope` for this matching.

### F3 — I3 — `effectLabel` and `stat` are wrong with the +2 step pick
- **Severity:** major
- **Problem:** `buildActiveSpell` picks `stat = effects.find(typeof value === 'number')`. With the D4 base (a string) plus the "+2 Damage Step" standalone pick, `stat` becomes the +2 step. The label then reads "+2 Damage" and hides the D4. Without a pick the label falls back to `summary`. The plan says only "verify".
- **Fix:** Specify the label rule. For example, the label is built from the dice effect when one is present ("+D4 Damage"), with the step option appended. Add a unit test for the label both with and without the pick.

### F4 — I1 / I4 — Other consumers of numeric `value` on attack-modifier effects
- **Severity:** minor
- **Problem:** Dice string values flow into the general effect fold (`store.js` ~960-972 `activeSpellEffects`), the Active effects and effect-source displays, and any `Number(e.value)` summing. The plan audits only `foldPool`, `effectReadout` and `buildActiveSpell`.
- **Fix:** Add an I1/I4 task to grep every reader of `e.value` / `measure` (store, engine, ui, homebrew validation in `tools/`). Add a test that a string-valued effect does not produce NaN or a "NaN" pill elsewhere.

### F5 — I6 — Self-cast casting target and no-weapon blocking
- **Severity:** minor
- **Problem:** The spell has `castingTarget: "Target's Mystic Defense"` and `range: Touch`, but the plan has the self-cast path without an equipped weapon blocking before the roll. It does not say how the existing `_castSelf` flow handles a non-fixed target number, nor how the "blocks before the roll" step is enforced. The Risks only warn in general terms.
- **Fix:** In I6, state which cast path a "This character" cast takes for this spell. Specify the pure `castWeaponChoices` result that gates the Cast button. Add a unit test for the empty-choices case.

### F6 — I5 / I7 — Scope and manual verification
- **Severity:** minor
- **Problem:** I5 touches the roll modal, `ed-app`, `store-rolllog`, the log rows and the Roll Log reader in one item. The plan itself calls it the largest unknown. UI-only checks (the picker, the pill, the die chain) are not listed explicitly for manual owner verification. Only I7 mentions it.
- **Fix:** Split I5 into (a) a pure data and log shape with tests and (b) the modal rendering. Add an explicit "owner verifies manually" list covering the picker, the Combat pill, the roll modal die group and the log row.
