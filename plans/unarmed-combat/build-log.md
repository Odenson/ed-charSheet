# Build log: unarmed-combat

## Run 1 — 2026-10-05
- **Since:** 2026-10-05T00:45:51Z
- **Alignment:** pass. All items Tier 3 (no Tier-1/2 sign-off needed). rules.md R1–R7 sourced; R3 (APP-DIFFERS), R5 (CONFLICT) carry owner decisions; R4 NOT-COVERED needs none (out of scope). No open questions.
- **Tree:** unrelated uncommitted changes, NOT to be staged: docs/EFFECT-TAXONOMY.md, docs/TAXONOMY-AUDIT.md, ui/custom-item-builder.js, ui/ed-custom-item.js. docs/RULES-FAQ.md (Q025 by rule-agent) is this feature's and is included. Local dev ahead of origin/dev by 7, not behind.

## Build — 2026-10-05
- Engine: UNARMED_WEAPON, EXTRA_SUCCESS_DAMAGE_STEPS, successDamageSteps. UI: Unarmed in `_weapons()` with `equipped:` key prefix, `_damageLevels`/`_damageBonus` split, badge and input wording in steps. Docs/changelog/plan notes updated.
- Gate: `npm test` green (971 pass, 0 fail). No test disputes.
