# Q&A log: save-spinner

## 2026-11-23 — asked by interrogator
**Q:** Which in-progress indicator: blocking modal spinner, non-blocking corner pill, or spinner on the Save icon?
**A:** Blocking modal spinner.

## 2026-11-23 — asked by interrogator
**Q:** Tier-1 rule (UI-GUIDELINES §7 / MODALS §2): every modal closes on Escape/backdrop; a non-dismissible spinner would break it. How should it behave?
**A:** Dismissible overlay — kit modal; Escape/backdrop/OK hides it while the save continues in the background. (Tier 3; no Tier-1 exception requested.)

## 2026-11-23 — asked by interrogator
**Q:** Confirm: spinner only for manual Saves (not silent autosave/flush-on-hide); auto-closes on success, error, or when the conflict modal opens; existing saved/error toasts unchanged; no minimum display time. Anything to change/add?
**A:** Correct, nothing else.
