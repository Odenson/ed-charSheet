---
status: implemented
shipped: unreleased
---
# Delivery Plan: Spell effect outcome on other targets (spell-target-effect-outcome)

## Context & learnings
The Spells tab cast panel has a "Cast on" toggle (This character / Other). Active
effects only make sense for self-casts. The owner wants: when Other is selected, the
Active effects card is replaced by a **Target effects** card reporting the outcome of
the latest cast on another target (qa-log 2026-10-02):
- Latest outcome only; no list, countdown or log.
- Content is mechanical: spell, hit/miss vs target number, success levels, Effect roll
  total or static effect, extra-thread picks applied, duration. No rules prose, no
  armor type/math.
- Appears on cast; persists across toggling to This character and back and across tab
  switches; replaced only by the next Other cast; misses are reported.
- House ruling (R3): a miss reads "Miss vs <N> — no effect" and says nothing about
  threads or Karma; thread behaviour is unchanged.
- Text is composed by the engine (golden rule); unrolled values stay null so the UI
  shows muted dashed placeholder pills. Nothing is stored in character data or
  `rules/*.json`.
- Tier-1 sign-off recorded (qa-log "TIER-1 SIGN-OFF") for the Spells tab contents change
  and the UI-GUIDELINES §4 edit.

## Discoveries
- `ui/ed-spells.js` `_castPanel(plan)` renders the Cast-on toggle (`this._subject`
  'self' | 'other', buttons ~l.1110) and ends with `${this._activeEffects()}` (~l.1206).
  `_activeEffects()` (l.437) reads `this.ctx.active`; `.aehead/.aecard/.aeempty/.aerow`
  styles exist (l.154+).
- Cast flow state: `_prog` (`threadsWoven, castDone, weave, cast{total,outcome,levels},
  effect, extraPicks, pendingPick`), reset by `_blankProg()` when the Effect lands or a
  static/none effect auto-resolves (`_onRoll`, l.396-425). So `_prog` cannot hold the
  Other outcome: it is wiped after every cast. A separate field is required.
- `_rollCast` (l.993) captures per-cast context into instance fields consumed by
  `_onRoll`: `_castTarget`, `_castName`, `_castFoldsSelf` (= foldsOnSelf && subject self),
  `_castEffectKind`. The same pattern fits an `_castOnOther` flag captured at cast time
  (the subject toggle can change between Cast and Effect roll).
- `_onRoll` 'cast' branch: levels via `successCount(total, target)` (from
  `engine/combat.js`); Karma re-rolls re-fire `ed-roll-logged` with the same rollId and
  refresh the result. 'effect' branch: `res.total`. Static/none effects auto-resolve in
  the cast branch (`effect.outcome.word`).
- Session persistence: module-level `SCRATCH` Map keyed by characterId, saved in
  `disconnectedCallback` via `_saveScratch`, restored in `firstUpdated`/`updated`
  (character switch calls `_resetWorkspace`). The outcome joins this exactly as
  `subject`/`prog` do. Session-only, never persisted.
- Engine: `engine/spells.js` already has `castPlan` (name, effect kind step/static/none,
  `duration` string, `successes`, `extraThreads`), `effectStepBonus`, private
  `castBoosts(spell, extraPicks, successLevels)` (stepAdd/ratingAdd/durationRounds,
  structured effects, no label parsing) and `durationRounds(duration, rank)`.
  `buildSpellsContext` does NOT expose the Spellcasting rank; `ed-app._spellcastingRank()`
  does. Tests: `engine/spells.test.js` (node:test, run by `npm test`).
- Rank source (verified): `store.js` l.683 puts `rank: t.rank` on every derived discipline
  talent, so `buildSpellsContext`'s `derived.disciplines[].talents[]` do carry `rank`.
  `ed-app._spellcastingRank()` (l.713) reads the raw character instead. The Spells UI has
  no character access, only `this.ctx`. This plan no longer needs the rank (see I1).
- After a MISS the Effect roll is still enabled in the current flow (`ed-spells.js` l.1042
  gates only on `castDone`), so an Effect roll can land on a missed Other cast; the
  outcome must ignore it.
- `successCount` convention: levels = 1 at the number, +1 per 5 over; extra successes =
  levels − 1 (R2). Default target / minimum 2 handled upstream; engine treats the
  target as given.
- Docs: UI-GUIDELINES.md l.60 Spells row; ARCHITECTURE.md mentions Spells only at the
  file/engine inventory level (l.284, 481, 514) — no cast/active-effects flow described,
  so no ARCHITECTURE edit is needed (confirm during I4). `data/changelog.json`
  `unreleased.changes` is empty.

## Guardrail classification
- I1 engine function + ctx field: Tier 3 (pure, DOM-free, additive; no schema/taxonomy
  change; reads structured option effects, no new string parsing).
- I2, I3 Spells tab UI (new Target effects section, session state): Tier 1 (six tabs'
  defined contents; placeholder-pill rule; golden rule). Sign-off: qa-log 2026-10-02
  "TIER-1 SIGN-OFF" — Yes, sign off. In-scope constraints: data down/dispatch up, UI
  computes no game values, dashed placeholder pills, theme-aware, `--fs-*` tokens, two
  font weights, no desktop vertical-scroll regression.
- I4 docs (UI-GUIDELINES §4 row): Tier 1, same sign-off. Changelog line: Tier 3.
- No Tier-2 change (no taxonomy vocabulary touched).

## Rules dependencies
| Rule | rules.md | Status | Used by |
|---|---|---|---|
| Casting-test target number (Casting Difficulty / TMD; min 2) | R1 | ANSWERED | I1, I2 |
| Success levels (1 at DN, +1 per 5 over; extras per Success Levels line) | R2 | ANSWERED | I1 |
| Failed test: no effect; threads/Karma silent | R3 | NOT-COVERED (partial) — owner house ruling recorded: "Miss vs N — no effect", no thread/Karma claim | I1, I3 |
| Effect test after success; no armor type/math in outcome (owner) | R4 | ANSWERED + owner decision | I1 |
| Duration is a per-spell label (rounds/minutes/hours/other; Rank = Spellcasting rank). Only the label is shown; no rounds conversion | R5 | ANSWERED (label only) | I1 |

No open NEEDS_RULES.

## Implementation items
### I1 — Engine: `otherCastOutcome` readout
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4, R5 (label only)
- **Tier:** 3
- **What:** Add a pure function `otherCastOutcome(spell, cast, opts)` to `engine/spells.js`
  returning a structured outcome for a cast on another target:
  `{ spell, hit, target, total, levels, extraSuccesses, effect, picks, duration, text }`.
  - `cast` = `{ seq, name, target, total, levels, extraPicks, effectTotal }` (what the UI
    recorded); `spell` = the joined catalog spell (or `castPlan` result), or null;
    `opts` reserved (none needed).
  - `hit = levels >= 1`. Miss: `effect` null, picks `[]`, duration null,
    `text = "Miss vs <target> — no effect"`; no thread/Karma wording anywhere.
  - Hit: `effect` is one of `{ kind: 'step', total: number|null }` (null until the Effect
    roll lands, so the UI shows a placeholder pill), `{ kind: 'static', value, label }`,
    or `{ kind: 'none' }`. `picks` collapses assigned extra-thread labels to
    `{ label, count }`. `duration` = `{ label: spell.duration }` only (null when the spell
    has none). **No rounds figure**: the 1 minute = 10 rounds / 1 hour = 600 rounds
    conversion in `durationRounds` is an owner/app convention for self-cast countdowns
    (its docstring, `engine/spells.js` l.198), NOT covered by R5, and the ticket asks only
    for "duration if any". Success-level duration extensions are not computed or shown
    either (no derivation beyond mechanical values); the label is shown as written, e.g.
    "Rank minutes". Therefore `otherCastOutcome` takes no rank, and
    `castBoosts().durationRounds`/`durationRounds()` are not used.
  - `effectTotal` is honoured only when `hit` is true; on a miss the engine ignores it
    (`effect` stays null).
  - `levels` is the cast success count (1 at the Difficulty Number, +1 per full 5 over,
    R2). The text and pills show "N success(es) vs <target>" with **N = `levels`**.
    `extraSuccesses` (= levels - 1) is exposed but never used as the displayed N.
  - `text` is a single composed string (spell, "N success(es) vs <target>", effect,
    picks, duration label) with no rules prose and no armor note. When `spell` is null
    (unresolvable) it returns a text-only outcome built from `cast.name`
    (`{ spell: cast.name, hit, target, total, levels, extraSuccesses, effect: null,
    picks: [], duration: null, text }`); the miss text is unchanged. The structured fields
    let the UI render pills; the engine owns every string.
  - No `castingRank` ctx field is added (not needed). If a later spec reinstates a rank,
    the single approach is `castingRank` on `buildSpellsContext` next to `castStep`
    (derived talents carry `rank`, verified above), with a unit test including an absent
    `rank` -> 0.
- **Where:** `engine/spells.js`; tests in `engine/spells.test.js`.
- **Approach:** Reuse `effectReadout` and the spell's structured fields (via `castPlan` or
  the spell directly); keep input shape plain so tests need no DOM.
- **Dependencies:** none (first item).
- **Acceptance criteria:** node:test cases for: miss (levels 0) reads exactly
  "Miss vs <N> — no effect" with no thread/Karma wording; exactly 1 success (no extras);
  extra successes (total target+10 -> `levels` 3, `extraSuccesses` 2, and the text/pill
  count asserts "3 successes", i.e. N = `levels`); step-effect spell before the Effect roll
  (`effect.total` null) and after (number); static-effect spell; no-effect spell; spell
  with duration + extra-thread picks (stacked counts) showing the duration label only
  (no rounds figure, no rank input); spell with no duration (duration null);
  `effectTotal` supplied on a miss is ignored (effect null, text unchanged); null spell ->
  text-only outcome from `cast.name`. Function is pure/DOM-free; `npm test` and
  `tools/check-imports` pass. Expected values drawn only from rules.md R1-R5.
- **Risks / unknowns:** Exact `text` wording is not specified by the tickets; the spec
  phase should fix it and tests assert it. Unrolled/unknown values must be null, never
  fabricated.

### I2 — Spells tab: record the latest Other cast as session state
- **Covers tickets:** T2
- **Rules:** R1, R2, R3
- **Tier:** 1 (sign-off: qa-log 2026-10-02 "TIER-1 SIGN-OFF")
- **What:** In `ui/ed-spells.js` hold the inputs of the latest cast on Other in a new
  `_otherCast` state property (`{ name, target, total, levels, extraPicks, effectTotal }`
  or null), separate from `_prog`.
  - In `_rollCast` capture `this._castOnOther = this._subject === 'other'` alongside the
    existing per-cast fields, and a per-cast token `this._castSeq = ++this._seqCounter`
    (instance counter; the token travels with the cast through its Karma re-rolls).
  - In `_onRoll` 'cast' branch: if `_castOnOther`, set `_otherCast` from
    `{ seq: this._castSeq, name: this._castName, target: this._castTarget, total, levels,
    extraPicks: [...this._prog.extraPicks], effectTotal: null }` — hit or miss, replacing
    any previous record. A Karma re-roll of the same rollId refreshes it (same as `_prog`).
    Static/none effects: no effect roll will follow; the engine reports from spell data.
  - In 'effect' branch: if `_castOnOther` and `_otherCast?.seq === this._castSeq`, set
    `effectTotal = res.total` (also on Karma re-roll refresh). The seq token (not the spell
    name) distinguishes two consecutive casts of the same spell. A miss can still be
    followed by an Effect roll in the current flow (Effect is enabled on `castDone`); the
    record keeps the value but the engine ignores `effectTotal` when `hit` is false (I1).
  - Self-casts never touch `_otherCast`. Selecting another spell/cast type or toggling the
    subject does not clear it.
  - Add `otherCast` (cloned) to `_saveScratch`/`_restoreScratch`; clear in
    `_resetWorkspace` (character switch) only. No dispatch to `ed-app` and no stored
    character data change is needed (session UI state, like the existing scratchpad).
- **Where:** `ui/ed-spells.js` (`static properties`, constructor, `_rollCast`, `_onRoll`,
  `_saveScratch`, `_restoreScratch`, `_resetWorkspace`).
- **Approach:** UI stores only raw results it already holds; it computes nothing (levels
  already come from `successCount`, existing behaviour).
- **Dependencies:** none for the state itself; consumed by I3.
- **Acceptance criteria:** after a cast on Other (hit or miss) `_otherCast` is populated;
  a second Other cast replaces it; a self-cast leaves it unchanged; it survives toggling
  the subject and a tab switch (destroy/rebuild via SCRATCH); a different character does
  not inherit it; no character data / `ed-edit-*` event emitted; Effect roll after a
  toggle back to This character still updates the Other record it belongs to.
- **Risks / unknowns:** An Effect roll cannot belong to a previous cast: Cast is disabled
  while `castDone`, and `_castSeq`/`_castOnOther` are overwritten only at the next
  `_rollCast`, which requires the Effect roll to have landed. The seq match makes this
  explicit. `_seqCounter` is not persisted; on restore it resumes above the saved `seq`.

### I3 — Spells tab: Target effects card replaces Active effects on Other
- **Covers tickets:** T2
- **Rules:** R3 (miss wording), R4 (no armor note)
- **Tier:** 1 (sign-off as I2)
- **What:** In `_castPanel`, replace the trailing `${this._activeEffects()}` with
  `${this._subject === 'other' ? this._targetEffects(plan) : this._activeEffects()}`.
  `_targetEffects` renders an `h4.circlelbl` "Target effects" and an `.aecard`-styled card:
  - Empty state (no `_otherCast`): short muted line, e.g. "No cast on another target yet."
  - Otherwise calls engine `otherCastOutcome(spell, this._otherCast)` (no rank input, see I1) and renders
    its result: spell name; Hit/Miss pill (reuse `.succn` / `.succn.miss`); "N successes vs
    <target>"; Effect pill (rolled total, static effect label, or a dashed-border muted
    placeholder pill while `effect.total` is null); extra-thread pills (`.pickchip`);
    duration. Miss shows only the engine's "Miss vs N — no effect".
  - The spell shown is the record's, not the currently selected spell (the outcome persists
    when a different spell is selected); resolve it through `joinSpell`/the catalog from
    `this.ctx` by `_otherCast.name`. If it is not resolvable, call
    `otherCastOutcome(null, record)` (text-only outcome from `name`, I1) and render that
    text without pills.
  - Add scoped styles using only existing tokens (`--fs-*`, `--muted`, `--border`,
    `--spell`, `--karma`, `--danger`), weights 400/500 only, theme-aware via existing
    variables; dashed placeholder pill style per UI-GUIDELINES.
  - Note the card sits in the right column below the details grid: keep it compact so the
    desktop layout does not gain vertical scroll. Layout: line 1 = spell name + Hit/Miss
    pill + "N successes vs <target>"; line 2 = Effect pill + extra-thread pills; line 3 =
    duration label (omitted when none). Pills may wrap on narrow widths; a miss is one line.
- **Where:** `ui/ed-spells.js` (`_castPanel`, new `_targetEffects`, styles block).
- **Approach:** Data down from the engine result; presentational only. No new event.
- **Dependencies:** I1 (engine), I2 (state).
- **Acceptance criteria:** Other selected: "Target effects" card shown, Active effects
  hidden; This character: Active effects exactly as today with unchanged content; empty
  state before any Other cast; hit, miss, step-effect-pending (placeholder pill then
  number), static and no-effect spells all render correctly; next Other cast replaces the
  card; works in light and dark; font tokens only; no vertical-scroll regression on
  desktop; mobile still single column. (UI is verified by the owner per project memory;
  no preview/browser run by the agent unless asked.) Owner manual-verification checklist:
  (1) miss: one line "Miss vs N — no effect", no thread/Karma wording; (2) hit with 1 and
  with several successes; (3) step-effect pending placeholder pill, then the number after
  the Effect roll; (4) static-effect and no-effect spells; (5) select a different spell:
  the card still shows the previous Other cast; (6) toggle to This character and back, and
  switch tabs and back: outcome persists; Active effects unchanged on This character;
  (7) a second Other cast replaces it; Effect roll after a miss adds no Effect pill;
  (8) switch character: no carry-over; (9) light and dark themes; (10) desktop height: no
  vertical scroll; mobile single column.
- **Risks / unknowns:** Active effects, when subject toggles to Other mid-session, are
  merely hidden, not cleared (session `active` set is untouched) — intended.

### I4 — Docs and changelog
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 1 (sign-off as I2) for UI-GUIDELINES; changelog is Tier 3
- **What:** Update `docs/UI-GUIDELINES.md` §4 Spells row to "Grimoire + spell matrices by
  circle, the Weave/Cast/Effect cast flow, self-cast active effects, and target effects
  (cast on Other) — spellcasters only". Leave `ARCHITECTURE.md` unchanged (it does not
  document the cast/active-effects flow; re-check at doc-sync). Add one user-facing line
  to `data/changelog.json` `unreleased.changes` (type `added`) and a short `summary`.
  Mention `otherCastOutcome` in the ARCHITECTURE.md `engine/spells.js` inventory line only
  if that line enumerates exports (l.284).
- **Where:** `docs/UI-GUIDELINES.md`, `data/changelog.json`, maybe `ARCHITECTURE.md`.
- **Approach:** Minimal text edits.
- **Dependencies:** I2/I3 settled (so the wording is true).
- **Acceptance criteria:** §4 row updated; changelog entry is a single user-facing line;
  JSON stays valid (`npm test`).
- **Risks / unknowns:** none.

## Sequencing
1. **I1** — engine first; test-first friendly, no UI dependency, fixes the outcome shape.
2. **I2** — session state wired against the engine input shape.
3. **I3** — render; needs I1 output and I2 state.
4. **I4** — docs/changelog last so they describe what shipped.

## Open questions
- Exact outcome `text` wording and pill composition (spec phase to fix; I1 tests assert it).
- Whether to show the target number in the pill for a miss when the user left the default
  target (it is always the number actually used for the roll).

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- **F1 (major) - fixed.** Chose label-only: `duration = { label }`, no rounds figure, no
  success-level duration extension, no rank input. The minute/hour -> rounds conversion is
  an owner/app convention (docstring of `durationRounds`, used for self-cast countdowns),
  not covered by R5; the R5 row now reads "label only". rules.md left unchanged.
- **F2 (major) - fixed.** Verified `store.js` l.683: derived talents carry `rank`, so a ctx
  `castingRank` would work; but with F1 no rank is needed, so no ctx field is added and
  the open question is removed. If a rank is later reinstated the one approach is
  `castingRank` in `buildSpellsContext` (+ test with absent `rank`).
- **F3 (minor) - fixed.** Confirmed the Effect roll is still enabled after a miss. The
  engine ignores `effectTotal` when `hit` is false (tested); the name match is replaced by
  a per-cast `seq` token captured in `_rollCast`.
- **F4 (minor) - fixed.** N = `levels` stated in I1 and asserted in the target+10 -> "3
  successes" test; `extraSuccesses` is not the displayed number.
- **F5 (minor) - fixed.** `otherCastOutcome(null, record)` returns a text-only outcome from
  `name`; I3 layout specified; owner manual-verification checklist added.
