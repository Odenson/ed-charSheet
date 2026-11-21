# Tech Spec: Start a new Discipline (start-new-discipline)

## Overview
Add an edit-mode "Add Discipline" / "Seed Circle 1" modal to the Disciplines tab. A pure engine quote (`initiationQuote` in `engine/talent-options.js`) derives the unknown Circle-1 Discipline Talents, the optional Circle-1 option pool, the per-talent Legend and the default silver fee. The store exposes it as `model.addableDisciplines`, and a new `ed-start-discipline` handler in `ui/ed-app.js` validates, charges Legend (all-or-nothing) and silver (purse), persists only `disciplines[]` inputs, and logs. A prerequisite audit fix (`lowestPriorCircle`) makes the Rank-1 price row "lowest Circle among Disciplines BEFORE this one" everywhere, so the quote, guard and sheet Legend agree.

Dev Lead decision (plan open question 2 accepted): a partially seeded Circle-1 Discipline grants and prices ONLY its missing Circle-1 DTs.

## Guardrail alignment
All Tier 3 (plan Guardrail classification; qa-log confirms no Tier-1 sign-off needed).
- I1/I3: new pure derived helpers and model field. No schema change.
- I2: bug fix restoring ruled R2 behaviour (owner approved, qa-log 2026-11-21). Derived Legend only; no stored data changes.
- I4: stores only `disciplines[]` `{name, circle, talents:[{name, rank, circle}]}` (`ed-character/2` unchanged). No tier, free-talent or derived fields stored.
- I5: UI uses `ui/kit` (`ModalController`, `modalFrame`); data flows down via `model`, events up via `ed-start-discipline`; the view computes no game values (it reads the quote). Unpriceable values use the dashed placeholder pill.
- No taxonomy change (no Tier 2). The fee constant is an engine constant, not a `rules/*.json` edit.
No Tier-1 item missed.

## Design
### Data / types
- No schema change. Persisted effect of the action: fresh -> append `{ name, circle: 1, talents: [{ name, rank: 1, circle: 1 }, ...] }` to `disciplines[]`; seed -> append missing `{name, rank:1, circle:1}` entries to the existing Discipline's `talents` (its `circle` is never altered, no duplicates). Coins change through `saveWealthEdits`.
- Quote candidate (derived, never stored):
  `{ discipline, mode: 'new'|'seed', ordinal, lowestCircleBefore, feeBase, grants: string[], optionPool: {available, items}, optionSlotOpen: boolean, perTalentLegend: number|null, legendTotal(withOption): number|null, defaultSilver(withOption): number }` (the last two as precomputed fields or small functions; the view only reads them).
- `export const NEW_DISCIPLINE_FEE_PER_CIRCLE = 100` in `engine/talent-options.js` with a comment citing rules.md R3 (Q038; PG:17261-17264, 17305-17315).

### Modules & functions
1. `engine/legend-spent.js`
   - Add `export function lowestPriorCircle(disciplines, idx)`: minimum `circle` over indices `< idx` (ignoring null circles); `null` when `idx` is 0 or none.
   - Audit loop (line ~325): replace the single `lowestCircle = lowestDisciplineCircle(disciplines)` with `lowestPriorCircle(disciplines, idx)` inside `disciplines.forEach`. Update the doc comments at ~245 (`talentRankStepCost` param) and ~139.
   - Keep `lowestDisciplineCircle` exported (tests import it); it is no longer used for pricing.
2. `store.js`
   - Line 14 import `lowestPriorCircle`. Line 1053 (`advanceCost` perDT): pass `lowestPriorCircle(character.disciplines, dIdx)`. Lines ~1437-1444 (rank stepper increase/refund): compute the lowest per Discipline index, not one global `lowestCircle`.
   - `deriveModel` returns `model.addableDisciplines` (array from `addableDisciplines(...)`, option pool items enriched with `brief`/`shortEffect` like the `learnable` enrichment near store.js:1037), `[]` when none. Inputs: `disciplinesFile.disciplines`, `character.disciplines`, `legendFile.costs`, `tierShift`. Never in `forSave()`.
3. `engine/talent-options.js`
   - `initiationQuote(ref, disciplines, costs, { tierShift })` and `addableDisciplines(refs, disciplines, costs, { tierShift })` (the wrapper maps every rules Discipline to a candidate or omits it).
   - Fresh (Discipline not on character): `ordinal = disciplines.length + 1`, `lowestCircleBefore = lowestPriorCircle(disciplines, disciplines.length)`, `feeBase = sum(all existing circles)`, `grants` = Circle-1 `circles[circle===1].talents` minus known names, minus `UNIVERSAL_TALENTS`, minus free talents. `Thread Weaving (X)` is a distinct name per Discipline (another Discipline's variant is not "known").
   - Seed (Discipline at index i with `circle === 1` and missing >=1 Circle-1 DT): `ordinal = i + 1`, `lowestCircleBefore = lowestPriorCircle(disciplines, i)`, `feeBase = sum of the OTHER Disciplines' circles`, `grants` = only the missing DTs.
   - Excluded (no candidate): Discipline absent from rules; present at Circle > 1; present at Circle 1 with all Circle-1 DTs known; ordinal 1 (index 0, unpriceable via `newDisciplineRank1Cost`).
   - `optionPool = learnableTalents(ref, 1, { costs, knownNames })`; if `optionSlots(ref, talents, 1)[0]` is filled (seed case), `optionPool` is `{available:true, items:[]}` and `optionSlotOpen = false`; the fee/Legend never include an option.
   - `perTalentLegend = talentRankStepCost({circle:1}, ordinal, lowestCircleBefore, costs, 1, { tierShift })` (single price source, equals the audit; `null` when unpriceable, never 0). Equivalent under tierShift to `additionalDisciplineTalentCost(1, 1, ordinal, lowest, costs, {tierShift, tier:'Novice'}).cost`.
   - `defaultSilver(withOption) = NEW_DISCIPLINE_FEE_PER_CIRCLE * feeBase * (grants.length + (withOption && optionSlotOpen ? 1 : 0))`; `legendTotal(withOption) = perTalentLegend * the same count`, `null` if `perTalentLegend` is null.
4. `store-log.js`: add `logDisciplineStarted` following `logCircleTraining` / `logTalentLearned` (`logSystem`, `formatWealthDetail`, `formatCoinDelta`). Label `Started <Discipline>` (new) or `Seeded <Discipline> Circle 1` (seed). Fields: discipline, circle:1, grants (names incl. option), legendCost total, silverFee, coinDelta, purseBefore/After.
5. `ui/ed-app.js`
   - Import line ~17: add `lowestPriorCircle`; line ~1267 (`_learnTalent` log): per-index prior-Circle value instead of `lowestDisciplineCircle`.
   - Wire `this.addEventListener('ed-start-discipline', e => this._startDiscipline(e.detail))` beside lines 443-448.
   - `_startDiscipline({ discipline, option, silver })`, mirroring `_advanceCircle` order: (1) find candidate in `this._model.addableDisciplines`, else no-op (covers unknown, complete, duplicate dispatch); (2) `option` must be null or in `optionPool.items` AND `optionSlotOpen` (re-check via `optionSlots`), else refuse; (3) build talents `{name, rank:1, circle:1}` for grants (+ option); (4) fresh append or seed extend; (5) fee = `Math.max(0, Math.round(Number(silver)))` (NaN -> refuse); `payFromPurse(coins, fee)`; refuse with no mutation if `!ok`; (6) `_canAffordRank(nextCharacter)` else refuse; (7) `saveAdvancementEdits({disciplines, skills}, id)` (full arrays as `_learnTalent` does), `saveWealthEdits` when fee > 0, `_markDirty()`, `this._derive()`; (8) `logDisciplineStarted` (Legend total via the same `talentRankStepCost`/`lowestPriorCircle` source).
6. `ui/ed-disciplines.js`
   - Edit-mode "＋ Add Discipline" button in the `_legendBar()` header region (hidden when `model.addableDisciplines` is empty). "Seed Circle 1" button on the card/Circle track of a Discipline that has a `mode:'seed'` candidate. Both go through `_openModal(...)` with `{type:'start-discipline', discipline?}`; entering edit mode first on launch follows `_trainClick`.
   - State fields (like `_trainSilver`): selected Discipline, chosen option (null default), silver text, `silverEdited` flag. Add `_startState()`, `_startModal()`, `_confirmStart()`, `_startPick()` mirroring `_advanceState`/`_advanceModal`/`_confirmAdvance`/`_advancePick` (~895-963); add the `start-discipline` branch where `_openModal` types render.
7. Docs/data: `plans/PLAN-LEARN-TALENTS.md` (~line 165, Q1 scope note); `docs/UI-GUIDELINES.md` only if it enumerates Disciplines-tab contents; `data/changelog.json` (note: the repo changelog is `data/changelog.json`, not `CHANGELOG.md` as plan I6 says).

### UI / behavior
- Modal body (via `modalFrame`; only `modalFrame`/`modalCss`/`ModalController` from `ui/kit`): Discipline `<select>` of addables (pre-selected and disabled when launched from Seed); read-only list of auto-granted DTs with per-talent Legend pill; option picker (list/radio, default "No option for now", each with its `brief`; hidden/disabled with a note when `optionSlotOpen` is false or the pool is empty); summary rows reusing `.crow/.cchk/.silin`: Legend total vs Available Legend (check), editable silver pre-filled from `defaultSilver(hasOption)` (re-seeded when the option choice changes unless `silverEdited`), purse check; a note that tutor/time are the GM's call.
- Primary button `Start Discipline` (new) / `Seed Circle 1` (seed), disabled with a `title` reason when Legend short, purse short, silver invalid, or any price is null. A null price renders the dashed placeholder pill and disables confirm; never a fabricated 0.
- Escape closes (kit). Enter confirms only when allowed (`data-enter="local"` on the silver input, as Train). Confirm dispatches `ed-start-discipline` `{discipline, option, silver}` then `this._modalCtl.close()`.
- Light and dark themes via existing tokens; mobile single column must still fold; Overview untouched.

### Rules
| Rule | Value / formula | Source |
|---|---|---|
| R1 | Initiation grants every unknown Circle-1 DT at Rank 1, simultaneously, Discipline at Circle 1; known skipped | rules.md R1 (Q038; PG:17278-17280, 17294-17314) |
| R2 | Rank-1 price from `legend.json costs.newDisciplineRank1`: row = lowest Circle among Disciplines BEFORE this one (indices < ordinal-1), column = ordinal (clamped 4+); e.g. Thief 4 -> Warrior (ordinal 2) 300 per DT | rules.md R2 (Q038; PG:17282-17283, 17361-17372) |
| R3 | Default silver = 100 sp x SUM of Circles in OTHER Disciplines x talents learned; editable, paid from purse, refused if short | rules.md R3 (Q038; PG:17261-17264, 17305-17315; owner decision) |
| R4 | Circle-1 option priced like a DT (same Rank-1 price) and counted in the fee when picked; skipping costs nothing, slot stays open | rules.md R4 (owner decision 2026-11-21; price NOT-COVERED in book) |
| R6 | Thread Weaving (X) distinct per Discipline; Durability/Karma Ritual universal, not re-bought; free talents never granted | rules.md R6 (Q038) |
| R7 | Durability highest-wins, Defense no stack, free talents at Discipline Circle: already derived; verification only | rules.md R7 (Q036, Q038) |
| R5 | Tutor / 40 h / GM gating: NOT enforced (non-goal) | rules.md R5 |
Worked expected values: Kolon (Thief Circle 4) + Warrior (ordinal 2, Circle 1, 5 DTs: Avoid Blow, Melee Weapon, Thread Weaving (Warrior), Tiger Spring, Wood Skin) = 5 x 300 = 1500 Legend; default silver 100 x 4 x 5 = 2000 sp; with a picked option (6 talents) silver 100 x 4 x 6 = 2400 sp and Legend 6 x 300 = 1800.

### Edge cases & invariants
- Stored data contains no derived values; `forSave()` never includes `addableDisciplines`.
- Refusals (Legend short, purse short, invalid option/slot, unknown/complete Discipline) mutate nothing and write no log.
- Duplicate dispatch after success is a no-op (Discipline then complete).
- Seed never changes `circle` or existing talents; partially seeded grants only missing DTs; if its Circle-1 option slot is already filled, no option is offered or charged.
- Ordinal-1 Discipline at Circle 1 with missing DTs is not a candidate.
- Non-last seed uses only earlier Disciplines for the price row (Thief 4, Warrior 1, Archer 1: Warrior stays 300, not 1300).
- `tierShift > 0` quote equals the audit delta.
- `rankStepCost == audit(after) - audit(before)` for the rank stepper after I2.
- Legend totals for every `data/characters/*.json` change only where an additional Discipline was priced from a row including itself/later Disciplines; list (character, old, new) in PR notes.
- No Discipline left to add -> `[]`, no Add button.

## Testability notes
- `engine/talent-options.test.js`: `initiationQuote`/`addableDisciplines` cases per plan I1 (Kolon Warrior 5 x 300; 3rd ordinal and column; known skip; Thread Weaving variant; fee with/without option; seed empty Warrior; partial seed grants only missing; option slot already filled -> empty pool and no option in fee; ordinal-1 excluded; null price not 0; tierShift equals audit; none left -> empty).
- `engine/legend-spent.test.js`: `lowestPriorCircle`; audit Kolon + Warrior at Circle 1 with 5 Rank-1 DTs = 1500 (not 6500); Thief 4 / Warrior 1 / Archer 1 case; adjust existing assertions (~147-149, 296-298, 372) only where values legitimately change and record each.
- New `store-start-discipline.test.js` (mirroring `store-advancement.test.js`): model exposes seed/new candidates; the pure parts of persistence shape, refusal without mutation, log. `_startDiscipline` is in `ui/ed-app.js` (DOM component): if not directly importable, extract the build/validate step into a pure helper for testing (e.g. `buildDisciplineStart(candidate, option, silver, character, purse)` in `engine/talent-options.js`) and keep the handler thin. Stepper-vs-audit delta test at store level.
- `npm test` plus `tools/check-ui-kit.mjs`; a before/after Legend diff over `data/characters/*.json`.
- Owner manual verification (not unit-testable): Escape closes; Enter confirms only when allowed; disabled-confirm reasons; unpriceable placeholder pill; light and dark; mobile fold; seed launch from the Warrior card on kolon-v2. Tests must not modify real character data files.

## Changelog entry
{"type": "added", "text": "Start a new Discipline from the Disciplines tab in edit mode (or seed Circle 1 of a Circle-1 Discipline missing its talents): learns all Circle-1 Discipline Talents, optionally a Circle-1 Talent Option, and charges Legend and an editable silver fee."}
Also (changed/fixed): {"type": "fixed", "text": "Legend Spent now prices an additional Discipline's Rank-1 talents from the lowest Circle among the Disciplines you had before joining it."}

## Out of scope
Tutor / 40-hour / GM-approval gating; Versatility; converting a known option into a DT; new Disciplines in rules data (only Archer, Nethermancer, Thief, Warrior); changes to existing Circle-training or option flows; modifying/committing real character data; any `rules/*.json`, schema or taxonomy change.
