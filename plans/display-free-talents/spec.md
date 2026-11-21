# Tech Spec: Display free talents (display-free-talents)

## Overview
A new pure engine helper `freeTalentRows(ref, circle, storedNames)` derives each discipline's free-talent rows from `rules/disciplines.json` `circles[].freeTalents` (rank = the discipline's Circle). `store.js` `deriveModel` appends them after the learned rows of each `disciplines[].talents` using one shared row builder, flagged `free: true`, with `pricing: null`. The Disciplines tab renders them (Circle 1 group, "Free" chip, read-only rank). The Combat picker needs no behavioural change because `_allActions()` already iterates model talents. `rules/talents.json` Call Missile is completed from R7. Nothing is stored and there is no schema change.

## Guardrail alignment
All Tier 3 (derived rows, data inside the existing talent schema/taxonomy, model-driven UI); no Tier 1 sign-off or Tier 2 ceremony needed (plan.md "Guardrail classification"). Confirmed:
- The engine module is pure and DOM-free and reads `freeTalents` as structured data.
- Store-only-inputs holds: free rows are derived, with no new stored field, no `ed-character` version change and no taxonomy change.
- Data flows down through render. The UI only reads `t.free` and dispatches nothing new.
- Unknown steps keep the existing "—" placeholder (Standard Matrix).
- `circleStatus`, `countableTalents`, `optionSlots` and `legend-spent.js` keep reading RAW `d.talents`. Model rows must never be fed to them.
- Docs (UI-GUIDELINES, ARCHITECTURE, RULES-FAQ) are protected. The build only writes proposed text into the build report (I7).

## Design
### Data / types
- Character data: none.
- Model row (derived, not stored) gains `free: true` on free rows only (absent or falsy on learned rows). Its `circle` is the GRANTING circle (derived), unlike learned rows where `circle` is a stored input.
- `rules/talents.json` Call Missile (:290-294), additive within the existing schema:
  - `strain: 1`
  - `skillUse: { "allowed": false }`
  - `presentation: { "shortEffect": "<short>" }`
  - `summary`: own paraphrase of R7 (no verbatim rulebook text): the test result sets how many of the adept's own unbroken missiles/thrown weapons return to quiver/container/hand, within Rank x 20 yards, straight unblocked path; pulls missiles out of targets; secured or locked-away objects cannot be retrieved.
  - No `versus`.
  - No catalog `tier`: R7 gives no single tier, and `detail.tier` is derived from the Circle (`tierForCircle`) anyway.
  - `action: Simple` and `attribute: Perception` stay.
- Danger Sense (:1976) and Standard Matrix (:2893) are already complete. No attribute is added to Standard Matrix.

### Modules & functions
1. NEW `engine/free-talents.js`
   - `export function freeTalentRows(ref, circle, storedNames = new Set())`
   - Returns `[{ name, rank: circle, circle: c.circle, free: true }]`. Iterate `ref.circles` ascending by `c.circle`, take those with `c.circle <= circle`, and emit one row per `c.freeTalents` entry in data order, duplicates preserved.
   - Returns `[]` if `ref` is falsy or `circle` is not a finite number > 0.
   - Drops any row whose `name` is in `storedNames` (a Set of the same discipline's stored talent names).
   - Pure, no imports from DOM, store or UI.
   - Do NOT change `freeTalentSet`, `optionSlots` or `engine/advancement.js`.
2. `store.js` discipline map (`let disciplines = ...map`, ~:915-1063)
   - Extract the per-row body of `(d.talents ?? []).map((t) => {...})` into a local `buildTalentRow(t)` inside the discipline closure, so learned and free rows share attribute/step/karma/strain/arms/brief/detail logic. For free rows pass `t = { name, rank, circle }` (no `viaVersatility`).
   - `talents = [...learnedRows, ...freeRows]`, with free rows appended LAST. `freeRows = freeTalentRows(ref, d.circle, new Set((d.talents ?? []).map((x) => x.name))).map((f) => ({ ...buildTalentRow(f), free: true }))`.
   - Free rows get `required: true` through the existing `requiredTalents` set.
3. `store.js` pricing pass (~:1428-1448): in `disc.talents.map((t, ti) => ...)`, add `if (t.free) return { ...t, pricing: null };` before the raw-index read. Learned rows keep `discInputs[di].talents[ti]` alignment because free rows are last.
4. `ui/ed-disciplines.js`
   - `_talentRow` (:269): when `t.free`, add a `<span class="fchip">Free</span>` after `.lbl`. In edit mode, render the plain read-only rank (the same `<span class="num">` branch as non-edit) instead of `this._rankCtl`. Use `t.free`, never `t.circle`, to decide editability. The `status` string becomes `'free Discipline talent'` for the info button aria-label and title.
   - `_talentModal` (:378): add a `{ v: 'Free' }` chip when `t.free`, and show `Free` instead of `Required` (do not show both).
   - Legend (:1266): optionally add `<span class="li"><span class="fchip">Free</span>granted by Discipline</span>`.
   - CSS near `.tinfo` (:147): a small `.fchip` pill using only existing variables (`--accent`, `--accent-bg`, `--muted`), font-weight 400/500 only, `flex: none`, small font and padding, so it does not break the `.trow` grid. Verify at mobile width.
   - `_talentGroups` (:1201) needs no change: free rows group by their derived `circle` (1).
5. `ui/ed-combat.js`
   - `_allActions()` (:532): no behaviour change. It already drops `step == null` rows and dedupes `talent:<name>` by highest step. For same-name rows on the same attribute, highest step equals highest rank (R6). Do NOT switch the key to `rank`.
   - Optional behaviour-preserving extraction of the push/dedupe into a DOM-free `ui/combat-actions.js` (+ test) only if needed for testing.
   - `_talentResultMods(name)` (:713) returns the first name match. Either make it pick the same row `_allActions` picks (highest step among same-name rows), or prove in a test that `resultMods` are identical across same-name rows. Mods fold by name, so they should be identical. Pick whichever is smaller. Duplicate-name resolution must not depend on row order.
6. Consumer audit (record the decision in build notes, no code unless a test fails)
   - `store.js` `combat.attackTalents` (~:1487): highest rank, acceptable.
   - `ui/ed-disciplines.js` `_disciplineKnackOptions` (~:511): name set, acceptable.
   - `ui/ed-spells.js` / `ui/ed-app.js` `.find(name)` lookups (Spellcasting, Patterncraft, Thread Weaving): none of these is a free talent today, so acceptable. Re-audit if one is ever added.
   - `ui/ed-app.js` edit flows (~:1216, :1246) read RAW character data: safe, and no control is offered.
   - Known gaps (not fixed): knack `parentTalents` gating (`store.js` ~:1301), `resolveRef('talent|...')` (~:1119) and `healthDisciplines` read raw data and ignore free talents.

### UI / behavior
- Disciplines tab: free rows sit in the Circle 1 group (their derived `circle`) after learned Circle 1 rows. They show the required `i` marker, the name with a "Free" chip, the brief effect, a read-only rank (rank bonus/mod chips still render via `_grantChip`/`_modChip`), step/dice, action and the roll button.
- Call Missile and Danger Sense roll exactly like learned talents (`_rollDetail`: step, Karma context, `rollStrain`, result mods).
- Standard Matrix (x2) shows "—" step and a disabled roll, like any step-less talent.
- Edit mode: no rank stepper and no remove control on free rows. The existing `ed-edit-talent-rank` handler is never fired for them.
- Info modal: Free chip; summary and notes come from the catalog.
- Combat tab: rollable free talents appear in "Talent / Skill" via the existing code. Duplicates appear once at the highest step, and Standard Matrix never appears.
- Theme: the chip uses theme variables (light + dark). No new modal and no Overview change. No mobile overflow: the chip must not widen `.tname` enough to break the `.trow` grid, which hides the Effect column on mobile (manual owner check).

### Rules
| Rule | Value / formula | rules.md id and source |
|---|---|---|
| Free talent rank | rank = the discipline's Circle; no Legend cost; optional buy-above-Circle rule NOT modelled | R1 (Q036; PG:2905-2920) |
| Advancement / option slots | free talents do not count toward Circle advancement and occupy no option slot; code unchanged | R2 (Q036, Q002, Q030) |
| Second discipline | every discipline the character has grants its free talents at its own Circle | R3 (owner decision 2026-11-21) |
| Karma / Strain | Karma allowed on rollable free talents; Strain is the talent's own (Call Missile 1, Danger Sense 1, matrices 0); matrices are NA and unrolled; threads may be woven to them | R4 (Q036; PG:2909-2911, 4141-4149) |
| Standard Matrix | two free Standard Matrix rows at rank = Circle, display only; Circle 5 Enhanced Matrix upgrade is a note only, no row | R5 (Q036; owner decision) |
| Same name via several routes | separate rows per discipline; a stored same-name talent in the SAME discipline suppresses the free row; the Combat picker dedupes by name, highest rank | R6 (owner decision) |
| Call Missile entry | Simple action, Step = Rank + Perception, Strain 1, Skill Use No; effect as paraphrased above; no versus | R7 (Q037; PG:4622-4633) |

### Edge cases & invariants
- Circle 0, null or non-numeric, or a missing `ref` (unknown discipline), gives no free rows.
- Duplicate free names (Standard Matrix x2) render as two rows. Lit templates are unkeyed, so this is fine.
- A stored same-name talent in the same discipline suppresses the free row. One in another discipline does not.
- Thief Call Missile option plus Archer free Call Missile gives two rows, both rank = own Circle or stored rank. The Combat picker shows one entry (higher step), carrying that row's `karma` and `rollStrain`.
- Free rows have `pricing: null` and are always the last entries of `talents`. Count of non-free rows equals raw `d.talents.length`.
- Legend-spent totals and `circleStatus` / `countableTalents` / `optionSlots` results are identical with and without free rows. `character` is not mutated.
- A thread/item `grant-ability` rank bonus on a free talent folds like a learned one (`rankBonus`, `stepBase`, `grantSources`).
- Free rows have `step: null` and `karma: null` when the catalog gives no attribute. A step requires a catalog attribute and an existing attribute step.

## Testability notes
- `engine/free-talents.test.js` (node:test), using inline fixtures and the real `rules/disciplines.json`:
  - Archer, Thief and Nethermancer rows.
  - Rank = Circle across Circles 1..N.
  - Second-discipline Circle.
  - Same-discipline suppression versus cross-discipline non-suppression.
  - Circle 0/null/NaN and missing `ref` return `[]`.
  - Duplicates preserved and order stable.
- `store-free-talents.test.js` at the repo root, in the `store-ranks.test.js` style (real rules files, `deriveModel`):
  - Model rows and `free` flag for Archer, Thief and Nethermancer.
  - Call Missile: Perception step, Karma, strain 1.
  - Standard Matrix: `step: null`, `karma: null`.
  - Rank-grant fold on Danger Sense.
  - Index alignment with pricing: every free row has `pricing: null`, learned pricing is correct, and the non-free count equals the raw count.
  - `circleStatus` and Legend-spent unchanged.
  - Thief option plus Archer free duplicate, with `attackTalents` taking the highest rank.
  - Input `character` deep-equal before and after.
- Picker/dedupe test (`ui/combat-actions.test.js` if extracted; otherwise via the store model): same-name rows, one carrying a rank bonus, where the higher-step row wins along with its karma/strain. Also test `_talentResultMods` duplicate-name resolution.
- `tools/rules-conformance.test.js` must pass for the Call Missile edit. Full `npm test` (including the lint:imports and lint:ui-kit pretests) must pass.
- Manual owner verification (not unit-testable): Free chip look in light and dark, mobile overflow, edit-mode absence of steppers, a real Call Missile roll from the Disciplines and Combat tabs on Chakka.

## Changelog entry
`{"type": "added", "text": "Disciplines now show their free talents (Archer's Call Missile, Thief's Danger Sense, Nethermancer's two Standard Matrices) at the Discipline's Circle, and rollable ones can be rolled from the Disciplines and Combat tabs."}`

## Out of scope
- Rank editing, Legend cost and the optional "Increasing Free Talent Ranks" rule (Companion p.435).
- Changes to Circle advancement or option slots (free talents stay excluded).
- An Enhanced Matrix row for Nethermancer Circle 5 (note only).
- Free talents for disciplines not yet in `rules/disciplines.json`.
- Any change to character data, schema or taxonomy.
- Knack parent gating and homebrew `talent|` refs for free talents (known gaps).
- Editing protected docs (UI-GUIDELINES, ARCHITECTURE, RULES-FAQ): proposed text only, in the build report.
