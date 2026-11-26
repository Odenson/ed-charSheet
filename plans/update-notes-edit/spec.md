# Tech Spec: Notes tab editable outside edit mode (update-notes-edit)

## Overview
`<ed-notes>` drops its `editMode` property, so the Notes sub-view always shows
"+ Add note" and uses one card layout: square, with a bottom fade and click to
expand. Each card becomes a plain container that holds an expand target (`.nread`)
and a sibling icon row (`.nicons`, ✎/✕). The icons appear on hover or focus and
are always shown under `(hover: none)`. The full-note popup (`_expCtl`,
`kind: 'info'`) gains a body-level Edit/Delete row. Edit hands off to the note
modal; Delete stacks the existing `<ed-confirm>`. Note-list edits move into a new
pure helper, `ui/notes-state.js`. The `ed-edit-notes` event, its payload and the
data shape do not change.

## Guardrail alignment
- **I1 (edit-mode independence), I2 (hover icons), I4 (helper, tests, docs,
  changelog): Tier 3.** These are view and prop-wiring changes inside `ed-notes`.
  History is the precedent for editing outside edit mode.
- **I3 (popup Edit/Delete): Tier 1, signed off** at qa-log
  **2026-11-27T21:25:00Z**. It is a MODALS.md §5 D5 exception: Edit/Delete go in
  a body row, the popup stays `kind: 'info'` with no `ack` and no kit footer, and
  **no `ui/kit/` file changes**. Enter on the dialog still closes it (R15).
- Data down, dispatch up still holds. ed-notes only dispatches `ed-edit-notes`
  with the full new list, and ed-app (`_editNotes`, l.1670-1676) applies,
  persists and re-derives it.
- No engine change. No stored derived values. No schema change, and no derived
  game values are involved, so no placeholder pills are affected.
- Theme: only existing `light-dark()` variables (`--bg-card`, `--accent`,
  `--danger`, `--muted`) and `--fs-*` tokens.
- `tools/check-ui-kit.mjs`: ed-notes has no entry in
  `tools/ui-kit-baseline.json` and must stay at 0 on every counter. That rules
  out: literal `role="dialog"`, CSS naming `.overlay`, `.modal`, `.mhead`,
  `.mclose` or `button.btn`, non-`--fs-*` font sizes, and inline `style=` on a
  `<button>`.
- I found no Tier-1 item that the plan missed.

## Design

### Data / types
None. Notes stay `[{ id: string, text: string, ...other }]` in the overlay. No new
inputs and no derived values.

### Modules & functions

**`ui/notes-state.js` (new, pure, no DOM or lit imports)**
```js
/** New note (id == null) → [{ id: makeId(), text }, ...list].
 *  Existing id → copy of list with that entry's text replaced. Other fields and order are preserved.
 *  Missing id → shallow copy, unchanged. Never mutates `list` or its entries. */
export function upsertNote(list, id, text, makeId)
/** Copy of list without the entry whose id === id (an unchanged copy if absent). Never mutates. */
export function removeNote(list, id)
```
- `text` is stored as given. The `.trim()` and empty-text rejection stay in
  `_saveNote`.
- A null or undefined `list` is treated as `[]`.

**`ui/notes-state.test.js` (new)**
- Runs under `node --test`, in the house style of
  `ui/attribute-improve-state.test.js`.

**`ui/ed-notes.js`**
- **Imports.**
  - Add `import { upsertNote, removeNote } from './notes-state.js';`.
  - Extend the kit import:
    `import { ModalController, currentModality, returnFocusToTrigger } from './kit/modal-controller.js';`.
- **`static properties`.**
  - Remove `editMode`.
  - Update the comment on `_expandedNote` to "full-text popup", dropping
    "read-mode".
- **Instance fields (not reactive).**
  - `_expTrigger`: the `.nread` element that opened the popup, or `null`.
  - `_focusAddAfterUpdate`: `null` or `{ keyboard: boolean }`.
- **`constructor`.** Change `_expCtl`'s `onClose` to
  `() => { this._expandedNote = null; this._expTrigger = null; }`.
- **`updated(changed)`.** Keep the existing `characterId` reset, and also null
  `_expTrigger` there. Then add two steps:
  1. **Defensive close.** If `this._expandedNote != null` and
     `!this._notes().some(n => n.id === this._expandedNote)`, call
     `this._expCtl.close({ restoreFocus: false })`.
  2. **Post-delete focus.** If `changed.has('model')` and
     `this._focusAddAfterUpdate` is set:
     1. Read `{ keyboard }` and set the flag to `null`.
     2. Call
        `returnFocusToTrigger(this.renderRoot.querySelector('.addbtn'), { openedByKeyboard: keyboard })`.
        It is a no-op if the element is missing, for example when the user has
        switched to another sub-view.
- **`_saveNote`.** Replace the inline unshift/replace with
  `this._dispatchNotes(upsertNote(this._notes(), this._noteModal?.id ?? null, text, uid))`.
  The empty-text guard and `_noteCtl.close({ reason: 'confirm' })` stay as they
  are.
- **`_confirmDelete`, `kind === 'note'` branch.** Do these in order:
  1. `this._dispatchNotes(removeNote(this._notes(), c.id))`.
  2. If `this._expandedNote === c.id`, call
     `this._expCtl.close({ restoreFocus: false })`.
  3. Set `this._focusAddAfterUpdate = { keyboard: currentModality() === 'keyboard' }`.

  The branch then falls through to the existing `this._confirm = null`. Do not
  change the other kinds or `_closeConfirm`.
- **`_notesView()`.**
  - Render `<button class="addbtn" @click=${(e) => this._openNote(null, e.currentTarget)}>+ Add note</button>`
    unconditionally.
  - The cards container becomes `<div class="cards">`, with no `read` class.
  - The empty state becomes the single message:
    `No notes yet — add NPCs, locations, quest threads, or table reminders.`
- **`_noteCard(n)`.** Use one branch, with this markup:
  ```html
  <div class="ncard">
    <div class="nread" role="button" tabindex="0" aria-label="Read full note"
         @click=${open} @keydown=${onKey}>
      <div class="ntext">${n.text}</div>
    </div>
    <div class="nicons">
      <button class="edit" aria-label="Edit note" title="Edit note"
              @click=${(e) => { e.stopPropagation(); this._openNote(n.id, e.currentTarget); }}>✎</button>
      <button class="del" aria-label="Delete note" title="Delete note"
              @click=${(e) => { e.stopPropagation(); this._requestConfirm('note', n.id); }}>✕</button>
    </div>
  </div>
  ```
  - `open = (e) => { this._expandedNote = n.id; this._expTrigger = e.currentTarget; this._expCtl.opened(e.currentTarget); }`.
  - `onKey` returns unless `e.target === e.currentTarget`. On Enter or Space it
    calls `preventDefault()` and then `open(e)`.
- **`_expandedNoteTmpl()`.** The body becomes:
  ```html
  <div class="ntext">${entry?.text ?? ''}</div>
  <div class="nfoot">
    <button class="btn danger" @click=${() => this._requestConfirm('note', this._expandedNote)}>Delete</button>
    <button class="btn" @click=${() => this._popupEdit()}>Edit</button>
  </div>
  ```
  - Keep `title: 'Note'`, `layer: 2100` and `width: '30rem'`.
  - Add no `ack`, `extra` or `kind` change.
- **New `_popupEdit()`.**
  `const id = this._expandedNote, t = this._expTrigger; this._expCtl.close({ restoreFocus: false }); this._openNote(id, t);`
  Read both values **before** `close()`, because `onClose` nulls them.
- **Comment at l.272.** Replace "Notes CRUD (edit-mode gated; …)" with
  "Notes CRUD (outside edit mode, like History; untimed cards, decision #4)".
- **CSS (in the component's `css` block).**
  - **`.ncard`:** `background: var(--bg-card); border-radius: 8px; position: relative; aspect-ratio: 1 / 1; overflow: hidden;`.
    Remove the padding, flex, gap and `cursor` declarations.
  - **`.ncard::after`:** the existing bottom fade, retargeted from
    `.cards.read .ncard::after`, with `pointer-events: none`.
  - **`.nread`:** `display: block; box-sizing: border-box; height: 100%; padding: 9px 11px; cursor: pointer;`.
  - **Focus ring:**
    - `.nread:focus-visible { outline: none; }`
    - `.ncard:has(.nread:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }`
    - Fallback, only if `:has()` proves unsuitable:
      `.nread:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }`.
  - **`.nicons`:** `position: absolute; top: 4px; right: 4px; z-index: 1; display: flex; gap: 2px; background: var(--bg-card); border-radius: 6px; opacity: 0; transition: opacity 0.15s ease;`.
  - **Reveal:** `.ncard:hover .nicons, .ncard:focus-within .nicons, .nicons :focus-visible { opacity: 1; }`.
  - **Touch:** `@media (hover: none) { .nicons { opacity: 1; } .nread { padding-right: <enough to clear the icons, e.g. 3.5rem>; } }`.
    Reserve only right padding. The icons sit at the top, so a top-right
    `padding-top` or a float spacer is also acceptable.
  - **`.nfoot`:** `display: flex; justify-content: flex-end; gap: 8px; margin-top: 0.9rem;`.
    This is a new class name. Never name `.mfoot` or `button.btn` here.
  - **Remove** `.nactions` and every `.cards.read` selector.
  - **Keep** the `.edit`, `.del` and `:hover` colour rules (l.100-102).
  - **`@media (max-width: 720px)`:** `.ncard { aspect-ratio: auto; }` and
    `.ncard::after { display: none; }`. Keep the rest of the block.

**`ui/ed-app.js`**
- Remove the line `.editMode=${this._editMode}` from the `<ed-notes>` template
  (case `'notes'`, about l.2735).
- Do not touch the `.editMode` binding on `<ed-combat>` just above it (about
  l.2728).

**Docs and data**
- **`docs/UI-GUIDELINES.md`:** add a dated italic note after the tab table, in the
  style of l.74-82. Use the wording from plan I4.
- **`docs/MODALS.md` §5 "Footers (D5) and hint (V4)":**
  - Add a **Notes full-note popup exception** sentence right after the
    Roll-modal exception, worded like plan I4: owner, update-notes-edit qa-log
    2026-11-27T21:25:00Z, `kind: 'info'`, Edit/Delete in a row at the end of the
    body, not a kit footer, `ui/kit/` unchanged, and Enter on the dialog still
    closes it.
  - Optionally note in §4 or the dirty-guard text that Delete-cancel returns to
    the popup.
- **`plans/PLAN-NOTES-TAB.md` l.171:** amend "read-mode cards; edit-mode add +
  per-card edit/delete" with a dated pointer to update-notes-edit.
- **`data/changelog.json`:** set `unreleased.summary`, if it is empty, and append
  the entry below to `unreleased.changes`.

### UI / behavior
- **Notes sub-view, in both edit-mode states:**
  - The header always shows "+ Add note".
  - The cards are square, with a fade at the bottom.
  - At ≤720px the cards switch to free height with no fade, in a single column.
- **Card interactions:**
  - **Card face.** A click anywhere on the card face, padding included but
    outside the icons, opens the popup. So does Enter or Space on the focused
    `.nread`.
  - **Focus ring.** It appears on the whole card for keyboard focus only.
  - **Tab order.** `.nread` → ✎ → ✕.
  - **✎** opens the note modal pre-filled, and its trigger is the ✎ button.
  - **✕** opens the delete confirm. On confirm, focus goes to "+ Add note"
    (the post-delete focus path).
  - Neither icon ever opens the popup.
- **Popup behavior:**
  - The popup shows the full text, plus a right-aligned row with Delete
    (danger tone) and Edit.
  - **Escape, ✕ and backdrop** close the popup and return focus to `.nread`.
    This is unchanged.
  - **Enter on the dialog** (not on a button) closes it. This is R15, unchanged.
  - **Enter or Space on Edit/Delete** activates that button natively (R13).
- **Edit from the popup:**
  - The popup closes without restoring focus, and the note modal opens with
    `.nread` as its trigger.
  - Save or Cancel in the note modal returns focus to the same card's `.nread`.
    The list is unkeyed, but an edit does not change its order.
  - The note modal keeps its dirty guard and Ctrl/⌘+Enter.
- **Delete from the popup:**
  - `<ed-confirm>` stacks above the popup at layer 2100; it renders later in
    `render()`.
  - **Cancel, Escape or the confirm's ✕** closes only the confirm. Focus returns
    to the popup's Delete button.
  - **Confirm:**
    1. The confirm closes.
    2. The note is removed.
    3. The popup closes without restoring focus.
    4. After the next `model` update, focus lands on "+ Add note", with a ring
       only if keyboard-driven.
- **Theme.** The changes must look right in light and dark. `.nicons` uses the
  `--bg-card` background so the icons stay legible over text.
- **Overview viewport fit** is not relevant.

### Rules
None. `rules.md` records that no Earthdawn rule applies. This is a pure UI
interaction change and computes no game values.

| Rule | Value | rules.md id / source |
|---|---|---|
| none | — | rules.md: "No Earthdawn rules apply" |

### Edge cases & invariants
- **Helper behavior** (`upsertNote` and `removeNote` never mutate their input
  array or its entries):

  | Call | Result |
  |---|---|
  | `upsertNote(list, null, t, makeId)` | `makeId` is called exactly once. The result has length `list.length + 1`; index 0 is `{ id: makeId(), text: t }`, followed by the original entries in order. |
  | `upsertNote(list, existingId, t, makeId)` | Same length and order. Only that entry's `text` changes, and its other fields are kept (e.g. an extra `foo`). It is a new object, and `makeId` is not called. |
  | `upsertNote(list, missingId, t, makeId)` | The result deep-equals `list` (a no-op), and `makeId` is not called. |
  | `removeNote(list, id)` | The entry is removed and the remaining order is kept. |
  | `removeNote(list, missingId)` | The result deep-equals `list`. |
  | Either helper with a `null`/`undefined` list | Treated as `[]`. |
- **Component invariants:**
  - `grep editMode ui/ed-notes.js` returns nothing.
  - The `ed-edit-notes` `detail` is still the full notes array.
  - No `ui/kit/` file is modified.
  - ed-notes keeps a check-ui-kit count of 0.
  - Never nest a `<button>` inside a `role="button"` element.
- **Popup safety:**
  - No popup stays open on a note that no longer exists. This covers deletion
    from the popup, from a card ✕, and an external model change (the defensive
    close in `updated`).
  - Deleting the last note leaves the empty-state message, and focus goes to
    "+ Add note", which is still rendered.
- **Edge interactions:**
  - **Character switch** (a `characterId` change) still closes the popup without
    restoring focus, and clears `_expTrigger`.
  - **History, Log and Legend sub-views:** unchanged.
  - **Discard confirm flows** (`discard-note`, `discard-history`): unchanged.

## Testability notes
- **Unit (node:test):** `ui/notes-state.test.js` covers every helper row in the
  edge-case table above. Test immutability with a frozen input:
  `Object.freeze` on the list and on each entry, then assert no throw and an
  unchanged input. Pass a stub `makeId` (e.g. `() => 'new-1'`) for
  determinism.
- **Import path:** `ed-notes.js` must import the helper by the relative path
  `./notes-state.js`. `tools/check-imports.mjs` runs in `pretest`.
- **`npm test` must stay green,** including `check-ui-kit`.
- **Not unit-testable (owner's manual verification; DOM, focus and CSS).** Run
  the "Manual verification (owner)" checklist in `plan.md` for I1-I3, in light
  and dark, at desktop width and ≤720px, and with `hover: none` emulation. Key
  items:
  - icon reveal and touch padding;
  - no expand from the icons;
  - the unclipped keyboard-only focus ring;
  - popup Edit focus returning to the card;
  - Delete-cancel returning to the popup's Delete button;
  - post-delete focus on "+ Add note" (ring only for keyboard);
  - Escape closing only the top modal;
  - Enter on the dialog versus on the buttons.

## Changelog entry
`{"type": "improved", "text": "Notes can now be added, edited and deleted without edit mode: + Add note is always there, ✎/✕ appear when you hover a note (always shown on touch), and the full-note popup has Edit and Delete."}`

## Out of scope
- History, Log and Legend sub-views.
- The notes data shape and the overlay category.
- The save flow and the `ed-edit-notes` → `_editNotes` → `saveNotesEdits`
  contract.
- Any `ui/kit/` change, including a kit-level info-modal footer.
- Keyed list rendering: vendored lit has no `repeat`.
- Note titles, tags, sorting, search and rich text.
- Edit mode behavior for any other tab.
