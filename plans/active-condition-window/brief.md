# Brief: Active effects window (active-condition-window)
## What & why
One shared "Active effects" Lit element (Spells-card look) on Combat (above Combat log, 3 groups side by side) and Spells (single stacked column), fed by one session-level list under a NEW model key `model.effectWindow`: spells (self + on Other), armed talents (Aim), Taunt, toggled options/charms, situations/Knocked Down. Opponent penalties display-only; session-only; Overview strip and `model.activeEffects` untouched.
## Tickets & tiers
- T1 engine unified list - Tier 3 - n/a
- T2 session opponent entries + countdown - Tier 3 - n/a
- T3 Taunt data - Tier 3 - owner decision 2026-11-24 (reuse arms on talent)
- T4 shared component - Tier 1 - signed off 2026-11-24
- T5 Combat placement + name field - Tier 1 - signed off 2026-11-24
- T6 Spells integration - Tier 1 - signed off 2026-11-24
- T7 docs - Tier 3 - n/a
## Items
- I1 - entry/record contract, pure builder/grouper, end semantics - engine/active-effects.js (+test) - T1 - R1,R2,R3,R5
- I2a - reducers (add/tick/end/clear), ed-app state + tick + Day reset, store builds `model.effectWindow` - engine, ui/ed-app.js (l.668, 1033, 1430), store.js ~2200 - T2 - R1,R3
- I2b - options lift (ed-combat pushes, ed-app mirrors), shared session `targetName`, `ed-other-cast` event - ui/ed-combat.js, ui/ed-spells.js, ed-app, store - T2,T5,T6 - R3,R5
- I3 - Taunt talent `arms {roll:{vs:"Social"},rounds:"rank"}` + plumbing - rules/talents.json:2803, store.js 1184-1192, ed-disciplines.js:409, ed-combat.js ~804/831, ed-app l.393, ed-roll-modal l.521, armedTalents consumers - T3 - R1
- I4 - ed-active-effects element - ui/ed-active-effects.js; check-ui-kit/check-imports - T4
- I5 - Combat mount + name field - ui/ed-combat.js ~1400 - T5
- I6 - Spells swap, remove Target effects card - ui/ed-spells.js 503-575, 1498 - T6 - R3
- I7 - docs + mock-d fix - UI-GUIDELINES s4, ARCHITECTURE, EFFECT-TAXONOMY s6, talents.json header - T7
## Rules
- R1 Taunt: Rank+CHA vs Social Def; -1 tests/-1 Social Def per success for Taunt-rank rounds; one target; stacking not covered -> one entry per cast.
- R2 Mystic Aim: until end of round (arms.rounds 1); replace-by-name kept.
- R3 Spell rounds: Decision 2026-11-24 - tick per Initiative; X always ends (except locked conditions).
- R5 Combat options single-round: "This attack", no counts.
## Owner decisions
- 2026-11-24 Overview strip unchanged; all four sources plus read-through situations/Knocked Down.
- 2026-11-24 Taunt = arms on talent only, no new fields; auto-adds on success (rounds = rank), display-only; Taunt only in v1.
- 2026-11-24 Cast on Other tracked with countdown; Target effects card removed; optional name, blank = "target".
- 2026-11-24 Group by lifetime + side (Aim under Lasting on you).
## Constraints & gotchas
- Do NOT reuse `model.activeEffects` (Overview strip, store ~2195).
- Opponent entries are one per cast (unique id); only Aim replaces by name (ed-app l.393). Taunt records carry `text` + `opponent:true`; store resolves rounds "rank" to a number (store 1184-1192) before session; all `armedTalents` consumers must skip `opponent` records (store 2053, combat.js 579/649, ed-combat 684/1027/1294, ed-spells 1271).
- Two arm descriptor builders (ed-disciplines 409, ed-combat ~804/831) and roll-modal hint (l.521) need updating.
- End semantics: Knocked Down/encumbrance Harried endable:false; charm X deactivates only (no unequip); option X untoggles; situation X = ed-toggle-situation.
- Toggled options: ed-combat pushes `_opts`, ed-app mirrors; clear on round advance, Day reset, character switch. One session `targetName` shared by Combat, Spells, Disciplines.
- Cast on Other: no parsable duration -> no entry; minutes x10, hours x600; effect total arrives later (event).
- Ticking only in ed-app `_advanceRound` (l.1033); UI never computes. Combat lacks --spell/--amber tokens; run tools/check-ui-kit.mjs and check-imports.mjs.
