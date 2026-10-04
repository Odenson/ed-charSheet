# Rules brief: Night's Edge (spell-nights-edge)

## R1 — Night's Edge stat block and effects
- **Status:** ANSWERED
- **Ruling:** Nethermancer Circle 2. Threads 0. Weaving 6/11. Casting vs target's Mystic Defense. Range Touch. Duration Rank+5 rounds. Wielder adds a D4 Bonus Die to the weapon's Damage test (cold, Physical type). Any target damaged by the weapon takes -2 Mystic Defense until the end of the next round. Success Level: Increase Duration (+2 rounds). Extra Threads: Increase Effect (+2 Damage Step), Increase Range (+10 yards), Additional Target (+Rank).
- **Sources:** RULES-FAQ Q019; rulebook extracts/text-spell-players.txt:2745-2764 (PG p. 324)
- **Decision:** none
- **Used by:** T1

## R2 — Does the D4 apply to every Damage test during the duration?
- **Status:** NOT-COVERED (implied by duration, not stated)
- **Ruling:** house ruling: D4 applies to every Damage test with the chosen weapon for the full duration
- **Sources:** RULES-FAQ Q019
- **Decision:** owner, 2026-10-04: every Damage test
- **Used by:** T2, T3

## R3 — Which weapons qualify (melee / missile / not owned by caster)?
- **Status:** NOT-COVERED (text says only "weapon", "wielder", Touch)
- **Ruling:** house ruling: only equipped/wielded weapons, any type (melee or missile)
- **Sources:** RULES-FAQ Q019
- **Decision:** owner, 2026-10-04: equipped or wielded weapons only, regardless of type
- **Used by:** T3

## R4 — Mystic Defense penalty on any target damaged
- **Status:** ANSWERED
- **Ruling:** Any target that takes damage from the weapon gets -2 Mystic Defense until end of next round. Night's Blade knack makes it -4 (not in scope).
- **Sources:** RULES-FAQ Q019; text-spell-players.txt:2753-2760
- **Decision:** none
- **Used by:** T1

## R5 — Does the D4 Bonus Die explode, and is it a separate die?
- **Status:** ANSWERED (inference from the general rule, moderate confidence)
- **Ruling:** Yes, it explodes: a max roll on any die earns another die of the same type, repeating. It is a separate die added to the Damage test, alongside the step dice and the Karma die.
- **Sources:** RULES-FAQ Q020; text-RB-players-guide.txt:847-858 (p. 32), 14230-14232, 4130-4145 (p. 121), 12164
- **Decision:** none (owner may confirm; the books never reconcile "bonus die" the explosion with "Bonus Die" the spell-added die)
- **Used by:** I4, I5

## R6 — Target number for Night's Edge cast on This character
- **Status:** NOT-COVERED (extracts silent on weapon vs wielder; RULES-FAQ Q021)
- **Ruling:** house ruling: the spell targets the weapon, so the Spellcasting difficulty is the weapon's Mystic Defense. Value: 2 for an ordinary (non-thread) weapon; for a thread/magic weapon, the item's `mysticDefense` property when present. Prefilled in the target box, editable.
- **Sources:** RULES-FAQ Q021; text-RB-players-guide.txt:10004-10007; manual/text-player-guide-spell-concepts.txt:416-431 (objects MD 2, magic items by potency)
- **Decision:** owner, 2026-10-04: weapon's Mystic Defense; non-thread items prefill 2; items with a `mysticDefense` property prefill that value
- **Used by:** I6

## R7 — Willing targets may lower Mystic Defense to 2 (classification only)
- **Status:** NOT-COVERED (owner ruling)
- **Ruling:** house ruling: a willing target may lower their Mystic Defense to 2 for a spell cast on them. Recorded for rule classification; NOT applied by this feature.
- **Sources:** RULES-FAQ Q021
- **Decision:** owner, 2026-10-04
- **Used by:** none (future)
