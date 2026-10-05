# QA log: situational-chips-global

## 2026-10-05 — asked by interrogator
**Q:** Which Situational chips should become app-wide live conditions (all / defence only / defence + unscoped test penalties)?
**A:** All chips — every Situational chip is a global live toggle; defence changes show on Overview/Combat, test penalties apply to rolls on all tabs, scoped ones keep their scope.

## 2026-10-05 — asked by interrogator
**Q:** Tier-1 sign-off: retire decision B7 (toggled Defence mods informational, never folded into derived Defence; THREAD-ITEMS.md:166, PLAN-COMBAT-TAB) for Situational chips only, folding them app-wide as session-only live conditions like Knocked Down? Combat-option and blood-charm chips unchanged.
**A:** Yes, sign off. (Tier-1 sign-off recorded: retire B7 for Situational chips; session-only state, nothing stored.)

## 2026-10-05 — asked by interrogator
**Q:** Lifetime/off-switch for global situational chips?
**A:** Free toggle (click again to turn off), session-only; cleared by existing resets. Knocked Down and Harried keep their locks.

## 2026-10-05 — asked by interrogator
**Q:** Should an active situational chip show outside Combat (Overview Active Effects)?
**A:** Active Effects row per active situation, each with a clear (×) button; Defence tiles show folded value; roll breakdowns on all tabs list the modifier.

## 2026-10-05 — asked by interrogator
**Q:** How should scoped penalties (Darkness = sight-based, Range Long = ranged) apply to non-combat rolls (Spells/Skills/Talents)?
**A:** Offer a per-roll toggle (roll modal on other tabs lists active scoped penalties; player unticks if not applicable).

## 2026-10-05 — asked by interrogator
**Q:** Surprised: book gives numeric −3 Physical & Mystic Defence; app is note-only. Follow book?
**A:** Follow the book — add the −3 Physical & Mystic Defence effect; "no actions" stays a note. (R2 decision.)

## 2026-10-05 — asked by interrogator
**Q:** Impaired Movement: book −2/−4 to movement-based tests; app encodes all Action tests. How should the global chip apply?
**A:** Treat as scoped, per-roll toggle (like Darkness/Range); Movement Rate reduction stays a display note. (R5 decision.)

## 2026-10-05 — asked by interrogator
**Q:** Stacking of multiple active situational chips?
**A:** Additive, no cap (matches book's Harried + Blindsided example).

## 2026-10-05 — asked by interrogator
**Q:** Final "anything else?" (non-goals: spell situational chips, combat-option/blood-charm chips, persistence, extra Overview rows).
**A:** That's all, write tickets.

## 2026-10-05 — asked by reviewer (relayed to rule-agent)
**Q:** Does Harried's −2 apply to every test or Action tests only; Step or Result modifier?
**A:** rule-agent: every test by inference (no scope in book), Step modifier by default; recorded as R8 in rules.md / FAQ Q027.

## 2026-10-05 — asked by owner (post-report follow-up)
**Q/Instruction:** Remove the Range — Short chip (no effect). Confirm in the rulebook whether Long range −2 applies to both Attack and Damage.
**A:** rule-agent confirmed (FAQ Q027, PG p.390 lines 14667-14678): Long −2 applies to Attack AND Damage tests (worked example: attack Step 13→11, damage Step 10→8); Short has no modifier. App currently applies Long to attack pools only (APP-DIFFERS). Owner instruction: remove Range — Short chip. Damage-side handling: follow the book (apply Long to Damage too) unless owner says otherwise.
