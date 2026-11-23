# Feature: Improve attributes (improve-attributes)

## Summary
In edit mode, after character creation is finished, the owner can improve an attribute from the Overview: a `+` on each attribute row opens a confirm modal that spends Legend Points (800 / 1,300 / 2,100 for the 1st/2nd/3rd increase, PG pp. 447-448), raising `attributes[n].increases` by one. Only one attribute may be improved per save, and an improvement pending in the current unsaved session can be undone. The book's other conditions (rested and healthy, training days, silver, weeks-wait) are shown as information only.

## Goals / Non-goals
- Goal: enforce Legend cost, the +3 cap on `increases`, one improvement per save, and sufficient Available Legend.
- Goal: show new Value/Step, training days (= current Step), silver fee (Step x 10 sp/day) and the weeks-wait (= new Step) in the modal as text.
- Goal: no schema change; Legend-spent audit already counts `increases`.
- Non-goal: optional Circle-Based Attribute Improvement rule (R5, owner decision 2026-11-23).
- Non-goal: Karma cost (the book has none); enforcing no-Damage/Wounds; tracking silver or weeks.
- Non-goal: changing creation-mode `points` behaviour.

## Guardrail alignment
Touches `ui/ed-overview.js`, `ui/ed-app.js`, a new pure `engine/` module, docs. No Tier 1 surface changed: no schema shape change (`increases` already exists in `ed-character/2`), derived Value/Step stay derived, data-down/dispatch-up kept, no taxonomy change. All tickets are Tier 3, and each must keep the Tier 1 UI rules (Overview no vertical scroll on desktop, placeholder pills, light and dark theme, modal Escape/Enter via `ui/kit`). No sign-off required.

## Tickets
### T1 — Pure engine: attribute-improvement rules
- **What:** New DOM-free engine module with: next-increase cost from `rules/legend.json` `costs.attributeIncrease`; cap check (`increases` max 3); one-per-save check against the saved baseline; Legend-available check; `applyAttributeIncrease` / `undoAttributeIncrease` returning a new attributes map (refusals return the same reference); a derived info block (new Value/Step, training days, silver fee, weeks-wait, Step from `rules/steps`/derive).
- **Why:** Rules live in the engine; the UI only dispatches (R1-R3, R6).
- **Tier:** 3
- **Acceptance criteria:** cost 800/1,300/2,100 for the 1st/2nd/3rd; a 4th is refused; refused if Available Legend < cost; refused if another attribute already has a pending increase vs the saved baseline; undo only removes the pending increase; creation `points` and `base` untouched; unit tests for each rule.
- **Open questions:** none (R4 decided: cap on `increases` only).

### T2 — Overview UI: `+` per row and confirm modal
- **What:** In edit mode, creation closed, each attribute row shows a `+` (hidden/disabled at +3, when Legend is short, or when another attribute is pending). It opens a standard confirm modal (`ui/kit`, Escape closes, Enter confirms) showing attribute, current -> new Value and Step, LP cost, remaining Legend, training days, silver fee, weeks-wait, and the "rested and healthy" reminder. A pending row shows an "Improved this save" mark with an undo control.
- **Why:** Player-facing affordance, per the owner's UI choice.
- **Tier:** 3 (must keep Tier 1 UI rules)
- **Acceptance criteria:** Overview still fits the desktop viewport without vertical scroll; mobile stacked layout intact; light and dark themes; Escape/Enter honoured; creation-mode -/+ unchanged; read-only (non-edit) mode shows nothing new.
- **Open questions:** none.

### T3 — ed-app wiring and persistence
- **What:** New event (e.g. `ed-edit-attribute`) handled in `ed-app.js`: runs the T1 engine, persists via the existing whole-map `attributes` overlay, marks the file dirty, re-derives (Step cascade, Legend Available). The saved baseline for the one-per-save check comes from the saved character, so it resets once saved.
- **Why:** Data down, events up; no new stored field.
- **Tier:** 3
- **Acceptance criteria:** after an increase the attribute Value/Step and dependents update; Legend Available drops by the cost; after save the lock clears; undo restores the pre-increase state and the overlay clears when equal to saved; reload with an unsaved overlay keeps the pending state.
- **Open questions:** how the saved baseline is read from the overlay-merged store (planner to determine).

### T4 — Tests and docs
- **What:** Engine tests (T1), UI state/test coverage where a pure state helper exists, an `ARCHITECTURE.md` note that post-creation gains use `increases` via Improve attribute, `docs/UI-GUIDELINES.md` entry for the row affordance and modal, changelog entry per project convention.
- **Why:** Keep docs and code in agreement.
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes, including conformance tests; docs updated.
- **Open questions:** none.
