# Feature: Unarmed Combat missing short effect (unarmed-short-effect)

Backlog: B-001

## Summary
The Warrior's optional Unarmed Combat talent (e.g. on the Fighter Test troll)
shows no short effect because its `rules/talents.json` entry is a bare stub
(name/action/attribute only). This fills the entry out to the same shape as the
Melee Weapon talent, so it carries a shortEffect, strain, skill use, tier,
versus, summary and an on-success note effect, all verified against the books.

## Goals / Non-goals
- Goal: Unarmed Combat talent entry complete and consistent with Melee Weapon and the Unarmed Combat skill entry.
- Goal: shortEffect "Unarmed close-combat attack" shows wherever talent briefs render.
- Goal: a data test guards the entry.
- Non-goal: filling the other stub talents (Shield Bash, Tactics, Fireblood, etc.).
- Non-goal: engine, UI or taxonomy changes; combat/damage behavior changes.

## Guardrail alignment
Touches `rules/talents.json` (data within the existing schema and EFFECT-TAXONOMY
vocabulary — `note` effect, `on-success`, `source: talent`) and a test file.
All tickets Tier 3. No Tier-1 or Tier-2 items.

## Tickets
### T1 — Complete the Unarmed Combat talent entry
- **What:** In `rules/talents.json`, extend "Unarmed Combat" with `presentation.shortEffect: "Unarmed close-combat attack"`, `strain: 0`, `skillUse: { allowed: true, tier: "Novice" }`, `tier: "Novice"`, `versus: "target's Physical Defense"`, a `summary` (close-combat attack with hands/feet/body vs Physical Defense; on a hit make a Damage test using Strength Step only unless noted otherwise), and `effects: [{ type: "note", condition: "on-success", source: "talent", summary: "Hit — follow with an unarmed Damage test (Strength Step)." }]`. Keep existing `action: "Standard"`, `attribute: "Dexterity"`.
- **Why:** Backlog B-001; stub shows no short effect and lacks rules data its siblings carry.
- **Tier:** 3
- **Acceptance criteria:** entry has every field above with values per rules.md R1–R5; shortEffect exactly "Unarmed close-combat attack"; `npm test` (incl. rules-conformance) passes; the Fighter Test character's Unarmed Combat shows the short effect in the UI where talent briefs render.
- **Open questions:** none.

### T2 — Data test guarding the entry
- **What:** Add a test asserting the Unarmed Combat talent's shortEffect, strain 0, Standard, Dexterity, skillUse Novice, versus Physical Defense, and an on-success note effect.
- **Why:** Prevent regressing to a stub.
- **Tier:** 3
- **Acceptance criteria:** test fails on the current stub, passes after T1; runs in `npm test`.
- **Open questions:** none.
