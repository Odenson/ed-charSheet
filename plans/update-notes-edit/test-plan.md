# Test Plan: Notes tab editable outside edit mode (update-notes-edit)

## Test files
ui/notes-state.test.js
ui/notes-edit-source.test.js

## Coverage

No Earthdawn rules apply (rules.md: "No Earthdawn rules apply"), so every case is **Rule: n/a**.

### ui/notes-state.test.js (pure helper, spec "Edge cases & invariants" helper table)
Each case uses a deep-frozen fixture `[{a},{b, foo:42},{c}]` and a counting `makeId` stub.

#### upsertNote — new note › prepends { id: makeId(), text } and keeps the original entries in order
- **Validates:** `upsertNote(list, null, t, makeId)`: the length grows by 1, index 0 is `{id, text}` and the rest keep their order.
- **Rule:** n/a
- **Why:** catches appending instead of unshifting, a wrong entry shape, or reordering.

#### upsertNote — new note › calls makeId exactly once
- **Validates:** `makeId` is called exactly once for a new note.
- **Rule:** n/a
- **Why:** catches double id generation, which would produce mismatched ids.

#### upsertNote — new note › undefined id is treated as a new note too
- **Validates:** the "id == null" contract (`_saveNote` passes `this._noteModal?.id ?? null`).
- **Rule:** n/a
- **Why:** catches a strict `=== null` check.

#### upsertNote — new note › stores text as given
- **Validates:** "`text` is stored as given". Trimming stays in `_saveNote`.
- **Rule:** n/a
- **Why:** catches the trim logic moving into the helper.

#### upsertNote — new note › does not mutate the input
- **Validates:** the non-mutation invariant on a frozen list.
- **Rule:** n/a
- **Why:** catches `unshift` on the caller's array, which would throw because the list is frozen.

#### upsertNote — existing id › replaces only that entry's text; same length and order
- **Validates:** for an existing id, only that entry's `text` changes and the length and order stay the same.
- **Rule:** n/a
- **Why:** catches edits that reorder the list (focus return relies on the unkeyed order) or touch other entries.

#### upsertNote — existing id › preserves the entry's other fields
- **Validates:** other fields (`foo`) are kept.
- **Rule:** n/a
- **Why:** catches rebuilding the entry as `{id, text}`, which would drop data.

#### upsertNote — existing id › the edited entry is a new object; makeId is not called
- **Validates:** the edited entry is a new object and `makeId` is not called.
- **Rule:** n/a
- **Why:** catches in-place entry mutation and stray id generation.

#### upsertNote — existing id › does not mutate the input
- **Validates:** non-mutation on a frozen list with frozen entries.
- **Rule:** n/a
- **Why:** catches `entry.text = t`.

#### upsertNote — missing id › returns a copy deep-equal to the input; makeId is not called
- **Validates:** a missing id is a no-op that returns a shallow copy.
- **Rule:** n/a
- **Why:** catches a missing id being added as a new note, and catches returning the same array reference.

#### removeNote › removes the entry and keeps the remaining order
- **Validates:** `removeNote(list, id)`.
- **Rule:** n/a
- **Why:** catches wrong-entry removal and reordering.

#### removeNote › removing first and last entries
- **Validates:** the boundary positions.
- **Rule:** n/a
- **Why:** catches off-by-one splice logic.

#### removeNote › removing the only entry yields []
- **Validates:** deleting the last note leaves an empty list, which drives the empty-state path.
- **Rule:** n/a
- **Why:** catches failure on a single-entry list.

#### removeNote › missing id returns a copy deep-equal to the input
- **Validates:** a missing id returns an unchanged copy.
- **Rule:** n/a
- **Why:** catches returning the input reference, and catches removal of the wrong entry.

#### removeNote › does not mutate the input
- **Validates:** non-mutation.
- **Rule:** n/a
- **Why:** catches `splice` on the caller's array.

#### null / undefined list is treated as [] (6 cases: upsert new, upsert with an id, remove; each for null and for undefined)
- **Validates:** "A null or undefined `list` is treated as `[]`".
- **Rule:** n/a
- **Why:** catches crashes on a character that has no notes yet.

### ui/notes-edit-source.test.js (static source guards; ed-notes is lit and cannot be loaded under node)

#### ed-notes edit-mode independence › no longer references editMode at all
- **Validates:** the invariant "`grep editMode ui/ed-notes.js` returns nothing" (I1).
- **Rule:** n/a
- **Why:** catches a leftover gate on Add, the cards or the empty state.

#### › the read-only card variant (.cards.read) is gone
- **Validates:** one layout in both modes, and removal of the `.cards.read` selectors.
- **Rule:** n/a
- **Why:** catches a surviving two-layout split.

#### › the old edit-mode action row (.nactions) is gone
- **Validates:** the "Remove `.nactions`" spec item.
- **Rule:** n/a
- **Why:** catches the old edit-mode card markup or CSS left in place.

#### › the edit-mode-only empty hint is gone; the single empty message remains
- **Validates:** the empty-state text in `_notesView()`.
- **Rule:** n/a
- **Why:** catches the stale "Turn on edit mode" hint.

#### helper wiring › imports upsertNote and removeNote from ./notes-state.js
- **Validates:** the relative import that the spec mandates (I4).
- **Rule:** n/a
- **Why:** catches the helper being unused, which would leave inline list logic in place.

#### helper wiring › ui/notes-state.js is pure
- **Validates:** "pure, no DOM or lit imports".
- **Rule:** n/a
- **Why:** catches DOM or lit coupling that would break node tests.

#### card and popup markup › .nread role="button" with a sibling .nicons row
- **Validates:** the card structure (I2).
- **Rule:** n/a
- **Why:** catches a missing expand target or a missing icon row.

#### › icon buttons keep their aria-labels
- **Validates:** "Keep class edit/del and the aria-labels".
- **Rule:** n/a
- **Why:** catches an accessibility regression.

#### › popup action row uses .nfoot, never the kit .mfoot
- **Validates:** the MODALS D5 exception (I3, Tier 1 sign-off): the row sits in the body and no kit footer is used.
- **Rule:** n/a
- **Why:** catches borrowing the kit footer class or CSS.

#### › ed-notes stays at 0 on every check-ui-kit counter
- **Validates:** "ed-notes has no baseline entry and must stay at 0" (via `countViolations` from tools/check-ui-kit.mjs).
- **Rule:** n/a
- **Why:** catches `button.btn` CSS, inline button styles, non-`--fs-*` font sizes and similar, with a precise per-rule message.

#### ed-app binding › <ed-notes> is no longer bound with .editMode
- **Validates:** the ed-app l.2735 removal (I1). `.model` and `.characterId` are still bound.
- **Rule:** n/a
- **Why:** catches a leftover binding, and catches over-deletion of the other props.

#### › <ed-combat> keeps its .editMode binding
- **Validates:** "Do not touch the `.editMode` binding on `<ed-combat>`".
- **Rule:** n/a
- **Why:** catches the wrong line being removed.

#### changelog › has the "improved" Notes entry
- **Validates:** the changelog entry (I4). It matches on the entry's opening sentence and searches both unreleased and releases, so the test survives a release.
- **Rule:** n/a
- **Why:** catches a missing changelog line.

Total: 21 helper cases + 13 source cases = 34.

## Not covered (and why)
There is no browser harness, so all DOM, focus and CSS behavior needs the owner's manual check. Check light and dark, desktop and ≤720px, and with `hover: none` emulation (see plan.md, "Manual verification (owner)").

- **Edit mode off and on:** "+ Add note" is always shown. Cards are square with a bottom fade. At ≤720px they become free-height in one column with no fade.
- **Card click:** a click anywhere on the card face, including the padding but not the icons, opens the full-note popup. Enter or Space on the focused card does the same.
- **Icons:** ✎/✕ are hidden until hover or keyboard focus on desktop, and always visible under `hover: none` without covering the text. Clicking ✎/✕ never opens the popup.
- **Focus:**
  - Tab order is card → ✎ → ✕.
  - The focus ring wraps the whole card, is unclipped, and appears for keyboard focus only (not on a mouse click).
- **Card ✎:** opens the note modal pre-filled. Save or Cancel returns focus to ✎.
- **Card ✕:**
  - It opens the confirm.
  - On confirm, the note is gone and focus lands on "+ Add note", with a ring only when keyboard-driven.
  - Deleting the last note shows the empty message, and focus still lands on "+ Add note".
- **Popup:**
  - It shows the full text and a right-aligned Delete (danger) / Edit row.
  - Escape, ✕ and the backdrop close it and return focus to the card.
  - Enter on the dialog closes it. Enter or Space on Edit/Delete activates that button.
- **Popup Edit:**
  - The popup closes and the note modal opens pre-filled.
  - Save or Cancel returns focus to the same card.
  - The dirty guard and Ctrl/⌘+Enter still work.
- **Popup Delete:**
  - The confirm stacks above the popup.
  - Cancel, Escape or ✕ closes only the confirm, and focus returns to the popup's Delete button.
  - Confirm removes the note, closes the popup and focuses "+ Add note".
- **Character switch with the popup open:** the popup closes without a focus jump.
- **Other views:** History, Log and Legend are unchanged.
- **ui/kit unchanged:** this is a review-time check (`git diff --stat ui/kit/` should be empty). It is not a node test, because a working-tree diff check is environment-dependent.
- **No `<button>` nested inside `role="button"`:** verified by markup review. A static regex over the lit template would be brittle.
- **Docs (UI-GUIDELINES note, MODALS §5 exception, PLAN-NOTES-TAB l.171):** review only.

## How to run
`npm test`
