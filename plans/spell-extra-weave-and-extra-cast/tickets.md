# Feature: Apply weave-success and cast-success spell options together (spell-extra-weave-and-extra-cast)

## Summary
A cast has two option sources: Extra Thread options (picked per successful extra weave) and the Success Levels option (applied per extra cast success). The engine folds both into value/duration for self-casts, but the UI does not record or show both: Target effects (cast on Other) omits the success-level effect and the boosted duration, and the self-cast Active effects row hides which options were applied. Fix so both show and are recorded.

## Goals / Non-goals
- Goal: Target effects lists every applied extra-thread option and the success-level option (with ×N), plus the boosted duration as computed rounds (Rank + boost), falling back to spell text when not round-countable.
- Goal: Active effects row (self-cast) shows sub-line chips for all applied options (picks + success option ×N); countdown keeps boosted rounds.
- Goal: engine composes the data/text; UI renders it (golden rule).
- Non-goal: any change to stored character data, `rules/*.json`, or taxonomy.
- Non-goal: changing weave/cast roll mechanics or the one-success-option-per-spell data model.
- Non-goal: persistence of the outcome beyond existing session state.

## Guardrail alignment
Docs: UI-GUIDELINES §4 Spells row (already covers self-cast active effects and target effects, so no contract change), ARCHITECTURE.md if it describes the flow. Session state only; no schema/taxonomy change. All tickets Tier 3 (bug fix restoring documented behavior + in-guideline content on existing sections). No Tier-1 sign-off needed.

## Tickets
### T1 — Engine: record applied options and boosted duration
- **What:** Extend `otherCastOutcome` and `buildActiveSpell` (`engine/spells.js`) so each returns the applied options (extra-thread picks, success-level option with multiplier levels−1) and the boosted duration in rounds (base via `durationRounds(spell.duration, rank)` + boost), with text fallback. Pure, DOM-free, reads structured `effects[]`, no label parsing.
- **Why:** Today `otherCastOutcome` ignores the success option and duration boost; `buildActiveSpell` folds boosts invisibly.
- **Tier:** 3
- **Acceptance criteria:** Pain, +1 Wound pick, 2 successes → picks [Increase Effect (+1 Wound)], success option "Increase Duration (+2 rounds)" ×1, duration rounds = Rank+2. 1 success → no success option. Multiple picks stack. Non-round durations fall back to text. Miss yields no options. node:test coverage.
- **Open questions:** none

### T2 — Spells tab: render both option sets in Target effects and Active effects
- **What:** `ui/ed-spells.js`: Target effects shows picks, success-level chip (with ×N) and computed duration; Active effects row shows sub-line chips for all applied options. The Other-cast record must carry what the engine needs (caster rank). Session state only.
- **Why:** Owner reports the success effects/duration are lost in Target effects and invisible on self-casts.
- **Tier:** 3
- **Acceptance criteria:** Matches owner's Pain example; light/dark; font tokens; chips use existing `pickchip` style; no desktop scroll regression; unrolled values keep placeholder pills.
- **Open questions:** none

### T3 — Docs and changelog
- **What:** Note behavior in UI-GUIDELINES §4 only if wording needs it; one `data/changelog.json` unreleased line.
- **Tier:** 3
- **Acceptance criteria:** changelog one user-facing line.
- **Open questions:** none
