# Plan Review: Update Shadow Meld (update-shadow-meld)

## Summary
The plan is mostly sound: data-only, Tier 3, and it reuses real Soul Armor shapes. There are 4 findings: 1 blocker (rules bookkeeping), 1 major (I2 cites an API that does not exist) and 2 minor.

## Findings
### F1 — R1, R2, R3 (I1, I2) — APP-DIFFERS entries have no recorded owner Decision
- **Severity:** blocker
- **Problem:** rules.md marks R1, R2 and R3 as `APP-DIFFERS` with `Decision: none`. I1 and I2 are built on them. Under the review rules, an item built on an APP-DIFFERS entry without a recorded owner Decision is a blocker. R4 and R6 have Decisions, but R1 to R3 do not.
- **Fix:** Record an owner Decision on R1, R2 and R3. For example: "Owner 2026-10-05: align the app to the book (this feature's request)." If the owner has not actually decided this, ask. The `NEEDS_HUMAN` below is only needed if the planner cannot cite the owner's original feature request.

### F2 — I2 — `buildCastPlan` does not exist; duration is not in the cast plan
- **Severity:** major
- **Problem:** I2 says it uses `buildCastPlan`/`buildSpellsContext` and asserts "cast plan duration grows with a success". `engine/spells.js` has no `buildCastPlan`. It exports `castPlan(ctx, spellName, castType)`. That function does not compute a boosted duration. The duration boost comes from `castBoosts` via `buildActiveSpell(spell, rank, {extraPicks, successLevels})`, which returns `roundsTotal`, and from `boostedDuration`. (TAXONOMY-AUDIT T-050 uses the stale name `buildCastPlan`, but the code does not.) Note that `buildActiveSpell` counts only `successLevels - 1` extra successes, so 2 successLevels gives +2 minutes, which is +20 rounds.
- **Fix:** Rewrite I2 against `buildActiveSpell`, with a rank-1 caster:
  - 2 successLevels should give `roundsTotal` 10 + 20.
  - The Increase Duration thread pick should give +20 rounds.
  - One Increase Effect pick should give a Stealthy Stride effect of value 6, with no standalone duplicate. This works only because the option effect matches the base on type, target and measure, and has `duration: "sustained"`.
  - Also assert `autoApplies` on the base and Increase Effect effects.
  - Drop the "drop the assertion if it needs the store" hedge.

### F3 — I1(b) — Increase Effect must match the base effect exactly, or it double-counts
- **Severity:** minor
- **Problem:** The fold in `engine/spells.js` (`isStandaloneOptionEffect` and `sumOptionBoosts`) treats a sustained option effect as a boost of the base only if type, target domain and name, and measure all match a numeric sustained base effect. If it does not match, the option becomes a separate standalone effect. The plan states `domain:"test", name:"Stealthy Stride"`, step and sustained, which matches. The Increase Duration thread effect should carry no `duration` field, as in Soul Armor.
- **Fix:** In I1, state explicitly that the Increase Effect effect must use the identical target, measure `step` and `duration: "sustained"`, and add the F2 assertion to lock it.

### F4 — I1(d) — Placement and conformance of the default-skill `note`
- **Severity:** minor
- **Problem:** `sustainedEffectsOf` keeps only `duration === "sustained"` and non-`gmDiscretion` effects. A `note` with no duration is therefore not folded into the active record, which is fine. Whether `ui/ed-spells.js` displays a non-sustained `note` in the spell's effects list is unverified. `tools/rules-conformance.test.js` has no explicit note rule, so conformance may not constrain it.
- **Fix:** In I1, tell the builder to confirm in `ui/ed-spells.js` that the note is rendered, because the acceptance criterion says it is displayed. If it is not, flag it for manual owner verification instead of editing the UI. Also add the owner-verification note: UI rendering cannot be covered by `node:test`.

### F5 — I3 — More count and prose locations to update than listed
- **Severity:** minor
- **Problem:** I3 updates "Result at a glance" and the Log. Other places in `docs/TAXONOMY-AUDIT.md` also say T-048 to T-051 or "51 findings": the intro of "Findings" (~line 185) and the re-validation text (~line 745, which is dated and may be left as is). Also, `docs/TAXONOMY-AUDIT.md` already has uncommitted edits (9 insertions, 6 deletions), so the insertions must be surgical.
- **Fix:** List the exact lines to touch, namely the "Result at a glance" count and the ~185 range sentence. Leave the dated re-validation section (~745) untouched. Re-read the file immediately before editing, as the plan says.

NEEDS_HUMAN: Confirm that the owner's request to update Shadow Meld to the book (PG p. 321) counts as the recorded Decision for APP-DIFFERS entries R1 to R3. If it does, the planner can cite it and F1 is resolved.
