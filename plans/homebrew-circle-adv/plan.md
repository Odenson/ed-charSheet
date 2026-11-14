---
status: implemented
shipped: v1.33.0
---
# Delivery Plan: Homebrew optional circle advancement (homebrew-circle-adv)

## Context & learnings
Add a dormant homebrew rule `hb-optional-circle-advancement` that swaps the Circle-advancement gate from the standard "every lower-Circle Discipline Talent at rank >= target Circle" (PG p.452) to the book's optional "Using All Talents To Advance" table (PG p.453, rules.md R1): to reach new Circle C a Discipline's adept needs N talents (Discipline Talents or Talent Options) at rank >= R, one of them from the Circle being left. Owner decisions (qa-log):
- Toggle through the normal homebrew `enabled` flag, using the existing `set` lever with one new registered **boolean** target `advancement.optionalTable` (no new lever, no `ed-homebrew/4`, no widening of §5.5 value forms).
- The 14-row table lives in `rules/legend.json` `costs.optionalAdvancement`, keyed by new Circle next to `circleTraining` (owner decision, qa-log 2026-11-13).
- Evaluate **per Discipline**, counting only that Discipline's own talents (R4).
- Eligibility = the attained+1 row only; consistency checks only the stored Circle's row; no climb-until-fail under the optional gate; null/gap talent Circles must not wrongly flag a character (owner decision).
- Later-learned option Circle: use the stored `circle`, infer nothing, a missing Circle never matches the from-Circle clause; Versatility-learned never counts (R6 addendum, owner decision).
- Everything else about advancement is unchanged (trainer, 40 hours, fees, the new-Discipline-talent purchase, Circle used for derived values; R2). Legend halving for Circles 11-15 is out of scope (R3).
- Off => behaviour byte-identical to today.

## Discoveries
- `engine/advancement.js` is the standard gate: `disciplineTalentsUpTo`, `circleRequirement(ref, target, rankByName)`, `supportedCircle` (climbs from 2 until a Circle fails; capped at the highest Circle in `ref.circles`), `circleStatus(ref, attained, rankByName)` returning `{attained, supported, eligible, consistent, next, nextRequirement}`. It takes only a name->rank map, so it cannot see a talent's learned Circle or Versatility flag; the optional gate needs a richer input.
- `store.js:941` is the single call site: `circleStatus(ref, d.circle, Object.fromEntries(d.talents.map(t => [t.name, t.rank])))`. Its result feeds `disciplines[].circleStatus` and `advanceCost` (`:964`, gated on `circleInfo.eligible`; `:970` already reads `legendFile?.costs?.circleTraining?.[String(next)]`, the precedent for reading a Circle-keyed table from legend costs), and `ed-app.js:1354` (`_advanceCircle` re-checks `mdisc.circleStatus.eligible`). Fixing the engine therefore fixes eligibility, Train, and the "consistent/justified" warning together.
- `HOMEBREW_SET_TARGETS` is a `Set` at `store.js:629`. `deriveModel` (`:773-783`) builds `homebrewSets` (last-enabled-wins); a non-array object value is treated as race-keyed, anything else passes through. A **boolean** is a plain scalar, a documented §5.5 value form, so registering `advancement.optionalTable` is exactly the §5.5 "adding a target is not a format change" case. Precedent: `homebrewSets['legend.additionalTierShift']` at `store.js:1114`, exposed on the model for the UI (`:1304`).
- **legend.json shape (verified):** `rules/legend.json` is `schema: "ed-legend/1"`; `costs` holds sibling maps (`talentRank`, `skillTraining`, `circleTraining`, `knackTraining`, ...). `legendFile` reaches `deriveModel` (tests pass `legendFile: read('legend.json')`). A grep of JS files found no validator that enumerates `costs` keys or the legend schema tag, and consumers read named keys only. Adding `costs.optionalAdvancement` is purely additive data: **no shape or version change**, no `ed-legend/2`, no NEEDS_HUMAN. The builder re-verifies (grep `ed-legend`, `costs` in `tools/` and tests) before editing.
- **Identifying talents from character data (verified):**
  - Each `character.disciplines[].talents[]` entry is `{name, rank, circle}`; `circle` is the stored Circle the talent was learned at (e.g. `data/characters/chakka.json`: Archer talents carry `"circle":1`). Per-Discipline membership is structural: the Discipline's `talents` array is that Discipline's own list.
  - **Discipline Talent vs Talent Option is not stored**, it is derived from `rules/disciplines.json` (`circles[].talents` = Discipline Talents; `circles[].freeTalents` + `UNIVERSAL_TALENTS` (Durability, Karma Ritual) are automatic/"required"; anything else is an option). `store.js:844-847` already derives `requiredTalents` this way; `engine/talent-options.js` has `isOption`/DT-set helpers (`:15-25`, `:42`) and exports `UNIVERSAL_TALENTS`.
  - **Versatility-learned** talents are identifiable only by the per-talent flag `viaVersatility: true` on the raw character talent entry (documented only at `rules/talents.json:8`, consumed by `talentKarmaUse` at `store.js:856`; that line is the sole authority for the flag). No character data uses it and no in-app flow writes it, so the engine excludes `viaVersatility === true` explicitly. `deriveModel` does not copy the flag onto model talents, so the store reads it from the raw `d.talents`.
- `tools/rules-conformance.test.js` validates effect shapes only; it does not validate `set`. `ui/ed-homebrew.js` lists enabled rules and renders no `set` payload; with a boolean `set` nothing new reaches it (no verification task needed).

## Guardrail classification
- Whole plan is **Tier 3**: new additive data in an existing map (`rules/legend.json` `costs.optionalAdvancement`, within `ed-legend/1`), a new rule on the existing `ed-homebrew/3` `set` lever with one registered boolean target (HOMEBREW-RULES §5.5), additive pure-engine logic, and in-guideline UI changes. No Tier-1 item, so no owner sign-off is required. (The owner's table-placement and eligibility decisions in qa-log choose between Tier-3 options; they are not Tier-1 sign-offs.) The engine stays pure/DOM-free; nothing derived is stored; the table is rule data, never stored on the character; data flows down/events up unchanged.
- No Tier 2: no effect-taxonomy vocabulary change.
- Tier-1 tripwires to keep intact: no `ed-legend/*` or `ed-homebrew/*` tag change, no change to existing `costs` keys, no store field on the character, no new homebrew lever, no non-scalar `set` value.

## Rules dependencies
- **R1** (ANSWERED): gate and the 14-row table; I1, I2 transcribe/consume it exactly.
- **R2** (ANSWERED): only the gate is replaced; Versatility/thread bonuses never count; I2, I3.
- **R3** (ANSWERED, informational): Legend halving, no app effect, non-goal.
- **R4** (NOT-COVERED, owner decision recorded in rules.md): per-Discipline evaluation, that Discipline's own talents; the from-Circle talent comes from that Discipline's own list; I2.
- **R5** (ANSWERED): free talents (`freeTalents`) do not count toward N; Durability and Karma Ritual are not talents; I2 `countableTalents`.
- **R6** (ANSWERED) plus **R6 addendum** (owner Decision 2026-11-13): "one from the current Circle" = stored `circle` exactly equal to the Circle being left (table column = new Circle - 1); a Talent Option taken at that Circle counts; for later-learned options the stored `circle` is used, nothing inferred, a missing Circle never matches; Versatility-learned never counts. The previously uncovered area is now covered by a recorded owner Decision.
- No open rules points remain.

## Implementation items
### I1 - Table data, registered boolean target, dormant rule
- **Covers tickets:** T1
- **Rules:** R1
- **Tier:** 3
- **What:** Add the p.453 table to `rules/legend.json`, add the dormant rule `hb-optional-circle-advancement`, and register the boolean target `advancement.optionalTable`.
- **Where:** `rules/legend.json` (`costs.optionalAdvancement`, after `circleTraining`); `rules/homebrew.json` (new rule appended, `enabled: false`, `set: { "advancement.optionalTable": true }`, `overrides: "Players' Guide p.453 - Optional Rule: Using All Talents To Advance (replaces p.452 Minimum Talent Requirements)"`, `summary`, `note` stating per-Discipline evaluation and that the table is in legend.json); top-level `source` string in homebrew.json lists targets: add the new one; `store.js:629` (`HOMEBREW_SET_TARGETS` gains `'advancement.optionalTable'`).
- **Approach:** `costs.optionalAdvancement` keyed by new Circle as string like `circleTraining`, each value `{ "minTalents": N, "minRank": R, "fromCircle": F }`, exactly R1: 2: 5/2/1, 3: 6/3/2, 4: 7/4/3, 5: 8/5/4, 6: 9/6/5, 7: 10/7/6, 8: 11/8/7, 9: 12/9/8, 10: 13/10/9, 11: 14/11/10, 12: 15/11/11, 13: 16/12/12, 14: 17/12/13, 15: 18/13/14. In `deriveModel` (after `homebrewSets`, `store.js:~783`): `optionalOn = homebrewSets['advancement.optionalTable'] === true`; `table = optionalOn ? normalizeOptionalTable(legendFile?.costs?.optionalAdvancement) : null` (pure helper from I2). If the flag is on but the table is missing/invalid, fall back to the standard gate (fail-safe, never fabricate). Expose `model.advancement = { optional: !!table }` for the UI.
- **Dependencies:** I2 supplies the normaliser.
- **Acceptance criteria:** rule listed with `enabled:false`; a test reads `rules/legend.json` and asserts all 14 rows equal R1 and `fromCircle === circle - 1` for every row; rule off => `homebrewSets` lacks the key and `model.advancement.optional` is false; existing `costs` keys untouched (deep-equal test on `circleTraining`); legend schema tag still `ed-legend/1`.
- **Risks / unknowns:** none beyond the verification grep in Discoveries; if it ever finds a validator rejecting unknown `costs` keys, stop and raise NEEDS_HUMAN.

### I2 - Engine: optional gate, per Discipline, attained+1 only
- **Covers tickets:** T2
- **Rules:** R1, R2, R4, R5, R6 (+ addendum)
- **Tier:** 3
- **What:** Make `engine/advancement.js` evaluate the optional gate when handed a table, leaving the standard path untouched otherwise.
- **Where:** `engine/advancement.js`, `engine/advancement.test.js`; call site `store.js:941`.
- **Approach:**
  - Pure `normalizeOptionalTable(raw)`: Circle-keyed object -> `Map` circle -> `{minTalents, minRank, fromCircle}`; returns `null` unless it is a non-empty object whose keys are integers >= 2 and every row has positive integer fields (=> standard gate).
  - Pure `countableTalents(ref, talents)`: input is the raw list `[{name, rank, circle, viaVersatility}]` for ONE Discipline. Reuse `engine/talent-options.js` exports (`isOption`/DT-set helpers and `UNIVERSAL_TALENTS`); do **not** duplicate those lists or re-derive them in the store. Names compare by **exact string equality only** (Set/Map lookups; no regex, no substring/prefix matching). Keep Discipline Talents (names in `ref.circles[].talents`) and Talent Options; drop `freeTalents`, Durability, Karma Ritual (R5) and `viaVersatility === true`. Duplicate entries for the same name collapse to one (keep the highest rank, tie-break first listed) so a name never counts twice.
  - `optionalRequirement(ref, target, talents, table)` -> `{target, rule:'optional', minTalents, minRank, fromCircle, counted:[{name,rank,circle}], met, total:minTalents, hasFromCircle, countMet, satisfied, unresolved, gating: [], missing: []}`. `met` counts countable talents with `rank >= minRank`; `countMet = met >= minTalents`; `hasFromCircle` = some counted talent at `rank >= minRank` with stored `circle === fromCircle` exactly (R6 addendum; null/undefined `circle` never matches); `satisfied = countMet && hasFromCircle`. A target with no table row => `unresolved: true, satisfied: false`. `gating: []` and `missing: []` are kept on the optional result so existing readers of `nextRequirement.gating`/`missing` (ui/ed-disciplines.js, ed-app.js) do not throw; I3 updates every such reader to branch on `rule === 'optional'`.
  - **Semantics under the optional gate (owner decision; differs from the standard path):** `circleStatus(ref, attained, rankByName, opts = {table, talents})` with `opts.table` present does NOT use `supportedCircle`'s climb. `next = attained + 1` (null when beyond `ref.circles` or beyond the table's max row; existing cap rules preserved); `eligible = optionalRequirement(next).satisfied`; `consistent` = the stored Circle's own row, **count clause only** (`countMet` for row `attained`; true for `attained <= 1` or when `attained` has no table row). The from-Circle clause is deliberately excluded from consistency because legacy, hand-built or null-`circle` data cannot be judged on it; it only gates advancement. `supported` keeps its field shape: `attained + 1` if eligible, else `attained` if consistent, else `max(1, attained - 1)`. So `eligible = supported > attained` and `consistent = supported >= attained` hold as today. Null-`circle` and gap-Circle characters therefore never flip `consistent` or lose `eligible` by accident; only the real count/from-Circle at their own next row decides eligibility.
  - Table absent => the existing functions run unchanged (off => deep-equal to current outputs).
  - Call site: `circleStatus(ref, d.circle, Object.fromEntries(d.talents.map(t => [t.name, t.rank])), table ? { table, talents: d.talents } : undefined)`; the raw `d.talents` (not model rows) is passed.
- **Dependencies:** I1 (table via `legendFile`, flag via `homebrewSets`).
- **Acceptance criteria (tests):**
  - Mica example (Third Circle needs 6 talents at rank 3, one from Circle 2) pass/fail edges; every table row boundary (N-1 vs N talents, rank-1 vs rank, from-Circle talent present/absent), also driven row-by-row from the legend.json data.
  - Circles 12-15 where min rank (11/11/12/12/13) lags Circle.
  - Talent Options count (including one taken at the from-Circle); free talents/Durability/Karma Ritual do not count (R5); a talent at a Circle above the from-Circle does not satisfy the clause; `viaVersatility` talent does not count; null `circle` never satisfies the from-Circle clause.
  - Two Disciplines evaluated independently (a talent in A never counts for B).
  - Duplicate-name entries count once (a duplicate cannot fake N).
  - Exact-name matching: a near-name (case change, substring, "X" vs "X II") does not count.
  - Cap: with the table max row 15 above the highest Circle in `ref.circles`, `next` is null/not eligible at the top Circle, and an `attained` beyond the table has no row and stays consistent.
  - F2 cases, rule on: (a) legacy character at Circle 5 with null `circle` on every talent and >= 8 talents at rank 5 stays `consistent:true`; with row 6's count met but no from-Circle-5 talent, `eligible:false` without flipping `consistent`; (b) a gap Circle (no talent stored at Circle 3) at attained 5: `consistent` follows only row 5's count clause; (c) too few counted talents for its own row => `consistent:false`, `eligible:false`.
  - Missing row => unresolved/not satisfied; invalid/missing table => standard gate; table absent => deep-equal to current outputs (all existing `advancement.test.js` cases untouched and green).
- **Risks / unknowns:** (1) consistency ignores the from-Circle clause by design (documented in the engine header and docs). (2) Highest-rank dedupe is a builder-local choice, covered by test.

### I3 - Disciplines tab: advancement checklist
- **Covers tickets:** T3
- **Rules:** R1, R2
- **Tier:** 3 (UI-GUIDELINES; data down/events up; both themes; modal Escape/Enter untouched)
- **What:** When `nextRequirement.rule === 'optional'`, show "N talents at rank R, one from Circle C" progress instead of the per-DT rank gate in the Circle track tooltips and the Train/advance confirm; eligibility, Train button and the "consistent/justified" warning already follow `circleStatus` (I2).
- **Where:** `ui/ed-disciplines.js` `_circleTrack` (`:820-839`; `curTitle`/`nextTitle` strings hard-coding "Circle 1-N Discipline Talents ... Rank N") and `_advanceModal` (`:860`, add a read-only progress row listing counted talents and the from-Circle status). Grep every reader of `nextRequirement` / `.gating` / `.missing` across `ui/` and `ed-app.js` and make each branch on `rule`. No new event; `ed-advance-circle` unchanged.
- **Approach:** pure formatting of engine-supplied fields (`met/total`, `minRank`, `fromCircle`, `hasFromCircle`, counted names); render `unresolved` with the muted `—` placeholder pill (UI-GUIDELINES §5), never a number. Reuse `.cchk`, `.csub`, `.crow` so both themes work with no new colours. Keep the text-building in a small pure exported helper next to the engine and unit-test it (no Lit test harness).
- **Dependencies:** I2.
- **Acceptance criteria:** rule off => rendered output identical; rule on => the track tooltip and Train modal state the table row for the next Circle; no derived number stored; every `nextRequirement` reader handles the optional shape without throwing (grep-checked, helper tested); helper unit tests green.
- **Manual owner checks (tests cannot cover these; the owner runs them before release):**
  1. Rule off: Disciplines tab and Train modal look/behave exactly as before.
  2. Rule on: Circle track tooltip and Train modal show "N talents at rank R, one from Circle C" with correct progress, for an eligible and a not-eligible character.
  3. Unresolved placeholder (e.g. top Circle / missing row) shows `—`, no number.
  4. Light theme and dark theme: checklist rows, pills and tooltips legible, no new colours.
  5. Train modal keyboard: Enter confirms only when eligible; Escape closes; focus behaviour per docs/MODALS.md unchanged.
- **Risks / unknowns:** `ed-disciplines.js` is large; keep the change local to the two methods.

### I4 - Verify identification inputs reach the engine
- **Covers tickets:** T2 (supporting)
- **Rules:** R2, R6 addendum
- **Tier:** 3
- **What:** Guarantee the engine receives the raw `d.talents` including `circle` and `viaVersatility`, not model rows (which drop `viaVersatility`).
- **Where:** `store.js:941` call site; `store-advancement.test.js` / `store-homebrew.test.js`.
- **Approach:** `deriveModel` tests (rule on and off; rule enabled via a homebrew file with `advancement.optionalTable: true` plus the real `legendFile`): (a) Archer with one `viaVersatility: true` talent at high rank and one Talent Option: Versatility excluded, option counted (off ignores the flag, as today); (b) talents with null `circle` through `deriveModel`: no false `consistent:false`, from-Circle clause unmet; (c) rule on but `costs.optionalAdvancement` absent => standard gate; (d) rule on with a non-boolean value (e.g. `1`) => standard gate (strict `=== true`); (e) the flag is read from raw `d.talents` (a model-row-only input would fail the test).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** tests green; synthetic character is used (no real character uses `viaVersatility`).
- **Risks / unknowns:** none.

### I5 - Docs and changelog
- **Covers tickets:** T4
- **Rules:** R1, R2
- **Tier:** 3
- **What:** Document the target, the table and the optional gate; add a changelog entry.
- **Where:** `docs/HOMEBREW-RULES.md` §5.5 (add boolean `advancement.optionalTable` to the registry; value forms unchanged; note the table lives in `rules/legend.json` `costs.optionalAdvancement`, is rule data and is never stored on the character; per-Discipline semantics; what counts/does not; attained+1 eligibility and count-only consistency; missing/invalid table => standard gate); the file-top `source` string if it enumerates targets; `ARCHITECTURE.md` lines describing the advancement gate and `costs` contents; `docs/UI-GUIDELINES.md` Disciplines tab Circle track; `engine/advancement.js` header comment; `data/changelog.json` entry. No homebrew-modal task (boolean `set`; nothing new rendered).
- **Approach:** concise edits; no schema tag change.
- **Dependencies:** I1-I4.
- **Acceptance criteria:** docs match code; `npm test` green.
- **Risks / unknowns:** none.

## Sequencing
1. I2 first: pure engine + normaliser (testable in isolation).
2. I1: legend data + rule + registry + store wiring, so I2 is reachable through `deriveModel`.
3. I4: store-level tests of the identification inputs.
4. I3: UI consumes the new `nextRequirement` shape (every reader audited).
5. I5: docs/changelog last, then the owner's manual checks listed in I3.

## Open questions
- Shared Discipline Talents (R4: counted for every applicable Discipline): characters store a talent under each Discipline's own list, so per-Discipline counting already follows; confirm no character stores shared DTs in only one list. Not blocking.

## Review responses
- **F1 (major):** fixed. Table moved to `rules/legend.json` `costs.optionalAdvancement`; `advancement.optionalTable` is a boolean scalar; array value and the §5.5 widening dropped. Shape check: `ed-legend/1` `costs` is a free map of named siblings and no validator enumerates its keys, so no shape/version change and no NEEDS_HUMAN.
- **F2 (major):** fixed per owner decision. No climb under the optional gate; eligibility = attained+1 row only; consistency = stored Circle's row, count clause only. Note: I excluded the from-Circle clause from consistency (not only from `supported`), because null/gap `circle` data cannot be judged on it and the owner said such characters must not wrongly flag. Tests listed in I2.
- **F3 (major):** fixed. The R6 addendum (owner Decision) covers later-learned options; the "uncovered" caveat is removed and "no open rules points" is now accurate.
- **F4 (minor):** fixed. Reuse `engine/talent-options.js` exports incl. `UNIVERSAL_TALENTS`; exact-name matching only; optional result keeps `gating: []`/`missing: []`; I3 audits every `nextRequirement` reader.
- **F5 (minor):** fixed. Added cap, duplicate-name, F2, row-by-row `fromCircle === circle - 1`, null `circle` through `deriveModel`, raw-`d.talents` tests; `rules/talents.json:8` cited as sole authority for `viaVersatility`.
- **F6 (minor):** fixed. Explicit manual owner checks in I3 (rule off/on, placeholder, light/dark, Enter/Escape in the Train modal); homebrew-modal verification removed (boolean `set`); I5 states the table is not stored on the character.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
