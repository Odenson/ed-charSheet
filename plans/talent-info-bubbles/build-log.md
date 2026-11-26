# Build log: Talent info bubbles (talent-info-bubbles)

## Run 1 — 2026-11-27 (since 2026-11-26T23:49:48Z)

### Alignment (Phase 0)
- **Guardrails:** I1-I7 all Tier 3 (tickets.md, plan.md "Guardrail classification"). No Tier-1 or Tier-2 item; no sign-off needed.
- **Rules coverage:** rules.md records no Earthdawn rule computed or asserted (display of rules/talents.json text only). Nothing to settle.
- **Open questions:** one non-blocking (bubble placement in `.lrow` pickers); the plan settles it as left of the name, matching the owner's "match the Disciplines tab" answer (qa-log 23:27). No question needed.
- **Review:** F1-F3 accepted and folded into plan.md.
- **Tree:** uncommitted `plans/backlog/BACKLOG.md` (B-002/B-003 status lines from /new-feature) and untracked `plans/talent-info-bubbles/` (the planning folder). Both belong to this feature and go in the feature commit.
- **Outcome:** aligned. plan.md `status: building`; B-002 and B-003 set to 🔨 building.

## Run 2 — 2026-11-27 (feature-dev, build mode)

### Changes
- **I1 `store.js`:** `pickerTalent(name, circle, required)` closure in `deriveModel`; used for `disciplines[].optionSlots[].learnable` (slot Circle), `addableDisciplines[].optionPool.items` (Circle 1), new `addableDisciplines[].grantItems` (Circle 1, `required: true`; `grants` stays `string[]`), and `creation.talents.option.candidates` (Circle 1). Unknown name gives null brief/action/attribute/detail.
- **I2:** `talentDetail` key `notes` renamed `effects`; `_talentModal` shows an "Effects" `h4` + `ul.meffects` instead of the karma-tinted `.mnote` lines (`.mnote` kept for grant sources).
- **I3 `ui/ed-disciplines.js`:** `_talentInfo` state, `_talentInfoCtl` (kind `info`), `_openTalentInfo` (stopPropagation + preventDefault, picker state untouched), `_talentBubble`; `_talentModal(t, ctl, layer)`; stacked detail rendered after the `_modal` block at layer 2100.
- **I4/I6:** `.lrow` wrapper with the bubble beside `.lopt` in `_learnModal` and `_creationOptionModal` (autofocus unchanged).
- **I5:** Start modal grants iterate `grantItems` with a filled bubble; options wrapped in `.startoptrow` with the bubble outside the `<label>`; "No option for now" gets a `.tspacer`.
- **I7:** UI-GUIDELINES §4 dated note; MODALS.md §5 stacked-detail paragraph. Changelog `added` line in `unreleased.changes`.
- Note: the spec's `slots[]` is the real `optionSlots[]` key (tester note); no code impact.

### Gate
- `store-talent-picker-detail.test.js`: 10/10 pass.
- `npm test` (pretest lint + check-ui-kit): 2608 pass, 0 fail.

### Disputes
- None.
