# Q&A log: create-new-adept

## 2026-11-21 — asked by interrogator
**Q:** When the player picks a discipline (Archer, Nethermancer, Thief, Warrior) to start a new character, how much of the character should this feature produce?
**A:** Blank Circle-1 shell (name + race + chosen discipline at Circle 1 with free/starting talents; everything else filled in later via existing edit UI).

## 2026-11-21 — asked by interrogator
**Q:** What does the player enter when clicking a discipline's create icon?
**A:** Name + race (discipline = the one clicked). Attributes start at the race's startingAttributes base.

## 2026-11-21 — asked by interrogator
**Q:** Until first save, where does the draft live; survive reload?
**A:** Persist in browser (localStorage); appears in loader marked "unsaved draft"; reaches the character-data branch only on Save (worker creates file + index row).

## 2026-11-21 — asked by interrogator
**Q:** How should discipline create icons appear in the loader?
**A:** A "Start a new character" section below the list, one icon button per discipline (also on first-run with an empty store).

## 2026-11-21 — asked by interrogator
**Q:** Id collision handling?
**A:** Auto-suffix (kolon -> kolon-2); name stays as typed; never overwrite.

## 2026-11-21 — asked by interrogator
**Q:** How to remove an unwanted unsaved draft?
**A:** Discard button on draft rows in the loader, via ed-confirm; saved characters are not deletable here.

## 2026-11-21 — asked by interrogator
**Q:** Icon art per discipline?
**A:** Generic "+" inline-SVG glyph with the discipline name; no new assets.

## 2026-11-21 — asked by interrogator
**Q:** Books assign no starting Legend. New shell starts Legend 0/0 (no earned entries)?
**A:** Yes, 0/0. (House decision — recorded on RULES-FAQ Q039.)

## 2026-11-21 — asked by interrogator
**Q:** Rank editing spends Legend; how does the shell get starting talent ranks (8 free points)?
**A:** Free-rank creation mode (draft characters get a creation state with steppers spending the free allotments, no Legend).

## 2026-11-21 — asked by interrogator
**Q:** Which creation steps does creation mode cover?
**A:** All four: talent points (8, max 3/talent), attribute points (25, cost table), starting skills, starting spells (Nethermancer).

## 2026-11-21 — asked by interrogator (TIER-1 SIGN-OFF)
**Q:** Rule: "Schema shapes — top-level shape of data/characters/<id>.json is locked." Sign off on one additive optional top-level `creation` block (schema stays ed-character/2) holding creation-mode inputs (allotments spent, finished flag)?
**A:** Sign off: add `creation` block. (Owner sign-off, 2026-11-21.)

## 2026-11-21 — asked by interrogator
**Q:** Where do creation-mode steppers/budgets appear; how does creation end?
**A:** In existing tabs (Overview attributes, Disciplines talents, Skills, Spells): Legend steppers swap for free-point steppers with a "points left" chip while creation is open; a "Finish creation" action (with confirm) closes it, after which normal Legend rules apply.

## 2026-11-21 — asked by interrogator
**Q:** Maximum starting attribute (books silent)?
**A:** Cap at the printed cost-table range: -2 to +8 over racial value (house rule; to be recorded on RULES-FAQ Q039).

## 2026-11-21 — asked by interrogator
**Q:** Starting equipment and 100 silver?
**A:** Grant starting kit + 100 silver.

## 2026-11-21 — asked by interrogator
**Q:** items.json lacks Traveler's Garb, Trail Rations, Grimoire — how handle?
**A:** Add them to rules/items.json as catalog entries (Tier 3 data), then seed the kit from the catalog.

## 2026-11-21 — asked by interrogator
**Q:** Human Versatility / other-discipline talents at creation?
**A:** Non-goal (also dwarf language swap excluded).

## 2026-11-21 — asked by interrogator
**Q:** May the Talent Option receive some of the 8 creation points (books silent)?
**A:** Option excluded; bought later with Legend. (House decision.)

## 2026-11-21 — asked by interrogator
**Q:** Do fixed free skill ranks count toward the 3-per-skill creation cap (books silent)?
**A:** Total rank <= 3 per skill, fixed free ranks included. (House decision.)

## 2026-11-21 — asked by interrogator
**Q:** On Finish creation, what happens to unspent talent/skill/spell points?
**A:** Warn (ed-confirm listing unspent points), then forfeit. Attribute leftovers convert to extra Max Karma. (House decision for forfeiture; conversion per book.)

## 2026-11-21 — asked by interrogator
**Q:** Anything else material?
**A:** Nothing else.

## 2026-11-21 — asked by interrogator
**Q:** Grimoire has no stats in the books — how to rule the catalog entry?
**A:** Homebrew: cost 0, weight 1 lb (availability average). House decision.

## 2026-11-21 — asked by reviewer (relayed by interrogator)
**Q:** Store the leftover-attribute Karma bonus as creation.karmaBonus, or derive at read time from attributes[n].points?
**A:** Derive at read time; nothing stored (creation block stays within signed-off scope).

## 2026-11-21 — asked by reviewer (relayed by interrogator)
**Q:** Add a structured `category` field to rules/skills.json entries as Tier-3 data?
**A:** Yes, add `category` data. If a schema-tag bump proves necessary, the build stops and re-asks the owner.

## 2026-11-21 — asked by interrogator (revision of earlier decision)
**Q:** Revisit id collision: which refinement (create-only worker guard / assign id at first Save / random suffix)?
**A:** None of those. Collision risk is extremely low. Pre-check on first entering name and race: if the name/id already exists in the index, show a warning and the player must change the name. On Save, re-check again before committing; if the name is now taken on the character-data branch, warn and ask the player to rename; otherwise save proceeds. Do NOT automatically suffix. (Supersedes the earlier "Auto-suffix" answer; no worker change.)

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** With the house Karma-economy rule on, the Legend audit charges Legend for every Karma point gained, so a new character would start with negative Legend (Ork: 5 × 7 = 35). How should starting Karma work?
**A:** Free, derived: while the creation block exists, the audit treats creation Karma (Karma Modifier × 1 plus unused attribute points) as free. Nothing new stored; the character starts at full Karma.

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The house rule caps Max Karma per race (e.g. Troll 20, Ork 40). How should the cap treat the unused-attribute-points bonus?
**A:** Cap the total: Max Karma = min(Modifier × Circle + bonus, race cap).

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** With no earned-Legend entries and no legacy total, Available Legend shows a placeholder, not 0. How should a new character's Legend appear?
**A:** Derive 0 while the creation block exists. Nothing stored; existing characters unchanged.

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The engine adds the Durability bonus only from a stored Durability talent rank, and every existing character stores Durability and Karma Ritual as talents. How should a new character get Durability?
**A:** Seed both at Rank 1, Circle 1, free (recorded in the free-rank ledger, so 0 Legend). No engine change.

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The Learn spell flow needs Spellcasting and Thread Weaving and runs a learning roll with a silver fee. How should the creation spell step work?
**A:** Free pick from the Discipline's Circle 1–2 spells in rules/spells.json, spending spell points (= Perception Step); no roll, no silver, no talent prerequisite.

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The skill catalog has only a generic Knowledge entry, and Add skill offers each catalog name once. How should players record specific Knowledge skills?
**A:** Free text, stored as "Knowledge (<text>)" and resolved to the Knowledge entry by the existing lookup used for "Speak Language (Ork)".

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The app stores one skill entry per language; the book says each language rank is one language. How do the free "Speak Language 2, Read/Write 1" ranks map?
**A:** One language per rank: Speak Language 2 = two language entries at Rank 1; Read/Write 1 = one entry at Rank 1; extra languages from the 8 free ranks are more Rank-1 entries.

## 2026-11-21 — asked by reviewer (owner-requested round 2, main session)
**Q:** The free Artisan rank comes from the Discipline's list or with GM approval. What should the creation picker offer?
**A:** The Discipline's artisanSkills list only.
