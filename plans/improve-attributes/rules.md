# Rules brief: Improve attributes (improve-attributes)

All answers also recorded as RULES-FAQ Q047 (with Q007, Q039). Source file: `text-RB-players-guide.txt` (PG), line numbers.

## R1 — Cost per increase (Legend Points, not Karma)
- **Status:** ANSWERED
- **Ruling:** +1 = 800 LP, +2 = 1,300 LP, +3 = 2,100 LP; per-step (not cumulative); paid from Current Legend Points. Karma is never spent.
- **Sources:** RULES-FAQ Q047, Q039; PG:16915-16970 (pp. 447-448); rules/legend.json:37; engine/legend-spent.js:64
- **Decision:** none
- **Used by:** T1, T2

## R2 — Limits and conditions
- **Status:** ANSWERED
- **Ruling:** max +3 per attribute; one attribute at a time; character must be rested and healthy (no Current Damage or Wounds, except Blood Magic Damage); after an improvement, wait weeks equal to the NEW Attribute Step before improving another attribute. No per-save, per-session or per-Circle limit in the standard rule.
- **Sources:** PG:16915-16970
- **Decision:** none
- **Used by:** T1, T2

## R3 — Training time and silver
- **Status:** ANSWERED
- **Ruling:** training days = current Attribute Step; average fee = current Step x 10 sp per day (e.g. Step 7: 7 days x 70 sp = 490 sp). No tutor or Circle/Discipline prerequisite stated.
- **Sources:** PG:16937-16942, 16957-16959
- **Decision:** none
- **Used by:** T2

## R4 — Does +3 count creation points?
- **Status:** NOT-COVERED
- **Ruling:** book silent; app caps only `increases` (creation `points` kept separate).
- **Sources:** PG:16967-16970; PG:9101-9104
- **Decision:** 2026-11-23 - cap applies to Legend-bought `increases` only; creation points excluded (house ruling).
- **Used by:** T1

## R5 — Optional Circle-Based Attribute Improvement
- **Status:** ANSWERED
- **Ruling:** GM option: free +1 per new Circle in the first Discipline, or paid once per Circle (LP, no carry-over); still max +3. Book gives no LP amount, nor says whether training/weeks-wait still apply for the paid variant.
- **Sources:** PG:16977-16991 (pp. 448-449)
- **Decision:** 2026-11-23 - out of scope (non-goal); standard rule only.
- **Used by:** T3

## R6 — Derived effects
- **Status:** ANSWERED
- **Ruling:** raising an attribute raises its Step and every derived characteristic and talent/skill step based on it (Characteristics Table: Defenses, Carrying Capacity, Uncon/Death/Wound/Recovery). Karma Modifier is racial and unchanged. No retroactive Durability/Karma adjustment.
- **Sources:** manual/text-player-guide-create-character.txt:213-335 (p. 63); PG:16957-16970
- **Decision:** none
- **Used by:** T1 (engine derives; nothing stored)

## R7 — Timing
- **Status:** ANSWERED
- **Ruling:** "at any point during the game"; no GM approval or Legend-award trigger. App values match the book (no APP-DIFFERS).
- **Sources:** PG:16915-16970; rules/legend.json:37
- **Decision:** none
- **Used by:** T1
