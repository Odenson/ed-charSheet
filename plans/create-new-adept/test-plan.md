# Test Plan: Create new adept (create-new-adept)

Author mode, 2026-11-22. All tests are `node:test`, no DOM (there is no browser harness). Rules values come only from
`rules.md` R1-R11 and the spec "Rules" table; per-race Karma numbers are read from `rules/races.json` and
`rules/homebrew.json` at test time. Every producer-facing contract (API names, arguments, return shapes, reason codes,
ledger semantics) is asserted as written in `spec.md`.

## Test files
<!-- authoritative: the dev may not modify any file listed here -->
engine/legend-spent-golden.test.js
store-creation-golden.test.js
tools/rules-conformance.test.js
tools/rules-starting-kit.test.js
engine/legend-spent-creation.test.js
store-creation-audit.test.js
store-overlay-creation.test.js
engine/characteristics.test.js
engine/new-character.test.js
tools/dev-server.test.js
store-server.test.js
store-drafts.test.js
store-first-save.test.js
store-list-characters.test.js
engine/creation.test.js
store-creation-model.test.js

New files: 13 (the two golden files, `tools/rules-starting-kit.test.js`, `engine/legend-spent-creation.test.js`,
`store-creation-audit.test.js`, `store-overlay-creation.test.js`, `engine/new-character.test.js`, `store-drafts.test.js`,
`store-first-save.test.js`, `store-list-characters.test.js`, `engine/creation.test.js`, `store-creation-model.test.js`).
Extended existing files: `tools/rules-conformance.test.js` (+12), `engine/characteristics.test.js` (+3),
`tools/dev-server.test.js` (+3), `store-server.test.js` (+1). About 460 cases in total.

## Golden vs failing split

**GOLDEN (pass on today's unmodified code; must keep passing; 24 cases).** Step 0 of slice A2. Inline fixtures modelled on
kolon-v2, chakka and test-char (Ork Thief 1; Archer 4 + Nethermancer 3 with spells, rituals, thread items, an earned entry;
Archer 3), captured by running the unmodified engine against the real `rules/legend.json`, `rules/spells.json`,
`rules/thread-items.json`, `rules/knacks.json` and the real `rules/homebrew.json` (Karma economy, tier shift, free spell
learning), then hand-checked (Kolon-like attributes 9200, Thief talents 800, skills 5000, knacks 1000, Karma 125 x 7 = 875).
No test reads `data/characters/`.
- `engine/legend-spent-golden.test.js` (14): `auditLegendSpent` totals, recorded/delta, section totals and every line
  (name, detail, cost) for six option sets; `talentRankStepCost` / `skillRankStepCost` without `freeRank`; the karma sink for a
  character without a `creation` block even when `creationKarma` is offered; no mutation.
- `store-creation-golden.test.js` (10): `deriveModel` Legend, Karma (max/available/step/ritualCost), health ratings,
  attribute steps, every talent/skill `pricing`, addable Disciplines and spells slice for the three fixtures (plus a no-homebrew
  variant); the Legend placeholder (`model.legend === null`) without earned entries; `forSave`/`applyEdits`/`hasPendingEdits`/
  `reconcileOverlay` on existing categories (no `creation` key invented); `indexToRows`. The golden rules object deliberately
  omits `attributesFile` (older store tests do), so it also pins that `deriveModel` keeps working without it.

**FAILING-FIRST (new feature).** Everything else. A handful of cases in those files pass today on purpose (guards that
the feature must not break): `tools/rules-conformance` "no bulk re-tiering"; `store-creation-audit` control "without a creation
block the same Karma IS charged", "open => bonus 0", "no creation => no bonus", "unpriceable attributes => no bonus";
`store-overlay-creation` "forSave carries creation"; `legend-spent-creation` "absent creation == empty ledger" and
"ordinal > 1 freeRank ignored"; `store-list-characters` valid index / empty index / network error / Pages happy paths.

## Per-slice run order (spec "Delivery slices")
| Slice | Run | Notes |
|---|---|---|
| A1 | `tools/rules-conformance.test.js`, `tools/rules-starting-kit.test.js` | data only |
| A2 | goldens first (green before and after), `engine/legend-spent-creation.test.js`, `store-creation-audit.test.js`, `store-overlay-creation.test.js`, `engine/characteristics.test.js`, and the six helper cases in `engine/creation.test.js` | `engine/creation.test.js` uses a NAMESPACE import so at A2 (helpers only) it loads and the six helper cases go green; the A5 cases fail individually until A5 |
| A3 | `engine/new-character.test.js`, the new cases in `tools/dev-server.test.js` and `store-server.test.js` | the extension cases import the builder lazily, so the pre-existing cases in those files stay green before A3 |
| A4 | `store-drafts.test.js`, `store-first-save.test.js`, `store-list-characters.test.js` | `store-first-save` also imports `store-drafts.js` |
| A5 | `engine/creation.test.js` (all), `store-creation-model.test.js` | needs A1-A4 |
Slices B1-B5 add no tests (UI; the pure seams are covered above).

## Coverage
Groups are `file :: describe block`. Acceptance criteria are those of tickets T1-T9 / plan I1-I10 and the spec "Edge cases & invariants".

### tools/rules-conformance.test.js :: skills (12 cases) - A1, T5 data half
- **Validates:** `rules/skills.json` schema tag stays `ed-skills/1`, 154 entries with the two duplicates kept; every entry has a valid `category`; counts 106/2/22/12/12; the closed R11 lists (knowledge, artisan, both language families) hold exactly their members; every other entry is general; the owner-decided dual-use entries are artisan; `generic: true` on exactly the four templates; `artisanKey` on exactly the 21 artisan entries except `Artisan`, equal to the name minus ` (Artisan)`; each Discipline `artisanSkills` string resolves to exactly one `artisanKey` (the eight R11 strings asserted); duplicate Bribery/Skinning copies identical; tier counts 1:116 / 2:31 / 3:7, `category: general && tier: 1` = 68, Impressive Display and Tactics `tier: 2`.
- **Rule:** R11 (Q041), R5. **Why:** a wrong category silently lets a Journeyman skill through the Novice-only gate or breaks the Discipline artisan join.

### tools/rules-starting-kit.test.js (13) - A1, T8
- **Validates:** Traveler's Garb (8 sp, 3 lb, average), Trail Rations (1 week) (10 sp, 8 lb, average), Grimoire (0, 1 lb, average, description says house stat block): `kind: gear`, one `note` effect, `presentation.shortEffect` <= 32 chars, `validateItem` ok; Adventuring Kit (15 sp, 14 lb) and Dagger still present; nothing removed. **Rule:** R8, R9.

### engine/legend-spent-creation.test.js (33) - A2, T4
- **Talent ledger:** free ranks cost 0; above the free count the normal step; free count above the rank clamps (never negative, never a refund); raising back to the free count is free; priced in the talent's own tier; seeded Durability/Karma Ritual cost 0; key is `${discipline}/${talent}`; keys of a Discipline at ordinal > 1 ignored (with and without `tierShift`); ` · N free` in `detail`. **Rule:** R1.
- **Skill ledger:** same with the Skill Training table, stored tier, default Novice, full stored name key. **Rule:** R5.
- **Spell ledger:** `free.spells` costs 0 whatever the multiplier (1, 2, 0), apostrophe-insensitive both ways, a known spell not in the ledger still costs. **Rule:** R6.
- **Karma sink:** `max(0, converted - creationKarma) x cost`, never negative, non-finite/`null` `creationKarma` charges nothing, section lines add up to the total, rule off => none. **Rule:** R4 round-2.
- **Absent block:** empty ledger (open or closed) is byte-identical to no block.
- **PROPERTY:** `talentRankStepCost` / `skillRankStepCost` with `freeRank` equal `audit(after) - audit(before)` over circles 1/5/9/13, free 0-7(8), ranks 1-8, and the free steps are 0 / later steps the plain table step; ordinal > 1 ignores `freeRank`; no mutation.

### store-creation-audit.test.js (37) - A2, T4/T5/T7
- **Legend 0/0/0:** for each of the 8 races under the REAL `hb-karma-economy`: `legend.totalEarnt` 0, `spent.total` 0, `available` 0, Karma sink 0, Karma max == available == `min(Modifier, cap)`; legacy `totalEarnt` / earned entries still win (0 is only the fallback); a Legend raise after creation is not affordable at Available 0. Control: without `creation` the same Karma is charged. **Rule:** R7, R4.
- **`model.legendAuditOptions`:** the six existing options with their derived values, `creationKarma` only for a creation character, and `auditLegendSpent(c, costs, model.legendAuditOptions)` reproduces `model.legend.spent` (creation, caster with spells, plain).
- **PROPERTY:** for every talent and skill row `pricing.increaseCost` / `refund` equal `audit(after) - audit(before)` (open ledger with zero / middling / rich purses, finished with ranks lowered below free, caster with a paid spell and a real Karma sink, second Discipline ignoring ledger keys, no creation block), and `pricing.affordable` equals the ed-app `_canAffordRank` rule when that guard audits with `model.legendAuditOptions`.
- **Karma max:** Troll 25 unspent => `min(3 + 25, 20) = 20`; Human 30; partly spent attributes (R3 table: Dex +4 = 5, Str +2 = 2 => 18 left); post-Finish Karma bought with Legend is charged beyond `creationKarma`; open => bonus 0. **Rule:** R3, R4.
- **No-file tolerance:** `deriveModel` without `attributesFile` / `spellsFile`.
- **`store.homebrewSetsFor`** (race-keyed, scalars, falsy 0 kept, unknown race, missing file, disabled/unknown/last-wins, agrees with deriveModel) and **`store.makeSkillRef`** (exact, bracket-stripped base, unknown => null).

### store-overlay-creation.test.js (15) - A2, T4
- `saveAttributeEdits` / `saveCreationEdits` write the whole category; `applyEdits` REPLACES (not merges) `attributes` and `creation` (a ledger key dropped by the edit is not resurrected); categories are independent and per-id; `forSave` carries `creation`; `hasPendingEdits` / `reconcileOverlay` cover `attributes`, `creation` and `spells`.
- **REGRESSION (existing caster):** a spells edit now marks dirty and is cleared by reconcile.

### engine/characteristics.test.js (+3) - A2
- `maxKarma(mod, circle, cap = null, bonus = 0)`: bonus inside the cap (Troll 3 + 25 => 20; Human 5 + 25 => 30; no cap 29), default 0 keeps old callers, null guards. **Rule:** R3/R4.

### engine/new-character.test.js (68) - A3, T1
- Constants (`STARTING_SILVER`, `STARTING_KIT`, `GRIMOIRE`; every kit name resolves in `rules/items.json`). **Rule:** R8/R9.
- `slugifyId`: diacritics, NFKD, punctuation runs, 64-char cap with the exposed trailing hyphen trimmed, leading digit, `'character'` fallback, always matches the worker id rule.
- `idTaken` (exact match, array/Set, no suffix) and `validateNewName` (`empty` / `taken`, `Kolon` vs `kolon!` names the clashing id, codes only).
- `buildNewCharacter` x 8 races x 4 Disciplines: exact key set, meta, attributes `{base, points: 0, increases: 0}` in `attributesFile.order`, Discipline with Durability + Karma Ritual only, empty skills/knacks/traits, `converted` = `min(Modifier, cap)` with and without the cap, no `totalEarnt`, kit + Grimoire only for the Nethermancer (two empty Standard matrices), wealth 100 silver, `creation` exact key sets and ledger, worker checks mirrored (schema tag, id rule, 512 KiB). Pure (frozen rules), independent builds, errors `unknown race` / `unknown discipline`. **Rule:** R1, R2, R4, R7, R8, R9.

### tools/dev-server.test.js (+3) and store-server.test.js (+1) - A3, T3
- A builder draft posted with `base` absent and with `base: null` returns 200, the raw file reads back (creation block intact), and the create-only index row is `{ name, portrait: null }` (plan I6 "portrait-less index row"); other characters untouched; all four Disciplines validate. `saveServer` with a draft sends exactly `{ character, id, base: null }`. The real worker's create path is already covered in `tools/worker/worker.test.js` (not changed: spec says no worker change).

### store-drafts.test.js (28) - A4, T3
- `DRAFT_PREFIX`/`draftKey`; `saveDraft` envelope `{ v: 1, createdAt, character }`, keeps `createdAt`, throws without an id; `loadDraft`/`isDraft` absent/corrupt/`v !== 1`/non-object => null, never throws; `listDrafts` row shape, sorted, skips corrupt, ignores other keys, picker-ready (`portrait: null`); `discardDraft` removes exactly the base and overlay; `renameDraft` moves both keys, patches `meta` in both, refuses a missing old / taken new id with storage byte-identical; `promoteDraft` clears the saved categories incl. the new ones and removes only the base; `mergeRows` sorted, `draft` flag, index wins; `loadDraftCharacter` applies the overlay, `base: null`, survives a reload, throws without a draft, tolerates a corrupt overlay.

### store-first-save.test.js (10) - A4, T3 (plan F5)
- Free id posts exactly once with `(character, id)`; **id race** (index gained the id) => `{ ok: false, reason: 'id-taken', id }` and `post` never called; Set/array index; missing index (`[]`) posts; only an exact match blocks; every attempt re-reads the index; fetch rejection posts nothing; post rejection propagates; character not mutated, draft left for the caller to promote; rename after a clash then a successful single post under the new id.

### store-list-characters.test.js (27) - A4, T3 (plan F6)
- Local and Pages (contents API then raw CDN): 404 => `[]` with no legacy file read; 500 / 403 / network errors still throw and carry `err.status`; a malformed index (`{}`, `characters: null`, string, array, `null`, number) throws `Character index is malformed`; valid index => rows sorted by id with name fallback and `portrait: null`.

### engine/creation.test.js (93) - A2 helpers + A5, T5/T6/T7
- Helpers: `CREATION_RULES` literal, `freeKey`, `attributePointCost` (R3 table, null outside), `attributeLeftover`, `karmaBonus` (0 unless closed, unpriceable, no table), `creationKarma` (Troll cap).
- `talentBudget` / `applyTalentRank`: 8 points, max Rank 3, only the five circle-1 names; Durability, Karma Ritual, free talents, Talent Options, other-Discipline and unknown names refused; 0..3 in one call; raise appends `{ name, rank, circle: 1 }`, lower to 0 removes row AND ledger key; over-spend shown (`valid: false`), never corrected; every refusal returns the SAME reference with a documented reason; frozen input untouched. **Rule:** R1.
- `attributeBudget` / `applyAttributePoints`: 25 points, R3 cumulative table, -2..+8, refunds, `raiseCost` / `lowerRefund`, `canRaise` needs cost <= left, `leftover` never negative, whole-cost over-budget check, `base`/`increases`/ledger untouched. **Rule:** R3.
- `skillBudget` / `applySkillAdd` / `applySkillRank` / `applySkillRemove`: fixed pools first (Knowledge 2, Artisan 1 from the Discipline list only, Speak 2, Read/Write 1) then the 8 extra; allocation derived from the stored set; third Knowledge pick, second Discipline-list Artisan pick, non-list Artisan pick, free-text `Artisan (text)` all spend extra; one Rank-1 entry per language; max Rank 3 incl. fixed ranks; text trimmed 1-40 chars no parentheses; language templates never take text; Impressive Display, Tactics and tier-2/3 general refused; duplicates case-insensitive; no-capacity pick refused; candidates (`generic`, `freeText`, `disciplineList`, `pool`, `canPick`; templates not offered). **Rule:** R5, R11.
- `spellBudget` / picks / `checkSpellMatrices`: magician only; total = Perception Step (ctx); cost = Circle 1-2; candidates are the Discipline's Circle 1-2 spells not known; catalog-canonical name stored; apostrophe-insensitive; remove releases the matrix; Circle-2 not placeable / `matrix-circle` only while open; `perceptionStep == null` => dashed (total/left null, nothing pickable); Perception lowered after picks => `valid: false`, Finish blocked. **Rule:** R6.
- `creationStatus` (`null`, exactly `{ open: false }`, budgets, `canFinish`, `blockers` naming each over-spend) and `finishPlan` / `finishCreation`: forfeits (fresh Archer 8 / 14 / 0), karmaBonus, Troll `3 + 25 => 20`, no cap 28, no modifier => Karma step skipped (`touched` has no `karma`), `converted += newMax - oldMax`, exact `creation` key sets, attributes untouched, `summary`, re-run `already-finished`, over-spend `invalid-budget`, everything refuses `creation-closed` after Finish. **Rule:** R3, R4, R10.
- **PROPERTY:** 400 deterministic random edits (valid and invalid) per Discipline never break an invariant: exact key sets, `free[k] === stored rank` for every stored talent/skill while open, no stored zero, seeded rows untouched, all budgets valid, rank caps, Legend audit total stays 0, the session can always be finished.

### store-creation-model.test.js (91) - A5, T5-T7
- `store.creationContext` (files, catalogs, `resolveSkill`, passed-through Perception step, `karmaModifier`, house `karmaMaxCap`, null cases).
- `deriveModel` for the builder output of every race x Discipline under the real rules: Legend 0/0/0, Karma sink 0, Karma starts full, `model.creation` shape (`talents.rows[].brief` = catalog `shortEffect`), `legendAuditOptions`; `model.creation === null` without a block; Nethermancer `model.spells` non-null with two empty Standard matrices, others `null`; spell budget total == derived Perception Step and follows an attribute edit.
- **Durability** (R1): rises Unconsciousness and Death by `durability x 1` under the standard rules, and by `Toughness Step x 1` under the real `hb-uncon-death` formula (see Notes).
- **Finish for every race x Discipline** (nothing spent): `converted = min(Modifier + 25, cap)`, Legend stays 0/0/0, sink 0, `available == max`, `model.creation` is `{ open: false }`; Troll cap case.
- `store.persistCreationEdit`: each touched category maps to its overlay writer and nothing else is written (no meta/wealth/items/health/legend); a reload through `applyEdits` reproduces the edited character exactly.
- **WALKTHROUGH** (Troll Nethermancer, cap 20): create -> spend every budget (8 talent points, 20 of 25 attribute points, all fixed skill ranks + 8 extra, all spell points) -> persist -> reload -> `finishPlan` (forfeits 0/0/0, bonus 5, `min(3 + 5, 20) = 8`) -> Finish -> reload -> Legend 0/0/0, sink 0, attribute points locked -> a raise costs exactly one normal step (e.g. Rank 3 -> 4), `affordable` false at Available 0, true with earned Legend and then spends exactly the step; Karma bought afterwards is charged beyond the creation Karma only. Plus a mid-creation resume.

## Not covered (and why): manual verification by the owner
No browser harness exists, so these are left to the owner (spec "Testability notes" and "UI / behavior"):
- **Loader (B1):** the "Start a new character" section (one "+" button per Discipline, inline SVG glyph, empty-store hint), draft rows with the "unsaved draft" badge and Discard X (sibling buttons, keyboard reachable), `stopPropagation` of the child `close`/`confirm` events so only the top modal closes, Enter/Escape/focus return in the picker, new-character modal, rename modal, discard confirm. Good = Escape closes only the top modal, Enter confirms the primary, focus returns to the "+" trigger, light and dark both legible, weights 400/500 only.
- **Wiring (B2):** first-run empty store opens the picker with only the new-character section (no error), a real list failure still shows the error, drafts never autosave or flush on hide, "Discard local changes" hidden on a draft, a reload reopens the selected draft in edit mode, first Save against `tools/dev-server.mjs` (never the live branch): file + index row appear, draft becomes a normal saved character; clash at the modal and at first Save show the warning/rename modal and post nothing.
- **Creation UI (B3/B4):** talent/skill steppers and chips, Overview attribute `-`/`+` and "Points left" chip fit the desktop viewport with no vertical scroll and fold to one column on mobile, light/dark, the skill picker (pool badges, free-text field with its own Add), the spell picker and "Spell points left N / Perception Step M" chip (dashed pill when unresolvable), Finish button disabled with a `title` listing blockers, the Finish confirm (message, warn line, Escape cancels, Enter confirms), a refused or cancelled confirm changes nothing, saved characters look and behave exactly as before.
- **`ui/ed-app.js` guards:** `_canAffordRank` / `_legendTotalEarnt` are DOM-bound; their agreement is tested through `model.legendAuditOptions` and the deriveModel Legend-0 rule (the guard equivalence in `store-creation-audit.test.js`), not by importing the component.
- **`tools/check-ui-kit.mjs` / `tools/check-imports.mjs`** (B5): part of `npm test`'s `pretest`; both currently pass and must stay green.

## Notes for the orchestrator and dev
1. **Spec vs data nuance (Durability).** The spec says Unconsciousness/Death "rise by `durability x 1`" under the real rules, but the real `rules/homebrew.json` enables `hb-uncon-death`, whose formula replaces the adept synthesis: both ratings rise by `Durability Rank x Toughness Step`. The tests assert BOTH truths (standard rules: `durability x 1`; real homebrew: `Toughness Step x 1`); both only need the seeded Durability row. No code or data change is implied.
2. **Reason codes.** `not-allowed-category` appears in the spec's list but no rule pins when it is used. The tests accept it as an alternative to `over-budget` only for a skill pick with no capacity; every other refusal asserts its documented code.
3. **Choices the spec leaves open that the tests rely on:** candidates exclude the two language templates and either omit or flag `canPick: false` for tier-2+ general skills; a lowered `ledger` key is deleted (never `0`); with `creation` present, the Karma historic line is `paid - events` so the section lines sum to the section total; `checkSpellMatrices` returns `{ ok: true }` when creation is closed; `skillBudget.rows[].canLower` is false at Rank 1 (removal is a separate action).
4. **Red from the start by design.** Per `/build-feature`, tests precede code, so slices ahead of the current one are red; use the per-slice table above. The golden files must be green at every step.
5. **Validation done by the tester (not delivered):** the tests were run against a throw-away reference implementation kept outside the repo in the session scratchpad (all ~460 cases pass there), and mutation-checked (about 55 seeded defects across audit, pricing, ledger, budgets, finish, builder, drafts, first save and `listCharacters`; all killed except one equivalent mutation, and the one real survivor, a deep-merging `creation` overlay, led to an added assertion). The reference implementation is not part of the deliverable and no non-test source in the repo was touched. Because it is one reading of the spec, expect the dev to find a few places where a different reading is legitimate: dispute those through `NEEDS_TESTER` (one adjudication cycle).

## How to run
`npm test` (runs `check-imports` and `check-ui-kit` first, then `node --test`). Single files: `node --test <path>`.
