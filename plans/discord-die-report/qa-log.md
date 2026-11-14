# QA log — discord-die-report

## 2026-11-14 — asked by interrogator (pre-workflow discussion)
**Q:** When should the roll be sent — automatically on every roll, or via a button?
**A:** Send after the roll is complete: the Karma-add popup/modal must finish before the Discord message is sent.

## 2026-11-14 — asked by interrogator (pre-workflow discussion)
**Q:** Plain text or embed?
**A:** Plain text to begin with; try an embed later if this works.

## 2026-11-14 — asked by interrogator (pre-workflow discussion)
**Q:** One webhook per device or per character? Which rolls count?
**A:** Per character. All rolls, for now.

## 2026-11-14 — asked by interrogator (pre-workflow discussion)
**Q:** Which details should the message include?
**A:** As much as possible: character name, step, individual dice (with exploding dice), Karma, Bonus Dice, mods, total, difficulty and outcome.

## 2026-11-14 — asked by interrogator (pre-workflow discussion)
**Q:** Is device-local storage acceptable for the webhook URL (vs. inside character data)?
**A:** Yes — save the webhook URL in localStorage; add it to Settings together with a toggle.

## 2026-11-14 — asked by interrogator
**Q:** Sender name: character name as the webhook `username` override, the webhook's own name, or both?
**A:** Character name as sender (webhook `username` override); body text does not repeat the name.

## 2026-11-14 — asked by interrogator
**Q:** Should Settings include a "Send test message" button?
**A:** Yes — posts a short test message as the character and shows success/error inline.

## 2026-11-14 — asked by interrogator
**Q:** On a failed send during a real roll, what should the app do?
**A:** Brief toast, no retry; the roll and log are unaffected, nothing queued.

## 2026-11-14 — asked by interrogator
**Q:** Toggle scope — per character or one global switch?
**A:** Per character (stored next to that character's webhook URL).

## 2026-11-14 — asked by interrogator
**Q:** Approve the sample plain-text layout (emoji + bold label, Step/dice header, dice line, Karma line, Bonus line, Mods line, bold Total vs Difficulty + outcome)?
**A:** Looks good — use it; fine-tune wording during build.
