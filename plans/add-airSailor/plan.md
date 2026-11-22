---
status: building
---
# Delivery Plan: Add Air Sailor discipline (add-airSailor)

## Context & learnings
Add the Air Sailor Discipline (Circles 1-8) as pure rule data and flesh out every Air Sailor talent in `rules/talents.json` (33 talents; most are action+attribute stubs). Air Sailor then shows in the loader's "Start a new character" list and the Disciplines tab. Owner decisions (qa-log.md, 2026-11-22): full talent detail; Air Sailors are not spellcasters (no spell data, no Spellcasting, no matrices); non-mappable circle abilities use existing vocabulary + `note` effects (no taxonomy change); data-conformance + Circle-1 creation tests; no sample character file, no UI/engine change. Physical Defense +1/+2/+3 follows the repo convention `stacking: highest` (rules.md R2, no owner ruling needed). Changelog is a release step, out of scope.

## Discoveries
- `rules/disciplines.json` (`ed-disciplines/1`, taxonomy v6) holds Archer, Nethermancer, Thief, Warrior, alphabetical. Entry shape: `name, importantAttributes, karmaRitual{summary}, artisanSkills, halfMagic{summary}, durability, talentOptions{novice,journeyman}, circles[{circle, freeTalents?, talents[], effects[]}]`. Archer is the template (Physical Defense +1/+2/+3 at C2/6/8 via `defense-modifier`, `measure:"rating"`, `stacking:"highest"`, `source:"discipline"`; Social +1 same shape at Thief/Warrior; Initiative karma = `grant-karma-use` target `{domain:"test",name:"Initiative"}`; scoped karma uses `scope` string; Warrior C7 extra Recovery = `characteristic-modifier` `RecoveryTests` add 1 `measure:"rating"` (taxonomy doc line 326); Archer C5 "Create Projectile" is the `note` precedent with `gmDiscretion:true`).
- Free talents are derived, never stored (`freeTalents` on C1; Archer `["Call Missile"]`). `buildNewCharacter` (`engine/new-character.js:87`) is data-driven: magician = C1 talents contain `Spellcasting` (Air Sailor: no, so no grimoire, no `spells` key). It seeds Durability and Karma Ritual only; Durability 5 comes from `durability`.
- `rules/talents.json` is a `{talents:{<name>:{...}}}` map. All 33 names already exist as keys EXCEPT none missing (Throwing Weapon exists). Full already: Air Dance, Avoid Blow, Awareness, Conceal Object, Engaging Banter, First Impression, Haggle, Melee Weapon, Throwing Weapon, Wound Balance. Stubs (`{name, action, attribute}` only): Acrobatic Defense, Air Sailing, Air Speaking, Battle Bellow, Climbing, Distract, Empathic Sense, Etiquette, Graceful Exit, Great Leap, Heartening Laugh, Inspire Others, Leadership, Lion Heart, Maneuver, Navigation, Resist Taunt, Second Weapon, Speak Language, Surprise Strike, Taunt, Thread Weaving (Air Sailor), Wind Catcher. Full-entry shape: `name, presentation{shortEffect}, action, attribute, strain, skillUse{allowed,tier?}, tier, [versus], summary, effects[{type:"note",[condition],source:"talent",summary}]` (see Avoid Blow, Haggle, Thread Weaving (Archer)).
- Gotcha: several existing "full" entries carry `tier` values that follow the Circle learned (Q001), e.g. Engaging Banter is `Journeyman`, Air Dance `Novice`. Keep `tier` on existing full entries untouched; for new full entries use the tier of the lowest Circle/option list the talent appears in elsewhere in the repo, else Novice for DTs and the option-list tier for options (rules.md R5).
- Shared talents (Navigation, Distract, Etiquette, Resist Taunt, Speak Language, First Impression, Awareness...) are used by other Disciplines' options; upgrading a stub benefits them too, so never change `action`/`attribute` of an existing entry.
- Existing tests that enumerate Disciplines: `engine/new-character.test.js:34` iterates ALL disciplines (automatically covers Air Sailor: non-magician path, `isMagician` false); `engine/creation.test.js:1247` and `tools/dev-server.test.js:219` hard-code the four names (extend to include Air Sailor); `store-creation-golden.test.js:216-219` snapshots embed `"addable":[...]` lists which will gain "Air Sailor" (alphabetical position first) - update those four literals only. Run `npm test` to find any other consumer (`engine/talent-options-initiation.test.js`, `engine/free-talents.test.js`, `store-start-discipline.test.js` use disciplines.json).
- Data/engine name coupling: engine looks up `Thread Weaving (<discipline name>)`, so the talent stays `Thread Weaving (Air Sailor)` (book "Air Weaving"; R6/R9). Book "Melee Weapons"/"Throwing Weapons" map to app "Melee Weapon"/"Throwing Weapon". Wording for summaries must be distilled, no verbatim rulebook prose (disciplines.json `source`).
- `rules/skills.json` already has Air Sailing as a skill; the talent is a separate `talents.json` entry (stub). Skill pricing goldens reference the skill; unchanged.

## Guardrail classification
All items Tier 3 (data fitting existing schema/taxonomy; tests; no engine/UI/schema/taxonomy change). No Tier-1/Tier-2 item; no sign-off needed (tickets.md, qa-log.md). Guard: if any circle effect needs vocabulary not in EFFECT-TAXONOMY v6, use `note` (owner choice) - do NOT extend the taxonomy.

## Rules dependencies
- R1 header (ANSWERED, Q042) - I1. R2 per-Circle table + stacking decision (ANSWERED) - I1. R3 options (ANSWERED) - I1, I3. R4 talent texts (ANSWERED) - I2, I3. R5 tier (ANSWERED) - I2, I3. R6 Thread Weaving / non-casting (ANSWERED; owner: no spells) - I1, I2. R7 sample (ANSWERED) - I4. R8 creation/crew (ANSWERED; kit NOT-COVERED -> generic kit, not a house rule) - I4. R9 app naming (ANSWERED) - I1-I3.
No open NEEDS_RULES.

## Implementation items
### I1 — Air Sailor entry in rules/disciplines.json
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R6, R9
- **Tier:** 3
- **What:** Insert the Air Sailor discipline (first in the array, alphabetical) with: `importantAttributes ["Charisma","Dexterity","Willpower"]`; `karmaRitual` summary (silent meditation under open sky picturing an airship journey; ends when imagined journey ends safely; distilled); `artisanSkills ["Rune Carving","Sail Embroidery"]`; `halfMagic` summary; `durability 5`; `talentOptions` novice = Acrobatic Defense, Distract, First Impression, Great Leap, Haggle, Maneuver, Navigation, Speak Language, Taunt, Throwing Weapon; journeyman = Air Speaking, Battle Bellow, Conceal Object, Engaging Banter, Etiquette, Graceful Exit, Leadership, Resist Taunt, Second Weapon, Surprise Strike. Circles:
  - C1 `freeTalents ["Air Sailing"]`, talents Avoid Blow, Climbing, Melee Weapon, Thread Weaving (Air Sailor), Wind Catcher; effect `grant-karma-use` target `{domain:"test",name:"Action"}` scope "on board an airship" (once per round; pattern: Thief/Warrior line 113 uses Action+scope).
  - C2 Awareness; Physical Defense +1. C3 Empathic Sense; `grant-karma-use` Initiative. C4 Wound Balance; Social Defense +1. C5 Heartening Laugh; `grant-karma-use` target `{domain:"test",name:"Action"}` with `scope:"Interaction tests"` (EFFECT-TAXONOMY lists test names Action|Attack|Damage|Effect|Initiative|<named ability>; no Interaction name), plus Collaborate `note` (Simple, 1 Strain, ally +2 to a test toward a common goal, `gmDiscretion:true`). C6 Air Dance; Physical +2. C7 Inspire Others; `characteristic-modifier` RecoveryTests add 1 rating. C8 Lion Heart; Physical +3. All defense effects `stacking:"highest"`.
- **Where:** `rules/disciplines.json`. Bump nothing (no schema/taxonomy change); optionally nothing in `notes`.
- **Approach:** Copy the Archer entry's field shapes and effect JSON exactly; keep `summary` strings short and in the file's existing voice.
- **Dependencies:** talent names must exist in talents.json (they do; I2/I3 fill detail).
- **Acceptance criteria:** JSON parses; `Air Sailor` in `disciplinesFile.disciplines`; every name in circles/options/freeTalents resolves in talents.json; C1 has 5 DTs + free Air Sailing; 8 circles each with the table's DT; no Spellcasting/Matrix anywhere; effects use only taxonomy-v6 types/targets.
- **Risks / unknowns:** Stacking read as replace per repo convention.

### I2 — Flesh out Air Sailor Discipline Talents in rules/talents.json
- **Covers tickets:** T2
- **Rules:** R4, R5, R6
- **Tier:** 3
- **What:** Upgrade stubs to full entries: Air Sailing (WIL, Sustained, 0, skillUse Yes/Novice; test 5 vs crew; free talent), Climbing (DEX, Standard, 0, Yes/Novice), Thread Weaving (Air Sailor) (PER, Standard, 0, skillUse allowed false; Air Weaving: max threads and thread rank = Rank, Thread Sight; model on Thread Weaving (Archer) minus Arrow-Weaving text), Wind Catcher (WIL, Standard, 1, No; test 6, 1-2 successes safe, 3+ steer; max Rank x100 yards), Empathic Sense (CHA, Standard, 1, No), Heartening Laugh (CHA, Simple, 1, Yes/Novice), Inspire Others (CHA, Standard, 0, No), Lion Heart (WIL, Free, 1, No). Verify (read-only unless mismatch) existing full Avoid Blow, Awareness, Wound Balance, Air Dance, Melee Weapon against Q042 (action/attribute/strain/skillUse); expected no change.
- **Where:** `rules/talents.json` (keys under `talents`).
- **Approach:** Per-talent values from Q042 TALENT TEXTS; `skillUse {allowed:false}` for "No" talents, `{allowed:true,tier:"Novice"}` otherwise; `tier` field per R5; `presentation.shortEffect` a few words; `versus` where the book names a test target; `effects` as `note`(s) with `condition:"on-success"` where appropriate. Keep existing `name/action/attribute` unchanged.
- **Dependencies:** none.
- **Acceptance criteria:** each entry has summary, strain, skillUse, tier, effects; values equal Q042; none regress.
- **Risks / unknowns:** Verified by grep (review F3): no engine/store code reads `talents.json` `tier` for pricing or derivation. The only `.tier` readers are thread-item catalog entries (`engine/legend-spent.js:463-464`, `store.js:974`) and the skill catalog (`engine/creation.js:436`); store.js:884 reads `skillUse` for skills. Adding `tier` to talent entries is therefore additive and data-only; `npm test` still confirms.

### I3 — Flesh out Air Sailor option talents in rules/talents.json
- **Covers tickets:** T3
- **Rules:** R3, R4, R5
- **Tier:** 3
- **What:** Upgrade stubs: Acrobatic Defense, Distract, Great Leap, Maneuver, Navigation, Speak Language, Taunt, Air Speaking, Battle Bellow, Etiquette, Graceful Exit, Leadership, Resist Taunt, Second Weapon, Surprise Strike. Verify existing full entries First Impression, Haggle, Throwing Weapon, Conceal Object, Engaging Banter against Q042 (strain/skillUse/attribute). Speak Language: skillUse `{allowed:false}` with note about non-magical skill ("No (see text)"), strain 1.
- **Where:** `rules/talents.json`.
- **Approach:** As I2. Book Skill Use tiers: Journeyman for Battle Bellow, Conceal Object, Leadership, Resist Taunt, Second Weapon; Novice for the rest (including Engaging Banter/Etiquette/Graceful Exit/Surprise Strike despite being Journeyman options; R5). Air Speaking No. Strain per Q042 (Acrobatic Defense 1, Distract 1, Great Leap 1, Maneuver 1, Navigation 0, Taunt 1, Air Speaking 1, Battle Bellow 1, Etiquette 0, Graceful Exit 0, Leadership 0, Resist Taunt 1, Second Weapon 1, Surprise Strike 1). Navigation note: GM Difficulty table (5/7/9/12/18).
- **Dependencies:** none (parallel with I2).
- **Acceptance criteria:** as I2; no existing full entry changes except to correct a verified mismatch (record any in the build log).
- **Risks / unknowns:** Shared talents are used by other Disciplines (Archer options include Navigation, Distract, Etiquette, Resist Taunt, Speak Language, First Impression); behavioural change is additive only.

### I4 — Tests
- **Covers tickets:** T4
- **Rules:** R7, R8
- **Tier:** 3
- **What:** (a) New `engine/air-sailor-data.test.js` (data conformance): Air Sailor present; header fields; 8 circles with the R2 DTs; C1 free talent Air Sailing and no Spellcasting/Standard Matrix anywhere; option lists exact (10 + 10); every referenced name resolves in talents.json; all 33 Air Sailor talents are non-stub (have summary, strain, skillUse, tier, effects non-empty) and match Q042 action/attribute/strain/skillUse table; Physical defense values 1/2/3 and Social +1 at C4 with `stacking:"highest"`; C7 RecoveryTests +1; every effect `type` is in the taxonomy list. (b) Circle-1 creation test (in `engine/new-character.test.js` or the new file): `buildNewCharacter({discipline:"Air Sailor"})` for Human: seeded Durability+Karma Ritual only, no `spells`, no grimoire, `free.talents` derived includes Air Sailing at Rank 1 (via `engine/free-talents.js`), Durability 5 derived into Unconscious/Death ratings from engine (derived values, not the mid-circle sample block; the sample is used only for attribute-step spot checks, DEX 16 -> Step 7 etc. if cheap). (c) Update hard-coded discipline lists: `engine/creation.test.js:1247`, `tools/dev-server.test.js:219` (and its "4 Disciplines" title), and the `addable` arrays in `store-creation-golden.test.js:216-219`. Run `npm test` and fix only what must change.
- **Where:** `engine/*.test.js`, `tools/dev-server.test.js`, `store-creation-golden.test.js`.
- **Approach:** Mirror existing test helpers (`read()`, `new URL('../rules/...')`). Do not weaken existing assertions.
- **Dependencies:** I1-I3.
- **Acceptance criteria:** `npm test` green; no existing test deleted.
- **Risks / unknowns:** Golden `addable` order depends on file position (Air Sailor first); `check-ui-kit` unaffected.

## Sequencing
I1 first (defines names) -> I2 and I3 (independent, could be one pass) -> I4 (needs final data). Run `npm test` after I1 as a hard gate to expose hard-coded discipline lists early; record every test file touched in the build log (other tests may embed discipline lists, e.g. `knacks-catalog.test.js:55` comment, `store-start-discipline.test.js`, `engine/talent-options-initiation.test.js`).

## Open questions
- Whether Air Sailor should be first or last in the array: chosen alphabetical-first for consistency; if any code assumes index order, switch to append and adjust goldens.

## Review responses
- F1 (C5 Interaction karma unresolved): fixed. I1 now fixes the representation as `grant-karma-use` Action with `scope:"Interaction tests"`; open question removed.
- F2 (fragile golden line refs): fixed. Sequencing makes `npm test` after I1 a hard gate and requires recording every touched test file in the build log.
- F3 (talent `tier` unverified): fixed. Grep done; no pricing/derivation code reads talent `tier`; recorded in I2/I3 risks.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
