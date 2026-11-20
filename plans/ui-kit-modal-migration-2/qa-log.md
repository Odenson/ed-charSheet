# Q&A log: UI kit modal migration 2 (ui-kit-modal-migration-2)

Carries forward decisions D1–D8 from [plans/ui-kit-modal-keyboard-contract/qa-log.md](../ui-kit-modal-keyboard-contract/qa-log.md) (Enter = OK; Ctrl/⌘+Enter saves in textarea modals with a hint; free-text modals ask "Discard unsaved changes?"; footer [Cancel] [Primary], read-only ✕ only; hint on input/confirm modals; tab tones kept; picker/inline-field/non-modal cleanups out of scope).

## 2026-11-20T09:21:00Z — asked by interrogator
**Q:** **Tier-1 sign-off.** Add a UI-GUIDELINES §7 line "Textarea modals: Enter types a newline; Ctrl/⌘+Enter saves"? (Tier-3 alternative: MODALS.md only.)
**A:** **Yes — signed off (owner, 2026-11-20).** UI-GUIDELINES §7 gets the Ctrl/⌘+Enter line.

## 2026-11-20T09:23:00Z — asked by interrogator
**Q:** Scope: migrate every remaining baseline modal in one build (emptying the baseline except Spells font-size, legend-spent-view, ed-app button-style), or split in two?
**A:** **One build.**

## 2026-11-20T09:25:00Z — asked by interrogator
**Q:** Discard-changes prompt UI for free-text modals?
**A:** **Stacked ed-confirm** on top: [Keep editing] [Discard]; Escape on it returns to editing.

## 2026-11-20T09:26:00Z — asked by interrogator
**Q:** Defaults for special modals (picker = Enter activates focused row; conflict/save-key input/confirm; changelog/homebrew read-only), anything else?
**A:** **Use defaults, nothing else.**

## 2026-11-20T10:10:00Z — asked by dev-lead
**Q:** Custom item edits persist in the browser overlay, so "Discard" on the close prompt would be false. Which confirm label should the custom-item prompt use?
**A:** **Close** (prompt "Discard unsaved changes?" with [Keep editing] [Close]).
