---
status: implemented
shipped: v1.29.0
---
# Delivery Plan: Unarmed Combat (unarmed-combat)

## Context & learnings
The Combat tab cannot finish an unarmed attack. With Weapon "None" and the Unarmed Combat talent picked, Damage has no step (weapon Damage Step is null) and success levels are not armed (`isNone` is keyed on `category == null`). The owner chose to add a real "Unarmed" entry to the Weapon dropdown, always listed beside "None". It has category `unarmed` and Damage Step 0, so Damage = Strength step.

Owner decisions (qa-log.md):
- "None" keeps its meaning as the free-action / non-attack roll. No "None" entry is added to the talent dropdown.
- Core only. Claw Shape, Body Blade, Hammer Punch, tail attack and Crack the World are deferred (R7).
- Extra success levels add +2 Damage STEPS per level (each 5 over the target), per the book. Owner correction after review (qa-log.md); it applies to all weapons, not only unarmed, so it is split out as T4/I4 (R3).
- No armed/unarmed restriction. Unarmed is always selectable and the Shield Bash scope is unchanged (R5).
- Karma on unarmed Damage uses the existing `damageKarma` path, unenforced. No new grant data such as Beastmaster (R6).

## Discoveries
- `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.js`: `WEAPON_TALENTS.unarmed = ['Unarmed Combat']` and `attackTalentNamesFor('unarmed')` already exist (L54-63). The comment already says "the synthetic Unarmed weapon". The close-combat scope already matches `unarmed` (L333). `damagePool` returns null unless both the weapon step and the Strength step are finite (L237-244), so a Damage Step of 0 works and a null Strength gives null (placeholder).
- `/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-combat.js`:
  - `_weapons()` (L468) builds None plus the equipped weapons, each with an occurrence `key`.
  - `_selWeapon()` falls back to `list[0]` when the stored `_weapon` key is not found. That fallback must stay.
  - `_attackScopes()` (L522) already uses `w.category` when set.
  - `_attackOptions()` filters via `attackTalentNamesFor`.
  - `_rollAttack()` (L817) uses `isNone = w?.category == null`, which is already keyed on category null, so Unarmed arms the attack and gets the "Attack — Unarmed" label with no change.
  - `_rollDamage()` labels "Damage — Unarmed" and offers `damageKarma`.
  - `_damageAudit()` (L1521) labels the base `${w.name} Damage Step`, which already reads "Unarmed Damage Step" with value 0.
  - The dropdown option text appends `· dmg N` when `damageStep != null`, so "Unarmed · dmg 0" shows.
  - `_weaponArgs()` passes `{name, category, index}` to the spell/item bundle scoping. For Unarmed this is `{name:'Unarmed', category:'unarmed', index:0}`. That is harmless, but verify that spell weapon-choice matching (`weaponOccurrence`, engine/spells.js) cannot match it to an equipped weapon of the same name.
  - `_artBox` shows the "no image" fallback when `image` is null. `range` only renders when `shortRange` is set.
- Because `isNone` and the audit label are already category-driven, the UI change is mostly one added list entry. This should be verified rather than assumed.
- Tests: `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.test.js` has `attackTalentNamesFor` and `damagePool` tests. There is no `ed-combat` component test. UI-side pure logic lives in `ui/combat-mods-state.js` with its own test. There is no established pattern for testing `_weapons()`, so it stays covered by engine tests plus manual verification by the owner (the owner verifies UI themselves).
- Docs: UI-GUIDELINES.md line 59 describes "the equipped weapon + attack talent card". No doc currently describes a "None" weapon entry (grep found only docs/TAXONOMY-AUDIT.md matching, and it is not about the picker). The docs update is likely a one-line addition.

## Guardrail classification
- Whole plan: Tier 3. It is new content within the Combat tab and an engine export, and it restores the documented "synthetic Unarmed weapon" intent. No schema, taxonomy or `rules/*.json` change.
- Tier-1 rules kept intact:
  - Data-down/dispatch-up: the descriptor and its Damage Step 0 live in the engine, and the UI only renders.
  - Pure DOM-free engine.
  - Derived values stay placeholder pills (null Strength gives a placeholder).
  - Nothing is stored.
- No Tier-1 items, so no sign-off is needed.

## Rules dependencies
- R1 (ANSWERED): unarmed Damage = Strength step + 0. Used by I1 and I2.
- R2 (ANSWERED): the attack targets Physical Defense, with no armed/unarmed precondition. Used by I1 and I2.
- R3 (APP-DIFFERS, resolved: app was wrong; owner correction): +2 Damage Steps per extra success (5 over). The level count from `attackSuccessLevels` is correct; only the steps-per-level is wrong (+1 today). Used by I2 and I4.
- R4 (NOT-COVERED, general rule): armor is handled by the Damage Taken modal. Context only.
- R5 (CONFLICT, owner: no restriction). Used by I2.
- R6 (ANSWERED, owner: existing `damageKarma` path). Used by I2.
- R7 (deferred, non-goal).
- No open NEEDS_RULES.

## Implementation items
### I1 — Engine: synthetic Unarmed weapon
- **Covers tickets:** T1
- **Rules:** R1, R2
- **Tier:** 3
- **What:** Export `UNARMED_WEAPON` from engine/combat.js with `name: 'Unarmed'`, `category: 'unarmed'`, `damageStep: 0`, and `shortRange`, `longRange`, `image` null with no `effects`. Freeze it. Update the header comment and the `attackTalentNamesFor` doc to reference it.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.js` (near `WEAPON_TALENTS`).
- **Approach:** A plain frozen object constant. The constant carries only the engine-side fields (name, category, damageStep, shortRange, longRange, image). The UI-only `key` and `index` are added by `_weapons()` in I2 via a spread.
- **Dependencies:** none
- **Acceptance criteria:**
  - `damagePool({weaponDamageStep: UNARMED_WEAPON.damageStep, strengthStep: 7, effects: []})` gives step 7.
  - With `strengthStep: null` it gives null.
  - `attackTalentNamesFor(UNARMED_WEAPON.category)` gives `['Unarmed Combat']`.
  - Success-level bonus steps add to the Strength step (the +2 per level multiplier is I4, not I1).
- **Risks / unknowns:** none.

### I2 — Combat tab: Unarmed in the Weapon dropdown
- **Covers tickets:** T2
- **Rules:** R1, R2, R3, R5, R6
- **Tier:** 3
- **What:** `_weapons()` returns None, then Unarmed, then the equipped weapons. Unarmed is `{ ...UNARMED_WEAPON, key: 'Unarmed', index: 0 }` and is always listed.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-combat.js`. Import `UNARMED_WEAPON` at L24. Edit `_weapons()` and its comment (L465-467).
- **Approach:**
  - Reserved keys: `None` and `Unarmed` belong to the synthetic entries. Concrete rule: in `_weapons()`, after computing an equipped weapon's key (`name` for index 0, `name#N` otherwise), if the key's base name is `None` or `Unarmed` (i.e. `w.name` is one of them), prefix the key with `equipped:` (e.g. `equipped:Unarmed`, `equipped:Unarmed#1`). All other equipped keys are unchanged, so stored `_weapon` picks stay valid. Spell weapon-choice matching uses `{name, index}`, not `key`, so it is unaffected. Document the reserved keys and the prefix in the `_weapons()` comment. This also fixes the latent `None` collision.
  - Everything else is already category-driven. Verify:
    - The talent list filters to Unarmed Combat.
    - A character without Unarmed Combat shows "No matching talent/skill" (the L1443 branch fires because `w.category != null`).
    - `isNone` is false, so the attack is armed and labelled "Attack — Unarmed".
    - Damage ⚄ is enabled (L848 only checks `dp.step`).
    - `unarmed`-scoped options show via `_attackScopes`.
    - The audit base reads "Unarmed Damage Step 0".
    - A stored `_weapon` naming a removed weapon still falls back to `list[0]` (None).
  - If any of these is not already true in the code, make the minimal fix.
  - Audit label: no label change. The existing two rows ("Strength step" and "Unarmed Damage Step 0", ed-combat.js L1526-1527) together satisfy T2's "Unarmed Damage Step 0 + Strength" audit criterion; the audit sums its rows.
  - Check that `_weaponArgs` with `{name:'Unarmed', category:'unarmed'}` does not accidentally match a spell's chosen weapon.
- **Dependencies:** I1.
- **Acceptance criteria:**
  - Unarmed plus Unarmed Combat plus target N rolls the Attack vs N and reports Hit or Miss.
  - After a hit, Damage rolls the Strength step plus +2 steps per success level (via I4).
  - A manual success count works when there is no target.
  - Karma is offered on Damage if a grant exists.
  - None behaves as before: no Damage Step and no arming.
  - The dropdown option reads "Unarmed · dmg 0".
  - Placeholder pill for Damage when Strength is null.
  - Light and dark mode unaffected (no new styling).
- **Risks / unknowns:**
  - Key collision with an equipped weapon named "Unarmed" or "None": handled by the `equipped:` prefix rule above. Add a note in the build that the owner can sanity-check by equipping a custom weapon named "Unarmed".
  - Mystic Aim and other `arms` talents with weapon Unarmed. `_armedForPick` scope filtering uses the category, so an armed aim scoped missile/throwing correctly does not apply.

### I3 — Tests and docs
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:**
  - Add engine tests in `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.test.js`: the `UNARMED_WEAPON` shape, `damagePool` with Unarmed (Strength-only, null Strength gives null, bonusSteps add), and `attackTalentNamesFor('unarmed')` through the descriptor.
  - Extend the UI-GUIDELINES.md Combat row to note the Weapon picker lists None (free-action roll) and Unarmed (Unarmed Combat, Strength-step Damage) before the equipped weapons. If `docs/PLAN-COMBAT-TAB.md` exists and describes the picker, update it too.
  - Run `npm test`.
- **Where:** `engine/combat.test.js`, `docs/UI-GUIDELINES.md`.
- **Approach:** Follow the existing test style (`node:test`). No UI component test, since there is no pattern. Manual verification is left to the owner.
- **Dependencies:** I1, I2.
- **Acceptance criteria:** `npm test` passes and the docs are truthful.
- **Risks / unknowns:** The docs may need no change if the picker is not described. In that case record that in the build notes.

### I4 — Engine and UI: extra success = +2 Damage Steps (all weapons)
- **Covers tickets:** T4
- **Rules:** R3
- **Tier:** 3 (bug fix restoring book behaviour; no taxonomy, schema or `rules/*.json` change; nothing stored)
- **What:** Each extra success level (5 over the target) adds +2 Damage Steps, not +1, for every weapon and for Unarmed, on the auto (target) path and the manual-successes path, in the Damage pool and the audit.
- **Where (every place +1 per level is applied, found by grep):**
  - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.js`:
    - Doc comment L66-69 on `attackSuccessLevels` ("Each level adds +1 to the Damage step") becomes +2.
    - `damagePool` L229-242 and `auditPool` L253-290 take `bonusSteps` as STEPS and add it as is. They need no arithmetic change. Fix their doc comments to say bonusSteps = 2 x levels. The audit row "Attack success levels" (L290) pushes `value: bonusSteps`, so it shows +2 per level once the caller passes steps.
    - Add the multiplier here, not in the UI (data-down, UI never computes game values): export `EXTRA_SUCCESS_DAMAGE_STEPS = 2` and a pure `successDamageSteps(levels)` returning `levels * 2` (0 for non-finite or <= 0). `attackSuccessLevels` stays the pure level count (its tests at combat.test.js L46-55 are correct).
  - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-combat.js`:
    - `_damageBonus()` (L701-706) is the single source for both the pool (L720 `bonusSteps`) and the audit (L1531). Split it: `_damageLevels()` returns the level count (auto via `attackSuccessLevels`, or the manual `_manualSuccesses` floor), and `_damageBonus()` returns `successDamageSteps(this._damageLevels())`. Both consumers keep calling `_damageBonus()`, so they pick up +2 per level with no further change. Import the new helper at L24.
    - Manual path: the `_manualSuccesses` input (L1459) is a success COUNT, so it keeps meaning levels and gets the same x2. Reword its title to say each success adds +2 Damage steps.
    - `_damageBonusBadge()` (L455-460) currently shows `+n` with the title "+n to the Damage step". Make it show the steps (`+${steps}`) with a title like "N success level(s) on the attack, +steps to the Damage step", using `_damageLevels()` for the N.
    - Check the comment at L697-700 and the roll-log note around L880 for any "+1" wording.
  - Tests: `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.test.js`:
    - L57-62 (`damagePool bonusSteps`) pass raw steps, so they stay valid. Retitle if needed.
    - L484-496 (`auditPool` "success-level bonus", comment "two attack success levels", passes 2 and asserts +2): this encodes 1 step per level. Rewrite it to derive the bonus from `successDamageSteps(2)` (4 steps) and assert `STR + WEAPON + 4`, the audit row value 4, and equality with `damagePool`.
    - Add tests for `successDamageSteps` (0 -> 0, 1 -> 2, 2 -> 4, negative or null -> 0). Add an end-to-end style test: attack 11 vs 5 gives 1 level giving +2 steps; 17 vs 5 gives +4; a miss gives 0.
    - grep found no other test asserting +1 per level.
  - Docs and plans stating +1:
    - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/plans/PLAN-COMBAT-TAB-FIXES.md` Item 7 (L123-140: "+2 steps" example vs "+1 step per level" formula, `damageStepBonus = successLevels`, worked examples +1/+2/+3) and the Resolved Q2 line (~L276). Correct the formula to `successLevels x 2` and the examples to +2/+4/+6, with a dated note pointing at the owner correction (the example text there already says 17 gives "+2 steps", which was inconsistent).
    - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/plans/new-combat-ui/design-option-a.html` L172 `bonus()` (design mockup): update if it models +1 per level, otherwise leave it. It is a throwaway mockup, so mark it low priority.
    - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/docs/BUG-DESPERATE-SPELL-BLOOD-CHARM.md` quotes only signatures, so it needs no change.
    - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/docs/TAXONOMY-AUDIT.md` T-0xx (~L306) describes the `_onRollLogged` to `attackSuccessLevels` flow. Check it for a "+1" claim. The UI-computes-game-values finding is not made worse, since the multiplier lives in the engine.
    - `/Users/garyfebbrarino/Work/workspace/EDCharSheet/docs/RULES-FAQ.md` Q025 and Q009 were already revised by the rule-agent (not edited here).
    - Add a `data/changelog.json` `unreleased.changes` entry (type `fixed`): extra attack successes now add +2 Damage steps each, for all weapons (check the file's current shape first and follow `docs/FEATURE-WORKFLOW.md` for changelog duty).
- **Approach:** Engine owns the multiplier. `damagePool`/`auditPool` stay pure step adders. The UI passes `_damageBonus()` (steps). The Mystic Aim `successCount` +2 steps per success is separate and unchanged.
- **Dependencies:** none for the code; I2 depends on it only in the sense that Unarmed Damage reads the same `_damageBonus()`. Do I4 before or alongside I1 and I2 so the I3 tests are written once against the correct rule.
- **Acceptance criteria:**
  - 1 level gives +2 steps and 2 levels give +4. A miss or no target gives 0.
  - The manual successes input behaves the same (n successes gives +2n steps).
  - The audit row "Attack success levels" shows +2 per level and the audit sum equals the Damage pool step.
  - Armed weapons (e.g. Battle Axe) and Unarmed both get +2 per level.
  - The badge shows the steps value.
  - `npm test` passes with the updated tests.
- **Risks / unknowns:** The earlier `+n` badge reading as levels may confuse. Mitigated by the title text. Existing characters' stored data is unaffected (nothing stored).

## Review responses
- Post-review owner correction (2026-10-05, not a reviewer finding): the owner ruled that each extra success adds +2 Damage STEPS (PG p.34 and p.378), replacing the earlier "follow app +1" answer. This added ticket T4 and item I4 (engine fix for all weapons), rewrote R3, and removed the "follow app +1" text from Context, Rules dependencies and the I1/I2 acceptance criteria. I3 now also covers the +2 tests, via I4.
- F1 (key collision undecided): fixed, but with the dedupe option rather than the reviewer's document-only suggestion, as the orchestrator directed. Colliding equipped weapons get an `equipped:` key prefix (see I2). Cheap, and it also covers `None`. No "or" remains.
- F2 (audit label vs T2): fixed. I2 now states the two existing rows satisfy T2; no label change.
- F3 (I1 descriptor wording): fixed. I1 no longer claims key/index come from the constant.

## Sequencing
1. I4: the +2 correction is independent, touches existing tests, and fixes the shared `_damageBonus()` that Unarmed Damage will use.
2. I1: the engine constant is a prerequisite and is independently testable.
3. I2: UI wiring consumes it.
4. I3: tests are written alongside I1, and the docs are finalized last once the UI behaviour is confirmed.

## Open questions
- None blocking. Deferred by the owner: replacement-step talents and knacks (Claw Shape and others), Beastmaster and other Damage-Karma grant data, and Karma-on-Damage scope enforcement.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
