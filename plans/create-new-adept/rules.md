# Rules brief: Create new adept (create-new-adept)

Sources: docs/RULES-FAQ.md Q036–Q040 (CC = rulebook extracts/manual/text-player-guide-create-character.txt, PG = text-RB-players-guide.txt).

## R1 — Starting talent points
- **Status:** ANSWERED
- **Ruling:** 8 talent points, +1 Rank each, max 3 per talent (start max Rank 3); only First-Circle Discipline Talents; unassigned talents are Rank 0 (unrecorded). Durability is automatic (not a talent, no ranks). Karma Ritual is not a talent.
- **Sources:** Q039; CC:451-473, 509-518 (p. 67–68)
- **Decision:** Talent Option excluded from the 8 points, bought later with Legend (2026-11-21).
- **Decision (round 2):** Durability and Karma Ritual are seeded as Rank-1, Circle-1 talents (the app's stored model), free, outside the 8 points (2026-11-21).
- **Used by:** T1, T5

## R2 — Free talents at creation
- **Status:** FAQ-HIT
- **Ruling:** Free talents (e.g. Archer Call Missile; Nethermancer two Standard Matrices) start at Rank = Circle = 1, no points, no Legend; owner decision: each Discipline grants its own free talents at its own Circle.
- **Sources:** Q036, Q037; PG:2905-2927
- **Decision:** none new
- **Used by:** T1, T5

## R3 — Attribute points
- **Status:** ANSWERED (cap NOT-COVERED -> decided)
- **Ruling:** Start at racial values; 25 Attribute Points. Cumulative cost to raise: +1=1, +2=2, +3=3, +4=5, +5=7, +6=9, +7=12, +8=15; lowering -1/-2 gives +1/+2. Unused points convert 1:1 to extra Maximum Karma. App `rules/attributes.json` pointCost matches.
- **Sources:** Q039; CC:139-204 (p. 60–61)
- **Decision:** Range capped at -2..+8 over racial value (house, 2026-11-21).
- **Used by:** T5, T7

## R4 — Karma at creation
- **Status:** ANSWERED
- **Ruling:** Max Karma = race Karma Modifier x Circle + leftover attribute points; starts full. App races.json modifiers match.
- **Sources:** CC:415-422 (p. 66)
- **Decision (round 2):** under the house Karma-economy rule, creation Karma costs no Legend; the race `karma.maxCap` caps the total Max Karma, unused-attribute bonus included (house, 2026-11-21).
- **Used by:** T1, T7

## R5 — Starting skills
- **Status:** ANSWERED
- **Ruling:** Fixed free ranks: Knowledge 2, Artisan 1 (discipline list/GM), Speak Language 2, Read/Write 1; plus 8 free ranks across Knowledge/Artisan/Language/General; General skills from the 8 are Novice-tier only; max 3 points per skill.
- **Sources:** Q039; CC:519-626 (p. 69–71)
- **Decision:** Total rank <= 3 per skill, fixed ranks included (house, 2026-11-21).
- **Decision (round 2):** the Artisan pick comes from the Discipline's `artisanSkills` only; one language per rank (each language a Rank-1 entry); Knowledge picks are free-text `Knowledge (<text>)` (house, 2026-11-21).
- **Used by:** T6

## R6 — Starting spells (magician)
- **Status:** ANSWERED
- **Ruling:** Spell points = Perception Step; each spell costs its Circle; Circle 1–2 spells of own discipline; Circle-2 spells go in the grimoire (not in a matrix until Circle 2); two Standard Matrices (Rank = Circle) come free.
- **Sources:** Q039; CC:489-513 (p. 68)
- **Decision (round 2):** starting spells are a free pick from the Discipline's Circle 1–2 spells: no learning roll, no silver, no talent prerequisite (house, 2026-11-21).
- **Used by:** T6

## R7 — Starting Legend
- **Status:** NOT-COVERED
- **Ruling:** Books assign none.
- **Sources:** Q039
- **Decision:** Legend earned/spent 0/0 (house, 2026-11-21). Round 2: derived as 0 while the creation block exists; nothing stored.
- **Used by:** T1

## R8 — Starting equipment and silver
- **Status:** ANSWERED / APP-DIFFERS
- **Ruling:** Adventuring Kit (15 sp, 14 lb, average; app matches), dagger or knife, Traveler's Garb (8 sp, 3 lb, average), Trail Rations 1 week (10 sp, 8 lb, average), Grimoire (magicians only), 100 silver. Artisan tools need GM approval and are not auto-granted. Garb and Rations are missing from items.json (new data).
- **Sources:** Q040; PG:2434-2444 (p. 72), 16585-16587, 16716, 16797-16801
- **Decision:** Grant kit + 100 silver; add the three items to the catalog (2026-11-21).
- **Used by:** T1, T8

## R9 — Grimoire stats
- **Status:** NOT-COVERED
- **Ruling:** No price/weight/availability in the books.
- **Sources:** Q040; PG:9344-9379
- **Decision:** cost 0, weight 1 lb, availability average (house, 2026-11-21).
- **Used by:** T8

## R10 — End of creation / leftovers
- **Status:** NOT-COVERED
- **Ruling:** No "start of play" rule; only attribute leftovers have a rule (-> Karma).
- **Sources:** Q039
- **Decision:** Warn, then forfeit unspent talent/skill/spell points (house, 2026-11-21).
- **Used by:** T7
