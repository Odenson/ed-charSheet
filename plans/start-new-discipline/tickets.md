# Feature: Start a new Discipline (start-new-discipline)

## Summary
The Disciplines tab can raise ranks, fill option slots and train Circles, but cannot initiate a new Discipline. Add an edit-mode "Add Discipline" flow (one modal) that seeds Circle 1 of an additional Discipline: auto-grants all unknown Circle-1 Discipline Talents at Rank 1, optionally picks the Circle-1 Talent Option, prices Legend and silver, then persists inputs only. The same modal completes an existing Discipline at Circle 1 whose Circle-1 DTs are missing (kolon-v2 Warrior). Progression afterwards uses the existing train-to-next-Circle flow.

## Goals / Non-goals
- Goal: initiate a Discipline from rules data not already on the character; seed Circle 1 per PG pp.455-456.
- Goal: "Seed Circle 1" on a Circle-1 Discipline missing its Circle-1 DTs.
- Goal: Legend all-or-nothing (affordability guard); editable silver fee paid from purse.
- Goal: log the action like other standard-log events.
- Non-goal: tutor / 40-hour / GM-approval gating; Versatility; converting a known option into a DT; new Disciplines in rules data (only Archer, Nethermancer, Thief, Warrior exist); changing the existing Circle training / option flows.

## Guardrail alignment
All Tier 3: data within the `ed-character/2` shape (`disciplines[]` append + `talents[{name,rank,circle}]`), new pure engine helpers, new edit-mode UI in the Disciplines tab using ui/kit modals. No Tier-1 sign-off needed; no taxonomy change.

## Tickets
### T1 — Engine: initiation quote and grant (pure)
- **What:** Pure helper(s) in `engine/talent-options.js` (or a new module): for a Discipline ref and the character's disciplines/talents, return the unknown Circle-1 DTs to grant (skip known; Thread Weaving distinct; universals not re-bought), the eligible Circle-1 option pool (Novice, minus known), Legend cost per talent (`newDisciplineRank1` by ordinal and lowest current Circle before adding), the summed-Circles fee base, and the default silver fee (100 x sum of Circles in other Disciplines x talent count incl. chosen option). Handles the seed-in-place case (existing Discipline at Circle 1 missing DTs; ordinal = its position, lowest Circle among the others).
- **Why:** Rules R1-R4, R6 stay in the pure, DOM-free engine; UI only renders.
- **Tier:** 3
- **Acceptance criteria:** Unit tests for: fresh 2nd Discipline (Kolon: Thief 4 -> Warrior: 5 DTs at lowest-Circle-4 row = 300 each), 3rd Discipline ordinal, known-talent skip, Thread Weaving variant, fee with/without option, seed-in-place of empty Warrior, no Discipline left to add -> empty list.
- **Open questions:** none

### T2 — Store/app handler and persistence
- **What:** `ed-start-discipline` event handled in `ui/ed-app.js`: guard (Discipline in rules and either absent or at Circle 1 missing DTs; option in pool; no duplicates), append/extend `disciplines[]` with `circle: 1` and talents at `circle: 1`, `_canAffordRank` check for all-or-nothing Legend, pay silver via `payFromPurse` (refuse if short), `saveAdvancementEdits` (+ wealth), mark dirty, re-derive, standard log entry. Model exposes what the modal needs (addable Disciplines with quote).
- **Why:** Persist inputs only; mirror `_advanceCircle` / `_learnTalent`.
- **Tier:** 3
- **Acceptance criteria:** Store tests: round-trip persists `{name, circle:1, talents[...]}` with no derived/tier fields; unaffordable Legend or silver refuses with no mutation; option skipped leaves the slot open; log entry written; coins reduced with change.
- **Open questions:** none

### T3 — UI: "Add Discipline" / "Seed Circle 1" modal (Disciplines tab, edit mode)
- **What:** Edit-mode control in `ui/ed-disciplines.js` opening a ui/kit modal: Discipline picker (only addable ones; pre-selected when launched from a Circle-1 Discipline missing DTs), read-only list of auto-granted Circle-1 DTs, optional Circle-1 option picker (skippable), Legend cost and editable silver fee, confirm button; dispatches `ed-start-discipline`. Placeholder pill if a cost is unpriceable.
- **Why:** The owner-requested entry point.
- **Tier:** 3
- **Acceptance criteria:** Escape closes / Enter confirms; light and dark; no fabricated numbers; unaffordable shows disabled confirm with reason; Overview unaffected; after confirm the new Discipline appears at Circle 1 and the existing train-to-next-Circle flow works.
- **Open questions:** none

### T4 — Verification, docs, changelog
- **What:** Verify on kolon-v2 (Warrior Circle 1 seed) in dev; update docs where needed (PLAN-LEARN-TALENTS Q1 scope note, UI-GUIDELINES if tab contents are described, changelog).
- **Tier:** 3
- **Acceptance criteria:** `npm test` green; kolon-v2 Warrior seeded in place with 5 DTs at Rank 1; progression to the Circle 2 gate reads correctly.
- **Open questions:** none
