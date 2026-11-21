# QA log: display-free-talents

## 2026-11-21 — asked by interrogator
**Q:** On the Disciplines tab, where should a free talent (e.g. Archer's Call Missile) appear, with its rank always equal to the discipline's current Circle and nothing stored in character data?
**A:** In the Circle 1 group (where it is granted), as a normal row with a small "Free" chip and a read-only rank.

## 2026-11-21 — asked by interrogator
**Q:** Nethermancers get two free Standard Matrix talents (Circle 1) and at Circle 5 one upgrades to Enhanced Matrix; these are not rollable. How to handle?
**A:** Show both, display-only: two read-only "Standard Matrix" rows (rank = Circle, "Free" chip, no roll). The Circle 5 upgrade is a note only; no Enhanced Matrix row.

## 2026-11-21 — asked by interrogator
**Q:** Should rollable free talents (Call Missile, Danger Sense) appear in the Combat tab's talent picker like any rollable talent?
**A:** Yes, all rollable free talents (any with a step). Non-rollable ones (Standard Matrix) never appear.

## 2026-11-21 — asked by interrogator
**Q:** How should the same talent held by multiple routes resolve (e.g. Thief option Call Missile plus Archer free Call Missile, or a stored copy in the same discipline)?
**A:** Separate rows per discipline: each discipline shows its own free row (rank = that discipline's Circle). The Combat picker dedupes by name and uses the highest rank. A same-discipline stored copy suppresses the free row.

## 2026-11-21 — asked by interrogator
**Q:** Assume free-talent rows have full parity with learned talents (step/dice, karma, strain, info modal, thread/item rank bonuses) but are read-only (no rank editing, no Legend cost, no change to character data or circle advancement). Anything else?
**A:** That's complete.

## 2026-11-21 — asked by interrogator (rules NOT-COVERED, Q036 item 3)
**Q:** The books are silent on whether a SECOND discipline grants its free talents and which Circle sets their rank. How should the sheet rule it?
**A:** Granted, rank = that discipline's own Circle (every discipline the character has shows its free talents).
