# QA log — simple-animate-portrait

## 2026-11-24T11:30:00Z — asked by interrogator
**Q:** Should the two animation toggles apply to every character on this device, or be set separately per character?
**A:** Device-wide. Two switches stored in this browser's localStorage like the autosave setting; every character's portrait follows them. No schema change.

## 2026-11-24T11:32:00Z — asked by interrogator
**Q:** Where should the animations play?
**A:** Desktop panel + mobile avatar. The click-to-enlarge lightbox stays a still.

## 2026-11-24T11:33:00Z — asked by interrogator
**Q:** What should the default state of the two toggles be for someone who has never touched them?
**A:** Both off.

## 2026-11-24T11:35:00Z — asked by interrogator
**Q:** If the user's OS has "reduce motion" on, what should happen when a toggle is on?
**A:** Stay still. OS reduce-motion wins: no animation plays even if the toggle is on, and Settings shows a hint saying why.

## 2026-11-24T11:36:00Z — asked by interrogator
**Q:** Apply timing of the new switches: on Save (draft) or instant?
**A:** Apply on Save, matching the modal's existing contract.

## 2026-11-24T11:38:00Z — asked by interrogator
**Q:** Anything else, or are these the right tickets?
**A:** Nothing else.
