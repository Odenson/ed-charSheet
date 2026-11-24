# Brief: Frighten uplift (frighten-uplift)
## What & why
Successful Frighten adds a display-only target entry in the Active effects window: "-2 x N = -2N to all tests", Rank rounds, with a Willpower end-test reminder vs the Frighten Step. Frighten rolls vs Mystic like self-buff Mystic Aim, so the `vs === 'Social'` opponent inference is replaced by explicit optional `arms.opponent: true` (Taunt migrated too).
## Tickets & tiers
- T1 explicit `arms.opponent` - Tier 1 - signed off qa-log 2026-11-24T11:58Z
- T2 Frighten opponent arm + computed total - Tier 3 - n/a
- T3 docs/data headers - Tier 3 - n/a
## Items
- I1 - `arms.opponent` flag, Taunt migration, store derivation - rules/talents.json (~2814), store.js 1199-1207 - T1 - none
- I2 - Frighten arms+note data, store derives `arms.perSuccess {delta}`, `armOpponent` composes text - rules/talents.json 577-609, store.js, engine/active-effects.js (+tests) - T2 - R1,R2,R3,R4
- I3 - forward `perSuccess` + `roll.step` in arm descriptors - ui/ed-disciplines.js ~408, ui/ed-combat.js ~829-841, verify ui/ed-app.js ~399 - T2 - R2
- I4 - docs - docs/EFFECT-TAXONOMY.md ~355-362 - T3 - none
## Rules
- R1 Frighten: Rank+WIL, Standard, Strain 0, vs Mystic Defense; data already matches (Q017/18/49).
- R2 -2 to ALL tests per success for Rank rounds; one entry per cast (Decision 2026-11-24); app `duration:"special"` differs, follow book (Q050).
- R3 Target may Willpower-test each round vs Frighten Step to end; reminder text + existing X only (Decision 2026-11-24).
- R4 Fear-immune unaffected; note text only.
## Owner decisions
- 2026-11-24 Mirror Taunt; end-test = reminder text + existing X, no roll UI.
- 2026-11-24 Computed total for Frighten only; Taunt text stays static.
- 2026-11-24 Tier-1 sign-off: optional `arms.opponent: true` in rules/talents.json, migrate Taunt and Frighten, remove Social hardcode.
- 2026-11-24 Non-goals: auto-applying penalty, in-app end-test roll, stacking, Taunt display change, Evil Eye/Death's Head.
## Constraints & gotchas
- Opponent records never enter armedTalents; consumers skip `opponent` (store.js 2087, engine/combat.js 580, ed-combat 723/1064/1331) - no change needed.
- Per-success total is derived data-driven from Frighten's existing on-success perSuccess test-modifier (negate if `subtract`); no string parsing; Taunt has none, stays static.
- `armOpponent` is pure (engine/active-effects.js 162); window entry renders `text`/`effectLabel` verbatim.
- Descriptor `arms` has no `roll` key: the two builders (ed-disciplines, ed-combat) forward top-level `perSuccess` and `step` (from `roll.step`); `armOpponent` reads `arms.step`/`arms.perSuccess`.
- Store sets `arms.effects = []` for opponent arms (avoids a bogus roll-modal aim summary); Frighten `duration:"special"` left untouched.
- Text: "<delta> x N = <delta*N> to all tests" ("to all tests" only if effect target.name is 'Action'). Add a store-level test (Frighten, Taunt, Mystic Aim); UI forwarding verified manually.
- Verify by test that Frighten's test-modifier does not fold into the adept's pools (precedent: engine/combat-opponent-skip.test.js, engine/taunt-data.test.js).
- Check engine/validate-item.js / conformance tests for any `arms` key allow-list.
