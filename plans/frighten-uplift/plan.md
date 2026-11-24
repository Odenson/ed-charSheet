---
status: building
---
# Delivery Plan: Frighten uplift (frighten-uplift)

## Context & learnings
A successful Frighten roll (vs target Mystic Defense) should put a display-only entry on the target in the Active effects window: -2 x successes to all tests, Rank rounds, countdown, ended by the existing X, with a reminder that the target may make a Willpower test each round vs the adept's Frighten Step to end it. Owner decisions (qa-log): mirror Taunt; reminder text + existing X, no new roll UI; computed total for Frighten only (Taunt text stays static); non-goals are auto-applying penalties, in-app end-test roll, stacking, changing Taunt's display. Because Frighten rolls vs Mystic like self-buff Mystic Aim, the `roll.vs === 'Social'` inference cannot identify opponent arms; owner signed off (2026-11-24T11:58Z) on an explicit optional `arms.opponent: true`, migrating Taunt and Frighten and removing the hardcode. Duration follows the book (Rank rounds), not the app's `duration: "special"` (rules R2).

## Discoveries
- `store.js` 1191-1210 (`buildTalentRow`): derives `arms`; `opponent` and `text` both keyed on `cat.arms.roll?.vs === 'Social'` (l.1204-1207); text comes from the first `note` effect. `resolveArmRounds` already resolves `"rank"`. `arms.roll.step` is computed on the model row only; descriptors carry no `roll` key and must forward it as `arms.step` (I3). Frighten's data effect `duration: "special"` is left untouched; `arms.rounds` drives the countdown.
- `store.js` 2057 passes `session.opponentEffects` into the window builder; 2087 skips `a.opponent` in armedTalents consumers. `engine/combat.js` 580 likewise. These key off the record's `opponent` flag, not `vs`, so they need no change.
- `engine/active-effects.js` 162-174 `armOpponent({arms, successes, targetName, seq})`: builds record `{id:'opp:N', kind:'talent', name: arms.name ?? 'Taunt', effectLabel: successText(successes), text: arms.text, roundsLeft/Total: arms.rounds}`. Pure; has a test file next to it. `entry()` (l.100) renders `text` and `effectLabel` verbatim, so a computed string needs no UI change.
- `ui/ed-app.js` 399-409: opponent arm path, uses `arms.opponent`; no change to routing, but must keep passing the new descriptor fields through to `armOpponent`.
- Two arm-descriptor builders must forward new fields: `ui/ed-disciplines.js` ~408-409 and `ui/ed-combat.js` ~829-841 (the Combat builder also presets the "vs" number from `_targetNum()` for opponent arms; Frighten has no combat pill, so it is reached via Disciplines / Combat dropdown, but forward fields in both).
- `ui/ed-roll-modal.js` 527 hint already reads `aim.opponent` ("Each success applies the effect to the target."), so no change.
- Frighten data (`rules/talents.json` 577-609) already carries a `test-modifier` effect (`on-success`, `perSuccess`, subtract 2, `duration: "special"`). Armed-effect folding only happens for armedTalents / combat pill options (`engine/combat.js` 548-575); opponent arms never create armedTalents and Frighten has no `combatOptions`, so the effect should not fold into the adept's pools. Verified by test, not assumed (existing `engine/combat-opponent-skip.test.js`, `engine/taunt-data.test.js` are the precedent).
- `docs/EFFECT-TAXONOMY.md` ~355-362 documents `arms` (`{roll:{vs}, rounds}`, `"rank"` for Taunt); this is where `opponent` is documented.
- Generic per-success total (T2 open question): derive it from the talent's existing data, no string parsing. In store, for opponent arms, find the first `on-success` + `perSuccess` + `test-modifier` effect and pass `arms.perSuccess = { delta }` where `delta = value` negated when `operation === 'subtract'` (Frighten: -2). Taunt has no such effect (note only), so Taunt gets no computed text and stays static. The engine composes the display string.

## Guardrail classification
- I1 (opponent flag in rules schema + store derivation): Tier 1 (rules schema shape, additive optional field, no version tag change). Owner sign-off recorded: qa-log 2026-11-24T11:58Z ("uplift both to use the optional arm.opponent:true and remove the hardcoded component"). Not an effect-taxonomy vocabulary change (no version bump).
- I2 (Frighten data + engine computed text): Tier 3 (new data within schema; pure engine addition). Frighten data uses `arms.opponent` covered by the same sign-off. `duration` edit keeps the existing vocabulary.
- I3 (descriptor plumbing): Tier 3, preserves data-down/dispatch-up.
- I4 (docs): Tier 3.
No Tier-1 item lacks sign-off.

## Rules dependencies
- R1 Frighten stat block (FAQ-HIT, Q017/Q018/Q049): data already matches; no change.
- R2 Penalty -2 per success to all tests, Rank rounds, one entry per cast (ANSWERED, Q050; owner decision 2026-11-24). Duration APP-DIFFERS: app data says "special", feature follows book.
- R3 End-test: target Willpower test per round vs Frighten Step, success ends it (ANSWERED); reminder text only (owner decision).
- R4 Fear-immune targets unaffected (ANSWERED): note text only.
- R5 Death's Head / Evil Eye: out of scope.
No open NEEDS_RULES.

## Implementation items
### I1 — Explicit `arms.opponent` flag (replace Social hardcode)
- **Covers tickets:** T1
- **Rules:** none
- **Tier:** 1 (sign-off qa-log 2026-11-24T11:58Z)
- **What:** Add `"opponent": true` to Taunt's `arms`; store derives `arms.opponent` from `cat.arms.opponent === true`; text source no longer conditioned on Social.
- **Where:** `rules/talents.json` (~2814 Taunt arms), `store.js` 1199-1207.
- **Approach:** Taunt `arms: { roll:{vs:"Social"}, rounds:"rank", opponent:true }`. In store: `opponent: cat.arms.opponent === true`; `text: opponent ? (note effect summary ?? null) : null`. Keep `roll.vs` as-is (used to set the target number / roll modal). No remaining `=== 'Social'` decides opponent-ness (grep to confirm; the `Social` hits at ed-combat 1196-1207 and combat.js 669-683 are Defence rating code, unrelated).
- **Dependencies:** none.
- **Acceptance criteria:** Taunt behaves identically (opponent record, static note text, rank rounds); Mystic Aim and Anticipate Blow still self-arm (not opponent); grep shows no Social inference; existing conformance/validation tests pass (`engine/taunt-data.test.js` extended to assert `arms.opponent === true`).
- **Risks / unknowns:** any JSON-schema/validator that rejects unknown `arms` keys (check `engine/validate-item.js` and rules conformance tests; extend allowed keys if it validates `arms`).

### I2 — Frighten data + computed per-success total
- **Covers tickets:** T2
- **Rules:** R1, R2, R3, R4
- **Tier:** 3 (uses the I1 field)
- **What:** Frighten gets `arms { roll:{vs:"Mystic"}, rounds:"rank", opponent:true }` and a `note` effect carrying the end-test text; store derives `arms.perSuccess` and forwards `arms.roll.step`; engine `armOpponent` composes the computed display.
- **Where:** `rules/talents.json` 577-609; `store.js` ~1191-1210; `engine/active-effects.js` `armOpponent` (+ `engine/active-effects.test.js`, new `engine/frighten-data.test.js`).
- **Approach:**
  - Data: add `arms`; add note effect e.g. `{ "type":"note","source":"talent","summary":"Target may make a Willpower test each round vs the Frighten Step to end the fear; fear-immune targets are unaffected." }`. Keep existing test-modifier effect (but update its `duration` to `"rank"` rounds equivalent only if the vocabulary has one; otherwise leave `"special"` and note the book difference in the summary). Note: the note effect is the text source (Taunt-style) so `text` stays data-driven.
  - Store: for opponent arms compute `perSuccess = { delta }` from the first `on-success`+`perSuccess` `test-modifier` effect (negate for `subtract`), else null. Forward `arms.roll.step` (already present). No new rules-schema field.
  - Engine `armOpponent`: when `arms.perSuccess` is present, set `effectLabel` to `"N successes"` (existing `successText`) and `text` to `"<delta> x N = <delta*N> to all tests. " + note text + " " + name + " Step <step>."` Step is read from `arms.roll?.step` (omit sentence if null). Taunt (no `perSuccess`) keeps `effectLabel`/`text` unchanged. Pure function, DOM-free; "all tests" wording comes from the effect's `target.name === "Action"` / `scope` ("all" when domain test+name Action) so it stays data-driven; fall back to the effect `scope` string otherwise.
  - Descriptor shape (review F1): the roll descriptor's `arms` is built with explicit fields and has NO `roll` key. So `armOpponent` reads TOP-LEVEL `arms.step` and `arms.perSuccess` (not `arms.roll.step`). The store keeps `arms.roll.step` on the model row; I3 maps it to `arms.step` in the descriptor. All tests (including `armOpponent`) feed the descriptor shape.
  - Wording (review F4): display is `"<delta> x N = <delta*N> to all tests"`; "to all tests" only when the effect's `target.name === 'Action'`, otherwise the suffix is omitted. Test the fallback. `duration: "special"` on the data effect is left untouched (the arm's `rounds` drives the countdown).
  - Store (review F3): for opponent arms the store sets `arms.effects = []` (payload unused on the opponent path), so the roll-modal `_aimSummary` never renders "+-2 steps to Action". Taunt's effects are already empty, so its behaviour is unchanged. The roll-modal hint (l.527) is unchanged.
  - Tests (review F2): add a store-level test (`buildTalentRow` via a built character with Frighten, Taunt, Mystic Aim) asserting `arms.opponent`, `arms.perSuccess = {delta:-2}`, `arms.text`, `arms.rounds` = rank, `arms.effects = []` for Frighten/Taunt, and `opponent === false` for Mystic Aim.
- **Dependencies:** I1.
- **Acceptance criteria:** Success with k>0 successes adds one target-group entry named Frighten with "k successes", "-2 x k = -2k to all tests", Rank-rounds countdown, end-test reminder and the correct Frighten Step; a miss adds nothing and clears nothing; one entry per cast; entry never folds into the adept's pools (test: building combat/roll effects with Frighten learned and an opponent entry yields no change to pools); Taunt text unchanged (test).
- **Risks / unknowns:** Step shown is the talent's computed step (Rank+WIL, incl. current modifiers only if the model already folds them); Death's Head/other bonuses are non-goals. If the roll is at a different effective step due to karma/bonus dice, the reminder shows the base step; acceptable per non-goals, call out in docs.

### I3 — Descriptor plumbing for every roll surface
- **Covers tickets:** T2
- **Rules:** R2
- **Tier:** 3
- **What:** Forward `perSuccess` and `step` (top-level on the descriptor `arms`, see I2) in the arm descriptors so Disciplines and Combat rolls hand them to `armOpponent`. UI is not testable under `node:test`: verify manually with a Disciplines Frighten roll (and Combat dropdown if it lists Frighten).
- **Where:** `ui/ed-disciplines.js` ~408-409; `ui/ed-combat.js` ~829-841; `ui/ed-app.js` ~399-409 (verify only; passes `arms` through).
- **Approach:** Add `perSuccess: t.arms.perSuccess ?? null` and `step: t.arms.roll?.step ?? null` (top-level keys) into the `arms` object of both builders (keep descriptor shape otherwise). Check any third surface that builds an `arms` object (grep `arms:` in ui/).
- **Dependencies:** I2.
- **Acceptance criteria:** A Frighten roll from Disciplines (and Combat dropdown if listed) produces the same entry; Mystic Aim descriptors unchanged.
- **Risks / unknowns:** Combat dropdown may list only talents with combat options; confirm which surfaces expose Frighten and verify manually.

### I4 — Docs
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Document `arms.opponent` and the computed-total behaviour.
- **Where:** `docs/EFFECT-TAXONOMY.md` ~355-362 (arms note: optional `opponent: true`, replaces `vs:"Social"` inference; opponent arms are display-only; `perSuccess` is derived by the store from the talent's on-success per-success test-modifier, not authored); `rules/talents.json` header if it mentions arms; ARCHITECTURE/`docs/HOMEBREW-RULES.md` only if they reference the Social inference (grep). RULES-FAQ Q050 already added.
- **Dependencies:** I1-I3.
- **Acceptance criteria:** Docs match code; no doc mentions the Social inference.
- **Risks / unknowns:** none.

## Sequencing
1. I1 (flag + Taunt migration, Tier 1, unlocks Frighten).
2. I2 (data + engine computed text).
3. I3 (plumbing; needed to see end-to-end).
4. I4 (docs).
Rationale: I1 is independently shippable and guarded by Taunt regression tests; I2 builds on the flag; I3 completes the path; docs last.

## Open questions
- Whether the roll-time effective step (karma/bonus dice) should appear in the reminder instead of the base step; plan uses base step (non-blocking).
- Whether Frighten's `duration: "special"` should be changed in data (depends on available vocabulary); non-blocking, feature follows the book through `arms.rounds`.

## Review responses
- F1 (major, step field shape mismatch): fixed. Engine reads top-level `arms.step`/`arms.perSuccess`; I3 maps `roll.step` to `step`; tests use the descriptor shape.
- F2 (store/descriptor test gap): fixed. Store-level test added in I2; descriptor forwarding is a manual check in I3.
- F3 (roll-modal aim summary): fixed. Store sets `arms.effects = []` for opponent arms; modal untouched; Taunt unchanged.
- F4 (duration/wording): fixed. `duration` left as "special"; wording simplified with an "Action"-only "to all tests" suffix and a fallback test. The earlier "update duration" text in I2 is superseded by this.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
