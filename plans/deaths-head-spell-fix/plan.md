---
status: implemented
shipped: unreleased
---
# Delivery Plan: Death's Head spell fix (deaths-head-spell-fix)

## Context & learnings
`rules/spells.json` "Death’s Head" (Nethermancer C2) lists three extra-thread options (+2 Damage Step, +10 yards Range, Additional Target) that are not in the Player's Guide (p. 323). The book has one: "Increase Effect (+2 bonus to Frighten)". The owner chose a **structured** effect (qa-log 2026-10-03): a self-cast shows an Active-effects tile for the spell duration, and the Frighten talent gets +2 steps per extra thread while active. Rules (R1-R4): a "bonus to a test" is a Step modifier by default (PG p. 34); Success Level stays "Increase Duration (+2 rounds)"; Threads 0, Weaving 6/11, Range Self, Duration Rank+5 rounds, Effect "Use Frighten as Simple Action". Non-goals: taxonomy/schema/UI change, auditing other spells.

## Discoveries
- `rules/spells.json` ~L1270-1349: Death's Head. Base `effects` is one `note` with `gmDiscretion: true`, so `sustainedEffectsOf()` returns nothing for it. Its `successes` entry is already correct. Description text ("may use the Frighten talent as a Simple action") already matches the book. The "castingTarget" is "Target's Mystic Defense" and the stat block is otherwise as in R1; the book's Casting is "TMD", so no change.
- `engine/spells.js` `buildActiveSpell` (~L334): takes `castBoosts()` (`stepAdd`/`ratingAdd`/`durationRounds`) and adds `stepAdd`/`ratingAdd` only onto the FIRST numeric sustained base effect. With no base sustained effect, an extra thread's effect is dropped. Soul Armor's "Increase Effect (+2 Mystic Armor)" works only because the base has a numeric sustained `armor-modifier`; its option effect is used purely as a *boost source* (`sumOptionBoosts`), not folded itself.
- `sumOptionBoosts` sums any `add` + `measure: step` option effect into `stepAdd` regardless of type or target. A `test-modifier` option effect on Frighten would therefore register as `stepAdd`, which `effectStepBonus` also returns, so it would inflate the cast's Effect step (cast plan / `castPlan` L176-226). This is a gotcha: the new option must not leak into the Effect-step bonus (see I2).
- `tracksOnSelf` already gives a duration-bearing note-only spell an Active row, so (c) countdown with 0 threads already works (`engine/spells-options.test.js` ~L246).
- Fold path: `activeSpellEffects` (engine/spells.js L433) -> `store.js` ~L971 into `activeEffects`; `abilityTestMods(name)` (store.js ~L1560) picks `test-modifier` with `target.domain` `test`/`ability`, name match, add/subtract, `autoApplies` (condition `always`/absent and no `gmDiscretion`), and applies `stepBonus` to talents (`applyTestMods(t)`, L1596) with `stepBase` audit. So Frighten gets +steps automatically given a `test|Frighten` effect with no `gmDiscretion` and `condition` absent/`always`.
- Existing test `engine/spells-options.test.js` ~L253 references the removed label "Increase Effect (+2 Damage Step)" and must be rewritten. Soul Armor tests in `engine/spells.test.js` L253-297 must remain green.
- Taxonomy: `test-modifier`, `measure: step`, `duration: sustained` all exist (EFFECT-TAXONOMY.md); no vocabulary change. `tools/rules-conformance.test.js` validates vocab.
- Smart-quote name: the key is `Death’s Head` (U+2019).

## Guardrail classification
- I1 (data in rules/spells.json, fits schema/taxonomy): Tier 3.
- I2 (pure engine extension in engine/spells.js, DOM-free, structured effects, no regex): Tier 3.
- I3 (tests): Tier 3.
No Tier-1/Tier-2 items; no owner sign-off needed. Tier-1 invariants kept: engine stays pure; derived value comes via the engine fold; nothing stored (active spells remain session state).

## Rules dependencies
- R1 Death's Head printed block (ANSWERED, Q017).
- R2 extra-thread options: only +2 bonus to Frighten (ANSWERED).
- R3 success levels: only +2 rounds (ANSWERED).
- R4 "bonus" = +2 step on the Frighten test (ANSWERED, Q009; PG p. 34).
No open NEEDS_RULES.

## Implementation items
### I2 — Engine: fold option-borne sustained effects when the base has no numeric sustained effect (do first; I1 depends on it)
- **Covers tickets:** T2
- **Rules:** R4
- **Tier:** 3
- **What:** In `buildActiveSpell`, after the existing boost fold, additionally fold each picked extra-thread option's own `sustained` effect (once per pick, so N picks stack to +2N) when that effect is NOT consumed as a boost of the base effect. Unchanged for every existing spell.
- **Where:** `engine/spells.js` (`buildActiveSpell`, `castBoosts`/`sumOptionBoosts`, and the "Known limitation" comment).
- **Approach:**
  1. Add one helper `isStandaloneOptionEffect(spell, e)` in `engine/spells.js`. It is true only when `e.duration === 'sustained'` AND no numeric sustained base effect (as returned by `sustainedEffectsOf(spell)`) matches `e` on `type`, `target.domain`, `target.name` and `measure`. Structured fields only, never labels, and NO domain-based shortcut (Soulless Eyes and Shield Mist have `test-modifier`/`test`/step option effects that boost a matching base effect and must stay boosts).
  2. `sumOptionBoosts` (called via `castBoosts`) must take the spell (or its base effects) and skip any effect for which `isStandaloneOptionEffect` is true, so standalone effects contribute 0 to `stepAdd`/`ratingAdd`. The same helper drives the new fold in `buildActiveSpell`, so the two sites cannot diverge. Because `castBoosts` also feeds `otherCastOutcome` and `effectStepBonus`, all three paths then show 0 Effect-step change for Death's Head. Update every `castBoosts`/`sumOptionBoosts` caller for the new signature.
  3. Fold standalone effects once per pick as one entry with summed value (`value * count`), keeping `summary`. `effectLabel` uses `effectSubject`, which returns `"<name> <domain>"`, so the tile reads "+2 Frighten test"; accept that wording (or add a small `test` case only if trivial).
  4. With 0 picks the record has empty `effects` and the existing summary label (c).
  5. Update the "Known limitation" docblock to describe the standalone-fold path.
- **Dependencies:** none (can be tested with an in-test spell fixture before the data lands).
- **Acceptance criteria:** Active records for every spell with a sustained option effect (Soul Armor, Soulless Eyes, Shield Mist, Aspect of the Fog Ghost, Aspect of the Casual Murderer) byte-identical to before (existing tests unchanged and green); a fixture/Death's Head record with 0/1/2 picks yields Frighten step total 0/+2/+4 through `activeSpellEffects`; `effectStepBonus`, `otherCastOutcome` and `castPlan` show no Effect-step change for Death's Head with picks; engine has no DOM access.
- **Risks / unknowns:** The classification rule must not accidentally reclassify an existing spell's option (the audit found five spells with sustained option effects: Soul Armor, Soulless Eyes, Shield Mist, Aspect of the Fog Ghost, Aspect of the Casual Murderer; each has a matching base sustained effect. Arrow of Night's option is `duration: test`, so it is not relevant to this fold. Re-confirm by grep). `effectSubject` may not render a `test` target. UI (ed-spells.js ~L1045) already reads `test-modifier` by test name; check that it does not double-count the folded effect.

### I1 — Data: correct Death's Head in rules/spells.json
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4
- **Tier:** 3
- **What:** Replace the three `extraThreads` with exactly one:
  `{ label: "Increase Effect (+2 bonus to Frighten)", effects: [{ type: "test-modifier", target: {domain: "test", name: "Frighten"}, operation: "add", value: 2, measure: "step", duration: "sustained", source: "spell", summary: "Increase Effect (+2 bonus to Frighten)" }] }`. Omit `condition` and `gmDiscretion` (or `gmDiscretion: false`) so `autoApplies` is true. Leave `successes`, threads, weaving, range, duration, description and summary as-is (verified against R1).
- **Where:** `rules/spells.json` Death’s Head entry (~L1270).
- **Approach:** Direct edit; keep key ordering and 2-space JSON style. Check for any other generated copy of spell data (grep for "Increase Range (+10 yards)" in tools/archive or a built spell-options table) and for character data referencing the removed labels (grep `data/characters`).
- **Dependencies:** I2 (without it the effect is not folded onto an active record).
- **Acceptance criteria:** spell has exactly one extra-thread option; `npm test` including `tools/rules-conformance.test.js` passes; self-cast with N picks yields a tile for Rank+5 (+2 per extra success) rounds and Frighten step +2N, removed on expiry via `tickActiveSpells`; 0 picks shows the countdown tile with no bonus.
- **Risks / unknowns:** A saved character/session referencing an old label becomes a stale pick (engine already tolerates stale labels per `appliedOptions` doc). Confirm no persisted data uses them.

### I3 — Tests
- **Covers tickets:** T1, T2
- **Rules:** R3, R4
- **Tier:** 3
- **What:** Add/adjust tests.
- **Where:** `engine/spells-options.test.js` (replace the L253 Death's Head test), `engine/spells.test.js`.
- **Approach:** (a) Death's Head data test: one extraThread, label, effect shape. (b) `buildActiveSpell` with 0/1/2 picks, successLevels 3, rank 5: rounds 14, effects fold to 0/+2/+4 on `test|Frighten` step, `options.picks` count; `activeSpellEffects` tags origin spell. (c) `effectStepBonus(dh, picks, n) === 0`, and `otherCastOutcome` and `castPlan` show no Effect-step change for Death's Head with picks. (d) Regression: Soul Armor extra-thread still boosts base effect (existing test) and is not folded twice; add Soulless Eyes and Shield Mist (`test-modifier` precedents) assertions, plus a data-driven test that every spell in `rules/spells.json` with a sustained option effect and a matching base has `isStandaloneOptionEffect` false and an unchanged active record. (e) If feasible, a store-level check that Frighten's step bonus appears while the spell is active and disappears after ticking to expiry (follow existing store/derive test patterns; skip if none exist for spells).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** `npm test` green.
- **Risks / unknowns:** Store-level test harness availability.

## Sequencing
I2 (engine, testable with fixture) -> I1 (data) -> I3 (finalise tests against real data; may be written alongside I2/I1). Engine first so the data change never lands in a state where the effect is silently dropped.

## Open questions
- Active tile label for Death's Head will read "+2 Frighten test" (what `effectSubject` produces); accepted, non-blocking.
- Other spells with a note-only base and a "+N bonus to X" extra thread may now be convertible; out of scope (separate features).

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- F1 (major, Step 2 heuristic breaks Soulless Eyes/Shield Mist): fixed. Domain-based wording removed; single `isStandaloneOptionEffect(spell, e)` helper used by `sumOptionBoosts` (now spell-aware) and the fold.
- F2 (minor, name real precedents): fixed. Five spells named in I2 audit; Soulless Eyes and Shield Mist plus a data-driven regression added to I3(d); Arrow of Night noted as irrelevant.
- F3 (minor, label wording and cast paths): fixed. Label accepted as "+2 Frighten test"; Open Questions updated; I3(c) and I2 acceptance extended to `otherCastOutcome` and `castPlan`.
