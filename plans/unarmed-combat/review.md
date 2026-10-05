# Plan Review: Unarmed Combat (unarmed-combat)

## Summary
The plan is sound. I checked its code claims against engine/combat.js, engine/spells.js and ui/ed-combat.js and they hold. It covers T1 to T3, is correctly Tier 3, and traces every rule to rules.md with owner decisions recorded where needed. There are 3 minor findings and no blockers.

## Findings
### F1 — I2 — Key collision left undecided
- **Severity:** minor
- **Problem:** The plan says to "dedupe ... or document the reservation". An equipped weapon named "Unarmed" at index 0 would get key `Unarmed`. That duplicates the synthetic entry, and `_selWeapon` would always find the synthetic one first. "None" already has the same latent collision.
- **Fix:** Pick one option. The simplest is to document the reserved keys `None` and `Unarmed` in the `_weapons()` comment and accept the unlikely collision. Remove the "or" from the plan.

### F2 — I2 vs T2 — Audit label differs from the ticket
- **Severity:** minor
- **Problem:** T2 requires the audit to label the damage base "Unarmed Damage Step 0 + Strength". The plan keeps the two-row audit, "Strength step" plus "Unarmed Damage Step 0" (ed-combat.js L1526-1527), and says to consider a change only "if misleading". The ticket and plan are inconsistent.
- **Fix:** State explicitly that the existing two rows satisfy T2's audit criterion, and note that the ticket wording is satisfied by the pair of rows. Otherwise specify the label change.

### F3 — I1 — Descriptor fields vs `_weapons()` shape
- **Severity:** minor
- **Problem:** The I1 Approach says the constant matches the "None" descriptor fields, including key and index. The `UNARMED_WEAPON` object specified in I1 has no key or index. I2 adds them with a spread, which is fine.
- **Fix:** Reword I1 so it does not claim key and index come from the constant.

## Verified, no finding
- `_rollAttack` already arms the attack with `isNone = category == null` (L817).
- `_attackScopes` and `_attackOptions` are category-driven (L522-527, L584-587).
- The L1443 branch handles the "No matching talent/skill" case.
- The Damage ⚄ button depends only on `dp.step` (L850).
- Spell weapon-choice matching comes only from equipped weapons (`castWeaponChoices`, engine/spells.js L533), so the synthetic Unarmed entry cannot be chosen there.
- `docs/PLAN-COMBAT-TAB.md` does not exist. The UI-GUIDELINES L59 Combat row is the one doc to touch.
- UI work is called out for manual verification by the owner.
