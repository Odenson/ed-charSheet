# Brief: Talent info bubbles (talent-info-bubbles)

## What & why
B-002 + B-003. The three talent pickers show only a name and terse effect, so a
player cannot see what a talent does before picking. Every talent in those
pickers gets the Disciplines-tab info bubble, which opens the shared talent
detail modal stacked above the picker. The detail modal also gains a labelled
Effects list (effect summaries) everywhere it opens.

## Tickets & tiers
- T1 Catalog detail for picker talents — Tier 3 — n/a
- T2 Effects list in talent detail modal — Tier 3 — n/a
- T3 Bubbles in edit-mode Add-talent-option picker (B-002) — Tier 3 — n/a
- T4 Bubbles in Add Discipline / Seed Circle 1 (B-003) — Tier 3 — n/a
- T5 Bubbles in creation "+ add option" picker — Tier 3 — n/a
- T6 Docs (UI-GUIDELINES §4, MODALS.md) — Tier 3 — n/a

## Items
- I1 — Model: `pickerTalent(name, circle, required)` → `{name, required, brief, action, attribute, detail}` — `store.js` (slots 1295, addable 1754-1762 + new `grantItems`, creation candidates 2140) + store test — T1 — none
- I2 — Effects list in `_talentModal`; rename derived `detail.notes` → `detail.effects` (settled; replaces the karma-tinted `.mnote` lines) — `store.js:933`, `ui/ed-disciplines.js:766-793` — T2 — none
- I3 — Second kit controller `_talentInfoCtl` (kind `info`, layer 2100) + `_talentInfo` state + `_openTalentInfo` + `_talentBubble` helper; `_talentModal(t, ctl, layer)` — `ui/ed-disciplines.js` — T3-T5 — none
- I4 — Bubbles in `_learnModal` (`.lrow` wrapper) — `ui/ed-disciplines.js:1483` — T3 — none
- I5 — Bubbles in `_startModal` (filled on `grantItems`, outlined on options, outside the `<label>`) — `ui/ed-disciplines.js:1419` — T4 — none
- I6 — Bubbles in `_creationOptionModal` (`.lrow` wrapper) — `ui/ed-disciplines.js:566` — T5 — none
- I7 — Docs: UI-GUIDELINES §4 dated note; MODALS.md §5 host entry — T6 — none
Order: I1, I2, I3, then I4/I5/I6 (independent), I7.

## Verification
- Automated: I1 store test (all four picker lists, `detail: null` for a missing name, `detail.effects` present and `notes` absent); existing `grants: string[]` / `{name, brief}` tests unchanged; `check-ui-kit`.
- Manual (owner), plan.md `## Verification` M1-M4: Effects list in light/dark; for each picker: the bubble opens the detail on top and never picks or toggles the radio; Esc/✕/backdrop close only the detail; focus returns to the bubble (no ring after a pointer open, ring after a keyboard open); Tab trapped; Enter on the bubble opens it; Enter in the detail never confirms Start; picker state unchanged.

## Rules
- None. rules.md: the feature only displays existing `rules/talents.json` text; eligibility, prices and gating unchanged.

## Owner decisions
- 2026-11-26T23:17 — B-002 and B-003 as one feature, slug `talent-info-bubbles`.
- 2026-11-26T23:20 — stacked detail modal (the Disciplines-tab one), not inline expand; Escape closes only it, focus back to the bubble.
- 2026-11-26T23:23 — add an Effects list (effect summaries) to the shared detail modal, everywhere.
- 2026-11-26T23:25 — all three pickers, including creation "+ add option".
- 2026-11-26T23:27 — filled bubble on required Circle 1 talents, outlined on every Talent Option; clicking a bubble never selects.
- 2026-11-26T23:29 — nothing else in scope.

## Constraints & gotchas
- Tab-switch teardown is handled: `ui/ed-app.js:2712` destroys `<ed-disciplines>` and `hostDisconnected` (`ui/kit/modal-controller.js:251`) drops each controller off the stack. Add NO extra teardown code.
- Effect summaries are ALREADY in the modal as unlabelled `.mnote` lines via `talentDetail().notes` (`store.js:940`, `ui/ed-disciplines.js:789`); talents.json has no talent-level `notes`. T2 = relabel into a heading + list, not new data. Only reader of `detail.notes` is line 789.
- Keep `cand.grants` as `string[]`: `ui/ed-app.js:1984` and `store-start-discipline.test.js:68,178` depend on it. Add `grantItems` beside it.
- View must not look up `rules/talents.json`; read `detail` from the model (data down). Missing catalog entry → `detail: null` → modal shows "Full details coming.".
- `_talentModal` reads `t.required` (Required/Optional chip + title bubble class), `t.brief`, `t.action`, `t.attribute`, `t.detail`; `t.actionBase`/`grantSources`/`rank` are absent on picker items (already guarded).
- No button inside a button: `.lopt` is a button, so use the `.lrow` sibling pattern (`ui/ed-disciplines.js:213`, skill picker `plainRow`). In the Start modal put the bubble OUTSIDE `<label class="startopt">` so it cannot toggle the radio. Bubble click: `stopPropagation()` + `preventDefault()`.
- One controller per modal in the same shadow root is fine (precedent `ui/ed-spells.js:246`, `ui/ed-equipment.js:153`; dialog found by `[data-modal=id]`). Render the stacked detail AFTER the `_modal` block, layer 2100.
- Key routing (MODALS.md §3): Enter on the bubble passes (R13) and clicks it; Enter in the info detail closes it, never confirms Start Discipline. Do not change `DISC_KIND` or `_modalCtl`.
- Do not disturb picker state (`_modal`, `_startOption`, `_startSilver`, `_startEdited`) when opening/closing the detail; first `.lopt` keeps `autofocus`.
- `tools/check-ui-kit.mjs` (pretest): `--fs-*` tokens only, no inline `style=` on buttons, weights 400/500, light-dark colours.
- Tier shown in picker detail = `tierForCircle(circle, costs)` (slot circle, or 1); homebrew `tierShift` affects price only.
