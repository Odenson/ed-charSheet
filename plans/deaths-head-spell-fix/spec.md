# Tech Spec: Death's Head spell fix (deaths-head-spell-fix)

## Overview
Correct the Nethermancer spell `Death’s Head` in `rules/spells.json` to the Player's Guide (p. 323): replace its three non-book extra-thread options with the single "Increase Effect (+2 bonus to Frighten)", expressed as a sustained `test-modifier` (step) on Frighten. Because the base spell is note-only, `engine/spells.js` `buildActiveSpell` would drop that option's effect, so add a small pure-engine path that folds an extra-thread option's own sustained effect when it is not a boost of a matching base effect. The existing fold (`activeSpellEffects` -> `store.js` `abilityTestMods`) then applies +2 steps per extra thread to Frighten while the spell is active.

## Guardrail alignment
- Data edit in `rules/spells.json` using existing schema and taxonomy (`test-modifier`, `measure: step`, `duration: sustained`): Tier 3. No vocabulary change, so no Tier 2 ceremony.
- `engine/spells.js` extension: Tier 3. Pure and DOM-free, structured fields only (no label or regex parsing).
- Tests: Tier 3. No Tier-1 items found; no sign-off needed.
- Invariants held: data flows down via the engine fold and dispatch-up is untouched (no UI change); active spells stay session state, nothing derived is stored; no UI computation of game values.

## Design
### Data / types
- `rules/spells.json`, `Death’s Head` (key uses U+2019, ~L1270): replace `extraThreads` (3 entries) with exactly one:
  `{ label: "Increase Effect (+2 bonus to Frighten)", effects: [{ type: "test-modifier", target: { domain: "test", name: "Frighten" }, operation: "add", value: 2, measure: "step", duration: "sustained", source: "spell", summary: "Increase Effect (+2 bonus to Frighten)" }] }`.
  Omit `condition` and `gmDiscretion` so `autoApplies` is true in `abilityTestMods`.
- Leave `successes`, threads (0), weaving (6/11), range, duration, description, summary, base `effects` unchanged (verified against R1).
- No schema/type change; no stored fields.

### Modules & functions
`engine/spells.js` (only engine file touched):
- New non-exported helper `isStandaloneOptionEffect(spell, e)`: true iff `e.duration === 'sustained'` AND no effect in `sustainedEffectsOf(spell)` with `typeof value === 'number'` matches `e` on `type`, `target?.domain`, `target?.name` and `measure`. Structured fields only; no domain shortcut (Soulless Eyes, Shield Mist have test-modifier option effects that are boosts of a matching base).
- `sumOptionBoosts(effects)` -> `sumOptionBoosts(effects, spell)`: skip effects where `isStandaloneOptionEffect(spell, e)` so they add 0 to `stepAdd`/`ratingAdd`. Update the three call sites in `castBoosts` (extra-thread picks and the `successes[0]` call; pass `spell` in both). `castBoosts` also feeds `effectStepBonus`, `otherCastOutcome` (L229) and `castPlan`, so all show 0 Effect-step change for Death's Head.
- `buildActiveSpell`: after the existing boost fold, for each pick label in `ctx.extraPicks`, collect the standalone effects of the matching `extraThreads` option (by `optionEffects`). Group by identical target/type/measure and emit one entry per group with `value = e.value * count` (picks of the same label stack to +2N), keeping `summary`. Append to `effects`. Stale labels contribute nothing (as `optionEffects` returns `[]`). Existing spells are unchanged because none of their option effects are standalone.
- `effectLabel` logic is unchanged: `stat` is the first numeric effect, so with N picks the tile reads `+2N Frighten test` (via `effectSubject` -> `"<name> <domain>"`). With 0 picks, `effects` is empty and the label is `spell.summary` ("Use Frighten as Simple Action"), and `roundsLeft` still counts down (`tracksOnSelf`).
- Update the "Known limitation" docblock to describe the standalone-fold path.

### UI / behavior
No UI file changes. Self-cast of Death's Head with N extra threads yields an Active-effects tile for Rank+5 rounds (+2 per extra success), and the Frighten talent shows +2N step bonus (existing `applyTestMods` / `stepBase` audit) until expiry via `tickActiveSpells`. Theme, modal and Overview-fit behavior are unaffected. Owner should check that `ed-spells.js` (~L1045), which reads `test-modifier` by test name, does not double-count the folded effect.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Death's Head block | Circle 2 Nethermancer; Threads 0; Weaving 6 (reattune 11); Casting TMD; Range Self; Duration Rank+5 rounds; Effect "Use Frighten as Simple Action" | R1 (Q017, PG p. 323) |
| Extra threads | Exactly one option: "Increase Effect (+2 bonus to Frighten)"; no damage/range/target options | R2 (Q017, Q016) |
| Success levels | Only "Increase Duration (+2 rounds)" per extra success | R3 (Q017) |
| Bonus meaning | "+2 bonus to Frighten" = +2 steps on the Frighten test per extra thread, while the spell lasts | R4 (Q009, PG p. 34) |

### Edge cases & invariants
- 0/1/2 picks, successLevels 3, rank 5: roundsTotal 14 (5+5+2*2); effects fold to none / +2 / +4 on `test|Frighten` step.
- Stale/unknown pick label: no effect, no throw.
- Soul Armor, Soulless Eyes, Shield Mist, Aspect of the Fog Ghost, Aspect of the Casual Murderer active records byte-identical to before; their option effects are not folded twice. (Arrow of Night's option is `duration: test`, not relevant.)
- `effectStepBonus(deathsHead, picks, n) === 0`; `otherCastOutcome`/`castPlan` Effect step unchanged by picks.
- Frighten bonus disappears when the record is dropped by `tickActiveSpells`.
- Engine has no DOM access.

## Testability notes
node:test, pure engine:
- Replace the stale test in `engine/spells-options.test.js` (~L253, label "Increase Effect (+2 Damage Step)") with: (a) data test (one extraThread, label, effect shape); (b) `buildActiveSpell` 0/1/2 picks (rounds, folded value, `options.picks`, `activeSpellEffects` origin tag); (c) `effectStepBonus`, `otherCastOutcome`, `castPlan` show no Effect-step change.
- `engine/spells.test.js`: keep Soul Armor tests (L253-297) green; add Soulless Eyes and Shield Mist assertions and a data-driven test that every spell in `rules/spells.json` with a sustained option effect and a matching base has `isStandaloneOptionEffect` false (export the helper for test only if needed, otherwise assert via unchanged `buildActiveSpell` output against a pinned expectation). Use an in-test fixture spell so the engine work is testable before the data lands.
- If an existing store/derive test pattern exists, add a check that Frighten's step bonus appears while active and vanishes after ticking to expiry; otherwise owner verifies manually.
- `tools/rules-conformance.test.js` must stay green. Grep `data/characters` and `tools/archive` for the removed labels ("Increase Range (+10 yards)", "Additional Target (+Rank)") to confirm no persisted references.
- Manual (owner): tile wording "+2 Frighten test", Frighten step bonus on the sheet, light and dark themes.

## Changelog entry
Fixed Death's Head: its extra thread now correctly gives +2 to Frighten (applied while the spell is active) instead of damage, range and target options.

## Out of scope
- Taxonomy, schema or UI changes.
- Auditing or converting other spells (note-only bases with "+N bonus to X" extra threads).
- Changing tile label wording beyond what `effectSubject` produces.
