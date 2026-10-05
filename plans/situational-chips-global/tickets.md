# Feature: Situational chips global (situational-chips-global)

## Summary
Today only the Knocked Down Situational chip (and Harried via encumbrance) is a live, app-wide condition. Every other Situational chip is a Combat-tab-only scratch toggle, so e.g. Blindsided's −2 Defence never reaches Overview. This feature makes every Situational chip a session-only live condition that uses the Knocked Down mechanism: Defence mods fold into derived Defence on every tab, unscoped test penalties apply to rolls on every tab, and scoped penalties are offered as a per-roll toggle outside Combat attacks.

## Goals / Non-goals
- Goal: every `rules/combat.json` `situations` chip is a global, session-only, free-toggle live condition (click again, or × in Overview Active Effects, to clear).
- Goal: Defence mods (Blindsided −2, Partial Cover +2, Harried −2, Surprised −3, Knocked Down −3) show on Overview and Combat (and any tab showing Defence), stacking additively with no cap.
- Goal: unscoped test penalties (Harried −2, Knocked Down −3) apply to every roll; scoped ones (Darkness: sight; Range Long: attack and damage, per R9; Impaired Movement: movement) auto-apply to Combat attack pools as today and appear as pre-ticked per-roll toggles in the roll modal on other tabs.
- Goal: Surprised gains its book-correct −3 Physical & Mystic Defence effect.
- Non-goal: spell-driven situational chips (Aspect of the Casual Murderer), Combat-option chips, blood-charm chips — unchanged.
- Non-goal: storing chip state in the character file or persisting across reload.
- Non-goal: new Overview rows beyond Active Effects entries; Movement Rate reduction (stays a note).

## Guardrail alignment
Touches: ARCHITECTURE.md (derive inputs), UI-GUIDELINES.md (Combat/Overview rows), THREAD-ITEMS.md §B7 text, `engine/*`, `ui/ed-app.js`, `ui/ed-combat.js`, `ui/ed-overview.js`, roll modal, `rules/combat.json`. No taxonomy change (Tier 2 not triggered). Retires decision B7 for Situational chips only: **Tier-1 sign-off recorded in qa-log.md (2026-10-05, "B7 sign-off")**. Engine stays pure and DOM-free; state is a session input like `knockedDown`, never stored.

## Tickets
### T1 — Generalize live situational conditions in the engine/derive
- **What:** Replace the single `knockedDown` session flag with a session set of active situation names (Knocked Down keeps its dedicated lock/Stand-up semantics). `deriveModel` takes it as an input, folds each active situation's `defense-modifier` effects into derived Physical/Mystic Defence additively, and exposes active situations as condition Active Effects. A pure engine helper returns the roll-time modifier list (unscoped test penalties) and the scoped penalties list.
- **Why:** The one mechanism that makes Defence/rolls correct on every tab.
- **Tier:** 1 (sign-off: qa-log "B7 sign-off", 2026-10-05)
- **Acceptance criteria:** With Blindsided on, derived Physical and Mystic Defence are −2 on every consumer; Blindsided + Harried + Knocked Down sum; clearing restores; Harried from encumbrance plus the Harried chip is not double counted; nothing persisted in the character; engine has no DOM.
- **Open questions:** none.

### T2 — Encode Surprised −3 Defence; remove Range — Short chip (data)
- **What:** Remove the no-effect `Range — Short` situation from `rules/combat.json` (owner, 2026-10-05; Short has no modifier, R9). Add Physical & Mystic `defense-modifier` −3 (`condition: situational`, `source: condition`) effects to the Surprised situation in `rules/combat.json`; "no actions this round" stays a note.
- **Why:** Book-correct (PG pp. 388, 14684 ff.); needed for the chip to change Defence (R2).
- **Tier:** 3
- **Acceptance criteria:** Conformance test passes; Surprised chip lowers Defence by 3; no `Range — Short` chip appears and nothing references it.
- **Open questions:** none.

### T3 — Combat tab chips drive the global state
- **What:** Situational chip clicks dispatch the global toggle (generalizing `_fallDown`) instead of mutating `_sits`; chips read active state from the model; Knocked Down and Harried-from-encumbrance remain locked; no effect is folded twice into Combat pools. Scoped chips still auto-apply to Combat attack pools. Log a roll-log action entry on toggle like Knocked Down does.
- **Why:** The Combat tab is where the chips live today.
- **Tier:** 1 (sign-off: qa-log "B7 sign-off"; UI-GUIDELINES Combat row updated)
- **Acceptance criteria:** Selecting Blindsided in Combat changes Combat and Overview Defence; deselecting restores; session-remembered selection still works; pools do not double count.
- **Open questions:** none.

### T4 — Overview Active Effects rows with clear (×)
- **What:** Each active situation lists as a condition row in Active Effects with a × that clears it (Knocked Down keeps Stand up).
- **Why:** Visibility and a way to turn off from outside Combat.
- **Tier:** 3 (must keep Overview fitting the desktop viewport with no vertical scroll)
- **Acceptance criteria:** Rows appear/disappear with the chips; × works by click and keyboard; light and dark OK; Overview does not scroll at the supported desktop size with several chips active.
- **Open questions:** none.

### T5 — Per-roll toggle for scoped penalties on non-combat rolls
- **What:** For rolls on Spells/Skills/Disciplines etc., the roll modal lists active scoped situational penalties (Darkness sight-based, Range Long, Impaired Movement) as pre-ticked per-roll toggles; unticked ones are not applied and the breakdown names those applied. Unscoped penalties (Harried, Knocked Down) always apply as today.
- **Why:** The app cannot know whether a non-combat roll is sight-based/ranged/movement-based (R4/R5).
- **Tier:** 3 (modal keeps Escape-closes / Enter-confirms)
- **Acceptance criteria:** Darkness on, Spell roll modal shows "Full Darkness −4" ticked; unticking removes it from the total and breakdown; Roll Log records what was applied; no toggle shown when no scoped penalties are active.
- **Open questions:** none.

### T6 — Docs
- **What:** Update UI-GUIDELINES (Combat/Overview rows), THREAD-ITEMS.md B7 sentence (Situational chips fold globally; combat options remain informational), ARCHITECTURE derive-inputs mention, and add a PLAN doc note.
- **Why:** Docs and code must agree.
- **Tier:** 3 (docs reflect Tier-1 sign-off)
- **Acceptance criteria:** No doc still says Situational Defence mods are informational/Combat-only.
- **Open questions:** none.

### T7 — Tests
- **What:** Engine tests for additive folding, no double count with encumbrance Harried, scoped vs unscoped split; conformance for Surprised; UI-level test where the repo has such a pattern.
- **Tier:** 3
- **Acceptance criteria:** `npm test` green.
- **Open questions:** none.

### T8 — Range Long also applies to Combat damage pools
- **What:** Per the book (R9), Range — Long's −2 Step penalty applies to Damage tests as well as Attack; today Combat damage pools omit it. Fold it into the damage pool and offer it on damage rolls elsewhere.
- **Why:** Book-correct (PG p.390); owner asked for confirmation, rule-agent confirmed both.
- **Tier:** 3 (bug fix restoring documented rule; owner can veto to keep attack-only)
- **Acceptance criteria:** Long on: attack Step −2 and damage Step −2 (example 13→11, 10→8); off restores.
- **Open questions:** none.
