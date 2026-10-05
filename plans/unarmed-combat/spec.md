# Tech Spec: Unarmed Combat (unarmed-combat)

## Overview
Add a frozen engine constant `UNARMED_WEAPON` and a pure `successDamageSteps(levels)` helper to `engine/combat.js`. `ui/ed-combat.js` `_weapons()` lists None, Unarmed, then equipped weapons, with reserved-key dedupe. The damage bonus from extra attack successes changes from +1 to +2 Damage Steps per level for all weapons (T4): the multiplier lives in the engine, and `_damageBonus()` in the UI now returns steps via that helper. Most Unarmed behaviour is already category-driven in the UI and is verified, not rewritten.

## Guardrail alignment
- All changes are Tier 3 (plan.md "Guardrail classification"): new content in the Combat tab, an engine export, and a bug fix restoring book behaviour. No schema, taxonomy, `rules/*.json` or version-tag change, so no Tier-1 or Tier-2 sign-off is needed.
- Data-down/dispatch-up holds: the Damage Step 0 and the +2 multiplier come from the engine and the UI only renders them. The engine stays pure and DOM-free. Nothing is stored (levels and steps are derived from ephemeral `_lastAttack` / `_manualSuccesses` state). A null Strength gives a placeholder pill.
- No new `dispatch` event is introduced.

## Design
### Data / types
None stored. New engine exports:
- `UNARMED_WEAPON` = `Object.freeze({ name:'Unarmed', category:'unarmed', damageStep:0, shortRange:null, longRange:null, image:null })`. It has no `effects`, `key` or `index`.
- `EXTRA_SUCCESS_DAMAGE_STEPS = 2`.

### Modules & functions
- `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.js`
  - Add `UNARMED_WEAPON` next to `WEAPON_TALENTS`, and update the header and `attackTalentNamesFor` doc comments to reference it.
  - Add `successDamageSteps(levels)`, returning `levels * EXTRA_SUCCESS_DAMAGE_STEPS` when `levels` is finite and greater than 0, else 0.
  - `attackSuccessLevels` is unchanged in behaviour (a pure level count). Fix the doc comment ("+1" becomes "+2 Damage steps via `successDamageSteps`").
  - `damagePool` and `auditPool` keep adding `bonusSteps` as steps, with no arithmetic change. Fix their doc comments to say `bonusSteps` is in steps (2 x levels). The audit "Attack success levels" row therefore shows the step value.
- `/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-combat.js`
  - Import `UNARMED_WEAPON` and `successDamageSteps` (L24).
  - `_weapons()` (~L468) returns `[None, { ...UNARMED_WEAPON, key:'Unarmed', index:0 }, ...equipped]`.
    - Equipped weapons get `key = index > 0 ? `${w.name}#${index}` : w.name`. If `w.name` is `'None'` or `'Unarmed'`, the key is prefixed with `equipped:`.
    - Other keys are unchanged, so stored `_weapon` picks stay valid.
    - Update the comment to document the reserved keys and the prefix.
  - Split `_damageBonus()` (~L701): `_damageLevels()` returns the level count (0 unless `_attackArmed`; with a target it returns `attackSuccessLevels(_lastAttack.total, _lastAttack.target)`; otherwise it returns the floored manual count). `_damageBonus()` returns `successDamageSteps(this._damageLevels())`. `_damagePool()` (L720) and the audit (L1531) keep calling `_damageBonus()`.
  - `_damageBonusBadge()` (~L455): show `+${steps}` with title "N success level(s) on the attack, +steps to the Damage step" (N from `_damageLevels()`).
  - Reword the manual-successes input title (~L1459) to say each success adds +2 Damage steps. Fix any "+1" wording in the comments at ~L697-700 and the roll-log note near ~L880.
  - No change to `_rollAttack`, `_attackScopes`, `_attackOptions`, `_damageAudit` or `_weaponArgs`. They are verified in the checklist below.

### UI / behavior
- The Weapon dropdown lists None, Unarmed (shown "Unarmed · dmg 0" through the existing `· dmg N` suffix), then the equipped weapons. Unarmed is always listed.
- Selecting Unarmed:
  - The talent/skill list filters to Unarmed Combat. A character without it gets the existing "No matching talent/skill" branch.
  - The attack is armed (`isNone` is false, as it is category-keyed) and rolls are labelled "Attack — Unarmed" and "Damage — Unarmed".
  - Damage ⚄ is enabled when `dp.step` is finite.
  - `unarmed`-scoped combat options show via `_attackScopes`.
  - The audit shows "Strength step" plus "Unarmed Damage Step 0", with the sum equal to the pool step.
  - The art box uses the no-image fallback, and range is not rendered.
  - `damageKarma` is offered through the existing path, unenforced.
- None is unchanged: free-action roll, no Damage Step, not armed.
- A stored `_weapon` naming a removed weapon falls back to `list[0]` (None).
- The badge now reads steps (+2 per level).
- No new styling, so light and dark are unaffected. No modal changes, and no Overview impact.

Verification checklist for the dev (confirm in code; make a minimal fix only if false):
- `_weaponArgs` with `{name:'Unarmed', category:'unarmed', index:0}` cannot match a spell's chosen weapon (`castWeaponChoices` in `engine/spells.js` is built only from equipped weapons).
- Mystic Aim and other `arms` talents are filtered by category scope, so they do not apply to Unarmed.

### Rules
| Rule | Value | rules.md id / source |
|---|---|---|
| Unarmed Damage Step | Strength step + 0 (UNARMED_WEAPON.damageStep = 0) | R1; Q025; PG p.177, 378-379 |
| Unarmed Attack | Attack test vs target Physical Defense, close-combat type, no armed/unarmed precondition; talent Unarmed Combat | R2; Q025; PG p.391 |
| Extra successes | Every full 5 over the target is a level; each level adds +2 Damage Steps (before rolling), for all weapons. Examples: attack 11 vs 5 gives 1 level, +2 steps; 17 vs 5 gives 2 levels, +4 steps; a miss gives 0 | R3; Q025, Q009; PG p.34, 378 |
| Armor | Handled by the Damage Taken modal (context only) | R4 |
| No armed/unarmed restriction; Shield Bash scope unchanged | Owner decision | R5 |
| Karma on Damage | Existing `damageKarma` path, unenforced; no new grant data | R6 |
| Claw Shape, Body Blade, Hammer Punch, etc. | Deferred | R7 |

### Edge cases & invariants
- `damagePool` with Unarmed and a null Strength step gives `step: null` (placeholder). `bonusSteps` never fabricates a step.
- `successDamageSteps(null | undefined | NaN | negative | 0)` returns 0.
- A miss or no target gives 0 levels. The manual path uses a success COUNT and also multiplies by 2.
- The audit sum always equals the `damagePool` step.
- An equipped custom weapon named "Unarmed" or "None" gets key `equipped:Unarmed` or `equipped:None`, never colliding with the synthetic entries. A spell weapon-choice uses `{name, index}`, not `key`, so it is unaffected.
- The Mystic Aim +2 steps per success (`successCount`) is separate and unchanged.

## Testability notes
- `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/combat.test.js` (node:test):
  - `UNARMED_WEAPON` shape, and that it is frozen.
  - `damagePool({weaponDamageStep: UNARMED_WEAPON.damageStep, strengthStep:7, effects:[]}).step === 7`; null Strength gives null; `bonusSteps` adds.
  - `attackTalentNamesFor(UNARMED_WEAPON.category)` equals `['Unarmed Combat']`.
  - `successDamageSteps`: 0 gives 0, 1 gives 2, 2 gives 4, and -1, null and NaN give 0.
  - End-to-end: `successDamageSteps(attackSuccessLevels(11,5))` is 2, with (17,5) it is 4, and with (4,5) it is 0.
  - Rewrite the `auditPool` "success-level bonus" test (~L484-496) to use `successDamageSteps(2)` (4 steps): assert `STR + WEAPON + 4`, the audit row value 4, and equality with `damagePool`.
  - The `damagePool bonusSteps` tests (~L57-62) pass raw steps and stay valid. `attackSuccessLevels` tests are unchanged.
- Run `npm test`.
- Manual (owner, UI):
  - The dropdown shows None / Unarmed / equipped.
  - The full Unarmed attack-then-damage flow with a target and with a manual success count.
  - The badge and audit show +2 per level.
  - Light and dark rendering.
  - Equipping a weapon named "Unarmed" does not collide.
- Docs and plans to update:
  - `docs/UI-GUIDELINES.md` L59 Combat row: the Weapon picker lists None (free-action roll) and Unarmed (Unarmed Combat, Strength-step Damage) before the equipped weapons.
  - `plans/PLAN-COMBAT-TAB-FIXES.md` Item 7 and Resolved Q2: change the formula to levels x 2 and the examples to +2/+4/+6, with a dated note.
  - `plans/new-combat-ui/design-option-a.html` L172 `bonus()`: update only if it models +1 per level (low priority).
  - Check `docs/TAXONOMY-AUDIT.md` (~L306) for a "+1" claim. It carries unrelated uncommitted changes, so do NOT touch it unless it is clean.
  - `docs/RULES-FAQ.md` was already revised by the rule-agent.

## Changelog entry
Add two `data/changelog.json` `unreleased.changes` entries (objects of the shape `{type, text}`):
- `{type:"added", text:"Combat tab: Unarmed is now a Weapon choice, so an unarmed attack against Physical Defense and its Strength-step Damage roll work with the Unarmed Combat talent."}`
- `{type:"fixed", text:"Extra attack successes now add +2 Damage steps each (was +1), for all weapons."}`

## Out of scope
- A "None" entry in the talent dropdown.
- Claw Shape, Body Blade, Hammer Punch, tail attack and Crack the World, and replacement-step talents and knacks.
- New Karma-on-Damage grant data (Beastmaster etc.) and scope enforcement.
- Armed/unarmed restrictions, and Shield Bash for Unarmed.
- Schema, taxonomy and `rules/*.json` changes.
- A UI component test for `_weapons()`.
