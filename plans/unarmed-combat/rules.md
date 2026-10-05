# Rules brief: Unarmed Combat (unarmed-combat)

## R1 — Unarmed Damage Step = Strength Step + 0
- **Status:** ANSWERED
- **Ruling:** Unless noted otherwise an unarmed Damage test uses Strength Step only; no base "fist" step (weapons add their Damage Step to Strength).
- **Sources:** RULES-FAQ Q025; talents-players:691-694; PG p.177, p.378-379
- **Decision:** none
- **Used by:** T1, T2, T3

## R2 — Unarmed Attack targets Physical Defense; no armed/unarmed precondition
- **Status:** ANSWERED
- **Ruling:** Attack test (Rank+DEX, Standard, Strain 0) vs target's Physical Defense. Close-combat attack type.
- **Sources:** Q025; PG p.391
- **Decision:** none
- **Used by:** T1, T2

## R3 — Extra success levels bonus
- **Status:** APP-DIFFERS (resolved: app is wrong)
- **Ruling:** Each extra success (5 over the Difficulty Number) adds +2 Damage STEPS to the Damage test (applied to the Step before rolling), not flat points. App currently adds +1 Step per level (`bonusSteps` in `damagePool`/`auditPool`; `attackSuccessLevels` counts levels correctly).
- **Sources:** Q025 (revised 2026-10-05), Q009; PG p.34 (text-RB-players-guide.txt:922-936), p.378 (14204-14211, Silar crossbow Step 10 → 14)
- **Decision:** Owner 2026-10-05 (correction): +2 Steps per extra success; supersedes the earlier "follow app (+1)" answer. Applies to all weapons, not only unarmed.
- **Used by:** T2, T4

## R4 — Armor on unarmed damage
- **Status:** NOT-COVERED (unarmed-specific); general rule applies
- **Ruling:** Physical Armor subtracts from Damage test like any attack; nothing unarmed-specific. Outside this feature (Damage Taken modal handles armor).
- **Sources:** Q025; PG p.379
- **Decision:** none needed
- **Used by:** T2 (context only)

## R5 — Unarmed while holding weapon/shield; Shield Bash after unarmed
- **Status:** CONFLICT (books silent)
- **Ruling:** No general prohibition; Hammer Punch knack alone restricts off-hand use.
- **Sources:** Q025; PG p.166
- **Decision:** Owner 2026-10-05: no restriction; Shield Bash scope unchanged.
- **Used by:** T2

## R6 — Karma on unarmed Damage
- **Status:** ANSWERED
- **Ruling:** Karma on Damage needs a discipline grant (e.g. Beastmaster C5 "any unarmed Damage test"). Unarmed Combat attack test itself is Karma-eligible as a talent; skill use is not.
- **Sources:** Q025 + addendum; PG p.120-121, 3192
- **Decision:** Owner 2026-10-05: use existing `damageKarma` path unenforced; no new grant data (no Beastmaster in app).
- **Used by:** T2

## R7 — Modifiers replacing/adding to unarmed damage (Claw Shape, Body Blade, Hammer Punch, Blazing Fists, Crack the World, tail attack)
- **Status:** ANSWERED
- **Ruling:** Exist in books; only one Strength-step replacement may apply.
- **Sources:** Q025
- **Decision:** Owner 2026-10-05: out of scope, deferred.
- **Used by:** non-goal
