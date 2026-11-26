# Feature: Talent info bubbles (talent-info-bubbles)

Backlog: B-002, B-003

## Summary
The talent pickers list talents by name and a short effect only, so a player
cannot tell what a talent does before picking it. Every talent listed in the
three talent pickers gets the Disciplines-tab info bubble, which opens the
shared talent detail modal stacked above the picker. That modal also gains an
Effects list (each effect's summary from `rules/talents.json`), so the
"bonuses it provides" are visible everywhere the modal opens.

## Goals / Non-goals
- Goal: a clickable info bubble on every talent in the edit-mode Add-talent-option
  picker (B-002), the Add Discipline / Seed Circle 1 modal (required Circle 1
  talents and Talent Options, B-003), and the creation-mode "+ add option" picker.
- Goal: the bubble opens the same talent detail modal the Disciplines tab uses,
  stacked above the picker; Escape closes only it and returns focus to the bubble.
- Goal: the talent detail modal lists the talent's effect summaries.
- Non-goal: changing what the pickers do on selection, their prices, or their gating.
- Non-goal: new talent text or data; the feature shows what `rules/talents.json`
  already holds.
- Non-goal: character-specific values (Step, rank) for talents not yet learned.

## Guardrail alignment
Touches `ui/ed-disciplines.js` (pickers, detail modal), possibly a pure
view-state helper, and the engine/model only to pass catalog detail down for
talents the character does not know yet. Docs: UI-GUIDELINES §4 (Disciplines
notes), MODALS.md (stacked modal, focus return). All tickets are **Tier 3**: new
content within the UI guidelines, modals through `ui/kit/`, data down / events
up, no schema or taxonomy change. No Tier-1 sign-off needed.

## Tickets
### T1 — Catalog detail for picker talents
- **What:** The talent entries each picker renders (edit-mode learnable options,
  Add Discipline grants and option pool items, creation option candidates) carry
  the same detail the Disciplines-tab talent rows carry (brief, action, attribute,
  Strain, tier, versus, skill use, summary, notes, effect summaries), derived from
  the merged talent catalog in the engine/model, not looked up by the view.
- **Why:** The picker lists today carry names (and a brief) only; the modal needs
  the full detail for talents the character does not know.
- **Tier:** 3
- **Acceptance criteria:** For every talent a picker lists, the model provides its
  detail; a talent missing from the catalog yields no detail (the modal then shows
  its existing "Full details coming." text). No character data is stored.
- **Open questions:** none.

### T2 — Effects list in the talent detail modal
- **What:** The shared talent detail modal shows an Effects list: one line per
  effect `summary` in the talent's `effects` array, below the summary text.
  Omitted when the talent has no effect summaries.
- **Why:** B-002 "the bonuses it provides" (qa-log 2026-11-26T23:23).
- **Tier:** 3
- **Acceptance criteria:** Opening Anticipate Blow's detail (Disciplines tab or a
  picker) lists both of its effect summaries; a talent with no effects shows no
  Effects heading; works in light and dark mode; type-scale tokens only.
- **Open questions:** none.

### T3 — Info bubbles in the edit-mode Add-talent-option picker (B-002)
- **What:** Each option row gets an outlined talent bubble (`.tinfo.opt`) that
  opens the talent detail modal stacked above the picker.
- **Why:** B-002.
- **Tier:** 3
- **Acceptance criteria:** Clicking the bubble opens the detail modal and does not
  pick the talent; Escape closes only the detail modal and focus returns to the
  bubble, the picker stays open; the bubble is keyboard reachable with an
  aria-label naming the talent; Enter on a focused bubble opens it, not a pick.
- **Open questions:** none.

### T4 — Info bubbles in Add Discipline / Seed Circle 1 (B-003)
- **What:** Each required Circle 1 talent in the grants list gets a filled bubble
  (`.tinfo.req`); each Talent Option radio row gets an outlined bubble
  (`.tinfo.opt`). Both open the stacked detail modal.
- **Why:** B-003.
- **Tier:** 3
- **Acceptance criteria:** Clicking an option's bubble does not change the radio
  selection; Escape closes only the detail modal and returns focus to the bubble;
  Enter in the detail modal does not confirm Start Discipline; the confirm modal's
  state (selection, silver) is unchanged after closing the detail.
- **Open questions:** none.

### T5 — Info bubbles in the creation-mode option picker
- **What:** Each candidate in the creation "+ add option" picker gets an outlined
  bubble opening the stacked detail modal.
- **Why:** Owner scope decision (qa-log 2026-11-26T23:25).
- **Tier:** 3
- **Acceptance criteria:** Same behaviour as T3; picking still spends the talent
  point as before.
- **Open questions:** none.

### T6 — Docs
- **What:** Note the picker bubbles and the Effects list in UI-GUIDELINES §4
  (Disciplines notes) and the stacked detail modal in MODALS.md's host list.
- **Why:** Keep design docs true to the code.
- **Tier:** 3
- **Acceptance criteria:** Both docs describe the shipped behaviour.
- **Open questions:** none.
