# Feature: Unarmed Combat (unarmed-combat)

## Summary
The Combat tab cannot complete an unarmed attack: with weapon "None" and Unarmed Combat picked, Damage has no step (weapon Damage Step null) and success levels are not armed. Add a real "Unarmed" entry to the Weapon dropdown (category `unarmed`, Damage Step 0 + Strength) so attack vs Physical Defense, hit, then unarmed Damage roll all work. "None" keeps its meaning as the free-action/non-attack roll.

## Goals / Non-goals
- Goal: "Unarmed" always listed in Weapon dropdown; filters talent list to Unarmed Combat (talent/skill); Attack vs target number; Damage = Strength step; success levels arm and buff Damage (+2 Damage Steps per extra success); unarmed-scoped combat options appear; Karma on Damage via existing path.
- Non-goal: no "None" entry in the talent dropdown; Claw Shape/Body Blade/Hammer Punch/tail attack/Crack the World; new Karma-on-Damage grant data (Beastmaster etc.) or scope enforcement; armed-use restrictions; Shield Bash for unarmed.

## Guardrail alignment
Touches ui/ed-combat.js, engine/combat.js, tests, docs. Data-down/dispatch-up kept: the Unarmed weapon descriptor and its Damage Step 0 come from the engine, UI only renders. No schema, taxonomy or rules/*.json change. All tickets Tier 3 (new view content within Combat tab, bug-fix restoring documented intent: engine already documents "the synthetic Unarmed weapon").

## Tickets
### T1 — Engine: synthetic Unarmed weapon
- **What:** Export from engine/combat.js a descriptor `UNARMED_WEAPON` (`name: 'Unarmed'`, `category: 'unarmed'`, `damageStep: 0`, no range/image/effects).
- **Why:** The damage step 0 is a rule value (R1); keep it out of the UI.
- **Tier:** 3
- **Acceptance criteria:** `damagePool` with Unarmed → Strength step; with null Strength → null (placeholder); `attackTalentNamesFor('unarmed')` → ['Unarmed Combat'].
- **Open questions:** none

### T2 — Combat tab: Unarmed in Weapon dropdown
- **What:** `_weapons()` lists None, Unarmed, then equipped weapons (key reserved `Unarmed`). Selecting it filters talent/skill list to Unarmed Combat, arms success levels on attack (so `isNone` logic keyed on category null only), enables Damage ⚄, labels rolls "Attack — Unarmed"/"Damage — Unarmed", `unarmed`-scoped combat options show, Damage Karma offered via existing `damageKarma`, audit modal labels the damage base "Unarmed Damage Step 0 + Strength".
- **Why:** Core request.
- **Tier:** 3
- **Acceptance criteria:** Unarmed + Unarmed Combat + target N: Attack rolls vs N (Hit/Miss); Damage button enabled and rolls Strength step (+2 steps per level); no weapon art falls back as for None; character lacking Unarmed Combat shows "No matching talent/skill"; a stored `_weapon` of a removed weapon falls back as today; None behaviour unchanged.
- **Open questions:** none

### T4 — Engine: extra success = +2 Damage Steps (bug fix, all weapons)
- **What:** Correct the extra-success damage bonus from +1 Step to +2 Steps per level (5 over target) in the damage pool and audit (`bonusSteps` threading, `_damageBonus`, manual-successes input, audit "Attack success levels" row, doc comments in engine/combat.js). Update existing tests/docs that assert +1.
- **Why:** Owner correction 2026-10-05: PG p.34/378 ("Step 10 to Step 14" for two extra successes). The existing +1 was a mis-implementation of the owner-confirmed level count.
- **Tier:** 3 (bug fix restoring documented book behaviour; no taxonomy/schema change)
- **Acceptance criteria:** 1 level → +2 steps, 2 → +4, miss/no target → 0; manual successes input likewise; audit shows +2 per level; all weapons and unarmed.
- **Open questions:** none

### T3 — Tests and docs
- **What:** Engine tests (T1); UI state/logic tests where the repo has a pattern; update docs mentioning the weapon picker / None (UI-GUIDELINES or PLAN-COMBAT-TAB notes) if they describe it.
- **Why:** Guard regression.
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes; docs truthful.
- **Open questions:** none
