# Test Plan: Talent info bubbles (talent-info-bubbles)

## Test files
store-talent-picker-detail.test.js

## Coverage
Shared helper `assertPickerTalent(item, circle, required)` checks: exact key set
`{name, required, brief, action, attribute, detail}`; `brief`/`action`/`attribute` equal the
catalog's `presentation.shortEffect` / `action || null` / `attribute || null`; `detail` has exactly
`{summary, versus, strain, tier, skillUse, effects, documented}` (no `notes`); `detail.tier ===
tierForCircle(circle, legend costs)` (the function's output, never a literal); `detail.effects` equals
the catalog effect summaries; the other detail fields equal the catalog values.

### store-talent-picker-detail.test.js::edit-mode option slots: every learnable is a PickerTalent with the slot-Circle tier
- **Validates:** I1, `model.disciplines[].optionSlots[].learnable` (spec "slots") are PickerTalents, `required: false`, tier from the slot's Circle. Fixture Archer Circle 6 spans Novice and Journeyman slots.
- **Rule:** n/a (rules.md: no rule asserted; tier is compared to `tierForCircle`)
- **Why:** catches a hard-coded Circle 1 tier for higher slots, a missing field, or a leftover `notes` key.

### store-talent-picker-detail.test.js::Add Discipline / Seed: grants stays string[]; grantItems parallels it with required: true
- **Validates:** I1, new `grantItems`: same length/order as `grants`, `required: true`, Circle-1 detail; `grants` still `string[]`.
- **Rule:** n/a
- **Why:** catches replacing `grants` (breaks `ui/ed-app.js:1984`) or mis-ordered/mis-flagged grant items.

### store-talent-picker-detail.test.js::Add Discipline / Seed: every candidate exposes grantItems matching grants
- **Validates:** I1 for every addable candidate (new and seed modes).
- **Rule:** n/a
- **Why:** catches `grantItems` added only on one code path.

### store-talent-picker-detail.test.js::Add Discipline / Seed: option pool items are PickerTalents with required: false, Circle-1 tier
- **Validates:** I1, `optionPool.items`.
- **Rule:** n/a
- **Why:** catches the Start-modal options lacking `detail`.

### store-talent-picker-detail.test.js::Anticipate Blow (Warrior novice pool) carries its catalog effects, strain, action and attribute
- **Validates:** spec Testability: concrete values for one talent (text copied from `rules/talents.json`).
- **Rule:** n/a (catalog text only, per rules.md)
- **Why:** pins the exact effects list and fields a picker detail shows.

### store-talent-picker-detail.test.js::a catalog talent with no effect summaries gets effects: [] (not undefined)
- **Validates:** edge case `detail.effects` is `[]`, nulls for absent strain/brief/attribute (catalog entry replaced with an `Acting`-like one).
- **Rule:** n/a
- **Why:** catches `effects: undefined` (the modal guards on `.length`, but the contract is an array).

### store-talent-picker-detail.test.js::creation "+ add option": candidates are PickerTalents with the Circle-1 tier
- **Validates:** I1, `model.creation.talents.option.candidates` (Human Warrior via `buildNewCharacter`).
- **Rule:** n/a
- **Why:** catches the creation picker left as `{name, brief}`.

### store-talent-picker-detail.test.js::creation rows and Disciplines-tab rows: detail.effects is an array, notes is gone
- **Validates:** I2 rename `detail.notes` → `detail.effects` on the existing Disciplines-tab rows and creation rows.
- **Rule:** n/a
- **Why:** catches a half-done rename (picker items renamed but `talentDetail` callers not).

### store-talent-picker-detail.test.js::a name missing from the catalog yields brief/action/attribute/detail all null
- **Validates:** edge case: unknown name → `{name, required, brief: null, action: null, attribute: null, detail: null}` for an option-pool item, a grant item and an edit-mode slot item; `grants` unaffected.
- **Rule:** n/a
- **Why:** catches a crash or a `detail: {}` stub when the catalog lacks a pool talent (modal must show "Full details coming.").

### store-talent-picker-detail.test.js::deriveModel writes nothing to the character for the picker enrichment
- **Validates:** invariant: derived only, nothing stored.
- **Rule:** n/a
- **Why:** catches mutation of the input character. (Passes today; a guard.)

Existing `store-start-discipline.test.js` / `store-advancement.test.js` / `store-creation-model.test.js`
`grants: string[]` and `{name, brief}` assertions must stay green unchanged (they are not modified).
`tools/check-ui-kit.mjs` (pretest) covers the new styles' token/inline-style rules.

## Not covered (and why)
No browser harness; the owner verifies by hand (plan.md Verification M1-M4):
- **M1 Effects list:** the talent detail modal (Disciplines tab and pickers) shows an "Effects" heading with a bulleted list of effect summaries, legible in light and dark mode; no karma-tinted lines; no heading when a talent has no effects; "Full details coming." when the detail is missing.
- **Each picker** (edit-mode Add talent option, Add Discipline / Seed Circle 1, creation "+ add option"):
  - a bubble left of each talent name; filled on Start-modal required grants, outlined on options;
  - click or Enter on the bubble opens the detail on top and never picks the talent or toggles the radio;
  - Escape, ✕ and backdrop close only the detail; the picker stays open with its state unchanged;
  - focus returns to the bubble: no focus ring after a pointer open, a ring after a keyboard open;
  - Tab is trapped inside the detail;
  - Start modal: Enter in the detail closes it and never confirms Start; selected option, silver and edited state unchanged; picking afterwards still works;
  - the first option keeps initial focus when the picker opens.
- Switching tabs with the detail open leaves no stray modal.
- Docs (I7) and the changelog entry are reviewed, not tested.

## How to run
`npm test`
