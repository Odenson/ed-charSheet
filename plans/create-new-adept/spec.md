# Tech Spec: Create new adept (create-new-adept)

## Overview
Add a "Start a new character" section to the loader that builds a Circle-1 draft
`ed-character/2` (pure `engine/new-character.js`), keeps it in localStorage as a
**base envelope plus the ordinary edits overlay** (`store-drafts.js`), and lets the
existing tabs spend the creation allotments through a pure allotment engine
(`engine/creation.js`) until "Finish creation". The one Tier-1 change is an
additive optional `creation` block, `{ open, free }`, on `ed-character/2`; a
free-rank ledger makes the Legend audit, the step prices, Starting Karma and
Legend 0/0 all derive correctly. The first manual Save creates the file and index
row through the existing worker with `base: null` (no worker change).

All line numbers below were checked against the tree on 2026-11-21 and are
approximate anchors; grep the named symbol.

## Guardrail alignment
Skill **ed-change-guardrail** applied; tiers per `docs/GUARDRAILS.md`.

| Change | Tier | Note |
|---|---|---|
| `creation` block on `data/characters/<id>.json` (exactly `open` + `free`) | **1** | Owner sign-off: `qa-log.md` "2026-11-21 — TIER-1 SIGN-OFF". `schema` stays `ed-character/2`. |
| `rules/skills.json` fields `category`, `generic`, `artisanKey`; tier of Impressive Display and Tactics -> 2; three `rules/items.json` entries | 3 | Same ruling as `category` (qa-log "Add `category` data"). `ed-skills/1` and `ed-items/3` tags unchanged. |
| `engine/new-character.js`, `engine/creation.js`, `engine/legend-spent.js` / `engine/characteristics.js` additions | 3 | Pure, DOM-free, read structured data, store only inputs. |
| `store.js`, `store-drafts.js`, `store-first-save.js` (overlay categories, drafts, list/404 handling) | 3 | localStorage and store plumbing, not file shape. |
| `ui/ed-character-picker.js`, `ui/ed-new-character.js`, `ui/ed-disciplines.js`, `ui/ed-overview.js`, `ui/ed-spells.js`, `ui/ed-app.js` | 3 | Must honor the Tier-1 UI contract; Overview additions are edit-mode only and flagged for owner verification. |
| `ARCHITECTURE.md` 4.1 and 7.1, `docs/UI-GUIDELINES.md`, `docs/MODALS.md` | 3 | Docs describe new surfaces; no existing rule is relaxed. |

Confirmed: data flows down through render and `model.creation`; every game value
(budgets, costs, Karma, Perception-derived spell points) is computed in the engine
and arrives as data; views only dispatch `ed-creation-edit`, `ed-creation-finish`,
`create-character`, `discard-draft`, `rename-draft`. The engine stays pure and
reads structured data (`category`, `artisanKey`, `generic`, `tier`, spell
`discipline`/`circle`, discipline `circles[].talents`). It never parses names; the
existing `Name (Spec)` lookup stays in `store.js` and is handed to the engine as
`ctx.resolveSkill`. Only inputs are stored (`creation` holds no Karma bonus,
budget totals, steps or costs). Derived pills (Step, Karma max, Legend) stay
placeholder pills where unresolvable.

**Stop conditions (do not design around; raise `NEEDS_HUMAN` and stop the build):**
any field in `creation` beyond `open` and `free` (and `free` beyond
`talents`/`skills`/`spells`); any `schema` tag change (`ed-character/*`,
`ed-skills/*`, `ed-items/*`); any Tier-2 taxonomy edit; the Overview attribute cell
cannot hold the stepper without breaking the no-scroll rule (plan I8).

No Tier-1 item was found that the plan missed. No `NEEDS_RULES` (R1-R11 cover every
value; see Rules).

## Delivery slices (ordered; one commit each, `npm test` green at each)
Run 1 = Slice A (no UI; all testable with `node --test`). Run 2 = B1-B2 (create,
save, reload slice; exercise against `tools/dev-server.mjs`, never the live
`character-data` branch). Run 3 = B3-B5. A run may stop at any step boundary.

| Step | Plan item | Files | Tests (all `node:test`, no DOM) |
|---|---|---|---|
| **A1** | I2 | `rules/skills.json`, `rules/items.json` | extend `tools/rules-conformance.test.js` (skills data); new `tools/rules-starting-kit.test.js` |
| **A2** | I4 | `engine/creation.js` (helpers only), `engine/legend-spent.js`, `engine/characteristics.js`, `store.js`, `ui/ed-app.js` (`_canAffordRank`, `_legendTotalEarnt` only), `ARCHITECTURE.md` 4.1 | new `engine/legend-spent-creation.test.js`, `store-creation-audit.test.js`, `store-overlay-creation.test.js`; extend `engine/characteristics.test.js` |
| **A3** | I1 | `engine/new-character.js` | new `engine/new-character.test.js`; extend `tools/dev-server.test.js`, `store-server.test.js` |
| **A4** | I3 | `store-drafts.js`, `store.js` (exports, `loadJSON` status, `listCharacters`), `store-first-save.js` | new `store-drafts.test.js`, `store-first-save.test.js`, `store-list-characters.test.js` |
| **A5** | I7 + model + pure finish | `engine/creation.js` (budgets, apply, finish), `store.js` (`creationContext`, `model.creation`, `persistCreationEdit`) | new `engine/creation.test.js`, `store-creation-model.test.js` (includes the walkthrough) |
| **B1** | I5 | `ui/ed-character-picker.js`, `ui/ed-new-character.js` | none (DOM); pure `validateNewName` already tested in A3; manual list below |
| **B2** | I6 | `ui/ed-app.js` (startup, drafts, first Save, rename) | seams tested in A4; manual list |
| **B3** | I8 | `ui/ed-disciplines.js`, `ui/ed-overview.js`, `ui/ed-spells.js`, `ui/ed-app.js` (`_creationEdit`), `docs/UI-GUIDELINES.md` | engine/store tests from A5; manual list |
| **B4** | I9 | `ui/ed-app.js` (`_finishCreation`, `ed-confirm`), `ui/ed-disciplines.js` (Finish button) | engine/store tests from A5; manual list |
| **B5** | I10 | `docs/UI-GUIDELINES.md`, `docs/MODALS.md`, `ARCHITECTURE.md` 7.1, `data/changelog.json`, `docs/RULES-FAQ.md` (verify only) | full `npm test` incl. `check-ui-kit`, `check-imports` |

Deliberate tweaks to plan sequencing: (1) `finishCreation`/`finishPlan` are written
in A5 with the allotment engine (pure, testable) and I9 only wires them; (2)
`model.creation` and `persistCreationEdit` land in A5 so the whole creation flow
is covered by store-level tests before any UI exists; (3) the three tiny
`engine/creation.js` helpers the audit needs (`karmaBonus`, `creationKarma`,
`attributePointCost`) are created in A2 so A2 is self-contained.

## Design

### Data / types

**`creation` block** (the only Tier-1 shape; optional, top-level):
```jsonc
"creation": { "open": true,
  "free": { "talents": { "<Discipline>/<Talent>": <int>=1> },
            "skills":  { "<stored skill name>": <int>=1> },
            "spells":  [ "<catalog spell name>" ] } }
```
Key sets are exact and tested (`Object.keys` equality) on every producer:
`buildNewCharacter`, every `apply*`, `finishCreation`. Absent block = byte-identical
behaviour to today. Schema stays `ed-character/2`.

**`creation.free` ledger semantics (normative):**
1. `free.talents[k] = f` / `free.skills[k] = f` means the first `f` ranks of that
   ability were granted free (0 Legend). `f` is a count of ranks `>= 1`; a zero is
   deleted, never stored. Talent key = `` `${disciplineName}/${talentName}` ``;
   skill key = the full stored skill name (e.g. `Knowledge (Barsaive History)`).
2. `free.spells` lists catalog-canonical spell names whose learn cost is 0 whatever
   the homebrew multiplier. Matching is apostrophe-insensitive (same normalisation
   as `engine/legend-spent.js` `normSpellName`).
3. While `open === true`, every ability changed through creation has
   `free[k] === its stored rank` (everything bought in creation is free). Seeded
   `Archer/Durability: 1` and `Archer/Karma Ritual: 1` are written by the builder
   and are not steppable in creation.
4. Only `engine/creation.js` apply functions and `buildNewCharacter` write the
   ledger. After Finish (`open: false`) nothing writes it again.
5. Audit, first Discipline only (`ordinal === 1`): talent line cost =
   `cum(rank) - cum(min(free, rank))` at the talent's own tier; skill line =
   same with the skill table and stored tier; spell in `free.spells` costs 0.
   Ranks `<= free` cost 0; ranks above cost the normal step; lowering below `free`
   never refunds and never goes negative; raising back up to `free` is free again.
   Keys for a Discipline at `ordinal > 1` are ignored (second-Discipline path is
   untouched; a new character has one Discipline).
6. Free Karma: with `opts.karmaRitualCost` set and a `creation` block present the
   Karma sink is `max(0, converted - opts.creationKarma) x cost`, where
   `creationKarma = maxKarma(modifier, 1, cap, karmaBonus)`. If
   `opts.creationKarma` is not finite, nothing is charged.
7. Attribute creation spending is **not** in the ledger: it is
   `attributes[n].points` (the value raise over racial; cost by the
   `rules/attributes.json` `pointCost` table, `[{points, cost}]`, cumulative).
8. Max Karma bonus is derived, never stored: `karmaBonus = max(0, 25 - sum cost(points))`
   only when `creation` exists and `open === false`; otherwise 0. `converted`
   (an existing ledger input) is seeded to `K0 = maxKarma(mod, 1, cap, 0)` and
   raised at Finish by `maxKarma(mod, 1, cap, bonus) - K0` (so a Troll with 25
   unspent: 3 + 17 = 20, never 28), keeping `converted - creationKarma === 0` and
   the Karma sink 0 before and after Finish.
9. Legend 0: while `creation` exists and there is no legacy `totalEarnt` and no
   `earned` entry, `totalEarnt` derives as 0 (so Available = 0 - spent = 0). No
   stored form; characters without `creation` keep today's placeholder.

**Draft envelope** (localStorage only, not a file shape):
`ed-character-draft:<id>` = `{ "v": 1, "createdAt": "<ISO>", "character": <ed-character/2> }`.
Edits keep using `ed-character-edits:<id>` (`SAVED_CATEGORIES`). Corrupt or `v !== 1`
envelopes read as absent.

**New overlay categories** (`store.js` `SAVED_CATEGORIES`, `applyEdits`):
`attributes` (whole `attributes` map), `creation` (whole block), and the existing
gap `spells` (merged by `applyEdits` today but missing from `SAVED_CATEGORIES`).
Existing characters never write the first two.

**`rules/skills.json`** (all 154 entries; values exactly `rules.md` R11):
`category` in `general | knowledge | artisan | language-speak | language-readwrite`
(counts 106 / 2 / 22 / 12 / 12); `generic: true` on exactly `Knowledge`, `Artisan`,
`Speak Language`, `Read/Write Language`; `artisanKey` on the 21 `artisan` entries
except the `Artisan` template (= catalog name minus a trailing ` (Artisan)`);
`tier: 2` on `Impressive Display` and `Tactics` (tier counts become 1:116, 2:31,
3:7; `category: general && tier: 1` = 68). Both copies of `Bribery` and `Skinning`
get identical values; the duplicates stay (flag in build-log).

**`rules/items.json`** (`kind: "gear"`, shape of `Adventuring Kit`: `ref`
`{cost, weight:{amount,unit}, availability, description}`, one `note` effect,
`presentation.shortEffect` <= 32 chars): `Traveler's Garb` (8, 3 lb, average),
`Trail Rations (1 week)` (10, 8 lb, average), `Grimoire` (0, 1 lb, average; the
description says it is a house stat block).

**New derived model slice** `model.creation` (see Modules, A5); also
`model.legendAuditOptions` (the exact `opts` object `deriveModel` passes to
`auditLegendSpent`, `knacks` included).

**New store/localStorage surface:** key prefix `ed-character-draft:`; no other new
keys. Per-id device-local keys `ed-rolllog:<id>` and `ed-discord:<id>` are not
migrated on rename (a draft has none until played; accepted) and are cleared on
discard by the `ed-app` handler.

### Modules & functions

#### A1 — data (I2)
`rules/skills.json`, `rules/items.json` as above. Classification comes from
`rules.md` R11 (already the rule-agent batch; do not re-derive). Tests:
`tools/rules-conformance.test.js` gains a skills block (every entry has a valid
`category`; counts above; `generic` on exactly the four; `artisanKey` on exactly 21
and equals name-minus-suffix; each of the eight Discipline `artisanSkills` strings
(Archer Arrow Fletching, Wood Carving; Nethermancer Bone Carving, Robe Embroidery;
Thief Acting, Poetry; Warrior Sculpting, Rune Carving) resolves to exactly one
`artisanKey`; tier counts; Impressive Display and Tactics `tier: 2`; schema tag
`ed-skills/1`). `tools/rules-starting-kit.test.js`: the three entries exist, values
equal R8/R9, `validateItem(name, item).ok` (from `engine/validate-item.js`),
`Adventuring Kit` and `Dagger` still present.

#### A2 — Tier-1 block, audit, pricing, Legend 0, Karma, overlay (I4)
Step 0 of A2, before editing any engine file: add golden tests that pin today's
output (run the unmodified engine to capture) for inline fixtures modelled on
kolon-v2, chakka and test-char (multi-Discipline, skills, spells, Karma ledger with
`karmaRitualCost`, additional-Discipline tier shift). `data/characters/` is
gitignored, so fixtures are inline literals; no test may read that folder.

- **`engine/creation.js` (new, A2 subset):**
  - `export const CREATION_RULES = { talentPoints: 8, talentMaxRank: 3, attributePoints: 25, skillExtraRanks: 8, skillMaxRank: 3, languageMaxRank: 1, skillFixed: { knowledge: 2, artisan: 1, 'language-speak': 2, 'language-readwrite': 1 }, spellCircles: [1, 2] }`
  - `freeKey(discipline, talent) -> string`
  - `attributePointCost(points, attributesFile) -> number|null` (exact table lookup; `null` outside the table; range is the table's min/max `points`, which equals the R3 house cap -2..+8)
  - `attributeLeftover(character, attributesFile) -> number|null` (`25 - sum`; `null` if any attribute is unpriceable)
  - `karmaBonus(character, attributesFile) -> number` (0 unless `creation.open === false`; 0 when unpriceable or table missing)
  - `creationKarma(character, { karmaModifier, karmaMaxCap, attributesFile }) -> number|null` (`maxKarma(mod, 1, cap, karmaBonus)`; null when no modifier)
- **`engine/characteristics.js`:** `maxKarma(karmaModifier, circle, maximum = null, bonus = 0)`: `base = karmaModifier * circle + bonus`, then `min(base, maximum)`. Callers that omit `bonus` are unchanged.
- **`engine/legend-spent.js`:**
  - Shared helper (module-private) `netRankCost(rank, free, cumFn)` = `cum(rank) - cum(min(free, rank))` with the same null propagation the audit already has.
  - `talentRankStepCost(t, ordinal, lowestCircle, costs, toRank, opts)`: new `opts.freeRank` (ordinal 1 only) so step = `net(toRank) - net(toRank - 1)`, identical to `audit(after) - audit(before)`.
  - `skillRankStepCost(s, costs, toRank, opts = {})`: new `opts.freeRank`, same rule.
  - `auditLegendSpent(character, costs, opts)`: reads `character.creation?.free` per the ledger semantics, and `opts.creationKarma`. Line `detail` gains ` · N free` when free ranks apply (display only). Karma section: for a `creation` character use `paid = max(0, converted - creationKarma)` for the total and the historic line; otherwise unchanged.
- **`store.js`:**
  - `export function homebrewSetsFor(homebrewFile, raceName)` (the existing `homebrewSets` block lifted out of `deriveModel`; `deriveModel` calls it; behaviour identical).
  - `export function makeSkillRef(skillsFile)` returning the existing lookup (exact name, then bracket-stripped base) used as `skillRef`; `deriveModel` uses it. This is a move, not a second parser.
  - `maxKarma(karmaMod, highestCircle, cap, karmaBonus(character, rules.attributesFile))`.
  - `legendAuditOptions = { knacks, threadItemCatalog, spellCatalog, spellCostMultiplier, karmaRitualCost, tierShift, creationKarma }` built once, passed to `auditLegendSpent`, exposed as `model.legendAuditOptions`. `creationKarma` is set only when `character.creation` exists.
  - Legend: `totalEarnt = legendEarned.length ? sum : (character.creation ? 0 : null)`.
  - Pricing block: pass `freeRank` from `character.creation.free` (`talents[disc/name]` for `di === 0`, `skills[s.name]`) into the step helpers.
  - `loadRules()` adds `attributesFile` via `loadJSONOptional('./rules/attributes.json', null)`; `deriveModel` must keep working when `rules.attributesFile` or `rules.spellsFile` is undefined (existing tests omit them).
  - `saveAttributeEdits(attributes, id)`, `saveCreationEdits(creation, id)`; `applyEdits` merges `edits.attributes` (replace) and `edits.creation` (replace); `SAVED_CATEGORIES` += `'spells'`, `'attributes'`, `'creation'`. `forSave` needs no change (it spreads) but is asserted to carry `creation`.
- **`ui/ed-app.js`:** `_canAffordRank(character)` audits with `this._model.legendAuditOptions` (fixes the pre-existing omission of Karma and spell sinks); `_legendTotalEarnt` returns `0` when `character.creation` exists and there is neither legacy total nor earned entries.
- **`ARCHITECTURE.md` 4.1:** document the block, the ledger rules above, and that `attributes[n].points` is the attribute creation spend.

Tests: `engine/legend-spent-creation.test.js` (goldens first; ledger subtraction, tier equality, clamp, spells, Karma paid vs free, `creation` absent identical, ordinal-2 ignored); `store-creation-audit.test.js` (Legend 0/0/0 under the real `hb-karma-economy`; placeholder (null) without `creation`; step prices equal `audit(after) - audit(before)` for every talent and skill row with and without free ranks; `model.legendAuditOptions`; `_canAffordRank`-equivalent agreement through the exported options); `store-overlay-creation.test.js` (attributes/creation/spells overlay round-trip, `hasPendingEdits`, `reconcileOverlay`; **regression for an existing caster**: a spells edit now marks dirty and is cleared by reconcile); `engine/characteristics.test.js` (`maxKarma` bonus inside the cap).

#### A3 — builder (I1): `engine/new-character.js`
```js
export const STARTING_SILVER = 100;
export const STARTING_KIT = [                       // names must exist in rules/items.json
  { name: 'Adventuring Kit', equipped: false }, { name: 'Dagger', equipped: true },
  { name: "Traveler's Garb", equipped: true },    { name: 'Trail Rations (1 week)', equipped: false } ];
export const GRIMOIRE = { name: 'Grimoire', equipped: false };   // magicians only
export function slugifyId(name) -> string
export function idTaken(id, takenIds) -> boolean          // Iterable<string>; exact match; NO suffixing
export function validateNewName(name, takenIds) -> { ok, id, reason: null|'empty'|'taken' }   // no UI copy in the engine
export function buildNewCharacter({ name, race, discipline }, rules, { karmaMaxCap = null } = {}) -> character
```
- `slugifyId`: NFKD, strip combining marks, lowercase, runs of non-`[a-z0-9]` -> `-`, trim `-`, slice to 64, trim `-` again; empty result -> `'character'` (the plan's fallback; the `taken` message names the id so the player can add a Latin letter). Output always matches `^[a-z0-9][a-z0-9-]{0,63}$`.
- `validateNewName`: trims; blank -> `empty`; slug in `takenIds` -> `taken`. The views compose the wording from `reason` and `id`: `A character with this name already exists (id "<id>") - choose a different name.`
- `buildNewCharacter` (`rules` = `{ racesFile, disciplinesFile, attributesFile }`; throws `Error('unknown race|discipline')`). Output key order and contents:
  - `schema: 'ed-character/2'`; `meta: { id, name, race }` (`id = slugifyId(name)`).
  - `attributes[n] = { base: race.startingAttributes[n], points: 0, increases: 0 }` for `n` in `attributesFile.order`.
  - `disciplines: [{ name, circle: 1, talents: [{ name:'Durability', rank:1, circle:1 }, { name:'Karma Ritual', rank:1, circle:1 }] }]`. Free talents and the five Circle-1 Discipline Talents are not stored (Rank 0 / derived).
  - `skills: []`, `knacks: []`, `traits: []`.
  - `resources: { karma: { converted: K0, spent: 0 }, legend: { earned: [] }, health: { damage: 0, wounds: 0, recoveriesUsed: 0 } }`, `K0 = maxKarma(race.karmaModifier, 1, karmaMaxCap)`. No `totalEarnt`/`totalSpent`.
  - `items`: `STARTING_KIT` plus `GRIMOIRE` iff the Discipline's circle-1 `talents` include `Spellcasting` (not `halfMagic`; only Nethermancer among the four).
  - `wealth: { coins: { copper:0, silver:100, gold:0, earth:0, water:0, air:0, fire:0, orichalcum:0 }, gems: [] }`.
  - `spells` only for a magician: `{ known: [], matrices: [ {type:'Standard', spell:null} x N ] }` with N = count of `Standard Matrix` in circle-1 `freeTalents` (2).
  - `creation: { open: true, free: { talents: { [freeKey(d,'Durability')]:1, [freeKey(d,'Karma Ritual')]:1 }, skills: {}, spells: [] } }`.
- Tests (`engine/new-character.test.js`): 8 races x 4 Disciplines; slug cases (empty, punctuation, runs, unicode/diacritics, 64-char cap, trailing hyphen after cap, leading digit ok); `idTaken`/`validateNewName` incl. `Kolon` vs `kolon!` collision naming the id; no derived key stored (attribute entries exactly `{base,points,increases}`, `karma` keys exactly `converted,spent`); Grimoire only for Nethermancer; every kit name resolves in `rules/items.json`; Max Karma equals `converted` per race with and without a cap; passes the worker's checks (schema tag, `ID_RE`, <= 512 KiB, mirrored in-test). Extend `tools/dev-server.test.js` to POST a builder output (`base` absent) and read back file plus index row `{ name, portrait: null }`; extend `store-server.test.js` with a draft-shaped call asserting the envelope carries `base: null` and `id`.

#### A4 — drafts, list, first save (I3 and I6 seams)
- **`store.js`:** export `editsKey`, `loadEdits`, `loadRules`. `loadJSON` attaches `err.status = res.status`. `listCharacters()`: a 404 from the index (both the API/CDN paths and the local working copy) returns `[]`; any other failure still throws; a parsed index without an object `characters` throws `Error('Character index is malformed')`. `indexToRows` unchanged. The "no legacy grouped-store fallback" decision is untouched (no legacy read is added).
- **`store-drafts.js` (new; imports from `store.js`, never the reverse):**
```js
export const DRAFT_PREFIX = 'ed-character-draft:';
export function draftKey(id) -> string
export function saveDraft(character) -> envelope            // id = character.meta.id; keeps an existing createdAt; throws without an id
export function loadDraft(id) -> envelope|null              // absent/corrupt/v!==1 -> null, never throws
export function isDraft(id) -> boolean
export function listDrafts() -> [{ id, name, portrait:null, draft:true, race, discipline, createdAt }]   // sorted by id; skips corrupt
export function discardDraft(id) -> void                    // removes draftKey(id) AND editsKey(id) only
export function renameDraft(oldId, newId, name) -> boolean  // false if oldId missing or newId already a draft; moves both keys; patches meta.id/name in the base and in overlay.meta if present
export function promoteDraft(id) -> void                    // after a confirmed first save: reconcileOverlay(undefined, id), then remove the base key only
export function mergeRows(indexRows, draftRows) -> rows    // sorted by id; draft rows keep draft:true; an id in both -> the index row wins
export async function loadDraftCharacter(id) -> { character, rules, base: null }   // applyEdits(base, loadEdits(id)); throws if no draft
```
- **`store-first-save.js` (new, injected I/O so it is testable):**
```js
export async function saveDraftFirstTime({ character, id, fetchTakenIds, post })
  // taken = await fetchTakenIds()      (rejects -> propagates; nothing posted)
  // idTaken(id, taken) -> { ok:false, reason:'id-taken', id }   (post never called)
  // else { ok:true, commit: await post(character, id) }          (post sends base: null)
```
  `fetchTakenIds` is a **fresh** index read (index ids only, not the draft's own id).
- Tests: `store-drafts.test.js` (localStorage shim with `key(i)`/`length`; round-trip with overlay; reload; corrupt base ignored by `loadDraft`/`listDrafts`; discard touches only the two keys and leaves another id's overlay; rename moves both keys, patches meta, refuses a taken target; `promoteDraft` leaves no draft and a clean overlay; `mergeRows` flags and precedence; a draft row has `portrait: null` and a picker row renders from it (pure shape)); `store-first-save.test.js` (id race: index gains the id between create and save -> blocked, `post` never called; after `renameDraft` to a free id -> posts once; a fetch error posts nothing; a missing index (`[]`) posts); `store-list-characters.test.js` (stub `globalThis.fetch` and `globalThis.location`: 404 -> `[]`; 500 and network error throw; malformed shape throws; valid -> rows; Pages and local paths).

#### A5 — allotment engine, `model.creation`, persistence helper (I7, I9 pure half)
`engine/creation.js` (continues; same `ctx` everywhere):
```js
// ctx = { disciplinesFile, attributesFile, skillCatalog /* rules.skillsFile.skills */,
//         resolveSkill /* store.makeSkillRef */, spellCatalog /* rules.spellsFile.spells */,
//         perceptionStep /* number|null, derived, never stored */,
//         karmaModifier, karmaMaxCap /* number|null */ }
export function talentBudget(character, ctx)
export function attributeBudget(character, ctx)
export function skillBudget(character, ctx)
export function spellBudget(character, ctx)            // null unless a magician
export function creationStatus(character, ctx)         // -> model.creation
export function applyTalentRank(character, ctx, { discipline, name, rank })
export function applyAttributePoints(character, ctx, { name, points })
export function applySkillAdd(character, ctx, { name, text })       // text only for generic Knowledge/Artisan
export function applySkillRank(character, ctx, { name, rank })      // rank >= 1; remove via applySkillRemove
export function applySkillRemove(character, ctx, { name })
export function applySpellPick(character, ctx, { name })
export function applySpellRemove(character, ctx, { name })
export function checkSpellMatrices(character, nextSpells, ctx)      // { ok, reason? }
export function finishPlan(character, ctx)
export function finishCreation(character, ctx)
```
Every `apply*` returns `{ ok: true, character, touched }` or `{ ok: false, reason, character }` where a refusal returns the **same** `character` reference. `touched` is a subset of `['advancements','attributes','spells','creation','karma']`. All refuse with `reason: 'creation-closed'` unless `character.creation?.open === true`. Reason codes: `creation-closed, no-change, bad-rank, over-budget, unknown-discipline, not-a-creation-talent, unknown-attribute, out-of-range, unknown-skill, duplicate, not-allowed-category, tier-not-novice, bad-text, generic-not-allowed, rank-cap, not-found, not-a-magician, unknown-spell, not-available, matrix-circle, invalid-budget, already-finished`.

Budget views (the data the UI renders; every row carries `canRaise`/`canLower` booleans computed by simulating the change):
- **`talentBudget`** `{ total: 8, spent, left, valid, rows: [{ discipline, name, rank, max: 3, canRaise, canLower }] }`. Rows = the five names in the `talents` of the `circles` entry with `circle === 1` of `character.disciplines[0]`'s Discipline only (never freeTalents, Talent Options, Durability, Karma Ritual). `spent` = sum of stored ranks of those names; `valid` = `spent <= 8` and every rank `<= 3`. `applyTalentRank`: rank 0..3; raising from 0 appends `{ name, rank, circle: 1 }`; lowering to 0 removes the row and the ledger key; ledger `free.talents[key] = rank`; `touched: ['advancements','creation']`.
- **`attributeBudget`** `{ total: 25, spent, left, valid, min, max, leftover, rows: [{ name, points, cost, raiseCost, lowerRefund, canRaise, canLower }] }` over `attributesFile.order`; `spent = sum cost(points)`; `leftover = max(0, left)` (what Finish converts to Karma); `canRaise` needs `points + 1 <= max` and `raiseCost <= left`; lowering is blocked only by `min`. `applyAttributePoints` sets `attributes[name].points`; `touched: ['attributes']`.
- **`skillBudget`** `{ extra: {total: 8, spent, left}, fixed: { knowledge, artisan, 'language-speak', 'language-readwrite': { total, used, left } }, valid, problems: [], rows: [{ name, category, rank, max, canRaise, canLower, pool }], candidates: [{ name, category, generic, freeText: 'knowledge'|'artisan'|null, disciplineList, pool: 'fixed'|'extra'|null, attribute, brief, canPick }] }`.
  - Allocation (derived from the stored set; nothing about fixed vs extra is stored): for each stored skill with ledger rank `f`, category from `ctx.resolveSkill(name)?.category`. Fixed pools consume first: `knowledge`, `language-speak`, `language-readwrite` take any skill of that category; `artisan` takes only skills whose resolved `artisanKey` is in `disciplinesFile` `artisanSkills` of `character.disciplines[0]`. `fixedUsed[c] = min(pool[c], sum f over eligible)`; `extra.spent = sum f over all - sum fixedUsed`. Every other rank (general, non-list artisan, ranks beyond a pool) is extra.
  - Limits: `valid` = `extra.spent <= 8` and no problems. Per skill max 3 including fixed ranks; `language-*` categories max 1 (each language is its own Rank-1 entry; a further language costs one extra rank). `category: general` needs `tier === 1` (Impressive Display and Tactics are then excluded by data). Knowledge any (incl. `Horror Lore`). Artisan: any `artisan`-category entry, or free-text `Artisan (<text>)` (extra pool unless on the Discipline list; the fixed rank is only ever consumed by a Discipline-list skill).
  - `applySkillAdd`: non-generic -> exact catalog `name`; generic (`Knowledge`, `Artisan` only; the two language templates are not offered, per-language entries cover languages) -> `` `${template} (${text})` ``. `text` trimmed, 1-40 chars, no `(` or `)`, else `bad-text`. Stores `{ name, rank: 1, tier: 'Novice' }` (every non-general entry and every gate-passing general entry is `tier: 1`), ledger `free.skills[name] = 1`, refuses a duplicate stored name (case-insensitive) and a pick with no capacity. `applySkillRank` sets rank and ledger; `applySkillRemove` deletes the row and ledger key. `touched: ['advancements','creation']`.
- **`spellBudget`** (magician = Discipline circle-1 `talents` include `Spellcasting`): `{ total: perceptionStep, spent, left, valid, rows: [{ name, circle, placeable, canRemove }], candidates: [{ name, circle, cost, canPick }] }`. `spent` = sum of the Circle of each name in `spells.known` that is also in `free.spells`; cost of a spell = its Circle (1 or 2). Candidates: catalog entries with `discipline === character.disciplines[0].name` and `circle` in `[1, 2]`, not known; no talent prerequisite, roll or silver. `placeable = circle <= disciplines[0].circle`. `perceptionStep == null` -> `total/left` null, `valid` false if anything is picked, `canPick` false (UI shows the dashed placeholder pill). `applySpellPick` appends `{ name: <catalog name>, learntSuccess: 0 }` and the ledger name; `applySpellRemove` also releases any matrix holding it. `checkSpellMatrices(character, nextSpells, ctx)` refuses (`matrix-circle`) a matrix holding a spell whose Circle exceeds the Discipline Circle while `open`. `touched: ['spells','creation']`.
- **Over-spend is shown, never auto-corrected**: e.g. Perception lowered after spells were picked gives `spells.valid === false`; Finish is blocked.
- **`creationStatus`** -> `null` if no `creation`; `{ open: false }` after Finish; else `{ open: true, free, talents, attributes, skills, spells /* null for non-magicians */, canFinish, blockers: [string] }` where `canFinish` is every present budget `valid`, and each invalid budget adds a blocker naming it and the overspend.
- **`finishPlan`** `{ canFinish, blockers, forfeits: { talents: talents.left, skills: skills.extra.left + sum fixed.left, spells: spells?.left ?? 0 }, karmaBonus: attributes.leftover, newMaxKarma, oldMaxKarma }`.
- **`finishCreation`**: refuses `already-finished` when `open === false` (no-op, same reference) and `invalid-budget` when `!canFinish`. Else `creation.open = false` (ledger kept as is), `resources.karma.converted += newMaxKarma - oldMaxKarma` (ledger semantic 8), `touched: ['creation','karma']`, plus `summary` (the forfeits).

`store.js` (A5): `export function creationContext(rules, character, perceptionStep)` (assembles `ctx`; `karmaMaxCap` from `homebrewSetsFor(rules.homebrewFile, character.meta.race)['karma.maxCap'] ?? null`, `karmaModifier` from `racesFile`, `resolveSkill = makeSkillRef(rules.skillsFile)`); `deriveModel` sets `model.creation = character.creation ? creationStatus(character, creationContext(rules, character, attrStepByName.Perception ?? null)) : null` and enriches each `model.creation.talents.rows[]` with `brief: talentCatalog[name]?.presentation?.shortEffect ?? null`; `export function persistCreationEdit(character, touched, id)` maps `advancements` -> `saveAdvancementEdits({ disciplines, skills }, id)`, `attributes` -> `saveAttributeEdits`, `spells` -> `saveSpellEdits`, `creation` -> `saveCreationEdits`, `karma` -> `saveKarmaEdits(character.resources.karma, id)`.

Tests: `engine/creation.test.js` (boundary values from Rules; refusals return the same reference; ledger writes; Durability/Karma Ritual, free talents, Talent Options and non-Circle-1 names refused; fixed-pool-first allocation incl. a third Knowledge pick, second Discipline-list Artisan pick, non-list Artisan pick, language Rank-1 cap, free-text rules, Tactics/Impressive Display refused; non-magician `spells === null`; Perception lowered -> `valid:false`; Finish blockers, forfeits, Troll cap case, re-run no-op, exact `creation` keys, `attributes[n].points` untouched); `store-creation-model.test.js` (deriveModel for builder output of every race x Discipline under the real rules incl. `hb-karma-economy`: Legend 0/0/0 before and after Finish, Karma sink 0 both times, available Karma equals derived max both times, unconsciousness/death rise by `durability x 1` versus the same character without the Durability row, Nethermancer `model.spells` non-null with two empty Standard matrices, `model.creation` shape, overlay persistence through `persistCreationEdit` and a reload via `applyEdits`; a full walkthrough: create -> spend all budgets -> save overlay -> reload -> Finish -> Legend raise now costs normal Legend and `affordable` is false at Available 0).

#### B1 — loader UI (I5)
- **`ui/ed-character-picker.js`:** new props `disciplines` (names, from `rules.disciplinesFile.disciplines`), `races` (names), `characters` rows may carry `draft: true`. Keep `kind: 'picker'`, layer 2100, width 24rem. Rows become `<div class="rowwrap">` holding a load `<button class="row">` and, for `draft` rows, a sibling `<button class="rdiscard">` (never nested). Draft rows show an "unsaved draft" badge (`--accent-bg`). Below the list: a "Start a new character" section with one `<button>` per discipline: inline SVG `+` glyph (`aria-hidden`) plus the name; rendered only when `disciplines` is non-empty; shown with an empty list (hint: "No characters yet - start one below."). A "+" button opens `<ed-new-character>` (state `_newFor = discipline`); a discard opens an inline `<ed-confirm heading="Discard this draft?" confirmLabel="Discard">`. The picker listens on those children and calls `e.stopPropagation()` on their `close`/`confirm` so they never reach `@close` on `<ed-character-picker>` in `ed-app` (which would close the whole picker). `create-character` is **not** stopped. Discard confirm dispatches `discard-draft { id }`.
- **`ui/ed-new-character.js` (new; `kind: 'input'`, layer 2150, width 24rem, kit frame):** props `mode` (`'create'|'rename'`), `discipline`, `races`, `takenIds`, `name`, `clashId`. Live `validateNewName(name, takenIds)` (imported pure helper) drives an inline warning (`role="alert"`, theme token) and disables the primary. Create mode: name input (`autofocus`), race `<select>` with a disabled "Choose a race" placeholder (no default); primary "Create" enabled only with a valid name and a race. Confirm dispatches `create-character { name, race, discipline }` (name trimmed) then `ctl.close({ reason: 'confirm' })`. Rename mode: name only, primary "Rename", dispatches `rename-draft { name }`. Escape/backdrop/Cancel/X close with no event. No `document` key listeners, no hand-rolled frame CSS (`tools/check-ui-kit.mjs`), weights 400/500, `--fs-*` sizes only.

#### B2 — wiring (I6): `ui/ed-app.js`
- State: `_indexRows` (index rows only), `_characters` (= `mergeRows(_indexRows, listDrafts())`, recomputed by `_refreshRows()`), `_isDraft` (reactive), `_renameDraft` (`{ id, name, clashId }|null`).
- `_ensureRules()` memoises `this._rules ??= await loadRules()`; `_openPicker()` awaits it then sets `_picker = true` (used by the header icon, the "Choose a character" button and first-run).
- Startup (replaces the L496-513 block): `_indexRows = await listCharacters()` (404 -> `[]`), `rows = mergeRows(...)`. No `_error` for an empty store: `_ensureRules()` then `_picker = true`. A real failure (network, malformed) still sets `_error`. `_initialId(ids, rows)` accepts a saved `ed-character` selection that is a draft id; a single row (saved or draft) auto-loads.
- `_loadCharacter(id, { characters })`: `row.draft === true` -> `loadDraftCharacter(id)`, `_isDraft = true`, `_baseSha = null`, `_dirty = true`, then `_editMode = true` if `character.creation?.open`. Otherwise the existing path with `_isDraft = false`. Any character whose `creation.open` is true opens in edit mode.
- `create-character` -> `_createCharacter({ name, race, discipline })`: re-run `validateNewName` against merged row ids (refuse with a notice on a clash, nothing stored); `buildNewCharacter(..., { karmaMaxCap: homebrewSetsFor(rules.homebrewFile, race)['karma.maxCap'] ?? null })`; `saveDraft`; `_refreshRows()`; `_loadCharacter(id)`; `_editMode = true`; `_tab = 'disciplines'`.
- `discard-draft { id }` -> `discardDraft(id)` (+ `clearRollLog(id)`, `clearDiscordConfig(id)`); `_refreshRows()`; if it is the loaded character: null `_character/_model/_characterId`, clear `localStorage 'ed-character'` if equal, `_noSelection = true`.
- `_doSave` for a draft: autosave and flush-on-hide skip a draft (`_autosaveFire`, `_flushSave`, and a `silent` `_doSave` on a draft all return early). Manual Save: key prompt as today, then `saveDraftFirstTime({ character: forSave(this._character), id, fetchTakenIds: async () => (await listCharacters()).map(r => r.id), post: (c, id) => saveServer(c, { endpoint, saveKey, id, base: null }) })`. `id-taken` -> `_renameDraft = { id, name, clashId }` (modal below), nothing posted. Success -> `_baseSha = commit.sha`, `promoteDraft(id)`, `_isDraft = false`, `_dirty = hasPendingEdits(id)`, `_indexRows` gains `{ id, name, portrait: null }` locally then a best-effort `listCharacters()` refresh, `_refreshRows()`. A fetch or post error leaves the draft and shows the existing save-error toast.
- Rename modal: `<ed-new-character mode="rename" .name .takenIds .clashId @rename-draft @close>` rendered by `ed-app`. `rename-draft { name }` -> `newId = slugifyId(name)`, defensive `validateNewName` against index and other drafts, `renameDraft(old, new, name)`, update `_character.meta`, `_characterId`, `localStorage 'ed-character'`, `_refreshRows()`, close, then re-run `_doSave()` (the check runs again). Escape leaves the draft unsaved.
- Render: `Discard local changes` icon hidden when `_isDraft`; picker gets `.disciplines .races .characters` (the picker derives `takenIds` from its own `characters` ids for the create modal; `ed-app` derives them for the rename modal as the merged row ids minus the draft's own old id). `_confirmSwitch` applies to drafts unchanged (overlays are per id and survive).

#### B3 — creation-mode UI (I8)
`creating = !!(model.creation?.open && editMode)` everywhere below; nothing renders for a character without `creation`, so saved characters are pixel-identical.
- **`ui/ed-app.js`:** `addEventListener('ed-creation-edit', (e) => this._creationEdit(e.detail))`. `_creationEdit({ kind, ...payload })`: `kind` is `talent | attribute | skill-add | skill-rank | skill-remove | spell-add | spell-remove`; builds `ctx = creationContext(this._rules, this._character, perceptionStep)` with the Perception step read from `this._model.attributes`; maps `kind` to the `apply*` function; on `!ok` shows `_showNotice(reasonText)` and returns; on ok: `this._character = res.character`, `persistCreationEdit(res.character, res.touched, this._characterId)`, `_markDirty()`, `this._model = this._derive()`. No standard-log entries, no wealth writes. `_editSpells(spells)` while `creation.open` first runs `checkSpellMatrices` and refuses on `!ok`.
- **`ui/ed-disciplines.js`:** while `creating`: `_creationBar(d)` replaces `_legendBar(d)` (chips: "Talent points left N" on a Discipline sub-tab, "Skill ranks left N" plus fixed-pool remainders on the Skills sub-tab, then `Finish creation`); "+ Add Discipline", "Seed Circle 1", "+ add option", "+ add knack", "+ add skill" and the existing `_rankCtl` are not rendered; the green next-Circle pill renders as the plain non-button pill. Talent group for Circle 1: rows for the five `model.creation.talents.rows` names (Rank-0 ones synthesised: `step` null shows `-`, roll disabled) with a `-`/`+` stepper, `canLower/canRaise` from the row, dispatching `ed-creation-edit { kind:'talent', discipline, name, rank }`; Durability, Karma Ritual and free rows are plain. Skill rows get a creation stepper and an X (`skill-rank`, `skill-remove`) and a `+ add skill` button opening a `creation-skill` picker (add `'creation-skill': 'picker'` to `DISC_KIND`): sections Knowledge (free-text field + `Horror Lore`), Artisan (Discipline list marked "free rank", other artisan entries and an `Artisan (text)` field), Speak, Read/Write, General (search); each candidate shows its `pool` badge ("free rank" or "uses 1 of 8"); a generic field uses `data-enter="local"` with its own Add button. Finish button: `disabled` with a `title` listing `blockers` when `!canFinish`; dispatches `ed-creation-finish`. Over-spent chips use the existing `light-dark(#c0392b, #e06557)` warning tone.
- **`ui/ed-overview.js`:** `_attrCell(a)` adds compact circular `-`/`+` buttons at the right end of the `.an` name line (`margin-left: auto`; no new row or column), from `model.creation.attributes.rows` (`canRaise/canLower`, tooltip with `raiseCost`/`lowerRefund`), dispatching `ed-creation-edit { kind:'attribute', name, points: a.points +/- 1 }`. The Attributes `h4` carries an inline chip "Points left N" (`--fs-fine`, `line-height: 1`), over-spent in the warning tone. Nothing else in the Overview changes.
- **`ui/ed-spells.js`:** while `creating` and `model.creation.spells` is non-null: `+ Learn spell` becomes `+ Pick spell` opening a `kind: 'picker'` modal listing `candidates` grouped by Circle (cost = Circle, no roll/silver), a "Spell points left N / Perception Step M" chip beside the Karma chip (`total == null` -> dashed pill), the `X` remove dispatches `{ kind:'spell-remove' }`, and the matrix toggle is disabled when the row is not `placeable`. Non-magicians see the existing "no spells" state.

#### B4 — Finish (I9)
`ed-disciplines` dispatches `ed-creation-finish` (no detail). `ed-app._finishCreation()`: `plan = finishPlan(character, ctx)`; if `!plan.canFinish` show the first blocker as a notice; else set `_confirmFinish = plan` and render `<ed-confirm heading="Finish creation?" confirmLabel="Finish creation" tone="accent" message=... warn=... @confirm @close>`: `message` states unused attribute points become +`karmaBonus` Max Karma and that Legend pricing applies afterwards; `warn` (only if any forfeit > 0) lists `N talent points, N skill ranks, N spell points will be forfeited.` Escape cancels, Enter confirms (kit `confirm`). On confirm: `res = finishCreation(...)`; on ok persist with `persistCreationEdit(res.character, res.touched, id)`, `_markDirty()`, re-derive. A refused or cancelled confirm changes nothing.

#### B5 — docs (I10)
`docs/UI-GUIDELINES.md` (6a loader: Start-a-new-character section, draft rows and Discard, empty store; a creation-mode paragraph: chips, Overview attribute steppers in the name line, Finish), `docs/MODALS.md` (host table: `ed-new-character`, 2150, 24rem, input; picker note on Enter and the new buttons), `ARCHITECTURE.md` 7.1 (draft envelope, drafts never autosave, first-Save id re-check), `data/changelog.json`, `docs/RULES-FAQ.md` (verification only: Q039-Q041 carry every Decision). README lists no feature set; no change.

### UI / behavior
- Entry: loader -> "Start a new character" -> "+ <Discipline>" -> modal (name, race) -> draft loads, edit mode on, Disciplines tab. Draft shows an "unsaved draft" badge and the Save dot; the first Save is manual only.
- Creation controls appear only while `creation.open && editMode`; leaving edit mode hides them (state is untouched) and re-entering shows them. Planner default; the owner may prefer them always on.
- Modals: every new modal is kit-based; Escape closes only the top one (stack: picker -> new-character; confirm over picker); Enter confirms the primary (a focused "+" or discard button activates natively). Light and dark via `light-dark()` tokens; weights 400/500; `--fs-*` sizes; relative paths only.
- Overview must still fit the desktop viewport with no vertical scroll in creation mode (mobile folds to one column). Manual owner verification list: Overview fit (desktop and mobile) with the stepper and chip; light and dark for the picker, modal, chips, steppers; Escape/Enter in picker, new-character, rename, Finish confirm and the skill/spell pickers; focus return to the "+" trigger; keyboard reachability of the discard X; empty-store first run; a draft reload; first Save against `tools/dev-server.mjs`.

### Rules
Expected values for tests come only from this table (`rules.md` ids; sources are the FAQ Q-numbers it cites).

| Rule | Exact value / formula | `rules.md` / source |
|---|---|---|
| Talent points | 8; each +1 rank; max Rank 3 per talent; only the five Circle-1 Discipline Talents (circle-1 `talents`); unassigned = Rank 0 (unrecorded); Talent Option excluded | R1; Q039; CC p.67-68 |
| Seeded talents | Durability and Karma Ritual stored at Rank 1, Circle 1, listed in `free.talents`, outside the 8, not steppable | R1 round-2 decision |
| Free talents | Rank = Circle (1), derived, never stored, 0 Legend; Nethermancer: two Standard Matrix | R2; Q036, Q037 |
| Attribute points | 25 over racial `base`; cumulative cost +1=1, +2=2, +3=3, +4=5, +5=7, +6=9, +7=12, +8=15; -1 gives back 1, -2 gives back 2; range -2..+8 | R3; Q039; CC p.60-61 |
| Leftover attributes | Unspent points convert 1:1 to Max Karma at Finish | R3, R10 |
| Max Karma | `min(Karma Modifier x Circle + leftover, race karma.maxCap)` (cap only when the house rule sets one); starts full. Per-race numbers are read from the data files, not restated as rules: `rules/races.json` `karmaModifier` (verified 2026-11-21: Dwarf 4, Elf 4, Human 5, Obsidiman 3, Ork 5, Troll 3, T'skrang 4, Windling 6) and `rules/homebrew.json` `karma.maxCap` (Dwarf 25, Elf 25, Human 40, Obsidiman 20, Ork 40, T'skrang 25, Troll 20, Windling 60). Tests read the files. | R4; CC p.66 |
| Free creation Karma | With the Karma economy on, creation Karma costs 0 Legend: sink = `max(0, converted - creationKarma) x ritualCost` | R4 round-2 decision |
| Fixed skill ranks | Knowledge 2, Artisan 1 (from the Discipline's `artisanSkills` only), Speak Language 2, Read/Write Language 1 | R5; Q039; CC p.69-71 |
| Extra skill ranks | 8 across Knowledge, Artisan, Language, General; General only `category: general` and `tier: 1`; Artisan from the 8 may be any `artisan` entry or `Artisan (<text>)` | R5, R11 |
| Skill rank cap | Total rank per skill <= 3 including fixed ranks; each language is its own Rank-1 entry (cap 1); Knowledge picks are `Knowledge (<text>)` | R5 (house + round-2) |
| Spell points | = Perception Step (derived); a spell costs its Circle; Circle 1-2 spells of the Discipline from `rules/spells.json`; Circle-2 spells are known but not placed in a matrix at Circle 1; two Standard Matrices free; no roll, silver or talent prerequisite | R6; Q039; CC p.68 |
| Starting Legend | 0 earned / 0 spent / 0 available; derived 0 while `creation` exists | R7 (house) |
| Starting kit | Adventuring Kit (15 sp, 14 lb, average), Dagger, Traveler's Garb (8 sp, 3 lb, average), Trail Rations 1 week (10 sp, 8 lb, average), Grimoire (magicians only), 100 silver | R8; Q040 |
| Grimoire | cost 0, weight 1 lb, availability average (house) | R9 |
| End of creation | Warn then forfeit unspent talent, skill and spell points; attribute leftovers to Max Karma; steppers then use Legend pricing | R10 (house) |
| Skill data | R11 category counts, `generic` x4, `artisanKey` x21, Impressive Display and Tactics `tier: 2` | R11; Q041 |

### Edge cases & invariants
- No `creation` block: every function and the audit behave exactly as today (golden tests); the schema tag is `ed-character/2` everywhere.
- `creation` and `free` have exactly the signed-off key sets after every producer. Nothing derived is written into it.
- Ledger: `free[k] <= stored rank` never matters to the audit (clamped); lowering after Finish never makes a line negative; Karma sink is 0 before and after Finish.
- A refused edit changes nothing (same object reference, no overlay write, no dirty mark).
- Over-spend (Perception lowered after spells) is shown and blocks Finish; Finish never auto-removes picks.
- `attributes[n].points` is locked after Finish (steppers hidden, `applyAttributePoints` refuses); later gains use `increases` and Legend.
- Draft never autosaves, never flushes on hide, never posts silently. A loaded draft is always dirty. "Discard local changes" is hidden for drafts.
- Id: no suffixing, ever. A clash is a blocking warning at the modal and again at first Save (fresh index read, own id excluded); the residual window after the check is accepted by the owner.
- A missing index with drafts lists the drafts; a missing index with none opens the picker with only the new-character section; any other list failure still shows the error.
- A corrupt draft base is ignored and never blocks load. A draft shadowed by an index row of the same id is hidden (index wins).
- Discard removes only the draft base, its overlay and its device-local roll/Discord keys; saved characters' overlays are untouched; the branch is never touched.
- Free text: trimmed, 1-40 chars, no parentheses, deduplicated case-insensitively; language templates never take free text.
- `perceptionStep == null` never fabricates a spell budget (dashed pill, nothing pickable).
- `karmaModifier == null` (race not in `rules/races.json`): `creationKarma`, `newMaxKarma` and `oldMaxKarma` are null, `finishCreation` skips the Karma step (`touched` has no `'karma'`), and the audit charges no Karma sink.
- Changing `meta.race` after creation changes derived Max Karma but not the seeded `converted` (an input); accepted.

## Testability notes
- Everything with logic is a pure function under `node:test` with no DOM: `engine/new-character.js`, `engine/creation.js`, the `engine/legend-spent.js` and `engine/characteristics.js` additions, `store.js` (`deriveModel`, overlay, `persistCreationEdit`, `creationContext`), `store-drafts.js` (localStorage shim as in `store-start-discipline.test.js`, with `key(i)` and `length`), `store-first-save.js` (injected `fetchTakenIds`/`post`), `listCharacters` (stub `globalThis.fetch`/`location`).
- `data/characters/` is gitignored: all fixtures are inline; builder output is also the fixture for the dev-server and `store-server` tests.
- Tests that need real rules read `rules/*.json` as the other store tests do; build `rules` with `attributesFile`, `spellsFile` and the real `homebrewFile` where the Karma economy matters.
- Invariant to test as a property: for every talent and skill row, `pricing.increaseCost` and `pricing.refund` equal `audit(after) - audit(before)`, with and without free ranks.
- Not unit-testable (owner's manual verification): the picker's Enter/Escape/focus behavior with the new buttons, the Overview fit and light/dark with the stepper and chips, mobile layout, the skill and spell pickers, the rename and Finish modals, and an end-to-end create -> Save -> reload against `tools/dev-server.mjs`.
- Run `npm test` (includes `tools/check-ui-kit.mjs`: no document key listeners, no hand-rolled frame CSS, no non-`--fs-*` sizes, no inline `style=` on a `<button>`; and `tools/check-imports.mjs`).

## Changelog entry
`{"type": "added", "text": "Start a new Circle-1 character from the loader: pick Archer, Nethermancer, Thief or Warrior, name them and choose a race, then spend the creation points (talents, attributes, skills and Nethermancer spells) in the existing tabs. The draft stays in your browser until your first Save creates it on GitHub."}`
(Optional extra lines the dev may add under `unreleased.changes`: a `fixed` for spell edits now showing as unsaved, and a `changed` for Impressive Display and Tactics being Journeyman-tier skills.)

## Out of scope
Human Versatility and other-Discipline talents at creation; the Dwarf language swap; the Talent Option during creation; per-Discipline icon art; portrait selection; deleting saved characters; any worker or save-protocol change; Disciplines beyond the four in `rules/disciplines.json`; the additional-Discipline path honouring free ranks (noted, untouched); removing the duplicate `Bribery` and `Skinning` catalog entries; recording the Etiquette, Streetwise and Dancing catalog gaps; migrating device-local roll-log and Discord keys on a draft rename.
