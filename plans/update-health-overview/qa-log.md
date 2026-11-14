# Q&A log: update-health-overview

## 2026-11-15 — context carried from the mock-up discussion (pre-interview, owner decisions)
- Owner chose "Version 1" of the Health card redesign (mock images `health-v1-calm.png` / `health-v1-risk.png`, scratchpad).
- Damage and Wounds are character-affected inputs; Unconscious, Death, Wound Threshold, Recoveries are stats.
- Layout: Damage and Wounds as two tinted-neutral highlighted rows above a divider; four stats below; same card size as today. No coloured left "flare" edge. Damage row carries an inline gauge (fill = Damage out of Death, tick at Unconscious).
- Rows stay neutral when there is no danger; colour (number, gauge fill) appears only on risk.

## 2026-11-15 — asked by interrogator
**Q:** When should Damage turn amber (red at/past Unconscious)?
**A:** Within 10 of Unconscious (fixed margin; amber from Unconscious−10, red from Unconscious).

## 2026-11-15 — asked by interrogator
**Q:** How should the Wounds number be coloured?
**A:** Red at 1+ (neutral at 0).

## 2026-11-15 — asked by interrogator
**Q:** Should tapping Damage/Wounds do anything new, or stay with only the ✚ header button?
**A:** Read mode: clicking the Damage area opens a NEW modal where the user enters an amount of damage and the app applies it, following the damage-taking rules (a hit can trigger a Knockdown and/or Wound(s)). The existing ✚ action is removed. Edit mode: the current UI lets the user edit the figures directly, and the modal action is removed.

## 2026-11-15 — asked by interrogator
**Q:** Reuse today's ✚ modal for the Damage click, or a new damage-only modal? (follow-up: where do Heal / Recovery tests used / Recovery test live?)
**A:** A new damage-only modal. Move the "+" to the Recovery area; the current modal allows straight edits, which is wrong. Healing must run a Recovery test (same as the Combat tab's Recovery roll action).

## 2026-11-15 — asked by interrogator
**Q:** Recoveries row: ⚄ button that rolls directly (as Combat), or a small modal? And share Combat's damage modal or build a separate Overview copy?
**A:** ⚄ button rolls directly (as Combat). Share Combat's damage-modal logic and look (one component for both tabs).
