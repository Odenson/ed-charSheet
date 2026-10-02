# Feature: Spell effect outcome on other targets (spell-target-effect-outcome)

## Summary
On the Spells tab, a cast can already be aimed at "This character" or "Other".
Active effects only make sense for self-casts, so when "Other" is selected the
Active effects section is replaced by a **Target effects** section that reports
the outcome of the latest cast on another target: the spell, success or miss vs
the target number, success levels, the Effect roll or static effect, extra-thread
picks applied, and duration. It keeps the latest outcome only.

## Goals / Non-goals
- Goal: when the "Cast on" toggle is Other, show Target effects (not Active effects) with the latest cast's mechanical outcome.
- Goal: the outcome text is composed by the engine, not the UI, from values the cast already produced.
- Goal: the outcome persists across toggling to This character and back and across tab switches, until the next cast on Other replaces it; misses are reported ("Miss vs N — no effect").
- Non-goal: a persistent list, countdown or session log of casts on others (latest only).
- Non-goal: spell description prose or armor-resistance notes/math in the outcome (owner decision).
- Non-goal: any claim about woven threads or Karma on a miss; existing thread behavior unchanged.
- Non-goal: changing how self-casts and Active effects work when "This character" is selected.
- Non-goal: any change to stored character data or `rules/*.json` (the outcome is derived session state; nothing new is stored).

## Guardrail alignment
Docs touched: docs/UI-GUIDELINES.md §4 (Spells row), ARCHITECTURE.md (if the
Spells flow is described there). Tier-1 item T2/T3 signed off by the owner
(qa-log 2026-10-02, "TIER-1 SIGN-OFF"). T1 is Tier 3 (pure engine addition, no
schema or taxonomy change). No Tier-2 change.

## Tickets
### T1 — Engine: cast outcome readout for casts on another target
- **What:** A pure, DOM-free engine function (in `engine/spells.js`) that, given the cast plan and the cast's results (target number, cast total and success levels, Effect result, extra-thread picks, duration), returns a structured outcome for a cast on Other: hit/miss, target number, success levels, effect (rolled total, static effect, or none), picks applied, duration, plus the display text. A miss yields "Miss vs <N> — no effect" with no thread/Karma claim.
- **Why:** The UI must not compute game values (golden rule); text and values come from the engine, with unrolled values left null so the UI can show placeholder pills.
- **Tier:** 3
- **Acceptance criteria:** Correct for: miss, 1 success, extra successes, step-effect spell before/after the Effect roll, static-effect spell, no-effect spell, spell with duration and extra-thread picks. Pure; no DOM; node:test coverage. Rules values come only from rules.md R1–R5.
- **Open questions:** none

### T2 — Spells tab: Target effects section replaces Active effects when casting on Other
- **What:** In `ui/ed-spells.js`, when the Cast-on toggle is Other, render a "Target effects" card (in place of Active effects) showing the engine outcome of the latest Other cast, with an empty state before any cast; unknown/unrolled values render as muted dashed placeholder pills. The latest outcome is held as session state alongside the existing cast state, so it survives toggling to This character and back and switching tabs, and is replaced by the next Other cast. When This character is selected, Active effects shows exactly as today.
- **Why:** The owner wants the cast result on another target reported where self-cast Active effects normally sit.
- **Tier:** 1 (Spells tab contents; sign-off: qa-log 2026-10-02 "TIER-1 SIGN-OFF" — Yes, sign off)
- **Acceptance criteria:** Toggle to Other shows Target effects, hides Active effects; toggle back restores Active effects with unchanged contents; a cast on Other (hit or miss) populates the outcome; the next Other cast replaces it; no stored character data changes; events up via `dispatch`/custom events, data down via props; light and dark themes; font tokens only; no vertical-scroll regression on desktop.
- **Open questions:** none

### T3 — Docs: record the new Spells tab content
- **What:** Update docs/UI-GUIDELINES.md §4 Spells row to also cover "target effects (cast on Other)"; note the behavior in ARCHITECTURE.md only if it already documents the Spells cast/active-effects flow. Add a data/changelog.json `unreleased` line.
- **Why:** Keeps the Tier-1 UI contract truthful (sign-off covers this edit).
- **Tier:** 1 (sign-off as T2)
- **Acceptance criteria:** §4 row updated with the new content; changelog entry is one user-facing line.
- **Open questions:** none
