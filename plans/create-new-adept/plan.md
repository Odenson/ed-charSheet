---
status: draft
---
# Delivery Plan: Create new adept (create-new-adept)

## Context & learnings
The owner wants to start a brand-new Circle-1 character from the loader. The player picks one of the four disciplines (Archer, Nethermancer, Thief, Warrior), enters a name and race, and gets a draft character that lives in localStorage until the first Save. The first Save creates `data/characters/<id>.json` and the index row on the `character-data` branch through the existing worker. While the draft is in "creation mode", the existing tabs swap Legend steppers for free-point steppers (8 talent points, 25 attribute points, starting skills, Nethermancer starting spells) until "Finish creation".

Decisions recorded in `qa-log.md`:
- Legend starts 0/0 (house rule, R7).
- The draft persists in localStorage and shows as "unsaved draft" in the loader.
- Id is derived from the name. NO auto-suffix (owner revision 2026-11-21): a collision with an existing id (index or draft) is a blocking warning at the name/race modal and again at first Save; the player must rename the character. Nothing is posted until the check passes.
- Discard uses ed-confirm and removes only the local draft.
- The "+" entry is an inline SVG glyph plus the discipline name; no new assets.
- Attribute cap is -2..+8 over the racial value (house rule).
- The leftover-attribute Max Karma bonus is DERIVED at read time (owner answer, qa-log last two entries); no `creation.karmaBonus` is stored.
- `rules/skills.json` gets a structured `category` field as Tier-3 data. If a schema-tag bump proves necessary, the build stops and re-asks the owner.
- Talent Option is excluded from the 8 points.
- Total rank per skill is <= 3, fixed free ranks included (house rule).
- On Finish, unspent talent/skill/spell points are forfeited after a warning. Attribute leftovers become extra Max Karma.
- Starting kit plus 100 silver; the Grimoire is homebrew (cost 0, weight 1 lb, average availability).
- Non-goals: Human Versatility, dwarf language swap, portraits, deleting saved characters, any worker change.

Round-2 decisions (owner, 2026-11-21; qa-log "round 2"; findings G1–G15 in `review.md` Round 2):
- **Starting Karma is free.** The house Karma-economy rule is on (`hb-karma-economy`), so the audit charges `converted × ritualCost` as Legend. While a `creation` block exists, the creation Karma is taken out of that sink. Derived; nothing new stored.
- **The Karma cap applies to the total:** Max Karma = min(Karma Modifier × Circle + unused-attribute bonus, race `karma.maxCap`).
- **Legend 0/0 derives as 0:** when a `creation` block exists and there is no earned entry and no legacy total, Total Earned and Available derive as 0, not the placeholder. Nothing stored; existing characters unchanged.
- **Durability and Karma Ritual are seeded at Rank 1, free:** stored as Circle-1 talents (the shape every existing character uses) and listed in `creation.free.talents`, so they cost 0 Legend. They are not steppable in creation and sit outside the 8 points.
- **Starting spells are a free pick with no prerequisite:** the Discipline's Circle 1–2 spells from `rules/spells.json`, spell points = Perception Step, no learning roll, no silver, whatever the talent ranks.
- **Knowledge picks are free text:** stored as `Knowledge (<text>)` and resolved to the generic `Knowledge` entry by the existing skill lookup (`store.js` ~L1263).
- **One language per rank:** Speak Language 2 = two language entries at Rank 1; Read/Write 1 = one entry at Rank 1. Language entries stay at Rank 1 in creation; extra languages from the 8 free ranks are more Rank-1 entries.
- **The Artisan pick comes from the Discipline's `artisanSkills` only.**
- Planner defaults (not owner questions; the owner may override at build alignment): a draft never autosaves before its first manual Save; an over-spent budget blocks Finish instead of auto-removing picks; a draft is a base envelope plus the ordinary edits overlay (I3).

Owner sign-off for the one Tier-1 change (an additive optional `creation` block, schema stays `ed-character/2`) is recorded in qa-log "2026-11-21 — TIER-1 SIGN-OFF".

## Discoveries
- **Worker create path needs no change (verified).** In `tools/worker/worker.js`, `isValidCharacter` accepts `schema` `ed-character/1` or `/2` with size <= MAX_BYTES, and `isValidId` requires `^[a-z0-9][a-z0-9-]{0,63}$`. `upsertCharacterFile` with no existing file (404) creates the file, ignores `base`, and then calls the create-only index maintenance that adds `{name, portrait}` to `data/characters/index.json`. The client sends `base: null` for a draft.
  - `store-server.js` `saveServer` already supports `base = null`.
  - `tools/dev-server.mjs` mirrors the same create-and-index behavior locally.
  - The slug rule means the client id helper must emit exactly `[a-z0-9-]`.
  - The index row falls back to `portrait` absent; this must be checked (see I3 and the index row shape `{name, portrait}`).
- **Overlay model.** `store.js` keeps per-id edits overlays under `ed-character-edits:<id>` and merges them in `applyEdits` (categories listed in `SAVED_CATEGORIES`). `loadCharacter(id)` reads the file via `readCharacterFile`; a draft has no file, so it needs its own loader path. `forSave` stamps the schema and strips talent `tier`. `reconcileOverlay` and `hasPendingEdits` drive the dirty dot.
- **Attributes already match.** Characters store `attributes[name] = {base, points, increases}`. `points` are the free creation buy and `increases` cost Legend (`engine/legend-spent.js` `auditLegendSpent`: "only `increases` cost Legend"). The 25 attribute points therefore land in the existing `points` field and need no new storage. The cost table is `rules/attributes.json` `pointCost`.
- **Legend audit** (`engine/legend-spent.js`) prices every talent rank (tier by Circle), skill rank (`skillRanksCost`) and every `spells.known` entry (`spellCost`). It has no notion of free ranks, which is exactly why the `creation` block is needed (T4).
- **Rank editing flow.** `ui/ed-app.js` `_editTalentRank` / `_editSkillRank` / `_canAffordRank` guard increases against derived Available Legend and persist through `saveAdvancementEdits`.
  - `_startDiscipline` (~L1438) is the closest precedent for seeding a Discipline: free talents are derived (`engine/free-talents.js`) and never stored; `cand.grants` gives the Circle-1 learned talents.
  - Steppers live in `ui/ed-disciplines.js` (talents and skills, ~L345-383, dispatching `ed-edit-talent-rank` / `ed-edit-skill-rank`) and `ui/ed-spells.js`.
  - Overview attribute editing is in `ui/ed-overview.js`.
- **Loader.** `ui/ed-character-picker.js` (kit-based modal, kind `picker`, rows from `listCharacters` -> `indexToRows`) dispatches `load-character`. `ed-app.js` startup (~L496-513) sets `this._error = 'No characters found in the character store.'` for an empty index. That blocks the "empty store" case and must change to open the picker with only the "Start a new character" section.
- **Save flow.** `_doSave` -> `saveServer(forSave(this._character), {id, base})` -> `reconcileOverlay`. A draft's first save must additionally clear the draft envelope and flip the character to "saved" (base = returned sha). The `_confirmSwitch` dirty-guard and autosave (`_scheduleAutosave`, key-gated) exist already.
- **Items catalog.** `rules/items.json` (`ed-items/*`) has `Adventuring Kit` (15 sp, 14 lb) in the `kind: gear` shape `{ref:{cost, weight:{amount,unit}, availability, description}, effects, presentation}`. Dagger exists. Traveler's Garb, Trail Rations (1 week) and Grimoire are missing (R8, R9).
- **Karma.** `resources.karma = {converted, spent, rituals?}`. Max is derived in `store.js` ~L1197 via `maxKarma(karmaMod, highestCircle, cap)` and current = `converted - spent`, clamped to max. Mechanism decided (F3): `converted` is seeded to the creation Max Karma.
- **The Karma-economy house rule is ON** (`rules/homebrew.json` `hb-karma-economy`, `enabled: true`, although its note says "ships disabled"). The audit then charges `converted × karma.ritualCost` as Legend spent (`engine/legend-spent.js`, Karma Rituals section). Unfixed, a new Ork starts at 35 Legend spent (5 × 7). Resolved by the round-2 "starting Karma is free" decision (I4).
- **Legend standing is null without an earned total.** `deriveModel` (~L1416) and `ed-app` `_legendTotalEarnt` return null when there is no legacy `totalEarnt` and `earned` is empty: the Available pill is a placeholder and `_canAffordRank` returns false. Resolved by the "Legend 0/0 derives as 0" decision (I4).
- **Durability is derived from a stored talent.** Health ratings add `durability × rank` of a stored `Durability` talent (`store.js` ~L1096). Every existing character stores Durability and Karma Ritual as talents (`kolon-v2`: both Rank 1 at Circle 1). Resolved by seeding both (I1).
- **The Spells tab needs a non-empty spells block and a Spellcasting talent.** `buildSpellsContext` returns null when `known` and `matrices` are both empty (`engine/spells.js` ~L737). Caster Disciplines are those holding a Spellcasting talent (~L744). The Learn spell list needs Thread Weaving, and learning runs a roll plus a silver fee. An empty matrix is `{type: "Standard", spell: null}` (`ui/ed-spells.js` ~L631).
- **Skills catalog.** `rules/skills.json` has one generic `Knowledge` entry (plus `Horror Lore`), generic `Artisan`, `Speak Language` and `Read/Write Language` entries, and per-language entries (`Speak Language (Ork)` …). Some artisan entries carry `(Artisan)` (Arrow Fletching, Bone Carving) and others do not (Wood Carving, Robe Embroidery, Rune Carving, Sculpting, Acting, Poetry). `Bribery` and `Skinning` appear twice. `engine/skill-options.js` `learnableSkills` offers catalog names only, each once, and `_learnSkill` takes a silver training fee from the purse (`ui/ed-app.js` ~L1288). `store.js` ~L1263 already resolves `Name (Spec)` to its base entry.
- **Overlay categories.** `applyEdits`/`SAVED_CATEGORIES` (`store.js` ~L577/L548) have no `attributes` category. `spells` is merged by `applyEdits` but missing from `SAVED_CATEGORIES`, so `hasPendingEdits` ignores it and `reconcileOverlay` never clears it (pre-existing).
- **Pricing invariant.** `deriveModel` documents that a rank step's price equals `audit(after) − audit(before)`; step prices come from `talentRankStepCost`/`skillRankStepCost`. `_canAffordRank` (`ui/ed-app.js` ~L1189) calls the audit without `karmaRitualCost`/`spellCatalog`, unlike `deriveModel` (pre-existing mismatch).
- **Steppers.** The existing rank stepper floors at Rank 1, and `_editTalentRank` only edits a talent already stored at rank ≥ 1 (~L1217). Rank-0 talents have no row.
- **Draft-hostile controls.** "Discard local changes" (`_discardLocal`, ~L1946) reloads, then sets `_dirty = hasCustomPendingEdits()`, which would make an unsaved draft look saved. `_initialId` only accepts index ids. Picker rows are `<button>`s, so a Discard button cannot nest inside one. "+ Add Discipline" shows for any character with an addable Discipline ("Seed Circle 1" does not: ordinal 1 returns null in `initiationQuote`).
- **Existing tests to extend or copy:** `store-start-discipline.test.js`, `store-free-talents.test.js`, `engine/legend-spent.test.js`, `picker.test.js`, `tools/rules-conformance.test.js`, `store-server.test.js`, `tools/dev-server.test.js`. The UI-kit check is `tools/check-ui-kit.mjs`; the import check is `tools/check-imports.mjs`.
- **Rules data.** `rules/disciplines.json` entries carry `circles[].freeTalents`, `circles[].talents`, `artisanSkills` and `durability`. `rules/races.json` has `startingAttributes` and `karmaModifier`. Confirmed (round 2): the First-Circle Discipline Talents are exactly the circle-1 `talents` list. Free talents are a separate `freeTalents` list, Talent Options a separate `talentOptions` pool, and Durability/Karma Ritual appear in neither. Every Discipline carries `halfMagic`, so it is not a magician signal. Spells carry structured `discipline` and `circle` fields (all 123 are Nethermancer).
- **docs/UI-GUIDELINES.md** governs the modal, light/dark and placeholder-pill rules. ARCHITECTURE §4.1 is where the `creation` block must be documented.

## Guardrail classification
| Item | Tier | Note |
|---|---|---|
| I1 builder engine | 3 | New pure module, stores inputs only |
| I2 catalog items + skill `category`/`artisanKey`/`generic` data | 3 | Data fitting the existing schema. Owner confirmed the `category` field as Tier-3 (qa-log); `artisanKey` and `generic` are the same kind of data, flagged at build alignment. If a schema-tag bump is needed: STOP and re-ask |
| I3 draft store | 3 | localStorage envelope, no schema change; reuses worker create |
| I4 `creation` block + audit, pricing, Legend/Karma derivation, overlay categories | **1** (block) / 3 (engine, store) | Schema shape. Owner sign-off: qa-log "2026-11-21 — TIER-1 SIGN-OFF" (recorded, so not blocked). The round-2 changes add no stored field |
| I5 loader section + modal | 3 | Must honor Tier-1 modal/theme/font rules |
| I6 draft wiring in ed-app | 3 | |
| I7 creation allotment engine | 3 | Depends on I4 |
| I8 creation-mode UI | 3 | Depends on I4, I7 |
| I9 Finish creation | 3 | Depends on I4 |
| I10 docs, tests, changelog | 3 | |

**Scope caution on the sign-off.** It covers "creation-mode inputs (allotments spent, finished flag)". I4 keeps the block to exactly two fields: an `open` flag and the `free` rank ledger. There is no stored Karma bonus (owner: derived at read time). If the builder concludes anything beyond these inputs is needed, STOP and re-ask the owner. The round-2 decisions stay inside this: free starting Karma and Legend 0 are derived from the block's presence, Durability/Karma Ritual go in the existing `free.talents` ledger, and the new overlay categories are store plumbing, not file shape. No Tier-2 items; the effect taxonomy is untouched.

## Rules dependencies
All from `rules.md`; no open NEEDS_RULES.
- R1 starting talent points: I1, I7.
- R2 free talents at creation (derived, Rank = Circle): I1, I7.
- R3 attribute points and cap: I7, I9.
- R4 Karma at creation: I1, I9.
- R5 starting skills: I7.
- R6 starting spells: I7.
- R7 starting Legend 0/0 (house): I1.
- R8 starting equipment and silver: I1, I2.
- R9 Grimoire stats (house): I2.
- R10 end of creation / leftovers (house): I9.

Round-2 owner decisions (recorded on `rules.md`; the rule-agent records them as `Decision:` lines on RULES-FAQ Q039 in sequencing step 0):
- R1: Durability and Karma Ritual seeded at Rank 1, free, outside the 8 points (I1, I4).
- R4: starting Karma is free under the Karma-economy rule; the race cap applies to the total including the bonus (I4, I9).
- R5: the Artisan pick comes from the Discipline list only; one language per rank; Knowledge as free text (I2, I7, I8).
- R6: a free spell pick with no talent prerequisite, no roll and no silver (I7, I8).
- R7: Legend 0 is derived while the creation block exists (I4).

## Implementation items
### I1 — Pure new-character builder (engine)
- **Covers tickets:** T1
- **Rules:** R1, R2, R4, R7, R8
- **Tier:** 3
- **What:** `engine/new-character.js`, pure and DOM-free.
  - `slugifyId(name)`: lowercase, non-`[a-z0-9]` runs become `-`, trimmed, capped at 64, with a fallback for an empty result.
  - `idTaken(id, takenIds)`: pure check (taken = index ids plus draft ids); NO suffixing. The slug is the id, so two names that slug the same (e.g. "Kolon" and "kolon!") collide and the warning names the clashing id.
  - `buildNewCharacter({name, race, discipline}, rules)`: returns an `ed-character/2` object.
- **Where:** new `engine/new-character.js` plus `engine/new-character.test.js`. Reads `rules.racesFile` and `rules.disciplinesFile` as passed in.
- **Approach:** the draft contains:
  - `meta: {name, race, id}`. Check the existing `meta` fields (e.g. `version`) so the readers don't break.
  - `attributes[n] = {base: race.startingAttributes[n], points: 0, increases: 0}` for every name in `rules/attributes.json` `order`.
  - `disciplines: [{name, circle: 1, talents: [{name: "Durability", rank: 1, circle: 1}, {name: "Karma Ritual", rank: 1, circle: 1}]}]` (round-2 decision; the shape every existing character uses). Free talents (Call Missile, Standard Matrix ×2, …) stay derived, never stored. The five First-Circle Discipline Talents start unrecorded (Rank 0).
  - `skills: []`. The fixed free ranks are player picks (which Knowledge, Artisan and languages), added through the creation skill step (I7/I8), never auto-seeded.
  - `spells` only for magicians: `{known: [], matrices: [{type: "Standard", spell: null}, {type: "Standard", spell: null}]}`, one empty matrix per free Standard Matrix talent, so `buildSpellsContext` returns a context. Non-magicians have no `spells` key.
  - `resources`: `legend: {earned: []}`, with no legacy `totalEarnt`/`totalSpent` (I4 derives 0/0 while `creation` exists). `karma: {converted: K, spent: 0}`, where K is the creation Max Karma: `min(karmaModifier × 1, karma.maxCap)` when the house cap is set. The leftover-attribute bonus is added at Finish (I9). Under the Karma-economy rule, I4 treats this Karma as free.
  - `items` from the starting kit as `{name, equipped}` (the owned-item shape in the sample files): Adventuring Kit, Dagger, Traveler's Garb, Trail Rations (1 week), and a Grimoire only for a magician. Default: Dagger and Traveler's Garb equipped, the rest not (the spec may adjust).
  - `wealth: {coins: {copper: 0, silver: 100, gold: 0, earth: 0, water: 0, air: 0, fire: 0, orichalcum: 0}, gems: []}` (the sample files' shape).
  - `creation: {open: true, free: {talents: {"<Discipline>/Durability": 1, "<Discipline>/Karma Ritual": 1}, skills: {}, spells: []}}` as defined in I4.
  - Magician detection reads structured data: the Discipline's circle-1 `talents` include `Spellcasting`, the engine's own caster test (`engine/spells.js` ~L744). Not `halfMagic`, which every Discipline has. Only Nethermancer qualifies among the four.
- **Dependencies:** I2 (catalog names), I4 (block shape).
- **Acceptance criteria:**
  - Tests across every race x discipline pair.
  - Id slug and `idTaken` cases, including empty, punctuation, unicode and 64-char limits.
  - No derived value is stored (no Step, Value or Karma max).
  - The Grimoire is present only for a magician.
  - A new character's available Karma equals its derived Max Karma (`converted` seeded as above; test per race, with and without the house cap).
  - Health ratings include the Discipline's Durability (Durability seeded at Rank 1).
  - A new Nethermancer has a non-null spells context with two empty Standard matrices.
  - With I4, the derived Legend is 0 earned / 0 spent / 0 available, including under the Karma-economy rule.
  - Every kit item resolves in the catalog.
  - The output passes the worker's `isValidCharacter` and `isValidId`.
- **Risks / unknowns:** none open; the shapes above were read from `data/characters/*.json` and `ui/ed-spells.js`.

### I2 — Starting-kit catalog items and skill `category` data
- **Covers tickets:** T8, T5 (data half)
- **Rules:** R5, R8, R9
- **Tier:** 3
- **What:** Add `Traveler's Garb` (8 sp, 3 lb, average), `Trail Rations (1 week)` (10 sp, 8 lb, average) and `Grimoire` (cost 0, weight 1 lb, average, homebrew) to `rules/items.json`.
- **Where:** `rules/items.json`; `tools/rules-conformance.test.js` and the item tests.
- **Approach:** copy the `Adventuring Kit` structure (`kind: gear`, `ref`, a `note` effect, `presentation`). The Grimoire's description states it is a house stat block. Use the exact item name string the builder seeds. Keep the existing cost and weight representation (`ref.cost` in silver, `weight.{amount,unit}`).
- **Skill `category` data (F1, decided; completed in round 2):** add a structured `category` to every `rules/skills.json` entry, owner-approved as Tier-3 data. Enum: `general`, `knowledge`, `artisan`, `language-speak`, `language-readwrite`.
  - **Classification source:** a rule-agent batch at the start of I2 (`NEEDS_RULES`), from the Player's Guide skill lists (Artisan, Knowledge and Language skills, and the Talents Available as Skills list for General). Never guessed from names. Both copies of a duplicated entry (`Bribery`, `Skinning`) get the same values; removing the duplicates is out of scope (flag it in build-log).
  - Artisan entries also carry `artisanKey`, equal to the exact `rules/disciplines.json` `artisanSkills` string (e.g. "Arrow Fletching" for "Arrow Fletching (Artisan)"; "Robe Embroidery" for itself). The Discipline-to-catalog join is then exact structured equality. Every `artisanSkills` string of the four Disciplines must resolve.
  - The generic template entries (`Knowledge`, `Artisan`, `Speak Language`, `Read/Write Language`) carry `generic: true`. A generic entry is picked with a free-text name and stored as `<Entry> (<text>)`; round 2 uses this for Knowledge, because per-language entries already cover the languages. The existing `store.js` lookup (~L1263: exact name, then the bracket-stripped base) resolves it, and the store hands the resolved `category` to the engine, so the engine never parses names. This reuses the existing lookup rather than adding a second parser.
  - Update `tools/rules-conformance.test.js` (and any skill validator) to check the fields. If any field needs a schema-tag bump or an `ed-skills/*` version change, STOP and re-ask the owner.
- **Dependencies:** none.
- **Acceptance criteria:** `rules-conformance` and item tests pass; values equal `rules.md` R8/R9; the schema tag is unchanged; every skill has a valid `category` and every artisan skill an `artisanKey` matching a discipline `artisanSkills` string (or is explicitly unlisted); every `artisanSkills` string of the four Disciplines resolves to exactly one `artisanKey`; the four generic templates carry `generic: true`.
- **Risks / unknowns:** whether `kind: gear` has a stricter required-field set for consumables (check `engine/validate-item.js`).

### I3 — Draft persistence (store layer)
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What (decided in round 2, G9):** a draft is a **base envelope plus the ordinary edits overlay**. The base (the I1 builder output) lives under its own key `ed-character-draft:<id>`. Every edit goes through the existing `save*Edits(…, id)` functions into `ed-character-edits:<id>`, exactly as for a saved character. When the id is a draft, `loadCharacter(id)` reads the draft base instead of the branch file, then applies the overlay as usual (`base` sha `null`).
  - `listDrafts()`, `saveDraft(character)` (writes the base), `loadDraft(id)`, `isDraft(id)`, `discardDraft(id)` (removes the base AND the overlay key), `renameDraft(oldId, newId, name)` (moves both keys, updates `meta.name`/`meta.id`).
  - `mergeRows(indexRows, draftRows)`: draft rows are flagged `draft: true`. The picker keeps its id sort (it re-sorts on render) and marks drafts with the badge.
- **Why this shape:** the overlay categories must cover a saved character that is still in creation anyway (I4), so one mechanism serves both. Every existing edit handler works unchanged, and `hasPendingEdits`, `reconcileOverlay` and the first-save path stay as they are.
- **Where:** `store.js` (or a new small `store-drafts.js` for testability, as with `store-export.js`/`store-server.js`); a new `store-drafts.test.js`.
- **Approach:**
  - On a successful first save: `reconcileOverlay` as usual, then remove the draft base key.
  - A corrupt base envelope is ignored and never blocks load (matches `loadEdits`).
- **Dependencies:** I1, I4 (overlay categories).
- **Acceptance criteria:** a draft (base + overlay) survives reload; a corrupt base is ignored; discard removes only the draft's base and overlay keys; saved-character overlays are untouched; rename moves both keys; the id-collision helper sees draft ids.
- **Risks / unknowns:** localStorage is unavailable in some privacy modes; match how `loadEdits` degrades. `loadCharacter`'s `base` is `null` for a draft, so the first save takes the create path.

### I4 — `creation` block in the character file (Tier 1, signed off) and Legend audit
- **Covers tickets:** T4
- **Rules:** R1, R3, R4, R5, R6, R7 (what counts as free; the Karma bonus derivation; free creation Karma; Legend 0)
- **Tier:** 1 — owner sign-off recorded in qa-log "2026-11-21 — TIER-1 SIGN-OFF". The build may proceed.
- **What:** An additive, optional top-level `creation` block on `ed-character/2`, inputs only:
  ```jsonc
  "creation": { "open": true,
    "free": { "talents": {"<Discipline>/<Talent>": rank}, "skills": {"<Skill>": rank}, "spells": ["<Spell>"] } }
  ```
  - `free` is the ledger of ranks granted free, which the audit subtracts. Attribute creation spending needs no ledger: it already lives in `attributes[n].points`. The leftover Max Karma bonus is not stored (F4): `deriveModel` computes it as `25 - cost(attributes[n].points)` only when `creation` exists and `open === false`.
  - `open: false` plus `free` remain after Finish, so the audit keeps treating those ranks as free forever.
  - Readers ignore the block when absent. The schema tag stays `ed-character/2`. No other top-level shape changes.
- **Where:** `engine/legend-spent.js` (`auditLegendSpent` subtracts free ranks; free ranks are priced in the same tier as the rank they came from, so subtract `cost(rank) - cost(freeRank)`, never cost-of-the-difference at a different tier). `store.js` (`deriveModel`, `forSave`, `applyEdits`, `SAVED_CATEGORIES`) and `ui/ed-app.js` (`_canAffordRank`, `_legendTotalEarnt`), per the Approach below. `ARCHITECTURE.md` §4.1 documents the block. Tests in `engine/legend-spent.test.js` and the store tests.
- **Approach:**
  - **Audit, free ranks.** `auditLegendSpent` takes `character.creation?.free`. A talent line costs `cost(rank) − cost(min(free, rank))`; the clamp means a rank lowered below its free ranks after Finish never goes negative. Skills work the same way, keyed by full stored name. A spell named in `free.spells` costs 0. When `creation` is absent, results are byte-identical to today.
  - **Audit, free Karma (round 2).** With `karmaRitualCost` set and a `creation` block present, the Karma sink is `max(0, converted − creationKarma) × cost`. `creationKarma` is the creation Max Karma: `min(modifier × 1, cap)` while open, `min(modifier × 1 + bonus, cap)` after Finish. Derived; nothing stored.
  - **Step prices stay equal to the audit (G7).** For characters with a `creation` block, the `increaseCost`/`refund`/`affordable` that `deriveModel` attaches (via `talentRankStepCost`/`skillRankStepCost`) equal `audit(after) − audit(before)`, either by computing them from the audit or by passing the free rank into the helpers. Either way the documented invariant holds. `_canAffordRank` passes the same audit options as `deriveModel` (`karmaRitualCost`, `spellCatalog`, `spellCostMultiplier`, `tierShift`, knacks), which also fixes the pre-existing mismatch between the guard and the display.
  - **Legend 0 (round 2).** When `creation` exists and there is no earned entry and no legacy `totalEarnt`, `deriveModel` derives `totalEarnt = 0` (so Available = 0 − spent), and `_legendTotalEarnt` mirrors it. Characters without a `creation` block keep today's placeholder behavior.
  - **Overlay categories (G6).** Add `attributes` (the whole `attributes` map, inputs only) and `creation` (the whole block) to `applyEdits` and `SAVED_CATEGORIES`, with `saveAttributeEdits`/`saveCreationEdits`. Add the missing `spells` to `SAVED_CATEGORIES`. Without it, `hasPendingEdits` ignores a spells edit and `reconcileOverlay` never clears it (pre-existing gap); add a regression test for an existing caster.
  - `forSave` passes `creation` through, so an open draft saved mid-creation resumes after reload.
  - The tier-1 gate: do not add fields beyond `open` and `free` without re-asking the owner.
- **Dependencies:** none at the engine level. Everything else in creation (I7-I9) depends on this.
- **Acceptance criteria:**
  - The schema tag stays `ed-character/2`.
  - Every existing character's audit totals are identical (regression test against `kolon`, `chakka`, `test-char`).
  - Creation ranks cost 0 Legend, and ranks above the free ledger cost normal Legend.
  - The seeded Durability/Karma Ritual cost 0; a free rank lowered after Finish never yields a negative cost.
  - With the Karma-economy rule on, a new character's Karma sink is 0, before and after Finish.
  - A creation character with no earned Legend derives 0/0/0; a character without a `creation` block and no earned total still shows the placeholder.
  - For every talent and skill row, `increaseCost`/`refund` equal `audit(after) − audit(before)`, with and without free ranks; `_canAffordRank` and the displayed Available agree, Karma and spell sinks included.
  - An attribute edit and a creation edit on a saved character survive reload through the overlay and are cleared by a successful save; a spells edit now marks the character dirty and reconciles.
  - `rules-conformance` and the worker's `isValidCharacter` still pass.
  - ARCHITECTURE §4.1 documents the block.
- **Risks / unknowns:**
  - The legacy `kolon.json`/`chakka.json` have no block and must be unaffected.
  - The additional-Discipline surcharge path (`additionalDisciplineTalentCost`) must also honor free ranks. A new character has one discipline, so only the first-Discipline path is needed at launch; the second path is left untouched and noted.

### I5 — Loader "Start a new character" section and name/race modal
- **Covers tickets:** T2
- **Rules:** none
- **Tier:** 3 (Tier-1 UI rules must hold)
- **What:**
  - `ed-character-picker` gains a "Start a new character" section below the list: one button per discipline with an inline "+" SVG glyph plus the discipline name. It is shown even with an empty character list.
  - Clicking opens a new kit-based modal `ui/ed-new-character.js` with a name input (required) and a race `<select>` fed from `rules/races.json`.
  - Enter confirms and Escape closes. An empty name blocks confirm.
  - Draft rows in the list show an "unsaved draft" badge and a Discard action via `ed-confirm`.
  - It dispatches `create-character {name, race, discipline}` and `discard-draft {id}` up.
- **Where:** `ui/ed-character-picker.js`, new `ui/ed-new-character.js`. Follow `docs/MODALS.md` and `ui/kit/` (`modalFrame`, `modalCss`, `ModalController`). Run `tools/check-ui-kit.mjs`. Disciplines and races are passed down as properties (data down).
- **Approach:**
  - Nest the new modal inside, or stack it over, the picker using `ui/kit/modal-stack.js` so Escape closes only the top one.
  - The id preview is optional; the resolved id (via I1 helpers) is computed in ed-app, not the view.
  - The Discard button must be keyboard reachable and must not trigger the row's `load-character`. A row becomes a container holding two sibling buttons (load, Discard), because a `<button>` cannot nest inside the row `<button>` (G10).
  - The new modal stacks above the picker (a layer above 2100, via `ui/kit/modal-stack.js`).
- **Dependencies:** I1 (helpers), I3 (draft rows).
- **Acceptance criteria:** Escape closes; Enter confirms; light and dark; two font weights only (400/500); keyboard reachable; empty name blocked; discard confirms and removes only the local draft; works on an empty store; no hardcoded colors; relative paths only.
- **Risks / unknowns:** the picker is a `picker`-kind modal whose Enter activates the focused row. The "+" buttons and the Discard action sit in the same focus order, so the Enter contract needs a test and an explicit `docs/MODALS.md` check.

### I6 — Draft wiring and first Save in `ed-app`
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:**
  - Pre-check (modal, I5): the modal is given the taken ids (index plus drafts, data down). If the slug of the typed name is taken, the modal shows an inline warning ("A character with this name already exists — choose a different name"), disables the primary action, and never dispatches `create-character`. Handle `create-character` only for a free id: `buildNewCharacter`, store the draft, load it, and enter edit mode. `ed-app` re-checks defensively and refuses on a clash.
  - Handle `discard-draft`.
  - Startup: merge draft rows into the picker list. Remove the empty-store `_error`. If the index is empty or missing, open the picker with the new-character section; do not show an error.
  - Edits to a draft go through the ordinary `save*Edits` overlay (I3); the edit handlers have nothing draft-specific.
  - First `_doSave` of a draft first RE-CHECKS the id (F5, requirement): re-fetch a fresh index (and use a draft-aware check) and, if the id is now taken on the branch, STOP: nothing is posted and a rename modal (kit-based, same warning wording) asks the player to rename the character. On a new name the draft is re-keyed (id re-slugged, `meta.name`/`meta.id` updated, draft envelope moved) and the check runs again; Escape/cancel leaves the draft unsaved. If the check passes it posts with `base: null` and calls `saveServer`; on success it clears the draft, sets `_baseSha` from the returned sha, and refreshes the loader rows. The draft id is then a normal saved id.
  - The dirty-switch guard (`_confirmSwitch`) applies to drafts. **Autosave and flush-on-hide skip a draft** (planner default, G6): the first Save is always manual, so the first-Save id re-check and its rename modal never run inside a silent save. After the first Save the character is a normal saved character (still in creation) and autosaves as usual through the I4 overlay categories.
  - A loaded draft is always dirty (`_dirty = true`, not `hasPendingEdits`).
  - "Discard local changes" is hidden for a draft; the picker's Discard is the draft path (G10).
  - `_initialId` accepts a draft id from the saved `ed-character` selection, so a reload reopens the draft.
- **Where:** `ui/ed-app.js` (`firstUpdated`/startup ~L496, `_loadCharacter`, `_pickCharacter`, `_doSave`, `_markDirty`), `store.js`.
- **Approach:**
  - A draft is "always dirty" (no branch file), so `_dirty` is true until the first save.
  - If the first save returns a `stale_base` conflict (impossible with a null base but guard for the legacy path), reuse the conflict modal.
  - `index.json` missing: `listCharacters` currently throws on a missing index off-Pages (`loadJSON` error). A missing index with drafts must still list the drafts. Tolerate the missing-index case without weakening the "no legacy fallback" decision.
- **Dependencies:** I1, I3, I4, I5.
- **Acceptance criteria:**
  - Reload keeps the draft.
  - Save creates the file and the index row (verified via `store-server` and dev-server tests).
  - After a save the draft is cleared and the character loads normally.
  - A 409/overwrite behavior is unchanged for existing characters.
  - Discard leaves the branch untouched.
  - Switching away from a dirty draft prompts, and the draft survives.
  - Autosave and flush-on-hide never post a draft; a reload reopens the selected draft; "Discard local changes" is not offered on a draft.
  - **Id race (F5):** a test simulates the index gaining the draft's id between draft creation and first Save: the save is blocked with the rename warning, posts nothing, never overwrites the existing character, and after a rename saves under the new id. Also a modal-level test: a name whose slug matches an index or draft id shows the warning and cannot be submitted.
  - **Error handling (F6):** a real load failure (network error, malformed index) still shows an error; only a genuinely empty or missing index opens the picker with the new-character section. Tests cover both.
  - **Portrait-less index row (F6):** `store-server.test.js` and `tools/dev-server.test.js` assert the create-only index row for a new character (no portrait) is what the worker writes, and a picker test asserts such a row renders without a portrait.
- **Risks / unknowns:**
  - Resolved: a draft never autosaves before its first manual Save (above).
  - The id may be taken on the branch by another device between create and first Save. The worker would overwrite, because `base: null` skips the stale check. Mitigated by the required index re-check and rename warning at first Save (above); the residual window between the re-check and the post is accepted by the owner ("extremely low" risk, 2026-11-21). No worker change.

### I7 — Creation-mode allotment engine (pure)
- **Covers tickets:** T5, T6 (engine half)
- **Rules:** R1, R2, R3, R5, R6
- **Tier:** 3 (depends on I4)
- **What:** Pure helpers in `engine/creation.js`.
  - `talentBudget`: 8 points over the Discipline's circle-1 `talents` only (not free talents, not the Talent Option, not the seeded Durability/Karma Ritual), Rank 0..3 each. Raising from 0 adds the stored row; lowering to 0 removes it.
  - `attributeBudget`: 25 points over `base` using the `pointCost` table, range -2..+8 over racial; lowering refunds. Returns points left and the leftover that becomes Karma.
  - `skillBudget`: fixed free ranks (Knowledge 2, Artisan 1, Speak Language 2, Read/Write 1) plus 8 extra, General skills from the 8 Novice-tier only, total rank <= 3 per skill including fixed ranks. Round-2 mapping:
    - Each language is its own Rank-1 entry: Speak Language 2 = two entries, Read/Write 1 = one. Language entries stay at Rank 1; each further language costs 1 of the 8.
    - The Artisan pick comes from the Discipline's `artisanSkills` (joined by `artisanKey`); anything else is refused.
    - Knowledge picks are `Knowledge (<text>)` entries.
    - A pick consumes its category's fixed ranks first, then the 8.
    - Categories arrive pre-resolved from the store (I2); the engine never parses names.
  - `spellBudget` (magicians): points = Perception Step (derived from the model, never stored), and each spell costs its Circle. Candidates are the Discipline's Circle 1–2 spells read from `rules/spells.json` `discipline`/`circle`, independent of talent ranks (round 2: no Spellcasting/Thread Weaving prerequisite, no learning roll, no silver). Circle-2 spells are known but not placeable in a matrix at Circle 1 (R6). The two Standard Matrices come from the free talents and the I1 seed.
  - Each returns `{spent, left, valid, canRaise(name), canLower(name)}` and the next `creation.free` ledger value for a requested change. Refusals return the unchanged state. `valid` is false when spent exceeds the budget, e.g. Perception lowered after spells were picked (G11). That state is shown, never auto-corrected, and blocks Finish.
- **Where:** new `engine/creation.js` plus `engine/creation.test.js`; reads `rules/attributes.json`, `rules/skills.json`, `rules/spells.json`, `rules/disciplines.json`.
- **Approach:**
  - Read structured data; do not parse display strings (Tier-1 architecture rule). Skill categories come from the new `category` field and artisan picks from `artisanKey` (I2). Spell Discipline and Circle are structured fields in `rules/spells.json` (`discipline`, `circle`; verified in round 2).
  - The attribute step is derived from the value, never stored.
- **Dependencies:** I2 (`category`, `artisanKey`, `generic`), I4.
- **Acceptance criteria:**
  - Budgets enforced by the engine, not the UI.
  - The cost table matches R3 (+1=1 ... +8=15).
  - Per-skill and per-talent caps hold.
  - Non-magicians get no spell budget.
  - Perception Step comes from the derived model.
  - Full test coverage including refunds and boundary values.
  - An over-spend caused by a later attribute change yields `valid: false`, not a silent correction.
  - Language entries cannot exceed Rank 1; an Artisan pick outside the Discipline list is refused.
- **Risks / unknowns:**
  - Resolved in round 2: the Artisan source list, the language mapping and the Knowledge naming. The numeric `tier` field (1 = Novice) already exists; `category` is added in I2.

### I8 — Creation-mode UI in existing tabs
- **Covers tickets:** T5, T6 (UI half)
- **Rules:** R1, R3, R5, R6
- **Tier:** 3
- **What:**
  - While `creation.open`, Disciplines-tab talent steppers and skill steppers spend free points, the Overview attribute steppers spend attribute points, and the Spells tab shows a spell step (magicians only). Legend pricing and the "Advance Circle", "+ Add Discipline", "+ add option" (Talent Option) and "+ add knack" controls are hidden while creation is open.
  - A "points left" chip shows on each tab.
  - **Talent rows (new UI, G8):** the Disciplines tab lists all five Circle-1 Discipline Talents, including unrecorded Rank-0 ones, each with a 0..3 stepper. The existing stepper (floor Rank 1, stored talents only) is not reused here; a new creation event and handler sit beside `_editTalentRank`.
  - **Skill step:** skills are added and removed free (no Legend, no silver fee). A generic entry (Knowledge) asks for a name and stores `Knowledge (<text>)`; the Artisan list is the Discipline's `artisanSkills`; languages are picked as Rank-1 entries.
  - **Spell step:** a free picker on the Spells tab listing the Discipline's Circle 1–2 spells (no roll, no silver), with the spell-points chip.
  - **Placement:** while creation is open, a creation bar replaces the Legend bar (`_legendBar`) on the Disciplines tab. It holds the talent and skill points-left chips and the Finish creation button. The Overview shows only the attribute-points chip, and the Spells tab the spell-points chip. An over-spent chip uses an existing theme-aware warning token.
  - Placeholders and pills stay as today.
  - Views only dispatch; `ed-app` handlers call the I7 engine, persist the draft, and re-derive.
- **Where:** `ui/ed-disciplines.js`, `ui/ed-overview.js`, `ui/ed-spells.js`, `ui/ed-app.js` (new handlers beside `_editTalentRank`/`_editSkillRank`), `store.js` `deriveModel` (expose `model.creation` budgets as data-down). Skills live in the Disciplines tab; the fixed free ranks are player picks (I7), never auto-seeded.
- **Approach:**
  - **Attribute steppers are NEW UI (F2).** `ui/ed-overview.js` has no attribute editing today (`points`/`increases` are not referenced). Talent and skill steppers reuse the existing markup; the attribute steppers are added inside the existing attribute cell (compact -/+ controls beside the value, no new row or column), shown only while `creation.open`. A saved non-creation character shows no new controls. Update `docs/UI-GUIDELINES.md` (Overview attribute cell, creation chip). The sign-off covers the `creation` data block only; because this adds controls to a Tier-1 surface (the Overview), the build flags it for the owner at review, and stops to ask if the cell cannot hold them without breaking the no-scroll rule.
  - After Finish, `attributes[n].points` is locked (steppers hidden); later attribute gains use `increases` and Legend.
  - The chip uses the existing chip style, theme-aware, weights 400/500 only.
  - Overview fit, light/dark and mobile layout are MANUAL owner verification items (not assertable by `npm test`); the build lists them for the owner to check.
- **Dependencies:** I4, I6, I7.
- **Acceptance criteria:**
  - Steppers cost zero Legend and the Available Legend stays 0.
  - Budgets block over-spend.
  - Derived values remain placeholder pills where unresolvable.
  - Light and dark OK; Overview fits the viewport; mobile folds to one column.
  - A saved non-creation character looks and behaves exactly as before.
  - The creation steppers and the skill and spell steps never touch `wealth`.
- **Risks / unknowns:** the Overview viewport (compacted attribute grid near L940) is the tightest Tier-1 constraint.

### I9 — Finish creation
- **Covers tickets:** T7
- **Rules:** R3, R4, R10
- **Tier:** 3 (depends on I4)
- **What:**
  - A "Finish creation" action, visible only while `creation.open` and enabled only when every I7 budget is `valid` (otherwise it names the over-spent budget).
  - An ed-confirm lists unspent talent, skill and spell points and states that they are forfeited.
  - On confirm: set `creation.open = false`, keep the `free` ledger, and add the derived leftover attribute bonus to `resources.karma.converted` (an ordinary ledger gain, so current Karma stays full at the new Max). Nothing derived is stored in `creation`; the Max Karma derivation reads the bonus from `attributes[n].points` (I4), which are locked after Finish.
  - After this, steppers use Legend pricing and the Legend audit shows Available 0.
- **Where:** `ui/ed-app.js` handler, a pure `finishCreation(character, rules)` in `engine/creation.js`, `store.js` Karma-max derivation (~L1197, compute min(modifier × Circle + bonus, cap): the bonus goes inside the cap, not after `maxKarma`), `ui/ed-confirm.js` usage.
- **Approach:**
  - Max Karma = min(race modifier × Circle + derived leftover bonus, `karma.maxCap`) (round 2: the cap applies to the total). Without the house cap: modifier × Circle + bonus.
  - Karma mechanism (decided, F3): `converted` is seeded at build (I1) to the creation-time max and raised by the bonus at Finish, never inflated. A test confirms current = max before and after Finish, and `converted` after Finish = modifier x Circle + bonus.
  - Escape cancels; Enter confirms.
- **Dependencies:** I4, I7, I8.
- **Acceptance criteria:** after finish, Legend pricing applies; the audit shows Available 0; Karma max includes the derived leftover points and `attributes[n].points` are locked; a refused or cancelled confirm changes nothing; Escape and Enter honored; re-running Finish is a no-op; Finish is refused while any budget is over-spent; under the Karma-economy rule the Karma sink stays 0 after Finish; a Troll's Max Karma respects the race cap (3 + 25 unspent → 20).
- **Risks / unknowns:** none open (the cap is decided). Finish writes `resources.karma.converted`, an existing ledger input, not a new field; under the Karma-economy rule, I4 keeps that Karma free.

### I10 — Docs, tests, changelog
- **Covers tickets:** T9
- **Rules:** none
- **Tier:** 3
- **What:**
  - Update `docs/UI-GUIDELINES.md` (loader section, creation chip, Finish action), `ARCHITECTURE.md` §4.1 (the `creation` block) and §7 (draft persistence), `docs/RULES-FAQ.md` (verification only, F7), and `README.md` if it lists features.
  - `data/changelog.json` unreleased entry.
  - Tests: builder, draft store, allotments, finish, audit regression, picker, worker create path via `store-server.test.js`.
- **Where:** the docs named above; `data/changelog.json`; tests alongside each module.
- **Approach:** run `npm test` including `check-ui-kit` and `check-imports`. `docs/RULES-FAQ.md` Q039/Q040 (working tree) already carry every round-1 Decision, including the skill cap and the Grimoire stats (round-2 check, G13). The rule-agent records the round-2 Decisions in sequencing step 0, not here; I10 only verifies.
- **Dependencies:** all.
- **Acceptance criteria:** `npm test` green; docs match code; the PR checklist from `docs/GUARDRAILS.md` is satisfied.
- **Risks / unknowns:** none beyond the uncommitted RULES-FAQ edit.

## Sequencing
0. **Before the build (owner and orchestrator):** the rule-agent records the round-2 Decisions on RULES-FAQ Q039; the owner commits `docs/RULES-FAQ.md` and this plan folder, so the build starts from them.
1. **I2** (data: catalog items and skill `category`/`artisanKey`/`generic`; the rule-agent classification batch runs first).
2. **I4** (Tier-1 block, free-aware audit and pricing, free Karma, Legend 0, overlay categories; the regression for existing characters lands first).
3. **I1** (builder engine; needs I2 and I4).
4. **I3** (draft base + overlay; needs I1 and the I4 overlay categories).
5. **I7** (allotment engine; needs I2 and I4).
6. **I5** (loader UI and modal; needs I1 and I3).
7. **I6** (ed-app wiring and first Save; needs I1, I3, I4, I5).
8. **I8** (creation-mode UI; needs I4, I6, I7).
9. **I9** (Finish; needs I7 and I8).
10. **I10** (docs, tests and changelog; tests are written with each item and consolidated here).

Rationale: pure engine and data first, so each UI layer is tested against stable APIs. The Tier-1 block and every audit and derivation change land early, in a change that provably leaves existing audits unchanged. The loader and save wiring give an end-to-end "create, save, reload" slice before the larger creation-mode UI. Until I9 lands, exercise that slice against `tools/dev-server.mjs`, not the live `character-data` branch, so no half-built character lands there (G15).

## Open questions
None. Round 2 settled the Artisan list, the language and Knowledge picks, and (as a planner default the owner may override) draft autosave.

## Review responses
- **F1 (skill categories):** fixed. Structured `category` plus `artisanKey` added to `rules/skills.json` in I2 as owner-confirmed Tier-3 data; exact-equality artisan join; language/Knowledge picks follow the existing character shape; stop-and-re-ask on a schema-tag bump.
- **F2 (attribute steppers):** fixed. I8 states they are new UI in the existing attribute cell with no new row, a UI-GUIDELINES update, and Overview fit/light-dark/mobile as manual owner verification.
- **F3 (Karma starts full):** fixed. `converted` seeded at build to modifier x Circle and raised by the derived bonus at Finish; ledger meaning preserved; specified in I1 and I9 with tests.
- **F4 (`karmaBonus`):** fixed per owner answer. Field dropped; bonus derived in `deriveModel` when `creation.open === false`; `attributes[n].points` locked after Finish.
- **F5 (first-Save id race):** fixed. Index re-check before the first post is a requirement of I6 with an acceptance test. Revised by the owner (qa-log 2026-11-21): no auto-suffix; a clash blocks with a rename warning at the modal and at first Save.
- **F6 (missing index, portrait):** fixed. I6 acceptance criteria add real-error-still-surfaces tests and a portrait-less index row test in store-server/dev-server plus a picker render test.
- **F7 (RULES-FAQ):** fixed. Q039/Q040 already hold most house Decisions; I10 limited to verification plus the two possibly-missing lines.

Round 2 (owner-requested review, 2026-11-21; findings in `review.md` Round 2, decisions in qa-log):
- **G1 (starting Karma charged as Legend):** fixed per owner. I4 makes creation Karma free under the Karma-economy rule; I1 seeds `converted`; I9 caps the total.
- **G2 (Legend 0/0 has no stored form):** fixed per owner. I4 derives 0 while the block exists; I1 writes `legend: {earned: []}`.
- **G3 (Durability missing):** fixed per owner. I1 seeds Durability and Karma Ritual at Rank 1 in the free ledger.
- **G4 (Spells tab unreachable):** fixed. I1 seeds two empty Standard matrices; owner: I7/I8 free pick from `rules/spells.json`, no prerequisite.
- **G5 (skill picks have no path):** fixed per owner. I2 adds the classification source and `generic`; I7 maps languages, Artisan and Knowledge; I8 adds the skill step.
- **G6 (overlay coverage, draft autosave):** fixed. I4 adds the `attributes`, `creation` and `spells` categories; I6 skips autosave for drafts.
- **G7 (step prices ignore free ranks):** fixed. I4 keeps pricing equal to the audit and aligns `_canAffordRank`.
- **G8 (creation steppers are new UI):** fixed. I8 specifies the Rank-0..3 talent rows.
- **G9 (I3 write routing deferred):** fixed. I3 uses a draft base + the ordinary overlay.
- **G10 (draft-hostile controls):** fixed. I5 uses sibling buttons; I6 hides Discard local changes and reopens drafts.
- **G11 (stale budgets):** fixed. I7 `valid`; I9 Finish precondition.
- **G12 (magician signal, attribute key):** fixed. I1 uses Spellcasting and `order`.
- **G13 (stale FAQ note):** fixed. I10 verifies only; sequencing step 0.
- **G14 (dependency lists):** fixed. I3, I6, I7, I8 and the sequence updated.
- **G15 (half-built characters on the live branch):** fixed. Sequencing note.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
