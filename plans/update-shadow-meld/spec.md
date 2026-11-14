# Tech Spec: Update Shadow Meld (update-shadow-meld)

## Overview
Data-only change. `rules/spells.json` "Shadow Meld" gains a success-level option, two extra-thread options, a default-skill `note` effect and book-aligned description/summary text, copying the Soul Armor shapes. A new `engine/shadow-meld.test.js` pins the shapes against the existing fold (`buildActiveSpell`). `docs/TAXONOMY-AUDIT.md` gets finding T-052 (no way to grant a skill/talent as default). No engine, UI, taxonomy or schema change.

## Guardrail alignment
- `rules/spells.json` entry, new test file: Tier 3 (fits existing schema and taxonomy; no new vocabulary, no version bump).
- `docs/TAXONOMY-AUDIT.md` T-052: Tier 3 (docs). The future remedy is Tier 2 and is not done here.
- No Tier 1 or Tier 2 item; no sign-off needed. Data-down/dispatch-up, pure engine, store-only-inputs and placeholder pills are untouched (no derived value stored; nothing in `ui/*` or `engine/*` edited).
- Working tree has unrelated uncommitted edits to `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js` and `docs/TAXONOMY-AUDIT.md`. Do not touch or bundle them. The only allowed touch is the targeted T-052 insertion in the audit doc.

## Design
### Data / types
Edit only the `"Shadow Meld"` block (~line 526-558) of `/Users/garyfebbrarino/Work/workspace/EDCharSheet/rules/spells.json`:

- `successes`: one entry, copied from Soul Armor:
  `{label:"Increase Duration (+2 minutes)", effects:[{type:"duration-modifier", operation:"add", value:2, measure:"minutes", source:"spell", summary:"Increase Duration (+2 minutes)", condition:"on-success", perSuccess:true}]}`
- `extraThreads`:
  1. `{label:"Increase Duration (+2 minutes)", effects:[{type:"duration-modifier", operation:"add", value:2, measure:"minutes", source:"spell", summary:"Increase Duration (+2 minutes)"}]}`. It has no `duration` field, as in Soul Armor.
  2. `{label:"Increase Effect (+2 Stealthy Stride)", effects:[{type:"test-modifier", target:{domain:"test", name:"Stealthy Stride"}, operation:"add", value:2, measure:"step", duration:"sustained", condition:"always", source:"spell", summary:"Increase Effect (+2 Stealthy Stride tests while near shadows)"}]}`.
  **The target, `measure:"step"` and `duration:"sustained"` must be identical to the base effect.** Otherwise `isStandaloneOptionEffect` treats it as a separate standalone effect instead of boosting the base.
- Base `effects[0]` (test-modifier, +4): keep the target, `measure:"step"` and `duration:"sustained"`. Add `condition:"always"` explicitly, because `autoApplies` accepts an absent or "always" condition. Summary: "+4 steps to Stealthy Stride tests while near shadows." Do not add a `scope` field.
- Add `{type:"note", source:"spell", gmDiscretion:false, summary:"May use Stealthy Stride as a default skill if not possessed."}`. Mirror the Casual Murderer note shape (~line 4080-4135); use `gmDiscretion:true` only if that mirrors it or conformance requires it. The note has no `duration`, so it is not folded into the active record (`sustainedEffectsOf` keeps only sustained effects).
- `description` and `summary`: state the following.
  - +4 to all Stealthy Stride tests while near shadows. The player judges "near shadows"; the roll modifier is always applied.
  - Stealthy Stride may be used as a default skill.
  - Ordinary light does not end the spell.
  - Stepping back into shadow makes the target nearly invisible again.
  - Success and thread options: +2 minutes, or +2 to the bonus.
- Keep `threadsToWeave:1`, weaving 5 / reattune 10, Target's Mystic Defense, Touch, "Rank minutes" and `area:null` unchanged.

### Modules & functions
- Changed: `rules/spells.json` (Shadow Meld block only).
- Added: `engine/shadow-meld.test.js`. It uses `node:test` and `node:assert`, and reads `rules/spells.json` with `fs`. It imports read-only:
  - `buildActiveSpell`, `appliedOptions`, `boostedDuration`, `sustainedEffectsOf` from `engine/spells.js`.
  - `autoApplies` from `engine/characteristics.js` (line ~55).
- Changed: `docs/TAXONOMY-AUDIT.md`. Targeted Edit calls only, after re-reading the file (see UI / behavior and Edge cases).

### UI / behavior
- No code change. `ui/ed-spells.js` already renders `successes` and `extraThreads` through the generic cast and option flow. It appears to show only `description ?? summary` for the spell text, and probably does not show `note` effects (lines ~966 and ~1214, per plan). The default-skill grant therefore must also appear in `description`.
- Runtime result:
  - Picking Increase Duration (success or thread) lengthens the duration readout by +2 minutes.
  - Picking Increase Effect raises the folded Stealthy Stride bonus from +4 to +6, +8, and so on.
  - The bonus reaches the Stealthy Stride roll through `abilityTestMods` in `store.js` (~1606-1617), which gates on `autoApplies`.
  - Theme, modal and Overview behavior are unaffected.
- Manual owner verification (cannot be covered by `node:test`):
  - The Spells tab shows the success and the two thread options, in light and dark themes.
  - Picking them updates the duration and the bonus.
  - The default-skill text is visible in the description.
  - Whether the `note` effect is displayed. If it is not, flag it for the owner; do not edit the UI.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Circle, threads, weaving, cast, range, duration | Nethermancer Circle 1; 1 thread; weaving 5 / reattune 10; vs Mystic Defense (TMD); Touch; Rank minutes | R1, PG p. 321, Q028 |
| Base effect | +4 to all Stealthy Stride tests while near shadows; always rolled in (owner option 3) | R1, R4, PG p. 321 |
| Default skill | May use Stealthy Stride as a default skill; modelled as a `note` only | R1, R6 |
| Light and shadow | Light does not end the spell; near-invisible again on stepping back into shadow | R1 |
| Success level | Increase Duration: +2 minutes per extra success | R2, PG p. 321 |
| Extra threads | Increase Duration +2 minutes; Increase Effect +2 bonus (+4 becomes +6, +8, ...) | R3, PG p. 321 |
| Extended Shadow Meld knack | Out of scope | R5 |

All APP-DIFFERS items (R1 to R3) carry the owner Decision "follow the book", recorded in rules.md. Test expectations come only from this table plus the engine's duration conversion: 1 minute = 10 rounds, so +2 minutes = +20 rounds. Rank-1 base duration = 10 rounds.

### Edge cases & invariants
- `successLevels: 1` gives no extra success, so no duration boost. Only `successLevels - 1` extra successes count.
- Multiple Increase Effect picks stack: 2 picks give +4+2+2 = 8. They stay on one Stealthy Stride effect with no duplicate entry.
- The Increase Effect effect and the base effect are both `autoApplies` (`condition:"always"`, no `gmDiscretion`).
- The `note` effect must not enter the active record's effects.
- No other spell entries change. `tools/rules-conformance.test.js` and `npm test` stay green.
- Audit doc T-052. Re-locate every line by text, because line numbers drift.
  - Add a summary-table row after the T-051 row (~line 112).
  - Add a finding entry after T-051's entry (~817) and before "Accepted / deliberate deviations".
    - Format: S3, Tier 3 (docs/log) with Tier 2 remedy, Status open, Area taxonomy/data.
    - Observed: no effect type or domain can grant a talent or skill as usable by default (Shadow Meld's Stealthy Stride, PG p. 321); modelled as a display-only `note`.
    - Remedy options: a new effect type or operation (Tier 2: doc version bump, migrate rules, schema and `effectTaxonomy` refs) or a documented `note` convention.
  - Change "51 findings" to 52 in the status header (~line 9) and in "Result at a glance" (~line 56). In the same place, add a note that T-052 was added 2026-10-05.
  - At ~line 185, add that T-052 was added later than the 2026-10-04 re-validation.
  - Add a Log row dated 2026-10-05.
  - Leave the dated re-validation section (~line 745) untouched.
  - Leave unrelated "51" counts, such as the conditions count in the appendix (~971), untouched.
  - Verify with `git diff` that only additions are mine.

## Testability notes
`engine/shadow-meld.test.js`, rank-1 caster, with no store and no DOM. The pick shape is `extraPicks: string[]` of labels (as in `buildActiveSpell` and `castBoosts`), and `successLevels` is a number.
- Shape: `successes[0]` and both `extraThreads` labels exist, with the effect shapes above. The base and the Increase Effect effect are `test-modifier` on `{domain:"test", name:"Stealthy Stride"}`, step, sustained, `always`. `autoApplies` is true for both.
- `buildActiveSpell(spell, 1, {successLevels: 2})` gives `roundsTotal` 30 (10 + 20).
- `buildActiveSpell(spell, 1, {extraPicks: ["Increase Duration (+2 minutes)"]})` gives `roundsTotal` 30.
- `buildActiveSpell(spell, 1, {extraPicks: ["Increase Effect (+2 Stealthy Stride)"]})` gives exactly one Stealthy Stride effect of value 6, with no standalone duplicate. This locks the matching requirement.
- Two Increase Effect picks give value 8.
- The `note` effect is not in the active record's effects; `sustainedEffectsOf` returns only the +4 effect.
- Run the whole suite with `npm test`.

UI rendering is for the owner's manual verification only (see UI / behavior).

## Changelog entry
Shadow Meld now matches the Player's Guide: it has a +2 minutes duration option on extra successes and extra threads, an Increase Effect thread that raises the Stealthy Stride bonus by 2, and a note that Stealthy Stride works as a default skill.

## Out of scope
- Extended Shadow Meld knack (DS p. 425).
- Any new taxonomy term or version bump; any fix for the default-skill gap beyond logging T-052.
- Engine or UI changes, and a situational "near shadows" roll toggle. The text caveat only, per owner option 3.
- The unrelated uncommitted edits in `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js` and the existing diff in `docs/TAXONOMY-AUDIT.md`.
