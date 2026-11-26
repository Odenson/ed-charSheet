# Brief: Notes tab editable outside edit mode (update-notes-edit)

## What & why
Backlog B-004. The Notes sub-view of the Notes tab no longer depends on edit mode, the same way History already works.
- "+ Add note" is always visible.
- There is one card layout: square, bottom fade, click to expand.
- ✎/✕ icons appear on hover or focus, and are always shown on touch.
- The full-note popup gains Edit and Delete.

The data, the overlay and the `ed-edit-notes` flow are unchanged.

## Tickets & tiers
- T1 — Notes view independent of edit mode — Tier 3 — n/a
- T2 — Hover ✎/✕ icons on each card — Tier 3 — n/a
- T3 — Edit and Delete in the full-note popup — Tier 1 (MODALS.md §5 D5 exception) — signed off qa-log 2026-11-27T21:25:00Z
- T4 — Docs, tests, changelog — Tier 3 — n/a

## Items
- I1 — Notes view independent of edit mode — ui/ed-notes.js, ui/ed-app.js (l.2735 binding) — T1 — none
- I2 — Hover-revealed ✎/✕ per card — ui/ed-notes.js — T2 — none
- I3 — Popup Edit/Delete + focus hand-offs — ui/ed-notes.js — T3 — none
- I4 — Pure helper + tests, docs, changelog — ui/notes-state.js(+.test.js), docs/UI-GUIDELINES.md, docs/MODALS.md, plans/PLAN-NOTES-TAB.md, data/changelog.json — T4 — none

Order: I1 → I4 helper → I2 → I3 → I4 docs.

## Rules
None. This is a pure UI change (rules.md).

## Owner decisions
- 2026-11-27 21:05: the card body still expands. ✎/✕ appear on hover, and clicking them never expands.
- 2026-11-27 21:07: one layout in both modes, like History.
- 2026-11-27 21:09: icons hidden until hover on desktop, always shown with `(hover: none)`, and revealed on keyboard focus (Overview `.info` pattern).
- 2026-11-27 21:12: the popup gets Edit (switches to the note modal) and Delete (the existing confirm).
- 2026-11-27 21:14: delete keeps its confirm. The edit-mode empty hint goes. UI-GUIDELINES records Notes as an edit-mode exception.
- Planner resolution for T3: Delete-cancel **returns to the popup**. The confirm stacks above it, and Escape or Cancel closes only the top modal (MODALS §2.1, Discard precedent §4).

## Constraints & gotchas
- **Removing `editMode`.** Remove the property from ed-notes and drop `.editMode` on `<ed-notes>` in ed-app. Only `_notesView`/`_noteCard` use it. Make the `.cards.read .ncard` styles the default, and keep the ≤720px override (free-height, no fade).
- **Card structure.** Never put buttons inside the `role="button"` card. `.ncard` becomes a plain container with two children:
  - `.nread` (`role=button tabindex=0`, click + Enter/Space opens the popup);
  - `.nicons` (absolutely positioned top-right, after `.nread` in DOM order).
  Icon handlers call `stopPropagation`, and the `.nread` key handler ignores events where `target !== currentTarget`.
- **Card face and focus ring (review F1).**
  - Move the `9px 11px` padding from `.ncard` to `.nread`, and make `.nread` fill the card (`height:100%`, border-box), so edge clicks still expand.
  - `.ncard`'s `overflow:hidden` clips a child's outline. Draw the ring with `.ncard:has(.nread:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px }` and `.nread:focus-visible { outline:none }`.
  - Fallback: an inset ring on `.nread:focus-visible` (`outline-offset:-2px`).
  - There is no ring on a pointer click.
- **Icon reveal.** Mirror ui/ed-overview.js l.227-234:
  - `opacity:0` by default;
  - visible on `.ncard:hover`, `.ncard:focus-within` and `:focus-visible`;
  - `@media (hover:none) { opacity:1 }`, and in that query reserve top-right padding on `.nread` so the icons never cover text.
  Use opacity only, so there is no layout shift. Keep `class="edit"`/`"del"` and the aria-labels.
- **Popup.** It stays `kind:'info'` with no `ack`, and **no ui/kit change**. Edit/Delete go in an action row at the end of the modal **body**:
  - `class="nfoot"`, not `.mfoot`;
  - buttons `btn` / `btn danger`, markup only;
  - no `button.btn` CSS, no inline `style=` on buttons (check-ui-kit: ed-notes has no baseline entry and must stay at 0);
  - Enter on the dialog closes it (R15), and Enter on a button activates it natively (R13).
- **Edit from the popup.** Store `_expTrigger = e.currentTarget` (`.nread`) when the popup opens. Then:
  `close({restoreFocus:false})` → `_openNote(id, _expTrigger)`.
  The note modal returns focus to the card, which survives because the list is unkeyed and the order is unchanged.
- **Delete from the popup.** `_requestConfirm('note', id)` with the popup left open. `<ed-confirm>` renders after the popup, so it sits on top, and its trigger is the Delete button. Cancel needs no code.
  On confirm (ed-confirm closes before it dispatches):
  1. dispatch `removeNote(list, id)`;
  2. if `_expandedNote === id`, call `_expCtl.close({restoreFocus:false})`;
  3. set the `_focusAddAfterUpdate` flag.
- **Focus after delete.** ed-app re-derives synchronously, but ed-notes gets the new `model` on a later update. So in `updated(changed)`, when `changed.has('model')` and the flag is set, call `returnFocusToTrigger(.addbtn, {openedByKeyboard})` (imported from ui/kit/modal-controller.js). Apply this to card-✕ deletes too.
- **Defensive close.** In `updated`, if `_expandedNote` no longer exists in `_notes()`, close `_expCtl` without restoring focus.
- **No `repeat` directive.** Vendored lit has none, so the list is unkeyed.
- **Helper.** `ui/notes-state.js`: `upsertNote(list,id,text,makeId)` (new note → unshift) and `removeNote(list,id)`. Pure and non-mutating, with tests in `ui/notes-state.test.js`. Import it by relative path.
- **Docs.**
  - UI-GUIDELINES: an italic dated note after the tab table.
  - MODALS §5: a named, dated "Notes full-note popup exception (owner, update-notes-edit qa-log 2026-11-27T21:25:00Z)", worded like the Roll-modal exception: Edit/Delete in a body row, no kit footer, ui/kit unchanged, Enter on the dialog still closes.
  - PLAN-NOTES-TAB l.171: amend the stale line.
  - changelog: `unreleased` gets one `improved` entry.
- **Manual verification.** Only the helper is unit-tested. `plan.md` "Manual verification (owner)" lists the I1–I3 DOM, focus and reveal checks: light and dark, desktop and ≤720px, plus `hover: none`.
