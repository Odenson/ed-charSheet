# Tech Spec: Homebrew optional circle advancement (homebrew-circle-adv)

## Overview
Add a dormant homebrew rule `hb-optional-circle-advancement` that flips a registered boolean `set` target `advancement.optionalTable`. When on and `rules/legend.json` `costs.optionalAdvancement` is valid, `engine/advancement.js` evaluates the PG p.453 "Using All Talents To Advance" gate per Discipline instead of the p.452 gate. `store.js` passes the table plus the raw `d.talents` to `circleStatus`. The Disciplines tab renders the optional requirement as progress text. Off, missing table, or invalid table gives today's behaviour byte-for-byte.

## Guardrail alignment
All Tier 3 (plan classification confirmed; no sign-off needed):
- New additive data in an existing free map: `costs.optionalAdvancement` stays within `ed-legend/1`. No existing `costs` key changes.
- New rule on the existing `ed-homebrew/3` `set` lever. One boolean target is registered (§5.5 "adding a target is not a format change"). No new lever, no `ed-homebrew/4`, no new value form.
- Additive pure-engine logic.
- In-guideline UI.

Invariants:
- Data flows down through render and events flow up via the existing `ed-advance-circle` (no new event).
- The engine stays pure and DOM-free.
- Nothing derived is stored, and the table is never stored on the character.
- The unresolved state renders the `—` placeholder pill.
- No taxonomy change, so no Tier 2.

Tripwire: if the builder finds a validator that rejects unknown `costs` keys (grep `ed-legend` and `costs` in `tools/` and tests), stop and raise NEEDS_HUMAN.

## Design
### Data / types
- `rules/legend.json` `costs.optionalAdvancement`, placed after `circleTraining` and keyed by new Circle as a string. Each row is `{ "minTalents": N, "minRank": R, "fromCircle": F }`, with the values in the Rules table below.
- `rules/homebrew.json`:
  - Append rule `hb-optional-circle-advancement` with `enabled: false` and `set: { "advancement.optionalTable": true }`.
  - `overrides: "Players' Guide p.453 - Optional Rule: Using All Talents To Advance (replaces p.452 Minimum Talent Requirements)"`.
  - Add `summary` and `note` (per-Discipline evaluation; the table is in legend.json).
  - Add the new target to the top-level `source` string's target list.
- Character data: no change. The existing optional per-talent flag `viaVersatility` (`rules/talents.json:8`) is read from raw `d.talents`.
- Model: `model.advancement = { optional: boolean }`, derived, not stored.

### Modules & functions
- `engine/talent-options.js`: export the existing private `freeTalentSet(ref)` (additive). Reuse `UNIVERSAL_TALENTS` and `disciplineTalentSet`; do not duplicate them.
- `engine/advancement.js`, all pure:
  - `normalizeOptionalTable(raw) -> Map<number,{minTalents,minRank,fromCircle}> | null`. Returns null unless `raw` is a non-empty object, every key is an integer >= 2, and every row has positive-integer fields.
  - `countableTalents(ref, talents) -> [{name,rank,circle}]`:
    - Input is the raw list for ONE Discipline.
    - Keep a name only if it is in `ref.circles[].talents` (Discipline Talent) or it is a Talent Option, meaning not free, not universal, and not a Discipline Talent.
    - Drop `freeTalentSet`, `UNIVERSAL_TALENTS` and `viaVersatility === true`.
    - Names match by exact string equality via Set/Map only.
    - Duplicate names collapse to the highest rank (tie: first listed).
  - `optionalRequirement(ref, target, talents, table) -> {target, rule:'optional', minTalents, minRank, fromCircle, counted, met, total, hasFromCircle, countMet, satisfied, unresolved, gating: [], missing: []}`:
    - `met` is the number of counted talents with `rank >= minRank`.
    - `countMet = met >= minTalents`.
    - `hasFromCircle` is true when some counted talent has `rank >= minRank` and `circle === fromCircle` (strict; null/undefined never matches).
    - `satisfied = countMet && hasFromCircle`.
    - A target with no table row gives `unresolved: true, satisfied: false`.
  - `circleStatus(ref, attained, rankByName, opts)`. `opts = {table, talents}` is optional. With no `opts.table`, the code path is unchanged. With `opts.table` (no climb under the optional gate):
    - `at = attained ?? 1`.
    - `next = at + 1`, or null when beyond the highest Circle in `ref.circles` or beyond the table's max row.
    - `nextRequirement = optionalRequirement(next)`, and `eligible = satisfied`.
    - `consistent` is true when `at <= 1` or `at` has no table row. Otherwise it is the `countMet` of row `at`. Only the count clause is used; the from-Circle clause never affects consistency.
    - `supported = eligible ? at + 1 : consistent ? at : max(1, at - 1)`. So `eligible = supported > at` and `consistent = supported >= at` hold.
  - Update the header comment to document the two gates.
- `store.js`:
  - Add `'advancement.optionalTable'` to `HOMEBREW_SET_TARGETS` (`:629`).
  - In `deriveModel`, after `homebrewSets`: `table = homebrewSets['advancement.optionalTable'] === true ? normalizeOptionalTable(legendFile?.costs?.optionalAdvancement) : null`. Missing or invalid table means the standard gate.
  - Expose `model.advancement = { optional: !!table }`.
  - Call site at `:941`: `circleStatus(ref, d.circle, <existing name->rank map>, table ? { table, talents: d.talents ?? [] } : undefined)`. Pass the raw `d.talents`, not model rows, because model rows drop `viaVersatility`.
- A small pure helper, exported from `engine/advancement.js` (e.g. `describeRequirement(req)`), returns text and progress for the UI. It handles `rule === 'optional'`, `unresolved`, and the standard shape.
- `ui/ed-disciplines.js`:
  - `_circleTrack` (`:820`): when `cs.nextRequirement?.rule === 'optional'`, build `curTitle` (inconsistent case) and `nextTitle` from the helper. The standard strings are unchanged otherwise.
  - `_advanceModal` (`:860`): add a read-only progress row using the existing `.cchk/.csub/.crow` classes. It states "N talents at rank R, one from Circle C", the met/total count, the from-Circle status, and the counted names.
  - A grep of `ui/` and `store.js` found no reader of `nextRequirement.gating/.missing` outside the engine and its tests. The builder re-greps, and any reader found must branch on `rule`.
  - `ui/ed-app.js:1354` (`_advanceCircle`) is unchanged; it keeps re-checking `circleStatus.eligible`.

### UI / behavior
- Rule off: output identical to today.
- Rule on: the Circle track tooltips and the Train modal state the table row for the next Circle with live progress.
- Eligibility, the Train button and the consistent/justified warning follow `circleStatus`.
- `unresolved` (top Circle or missing row) shows the muted `—` placeholder pill, never a number.
- Both themes use existing classes only (no new colours).
- Modal behaviour is untouched: Escape closes, Enter confirms only when `canTrain`, focus per docs/MODALS.md.
- The Overview is not affected.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Gate replaced | The standard "all lower-Circle DTs at rank >= target Circle" gate is replaced by N talents (Discipline Talents or Talent Options) at rank >= R, one of them from the Circle being left | R1, PG p.453 |
| Table (new Circle: N / R / fromCircle) | 2: 5/2/1; 3: 6/3/2; 4: 7/4/3; 5: 8/5/4; 6: 9/6/5; 7: 10/7/6; 8: 11/8/7; 9: 12/9/8; 10: 13/10/9; 11: 14/11/10; 12: 15/11/11; 13: 16/12/12; 14: 17/12/13; 15: 18/13/14 | R1 |
| Keying | By new Circle only, not by number of Disciplines | R1 |
| Unchanged | Trainer, 40 hours, fees, new Discipline Talent purchase, Circle used for derived values | R2 |
| Never counts | Versatility-learned talents (`viaVersatility`) and thread-rank bonuses | R2 |
| Free talents | Do not count; Durability and Karma Ritual are not talents | R5 |
| "One from current Circle" | Stored `circle === newCircle - 1`, exactly. A Talent Option taken at that Circle counts | R6 |
| Later-learned options | Use the stored `circle`, infer nothing; a missing Circle never matches | R6 addendum (owner) |
| Multiple Disciplines | Evaluated per Discipline on that Discipline's own talents; the from-Circle talent comes from that Discipline's own list | R4 (owner decision) |
| Legend halving, Circles 11-15 | No app effect | R3 (informational) |

Owner semantics (qa-log):
- Eligibility is the attained+1 row only.
- Consistency checks only the stored Circle's row, count clause only.
- There is no climb.

### Edge cases & invariants
- Table absent, invalid, or the flag not strictly `=== true` (e.g. `1`): standard gate, with `circleStatus` output deep-equal to current outputs.
- Counting:
  - A duplicate name counts once.
  - A near-name (case, substring, "X II") does not count.
  - A talent above the from-Circle does not satisfy the from clause.
  - Null/undefined `circle` never satisfies the from clause, yet never flips `consistent`.
  - A gap Circle (no talent stored at a Circle) follows only the count clause.
- `at` at or beyond the table max row, or beyond `ref.circles`: `next` is null, not eligible, and `consistent` stays true when `at` has no row.
- Circles 12-15: min rank (11/11/12/12/13) lags the Circle number.
- Multiple Disciplines: a talent in Discipline A never counts for Discipline B.
- The table is never written to a character; `model.advancement` is derived.

## Testability notes
- `engine/advancement.test.js` (node:test), pure units:
  - `normalizeOptionalTable`, `countableTalents`, `optionalRequirement`, and `circleStatus` with opts.
  - Mica example: Third Circle needs 6 talents at rank 3, one from Circle 2.
  - Every row boundary: N-1 vs N talents, rank-1 vs rank, from-Circle present or absent. Also driven row by row from the real `legend.json`.
  - The F2 cases (a/b/c) from the plan, the cap, duplicates and exact-name cases.
  - All existing cases stay untouched and green.
- Legend data test: 14 rows equal R1; `fromCircle === circle - 1` for every row; `circleTraining` deep-equal to before; schema tag still `ed-legend/1`.
- `store-advancement.test.js` / `store-homebrew.test.js` (`deriveModel` with the real `legendFile` and a synthetic homebrew enabling the rule):
  - (a) a `viaVersatility` talent is excluded and a Talent Option is counted; with the rule off the flag is ignored as today.
  - (b) null `circle` through `deriveModel` gives no false `consistent:false`.
  - (c) the rule on with `costs.optionalAdvancement` absent uses the standard gate.
  - (d) a non-boolean value (e.g. `1`) uses the standard gate.
  - (e) the raw `d.talents` reach the engine.
  - Rule off: `homebrewSets` lacks the key and `model.advancement.optional` is false.
- Helper `describeRequirement` is a pure unit test (no Lit harness).
- Manual owner checks (I3):
  1. Rule off: Disciplines tab and Train modal look and behave as before.
  2. Rule on: tooltip and Train modal show "N talents at rank R, one from Circle C" with correct progress, for an eligible and a not-eligible character.
  3. The unresolved placeholder shows `—`.
  4. Light and dark themes are legible.
  5. Train modal: Enter confirms only when eligible, Escape closes, focus per docs/MODALS.md.

## Changelog entry
"New optional homebrew rule: advance Circles using the Player's Guide 'Using All Talents To Advance' table (N talents at a minimum rank, one from your current Circle), off by default."

Docs to update:
- `docs/HOMEBREW-RULES.md` §5.5 (registry and semantics)
- `ARCHITECTURE.md` (gate and `costs` contents)
- `docs/UI-GUIDELINES.md` (Disciplines tab Circle track)
- `engine/advancement.js` header

## Out of scope
- Legend Award halving or thirds for Circles 11-15 (R3).
- Any change to trainer, 40 hours, fees, new-Discipline talent pricing, or Circle used for derived values.
- Counting Versatility-learned talents or thread-rank bonuses.
- A new homebrew lever, `ed-homebrew/4`, or `ed-legend/2`.
- The homebrew modal (a boolean `set` renders nothing new).
- Climb-until-fail under the optional gate.
