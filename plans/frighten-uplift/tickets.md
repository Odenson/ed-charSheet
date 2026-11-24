# Feature: Frighten uplift (frighten-uplift)

## Summary
A successful Frighten roll should add a display-only entry on the target in the Active effects window: "-2 x successes to all tests" for Rank rounds, with a reminder of the target's per-round Willpower end-test vs the Frighten step. Frighten rolls vs Mystic Defense like self-buff Mystic Aim, so the hardcoded `vs === 'Social'` opponent inference (Taunt) is replaced by an explicit optional `arms.opponent: true`, used by both Taunt and Frighten.

## Goals / Non-goals
- Goal: Frighten arms an opponent entry (Rank rounds, countdown, ended by existing X).
- Goal: entry shows computed total penalty and end-test reminder with the Frighten step.
- Goal: `arms.opponent` replaces the Social hardcode (Taunt migrated).
- Non-goal: auto-applying the penalty to target rolls; in-app Willpower end-test roll; stacking of multiple Frightens (one entry per cast); changing Taunt's display; Evil Eye / Death's Head +2 modelling.

## Guardrail alignment
Touches docs/EFFECT-TAXONOMY.md (arms note), docs/GUARDRAILS.md Tier 1 (rules schema shape), rules/talents.json, store.js, engine/active-effects.js. Not a taxonomy vocabulary change (no version bump), consistent with the Taunt "rank" precedent.

## Tickets
### T1 — Explicit `arms.opponent` flag (replace Social hardcode)
- **What:** Add optional `arms.opponent: true` to Taunt and Frighten in rules/talents.json; store.js derives `opponent` from it instead of `roll.vs === 'Social'`; the text source no longer depends on Social; docs note updated.
- **Why:** Frighten vs Mystic can't be distinguished from Mystic Aim by `vs`.
- **Tier:** 1 (sign-off: qa-log 2026-11-24T11:58Z, additive optional field; no version bump)
- **Acceptance criteria:** No `'Social'` check remains deciding opponent-ness; Taunt behaves unchanged; Mystic Aim/Anticipate Blow still self-arm; conformance tests pass; EFFECT-TAXONOMY arms note documents `opponent`.
- **Open questions:** none

### T2 — Frighten as an opponent arm with computed total
- **What:** Frighten gets `arms { roll:{vs:"Mystic"}, rounds:"rank", opponent:true }` (duration per book: Rank rounds); on success an opponent entry shows "N successes", total penalty "-2 x N = -2N to all tests", Rank-rounds countdown, and text: target may make a Willpower test vs your Frighten Step (value shown) to end it; fear-immune unaffected. Works from every roll surface (Disciplines, Combat). The existing `test-modifier` effect must not fold into any roll pool for the adept.
- **Why:** Owner's request; R1-R4.
- **Tier:** 3
- **Acceptance criteria:** Successful Frighten adds an entry in the target group with computed total and end-test reminder with the correct step; a miss adds nothing; rounds = rank and ticks per round; existing X removes it; Day reset/character switch clears it; no effect on the adept's own pools; Taunt text stays static.
- **Open questions:** how a per-success total is derived generically from the talent's effect value (planner/designer choice, data-driven, no display-string parsing).

### T3 — Docs and data headers
- **What:** Update EFFECT-TAXONOMY arms note, talents.json header if any, RULES-FAQ already updated (Q050).
- **Tier:** 3
- **Acceptance criteria:** docs match code.
- **Open questions:** none
