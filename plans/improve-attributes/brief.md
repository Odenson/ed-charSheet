# Brief: Improve attributes (improve-attributes)
## What & why
In edit mode after creation, a `+` on each Overview attribute row opens a confirm modal that spends Legend (800/1,300/2,100) to raise `attributes[n].increases` by 1. Cap +3 on increases, one improvement per save, undo of the pending one allowed. Training days, silver, weeks-wait and rested/healthy are info text only. No schema change.
## Tickets & tiers
- T1 Pure engine rules - Tier 3 - n/a
- T2 Overview `+` and confirm modal - Tier 3 (keep Tier 1 UI rules) - n/a
- T3 ed-app wiring and persistence - Tier 3 - n/a
- T4 Tests and docs - Tier 3 - n/a
## Items
- I1 - engine `attribute-improve` - engine/attribute-improve.js(+test) - T1 - R1-R4, R6
- I2 - saved-baseline plumbing - store.js `loadCharacter` (+`savedAttributes`), ui/ed-app.js load/save - T3 - none
- I3 - `ed-edit-attribute` handler - ui/ed-app.js, store.js - T3 - R1, R2, R4
- I4 - pure UI state helper - ui/attribute-improve-state.js(+test) - T2, T4 - R1, R2
- I5 - Overview `+`, modal, pending mark, undo - ui/ed-overview.js, ui/ed-app.js - T2 - R1-R3
- I6 - tests and docs - ARCHITECTURE.md, docs/UI-GUIDELINES.md, data/changelog.json - T4 - none
## Rules
- R1 - 800/1,300/2,100 LP per increase (per-step), from Legend, never Karma; rules/legend.json costs.attributeIncrease
- R2 - max +3; one attribute at a time; rested and healthy; wait weeks = new Step (info only)
- R3 - training days = current Step; fee = Step x 10 sp/day (info only)
- R4 - Decision 2026-11-23: cap on `increases` only, creation `points` excluded
- R5 - Decision 2026-11-23: optional Circle-based rule out of scope
- R6 - derived cascade (defences, health, talent steps) is automatic; nothing stored
- R7 - any time, no GM trigger
## Owner decisions
- 2026-11-23: spend Legend; cap counts `increases` only.
- 2026-11-23: enforce Legend + cap + one per save; show the rest as info.
- 2026-11-23: standard rule only.
- 2026-11-23: inline `+` per row with confirm modal.
- 2026-11-23: disable all `+` until saved; allow undo.
## Constraints & gotchas
- Baseline for one-per-save = file attributes before overlay: add `savedAttributes` to `loadCharacter` (store.js L787); refresh after save (ed-app ~L2413), in `_loadCharacter` and in `_reloadSaved` (Discard, ~L2532) and any other swap path; drafts/creation-open = no Improve.
- `applyEdits` REPLACES the whole `attributes` map; use `saveAttributeEdits`; when equal to baseline use `reconcileOverlay(['attributes'], id)` and recompute `_dirty = hasPendingEdits(id) || (hasCustomPendingEdits() || hasCustomSkillPendingEdits())`.
- I1 prices the next step by direct table lookup (no `attributeIncreaseCost` import); its test checks agreement with the audit's cumulative function.
- Legend available (`model.legend.available`) already includes pending increases; pass the pre-change value to the engine.
- Reuse `valueToStep`/`attributeValue` (engine/derive.js) and `attributeIncreaseCost` (engine/legend-spent.js); preview Step is natural (no modifier fold).
- Modal via ui/kit (`ModalController` + `modalFrame`, docs/MODALS.md); Overview must not gain vertical scroll; `.an` line is shared with `.adelt` badge and creation stepper; theme tokens only.
