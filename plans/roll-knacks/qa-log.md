# QA log: roll-knacks

## 2026-11-15T11:20:00Z — asked by interrogator
**Context (from the owner's request):** Today a knack row (e.g. Lip Reading under Awareness) has no roll button; only the parent talent rolls. Technically the same roll, but the roll log (and the Discord message) should show the knack that was rolled.

**Q:** Which knack rows should get a roll button?
**A:** Only rollable knacks (those whose knack `step` is a real roll; "N/A" knacks like Make Concession get no button).

## 2026-11-15T11:22:00Z — asked by interrogator
**Q:** What label should the roll log and Discord message show for a knack roll?
**A:** Knack name only (e.g. "Lip Reading").

## 2026-11-15T11:25:00Z — asked by interrogator
**Q:** Which step should a knack roll use — the parent's step, or the knack's own formula (e.g. 'Rank+PER')?
**A:** Defer to the rule-agent: if the rules say a knack has its own step formula, follow the rules. (Sent to rule-agent as batch; results in rules.md.)

## 2026-11-15T11:30:00Z — rule-agent answer (R1-R5 in rules.md)
Knack step = knack's own "Rank+ATTR" with parent talent's Rank; strain replaces parent's; N/A knacks not rolled; Karma and parent-bonus carry-over NOT-COVERED (owner ruling needed).

## 2026-11-15T11:32:00Z — asked by interrogator
**Q:** Books silent on Karma for knacks — should a knack roll offer Karma like its parent talent?
**A:** Same as parent talent. (R2 decided.)

## 2026-11-15T11:34:00Z — asked by interrogator
**Q:** Parent-talent bonuses carry to a knack test?
**A:** Yes, same as parent. (R5 decided.)

## 2026-11-15T11:38:00Z — asked by interrogator
**Q:** Should a knack roll charge Strain (the Disciplines-tab talent roll doesn't today)?
**A:** Rolling a knack OR a talent will apply the Strain to health; this was missed and must be added to both. Confirm with the rule-agent. (Scope grows: talent rolls on the Disciplines tab also charge Strain. Rule-agent batch sent; results go to rules.md.)

## 2026-11-15T11:41:00Z — rule-agent answer (R6-R9 in rules.md)
Strain per use, unmodified Health damage, no Wounds; Karma free; data formats vary (numeric in talents, strings in knacks) -> owner ruling needed (R8).

## 2026-11-15T11:46:00Z — asked by interrogator
**Q:** How should auto-Strain treat non-numeric knack Strain strings?
**A:** Owner: strain is a dedicated plain-number string in knacks.json; verify by scanning. Scan result: among rollable knacks (step "Rank+ATTR"), all are plain numbers except Swinging Move ("0+ (see text)") and Take the Hit ("2+ (Special)"); the other non-numeric values are on N/A/null-step knacks (no roll button).
**Q:** How to handle those two?
**A:** Normalize the data to plain numbers (Swinging Move "0", Take the Hit "2"; extra-Strain text stays in the summary). Tier 3 data edit. (R8 decided.)

## 2026-11-15T11:49:00Z — asked by interrogator
**Q:** Only 47 of 456 talents have strain data; what should rolling the rest do?
**A:** Charge nothing (no data => no auto-charge; authoring missing strain is out of scope).

## 2026-11-15T11:51:00Z — asked by interrogator
**Q:** Strain timing — on button click or at roll commit?
**A:** At roll commit (reuse the roll modal's deferred `strain` / `ed-strain` path; Escape before rolling costs nothing).

## 2026-11-15T11:53:00Z — asked by interrogator
**Q:** Show Strain charged in the log entry and Discord message?
**A:** Yes — modal hint, log entry, and Discord (plain + embed).

## 2026-11-15T11:55:00Z — asked by interrogator
**Q:** Anything else, or anything to cut? (scope recap given)
**A:** That's everything.

## 2026-11-15T12:10:00Z — asked by reviewer (relayed by interrogator)
**Q:** Ordinary talent/knack roll modals roll the instant they open, so Strain is charged at button click and Escape cannot undo it. Accept that?
**A:** Accept: charge on open (Strain paid when the modal opens/rolls, once per roll; Escape-costs-nothing holds only for aim/set-dice rolls). This supersedes the earlier "at roll commit" wording for ordinary rolls; T3 text to be corrected.
