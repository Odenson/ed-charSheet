# Feature: Death's Head spell fix (deaths-head-spell-fix)

## Summary
`rules/spells.json` Death's Head carries three extra-thread options (+2 Damage Step, +10 yards Range, Additional Target) that are not in the Player's Guide (p. 323). The book has one extra-thread option: +2 bonus to Frighten. Replace the wrong options with a structured sustained effect so a self-cast with an extra thread shows an Active-effects tile for the spell duration and Frighten tests get +2 steps.

## Goals / Non-goals
- Goal: Death's Head matches the book: Threads 0, Weaving 6/11, Range Self, Duration Rank+5 rounds, Effect "Use Frighten as Simple Action", Success Level +2 rounds, Extra Thread +2 bonus to Frighten.
- Goal: each extra thread woven adds +2 steps to Frighten tests, via structured `test-modifier` (target `test|Frighten`, measure step, duration sustained) folded while the spell is active.
- Goal: remove the three non-book options.
- Non-goal: change effect taxonomy, schema, or UI.
- Non-goal: audit other spells (separate features if needed).

## Guardrail alignment
Touches `rules/spells.json` (data within schema/taxonomy) and possibly `engine/spells.js` (pure, no DOM). No taxonomy vocabulary change, no schema shape change, no UI change. `test-modifier` / `step` / `sustained` already in the taxonomy; Soul Armor is precedent. All Tier 3; no sign-offs needed.

## Tickets
### T1 — Correct Death's Head data and make the extra thread a structured sustained effect
- **What:** In `rules/spells.json`, replace the three `extraThreads` with one "Increase Effect (+2 bonus to Frighten)" carrying a sustained `test-modifier` (+2 step, target Frighten). Check description/summary text against the book. Success level stays "+2 rounds".
- **Why:** Data misaligned with PG p. 323; note-only effects never reach the character's Frighten.
- **Tier:** 3
- **Acceptance criteria:** (a) spell shows exactly one extra-thread option; (b) casting on self with N extra threads yields an Active-effects tile for the duration (Rank+5, plus 2 per extra success) and Frighten tests get +2N steps while active, gone on expiry; (c) with 0 extra threads the tile still shows the countdown with no Frighten bonus; (d) rules-conformance and spell tests pass.
- **Open questions:** none.

### T2 — Engine: fold option-borne sustained effects when the base spell has no numeric sustained effect
- **What:** `buildActiveSpell` only boosts the first numeric sustained base effect; Death's Head has none (base is note-only), so the extra thread's +2 would be dropped. Make the engine fold an extra-thread option's own sustained effect (stacking per thread picked) in that case, without changing behavior for existing spells (e.g. Soul Armor). Update the "Known limitation" comment and add tests.
- **Why:** Needed for T1(b). Alternative rejected: a dummy +0 base effect (shows "+0 Frighten" tile, hacky).
- **Tier:** 3 (pure engine extension, data-down/dispatch-up intact, no taxonomy change)
- **Acceptance criteria:** existing spells' active records unchanged (tests); Death's Head with 0/1/2 extra threads gives 0/+2/+4 on Frighten via the derived fold; engine stays DOM-free.
- **Open questions:** none.
