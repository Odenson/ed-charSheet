# Rules brief: display-free-talents (display-free-talents)

Full entry: docs/RULES-FAQ.md Q036. Source file: `rulebook extracts/rulebook extracts/text-RB-players-guide.txt` (PG) unless noted.

## R1 — Free talent rank equals the Discipline's Circle; no Legend spent
- **Status:** ANSWERED
- **Ruling:** A free talent is given on gaining a Circle and advances with the Circle (Air Sailor: rank = Circle). No Legend Points are spent on its rank. The optional "Increasing Free Talent Ranks" rule (Companion p.435) is out of scope.
- **Sources:** Q036; PG:2905-2915, 2918-2920; Companion:16690-16716
- **Decision:** Out of scope: the optional buy-above-Circle rule is not modelled (owner scope, 2026-11-21).
- **Used by:** T1, T2

## R2 — Free talents do not count toward Circle advancement or occupy option slots
- **Status:** ANSWERED
- **Ruling:** A free talent "does not count for the purposes of qualifying for the next Circle", otherwise behaves as a talent. It occupies no Talent Option slot.
- **Sources:** Q036, Q002, Q030; PG:2908-2909
- **Decision:** none (matches `engine/advancement.js`; leave untouched)
- **Used by:** T1 (non-goal: do not alter advancement)

## R3 — Second discipline free talents
- **Status:** NOT-COVERED
- **Ruling:** Books are silent.
- **Sources:** Q036 item 3; PG:17302-17318, 17345-17350
- **Decision:** Owner 2026-11-21: every discipline the character has grants its free talents, rank = that discipline's own Circle.
- **Used by:** T1, T2

## R4 — Karma and Strain on free talents
- **Status:** ANSWERED
- **Ruling:** Karma may be spent on a free talent's tests, and threads may be woven to it. Strain is the talent's own (Call Missile 1, Danger Sense 1, matrices 0). Matrices are Action NA and unrolled, so no Karma. One Karma Point per talent even across disciplines.
- **Sources:** Q036; PG:2909-2911, 4141-4149; text-talents-players.txt:126-129, 186-189, 279, 584
- **Decision:** none
- **Used by:** T2, T4

## R5 — Standard Matrix and the Circle 5 upgrade
- **Status:** ANSWERED (upgrade details not specified by the book)
- **Ruling:** Two free Standard Matrices at First Circle, each a separate talent at rank = Circle. At Nethermancer Circle 5 one upgrades to an Enhanced Matrix; the book does not say which, or its rank.
- **Sources:** Q036; PG:2918-2920, 3489-3490; text-talents-players.txt:279, 584
- **Decision:** Owner 2026-11-21: show both Standard Matrix rows display-only; the Circle 5 upgrade stays a note only, no Enhanced Matrix row.
- **Used by:** T1, T3

## R6 — Same name held by several routes
- **Status:** NOT-COVERED
- **Ruling:** Books have no stacking rule for a free talent sharing a name with an option or another discipline's talent. One Karma Point per talent regardless of discipline (PG:4146-4149).
- **Sources:** Q036 item 6; PG:17345-17354, 17441-17444, 4146-4149
- **Decision:** Owner 2026-11-21: separate rows per discipline; a stored same-name talent in the same discipline suppresses the free row; the Combat picker dedupes by name and uses the highest rank.
- **Used by:** T1, T4

## R7 — Call Missile talent entry (catalog completion)
- **Status:** ANSWERED
- **Ruling:** Simple action, Step = Rank + Perception, Strain 1, Skill Use: No. The test result sets how many of the adept's own unbroken missiles/thrown weapons return to quiver/container/hand, within Rank x 20 yards, along a straight unblocked path; pulls missiles out of targets; secured or locked-away objects cannot be retrieved. No difficulty number or versus. Free Talent for Archer at First Circle; a Journeyman Talent Option for Thief.
- **Sources:** Q037; PG:4622-4633, 3088-3089, 3761; text-talents-players.txt:126-129
- **Decision:** none
- **Used by:** T5
