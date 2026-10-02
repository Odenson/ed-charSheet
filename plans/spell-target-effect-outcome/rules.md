# Rules brief: Spell effect outcome on other targets (spell-target-effect-outcome)

Answers from `rule-agent` (FAQ ids in docs/RULES-FAQ.md). App behavior was
cross-checked by the Interrogator against `ui/ed-spells.js` (`successCount`,
`_defaultTarget`, `castingTarget`): no APP-DIFFERS found.

## R1 — Casting-test target number when casting on another target
- **Status:** ANSWERED
- **Ruling:** The difficulty is the spell's own Casting Difficulty — often the target's Mystic Defense, but it can be a fixed value or another calculation, per spell. Multi-target spells use the highest Mystic Defense. Minimum Difficulty Number is 2.
- **Sources:** RULES-FAQ Q011; text-player-guide-spell-concepts.txt:46–51 (p.248), :416–431 (p.257); text-player-guide-game-concepts.txt:88–89 (p.33)
- **Decision:** none
- **Used by:** T1, T2

## R2 — Success levels on a Spellcasting test
- **Status:** ANSWERED
- **Ruling:** Equalling the Difficulty Number is 1 success; each full 5 over adds 1 extra success. A spell's "Success Levels" line says what an extra success buys (Effect steps, duration, targets), applied per extra success.
- **Sources:** RULES-FAQ Q012; text-player-guide-game-concepts.txt:107–115 (p.34); text-player-guide-spell-concepts.txt:977–983 (p.270), :432–436 (p.257)
- **Decision:** none
- **Used by:** T1

## R3 — What a failed Spellcasting test does
- **Status:** NOT-COVERED (partial)
- **Ruling:** The books say only that a result below the Difficulty Number means the spell fails; the Effect is determined only after a successful cast, so a miss applies no effect. They are silent on woven threads and Karma on a miss.
- **Sources:** RULES-FAQ Q013; text-player-guide-spell-concepts.txt:433–436 (p.257), :135–141 (p.250)
- **Decision:** 2026-10-02 — owner house ruling: a miss on another target reads "Miss vs <target number> — no effect"; the outcome text makes no claim about woven threads or Karma; existing thread behavior is unchanged and out of scope. (recorded on Q013)
- **Used by:** T1, T2

## R4 — Effect test vs the target
- **Status:** ANSWERED
- **Ruling:** After a successful cast, rolled-effect spells call for an Effect test (usually the caster's Willpower step plus the spell's bonus). Damage spells name the armor type that resists. Per owner decision the outcome text does NOT report the armor type or any armor math; it reports the Effect roll total (or the static effect) only.
- **Sources:** RULES-FAQ Q014; text-player-guide-spell-concepts.txt:437–446 (p.257), :930–937 (p.269)
- **Decision:** 2026-10-02 — owner: keep the outcome to the cast result, no armor note (qa-log).
- **Used by:** T1

## R5 — Spell duration
- **Status:** ANSWERED
- **Ruling:** Duration is measured in rounds, minutes, hours or other increments per spell, with Rank = the caster's Spellcasting rank; success levels may extend it. No separate rule for other-target casts — measured the same way.
- **Sources:** RULES-FAQ Q015; text-player-guide-spell-concepts.txt:447–454 (p.257), :924–929 (p.269)
- **Decision:** none
- **Used by:** T1
