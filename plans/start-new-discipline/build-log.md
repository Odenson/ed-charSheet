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

## Dev Lead review (Phase 4)
Clean: engine pure, quote re-read from the model (not the event), inputs-only persistence, kit modal, no findings. Gate green (1522 pass). Tester's tests byte-identical to snapshot (incl. store-homebrew.test.js after the one adjudication, TESTER_UPDATED 1300 -> 1100).

## Doc sync (Phase 5)
Applied: ARCHITECTURE.md §8 comments (D3), PLAN-HOMEBREW-LEGEND-TIER.md superseded note (D4), changelog Legend-shift sentence (D6), ed-disciplines.js comment "ten" modals, plan.md status implemented/unreleased (D1).
Deferred (owner): D2 — docs/UI-GUIDELINES.md §4 note: more precise, dated wording (first Discipline never offered; bar hidden in Skills view; option hidden when slot filled; fee formula). UI-GUIDELINES is the Tier-1 UI contract, so not applied without recorded sign-off.
Skipped: D5 (PLAN-LEARN-TALENTS wording, optional); D7 (update-shadow-meld plan.md `shipped: unreleased` should be v1.33.0 — unrelated plan, flag for the owner).

## Owner handoff
### GUARDRAILS PR checklist
- [x] No Tier-1 invariant changed (all Tier 3; inputs-only storage, schema shapes unchanged)
- [x] Overview untouched (change confined to Disciplines tab edit mode) — owner to confirm fit
- [x] Unpriceable values render dashed placeholder pills; confirm disabled with reason
- [ ] Light/dark and modal Escape/Enter: kit used (check-ui-kit passes); owner to verify visually
- [x] Modals use ui/kit/; UI-kit check passes
- [x] No taxonomy change (N/A Tier 2)
- [x] No fetch/asset paths added

### Manual UI verification (owner, on dev)
1. Open kolon-v2, Disciplines tab, Edit mode: Warrior card shows "Seed Circle 1" and the legend bar shows "＋ Add Discipline" only if another Discipline is addable.
2. Seed Circle 1: modal lists Avoid Blow, Melee Weapon, Thread Weaving (Warrior), Tiger Spring, Wood Skin at 300 Legend each (total 1500); silver default 100 x 4 x 5 = 2000.
3. Pick an option: total and silver default update; "No option for now" keeps the slot open.
4. Confirm: Warrior has 5 DTs at Rank 1 (+option), Legend and purse reduced, log entry "Seeded Warrior Circle 1".
5. Escape closes; Enter confirms only when allowed; unaffordable shows disabled confirm with reason.
6. Light and dark; mobile fold; Overview still fits viewport.
7. Train Warrior to Circle 2 flow still reads correctly.
Legend audit change: chakka 44200 -> 42000, kolon 39000 -> 37200 (kolon-v2 and test-char unchanged).
