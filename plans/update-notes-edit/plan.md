---
status: implemented
shipped: v2.13.0
---
# Delivery Plan: Notes tab editable outside edit mode (update-notes-edit)

## Context & learnings
Backlog B-004. Edit mode normally gates editing, but the Notes tab's **History**
sub-view already adds, edits and deletes events without it. The **Notes** sub-view
does not: today "+ Add note" and the per-card ✎/✕ exist only in edit mode, and read
mode shows square, click-to-expand cards with a read-only popup. The owner wants
Notes to work like History, independent of edit mode.

Owner decisions (qa-log 2026-11-27):
- 21:05: keep click-to-expand on the card body. Add ✎ edit / ✕ delete icons on
  hover; clicking an icon does not expand the card.
- 21:07: use one layout in both modes: square cards, bottom fade, click to expand,
  hover icons. Notes no longer depends on edit mode.
- 21:09: icons are hidden until hover on desktop, always shown under
  `(hover: none)`, and shown on keyboard focus. This matches the Overview `.info`
  buttons.
- 21:12: the full-note popup gets **Edit** (switches to the edit modal) and
  **Delete** (opens the existing delete confirm).
- 21:14: confirmed scope. Delete keeps its confirm, the edit-mode empty-state hint
  is removed, and UI-GUIDELINES records Notes as an edit-mode exception like History.

Non-goals: History, Log and Legend sub-views; the notes data shape; the overlay
category; the save flow; the `ed-edit-notes` → `_editNotes` → `saveNotesEdits`
contract; note titles, tags, sorting, search or rich text.

## Discoveries
- `ui/ed-notes.js`
  - Uses `editMode` in the property declaration (l.46), in `_notesView` (l.435
    Add button, l.439 `.cards.read` class, l.443-445 empty-state wording) and in
    `_noteCard` (l.450-460 edit-mode card with `.nactions`). Nothing else in the
    component reads it, so the property can be removed (T1).
  - The read-mode card (l.461-478) is a `div role="button" tabindex="0"` with
    click and Enter/Space handlers. It calls `this._expCtl.opened(e.currentTarget)`.
    If ✎/✕ buttons go inside a `role="button"`, that nests interactive controls
    (an a11y anti-pattern, and the key handler would catch the buttons' Enter).
  - CSS: `.cards.read .ncard` sets square / `overflow:hidden` / pointer, and its
    `::after` draws the bottom fade (l.105-106). The mobile override at
    `max-width:720px` makes cards `aspect-ratio:auto` with no fade (l.161-163).
    `.edit`/`.del` hover colours are at l.100-102. `.nactions` (l.99) is used
    only by the edit-mode card.
  - Popup: `_expCtl = new ModalController(this, { kind: 'info', … })` (l.199) and
    `_expandedNoteTmpl()` (l.481-486), which has no footer.
  - Delete: `_requestConfirm('note', id)` → `<ed-confirm>` is rendered **last**
    in `render()` (l.656), after the popup (l.655), so it stacks on top at the same
    layer 2100. `_confirmDelete` (l.327-349) dispatches the filtered list.
    `_closeConfirm` (l.352-357) only refocuses for discard prompts.
  - Comment at l.272 reads "Notes CRUD (edit-mode gated …)" and goes stale.
- `ui/ed-app.js` l.2733-2737 passes `.editMode=${this._editMode}` to
  `<ed-notes>`. `_editNotes` (l.1670-1676) is synchronous, but ed-notes gets the
  new `model` on a **later** Lit update. Anything that needs to happen after a
  note is gone must run in ed-notes' `updated()` once `model` changes, not right
  after the dispatch.
- `ui/ed-confirm.js` calls `opened(deepActiveElement())` (l.61), so its trigger
  is whatever had focus, e.g. the popup's Delete button. It closes (restoring
  focus) **before** it dispatches `confirm` (MODALS.md §4 "Close reasons").
- `ui/kit/modal.js` `modalFrame`: an `info` modal renders a footer only for
  `ack` (one `data-primary` button). `extra` is rendered only for input/confirm.
  MODALS.md §5 (D5) says "Read-only (info) modals: ✕ only, no footer, no hint".
- MODALS.md §3 R13: Enter on a non-primary button inside the top modal **passes**,
  so the button activates natively. R15: Enter elsewhere in an `info` modal closes
  it. §4 "Hand-offs": `close({ restoreFocus: false })` hands off to another modal
  that takes focus itself. §7 lists the trigger-gone cases, where focus falls to
  `<body>`.
- `ui/kit/modal-controller.js` exports `returnFocusToTrigger(el, { openedByKeyboard })`
  (l.82; suppresses the ring for pointer focus), `currentModality()` and
  `deepActiveElement()`.
- Reveal pattern to mirror: `ui/ed-overview.js` l.227-234
  (`opacity:0; transition`, `*:hover > .info, *:focus-within > .info,
  .info:focus-visible { opacity:1 }`, `@media (hover: none) { .info { opacity:1 } }`).
- Vendored lit (`vendor/lit-3.2.1.js`) exports no directives (no `repeat`), so the
  card list is unkeyed. After an edit, the card DOM node at the same index
  survives, so focus can return to it. After a delete, nodes shift, so the old
  trigger may now show a different note.
- No existing tests cover `ed-notes`. Tests are `node --test`, and pure helpers
  live in `ui/*-state.js` with sibling `*.test.js` files (e.g.
  `ui/attribute-improve-state.test.js`). `pretest` runs `tools/check-imports.mjs`
  and `tools/check-ui-kit.mjs`. `tools/ui-kit-baseline.json` has no ed-notes
  entry, so ed-notes must stay at 0 for every counter: no literal
  `role="dialog"`, no CSS naming `.overlay/.modal/.mhead/.mclose/button.btn`, no
  non-`--fs-*` font sizes, no inline `style=` on a `<button>`.
- `docs/UI-GUIDELINES.md` has no rule restricting Notes to edit mode (tab table
  l.62; per-feature italic notes follow l.66-82). `plans/PLAN-NOTES-TAB.md`
  l.171 says "read-mode cards; edit-mode add + per-card edit/delete", which goes
  stale. `data/changelog.json` `unreleased.changes` is empty.

## Guardrail classification
- **I1–I2: Tier 3.** These are view changes inside `ed-notes` that keep the Tier-1
  rules: data-down/dispatch-up, with the same `ed-edit-notes` event and payload;
  "store only inputs"; no schema change; theme-aware through the existing
  `light-dark()` variables; two font weights; `--fs-*` tokens; every modal stays on
  `ui/kit/` with Escape closes / Enter OK (UI-GUIDELINES §7). History is the
  precedent for editing outside edit mode. Dropping `.editMode` from the
  `<ed-notes>` binding in `ed-app.js` is a prop wiring change, not an architecture
  change.
- **I3: Tier 1, signed off.** Edit/Delete in the full-note popup conflicts with
  MODALS.md §5 D5 ("info modals: ✕ only, no footer"), part of the UI-GUIDELINES
  §7 modal contract. Owner sign-off: qa-log **2026-11-27T21:25:00Z**, "Sign off on
  exception. Owner approves a recorded D5 exception for the Notes full-note popup
  (like the Roll-modal exception): Edit/Delete in a body row, ui/kit unchanged.
  T3 becomes Tier 1 (signed off 2026-11-27)."
  - **Scope of the sign-off.** The popup stays `kind: 'info'`, and Edit/Delete
    render as an action row at the end of the popup **body**. No kit footer is
    added; the frame and the `info` routing (Enter on the dialog closes) are
    unchanged, and no `ui/kit/` file is edited.
  - **Recording.** I4 records the exception in MODALS.md §5 as a named, dated
    exception.
- **I4: Tier 3.** These are additive doc notes, a new pure helper with tests, and
  the changelog. No locked rule changes.
- One Tier-1 item (I3), signed off at qa-log 2026-11-27T21:25:00Z. There are no
  Tier-2 items, and nothing is BLOCKED.

## Rules dependencies
None. `rules.md` records that no Earthdawn rule applies, because this is a pure UI
interaction change. There are no open NEEDS_RULES.

## Implementation items

### I1 — Notes view independent of edit mode
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 3
- **What:** Always render "+ Add note". Every card uses the current read-mode
  layout in both modes. The empty state has one message with no edit-mode hint.
  Remove the `editMode` property from `ed-notes` and its binding in `ed-app.js`.
- **Where:** `ui/ed-notes.js` (`static properties`, `_notesView`, `_noteCard`,
  CSS l.97-106 and the 720px block l.161-163, comment l.272). `ui/ed-app.js`
  l.2735.
- **Approach:**
  - Delete `editMode` from `static properties`.
  - Render the Add button unconditionally, with its existing `_openNote(null, e.currentTarget)` handler.
  - Make the square/fade styles the default `.ncard` styles. Drop the `.read`
    qualifier and the `${this.editMode ? '' : 'read'}` class, and keep the mobile
    override (`aspect-ratio:auto`, no fade) retargeted to `.ncard`.
  - Delete the edit-mode card branch and the now-unused `.nactions` rule.
  - Set the empty state to "No notes yet — add NPCs, locations, quest threads, or table reminders."
  - Update the header comment at l.272 to say Notes edits outside edit mode, like History.
  - Remove `.editMode=${this._editMode}` from the `<ed-notes>` template in ed-app.
- **Dependencies:** none.
- **Acceptance criteria:**
  - With edit mode off, "+ Add note" is visible and opens the note modal. Saving adds the note, marks the character dirty and persists through the existing overlay.
  - Cards render identically with edit mode on and off.
  - The empty view never mentions edit mode.
  - History, Log and Legend are unchanged.
  - `grep editMode ui/ed-notes.js` is empty.
- **Risks / unknowns:** None significant. The ed-app change is one line.

### I2 — Hover-revealed ✎/✕ on each card
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3
- **What:** Each card carries ✎ (edit) and ✕ (delete) in its top-right corner.
  They are hidden until the card is hovered or something in it has focus, and are
  always visible on touch. Clicking them never expands the card.
- **Where:** `ui/ed-notes.js` (`_noteCard`, CSS).
- **Approach:**
  - **Card structure (avoids nesting buttons in `role=button`).**
    `.ncard` becomes a plain `div` (`position:relative`) with two children:
    1. `.nread`, the expand target, which fills the card and holds the
       `role="button" tabindex="0" aria-label="Read full note"` attributes, the
       click handler and the Enter/Space handler.
    2. `.nicons`, the icon row, absolutely positioned top-right and placed after
       `.nread` in DOM order so Tab goes read-target → ✎ → ✕.
  - **The whole card face is the expand target (review F1).** Move the card
    padding (`9px 11px`) from `.ncard` onto `.nread`. Make `.nread` fill the card
    (`display:block; box-sizing:border-box; height:100%`; on desktop the square
    `.ncard` keeps `aspect-ratio:1/1; overflow:hidden`). A click anywhere on the
    card, edges included, then lands on `.nread`. `.ncard` keeps the background,
    the radius and `position:relative`.
  - **Focus ring that is not clipped (review F1).** `.ncard`'s
    `overflow:hidden` would clip an outline drawn outside `.nread`. Draw the ring
    on the card through `.ncard:has(.nread:focus-visible)`, using the accent
    colour (`outline: 2px solid var(--accent); outline-offset: 2px`), and
    suppress `.nread`'s own outline (`.nread:focus-visible { outline: none }`).
    An outline on `.ncard` itself is drawn outside its own box and is not
    clipped by its own overflow.
    - Fallback if `:has()` is unsuitable: an inset ring on
      `.nread:focus-visible` (`outline: 2px solid var(--accent); outline-offset: -2px`).
    - Either way the ring follows `:focus-visible`, so a pointer click shows none.
  - The bottom fade `::after` stays on `.ncard` (`pointer-events:none`), so it is
    unaffected.
  - Both icon handlers call `e.stopPropagation()`. The `.nread` key handler also
    returns early unless `e.target === e.currentTarget`. Both are belt-and-braces;
    the sibling structure already prevents the expand.
  - ✎ calls `_openNote(n.id, e.currentTarget)`. ✕ calls `_requestConfirm('note', n.id)`.
  - Keep the `class="edit"` / `class="del"`, aria-labels and titles ("Edit note", "Delete note") so the existing hover colours apply.
  - **Reveal CSS**, mirroring `ed-overview.js` l.227-234:
    - `.nicons { opacity:0; transition: opacity .15s ease; background: var(--bg-card); border-radius: 6px; }`
    - `.ncard:hover .nicons, .ncard:focus-within .nicons, .nicons :focus-visible { opacity:1 }`
    - `@media (hover: none) { .nicons { opacity:1 } }`
    - `z-index` above the fade.
  - With opacity-only toggling, the icons never take part in layout, so nothing
    shifts.
  - Under `(hover: none)` the icons are permanently visible. Give `.nread` a top
    right padding (or a float spacer) inside that media query so the icons never
    permanently cover note text. On desktop, covering text briefly on hover is
    acceptable.
  - Use only existing `light-dark()` variables and `--fs-*` sizes. Add no inline
    `style=` on buttons (UI-kit check).
- **Dependencies:** I1 (single card layout).
- **Acceptance criteria:**
  - On desktop the icons are invisible until hover, and visible whenever the card's read target or an icon has keyboard focus.
  - With `hover: none`, the icons are always visible and do not cover text.
  - Clicking or pressing Enter on ✎ or ✕ never opens the popup. Clicking anywhere on the card face (padding/edges included, outside the icons), or Enter/Space on the focused card, does.
  - A keyboard-focused card shows a visible focus ring in light and dark (not clipped by the card's `overflow:hidden`). A pointer click shows none.
  - No layout shift when the icons appear.
  - Edit and delete work with edit mode off. Delete still asks for confirmation.
  - Works in light and dark.
  - `npm test` (UI-kit check) is green.
- **Risks / unknowns:**
  - Hover state on hybrid devices. `(hover: none)` follows the primary input,
    which is the same trade-off already accepted for Overview `.info`.

### I3 — Edit and Delete in the full-note popup, with focus hand-offs
- **Covers tickets:** T3 (and the post-delete focus for I2's ✕)
- **Rules:** none
- **Tier:** 1 (signed off: qa-log 2026-11-27T21:25:00Z, MODALS.md §5 D5 exception)
- **What:** The popup shows **Edit** and **Delete** in both modes.
  - Edit closes the popup and opens the note modal for that note.
  - Delete opens the existing delete confirm **stacked on top of the popup**.
- **Where:** `ui/ed-notes.js` (`_expandedNoteTmpl`, the card `open` handler,
  `_confirmDelete`, `updated`, CSS). New `ui/notes-state.js` (pure helper, see I4).
- **Approach:**
  - **Popup markup.** Keep `_expCtl` `kind: 'info'` with no `ack`. Append an
    action row to the popup body:
    `<div class="nfoot"><button class="btn danger" …>Delete</button><button class="btn" …>Edit</button></div>`.
    - The row is right-aligned with a top margin, using its own class
      (`.nfoot`), **not** `.mfoot`/`.mbtns` CSS.
    - `.btn` and its tones come from `modalCss`/`buttonCss`. This is markup only:
      no `button.btn` CSS and no inline style.
    - Keyboard: Enter on the dialog closes it (R15, unchanged). Enter or Space on
      Edit/Delete activates the button natively (R13, non-primary button passes).
      Escape closes only the top modal (R10).
  - **Remember the popup trigger.** In the card `open` handler, store
    `this._expTrigger = e.currentTarget` (the `.nread` element) next to
    `_expCtl.opened(...)`. Clear it in `_expCtl`'s `onClose` (and in the
    `characterId` reset in `updated`).
  - **Edit hand-off** (MODALS §4 "Hand-offs"):
    `const id = this._expandedNote, t = this._expTrigger; this._expCtl.close({ restoreFocus: false }); this._openNote(id, t);`
    - The note modal's controller then owns focus and returns it to the card's
      `.nread` on Save or Cancel. The card node survives an edit because the list
      is unkeyed and the order is unchanged.
    - The note modal keeps its dirty guard and its Ctrl/⌘+Enter save.
  - **Delete: resolves T3's open question.** Delete-cancel **returns to the popup**.
    - `_requestConfirm('note', id)` while the popup stays open. `<ed-confirm>`
      renders after the popup in `render()`, so DOM order puts it on top at layer 2100.
    - Its trigger is the popup's Delete button (`deepActiveElement()`).
    - Cancel, Escape or ✕ closes only the confirm, the top modal (MODALS §2.1).
      The kit restores focus to the Delete button. `_closeConfirm` needs no new
      code for this.
    - This is the same stacked pattern as the Discard prompt: cancelling a
      stacked prompt returns you to the modal underneath (MODALS §4 Dirty guard).
      Closing both on cancel would break "Escape closes only the top modal" and
      throw away the user's context.
  - **Delete confirm path.**
    1. ed-confirm closes first.
    2. `_confirmDelete` dispatches the filtered list (through the
       `removeNote(list, id)` helper).
    3. If `this._expandedNote === c.id`, call `this._expCtl.close({ restoreFocus: false })`,
       so no popup stays open on a deleted note.
    4. For every `kind === 'note'` delete, whether from the popup or a card ✕, set
       `this._focusAddAfterUpdate = { keyboard: currentModality() === 'keyboard' }`.
  - **Post-delete focus.** In `updated(changed)`, when `changed.has('model')` and
    the flag is set, clear the flag. Then call
    `returnFocusToTrigger(addBtn, { openedByKeyboard })` on the "+ Add note" button
    (query `.addbtn` in the notes view).
    - It has to run after the model update, because ed-app re-renders
      asynchronously.
    - Without this, focus would sit on a reused node now showing a different
      note, or fall to `<body>` (the trigger-gone case in MODALS §7).
    - `currentModality` and `returnFocusToTrigger` are imported from `./kit/modal-controller.js`.
  - **Defensive.** In `updated`, if `_expandedNote` is set but no longer in
    `_notes()` (for example, deleted elsewhere), close `_expCtl` with
    `{ restoreFocus: false }`.
- **Dependencies:** I1, I2 (card structure and `.nread` trigger). I4 helper
  (or inline first, then extract).
- **Acceptance criteria:**
  - The popup shows Edit and Delete with edit mode on and off.
  - Edit opens the note modal pre-filled with that note. Save updates it. Focus returns to that card.
  - Delete opens the confirm above the popup.
    - Cancel or Escape returns to the popup, with focus on Delete.
    - Confirm removes the note, leaves no popup open, and moves focus to "+ Add note" (ring only if keyboard-driven).
  - Card ✕ → confirm → focus lands on "+ Add note".
  - Enter on the popup's dialog closes it. Enter on Edit/Delete activates that button. Escape closes only the top modal.
  - `npm test` is green.
- **Risks / unknowns:**
  - `returnFocusToTrigger` is designed for triggers; using it as a fallback
    target is fine because it only focuses the element and handles the ring.
  - If ed-app's re-render ever batches differently, the `updated` flag pattern
    still holds because it waits for `model` to change.

### I4 — Pure helper + tests, docs, changelog
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3
- **What:**
  - **Helper.** Add `ui/notes-state.js` with:
    - `upsertNote(list, id, text, makeId)`: a new note (`id == null`) is
      unshifted with `makeId()`; an existing one has its text replaced and keeps
      its other fields.
    - `removeNote(list, id)`.
    Both are pure, never mutate their input and contain no DOM or lit.
  - Use it in `_saveNote` and in `_confirmDelete` for the `note` kind.
  - **Tests.** Add `ui/notes-state.test.js`: add, edit (preserves other fields,
    keeps order), edit of a missing id (no-op), remove (present and missing), and
    input immutability.
  - **Docs:**
    - `docs/UI-GUIDELINES.md`: add an italic note after the tab table (style of
      l.74-82), roughly: "*Notes tab (update-notes-edit, 2026-11-27): like
      History, Notes adds, edits and deletes outside edit mode. Cards are always
      square with a bottom fade and click to open the full note. ✎/✕ appear on
      hover or focus (always on touch). The full-note popup has Edit and Delete,
      and Delete's cancel returns to the popup.*"
    - `docs/MODALS.md` §5: under "Footers (D5) and hint (V4)", add a named,
      dated exception next to the Roll-modal exception and worded like it:
      "**Notes full-note popup exception** (owner, update-notes-edit qa-log
      2026-11-27T21:25:00Z): the Notes full-note popup (`kind: 'info'`) shows
      **Edit** and **Delete** in a row at the end of its body, not a kit footer;
      `ui/kit/` is unchanged and Enter on the dialog still closes it."
    - `plans/PLAN-NOTES-TAB.md` l.171: amend the stale "edit-mode add + per-card
      edit/delete" with a dated pointer to this feature.
  - **Changelog.** In `data/changelog.json` `unreleased`, add a summary and an
    `improved` entry: "Notes can now be added, edited and deleted without edit
    mode: + Add note is always there, ✎/✕ appear when you hover a note (always
    shown on touch), and the full-note popup has Edit and Delete."
- **Where:** `ui/notes-state.js` (new), `ui/notes-state.test.js` (new),
  `ui/ed-notes.js`, `docs/UI-GUIDELINES.md`, `docs/MODALS.md`,
  `plans/PLAN-NOTES-TAB.md`, `data/changelog.json`.
- **Dependencies:** the helper can land before or with I3. The docs and changelog land last.
- **Acceptance criteria:**
  - `npm test` is green, including `check-imports` (the new module is imported by a relative `./notes-state.js` path) and `check-ui-kit` (ed-notes stays at 0).
  - UI-GUIDELINES, MODALS.md and the changelog describe the new behaviour.
- **Risks / unknowns:** None.

## Sequencing
1. **I1.** It removes the mode split, so I2 and I3 work on one card layout.
2. **I4 helper + tests.** A small, independent piece that lets I3 use `removeNote`/`upsertNote` directly.
3. **I2.** The card structure (`.nread` + `.nicons`) is what I3's trigger and focus logic rely on.
4. **I3.** The popup buttons and focus hand-offs.
5. **I4 docs + changelog.** Written last so they describe what was built.

All items are small and could ship as one commit. The order above is for review.

## Manual verification (owner)
`node:test` covers only the I4 helper. The owner checks the following by hand,
in **light and dark**, at **desktop width and ≤720px** (and with touch emulation,
`hover: none`, for the reveal item):

**I1**
- [ ] With edit mode off, "+ Add note" adds a note and the character is marked dirty.
- [ ] Cards look the same with edit mode on and off.
- [ ] The empty state has no edit-mode hint.

**I2**
- [ ] Desktop: ✎/✕ are hidden until the card is hovered, and visible when the card or an icon has keyboard focus.
- [ ] Touch (`hover: none`): ✎/✕ are always visible and never cover the note text.
- [ ] No layout shift when the icons appear.
- [ ] Clicking ✎/✕, or pressing Enter on them, never opens the popup.
- [ ] Clicking anywhere on the card face (edges included) opens it, and so does Enter/Space on the focused card.
- [ ] A keyboard-focused card shows a visible, unclipped focus ring; a pointer click shows none.

**I3**
- [ ] The popup shows Edit and Delete with edit mode on and off.
- [ ] Popup Edit opens the note modal pre-filled. Save updates the note, and focus returns to that card. Cancel also returns focus to the card.
- [ ] Popup Delete → confirm on top. Cancel or Escape closes only the confirm, and focus returns to the popup's Delete button.
- [ ] Popup Delete → Confirm removes the note and leaves no popup open. Focus lands on "+ Add note", with a ring only if keyboard-driven.
- [ ] Card ✕ → Confirm puts focus on "+ Add note".
- [ ] Escape closes only the top modal.
- [ ] Enter on the popup dialog closes it; Enter on Edit/Delete activates that button.

## Open questions
- None blocking. T3's open question is resolved: Delete-cancel returns to the
  popup, following the stacked-modal rule in MODALS.md §2.1 and the Discard
  precedent in §4.

## Review responses
- **F1 (major): I2 `.nread` focus ring clipped, padding not clickable. Fixed.**
  - In I2, the padding moves from `.ncard` to `.nread`, which fills the card, so
    the whole card face expands the card.
  - The focus ring now has a defined, unclipped home: on `.ncard` via
    `:has(.nread:focus-visible)`, with an inset `outline-offset: -2px` ring on
    `.nread` as the fallback.
  - I2 gains the acceptance criterion "a keyboard-focused card shows a visible
    focus ring in light and dark".
- **F2 (minor): manual verification named only for touch padding. Fixed.** A
  "Manual verification (owner)" checklist now covers the I1–I3 DOM, CSS and
  focus criteria in light and dark at desktop and ≤720px. It absorbs the former
  touch-padding open question.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
