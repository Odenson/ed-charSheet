---
status: building
---
# Delivery Plan: Start a new Discipline (start-new-discipline)

## Context & learnings
The Disciplines tab can raise ranks, fill Talent Option slots and train a Circle, but cannot initiate a Discipline. Owner decisions (qa-log.md):
- One edit-mode modal: pick a Discipline, see the auto-granted Circle-1 Discipline Talents (all unknown ones, Rank 1, no ticking), optionally pick one Circle-1 Talent Option (skippable, stays an open slot), see Legend + an editable silver fee, confirm.
- Legend is all-or-nothing against Available Legend. Silver default = 100 sp x SUM of Circles in other Disciplines x talent count (option included when picked); editable; paid from the purse via `payFromPurse`; refused if the purse is short.
- The Circle-1 option is priced like a DT (same Rank-1 New-Discipline-table price; rules.md R4, owner ruling).
- The same modal "Seeds Circle 1" for an existing Circle-1 Discipline missing its Circle-1 DTs (kolon-v2 Warrior has `circle: 1, talents: []`).
- Non-goals: tutor / 40 h / GM gating, Versatility, option-to-DT conversion, new Disciplines in rules data, changes to existing Circle-training/option flows.
- All Tier 3; no Tier-1 sign-off exists or is needed.

## Discoveries
- `engine/talent-options.js` (90 lines) holds the pure helpers to extend: `disciplineTalentSet`, `freeTalentSet`, `optionSlots`, `learnableTalents(ref, circle, {costs, knownNames})` (Circle 1 gives the Novice pool minus known), `nextCircleGrant`. `UNIVERSAL_TALENTS` = Durability, Karma Ritual. Tests live in `engine/talent-options.test.js`.
- `engine/legend-spent.js`: `newDisciplineRank1Cost(lowestCircle, ordinal, costs)` (null for ordinal 1), `talentRankStepCost(t, ordinal, lowestCircle, costs, toRank, {tierShift})`, `lowestDisciplineCircle(disciplines)`, `auditLegendSpent`.
- `ui/ed-app.js`: `_learnTalent` (1243), `_advanceCircle` (1381) are the templates. They use `_canAffordRank(nextCharacter)` (1186), `payFromPurse` (engine/wealth.js:150), `saveAdvancementEdits({disciplines, skills}, id)`, `saveWealthEdits`, `_markDirty`, `this._derive()`. Event wiring is at ed-app.js:443-448 (`ed-learn-talent`, `ed-advance-circle`).
- `store-log.js`: `logCircleTraining` and `logTalentLearned` are the standard-log templates (`logSystem`, `formatWealthDetail`, `formatCoinDelta`); a new `logDisciplineStarted` follows them.
- `ui/ed-disciplines.js`: modals use `ModalController` + `modalFrame` from `ui/kit/`; `_advanceModal` / `_advanceState` / `_confirmAdvance` / `_advancePick` (895-963) show the cost-row and `data-enter="local"` silver-input pattern, and `_openModal(entry, e)` dispatches by `type`. `_legendBar()` is the edit-mode header region (line ~1255) and is a natural home for the entry control.
- `store.js` per-Discipline derivation is at 916-1068 (`optionSlots`, `nextGrant`, `advanceCost`); the model returns `skillOptions`/`knackOptions` at ~1846 (pattern for exposing an addable-Disciplines quote). `disciplinesFile.disciplines` is available (`discByName`, store.js:713).
- Rules data: Archer, Nethermancer, Thief, Warrior each have Circle-1 DTs including a distinct `Thread Weaving (<Discipline>)`; Warrior has no `freeTalents`. Free talents are derived, never stored, and are never granted here.
- **Hazard (pricing mismatch):** `auditLegendSpent` (legend-spent.js:325) and `advanceCost` (store.js:1053) take the lowest Circle across ALL current Disciplines, including the one being added/seeded. Once the new Discipline sits at Circle 1 the audit would price its Rank-1 DTs from row 1 (1300 each), not the row of the lowest Circle BEFORE joining (R2; Kolon Thief 4 -> 300 each). So `_canAffordRank` and the Legend panel would disagree with the quote. This must be fixed (I2) or the modal's quote, guard and sheet Legend will not match. It also means kolon-v2's already-stored Warrior Circle 1 is priced against row 1 as soon as it has talents.
- kolon-v2 (data/characters/kolon-v2.json): Warrior is the 2nd Discipline at `circle: 1, talents: []`; the other Discipline (Thief) is at Circle 4.
- Existing test patterns: `store-advancement.test.js`, `store-ranks.test.js`, `engine/legend-spent.test.js`, `engine/talent-options.test.js`; `check-ui-kit` (`tools/check-ui-kit.mjs`) enforces kit usage for modals.
- docs/PLAN-LEARN-TALENTS Q1 says "New-Discipline initiation ... out"; plans/PLAN-LEARN-TALENTS.md:165 needs a scope note.

## Guardrail classification
| Item | Tier | Note |
|---|---|---|
| I1 engine quote/grant | 3 | New pure helpers, no schema change |
| I2 audit row fix | 3 (bug fix restoring documented R2 behaviour) | Changes derived Legend for characters with an additional Discipline; owner approved (qa-log.md); no stored data changes |
| I3 model exposure | 3 | Derived only |
| I4 handler + log | 3 | Stores `disciplines[]` `{name, circle, talents[{name,rank,circle}]}` only; `ed-character/2` shape unchanged; no derived/tier fields |
| I5 modal UI | 3 | Uses ui/kit; placeholder pills, Escape/Enter, light+dark per Tier-1 UI rules (kept intact) |
| I6 verify/docs | 3 | |
No Tier-1 items; no sign-off required (qa-log.md confirms). No taxonomy change (Tier 2 not triggered).

## Rules dependencies
- R1 (rules.md, ANSWERED, Q038): initiate learns all unknown Circle-1 DTs at Rank 1, start at Circle 1. I1, I4.
- R2 (ANSWERED): Rank-1 price row = lowest Circle BEFORE joining; column = ordinal (clamped 4+). I1, I2, I4.
- R3 (ANSWERED + owner decision): silver 100 x summed Circles x talents; editable default, purse. I1, I4, I5.
- R4 (NOT-COVERED price; owner decision recorded): option priced like a DT, counted in the fee. I1, I4.
- R5 (not enforced, non-goal), R6 (known skipped; Thread Weaving distinct; universals not re-bought) I1.
- R7 (derived effects already handled by the engine) verification only (I6).
No open NEEDS_RULES.

## Implementation items
### I1 — Engine: initiation quote and grant (pure)
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4, R6
- **Tier:** 3
- **What:** Add to `engine/talent-options.js` a pure `initiationQuote(ref, disciplines, costs, { tierShift })` (and a small `addableDisciplines(refs, disciplines, costs)` wrapper) returning per Discipline candidate: `grants` (unknown Circle-1 DTs, excluding `UNIVERSAL_TALENTS` and free talents, Thread Weaving variant included), `optionPool` (`learnableTalents(ref, 1, {costs, knownNames})` minus known; EMPTY when the Circle-1 option slot is already filled per `optionSlots`, in which case the fee also excludes any option), `ordinal`, `lowestCircleBefore`, `perTalentLegend` (single source for all cases: `talentRankStepCost` / `additionalDisciplineTalentCost(1, 1, ordinal, lowestPriorCircle, costs, {tierShift, tier:'Novice'})`; null when unpriceable), `feeBase` (sum of Circles of the OTHER Disciplines, kept separate from the pricing row per R3), `optionSlotOpen` (Circle-1 slot state via `optionSlots`), `defaultSilver(withOption)` = 100 x feeBase x (grants.length + (option ? 1 : 0)), and `mode: 'new' | 'seed'`.
- **Where:** `engine/talent-options.js`, `engine/talent-options.test.js`; import `lowestPriorCircle` (I2) from `engine/legend-spent.js`. DECISION: the 100 sp/Circle fee is a named engine constant (`NEW_DISCIPLINE_FEE_PER_CIRCLE = 100`) with a comment citing rules.md R3 (Q038; PG:17261-17264, 17305-17315). No `rules/legend.json` change (avoids touching a rules data file / schema refs).
- **Approach:** Fresh case: ordinal = disciplines.length + 1, lowestCircleBefore = `lowestPriorCircle(disciplines, disciplines.length)` (all existing, all earlier), feeBase = sum of their Circles. Seed-in-place (Discipline at index i, `circle === 1`, lacking one or more Circle-1 DTs): ordinal = i + 1, lowestCircleBefore = `lowestPriorCircle(disciplines, i)` (indices < i only, identical to what the audit uses), feeBase = sum of the OTHER Disciplines' Circles. A Discipline is excluded when absent from rules, present at Circle >1, present at Circle 1 with all DTs known, or at ordinal 1 (index 0; unpriceable by `newDisciplineRank1Cost`; tested). If the Circle-1 option slot is already filled in a partially seeded Discipline, `optionPool` is empty. Homebrew `tierShift > 0`: the Rank-1 table is ignored by the audit (legend-spent.js:210); the quote prices via `additionalDisciplineTalentCost(1, 1, ordinal, lowest, costs, {tierShift, tier:'Novice'})` so it always equals the audit.
- **Dependencies:** none (pure).
- **Acceptance criteria:** Unit tests: Kolon (Thief 4) -> Warrior 5 DTs at 300 each; 3rd Discipline ordinal 3 and its column; known-talent skip; Thread Weaving variant required (and the other Discipline's variant is not treated as known); fee with/without option; seed-in-place of empty Warrior (ordinal 2, lowest among others = 4); partially-seeded Discipline grants only the missing; no addable Discipline -> empty; tierShift quote equals audit delta; unpriceable returns null (not 0); ordinal-1 Discipline at Circle 1 with missing DTs is excluded; seed of a non-last Discipline with a LATER Discipline at Circle 1 uses only earlier Disciplines for the row (Thief 4, Warrior 1, Archer 1: Warrior stays 300, not 1300); partially seeded Discipline with its Circle-1 option already known returns an empty optionPool and a fee without an option.
- **Risks / unknowns:** Seed-in-place for a Discipline that has some but not all DTs at Circle 1: handled as grant-the-missing; confirm acceptable (Open questions).

### I2 — Audit/pricing: Rank-1 row uses the lowest Circle among PRIOR Disciplines
- **Covers tickets:** T1, T2 (prerequisite for a correct guard)
- **Rules:** R2
- **Tier:** 3 (bug fix restoring R2); derived Legend only, no stored data. Owner approved the audit fix (qa-log.md, 2026-11-21).
- **What:** Add `lowestPriorCircle(disciplines, idx)` to `engine/legend-spent.js`: the minimum Circle over indices `< idx` (null when idx is 0). It is the single definition of the "before joining" row, used by the audit, `advanceCost`, every `talentRankStepCost` caller and I1. `feeBase` (sum of OTHER Disciplines' Circles, R3) is separate and unaffected.
- **Where / every call site:** `engine/legend-spent.js:325` (audit loop, pass the per-index value; update the doc comment at :245), `store.js:1053` (`advanceCost` perDT, use `lowestPriorCircle(character.disciplines, dIdx)`), `store.js:1437-1444` (rank stepper increase/refund, per-Discipline value, not one global `lowestCircle`), `ui/ed-app.js:1267` (`_learnTalent` log, per-index), and the new `_startDiscipline` log (I4). `_canAffordRank` is not a direct caller (it uses `auditLegendSpent`). `talentRankStepCost` takes the lowest Circle per Discipline, so call sites must pass the per-index value.
- **Approach:** Keep `lowestDisciplineCircle` only for non-priced uses (or drop its pricing use entirely). Update `legend-spent.test.js` (around lines 147-149, 296-298, 372) only where values legitimately change, and record each change.
- **Dependencies:** none (owner approval recorded).
- **Acceptance criteria:** Fresh Kolon + Warrior at Circle 1 with 5 Rank-1 DTs audits at 5 x 300 = 1500 (not 6500); Thief 4 / Warrior 1 / Archer 1: Warrior's row is not derived from Archer's Circle 1 (test); `rankStepCost == audit(after) - audit(before)` for the rank-stepper path (store-level test) and for `_learnTalent`; run `npm test` and diff Legend totals for all `data/characters/*.json` before/after. PR notes must list each changed character as (character, old total, new total); any recorded/delta Legend display for those characters shifts.
- **Risks / unknowns:** Changes derived Legend Spent for any character whose additional Discipline is currently priced from a row that includes itself or later Disciplines. Later Circle growth in earlier Disciplines still moves the row (recomputed approximation, as today).

### I3 — Model: expose addable Disciplines with their quote
- **Covers tickets:** T2
- **Rules:** R1-R4
- **Tier:** 3
- **What:** `deriveModel` returns `model.addableDisciplines` (array from I1's wrapper, enriched with each talent's `shortEffect` brief for the option pool, matching the `learnable` enrichment at store.js:1037), or `[]`.
- **Where:** `store.js` (near `skillOptions`/`knackOptions`, ~1473 and ~1846); `store-advancement.test.js` or a new `store-start-discipline.test.js`.
- **Approach:** Pass `disciplinesFile.disciplines`, `character.disciplines`, `legendFile.costs`, `tierShift`. Derived only; never in `forSave()`.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** Model for kolon-v2 lists Warrior as `mode:'seed'` with 5 grants at 300; for a character with all four Disciplines the list is empty; Archer/Nethermancer for kolon-v2 appear as `mode:'new'` with ordinal 3 (if present on the character).
- **Risks / unknowns:** none.

### I4 — App handler `ed-start-discipline`, persistence, log
- **Covers tickets:** T2
- **Rules:** R1-R4
- **Tier:** 3
- **What:** Add `this.addEventListener('ed-start-discipline', e => this._startDiscipline(e.detail))` (ed-app.js ~443) and `_startDiscipline({ discipline, option, silver })`: (1) look up the candidate in `this._model.addableDisciplines` (rejects unknown, or already complete); (2) validate `option` is null or in `optionPool` AND the Circle-1 option slot is still open (re-check via `optionSlots`); (3) build grants `{name, rank:1, circle:1}` plus the option at `circle:1`; (4) fresh -> append `{name, circle:1, talents}`; seed -> extend the existing Discipline's `talents` (never alter `circle`, never duplicate); (5) silver: `Number(silver)` rounded >= 0, `payFromPurse(coins, fee)`; refuse (no mutation) if `!ok`; (6) `_canAffordRank(nextCharacter)` else refuse; (7) `saveAdvancementEdits`, `saveWealthEdits` when fee > 0, `_markDirty`, `_derive()`; (8) `logDisciplineStarted` (new in `store-log.js`: label `Started <Discipline>` or `Seeded <Discipline> Circle 1`, detail with talents and `formatWealthDetail`, fields discipline, circle:1, grants, legendCost total, silverFee, coinDelta, purseBefore/After).
- **Where:** `ui/ed-app.js`, `store-log.js`, import line ~18; tests in `store-start-discipline.test.js` (store-level, mirroring `store-advancement.test.js`) and `store-log` coverage if a log test file exists (else add to the new test).
- **Approach:** Mirror `_advanceCircle` order. Legend cost for the log = sum of Rank-1 step costs via `talentRankStepCost`/`additionalDisciplineTalentCost` with `{tierShift, tier:'Novice'}` and `lowestPriorCircle` (same single source as I1). Overlay stores the FULL disciplines/skills arrays (as `_learnTalent` does); knacks overlay passthrough per `saveAdvancementEdits` behaviour stays as is.
- **Dependencies:** I1-I3.
- **Acceptance criteria:** Round-trip persists `{name, circle:1, talents:[{name,rank:1,circle:1}...]}` with no derived/tier fields (`forSave()`); unaffordable Legend or silver refuses with no mutation; option skipped leaves the Circle-1 slot open and `optionSlots` shows `open`; coins reduce with change; log entry written; seed leaves other talents/circle untouched; duplicate dispatch is a no-op; an option dispatched when the slot is already filled is refused.
- **Risks / unknowns:** Event ordering when launched from a non-edit state: view enters edit mode first (see I5), like `_trainClick`.

### I5 — UI: "Add Discipline" / "Seed Circle 1" modal
- **Covers tickets:** T3
- **Rules:** R1-R4 (display only)
- **Tier:** 3 (Tier-1 UI rules observed)
- **What:** In `ui/ed-disciplines.js`: (a) edit-mode "＋ Add Discipline" button in the Disciplines header region (hidden when `model.addableDisciplines` is empty; a muted note instead is optional); (b) a "Seed Circle 1" button on the Circle track/header of a Discipline whose `mode:'seed'` candidate exists; both open a new `{type:'start-discipline'}` modal via `_openModal`. Modal body: Discipline `<select>` (only addables; pre-selected for seed; disabled when launched from a seed), read-only list of auto-granted DTs with per-talent Legend, optional option picker (radio/list with a "No option for now" default, using each option's `brief`), summary rows reusing `.crow/.cchk/.silin` (Legend total vs Available with check, editable silver pre-filled from `defaultSilver(hasOption)` re-seeding when the option choice changes unless the user edited it, purse check), note that tutor/time are the GM's call. `primary: { label: 'Start Discipline' | 'Seed Circle 1', disabled, title }`. Confirm dispatches `ed-start-discipline` `{discipline, option, silver}` and closes via `this._modalCtl.close()`.
- **Where:** `ui/ed-disciplines.js` (state fields like `_trainSilver`; mirror `_advanceState` / `_confirmAdvance` / `_advancePick` / `_advanceModal`); add a `start-discipline` branch wherever `_openModal` types are rendered.
- **Approach:** Use only `modalFrame`/`modalCss`/`ModalController` from `ui/kit`; Enter confirms only when allowed (`data-enter="local"` on the silver input, same as Train); Escape closes via kit. Unpriceable per-talent Legend (null) renders the dashed placeholder pill and disables confirm (never a fabricated 0). Entering edit mode on launch follows `_trainClick`. No computation in the view beyond summing values supplied by the model/engine; if sums are needed, add `legendTotal(withOption)` to I1's quote so the view only reads it.
- **Dependencies:** I3, I4.
- **Acceptance criteria:** Escape closes / Enter confirms; light and dark; unaffordable shows disabled confirm with reason; Overview unaffected; after confirm the new Discipline appears at Circle 1 (5 DTs + optional option) and the existing train-to-next-Circle flow reads correctly; `npm run` UI-kit check passes (`tools/check-ui-kit.mjs`, baseline untouched).
- **Owner manual verification (not coverable by node:test):** Escape closes; Enter confirms only when allowed; disabled-confirm reasons shown; unpriceable placeholder pill; light and dark themes; mobile/narrow viewport still folds; seed launch from the Warrior card on kolon-v2.
- **Risks / unknowns:** Header space in edit mode on narrow viewports (mobile single column must still fold).

### I6 — Verification, docs, changelog
- **Covers tickets:** T4
- **Rules:** R7 (verification)
- **Tier:** 3
- **What:** `npm test` green; in dev (`tools/dev-server.mjs`) seed kolon-v2 Warrior (5 DTs at Rank 1 at 300 each = 1500 Legend; Durability/Defense unchanged or highest-wins; Warrior free talents none), confirm the Circle-2 gate display, add a fresh Disciplines on another character if available. Docs: add a scope note to `plans/PLAN-LEARN-TALENTS.md` Q1 (initiation now covered by this feature); update `docs/UI-GUIDELINES.md` only if the Disciplines tab contents are enumerated there; add a changelog entry per repo convention (check `CHANGELOG.md` format).
- **Where:** docs/UI-GUIDELINES.md, plans/PLAN-LEARN-TALENTS.md, CHANGELOG.md.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** As T4; the owner runs the I5 manual-verification checklist; no real character data file is modified by tests.
- **Risks / unknowns:** Do not commit seeded character data unless the owner asks.

## Sequencing
1. I1 (pure quote) and I2 (audit row fix) first: everything else keys on a quote that equals what the audit later computes. I2 owner-approved.
2. I3 (model), then I4 (handler + log + store tests): behaviour verifiable without UI.
3. I5 (modal), then I6 (verify, docs, changelog).

## Open questions
1. RESOLVED per qa-log.md (2026-11-21): owner approved fixing the audit (I2).
2. Partially-seeded Circle-1 Discipline (some but not all DTs known): plan grants only the missing DTs and prices only those. Assumed acceptable.
3. RESOLVED: engine constant citing rules.md R3 (see I1).

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- F1 (major): fixed. Single `lowestPriorCircle(disciplines, idx)` (indices < idx) used by audit, `advanceCost`, step-cost callers and I1; `feeBase` kept separate; test added.
- F2 (major): fixed. I2 lists every call site (legend-spent.js:325, store.js:1053, store.js:1437-1444, ed-app.js:1267, new `_startDiscipline` log) with a stepper delta test.
- F3 (major): fixed. I1 returns an empty `optionPool` when the slot is filled; I4 re-validates the slot; tests added.
- F4 (minor): fixed. Ordinal-1 Disciplines excluded from candidates and tested.
- F5 (minor): fixed. Single price source (`talentRankStepCost`/`additionalDisciplineTalentCost` with tierShift/Novice) for I1 and I4.
- F6 (minor): fixed. Named engine constant citing rules.md R3 (PG:17261-17264, 17305-17315); no legend.json change.
- F7 (minor): fixed. Open question 1 closed; I2 requires the (character, old, new) diff in PR notes.
- F8 (minor): fixed. Owner manual-verification checklist added to I5/I6.
