# Plan Review: Notes tab editable outside edit mode (update-notes-edit)

## Summary
The plan is sound and well grounded. The cited lines in `ui/ed-notes.js` and `ui/ed-app.js`, the kit exports (`returnFocusToTrigger`, `currentModality`, `deepActiveElement`, `close({ restoreFocus })`), MODALS.md R13/R15 and §5 D5, `.btn.danger` in `buttonCss`, the UI-kit baseline and the changelog shape all check out. Every ticket is covered, and the sequencing is valid. The one Tier-1 item (I3) has the owner's recorded sign-off (qa-log 2026-11-27T21:25:00Z), and its scope matches what was approved: an `info` popup with a body action row and `ui/kit/` unchanged. No rules apply, and `rules.md` agrees. There are 2 findings: 0 blockers, 1 major, 1 minor.

## Findings
### F1 — I2 — The new `.nread` child loses its keyboard focus ring and does not cover the card's padding
- **Severity:** major
- **Problem:** Today the whole `.ncard` is the `role="button"`, so its focus outline is drawn on the card element itself and stays visible. I2 moves focus to a child `.nread` that "fills the card" inside `.ncard`, and `.ncard` keeps `overflow:hidden`, which it needs for the square crop and fade. An outline drawn outside `.nread`'s box is clipped by the parent, so a keyboard user tabbing to a card would see no focus indicator. Only the icons appear through `:focus-within`. There is a second gap: `.ncard` has `padding: 9px 11px`. If `.nread` sits inside that padding, clicks on the card's edge no longer expand it, which breaks "clicking the card body opens the popup".
- **Fix:** In I2, move the padding from `.ncard` to `.nread`, or make `.nread` `position:absolute; inset:0` with the padding on it, so that the whole card face is the expand target. Give the focus ring a defined home that is not clipped: either an inset ring (`.nread:focus-visible { outline-offset: -2px }` or similar), or the ring on the card through `.ncard:has(.nread:focus-visible)`. Add an acceptance criterion: "a keyboard-focused card shows a visible focus ring in light and dark."

### F2 — I2/I3 — Manual verification by the owner is only named for touch padding
- **Severity:** minor
- **Problem:** `node:test` can only cover the I4 helper. Several I2/I3 acceptance criteria are DOM, CSS and focus behaviour that no test exercises:
  - hover/focus reveal and `(hover: none)`;
  - icon clicks not expanding the card;
  - the popup Edit hand-off returning focus to the card;
  - Delete-cancel returning focus to the popup's Delete button;
  - post-delete focus on "+ Add note", with the ring only for keyboard;
  - Escape closing only the top modal.

  The plan's "Open questions" names only the touch padding check as manual.
- **Fix:** Add a short manual-verification checklist for the owner covering the I2 and I3 acceptance criteria above, in light and dark, at desktop and ≤720px widths.
