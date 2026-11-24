# Tech Spec: Frighten uplift (frighten-uplift)

## Overview
Add an optional `arms.opponent: true` flag to talent data and derive `arms.opponent` in the store from it, replacing the `roll.vs === 'Social'` inference (Taunt migrated). Give Frighten an opponent arm (`roll.vs: "Mystic"`, `rounds: "rank"`) plus a `note` effect. The store derives `arms.perSuccess` from Frighten's existing on-success per-success test-modifier. The pure `armOpponent` composes the display text ("-2 x N = -2N to all tests" + end-test reminder + Frighten Step). Both arm-descriptor builders forward `perSuccess` and `step`.

## Guardrail alignment
- I1 (`arms.opponent` in the rules schema, store derivation): Tier 1 (additive optional rules-schema field, no version tag change). Owner sign-off is in qa-log 2026-11-24T11:58Z. Not an effect-taxonomy vocabulary change, so no Tier 2 ceremony.
- Frighten data, engine text composition, store derivation, descriptor plumbing and docs: Tier 3.
- Data-down/dispatch-up holds: the UI only forwards fields and the existing `ed-roll` -> `armOpponent` path is unchanged. The engine stays pure and DOM-free. Nothing derived is stored; `perSuccess`, `text` and `opponent` are derived on the model row. Opponent records stay display-only session state (`opponentEffects`) and never enter `armedTalents` or any pool.
- No Tier-1 item is missing.

## Design
### Data / types
- `rules/talents.json`, Taunt (~2814): `"arms": { "roll": {"vs":"Social"}, "rounds":"rank", "opponent": true }`.
- `rules/talents.json`, Frighten (577-609): add `"arms": { "roll": {"vs":"Mystic"}, "rounds":"rank", "opponent": true }`. Add a second effect `{ "type":"note", "source":"talent", "summary":"Target may make a Willpower test each round vs the Frighten Step to end the fear. Fear-immune targets are unaffected." }`. The existing test-modifier effect (including `duration:"special"`) is untouched.
- Model-row `arms` shape (store, derived, not persisted):
  - `opponent: cat.arms.opponent === true`.
  - `text`: the first `note` effect summary when `opponent`, otherwise null.
  - `effects`: `[]` when `opponent`; otherwise the existing on-success filter.
  - `perSuccess`: `{ delta, allTests } | null`.
- Descriptor `arms` (roll event detail) gains top-level `perSuccess` and `step`. There is still no `roll` key.

### Modules & functions
- `store.js` `buildTalentRow` (~1191-1210):
  - `const opponent = cat.arms.opponent === true`.
  - `perSuccess`: only if `opponent`. Find the first effect with `type === 'test-modifier' && condition === 'on-success' && perSuccess === true && Number.isFinite(value)`. Return `{ delta: operation === 'subtract' ? -value : value, allTests: target?.name === 'Action' }`, else null.
  - No `=== 'Social'` remains in the store. Grep to confirm that the Social hits in `ui/ed-combat.js` ~1196-1207 and `engine/combat.js` 669-683 are Defence-rating code and unrelated.
- `engine/active-effects.js` `armOpponent` (162): when `arms.perSuccess` is present, build `head = "${delta} x ${N} = ${delta*N}"` plus `" to all tests"` if `perSuccess.allTests`. `text = [head + '.', arms.text, Number.isFinite(arms.step) ? "${name} Step ${arms.step}." : null].filter(Boolean).join(' ')`. `effectLabel` stays `successText(successes)`. With no `perSuccess` the output is identical to today (Taunt unchanged). The `name` default stays 'Taunt'. Delta is printed as-is, with a minus sign for negatives.
- `ui/ed-disciplines.js` ~409: add `perSuccess: t.arms.perSuccess ?? null, step: t.arms.roll?.step ?? null` to the `arms` object.
- `ui/ed-combat.js` ~841: same two keys, with `step: opt.arms.roll?.step ?? null`.
- `ui/ed-app.js` ~399-409: verify only. `arms` is passed through to `armOpponent`. The `ed-app.js` ~2318 `arms: arms ?? null` pass-through needs no change.
- `engine/validate-item.js` / conformance tests: grep for an `arms` key allow-list. If one exists, add `opponent`.
- `docs/EFFECT-TAXONOMY.md` ~355-362: document the optional `opponent: true` (replaces the `vs:"Social"` inference; display-only target entry). Also document that `perSuccess` is store-derived, not authored. Grep `docs/HOMEBREW-RULES.md`, `ARCHITECTURE.md` and the talents.json header for Social-inference wording and fix.

### UI / behavior
- Success with k>0 successes on Frighten (Disciplines roll or the Combat talent dropdown) adds one target-group Active effects entry:
  - name "Frighten"
  - label "k successes"
  - text "-2 x k = -2k to all tests. <note> Frighten Step S."
  - Rank-rounds countdown, ended by the existing X.
- A miss adds nothing and clears nothing. Each cast adds one entry; stacking is a non-goal.
- The roll-modal hint (`ed-roll-modal.js` ~527) is unchanged. `arms.effects = []` prevents a bogus "+-2 steps" aim summary.
- The entry renders `text` and `effectLabel` verbatim, so no theme or modal change is needed. Overview viewport fit is unaffected.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Frighten stat block | Step Rank+WIL, Standard, Strain 0, vs Mystic Defense (data already matches) | R1; Q017/Q018/Q049 |
| Penalty | -2 to all tests per success, so total = -2 x successes | R2; Q050 |
| Duration | Rank rounds (`arms.rounds = "rank"`); app data `duration:"special"` differs and is left untouched | R2; Q050 |
| End-test | Target may make a Willpower test each round vs the Frighten Step to end it. This is reminder text only, with the existing X | R3; Q050 |
| Fear-immune | Unaffected; note text only | R4; Q050 |

### Edge cases & invariants
- Taunt behaves identically: the opponent record, static note text and rank rounds are unchanged, and it has no `perSuccess`.
- Mystic Aim and Anticipate Blow still self-arm (`opponent === false`).
- Frighten's test-modifier never folds into the adept's pools. A test builds combat/roll effects with Frighten learned and with an opponent entry, and asserts that pools are unchanged.
- `step == null` means the Step sentence is omitted.
- A talent with an opponent arm but no per-success effect gets `perSuccess` null.
- A talent whose effect target is not `Action` omits "to all tests".
- Rank 0 (no step) is not offered, as today.
- The Step shown is the base talent step, not the roll-time karma/bonus-dice step (non-goal; note it in the docs).

## Testability notes
- `engine/active-effects.test.js`:
  - `armOpponent` with `perSuccess {delta:-2, allTests:true}`, successes 3, step 9: text contains "-2 x 3 = -6 to all tests" and "Frighten Step 9".
  - `allTests:false` gives no suffix.
  - `step` null omits the Step sentence.
  - No `perSuccess` gives output identical to before.
  - Feed the descriptor shape (top-level `step`/`perSuccess`).
- New `engine/frighten-data.test.js`, modeled on `engine/taunt-data.test.js` and `engine/combat-opponent-skip.test.js`:
  - Frighten data has `arms.opponent === true`, `rounds:"rank"` and a note effect.
  - The store-level test builds a character with Frighten, Taunt and Mystic Aim. Frighten has `opponent` true, `perSuccess {delta:-2, allTests:true}`, `rounds` equal to the rank, `effects []` and the note as `text`. Taunt has `opponent` true, `perSuccess` null and the static `text`. Mystic Aim has `opponent` false.
  - The pools-unaffected test described under Edge cases.
- Extend `engine/taunt-data.test.js` to assert `arms.opponent === true`.
- Manual (owner):
  - Roll Frighten from Disciplines and from the Combat dropdown (if listed) in light and dark themes. Check the entry text, the Step, the countdown and X.
  - Check that a miss adds nothing.
  - Check that Combat's `_targetNum()` preset for opponent arms behaves sensibly when Frighten is rolled vs Mystic Defense (the Combat "vs" number is preset only for opponent arms).
  - Check Mystic Aim and Taunt for regressions.

## Changelog entry
{"type": "added", "text": "Frighten now adds a target effect in Active effects: -2 per success to all tests for Rank rounds, with a reminder that the target can make a Willpower test against your Frighten Step to end it."}

## Out of scope
- Auto-applying the penalty to any roll.
- An in-app Willpower end-test roll.
- Stacking or re-use handling.
- Changing Taunt's display.
- Evil Eye / Death's Head.
- Changing Frighten's `duration:"special"` data.
- The roll-time effective Step (karma/bonus dice) in the reminder.
