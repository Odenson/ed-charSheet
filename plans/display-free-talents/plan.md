---
status: building
---
# Delivery Plan: Display free talents (display-free-talents)

## Context & learnings
Disciplines grant "free talents" (Archer: Call Missile; Thief: Danger Sense; Nethermancer: two Standard Matrix) whose rank always equals the discipline's Circle. `rules/disciplines.json` lists them in `circles[].freeTalents`, but the sheet never renders them, so they cannot be seen or rolled. The feature derives them from rule data (nothing stored) and shows them on the Disciplines tab and in the Combat "Talent / Skill" picker.

Owner decisions (qa-log.md, rules.md):
- Free rows sit in the Circle 1 group with a small "Free" chip and a read-only rank (rank = that discipline's own Circle; every discipline the character has grants its free talents; R3).
- Nethermancer: two read-only Standard Matrix rows, no roll. Circle 5 Enhanced Matrix upgrade stays a note only (R5).
- Rollable free talents (those with a step) have full parity with learned talents (step/dice, Karma, Strain, info modal, thread/item rank bonuses) but no rank editing, no Legend cost (R1, R4).
- Same name via several routes: separate rows per discipline; a stored same-name talent in the SAME discipline suppresses the free row; the Combat picker dedupes by name using the highest rank (R6).
- Out of scope: the optional "Increasing Free Talent Ranks" rule, Circle advancement changes (free talents stay excluded, R2), option slots, any schema/character-data change.

## Discoveries
- `rules/disciplines.json`: `freeTalents` is a string array on circle entries (Archer :26, Nethermancer :98 `["Standard Matrix","Standard Matrix"]`, Thief :169). Duplicates are meaningful.
- `engine/talent-options.js`: `freeTalentSet(ref)` (name set, used by `optionSlots`), `disciplineTalentSet`, `UNIVERSAL_TALENTS`. `engine/advancement.js` imports `freeTalentSet` and deliberately ignores free talents; it and `countableTalents` take the RAW character talents, so adding model rows does not touch the gate (must stay that way: do not feed model rows to `circleStatus`).
- `store.js` build order for a discipline (`let disciplines = ...map`, ~:915-1063): `requiredTalents` already includes `freeTalents` names (:922-925), so free rows get `required: true`. Learned rows built from `d.talents` (:926-989) with catalog attribute/step/karma/rollStrain/brief/detail. Later passes that mutate model rows by name, all of which will pick free rows up automatically if they are in `disc.talents`: rank-grant fold `foldBonusIntoRow` (:1348), test-mods `applyTestMods` (:1725), action-mods `applyActionMod` (:1762), combat option pills (~:1215), knack parent rank (~:1580, :1629, :1734), `combat.attackTalents` (:1487).
- **Gotcha - pricing index alignment:** the pricing pass (:1428-1448) maps `disc.talents` and reads `discInputs[di].talents[ti]` BY INDEX. Free rows must be appended AFTER all learned rows and skipped in that pass (no pricing, or `pricing: null`), otherwise they read a wrong/missing raw entry and show an Increase price.
- `legend-spent.js` audits raw `character` talents (:330), so free rows never affect Legend-spent; `resolveRef('talent|...')` (:1119), `healthDisciplines` durability rank (:1083) and knack `parentTalents` (:1301) read raw character data and are intentionally untouched (free talents are not Durability; a knack gated on a free talent is a known gap, see Risks).
- `ui/ed-disciplines.js`: `_talentRow(t, discName)` (:269-299) renders info button, effect, rank (`_rankCtl` in edit mode, :332) , step, action, roll button; `_talentGroups` groups by `t.circle` (:1201); `.tinfo req|opt` status chip; legend row (:1266). `_talentModal` (:378) shows chips. Edit-mode rank events (`ed-edit-talent-rank`) are handled in `ui/ed-app.js:_editTalentRank` which finds the talent in the RAW character and no-ops if not found (safe, but the UI must not offer the control).
- `ui/ed-combat.js` `_allActions()` (:532-600) already iterates `model.disciplines[].talents`, skips rows with `step == null`, and dedupes by `talent:<name>` keeping the highest step; rollStrain, karma, rankBonus/grantSources, rollMods all come from the model row. So once free rollable rows are in the model, Combat inclusion largely falls out; the step tiebreak equals highest-rank for the same attribute.
- `rules/talents.json`: Call Missile (:290) has only `action: Simple` and `attribute: Perception` (no strain, presentation, summary). Danger Sense (:1976) is complete (Dexterity, Free, strain 1, shortEffect, summary). Standard Matrix (:2893) is complete (action NA, strain 0, no attribute, summary, shortEffect). Standard Matrix has no attribute so it never has a step.
- Tests live beside modules (`engine/*.test.js`, `store-*.test.js`, `ui/*.test.js` for pure helpers); `npm test` runs `node --test` after the import and UI-kit lints; `tools/rules-conformance.test.js` validates rules JSON.

## Guardrail classification
All items Tier 3 (derived data, data within existing schema/taxonomy, model-driven UI). Tier 1 rules to keep intact: engine pure/DOM-free and reading `freeTalents` as structured data, store only inputs (no new stored field, no schema/version change), UI renders model data and dispatches events only, theme-aware styling, no mobile overflow. No Tier-1 item, so no owner sign-off required. No Tier 2 (no taxonomy change; I5 adds only existing-vocabulary talent fields/effects).
Note: docs edits (UI-GUIDELINES.md, RULES-FAQ.md) are protected docs; in I7 they are proposed text for the owner to apply, per T6.

## Rules dependencies
| Rule | rules.md | Status | Used by |
|---|---|---|---|
| Free talent rank = Circle, no Legend, optional buy rule out of scope | R1 | ANSWERED | I1, I2 |
| Free talents excluded from advancement / option slots | R2 | ANSWERED | I1 (non-change) |
| Second discipline grants its free talents at its own Circle | R3 | NOT-COVERED, owner decision recorded | I1, I2 |
| Karma/Strain on free talents | R4 | ANSWERED | I2, I4 |
| Standard Matrix x2, Circle 5 upgrade note only | R5 | ANSWERED + owner decision | I1, I3 |
| Same name by several routes | R6 | NOT-COVERED, owner decision recorded | I1, I4 |
| Call Missile entry (strain 1, skillUse no, effect) | R7 | ANSWERED | I5 |

No open NEEDS_RULES.

## Implementation items
### I1 - Pure free-talent derivation (engine)
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R5, R6
- **Tier:** 3
- **What:** A pure function `freeTalentRows(ref, circle, storedNames)` returning `[{ name, rank: circle, circle: <granting circle>, free: true, discipline }]` for every `freeTalents` entry on circle entries with `c.circle <= circle`, duplicates preserved in data order. Returns `[]` when `circle` is not a positive number or `ref` is absent. Drops every row whose name is in `storedNames` (the discipline's own stored talents).
- **Where:** new `engine/free-talents.js` (+ `engine/free-talents.test.js`); reuses nothing from the DOM. Leave `freeTalentSet`, `engine/advancement.js`, `optionSlots` unchanged.
- **Approach:** Iterate `ref.circles` ascending; no regex, no string parsing of display text. `storedNames` is a Set built from raw `d.talents` names (same-discipline suppression). Export a small constant for the display chip text only if the UI needs it (otherwise none).
- **Dependencies:** none.
- **Acceptance criteria:** Archer Circle N gives Call Missile at rank N; Nethermancer gives two Standard Matrix at rank = Circle; Thief gives Danger Sense; a second discipline uses its own Circle; a stored same-name talent in that discipline suppresses the row, one in another discipline does not; Circle 0/null gives none; existing `advancement*.test.js` and `talent-options.test.js` pass unchanged (`circleStatus`, `countableTalents`, `optionSlots` results unchanged).
- **Risks / unknowns:** Which Circle the free row displays under for grants not at Circle 1 (none today); using the granting `c.circle` handles it.

### I2 - Free rows in the store model
- **Covers tickets:** T2
- **Rules:** R1, R3, R4
- **Tier:** 3
- **What:** For each discipline, append the I1 rows (after all learned rows) to `disciplines[].talents`, built with the same derived fields as learned rows: `attribute`, `action`, `step` (only when the catalog gives an attribute and the attribute step exists), `dice`, `karma` (only when a step exists, via `talentKarmaUse`), `rollStrain`, `required: true`, `brief`, `detail` (tier from `tierForCircle(t.circle)`), `arms: null`, plus `free: true` and `circle` = the granting circle. Pricing pass skips free rows.
- **Where:** `store.js` discipline map (~:926-989, refactor the per-row builder into a local function used for learned and free rows so fields cannot drift); pricing pass (~:1433-1448) must pass free rows through with `pricing: null` and must not shift the raw-index lookup; `storedNames` from `d.talents`.
- **Approach:** Extract the row builder (`buildTalentRow(t, { free })`) inside the `.map` closure; append free rows to the end of `talents` so learned indexes stay aligned with `discInputs[di].talents[ti]`; in the pricing pass, `if (t.free) return { ...t, pricing: null }`. Rank-grant fold, test-mod and action-mod passes then apply to free rows with no code change (verify by test). `combat.attackTalents`, combat-option pills and knack parent-rank derivation read model rows and will now see free rows; confirm that is acceptable (it is: the character really has the talent). Do not touch `circleStatus`, `optionSlots`, `knownNames`, `nextGrant` inputs (raw `d.talents`).
- **Dependencies:** I1, I5 (for non-empty catalog data on Call Missile).
- **Model-row consumer audit (build step, decision per site):**
  - `store.js` `combat.attackTalents` (~:1487-1489, highest rank): acceptable; free rows are real talents. Add a test with Thief option + Archer free Call Missile: the highest-rank row is used.
  - `ui/ed-combat.js` `_talentResultMods` (~:713, first name match wins): NEEDS FIX or proof. Either select the highest-step row among same-name matches, or prove rollMods are identical across same-name rows (mods fold by name, so they should be). Test duplicate-name resolution (Thief option + Archer free; two Standard Matrix) returns the same mods regardless of row order.
  - `ui/ed-disciplines.js` `_disciplineKnackOptions` talentSet (~:511): acceptable (name set; duplicates harmless).
  - `.find(name)` lookups in `ui/ed-spells.js` / `ui/ed-app.js` (Spellcasting, Patterncraft, Thread Weaving): confirm none of these names is a free talent today (they are not), so duplicate rows cannot change results; record as acceptable, with a note to re-audit if a free talent of that name is ever added.
  - Edit flows `ui/ed-app.js` (~:1216, :1246) read RAW character data: safe, free rows are never found there and no control is offered.
  - Standard Matrix has `step: null`, so no roll path reads it; confirm no duplicate-name matrix row can yield a wrong roll mod.
- **Stored-row guard:** `t.free` rows are never read by position from raw inputs; the pricing pass skips them and they are appended last, and nothing reorders `disc.talents` in the store (`_talentGroups` regroup is UI-only). UI code must key editability off `t.free`, not off `t.circle` (free rows' `circle` is derived, not stored); do not feed free rows to `tierForCircle` edit controls.
- **Acceptance criteria:** Call Missile row has Perception step at rank = Circle, Karma, strain 1 once catalog supplies it; Standard Matrix rows have `step: null`, `karma: null`, no roll; a thread/item `grant-ability` rank bonus on Danger Sense folds (`rankBonus`, `stepBase`); no free row carries a price; Legend-spent audit totals and `circleStatus` for the Archer/Thief/Nethermancer fixtures are identical before and after; stored learned rows keep correct pricing (index alignment test with a free row present); in that test, assert no free row has non-null `pricing` and that the count of learned (non-free) rows equals the raw `d.talents` count; the consumer audit above is complete with tests for duplicate-name resolution.
- **Risks / unknowns:** (a) Index alignment (above). (b) Knack/parent gating: `learnableKnacks` `parentTalents` reads raw character (store.js ~:1301), so a knack requiring a free talent would not be learnable while a model-derived parent rank exists; none exist today for free talents, record as known gap rather than widen scope. (c) `resolveRef('talent|...')` homebrew refs ignore free ranks; same note.

### I3 - Disciplines tab rendering
- **Covers tickets:** T3
- **Rules:** R5
- **Tier:** 3 (stays inside UI-GUIDELINES; model-driven)
- **What:** Render free rows in the Circle 1 group (their `circle`) with a small "Free" chip and read-only rank. Rollable ones keep the roll button; non-rollable (Standard Matrix) show "-" step and a disabled roll exactly like any step-less talent. Info modal works and shows a "Free" chip. Edit mode: no rank stepper for free rows (render the plain rank), no remove control. Optionally add "free" to the legend row.
- **Where:** `ui/ed-disciplines.js` `_talentRow` (:269), `_talentModal` (:378), legend (:1266), styles near `.tinfo` (:145) using existing CSS variables only.
- **Approach:** `t.free` toggles: chip next to `.lbl` (reuse the existing small-pill pattern/`--accent-bg`/`--accent`, no new weights, 400/500 only); in edit mode render the non-editable rank branch; modal chip `{ v: 'Free' }` and status wording "free Discipline talent". No computation in the UI; it only reads `t.free`. Duplicate names render as two rows (no keyed dedupe; lit templates are unkeyed).
- **Dependencies:** I2.
- **Acceptance criteria:** Chakka's Archer shows Call Missile at his Circle with a Free chip and a working roll; a Nethermancer shows two Standard Matrix rows, no roll; edit mode shows no rank stepper on free rows; light and dark mode correct; no overflow at mobile width (chip must not break the `.trow` grid, which hides the Effect column on mobile).
- **Risks / unknowns:** Chip width in the narrow `tname` cell on mobile; verify visually (owner test) since this is Tier-1 UI contract surface.

### I4 - Combat picker inclusion
- **Covers tickets:** T4
- **Rules:** R4, R6
- **Tier:** 3
- **What:** Ensure rollable free talents appear in the Combat "Talent / Skill" picker, deduped by name with the highest rank, and non-rollable never appear.
- **Where:** `ui/ed-combat.js` `_allActions()` (:532-600). Likely no behavioural change needed: it already loops model talents, drops `step == null`, and dedupes by `talent:<name>` keeping the higher step.
- **Approach:** Keep the existing step tiebreak. For same-name talents sharing one attribute (Call Missile is always Perception), higher effective rank means higher step, so "highest step" equals "highest rank" (R6) and no behaviour change is needed. Because `rank` on a model row is the base rank (bonus lives in `rankBonus`/`stepBase`), do NOT switch the key to `rank`. Only extract the dedupe into a small DOM-free helper (e.g. `ui/combat-actions.js`, with `ui/combat-actions.test.js`) if needed for testing, strictly behaviour-preserving; cover it with a test where one of two same-name rows carries a rank bonus and the higher-step row wins, with its `karma`/`rollStrain`. Rolling passes `rollStrain` and `karma` as for learned talents (already does).
- **Dependencies:** I2.
- **Acceptance criteria:** Chakka can pick Call Missile and roll it with its step, Karma and Strain; Thief option Call Missile + Archer free Call Missile appears once at the higher rank; Standard Matrix never appears; weapon-category filtering (`attackTalentNamesFor`) unchanged.
- **Risks / unknowns:** Extracting a helper touches working picker code: keep the extraction behaviour-preserving and covered by the test.

### I5 - Catalog completion for free talents
- **Covers tickets:** T5
- **Rules:** R4
- **Tier:** 3 (data within the existing talent schema/taxonomy; our own paraphrase, no verbatim rulebook text)
- **What:** Fill `rules/talents.json` Call Missile (currently only `action: Simple`, `attribute: Perception`) from R7 (Q037): add `strain: 1`, `skillUse: { allowed: false }`, `presentation.shortEffect` and a paraphrased `summary` (test result sets how many of the adept's own unbroken missiles/thrown weapons return to quiver/container/hand, within Rank x 20 yards, straight unblocked path; pulls missiles out of targets; secured/locked-away objects cannot be retrieved). No `versus`/difficulty (R7: none). Leave `tier` following the existing catalog convention for comparable entries (do not invent a tier from R7; Archer free / Thief Journeyman option is not a single tier). Verify Danger Sense and Standard Matrix are complete (they appear to be). Do not add an attribute to Standard Matrix.
- **Where:** `rules/talents.json` (:291 Call Missile). Source: R7 / `docs/RULES-FAQ.md` Q037 (PG:4622-4633, text-talents-players.txt:126-129). Own paraphrase, no verbatim rulebook text.
- **Approach:** Follow the Danger Sense field layout (:1977-1999) for `presentation`/`summary`/optional `note` effect, but with `skillUse.allowed: false` per R7. Keep any `effects` to existing taxonomy vocabulary. No `effectTaxonomy` or schema tag changes. Check how the catalog handles `tier`/`skillUse.tier` for entries with `allowed: false` and copy that convention.
- **Dependencies:** none (parallel with I1).
- **Acceptance criteria:** Each of the three free talents has a brief and a detail summary; Call Missile matches R7 (strain 1, skillUse not allowed, Simple, Perception); `node --test tools/rules-conformance.test.js` passes.
- **Risks / unknowns:** None open; R7 covers the content.

### I6 - Tests
- **Covers tickets:** T6 (tests)
- **Rules:** R1-R6
- **Tier:** 3
- **What:** `engine/free-talents.test.js` (I1 cases); `store-free-talents.test.js` (I2: Archer/Thief/Nethermancer model rows, second-discipline Circle, same-discipline suppression, cross-discipline duplicate, rank-grant fold, pricing-index alignment, `circleStatus`/Legend-spent unchanged, no mutation of `character`); picker test for I4.
- **Where:** `engine/`, repo root (alongside `store-*.test.js`), `ui/`.
- **Approach:** Follow existing `store-ranks.test.js` / `advancement.test.js` fixture style. Run the full `npm test`.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** `npm test` passes, including lint:imports and lint:ui-kit pretest.
- **Risks / unknowns:** none notable.

### I7 - Docs (proposed text for the owner)
- **Covers tickets:** T6 (docs)
- **Rules:** none
- **Tier:** 3
- **What:** Prepare proposed edits, for the owner to apply, to `docs/UI-GUIDELINES.md` (Disciplines tab: Free rows/chip/read-only rank; Combat: rollable free talents in the picker), a `docs/RULES-FAQ.md` Q036 cross-reference to the new rows, and an `ARCHITECTURE.md` note that free talents are derived model rows (engine/free-talents.js). Also update the header comment of `engine/advancement.js`/`talent-options.js` only if they become misleading (they should not).
- **Where:** the listed docs; the build writes the proposed diffs ONLY into the build report. It must not edit `docs/RULES-FAQ.md` (uncommitted owner changes in the working tree) or the other protected docs.
- **Approach:** Text only; no behavioural change.
- **Dependencies:** I3, I4.
- **Acceptance criteria:** The build report contains exact proposed diffs describing free rows and Combat inclusion, matching shipped behaviour. T6's "docs describe free rows" criterion is satisfied once the owner applies them (recorded as an owner action, not a build gate).
- **Risks / unknowns:** None beyond the owner-applied step.

## Sequencing
1. I5 (catalog data) and I1 (engine) in parallel: independent and unblock the store.
2. I2 (store model): needs I1 and I5; highest-risk item (index alignment), land with its test.
3. I3 (Disciplines UI) and I4 (Combat picker): both consume the model rows; do I3 first so the rows are visible for manual check, then I4.
4. I6 tests accompany each item as written, with the full `npm test` pass at the end.
5. I7 docs last, once behaviour is final.

## Open questions
- Whether the "Free" chip should replace or sit beside the required `i` marker (default: keep the required `i`, since free talents are `required: true`, and add the chip).
- Known gaps recorded, not fixed (non-goals): knack parent gating and homebrew `talent|` refs read raw character data and ignore free talents.

## Review responses
- **F1 (blocker, Call Missile content ungrounded):** Fixed. R7 (Q037) now backs I5: strain 1, skillUse not allowed, paraphrased summary/shortEffect; tier left to catalog convention. NEEDS_RULES closed.
- **F2 (major, dedupe rank vs step):** Fixed. Plan keeps the step tiebreak (equals highest rank for same-name, same-attribute talents) and adds a test with a bonus on one row; helper extraction only if behaviour-preserving.
- **F3 (major, unaudited consumers):** Fixed. I2 now has a per-site audit list with decisions and duplicate-name tests (`_talentResultMods`, `attackTalents`, Standard Matrix).
- **F4 (minor, stored-row guard):** Fixed. I2 adds the stored-row guard note and the extra test assertions (no free pricing, learned count equals raw count).
- **F5 (minor, protected docs):** Fixed. I7 states the build only writes proposed diffs to the build report, does not touch RULES-FAQ.md; T6 docs acceptance is met on owner application.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
