# Q&A log: Notes tab editable outside edit mode (update-notes-edit)

Starting context — backlog **B-004** (improvement · Notes tab · added 2026-11-27):

> Editing normally requires edit mode, but Notes is meant to be an exception,
> the same way History already lets you add or edit events without it. Today the
> Notes tab only lets you add or edit a note in edit mode. The owner wants the
> Add Note button always visible, and small edit and delete icons shown on a
> note when you hover over it, even outside edit mode. Described as a quick fix.

## 2026-11-27T21:05:00Z — asked by interrogator
**Q:** Outside edit mode, clicking a Notes card opens the full note in a read-only popup (uniform square cards with a bottom fade). Keep that, with ✎/✕ icons added on hover?
**A:** Keep expand + add icons. Card body click still opens the full note; hover shows ✎ edit and ✕ delete, and clicking those does not trigger the expand.

## 2026-11-27T21:07:00Z — asked by interrogator
**Q:** Edit mode today shows ✎/✕ permanently on free-height cards. Keep that, or one layout for both modes?
**A:** One layout for both. Notes no longer depends on edit mode: square cards, click-to-expand and hover icons in both modes, like History.

## 2026-11-27T21:09:00Z — asked by interrogator
**Q:** Touch devices have no hover. How should the ✎/✕ icons behave there and for keyboard users?
**A:** Always shown on touch, like the Overview's `.info` buttons: hidden until hover on desktop, always visible with `(hover: none)`, and revealed on keyboard focus.

## 2026-11-27T21:12:00Z — asked by interrogator
**Q:** The full-note popup is read-only today. Should it get Edit and Delete buttons now that notes are editable everywhere?
**A:** Add Edit/Delete. The popup footer gets Edit (switches to the edit modal) and Delete (opens the existing delete confirm).

## 2026-11-27T21:14:00Z — asked by interrogator
**Q:** Scope summary (Add Note always visible; one square-card layout in both modes with ✎/✕ on hover, always shown on touch/focus; card click still expands, popup gains Edit/Delete; delete keeps its confirm; edit-mode empty-state hint removed; UI-GUIDELINES records Notes as an edit-mode exception like History). Anything else?
**A:** That's everything.

## 2026-11-27T21:15:00Z — interrogator note (rules sweep)
No Earthdawn rule is involved (pure UI interaction change); no rule-agent batch sent. Guardrail classification: all tickets Tier 3 — no UI-GUIDELINES rule restricts Notes to edit mode, History already edits outside it, data flow (`ed-edit-notes` → `_editNotes` → overlay) is unchanged.

## 2026-11-27T21:25:00Z — asked by interrogator (relaying planner)
**Q:** Tier-1 sign-off: Edit/Delete in the full-note popup conflicts with MODALS.md §5 D5 ("info modals: ✕ only, no footer", part of the UI-GUIDELINES §7 modal contract). Planner proposes keeping it an info modal with an Edit/Delete row at the end of the body, no ui/kit change. Sign off on a recorded D5 exception, or drop popup Edit/Delete (Tier-3 alternative)?
**A:** Sign off on exception. Owner approves a recorded D5 exception for the Notes full-note popup (like the Roll-modal exception): Edit/Delete in a body row, ui/kit unchanged. T3 becomes Tier 1 (signed off 2026-11-27).
