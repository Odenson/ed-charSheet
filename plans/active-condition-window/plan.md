---
status: implemented
shipped: v2.9.0
---
# Delivery Plan: Active effects window (active-condition-window)

> Superseded in part by plans/frighten-uplift: opponent arms are now flagged by an explicit `arms.opponent: true` in rules data, no longer inferred from `roll.vs === "Social"`. Taunt data is now `{roll:{vs:"Social"}, rounds:"rank", opponent:true}`, and the store derives `arms.perSuccess`.

## Context & learnings
Owner approved mock-d.html (Option D): one shared "Active effects" element, styled like the Spells-tab `.aecard` (mark, name · effect, round bar, rounds pill), mounted on Combat (above the Combat log, three groups side by side) and on Spells (single stacked column), fed by ONE session-level list. Sources (all four, qa-log 2026-11-24): active spells (self + cast on Other), armed talents (Aim), timed opponent effects (Taunt only in v1), toggled combat options + blood charms; plus read-through Situational chips / Knocked Down / encumbrance Harried. Taunt auto-adds on a successful roll (rounds = Taunt rank; "-1 tests / -1 Social Defense per success" shown as text, display-only). Optional opponent name labels entries (blank = "target"). Spells cast on Other become tracked entries with countdown; the Spells "Target effects" card is removed. Grouping: no round count -> "This attack"; rounds -> "Lasting - on you" / "Lasting - on target" (Aim moves to Lasting on you). Round ticking = each Initiative roll; X ends an entry where ending is meaningful (house ruling R3; see I1 end semantics). Overview strip untouched. Session-only, no taxonomy change, no stored data. Tier-1 sign-off for Combat/Spells tab contents recorded 2026-11-24. Taunt = `arms` reused on the Taunt TALENT only (owner, qa-log last entry); Taunt skill excluded from v1.

## Discoveries
- `ui/ed-spells.js` `_activeEffects()` (l.503) / `_activeRow(e)` (l.546) render model.spells.active with `.aecard/.aerow/.aemark/.aebar/.aerounds`, low flag `roundsLeft<=3` -> `--amber`; `_targetEffects()` (l.516) shows only the latest `_otherCast` (local state l.243/455; `effectTotal` arrives later, l.487), derived via `engine/spells.js otherCastOutcome` (l.193; `out.duration` via `boostedDuration`/`durationRounds`, l.237/271; minutes x10, spells-options.test.js l.85). Mounted at l.1498.
- `engine/spells.js`: `buildActiveSpell` (l.346), `tickActiveSpells` (l.411). Self-cast flow in ed-app (~l.1074).
- `ui/ed-app.js`: session `_activeSpells`, `_activeCharms`, `_armedTalents`, `_dayReset` (l.668-672); `_advanceRound()` (l.1033) ticks spells/arms and clears charms; Day reset finalize l.1430-1431; ed-roll handler arms talents l.393 with `filter(a => a.name !== arms.name)` (replace-by-name); session passed to store l.1314-1316.
- `store.js`: model assembly l.2195-2215. `model.activeEffects` ALREADY EXISTS (folded always-on + conditions + situations; Overview strip) - must not be reused or changed. Armed arms surfaced for talents l.1184-1192 (`rounds: cat.arms.rounds ?? 1`, payload filter l.1190 keeps test-targeting/defense on-success effects, drops `note`); knacks l.1897-1931. `armedTalents` consumers: store l.2053, `engine/combat.js` collectCombatEffects l.579, ed-combat l.649/684/1027/1294, ed-spells l.1271.
- Arm descriptor builders (two): `ui/ed-disciplines.js` `_rollDetail` l.409 and `ui/ed-combat.js` ~l.804/831 (talent picker passes `arms: t.arms`, l.560). Roll modal copy "Each success arms a per-success bonus for a later roll" (`ui/ed-roll-modal.js` l.521) is wrong for Taunt.
- `engine/combat.js` `tickArmedTalents` (l.121) is the tick pattern.
- GOTCHA: toggled combat options live in `ed-combat.js` SCRATCH (`_opts`; restored per character l.400-437; cleared by `clearCombatScratch` l.53; reset on Initiative ~l.904; legacy `_charmsOn` synced l.381-386). SCRATCH also already has a `target` (target NUMBER) field.
- Situations/Knocked Down: ended via `ed-toggle-situation`; Knocked Down locked until Stand up (UI-GUIDELINES s4); encumbrance Harried locked on.
- Repo checks: `tools/check-ui-kit.mjs` (+ baseline) and `tools/check-imports.mjs` must pass after the new component/CSS move. No `arms` validator exists in `tools/`; only the `rules/talents.json` header note (l.11) and docs/EFFECT-TAXONOMY.md s6 (~l.350-363) describe arms.
- Mock-d fixes (I7): group by lifetime, Aim under Lasting on you, Taunt rounds = rank, no "Entangle".

### Taunt decision (owner, qa-log last entry)
`arms: { roll: { vs: "Social" }, rounds: "rank" }` on the Taunt talent (rules/talents.json l.2803). `"rank"` is a new VALUE, not a field. Full plumbing is in I3.

## Guardrail classification
- I1, I2a, I2b, I3, I7: Tier 3 (pure engine, session-only state, existing `arms` with a new value, docs). I3 owner decision recorded qa-log 2026-11-24; value note in EFFECT-TAXONOMY s6, no version bump.
- I4, I5, I6: Tier 1 (UI-GUIDELINES s4 Combat/Spells contents). Sign-off recorded: qa-log 2026-11-24 "Tier-1 sign-off". Docs updated in the same change (I7).
- Data down / events up: UI renders a model-supplied list only; end/name actions dispatch events; reducers and ticking live in the engine, orchestration in ed-app.
- No Tier-2 items.

## Rules dependencies
- R1 Taunt (ANSWERED): Rank+CHA vs Social Defense; -1 tests/-1 Social Def per success for Taunt-rank rounds; one target; stacking NOT-COVERED -> Decision (this plan): ONE ENTRY PER CAST (no replace), consistent with rules.md R1 "one entry per cast".
- R2 Mystic Aim (ANSWERED, APP-AGREES): until end of round; `arms.rounds:1`; stays replace-by-name (self-buff).
- R3 Spell durations (house decision 2026-11-24): tick per Initiative, X always available.
- R4: only Taunt ships.
- R5 Combat options single-round: "This attack", no counts.
No open NEEDS_RULES.

## Implementation items
### I1 - Engine: entry contract, builder, grouper, end semantics
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R5
- **Tier:** 3
- **What:** Pure module defining the CONTRACT for entries and session records, plus `buildActiveEffectsList(...)` and a grouper (This attack / Lasting on you / Lasting on target). Entry: `{id, kind: spell|talent|option|charm|situation|condition, side: atk|you|tgt, name, effectLabel, text, roundsLeft, roundsTotal, pct, low, chips, targetName, endable, endAction}`. `low` = rounds<=3 derived here. Opponent session record: `{id, kind, name, effectLabel, text, targetName, roundsLeft, roundsTotal}` (id unique per cast).
- **End semantics (F10):** spell/opponent/talent arm: remove record. Option: untoggle (remove from toggled list). Charm: deactivate only (remove from `activeCharms`; does NOT unequip - unequip stays the spend-on-Initiative behaviour). Situation chip: `ed-toggle-situation` off. Knocked Down: `endable:false` (cleared via the existing Stand-up flow). Encumbrance Harried: `endable:false` (locked).
- **Where:** new `engine/active-effects.js` + `engine/active-effects.test.js`.
- **Approach:** inputs = model-side lists (self spells, opponent records, armedTalents, toggled options/charms + defs, situation/condition rows). No DOM. Deterministic order (group, then insertion). Armed entries with the opponent marker (Taunt) map to side `tgt`, with `text` taken from the armed record.
- **Dependencies:** none (it defines the shapes I2a/I2b/I3 consume).
- **Acceptance criteria:** unit tests per source kind and per grouping; deterministic order; pct/low derived; empty -> []; Knocked Down and encumbrance Harried `endable:false`; charm/option end actions as above.
- **Risks / unknowns:** id stability for keyed X.

### I2a - State, reducers, tick, end routing, model key
- **Covers tickets:** T2
- **Rules:** R1, R3
- **Tier:** 3
- **What:** Engine reducers in `engine/active-effects.js`: `addOpponentEffect(list, rec)`, `tickOpponentEffects(list)` (mirrors `tickArmedTalents`), `endEffect(state, {kind, id})` (returns the next session lists / or the action to dispatch), `clearAll`. ed-app holds `_opponentEffects`, ticks it in `_advanceRound()` (l.1033), clears it in Day reset finalize (l.1430), handles `ed-end-effect`. store.js calls the pure builder at model assembly (~l.2195-2215) and exposes it under a NEW key `model.effectWindow` (list) - NOT `model.activeEffects`. Session passes `opponentEffects` alongside the existing lists (ed-app l.1314-1316).
- **Where:** `engine/active-effects.js`, `ui/ed-app.js`, `store.js`.
- **Approach:** orchestration in ed-app is a thin dispatcher onto the tested reducers; per-cast ids from a session seq. Overview strip reads only `model.activeEffects` and is unchanged (read-only input to the builder).
- **Dependencies:** I1.
- **Acceptance criteria:** reducer tests for add (two casts on two named targets and two casts on the same target both coexist), tick (decrement/remove), end per kind, clearAll; store test that `model.effectWindow` is built and `model.activeEffects` is byte-for-byte unchanged; Day reset clears; no persistence to the character file.
- **Risks / unknowns:** keep Aim's replace-by-name intact (see I3).

### I2b - Options lift, shared target name, cast-on-Other event
- **Covers tickets:** T2, T5, T6
- **Rules:** R3, R5
- **Tier:** 3
- **What:** (a) Toggled combat option names lifted to session `_toggledOptions`: ed-combat PUSHES `_opts` to ed-app on every change, on SCRATCH restore, and on its local reset; ed-app only mirrors it. ed-app `_advanceRound` and Day reset also clear it (and the ed-combat Initiative reset l.904 stays consistent); character switch clears via `clearCombatScratch`. (b) ONE session `_targetName` in ed-app (event up `ed-target-name`, model down `model.targetName`); both the Combat field (I5) and the Spells cast field (I6) bind to it, so Disciplines-rolled Taunt and all casts use the same label (blank -> "target"). (c) Cast-on-Other event `ed-other-cast` payload `{seq, spell, targetName, levels, total, castingRank}`; ed-app asks the engine (`otherCastOutcome`/`durationRounds`) for the duration and adds a record on a hit with a parsable duration; minutes x10 rounds, hours x600 (taxonomy s5); a non-parsable or absent duration -> NO entry (the cast result panel still shows the outcome). Follow-up event `ed-other-cast-effect {seq, effectTotal}` updates that record's label when the Effect total arrives (ed-spells l.487).
- **Where:** `ui/ed-combat.js` (l.53, 400-437, 904, push site), `ui/ed-spells.js` (l.455-490), `ui/ed-app.js`, `store.js` (`model.targetName`, `model.toggledOptions`), a pure helper `ui/combat-mods-state.js`-style module with tests for option-entry building/clearing.
- **Dependencies:** I1, I2a.
- **Acceptance criteria:** cast on Other with duration adds an entry that ticks; no-duration cast adds none; option toggle appears in the model list and is cleared on round advance, Day reset and character switch; `combat-mods-state` counts unchanged; helper tests.
- **Risks / unknowns:** `_charmsOn` legacy sync (ed-combat l.381-386) must keep working.

### I3 - Taunt talent arms + full plumbing
- **Covers tickets:** T3
- **Rules:** R1
- **Tier:** 3 (owner decision qa-log 2026-11-24)
- **What:** Add `arms: { roll: { vs: "Social" }, rounds: "rank" }` to the Taunt TALENT (rules/talents.json l.2803); Taunt skill untouched. Plumbing:
  1. store.js l.1184-1192: resolve `"rank"` to a NUMBER (the talent's rank, min 1) before the arms record is surfaced, so `session.armedTalents` never holds a string and `tickArmedTalents` stays valid; add `text` (from the talent's `note` effect summary) and `opponent: true` (derived from `vs === "Social"`) to the surfaced arms descriptor. Store test.
  2. Both descriptor builders carry `text`, `opponent` and the shared target name: `ui/ed-disciplines.js` `_rollDetail` l.409 and `ui/ed-combat.js` ~l.804/831.
  3. ed-app arm handler (l.393): for `opponent` arms push a NEW record per success (id from seq, `targetName` from `model.targetName`) instead of replace-by-name (Aim, no opponent flag, keeps replace-by-name); a miss adds nothing (an opponent arm never clears other entries).
  4. Roll modal hint (ed-roll-modal l.521): opponent arms show "Each success applies the effect to the target" instead of the per-success-bonus copy.
  5. Audit `armedTalents` consumers (store l.2053, combat.js l.579/649, ed-combat l.649/684/1027/1294, ed-spells l.1271): skip `opponent` records so Taunt is not an "armed for you" bonus, badge or count. Tests: Taunt folds nothing into any roll; not counted in `modTabCounts`/armed names; appears only in the window under "on target".
  6. Update `rules/talents.json` header note (l.11), EFFECT-TAXONOMY s6 (~l.350-363) value note (rounds may be `"rank"`, store resolves), no version bump. No conformance validator exists for `arms`; add a small data test that Taunt carries the descriptor and nothing else changed.
- **Where:** as listed.
- **Dependencies:** I1, I2a (record add), I2b (`model.targetName`).
- **Acceptance criteria:** Taunt success with N successes and rank R -> entry with roundsLeft R, text, under "on target"; miss -> none; two Taunts on two named targets -> two entries; Aim still replace-by-name and still folds; no taxonomy version change.
- **Risks / unknowns:** Social Defense Difficulty comes from the Combat `target` number; a Disciplines-rolled Taunt must supply a Difficulty via the roll modal's existing target input (verify during build); if the arm roll has no difficulty, success cannot be judged - flag then.

### I4 - Shared UI component `ed-active-effects`
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 1 (signed off 2026-11-24)
- **What:** Lit element rendering the grouped list in the Spells-card look: heading + count, `.aecard`, marks, name · effect, round bar (amber <=3), rounds pill, chips, "this attack" pill for round-free, X end (hidden when `endable:false`), empty state; prop `layout`: `columns` (Combat) | `stack` (Spells, no truncation).
- **Where:** new `ui/ed-active-effects.js` (+ pure view-state helper/test); move `.aecard/.aerow` CSS out of ed-spells; add `--spell`/`--amber` tokens for Combat.
- **Approach:** data down only (`.effects`, `.layout`); dispatches `ed-end-effect {kind, id}`. Reuse `_activeRow` markup.
- **Dependencies:** I1.
- **Acceptance criteria:** `node tools/check-ui-kit.mjs` and `tools/check-imports.mjs` pass (baseline `ui-kit-baseline.json` updated if needed, with justification); owner manual checks (below).
- **Risks / unknowns:** shadow-DOM style duplication.

### I5 - Combat tab placement + target name field
- **Covers tickets:** T5
- **Rules:** none
- **Tier:** 1 (signed off)
- **What:** Mount the component between the Modifiers/Potions row and the Combat log (render ~l.1400); add an optional opponent name input to the attack row bound to the shared `model.targetName` (I2b).
- **Where:** `ui/ed-combat.js`.
- **Dependencies:** I2a, I2b, I4.
- **Acceptance criteria:** matches mock-d; name labels new opponent entries; blank = "target"; owner manual checks.
- **Risks / unknowns:** SCRATCH save/restore must not reintroduce a second name state.

### I6 - Spells tab integration
- **Covers tickets:** T6
- **Rules:** R3
- **Tier:** 1 (signed off)
- **What:** Replace `_activeEffects()` and remove the `_targetEffects()` card (keep the cast result panel); mount the component (stack layout); cast-on-Other uses the shared name field; combat entries visible.
- **Where:** `ui/ed-spells.js` l.503-575, l.1498, l.455-490.
- **Dependencies:** I2a, I2b, I4.
- **Acceptance criteria:** self and Other casts show, count down, X ends; no cast-flow regression; ed-spells tests updated; owner manual checks.

### I7 - Docs
- **Covers tickets:** T7
- **Rules:** none
- **Tier:** 3
- **What:** UI-GUIDELINES s4 (Combat and Spells rows + dated sign-off note), ARCHITECTURE session-state note (`model.effectWindow`, session lists), EFFECT-TAXONOMY s6 `"rank"` value note (always, no version bump), `rules/talents.json` header note, correct `mock-d.html`, CHANGELOG per repo convention.
- **Dependencies:** all.
- **Acceptance criteria:** docs match shipped behaviour; RULES-FAQ Q048 already present.

## Owner manual verification (after I4-I6; not covered by node:test)
1. Light and dark theme: component matches the Spells card look on both tabs.
2. Phone width: Combat groups reflow, Spells stack shows no truncated names/effects.
3. Escape/modal behaviour unaffected (roll modal, damage modal, other modals).
4. Placeholder-pill rules (UI-GUIDELINES s5) respected.
5. Combat: component sits between Modifiers/Potions and the Combat log; name field labels new entries; blank = "target".
6. Cast on Other with duration: entry appears in Combat and Spells, counts down on Initiative, X ends it.
7. Taunt success rolled from Combat and from Disciplines: entry under on target, rounds = rank, nothing added to your own roll pools or armed badges; two Taunts on two named targets show two entries.
8. Aim: under Lasting on you with 1 rd; re-arm replaces.
9. Knocked Down and encumbrance Harried show with no X; a Situational chip X clears it; charm X deactivates without unequipping; option X untoggles.
10. Day reset clears all; Overview Active Effects strip unchanged.

## Sequencing
1. I1 (contract + pure builder). 2. I2a (reducers, state, model key). 3. I2b (options lift, shared name, cast event). 4. I3 (Taunt; needs I2a/I2b). 5. I4 (component, fixture-driven; can start after I1 in parallel). 6. I6 then I5. 7. I7 last. Ordering fixes the former I1<->I2 cycle: I1 defines shapes; I2a/I2b/I3 only depend on earlier items.

## Open questions
- None blocking. Taunt skill is a later Tier-3 addition.

## Review responses
- F1 fixed: new key `model.effectWindow`; store builds it (I2a); `model.activeEffects` unchanged, with a test.
- F2 fixed: one entry per cast for opponent-side entries (spell on Other, Taunt); Aim keeps replace-by-name; test for two named targets; R1 reconciled (recorded as the plan's decision for the NOT-COVERED stacking).
- F3 fixed: both descriptor builders, roll-modal hint, `text`/`opponent` on the record, consumer audit and tests in I3.
- F4 fixed: store resolves "rank" to a number before the session; conformance-validator claim dropped (replaced by a small data test); header note and taxonomy value note always updated; I7 consistent.
- F5 fixed: single session `targetName` (I2b), used by Combat, Spells and Disciplines-rolled Taunt.
- F6 fixed: payload defined, follow-up effect event, minutes/hours conversion decided, non-parsable duration -> no entry.
- F7 fixed: ed-combat pushes, ed-app mirrors; clear sites listed; pure helper with tests.
- F8 fixed: I1 owns the contract; I2a/I2b/I3 depend only on earlier items.
- F9 fixed: reducers in engine with tests; I2 split into I2a/I2b; manual verification list; check-ui-kit/check-imports acceptance.
- F10 fixed: Knocked Down and encumbrance Harried `endable:false`; charm X deactivates without unequip; option X untoggles; tested in I1.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
