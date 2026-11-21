# Plan Review: Display free talents (display-free-talents)

## Summary
The plan is well grounded in the code (store.js build order, pricing-index gotcha, ed-combat `_allActions`, advancement untouched) and all items are correctly Tier 3. 5 findings: 1 blocker (Call Missile catalog text has no rules.md backing), 2 major, 2 minor.

## Findings
### F1 — I5 — Call Missile summary/shortEffect has no rules.md entry
- **Severity:** blocker
- **Problem:** I5 adds `presentation.shortEffect`, `summary`, `skillUse` and `tier` to Call Missile, but `rules.md` supports only Strain 1 (R4) and Action Simple / Perception already in the catalog. No entry states what Call Missile does (the plan admits "exact detail is not in rules.md" and defers it to a possible late NEEDS_RULES). Content built on a rules claim with no entry is a blocker. `skillUse`/`tier: "Novice"` is likewise ungrounded for Call Missile (copied from Danger Sense layout, not from a ruling).
- **Fix:** Get a rule-agent ruling on Call Missile's effect (and whether it is Novice-tier / skillUse-allowed) and record it as a new R entry in rules.md before build, or limit I5 to `strain: 1` only and leave summary/shortEffect/skillUse/tier out (then T5's "brief and detail" criterion must be relaxed with owner agreement).

### F2 — I4 — Dedupe change from step to rank is unverified and risks regressing the picker
- **Severity:** major
- **Problem:** `_allActions()` (ed-combat.js:534-538) dedupes by highest `step`. I4 proposes switching to "rank then step" without checking that model rows expose a comparable `rank` (rank-grant bonus lives in `rankBonus`/`stepBase`, while `t.rank` stays the base rank). Ranking on base `rank` could pick a row with a lower step when a thread bonus applies to only one row (folding is by name, so likely equal, but unproven). The ticket's "highest rank" rule (R6) and the existing step tiebreak coincide for the same attribute, so the change may be unnecessary. It also would change `karma`/`rollStrain` selection when rows differ.
- **Fix:** Either keep the step tiebreak (state that it equals highest rank for same-name talents sharing an attribute) and only add a test, or define the key explicitly (effective rank = `rank + (rankBonus ?? 0)`, tie-break step) and test with a bonus on one row. Keep the extracted helper behaviour-preserving for non-free cases.

### F3 — I2/I3 — Other consumers of `disc.talents` by name not audited for free rows
- **Severity:** major
- **Problem:** Beyond the passes listed, several readers use model rows: `ed-disciplines.js:511` (`_disciplineKnackOptions` talentSet), `ed-combat.js:713` (`_talentResultMods`, first name match wins), `store.js:1489` (`combat.attackTalents`, highest rank), `ed-spells.js`/`ed-app.js` model `.find(name)` lookups (Spellcasting, Patterncraft, Thread Weaving). With a duplicate-name row (Thief option Call Missile + Archer free; two Standard Matrix) a `.find` returns the first match, which may be the free row or the learned one. `_talentResultMods` in particular can return the wrong row's mods. Edit flows in ed-app.js (:1216, :1246) read raw data, so they are safe, but the plan only claims this for rank editing.
- **Fix:** Add an I2 audit list of these call sites with a decision per site (acceptable / needs highest-rank selection), and a test for duplicate-name resolution in `_talentResultMods`/`attackTalents`. At minimum confirm Standard Matrix and Call Missile duplicates cannot yield a wrong roll mod.

### F4 — I2 — Pricing-pass skip and `circle` semantics need an explicit stored-row guard
- **Severity:** minor
- **Problem:** The pricing pass indexes `discInputs[di].talents[ti]` by position; the plan correctly appends free rows last. But later passes (`foldBonusIntoRow`, mods) rebuild/spread rows and nothing ensures the order is preserved elsewhere (e.g. any sort or `_talentGroups` regroup is UI-only). Also free rows set `circle` to the granting circle while learned rows' `circle` is a stored input; UI code that treats `t.circle` as a stored value (e.g. `tierForCircle`, edit controls) must not treat the free row as editable.
- **Fix:** Keep the `t.free` guard and add the index-alignment test already listed; also assert in the test that no free row has `pricing` non-null and that the learned-row count equals the raw count.

### F5 — I7 — Protected-doc edits and uncommitted RULES-FAQ.md
- **Severity:** minor
- **Problem:** I7 touches RULES-FAQ.md, which is currently modified in the working tree (git status). The plan notes it but gives no mechanism. T6's acceptance says "docs describe free rows", while I7 only proposes text, so the criterion cannot be fully met by the build.
- **Fix:** State that the build only writes proposed diffs to the build report and that T6 docs acceptance is satisfied on owner application; do not edit RULES-FAQ.md in the build.

## Checks that passed
- Completeness: T1-T6 each map to an item; sequencing valid (I5/I1 -> I2 -> I3 -> I4 -> I6/I7).
- Guardrails: no Tier-1 or Tier-2 surface; no stored field, engine DOM-free, advancement untouched.
- Rules grounding for R1-R6 is otherwise sound; R3/R6 (NOT-COVERED) have recorded owner Decisions.
- Manual verification of the mobile chip layout is called out for the owner (I3).

NEEDS_RULES: What does the Call Missile talent do (effect, range/limits, usable as a skill, tier) so the catalog summary and shortEffect can be written from a cited source?
