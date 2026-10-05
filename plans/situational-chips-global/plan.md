---
status: implemented
shipped: v1.32.0
---
# Delivery Plan: Situational chips global (situational-chips-global)

## Context & learnings
Today only Knocked Down (session flag `knockedDown`) and Harried (via encumbrance) are live, app-wide conditions. Every other `rules/combat.json` `situations` chip (Blindsided, Partial/Full Cover, Partial/Full Darkness, Harried chip, Impaired Movement Light/Heavy, Range Long, Surprised; the no-effect Range Short chip is removed by owner decision, R9) is a Combat-tab scratch toggle in `ed-combat._sits`; its Defence mods are display-only on Combat (decision B7). Owner decisions (qa-log, 2026-10-05):
- All Situational chips become session-only global live conditions, free toggle (click again, or x in Overview Active Effects). Cleared by existing resets (character switch, day-reset finalize). Knocked Down and encumbrance-Harried keep their locks.
- Tier-1 sign-off recorded ("B7 sign-off"): retire B7 for Situational chips only. Combat-option, blood-charm and spell-driven chips are unchanged (they stay informational / Combat-local).
- Defence mods fold into derived Physical/Mystic Defence on every tab, additive, no cap. Unscoped test penalties (Harried -2, Knocked Down -3) apply to every roll. Scoped penalties (Darkness: sight; Range Long: attack/damage; Impaired Movement: movement) auto-apply to Combat attack pools as today and show as pre-ticked per-roll toggles in the roll modal elsewhere.
- Surprised gets a -3 Physical and Mystic Defence effect (R2); "no actions" stays a note. Impaired Movement is treated as scoped (R5); Movement Rate reduction stays a note.
- Active Effects row per active situation with x clear; nothing stored in the character.

## Step vs Result policy (review F1, rules R8)
- **Book default** (R8): test penalties are **Step** modifiers (applied before dice, min Step 1).
- **Existing app convention:** Knocked Down is `measure:'result'` (`KNOCKED_DOWN_EFFECT`, flat -3 on the total). **Decision: keep it unchanged.** This is an app-differs-from-book-default note (R8 permits the GM to use a Result modifier); changing it is out of scope and would alter shipped behaviour.
- **New live conditions keep each effect's own `measure`**: Harried (chip and encumbrance), Darkness, Range Long and Impaired Movement are `measure:'step'` in data and stay Step penalties, exactly as the Combat pool applies them today. Only Knocked Down is a result mod.
- **Mechanism:** the roll-time helper carries `measure` per mod. In `_rollConfig`, step-measure mods are summed and folded into `rollStep` (clamped to min Step 1) before the `stepByNumber` lookup, alongside the existing recovery step bonus; result-measure mods go in `mods` as today. Optional (scoped) step mods need the modal to re-resolve the step row when toggled (see I5).
- **Harried applicability (review F2):** Harried applies to every roll except the Karma die (same rule as Knocked Down, R7/R8: "his tests", no scope; Knocked Down explicitly hits Initiative). R8 marks non-Action tests (Recovery, Knockdown, spells, skills) as inference; the owner's qa-log answer already chose "unscoped penalties apply to every roll". The kind exclusion list lives in one constant (`karma` only) so it can be narrowed later without redesign. Recorded as a known inference, not an open question.

## Discoveries
- **Derive lives in `store.js`, not `engine/derive.js`** (35 lines, thin). `deriveModel(character, rules, session)` at store.js ~1011-1064 builds `conditionEffects` (Active Effects + roll-time) and `conditionDefenseEffects` (folded into `foldedEffects` -> derived Defence) from `session.knockedDown` using `KNOCKED_DOWN_EFFECT` / `KNOCKED_DOWN_DEFENSE_EFFECTS` (`engine/health.js` 187/206). `activeEffects` at ~1740 appends `conditionEffects` + `encumbranceConditionEffects`. `model.combat.conditions` = `{knockedDown, harried}` at ~1557 (harried = Burdened stage).
- `ui/ed-app.js`: `_knockedDown` state (81), `_derive()` (~835) passes session, `_setKnockedDown` (~848), reset on character switch (515) and `_dayResetFinalize` (~932), event `ed-edit-knockdown` (408). Roll-time mods: `_rollTimeMods({kind})` (~1496) returns only Knocked Down -3; `_rollConfig` adds it to `mods` (~1557); roll modal `ui/ed-roll-modal.js` takes `mods: [{label,value}]` (16) and renders ed-app's `_roll` at ~1917.
- `ui/ed-combat.js`: `_sits` scratch (81, 314), persisted per session via `ui/combat-mods-state.js`; `_toggle` special-cases Knocked Down -> `_fallDown` (940, 1077); `_situations()` locks Knocked Down / Harried (1030-1038); `_poolEffects()` calls `engine/combat.js collectCombatEffects` with `selectedSituations: _sits` (620); `_standUp` (1064).
- `engine/combat.js collectCombatEffects` (515-600): Knocked Down stripped entirely from pools (rides `_rollTimeMods`); locked Harried keeps Action -2 in the pool, strips defence mods; toggled situations' defence mods go to `defenseMods` and are display-only via `foldCombatRatings` (627). `appliesToTest` (140-165): unscoped Action test-mods apply to attack pools; `scope:'sight'` can be suppressed via `ctx.sightBased`; damage pools today only take `except-knockdown` scope, so they omit Range Long (T8/R9 requires this to change: damage pools must also admit the Range Long scope, not Darkness or Impaired Movement).
- `rules/combat.json` situations: only Darkness has `scope:"sight"`. **Range Long and Impaired Movement Light/Heavy carry no `scope`** (all unscoped Action test-modifiers), and Range Long is not applied to damage pools today though R5/R9 say Attack and Damage (fixed by I3, T8). Taxonomy `scope` is free text (EFFECT-TAXONOMY section 6), so adding scope strings is Tier 3 data, no taxonomy bump. Surprised has only a note.
- Overview Active Effects: `ui/ed-overview.js` ~815-850 groups condition effects by origin name and renders `Stand up` for Knocked Down only.
- Docs mentioning B7/Combat-only: `docs/THREAD-ITEMS.md:166`, `docs/UI-GUIDELINES.md` Combat row (line 59), `plans/PLAN-COMBAT-TAB.md`, ARCHITECTURE derive-inputs.
- Existing tests to extend: `store-combat.test.js`, `store-health.test.js`, `engine/combat.test.js`, `tools/rules-conformance.test.js`, `ui/combat-mods-state.test.js`.

## Guardrail classification
- I1 (store/derive session input, engine helper): **Tier 1** (data-flow/derive inputs, B7) - sign-off: qa-log "B7 sign-off" 2026-10-05.
- I3 (Combat chips dispatch global toggle; `ed-app` session state; UI-GUIDELINES Combat row): **Tier 1** - same sign-off.
- I2 (rules data), I4 (Overview rows), I5 (roll modal toggles), I6 (docs), I7 (tests): **Tier 3**. I4 must keep Overview fitting the desktop viewport; I5 must keep Escape/Enter modal behaviour; light + dark.
- No taxonomy vocabulary change (new `scope` strings are free text) -> Tier 2 not triggered. Engine stays pure/DOM-free; state is session-only and never stored.

## Rules dependencies
All in `rules.md`, none open (R8 added for F1/F2): R1 Blindsided (ANSWERED), R2 Surprised (APP-DIFFERS, owner: follow book), R3 Cover (ANSWERED), R4 Darkness (ANSWERED, scope toggle per owner), R5 Range/Impaired Movement (APP-DIFFERS, owner: scoped toggle), R6 Stacking (ANSWERED, additive), R7 Harried/Knocked Down scope (ANSWERED), R8 Harried/Knocked Down which tests and Step vs Result (ANSWERED, inference for non-Action tests; app keeps Knocked Down as result, others as step). No NEEDS_RULES.

## Implementation items

### I1 - Engine/derive: session set of active situations
- **Covers tickets:** T1
- **Rules:** R1, R3, R6, R7
- **Tier:** 1 (qa-log "B7 sign-off")
- **What:** Add a session input `situations: string[]` (active situation names) alongside `knockedDown`. `deriveModel` folds each active situation's `defense-modifier` effects into derived Physical/Mystic Defence (additively), lists them as condition Active Effects (`origin:{kind:'condition',name}`), and exposes `model.combat.conditions.situations` (active names). Add a pure engine helper (e.g. `situationRollMods(activeNames, rules)` in `engine/combat.js` or `engine/health.js`) returning `{ unscoped: [{label,value,measure}], scoped: [{label,value,measure,scope}] }` (`measure` carried through, review F1) from the situations' `test-modifier` effects (unscoped = no `scope`; scoped = has `scope`). Knocked Down keeps its existing synthesized effects/semantics (result -3) and its **sole source is `session.knockedDown`**: the helper, the fold and `collectCombatEffects` ignore a "Knocked Down" name in `situations` (and `ed-app` never inserts it there), so it cannot double count (review F3). Harried: effective set = chip names union encumbrance-Harried, deduped by name, so Harried chip + Burdened never double count (when Burdened, the Harried effects come from `encumbranceEffects` only; the chip is ignored in the fold).
- **Where:** `store.js` (deriveModel ~1011-1064, ~1557, ~1740), `engine/combat.js` (new helper), `engine/health.js` (if reusing Knocked Down constants).
- **Approach:** Resolve names against `rules.combat.situations` (rule data, structured effects - no string parsing). Skip unknown names. Full Cover has no numeric effects; it only lists as a row. Range Short no longer exists (removed in I2). Keep the Knocked Down branch intact; do not store anything in the character.
- **Dependencies:** none (data for Surprised lands in I2; helper works with whatever effects exist).
- **Acceptance criteria:** Surprised + Blindsided stack to -5 (additive, uncapped; see Review responses F4); a "Knocked Down" entry in `situations` is ignored (one -3 only); helper output keeps `measure`; Blindsided -> Physical and Mystic Defence -2 in `model.characteristics`/defence readouts; Blindsided + Harried + Knocked Down sum; clearing restores; Harried chip + Burdened = one -2; no DOM in engine; `character` object unchanged.
- **Risks / unknowns:** `foldedEffects` stacking/"collapse per fold target" in `engine/characteristics.js` (109-124) must not collapse same-target situation effects of different origins - verify during build.

### I2 - Data: Surprised -3 Defence; remove Range Short; scope tags for Range Long and Impaired Movement
- **Covers tickets:** T2 (plus data prerequisite for T3/T5)
- **Rules:** R2, R4, R5, R9
- **Tier:** 3
- **What:** In `rules/combat.json` remove the `Range — Short` situation (no effect; R9, owner) and grep `rules/`, `ui/`, `engine/`, tests and docs for any reference to it (none may remain). Add Physical and Mystic `defense-modifier` -3 (`condition:'situational'`, `source:'condition'`, `measure:'rating'`) to Surprised; "no actions" stays a note. Add `scope` to Range Long's test-modifier (e.g. `"ranged"`), and to Impaired Movement Light/Heavy (e.g. `"movement"`) so I1's helper classifies them as scoped.
- **Where:** `rules/combat.json`.
- **Approach:** Mirror the Blindsided effect objects. Confirm `appliesToTest` still admits the new scopes into attack pools (only `sight` is gated) so Combat auto-apply is unchanged.
- **Dependencies:** none.
- **Acceptance criteria:** `tools/rules-conformance.test.js` passes; Surprised chip lowers both Defences by 3 (via I1); Combat attack pools for Range Long / Impaired Movement unchanged vs today; no `Range — Short` in data, chips, tests or docs (grep clean).
- **Risks / unknowns:** none beyond the damage-pool change handled in I3.

### I3 - Combat tab chips drive the global state
- **Covers tickets:** T3, T8
- **Rules:** R4, R5, R7, R9
- **Tier:** 1 (qa-log "B7 sign-off"; UI-GUIDELINES Combat row updated in I6)
- **What:** Generalize `_fallDown`: a Situational chip click dispatches a global toggle event (e.g. `ed-toggle-situation {name}`); `ed-app` holds `_situations` (session array) next to `_knockedDown`, passes it via `_derive()`, resets it on character switch and `_dayResetFinalize`. Chips read active state from `model.combat.conditions.situations` (no longer `_sits`); Knocked Down and encumbrance-Harried stay locked. `collectCombatEffects` takes the global active situations: strips their defence mods (already folded in derived Defence) and strips unscoped test mods (they now ride the roll-time path on every roll, keeping their step/result measure), but keeps scoped ones in attack pools (Darkness `sight` gating via `ctx.sightBased` preserved). Because Harried's -2 (Step) will now ride the roll-time path (folded into the roll's Step for every roll, Combat included), remove the "locked Harried keeps Action -2 in pool" exception so it is not counted twice; the net Combat attack Step for Harried is identical to today. Log a roll-log action entry on toggle like Knocked Down. **Range Long on damage pools (T8, R9):** `appliesToTest` admits the `ranged` scope into damage pools as well as attack pools, so Range Long's -2 Step applies to Combat damage pools (Darkness `sight` and Impaired Movement `movement` stay out of damage pools); the scoped-keep rule in `collectCombatEffects` covers damage pools for Range Long only. Keep session-remembered selection working for non-global sections (`_opts`, charms); `_sits` no longer persists situation names (or migrates any stored names harmlessly).
- **Where:** `ui/ed-combat.js` (`_toggle`, `_situations`, `_poolEffects`, save/restore ~407-443), `ui/ed-app.js`, `ui/combat-mods-state.js`, `engine/combat.js collectCombatEffects` (+ its docblock strip rules).
- **Approach:** Spell-driven situational chips (`_situationalSpells`) keep their local toggle path. The Combat Defence readout reads the folded model value and no longer adds situation defence mods again via `foldCombatRatings` (only option/charm mods remain there).
- **Dependencies:** I1, I2.
- **Acceptance criteria:** Selecting Blindsided in Combat changes Combat and Overview Defence; deselecting restores; session-remembered selection works; pools and Defence do not double count (Harried, Knocked Down, Blindsided each tested); a Harried -2 Combat attack and a Harried -2 Skill roll land at the same Step; Range Long on: Combat attack Step -2 and Combat damage Step -2 (13 to 11, 10 to 8), off restores; Darkness and Impaired Movement do not touch the damage pool; roll log shows toggle entry.
- **Risks / unknowns:** Strip-rule rewrite touches B11 asymmetry; regression tests in I7 are essential. Combat Defence display double-fold is the likeliest bug.

### I4 - Overview Active Effects rows with clear (x)
- **Covers tickets:** T4
- **Rules:** none
- **Tier:** 3. The new x control in the Overview Active Effects panel is expressly authorised by the owner's qa-log answer ("Active Effects row per active situation, each with a clear (x) button") and the B7 sign-off; I6 updates the UI-GUIDELINES Overview Active Effects description to match. Overview must fit viewport, no vertical scroll.
- **What:** Each active situation renders as a condition row in Active Effects (existing grouping by origin name) with a x button dispatching the same global toggle to clear it; Knocked Down keeps Stand up; encumbrance-Harried row has no x (locked).
- **Where:** `ui/ed-overview.js` (~815-850).
- **Approach:** Reuse `.aefx-row`/`.stand` styling tokens (`--fs-*`, two weights, theme variables). Button is a real `<button>` with `aria-label`, keyboard-activatable. Panel must scroll internally or stay compact rather than push the page past the viewport.
- **Dependencies:** I1, I3 (event).
- **Acceptance criteria:** Rows appear/disappear with chips; x works by click and keyboard; light and dark OK; Overview does not scroll at supported desktop size with several chips active.
- **Risks / unknowns:** Height with many chips; verify the Active Effects panel's existing overflow handling.

### I5 - Roll-time mods: all unscoped situational penalties + per-roll toggles for scoped
- **Covers tickets:** T5 (and unscoped part of T1)
- **Rules:** R4, R5, R7, R8, R9
- **Tier:** 3 (modal keeps Escape-closes / Enter-confirms)
- **What:** Extend `ed-app._rollTimeMods` to use I1's helper and return `{label,value,measure}`. Unscoped penalties (Knocked Down [result], Harried incl. encumbrance [step], chips) apply to every roll except the Karma die. `_rollConfig` splits by `measure`: step mods are summed into `rollStep` (min Step 1) before the step-row lookup; result mods go into `mods`. For non-Combat-attack rolls, scoped penalties are added as optional mods (`{label,value,measure,optional:true,on:true}`); `ed-roll-modal` renders them as pre-ticked checkboxes. Optional step mods change the Step: the config passes the base step and the step-row map (`stepByNumber`) so the modal re-resolves the dice row (min Step 1) as boxes are ticked; optional result mods adjust the total. Unticked mods are excluded from the dice, total, breakdown and Roll Log. Combat attack rolls keep auto-applying scoped penalties through the pool (not offered as toggles, to avoid double count). No toggle row when no scoped penalty is active.
- **Damage rolls (`kind:'damage'`, review F5, updated for T8/R9):** damage rolls made elsewhere (not Combat pool damage rolls) offer Range Long (scope `ranged`) as a pre-ticked Step toggle; Darkness (sight) and Impaired Movement (movement) are still not offered on damage. Combat damage pools now auto-apply Range Long (I3), so, as with attacks, the toggle is not shown on Combat pool damage rolls (no double count).
- **Where:** `ui/ed-app.js` (`_rollTimeMods`, `_rollConfig`), `ui/ed-roll-modal.js` (mods rendering/total/keyboard), roll-log entry builder.
- **Approach:** Distinguish combat attack rolls by existing `kind`/`apply` detail. Modal checkboxes in tab order, Enter confirms, Escape closes, per docs/MODALS.md and `ui/modal-controller.js`.
- **Dependencies:** I1, I2, I3.
- **Acceptance criteria:** Harried -2 gives the same Step on an attack and on a Skill roll (test); Knocked Down remains a flat -3 on the total; ticking/unticking an optional step mod changes the Step shown and dice; Darkness on, Spell roll modal shows "Full Darkness -4" ticked; unticking removes it from total and breakdown; Roll Log records what was applied; no toggle when none active; Harried applies on a Skill/Overview roll.
- **Risks / unknowns:** Modal step re-resolution is new logic (keep it a pure, testable function); ensure toggles are not shown on Combat attack rolls where already auto-applied.

### I6 - Docs
- **Covers tickets:** T6
- **Rules:** none
- **Tier:** 3 (docs reflect Tier-1 sign-off)
- **What:** Update `docs/UI-GUIDELINES.md` Combat row and Overview Active Effects description; `docs/THREAD-ITEMS.md` B7 sentence (Situational chips fold globally; combat options remain informational); ARCHITECTURE.md derive-inputs mention (session inputs `knockedDown`, `situations`); note in `plans/PLAN-COMBAT-TAB.md` that B7 is retired for Situational chips; update `engine/combat.js` docblock; record the change per FEATURE-WORKFLOW conventions.
- **Where:** the files above.
- **Dependencies:** I1-I5 settled.
- **Acceptance criteria:** No doc still says Situational Defence mods are informational/Combat-only (grep for "B7", "informational", "never into the always-on derived Defence").

### I7 - Tests
- **Covers tickets:** T7, T8
- **Rules:** R1-R9
- **Tier:** 3
- **What:** Engine/store tests: Harried -2 attack and Harried -2 Skill roll land at the same Step (min Step 1 clamp); Knocked Down stays a result -3; `situations` containing "Knocked Down" is ignored; Surprised + Blindsided = -5; damage rolls elsewhere offer only Range Long (never Darkness or Impaired Movement); Combat damage pool takes Range Long -2 Step (10 to 8) and Combat attack pool -2 (13 to 11), off restores; Darkness/Impaired Movement leave the damage pool unchanged; no `Range — Short` anywhere; additive folding (Blindsided + Harried + Knocked Down), clear restores, no double count with encumbrance Harried, scoped vs unscoped split from the helper, Surprised -3 on both Defences, Cover +2, character not mutated. `collectCombatEffects` strip rules (global situations: defence stripped, unscoped stripped, scoped kept). Conformance for the edited `rules/combat.json`. UI-level test where a pattern exists (`ui/combat-mods-state.test.js` for persistence change; roll-modal optional-mod total logic if testable as a pure function).
- **Where:** `store-combat.test.js`, `store-health.test.js`, `engine/combat.test.js`, `tools/rules-conformance.test.js` (also asserts no Range Short situation), `ui/combat-mods-state.test.js`.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** `npm test` green.

## Sequencing
1. I2 (data; unblocks scope classification, tiny, independent).
2. I1 (engine/derive core; Tier 1, signed off).
3. I3 (Combat tab + ed-app session state + strip rules; depends on I1/I2; highest regression risk, so tests written alongside).
4. I5 (roll-time mods and modal toggles; needs the I1 helper and I3 strip rules so nothing double counts).
5. I4 (Overview rows; needs the event from I3).
6. I7 (tests finalized; written incrementally with I1/I3/I5).
7. I6 (docs last, after behavior is fixed).

## Open questions
- (Resolved) Range Long on Combat damage pools: now applied per R9/T8 (I3); no longer open. Owner may still veto to revert to attack-only.
- Scope strings `"ranged"` / `"movement"` are free text (taxonomy section 6); confirm naming at build time.
- Whether the Combat tab's `_sits` should still persist spell-situational chip names (assumed yes, unchanged).
- Heat Sight / Low-Light Vision (sight special senses) stay manual via the per-roll untick; no auto-handling.

## Q&A log reference
See `qa-log.md` for the full interrogation record.

## Review responses
- **F1 (major) - fixed.** Step vs Result policy section added: Knocked Down keeps the app's result convention (app-differs-from-book-default note, R8); Harried, Darkness, Range Long and Impaired Movement stay Step. Helper carries `measure`; `_rollConfig` folds step mods into the Step; Combat Harried behaviour unchanged; same-Step test added (I1, I3, I5, I7).
- **F2 (major) - fixed.** Per-kind applicability stated: every roll except the Karma die, supported by R8 (inference for non-Action tests; owner chose unscoped-on-every-roll). Exclusion constant is single-point for later narrowing. No NEEDS_RULES: R8 already answers it as far as the books allow.
- **F3 (minor) - fixed.** `session.knockedDown` is the sole Knocked Down source; "Knocked Down" in `situations` is ignored; test added (I1, I7).
- **F4 (minor) - fixed by note.** Surprised + Blindsided stack to -5 although R1 says a fully Surprised target takes Surprised instead. Treated as player-managed under the owner's additive/no-cap decision (R6); not an undocumented difference. Suggest the orchestrator add a one-line note to rules.md R1/R6 (planner does not edit rules.md).
- **F5 (minor) - fixed.** Damage-roll behaviour defined in I5 (only Range Long offered, pre-ticked Step toggle) and tested.
- **F6 (minor) - fixed.** I4 classification cites the owner's qa-log authorisation and the I6 guideline update.
- **Owner follow-up (T2/T8/R9) - applied, supersedes F5's attack-only pool stance.** `Range — Short` is removed from data, tests and docs (I2). Range Long now also applies to Combat damage pools (I3) per R9, replacing the earlier "keep attack-only" open question; damage rolls elsewhere offer Range Long as a toggle, while Darkness and Impaired Movement are still not offered on damage (I5). Tests: attack 13 to 11, damage 10 to 8 (I3 criteria, I7).
