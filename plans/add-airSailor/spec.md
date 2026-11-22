# Tech Spec: Add Air Sailor discipline (add-airSailor)

## Overview
Pure rule-data change: insert an `Air Sailor` entry as the first element of `disciplines[]` in `rules/disciplines.json`, and upgrade 23 stub entries in `rules/talents.json` (`talents` map) to full entries, using existing schema and taxonomy v6 only (non-mappable abilities use `note`). Tests: one new data-conformance file `engine/air-sailor-data.test.js` (includes the Circle-1 creation check) plus updates to hard-coded discipline lists in three existing test files. No UI, engine, schema or taxonomy change.

## Guardrail alignment
All Tier 3 (data fitting existing schema/taxonomy; tests; no Tier 1/2 item, no sign-off needed; confirmed against brief.md tiers). Data-down/dispatch-up untouched; engine untouched and pure; only inputs stored (free talents, Durability rating, defenses all derived; no `spells`/grimoire for Air Sailor); no new derived value is stored. Both files keep `effectTaxonomy` "v6"; do not bump any version tag.

## Design
### Data / types
No schema change. Files touched: `rules/disciplines.json`, `rules/talents.json`.

#### 1. `rules/disciplines.json`: insert as first element of `disciplines` (before Archer)
Field shapes copy Archer (lines 12-83). Strings below are the exact summaries to use (original wording).

```json
{
  "name": "Air Sailor",
  "importantAttributes": ["Charisma", "Dexterity", "Willpower"],
  "karmaRitual": { "summary": "Sits alone in silent meditation under the open sky, picturing an airship setting out on a long journey with its risks and perils; the ritual ends when the imagined journey ends safely, after about half an hour. Restores the Karma pool." },
  "artisanSkills": ["Rune Carving", "Sail Embroidery"],
  "halfMagic": { "summary": "Know airship designs, recognize airship types, common flight paths and crew complements; may extend to airship maintenance, repair and construction." },
  "durability": 5,
  "talentOptions": {
    "novice": ["Acrobatic Defense", "Distract", "First Impression", "Great Leap", "Haggle", "Maneuver", "Navigation", "Speak Language", "Taunt", "Throwing Weapon"],
    "journeyman": ["Air Speaking", "Battle Bellow", "Conceal Object", "Engaging Banter", "Etiquette", "Graceful Exit", "Leadership", "Resist Taunt", "Second Weapon", "Surprise Strike"]
  },
  "circles": [ ...8 entries below... ]
}
```

Circles (each `{ "circle": n, [freeTalents], "talents": [...], "effects": [...] }`; every effect has `"source": "discipline"`):

| C | freeTalents | talents | effects |
|---|---|---|---|
| 1 | `["Air Sailing"]` | `["Avoid Blow","Climbing","Melee Weapon","Thread Weaving (Air Sailor)","Wind Catcher"]` | `grant-karma-use`, target `{domain:"test",name:"Action"}`, `scope:"on board an airship"`, summary "May spend Karma once per round on any action taken on board an airship." |
| 2 | - | `["Awareness"]` | `defense-modifier` Physical, add, 1, `measure:"rating"`, `stacking:"highest"`, "+1 Physical Defense." |
| 3 | - | `["Empathic Sense"]` | `grant-karma-use` target `{domain:"test",name:"Initiative"}`, no scope, "May spend Karma on Initiative tests." |
| 4 | - | `["Wound Balance"]` | `defense-modifier` Social, add, 1, rating, highest, "+1 Social Defense." |
| 5 | - | `["Heartening Laugh"]` | (a) `grant-karma-use` target `{domain:"test",name:"Action"}`, `scope:"Interaction tests"`, "May spend a Karma Point on Interaction tests." (b) `note`, `gmDiscretion:true`, summary "Collaborate: once per round as a Simple action, take 1 Strain to give an ally +2 to a test toward a common goal (describe how you assist)." |
| 6 | - | `["Air Dance"]` | `defense-modifier` Physical, add, 2, rating, highest, "+2 Physical Defense." |
| 7 | - | `["Inspire Others"]` | `characteristic-modifier` target `{domain:"characteristic",name:"RecoveryTests"}`, add, 1, `measure:"rating"`, "An additional Recovery test." (no stacking key; mirror Warrior C7 exactly, read it first and copy its shape) |
| 8 | - | `["Lion Heart"]` | `defense-modifier` Physical, add, 3, rating, highest, "+3 Physical Defense." |

C1 only has `freeTalents`. No `Spellcasting`, `Standard Matrix`, `Patterncraft` anywhere.

#### 2. `rules/talents.json`: full-entry shape
Replace each stub in place (keep key and position). Shape, as Haggle / Thread Weaving (Archer):
`name, presentation:{shortEffect}, action, attribute, strain, skillUse, tier, [versus], summary, effects[]`.
- `name`, `action`, `attribute` MUST stay byte-identical to the stub (shared with other Disciplines; note stored action strings: "Sustain" on Air Sailing/Etiquette/Leadership/Navigation, "Sustained" only on Haggle).
- `skillUse`: `{"allowed":false}` or `{"allowed":true,"tier":"Novice|Journeyman"}`.
- `effects`: one or more `{ "type":"note", ["condition":"on-success",] "source":"talent", "summary":"..." }`; non-empty. No other effect types needed.
- Write original-wording summaries distilled from RULES-FAQ Q042 (no verbatim prose). `versus` as free text where Q042 names a target.
- `tier` (nothing reads it; additive): DTs of C1-C4 and options from the novice list = "Novice"; Heartening Laugh, Inspire Others, Lion Heart and options from the journeyman list = "Journeyman". Tests assert only that tier is "Novice" or "Journeyman".

Values per talent (action/attribute = existing stored; strain and skillUse are the new values from Q042):

| Talent | action (stored) | attribute | strain | skillUse | tier | shortEffect | versus | Key note content |
|---|---|---|---|---|---|---|---|---|
| Air Sailing | Sustain | Willpower | 0 | Yes/Novice | Novice | Help propel an airship | - | Air Sailing (5) test; each success counts as one crew member. Crew needs Rank 1+. Hourly: 25% of required crew succeeding keeps ship aloft, 50% maneuver/slow climb or dive, 75% speed up/aerobatics. Free talent. |
| Climbing | Standard | Dexterity | 0 | Yes/Novice | Novice | Scale surfaces | GM-set Difficulty | Success: 2 yards/round up or down, +1 yard per extra success; failure no progress, may fall. |
| Thread Weaving (Air Sailor) | Standard | Perception | 0 | `{allowed:false}` | Novice | Weave thread magic | - | Mirror Thread Weaving (Archer) text without arrow text: max active threads and thread rank = Rank; grants Thread Sight; Air Sailors have no Spellcasting. |
| Wind Catcher | Standard | Willpower | 1 | No | Novice | Slow a fall | - | Falling: Wind Catcher (6) test; 1-2 successes land safely, 3+ also steer within the distance fallen; failure plummets; max safe fall Rank x100 yards. |
| Empathic Sense | Standard | Charisma | 1 | No | Novice | Read emotions | Social Defense | Target within 10 yards; 1 success general mood, 2 surface emotions, 3+ exact feelings; +2 per success to Interaction tests; lasts Rank minutes; attunement option (see Q042). |
| Heartening Laugh | Simple | Charisma | 1 | Yes/Novice | Journeyman | Steel allies vs fear | highest Social Defense among opponents in earshot | Friendly hearers get +2 per success to Social Defense vs fear/intimidation and Willpower tests to shake it, for Rank rounds. |
| Inspire Others | Standard | Charisma | 0 | No | Journeyman | Bolster allies | highest Social Defense in group, +1 per extra target | Friendly targets only; per success affected gain +1 Social Defense and +2 to tests for Rank rounds. |
| Lion Heart | Free | Willpower | 1 | No | Journeyman | Stronger will | - | Use Lion Heart Step instead of Willpower Step to resist effects that allow a Willpower test to shake them off. |
| Acrobatic Defense | Simple | Dexterity | 1 | Yes/Novice | Novice | Dodge in close combat | highest Physical Defense of close-combat opponents | Per success +2 Physical Defense for the rest of the round; lost if knocked down or movement restricted; not with Anticipate Blow. |
| Distract | Simple | Charisma | 1 | Yes/Novice | Novice | Draw attention | target's Social Defense | Per success adept -1 Physical Defense vs that target; target takes the same -1 vs others and is Blindsided vs them for the round. |
| Great Leap | Free | Dexterity | 1 | Yes/Novice | Novice | Leap far | - | Test result = yards jumped, split horizontal/vertical, neither above Movement Rate; avoids environmental hazards; used to board airships. |
| Maneuver | Simple | Dexterity | 1 | Yes/Novice | Novice | Outmaneuver a foe | target's Physical Defense | Per success +2 Physical Defense vs that target's attacks and +2 to first close-combat Attack test vs that target this round. |
| Navigation | Sustain | Perception | 0 | Yes/Novice | Novice | Find your position | GM Difficulty table | Needs sky view and charts, 10 minutes. Difficulty 5 clear night, 7 scattered clouds, 9 partly cloudy, 12 overcast, 18 severe storm; bad charts +1 to +5. Successes: 1 within 10 miles, 2 within 5, 3 within 2, 4+ within 1. |
| Speak Language | Standard | Perception | 1 | `{allowed:false}` | Novice | Learn languages | Learning Difficulty by race | Languages up to Rank; 1 minute listening; success levels 1 simple, 2 normal, 3 technical, 4+ abstract; each test lasts Rank hours. Note: non-magical skill version exists (skillUse false per "No (see text)"). |
| Taunt | Simple | Charisma | 1 | Yes/Novice | Novice | Rattle a foe | target's Social Defense | Target must understand; per success -1 to tests and -1 Social Defense for Rank rounds. |
| Air Speaking | Simple | Perception | 1 | No | Journeyman | Speak across distance | Mystic Defense of each target | Speak without vocalizing; targets within Rank x10 yards hear as normal conversation; must be a language adept knows. |
| Battle Bellow | Simple | Charisma | 1 | Yes/Journeyman | Journeyman | Rally or frighten | highest Social Defense in group, +1 per extra target | Targets within Rank x10 yards; enemies -1 to tests per success until end of next round; friends gain successes as bonus to close-combat Attack tests; fear-immune unaffected. |
| Etiquette | Sustain | Charisma | 0 | Yes/Novice | Journeyman | Behave properly | Difficulty 5 +3 per differing aspect | 1 success rudiments, 2 approval, 3+ Attitude improves one degree (max Friendly); lasts Rank days or until situation ends. |
| Graceful Exit | Standard | Charisma | 0 | Yes/Novice | Journeyman | Slip away from combat | highest Social Defense in group | Escape combat; may cover up to Rank extra characters at +1 Difficulty each; bedazzled foes take no direct action for rounds = successes; returning enrages opponents. |
| Leadership | Sustain | Charisma | 0 | Yes/Journeyman | Journeyman | Lead GM characters | highest Social Defense in group | Group up to Rank x20; Neutral or better follow; 1 success Rank x10 minutes, 2 Rank hours, 3+ Rank days; ends for anyone whose Attitude falls below Neutral. |
| Resist Taunt | Free | Willpower | 1 | Yes/Journeyman | Journeyman | Shrug off taunts | the attack's test result | Success negates Persuasion, Taunt, Intimidation and similar; uses per round = Rank, once per social attack. |
| Second Weapon | Simple | Dexterity | 1 | Yes/Journeyman | Journeyman | Off-hand attack | target's Physical Defense | Extra off-hand one-handed melee attack in the same round; hit = normal Damage test; not with Shield Bash. |
| Surprise Strike | Free | Strength | 1 | Yes/Novice | Journeyman | Strike the unready | - | vs Surprised, Blindsided or Knocked Down targets; on a successful Attack test substitute Surprise Strike Step for Strength Step in Damage. |

Existing full entries are NOT edited (Air Dance, Avoid Blow, Awareness, Wound Balance, Melee Weapon, Throwing Weapon, First Impression, Haggle, Conceal Object, Engaging Banter); verified in this spec against Q042: action/attribute/strain/skillUse already match (Air Dance Free/DEX/2/No; Avoid Blow Free/DEX/1/Yes-Novice; Awareness Simple/PER/0; Wound Balance Free/STR/0; Melee Weapon Standard/DEX/0; Throwing Weapon Standard/DEX/0; First Impression Standard/CHA/0; Haggle Sustained/CHA/0; Conceal Object Standard/DEX/1 Yes-Journeyman; Engaging Banter Standard/CHA/0 Yes-Novice). Do not alter `tier` on them (Conceal Object Novice, Engaging Banter Journeyman, Air Dance Novice stay). Leave the file `notes` array unchanged.

### Modules & functions
No production module changes. Test files:
- NEW `engine/air-sailor-data.test.js` (node:test; `read = (p) => JSON.parse(readFileSync(new URL('../rules/' + p, import.meta.url)))`, as in `engine/new-character.test.js:21`).
- EDIT `engine/creation.test.js:1247` add `'Air Sailor'` to the discipline array (before Archer to match file order).
- EDIT `tools/dev-server.test.js:218-219` add `'Air Sailor'`; title "(4 Disciplines)" -> "(5 Disciplines)".
- EDIT `store-creation-golden.test.js:216-219`: the four snapshot literals each contain an `"addable":[...]` list; insert `"Air Sailor"` first (before Archer) in those lists only. Confirm by running; if order differs, follow the actual `m.addableDisciplines` order (line 251) rather than guessing.
- `npm test` after the disciplines.json change is a hard gate; any other failing test that enumerates disciplines (candidates: `store-start-discipline.test.js`, `engine/talent-options-initiation.test.js`, `engine/free-talents.test.js`, `knacks-catalog.test.js`) gets the minimal fix; record every touched file in the build log. Never weaken an assertion.

### UI / behavior
None coded. Visible result: "Air Sailor" appears (first alphabetically) in the loader's "Start a new character" list and Disciplines tab; Circle-1 creation takes the non-magician path in `buildNewCharacter` (`engine/new-character.js:88`; magician iff C1 talents include `Spellcasting`): no `spells`, no Grimoire item. Light/dark theme, modals and Overview fit: unaffected (no UI change).

### Rules
Expected values come only from here (rules.md ids; Q042 = RULES-FAQ).

| Rule | Value | Source |
|---|---|---|
| R1 header | Attributes CHA, DEX, WIL; artisan Rune Carving, Sail Embroidery; Durability 5; free talent Air Sailing | Q042 |
| R2 per-Circle | C1 Avoid Blow, Climbing, Melee Weapon, Thread Weaving (Air Sailor), Wind Catcher + Action karma on airship; C2 Awareness, Physical +1; C3 Empathic Sense, Initiative karma; C4 Wound Balance, Social +1; C5 Heartening Laugh, Collaborate (Simple, 1 Strain, ally +2), Interaction karma; C6 Air Dance, Physical +2; C7 Inspire Others, extra Recovery test; C8 Lion Heart, Physical +3 | Q042 |
| R2 stacking | Physical +1/+2/+3 use `stacking:"highest"` (repo convention; no owner ruling needed) | rules.md R2 |
| R3 options | Novice and Journeyman lists exactly as table above | Q042 |
| R4 talents | step/action/strain/skillUse per table above | Q042 |
| R5 tier | No book talent tier; skillUse tier as printed (Novice for Engaging Banter, Etiquette, Graceful Exit, Surprise Strike despite Journeyman options) | Q042, Q001 |
| R6 | Thread Weaving (Air Sailor) keeps its name; no Spellcasting, spells or matrix | Q042 + owner 2026-11-22 |
| R7 | Mid-circle sample (DEX 16 -> Step 7 etc.) is not a Circle-1 block; creation test uses engine-derived values | Q042 |
| R8 | Generic starting kit; crew Air Sailing Rank 1+ met by free talent at Rank = Circle | Q042 |
| R9 | App names Melee Weapon, Throwing Weapon | Q042 |

### Edge cases & invariants
- JSON stays valid and `disciplines.json` alphabetical (Air Sailor, Archer, Nethermancer, Thief, Warrior); `talents.json` key count unchanged (456).
- Every name in `freeTalents`, `talents` and both option lists resolves to a key in `talents.json`; 33 distinct Air Sailor talents (1 free + 12 DTs... precisely 12 DTs + Air Sailing + 20 options = 33; Air Sailing is the free talent, the 20 options include First Impression, Haggle, Throwing Weapon, Conceal Object, Engaging Banter already full).
- Effect `type`s used are only `grant-karma-use`, `defense-modifier`, `characteristic-modifier`, `note`.
- A circle's `talents` never repeats a talent from another circle or from `talentOptions`.
- Free talent is derived, never stored; Air Sailor C1 `freeTalents` has exactly one entry.

## Testability notes
`engine/air-sailor-data.test.js` (pure data; no DOM):
1. Discipline present with header fields, durability 5, `artisanSkills`, `importantAttributes`.
2. Eight circles; DTs per circle exactly as the table; C1 `freeTalents` deep-equals `["Air Sailing"]`; no `Spellcasting`/`Standard Matrix`/`Enhanced Matrix`/`Patterncraft` in any circle or `freeTalents`.
3. Option lists deep-equal (10 + 10) in the order given.
4. Name resolution against `talents.json`.
5. All 33 talents non-stub: `summary` non-empty string, `strain` number, `skillUse` object, `tier` in {Novice, Journeyman}, `effects` non-empty array, `presentation.shortEffect` present on the 23 newly written; compare `action`, `attribute`, `strain`, `skillUse` (allowed + tier) against a literal expected table in the test mirroring the Design table (stored action strings, "Sustain"/"Sustained" included).
6. Effects: Physical defense values 1/2/3 at C2/C6/C8, Social 1 at C4, each `measure:"rating"`, `stacking:"highest"`; C3 Initiative karma; C1 and C5 karma scopes; C5 contains a `note` mentioning Collaborate; C7 RecoveryTests add 1; every effect type is in the taxonomy-v6 set used above.
7. Creation (`buildNewCharacter({name,race:'Human',discipline:'Air Sailor'}, rules)`, rules = `{racesFile, disciplinesFile, attributesFile}`): result has no `spells`/grimoire (items lack `GRIMOIRE`), stored talents are only Durability and Karma Ritual (Rank 1, Circle 1), `freeTalentRows(ref, 1, ...)` from `engine/free-talents.js:11` yields Air Sailing, and Durability 5 is read from the discipline (assert via `disciplinesFile`, not hard-coded engine numbers beyond what existing helpers expose). `engine/new-character.test.js:34` already iterates all disciplines, so it covers Air Sailor automatically.
Manual owner verification: Air Sailor appears and a new character can be created and opened in the Disciplines tab in light and dark themes; talent descriptions read correctly.

## Changelog entry
`{"type": "added", "text": "New Discipline: Air Sailor (Circles 1-8), with full talent descriptions for all of its talents."}` (release step; not edited by this feature's build).

## Out of scope
Spells, Spellcasting, matrices, grimoire for Air Sailor; sample character file; UI, engine, schema or taxonomy changes (no new `Interaction` test vocabulary); Warden/Master Circles; per-talent tier derivation; starting-kit extras (NOT COVERED, generic kit applies); editing existing full talent entries.
