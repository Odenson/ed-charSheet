# Feature: Update Health overview (update-health-overview)

## Summary
Redraw the Overview tab's Health card ("Version 1" mock-up). Damage and Wounds —
the two character-affected inputs — become highlighted rows above a divider; the
four stats (Unconscious, Death, Wound Threshold, Recoveries) sit below as a plain
list. The Damage row carries an inline gauge (fill = Damage out of Death, tick at
Unconscious). The card stays muted while there is no danger; colour appears only
on the Damage number/gauge fill (amber within 10 of Unconscious, red at/past
Unconscious) and the Wounds number (red at 1+). Interaction moves with it: in read
mode clicking Damage opens a shared damage-only modal; the ✚ button and its
free-entry Heal/Used modal are removed; healing happens only through a Recovery
test via a ⚄ button on the Recoveries row (as on the Combat tab). In edit mode the
rows are direct number fields and no modal opens.

## Goals / Non-goals
- Goal: V1 visual design on the Overview Health card, same card footprint (no new vertical growth), light and dark themes.
- Goal: danger colouring driven by an engine-computed classification, not UI maths.
- Goal: read-mode Damage click opens a damage-only modal shared with the Combat tab; wound/knockdown resolved per the engine rules.
- Goal: ⚄ Recovery test on the Recoveries row; remove ✚, free-entry Heal, and "Recovery tests used" entry in read mode.
- Non-goal: changing Wound/Knockdown/Recovery rules, taxonomy, character data or schema.
- Non-goal: redesigning the Combat tab (its Damage taken card only adopts the shared modal).
- Non-goal: Heal-by-number anywhere (healing is Recovery test only).

## Guardrail alignment
Touches ui/ed-overview.js, ui/ed-combat.js, a new shared UI modal component,
engine/health.js (+ tests), docs/UI-GUIDELINES.md, docs/MODALS.md (if the shared
modal needs a mention), changelog. No rules/*.json, no schema, no taxonomy.
Tier 1 rules kept intact: Overview fits the viewport with no vertical scroll;
two font weights only (mock used 600 — implementation uses 500); size tokens only
(no raw rem); derived values stay placeholder pills when ratings are missing (the
gauge shows a dashed placeholder, never a fabricated bar); data-down/dispatch-up
with the engine deciding wounds/knockdown/danger; both themes via light-dark();
modals follow Escape-closes / Enter-confirms (shared modal-controller). No Tier-1
change needs sign-off.

## Tickets
### T1 — Engine: Damage/Wounds danger classification
- **What:** Add a pure function to `engine/health.js` returning, from damage, wounds and the Unconscious/Death ratings: the Damage danger level (`none` | `warn` | `bad`), the gauge fill fraction (damage / Death, clamped 0–1) and the Unconscious tick fraction (Unconscious / Death), and the Wounds level (`bad` at ≥1). Warn when damage ≥ Unconscious − 10 and < Unconscious; bad when ≥ Unconscious (including dead). Null/placeholder result when a rating is missing. Wire it into the model like `healthState`.
- **Why:** UI must not compute game values; the owner set the amber rule (within 10 of Unconscious).
- **Tier:** 3
- **Acceptance criteria:** Unit tests cover calm (3/58/72), warn boundary (48 warn, 47 none), bad at 58 and past Death (fill clamped to 1), missing ratings → null, wounds 0 vs 1+. Function is pure, DOM-free; no mutation.
- **Open questions:** None.

### T2 — Overview Health card redraw (V1)
- **What:** Replace the Health block markup/styles in `ui/ed-overview.js` with the V1 layout: Damage and Wounds highlighted rows (neutral chip background, no left accent bar), Damage row with inline gauge and tick, divider, four stat lines. Number and gauge fill take amber/red from T1's classification, neutral otherwise (light-dark colour tokens). Weight 500 max, `--fs-*` tokens only. Header keeps the HEALTH label, state chip and reset-day button. Gauge shows a dashed placeholder pill when ratings are missing. Edit mode: the Damage and Wounds rows (and Recoveries used) show direct number fields as today; no gauge interaction required.
- **Why:** Give the two character inputs visual priority over derived stats without adding alarm colour when there is no risk.
- **Tier:** 3 (within UI-GUIDELINES)
- **Acceptance criteria:** Matches the approved V1 mock in calm and risk states in dark and light themes; card height unchanged and Overview still fits the desktop viewport; mobile single-column fold works; placeholder rule honoured; no raw rem/px font sizes.
- **Open questions:** None.

### T3 — Shared take-damage modal (Overview + Combat)
- **What:** Extract the damage-only modal (damage amount, Apply) into one shared component used by the Overview Damage row and the Combat tab's Damage taken card. It applies the hit through the existing engine helpers: `applyHealth`, `woundsFromHit`, and, when `knockdownTriggered`, dispatches the Knockdown roll with `knockdownDifficulty` and the `knockdown-result` apply action — the same behaviour as Combat's current `_applyDamage`. Uses the shared `ui/modal-controller.js` (Escape closes, Enter applies, focus contract) per docs/MODALS.md. Combat is refactored onto it with no behaviour change.
- **Why:** One damage entry path so wound/knockdown behaviour cannot drift between tabs (owner decision).
- **Tier:** 3
- **Acceptance criteria:** Overview Damage click (read mode) opens it; a hit ≥ Wound Threshold adds one Wound and a hit ≥ Threshold+5 starts the Knockdown test; Combat's existing tests/behaviour unchanged; Escape/backdrop/✕ close, Enter applies; theme-aware, two weights.
- **Open questions:** Plural "wound(s)": the app's rule is one Wound per hit; the rules brief (rules.md) confirms or flags a difference.

### T4 — Recoveries ⚄ roll button; remove ✚ and free-entry health modal
- **What:** In read mode add a ⚄ Recovery test button to the Overview Recoveries row, behaving exactly like Combat's (`_recoveryTest`: Toughness step, `recovery-heal` apply, disabled at 0 left, armed-potion boost shown). Remove the ✚ header button and the old Overview health modal (free-entry Take damage / Heal / Recovery tests used). Edit mode: no ⚄, no modals; direct number fields remain. Remove dead code and now-unused styles.
- **Why:** Healing must come from a Recovery test, not typed numbers (owner decision).
- **Tier:** 3
- **Acceptance criteria:** ⚄ opens the roll modal with the heal apply context and uses one Recovery on apply; disabled with explanatory title at 0 remaining; no ✚ or free-entry Heal remains in read mode; edit mode unchanged otherwise; no orphaned CSS/handlers.
- **Open questions:** None.

### T5 — Tests, docs, changelog
- **What:** Update docs/UI-GUIDELINES.md (Overview Health description: highlighted rows, gauge, colour rule, click-to-damage, ⚄ recovery, no free-entry heal) and docs/MODALS.md if it lists the damage modal; add the unreleased changelog line; add/adjust tests for T1 and any modal/state logic that is unit-testable.
- **Why:** Docs must match code (CLAUDE.md source-of-truth rule).
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes; docs describe shipped behaviour; changelog has an unreleased line.
- **Open questions:** None.
