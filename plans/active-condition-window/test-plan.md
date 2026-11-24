# Test Plan: Active effects window (active-condition-window)

## Test files
- engine/active-effects.test.js
- engine/combat-opponent-skip.test.js
- engine/taunt-data.test.js
- store.effect-window.test.js
- ui/active-effects-state.test.js
- ui/combat-mods-state.test.js (appended `optionsAfterPush` + `modTabCounts` regression cases; pre-existing cases untouched)

## Coverage
### engine/active-effects.test.js
- GROUPS / empty / groupEffects: three groups atk, you, tgt always kept (spec I1). Rule: n/a.
- Per-source entries (spell, Aim, opponent, option, charm, situation, Knocked Down, Harried): kind, side, id format, endable, endAction. Rule: R2 (Aim sits under "on you"), R5 (options are round-free "This attack").
- low flag at roundsLeft 3 vs 4; pct 50 for 5/10; round-free pct 100. Rule: spec display threshold.
- Spell chosen name and chips (picks count, success mult as count).
- Blank target name -> "target" (or supplied fallback).
- Order: GROUPS order, source order within "you"; determinism; no input mutation.
- Reducers addOpponentEffect (no dedupe), tickOpponentEffects (drop at 0, never <= 0, rank-N lasts N ticks, no mutation). Rule: R1, R3.
- endEffect per kind (spell, opponent, talent, option, charm = deactivate only, situation = toggle-situation action, condition no-op, unknown id no-op, no mutation); clearAll. Rule: R3 (X always ends except locked), spec End semantics. Tests route via the entry's own `endAction` from the builder, so they do not pin whether `endAction.id` is the entry id or the bare name.
- armOpponent: hit builds record (rounds = arms.rounds, "N successes"/"1 success", text); miss or non-opponent -> null. Rule: R1.
- otherCastToRecord using the real `otherCastOutcome`: hit with rounds, minutes x10, hours x600, "Rank rounds" with caster rank, miss -> null, months/no duration -> null, pending Effect leaves effectLabel null (real Spirit Dart), setOtherCastEffect fills it by record id. Rule: R3 (house ruling).

### engine/combat-opponent-skip.test.js
- collectCombatEffects ignores an `opponent` armed record, alone or beside a real Aim. Rule: R1 (display-only).

### engine/taunt-data.test.js
- Taunt arms exactly `{roll:{vs:"Social"},rounds:"rank"}`; no on-success effects; Aim arms unchanged; only Taunt has a string rounds; taxonomy still v6. Rule: R1, R2.

### store.effect-window.test.js
- effectWindow from a session (spells, Aim, opponent, option, Knocked Down, Burdened Harried, situation "Blindsided"); targetName/toggledOptions pass-through; blank name -> "target".
- `model.activeEffects` unchanged by the new session keys.
- `model.spells.effectWindow` / `targetName` exposed.
- Taunt node arms: rounds = rank as a number (ranks 1, 3, 5), `opponent:true`, vs Social, `text` string, `effects: []`; Aim not opponent; no string rounds anywhere in the model. Rule: R1, R2.
- A Taunt record in `session.armedTalents` yields no `castingArmed` and no `talent:Taunt` entry.

### ui/active-effects-state.test.js
- viewGroups columns keeps all three, stack omits empty, order, undefined-safe; roundsPillText ("N rds" / "this attack" / "active"); endButtonLabel ("End <name>").

### ui/combat-mods-state.test.js
- optionsAfterPush: removal-only reconcile (drop, never add, order kept, no mutation); modTabCounts outputs unchanged.

## Assumptions to confirm at build (spec ambiguities, tests chosen to be lenient)
- `setOtherCastEffect(list, id, text)` is called with the record id (`opp:<n>`), not the raw ed-spells cast seq.
- `optionsAfterPush(opts, modelNames)` returns `opts` filtered to those in `modelNames`.
- `roundsPillText`: round-free `side:'atk'` -> "this attack"; any other round-free -> "active".
- `viewGroups` returns the `groupEffects` shape `[{side,label,items}]`.
- Armed fallback label asserted only for 2 successes ("2 successes").

## Not covered (and why)
UI behavior has no harness; owner verifies by hand:
- Active effects window on Combat (above Combat log, 3 columns, phone reflow) and Spells (stacked, no truncation), light and dark; amber at <= 3 rounds.
- ed-app wiring: Initiative ticks/clears options; Day reset and character switch clear opponent list/options/name; X per kind (charm stays equipped, situation untoggles, option untoggles in Combat chips); no X on Knocked Down/Harried.
- Cast on Other: entry only on hit with parsable duration; `Effect —` placeholder until the Effect roll lands; Target effects card gone.
- Taunt from Combat and Disciplines (Difficulty from the roll modal's target input), miss adds nothing and clears nothing, roll-modal hint text; Overview strip unchanged.
- Opponent name field syncing across Combat/Spells/Disciplines.
- `ed-end-effect`, `ed-target-name`, `ed-options-toggled`, `ed-other-cast(-effect)` event routing.

## How to run
`npm test`
