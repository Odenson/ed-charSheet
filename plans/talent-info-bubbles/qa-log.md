# Q&A log: Talent info bubbles (talent-info-bubbles)

Backlog: B-002, B-003 (planned together as one feature)

## Starting context (backlog blurbs)

**B-002 — Optional talent details in the add-talent modal.**
When advancing a Circle and using Add to pick an optional talent, the modal
shows only each talent's name and a short description. There is no way to see
its full description, the bonuses it provides, or the attribute it works off.
The owner wants a way to understand what each optional talent does before
selecting it.

**B-003 — Talent info bubbles in the new-discipline modal.**
When adding a new discipline, the modal lists the rank 1 talents needed to
complete the first Circle and the optional talents available for it, but
there is no way to find out what any of them do. The owner wants an
informational bubble on each talent, required and optional, that the user can
click to learn more about it. Closely related to B-002, which is the same need
in the add-optional-talent modal.

## 2026-11-26T23:17:00Z — asked by interrogator
**Q:** B-002 and B-003 will be planned as one feature in one folder. Which slug?
**A:** `talent-info-bubbles` (both backlog entries link to plans/talent-info-bubbles/).

## 2026-11-26T23:20:00Z — asked by interrogator
**Q:** When a talent's info bubble is clicked inside the Add-talent-option picker or the Add Discipline modal, how should the details appear — the Disciplines-tab talent detail modal stacked above, or an inline expand like the Add-skill picker?
**A:** Stacked detail modal: the same talent detail modal the Disciplines tab uses, stacked above the picker; Escape closes only it and returns focus to the bubble.

## 2026-11-26T23:23:00Z — asked by interrogator
**Q:** B-002 asks to see "the bonuses it provides". Should the talent detail modal list the talent's effect summaries from rules/talents.json (e.g. Anticipate Blow: "+2 Physical Defense vs that foe's attacks until end of round (per success)")?
**A:** Yes, everywhere: add an Effects list of each effect's summary to the shared talent detail modal, so the Disciplines-tab info bubbles show it too.

## 2026-11-26T23:25:00Z — asked by interrogator
**Q:** Should the creation-mode "+ add option" picker (the one Circle 1 Talent Option for a new character) also get the info bubbles?
**A:** Yes, all three: the edit-mode Add-talent-option picker, the Add Discipline / Seed Circle 1 modal, and the creation-mode option picker.

## 2026-11-26T23:27:00Z — asked by interrogator
**Q:** How should the bubbles look in the pickers?
**A:** Match the Disciplines tab: a filled (accent) bubble on required Circle 1 talents in Add Discipline / Seed Circle 1, an outlined bubble on every Talent Option in all three pickers. Clicking the bubble never selects the talent.

## 2026-11-26T23:29:00Z — asked by interrogator
**Q:** Anything else to include or rule out?
**A:** That's everything.
