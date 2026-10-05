# Build log: unarmed-combat

## Run 1 — 2026-10-05
- **Since:** 2026-10-05T00:45:51Z
- **Alignment:** pass. All items Tier 3 (no Tier-1/2 sign-off needed). rules.md R1–R7 sourced; R3 (APP-DIFFERS), R5 (CONFLICT) carry owner decisions; R4 NOT-COVERED needs none (out of scope). No open questions.
- **Tree:** unrelated uncommitted changes, NOT to be staged: docs/EFFECT-TAXONOMY.md, docs/TAXONOMY-AUDIT.md, ui/custom-item-builder.js, ui/ed-custom-item.js. docs/RULES-FAQ.md (Q025 by rule-agent) is this feature's and is included. Local dev ahead of origin/dev by 7, not behind.

## Build — 2026-10-05
- Engine: UNARMED_WEAPON, EXTRA_SUCCESS_DAMAGE_STEPS, successDamageSteps. UI: Unarmed in `_weapons()` with `equipped:` key prefix, `_damageLevels`/`_damageBonus` split, badge and input wording in steps. Docs/changelog/plan notes updated.
- Gate: `npm test` green (971 pass, 0 fail). No test disputes.

## Phase 4–6 (Dev Lead)
- **Review:** clean. Diff matches spec; tester's tests byte-identical to snapshot; engine pure, UI converts levels→steps via engine `successDamageSteps`; gate 971/971.
- **Doc sync applied:** PLAN-COMBAT-TAB-FIXES badge example + v1.11.0 history note; changelog note on None; plan.md `status: implemented`, `shipped: unreleased`. Deferred/not applied: new-combat-ui mockup (historical, low priority); damage-audit row label "Attack success levels" now shows steps (cosmetic); docs/TAXONOMY-AUDIT.md note that `unarmed` scope / `close-combat` effects now reach unarmed attacks (file has unrelated uncommitted edits).
- **Behaviour note for owner:** v1.11.0 deliberately removed the "Unarmed · dmg 0" picker entry; this feature restores it by owner decision. `close-combat` effects (Aspect of the Fog Ghost, Casual Murderer, Bracers, Beer Mug of Brawling) now apply to Unarmed attacks.

### PR checklist
- [x] No Tier-1 invariant changed (data-down/dispatch-up kept; engine owns Damage Step 0 and +2 conversion)
- [ ] Overview viewport fit — Combat tab only; owner to confirm
- [x] No derived value fabricated (null Strength → null step → placeholder pill; tested)
- [ ] Light/dark, modals — owner to confirm (no modal changes)
- [x] N/A taxonomy change
- [x] No fetch/asset paths added

### Manual UI verification
1. Combat tab: Weapon dropdown lists None, Unarmed, then equipped weapons.
2. Pick Unarmed: talent dropdown shows only Unarmed Combat (talent/skill); Damage shows Step = Strength step, ⚄ enabled.
3. Set Versus to a number, roll Attack: Hit/Miss; on 5 over, a `+2` badge appears on Damage and Damage step rises by 2 (10 over → +4). Hover badge shows levels.
4. Clear Versus, roll Attack: "succ" input appears; entering 2 gives +4.
5. Pick None: free-action behaviour unchanged (no Damage step).
6. Pick an equipped melee weapon: +2 per level also applies there.
7. Combat options scoped to unarmed/close combat (Aggressive Attack) appear under Unarmed.
8. Light and dark mode; mobile width; Overview unaffected.
