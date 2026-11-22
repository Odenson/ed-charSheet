# Rules brief: Create new adept (create-new-adept)

Sources: docs/RULES-FAQ.md Q036–Q040 (CC = rulebook extracts/manual/text-player-guide-create-character.txt, PG = text-RB-players-guide.txt).

## R1 — Starting talent points
- **Status:** ANSWERED
- **Ruling:** 8 talent points, +1 Rank each, max 3 per talent (start max Rank 3); only First-Circle Discipline Talents; unassigned talents are Rank 0 (unrecorded). Durability is automatic (not a talent, no ranks). Karma Ritual is not a talent.
- **Sources:** Q039; CC:451-473, 509-518 (p. 67–68)
- **Decision:** ~~Talent Option excluded from the 8 points, bought later with Legend (2026-11-21).~~ **Superseded 2026-11-22 (owner):** one Circle-1 Talent Option from the Discipline's Novice pool may be bought with the 8 points like the five Discipline Talents (Rank 0–3, ledger key `<Discipline>/<Talent>`). The book is silent on this (PG p.67–68 gives the option's Rank only via Legend), so it is a house ruling.
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

## R11 — Skill `category`, `generic`, `artisanKey` data (round 3, I2)
- **Status:** ANSWERED; CONFLICT / NOT-COVERED / APP-DIFFERS items decided by the owner (below)
- **Source:** docs/RULES-FAQ.md Q041 (full citations there). Category is decided by book list membership, never by name guessing.
- **Ruling (the data to write into `rules/skills.json`, all 154 entries; duplicates Bribery and Skinning each get the same value on both copies):**
  - `language-speak` (12): `Speak Language` + `Speak Language (X)` for X in Drake, Dwarf, Elf, Human, Obsidiman, Ork, T`skrang, Theran, Throalic, Troll, Windling.
  - `language-readwrite` (12): `Read/Write Language` + `Read/Write Language (X)` for the same 11 X.
  - `knowledge` (2): `Knowledge`, `Horror Lore`.
  - `artisan` (22): `Acting`, `Arrow Fletching (Artisan)`, `Artisan`, `Body Painting (Artisan)`, `Bone Carving (Artisan)`, `Braiding (Artisan)`, `Craft Armor`, `Craft Weapon`, `Craftsman`, `Embroidery`, `Manuscript Illumination`, `Map Making`, `Painting`, `Poetry`, `Robe Embroidery`, `Rune Carving`, `Sail Embroidery`, `Sculpting`, `Tailor`, `Tanning`, `Tattooist`, `Wood Carving`.
  - `general` (106): every other entry (includes Artist, Entertaining, Animal Tracking, Hunting, Public Speaking, Riding, Skinning x2, Bribery x2).
  - `generic: true` on exactly four entries: `Knowledge`, `Artisan`, `Speak Language`, `Read/Write Language` (stored as `<Entry> (<text>)`). Horror Lore, Artist, Entertaining and Craftsman are NOT generic.
  - `artisanKey` on every `artisan` entry except the `Artisan` template = catalog name with a trailing " (Artisan)" removed (Arrow Fletching, Body Painting, Bone Carving, Braiding keep the suffix only in the catalog name; the others equal their name). The eight Discipline strings resolve exactly: Archer "Arrow Fletching", "Wood Carving"; Nethermancer "Bone Carving", "Robe Embroidery"; Thief "Acting", "Poetry"; Warrior "Sculpting", "Rune Carving".
  - Tier: all `tier` values stay as in the file EXCEPT `Impressive Display` and `Tactics` -> `tier: 2`.
  - Creation gate (general picks from the 8 free ranks): `category: general` AND `tier: 1` only. Artisan, Knowledge and Language categories are not tiered for the gate.
- **Decision (owner, 2026-11-21):** dual-use Artisan/General skills and NOT-COVERED entries follow the defaults listed above (Acting, Craft Armor, Craft Weapon, Craftsman, Map Making, Tailor, Tanning, Tattooist = artisan; Artist, Entertaining and the others = general).
- **Decision (owner, 2026-11-21):** Impressive Display and Tactics are set to `tier: 2` (APP-DIFFERS fixed to the book).
- **Decision (owner, 2026-11-21):** the fixed Artisan rank comes from the Discipline's `artisanSkills` only; the 8 extra free ranks may go to any `artisan`-category catalog skill or a free-text `Artisan (<text>)` (refines R5; the I7 "anything else is refused" applies to the fixed Artisan rank only).
- **Used by:** T5, T6, T8 (I2, I7)
