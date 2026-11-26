# Feature: Notes tab editable outside edit mode (update-notes-edit)

Source: backlog B-004.

## Summary
Edit mode normally gates editing, but the Notes tab is meant to be an exception,
the same way History already lets you add, edit and delete events without it.
Today Notes only allows add/edit/delete in edit mode. This change makes Notes
independent of edit mode: Add Note is always visible, every card shows small ✎/✕
icons on hover, and the full-note popup gains Edit and Delete.

## Goals / Non-goals
- Goal: add, edit and delete notes in read mode and edit mode alike.
- Goal: one Notes card layout in both modes (square cards, bottom fade, click to expand).
- Goal: icons discoverable on touch and by keyboard.
- Non-goal: changes to History, Log or Legend sub-views.
- Non-goal: any change to the notes data shape, overlay category, save flow or `ed-edit-notes` contract.
- Non-goal: note titles, tags, sorting, search or rich text.

## Guardrail alignment
Touches `ui/ed-notes.js` (and possibly how `ed-app.js` passes `editMode` to it),
`docs/UI-GUIDELINES.md` (additive note), tests and changelog. T1, T2 and T4 are
**Tier 3**: no UI-GUIDELINES rule restricts Notes to edit mode; History is the
existing precedent; data-down/events-up and "store only inputs" are untouched
(the same `ed-edit-notes` → `_editNotes` → `saveNotesEdits` flow). Modals keep
the MODALS.md focus contract (Escape closes, Enter confirms, focus restore).
T3 adds Edit/Delete to a read-only info modal, which is an exception to
MODALS.md §5 D5 (Tier 1). The owner signed it off in qa-log 2026-11-27T21:25:00Z.
Nothing is BLOCKED.

## Tickets
### T1 — Notes view independent of edit mode
- **What:** In `ed-notes.js`, stop gating the Notes view on `editMode`. "+ Add note"
  is always rendered. Cards always use the current read-mode layout (uniform
  square, bottom fade, card-body click / Enter / Space opens the full-note popup).
  Empty state uses a single message with no "turn on edit mode" hint (e.g.
  the current edit-mode wording). Remove the `editMode` property from
  `ed-notes` if nothing else in it uses it (and drop the binding in `ed-app.js`).
- **Why:** B-004 — Notes is an edit-mode exception like History (qa-log 21:05, 21:07).
- **Tier:** 3
- **Acceptance criteria:**
  - With edit mode off, "+ Add note" is visible and opens the note modal; saving adds the note (marks the character dirty, persists via the existing overlay).
  - Notes cards render identically with edit mode on and off.
  - Empty Notes view never mentions edit mode.
  - History, Log and Legend views are unchanged.
- **Open questions:** none.

### T2 — Hover ✎/✕ icons on each note card
- **What:** Each card carries a ✎ (edit) and ✕ (delete) button, positioned in a
  corner so they don't change card layout. Hidden (opacity 0) until the card is
  hovered or anything in it has focus (`:hover`, `:focus-within`,
  `:focus-visible`); always visible under `@media (hover: none)` — mirroring the
  Overview `.info` reveal pattern. Clicking an icon does not trigger the card's
  expand (stop propagation; the card's Enter/Space handler ignores key events
  from the buttons). ✎ opens the existing note modal for that note; ✕ opens the
  existing delete confirm. Buttons keep their aria-labels/titles and the
  existing `.edit`/`.del` hover colours; theme-aware in light and dark.
- **Why:** B-004 — owner wants small edit/delete icons on hover (qa-log 21:09).
- **Tier:** 3
- **Acceptance criteria:**
  - Desktop: icons invisible until the card is hovered; visible when the card or an icon has keyboard focus.
  - Touch (`hover: none`): icons always visible.
  - Clicking ✎/✕ never opens the full-note popup; clicking the card body does.
  - No layout shift when icons appear.
  - Edit and delete work in read mode; delete still requires the existing confirm.
- **Open questions:** none.

### T3 — Edit and Delete in the full-note popup
- **What:** The full-note popup footer gains **Edit** and **Delete** buttons. Edit
  closes the popup and opens the note modal for that note; Delete opens the
  existing delete confirm for that note (and the popup closes once the note is
  gone). Focus handoff follows docs/MODALS.md (no stacked-modal focus loss,
  Escape still closes the top-most modal, focus returns sensibly to the card or
  the Notes view).
- **Why:** Owner asked for it (qa-log 21:12).
- **Tier:** 1 — touches MODALS.md §5 D5 (info modals ✕ only, no footer; UI-GUIDELINES §7 contract). Signed off as a recorded D5 exception (qa-log 2026-11-27T21:25:00Z): Edit/Delete in a body row, ui/kit unchanged; MODALS.md §5 gains the exception note.
- **Acceptance criteria:**
  - Popup shows Edit and Delete in both modes.
  - Edit → note modal pre-filled with that note; save updates it.
  - Delete → confirm; confirming removes the note and leaves no popup open on a deleted note; cancelling returns to a sensible state.
  - Escape / Enter behaviour and focus restore meet MODALS.md.
- **Open questions:** whether Delete-cancel returns to the popup or the Notes view — planner to pick the option consistent with MODALS.md.

### T4 — Docs, tests, changelog
- **What:** Add a short UI-GUIDELINES note that Notes (like History) edits
  outside edit mode, with hover-revealed ✎/✕ and popup Edit/Delete. Add/extend
  tests for any pure helper introduced (and the existing `check-ui-kit` /
  import checks stay green). `data/changelog.json` unreleased entry. Update
  PLAN-NOTES-TAB.md only if a stale statement there would mislead (e.g.
  "edit-mode add + per-card edit/delete").
- **Why:** Docs must match code (CLAUDE.md); release notes.
- **Tier:** 3 (additive doc note, no locked rule changed)
- **Acceptance criteria:** `npm test` green; UI-GUIDELINES and changelog describe the new behaviour.
- **Open questions:** none.
