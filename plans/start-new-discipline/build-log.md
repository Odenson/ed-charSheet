# Build log: start-new-discipline

## Run 1 — 2026-11-21 (since 2026-11-21T06:10:04Z)

### Alignment
- Guardrails: I1-I6 all Tier 3; no Tier-1/2 item, no sign-off needed.
- Rules: R1-R7 present with sources; R4 (NOT-COVERED) has an owner Decision (2026-11-21).
- Open questions: none material. Plan Q2 (partially seeded Discipline grants only the missing DTs) accepted as the default by Dev Lead; no owner objection recorded.
- Tree: local `dev` == `origin/dev`. Unrelated working-tree change: `docs/RULES-FAQ.md` (Q038, rule-agent addition from /new-feature; part of this feature's rules ledger). Stage only by explicit path.
- Outcome: aligned. plan.md status -> building.

## Run 1 - build (2026-11-21)

### Implemented (I1-I6)
- I1 `engine/talent-options.js`: `NEW_DISCIPLINE_FEE_PER_CIRCLE`, `initiationQuote`, `addableDisciplines`.
- I2 `engine/legend-spent.js`: `lowestPriorCircle`; audit loop prices per Discipline index. `store.js` (`advanceCost`, rank stepper) and `ui/ed-app.js` (`_learnTalent` log) use it. `lowestDisciplineCircle` kept exported, no longer used for pricing.
- I3 `store.js`: `model.addableDisciplines` (option pool items enriched with `brief`), derived only.
- I4 `ui/ed-app.js` `_startDiscipline` + `ed-start-discipline`; `store-log.js` `logDisciplineStarted`.
- I5 `ui/ed-disciplines.js`: "＋ Add Discipline" / "Seed Circle 1" buttons in the edit-mode legend bar and the `start-discipline` kit modal.
- I6 docs: `plans/PLAN-LEARN-TALENTS.md` Q1 note, `docs/UI-GUIDELINES.md` note, `data/changelog.json` (added + fixed entries).

### Legend diff over data/characters/*.json (audit total, standard model)
| character | old | new |
|---|---|---|
| chakka.json | 44200 | 42000 |
| kolon.json | 39000 | 37200 |
| kolon-v2.json | 15000 | 15000 |
| test-char.json | 29700 | 29700 |

### Gate
Gate green after TESTER_UPDATED: npm test 1522 pass, 0 fail (store-homebrew expectations 1300 -> 1100).

### Dispute
NEEDS_TESTER: store-homebrew.test.js lines ~207, ~215, ~222 (tierShiftChar: Archer 4 + Nethermancer 3, Spellcasting R3). Standard-model Nethermancer total now 1100 (Rank-1 row = Archer's Circle 4 = 300, not own Circle 3 = 500), previously 1300; same legitimate change the tester already made in engine/legend-spent.test.js. Three assertions expect 1300.
