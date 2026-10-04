# Feature: New-Combat-UI (new-combat-ui)

## Summary
Restyle and re-lay-out the Combat tab to the owner-approved "Option A" design
(high-fidelity prototype: [design-option-a.html](design-option-a.html), open in a
browser; built from the app's real tokens and type scale). The tab today is eight
bordered cards, with chip sections nested inside a card. The new layout keeps
Your attack, Damage taken and Potions as their own cards, floats Defence / Armour /
Initiative / Available Karma as plain text above them, folds the three chip
sections into one tabbed segmented control, and shows the Combat log as a
flat full-width table. Every existing element and behaviour is kept; this is a
view-only change.

## Goals / Non-goals
- Goal: all current Combat-tab elements survive (weapon image, weapon + talent pickers, Initiative + roll + last result, Attack/Damage/Strain stat-lines with ⓘ audits, target `#`, `succ` field, damage-bonus badge, range, Defence/Armour with delta badges, Damage taken card incl. status pill / Stand-up bar / thresholds / recoveries / ✗ ⚄ ☼ buttons, Potions card incl. pending pill, Combat modifiers, Combat log with clear, all modals).
- Goal: add **Available Karma** to the header, exactly as the Spells tab does (reads `model.characteristics.karma.available`).
- Goal: light + dark mode, tokens only (`--fs-*`), two weights, Escape/Enter modal contract unchanged.
- Non-goal: any change to the engine, store, data, schema or effect taxonomy.
- Non-goal: any change to dispatch events, roll flows, or what is rolled / computed.
- Non-goal: other tabs, the roll modal, or the Notes-tab Log (they share the same log store; only the Combat view of it changes).

## Guardrail alignment
Touches `ui/ed-combat.js` (Tier 1 UI surface) and `docs/UI-GUIDELINES.md` §4
(Combat row). Architecture golden rule stays intact: the view only renders
model/props and dispatches events up; no game value is computed in the UI and
no state is stored. The Combat-tab contract change is covered by the owner's
Tier-1 sign-off (qa-log entry 1, 2026-10-04). Re-check "Before finishing" in
GUARDRAILS.md (placeholder pills, light/dark, modals, relative paths).

## Tickets

### T1 — Floating header line (Defence · Armour · Initiative · Karma)
- **What:** Remove the Defence & Armour card and the Initiative control from the attack-card header. Render one plain-text line (no card, no border) above everything: Defence `PD · MD · SD` with the existing toggled-mod delta badges (`foldCombatRatings`, spell defence/armour mods pulled out as today), Armour `Phys · Myst`, Initiative value + ⚄ roll + last-roll result, and at the right end an "Available Karma N" pill styled as the Spells tab `kchip` (hidden when `karma.available` is null; shows 0 when 0; static, no max, no click).
- **Why:** Combat-critical numbers at eye level without nesting cards; Karma matters in combat.
- **Tier:** 1 (sign-off: qa-log entries 1 and 5)
- **Acceptance criteria:** Defence/Armour/Initiative render identically in value and badge logic to today; unknown values remain dashed placeholder pills; the Defence & Armour collapse control is gone; Karma pill matches Spells and updates when the model's Karma changes; the Initiative roll still dispatches and its last result still shows.
- **Open questions:** none

### T2 — Attack and Damage taken as side-by-side cards
- **What:** Keep "Your attack" card (art box, weapon + talent pickers, Attack and Damage/Strain stat-lines, ⓘ audits, `vs #`, `succ` field, bonus badge, range) with the Initiative control moved out to the header line. Damage taken card (status pill, Stand-up bar, current / wounds, thresholds, recoveries, ✗ ⚄ ☼) sits beside it as a card, replacing the right-hand rail.
- **Why:** Health stays next to the attack while rolling; both are the owner's named must-keep sections.
- **Tier:** 1 (sign-off: qa-log entry 1)
- **Acceptance criteria:** Same contents and behaviour as today; the two cards stretch to equal height with the Damage taken buttons pinned to the bottom; all existing dispatches and modals unchanged.
- **Open questions:** none

### T3 — Combat modifiers as a segmented control
- **What:** Replace the Combat Modifiers group (three collapsible sections in one card) with a card-less block: eyebrow label, a segmented control (Combat options · Situational · Blood charms) with an active-count badge per segment, and the selected segment's chips. Chips keep all current states, badges and behaviours (locked, spent, aimed, charm, karma/strain/atk badges). All three segments are always visible; an empty segment shows the existing empty message. Selected segment starts on Combat options and is remembered per character in the session scratchpad (reset on reload and on day reset); the old section collapse state is removed.
- **Why:** Cuts height and nested boxes; hidden chips are still discoverable via count badges.
- **Tier:** 1 (sign-off: qa-log entries 1, 2 and 6)
- **Acceptance criteria:** All chip toggling/arming/locking behaviour is unchanged; counts update live; selecting a segment doesn't clear or alter any chip; keyboard-operable segment buttons with `aria-pressed`; selected segment survives switching tabs within the session and resets as stated.
- **Open questions:** none

### T4 — Potions card on its own row
- **What:** Potions stays its own card (picker, Drink, pending dashed pill, empty hint, drink confirm modal), placed beside the modifiers block on its own row.
- **Why:** Owner wants Potions kept as its own section for now.
- **Tier:** 1 (sign-off: qa-log entry 1)
- **Acceptance criteria:** Behaviour and modal unchanged; layout as in the prototype.
- **Open questions:** none

### T5 — Combat log as a full-width table
- **What:** Replace the right-hand log card with a flat table under a "Combat log" eyebrow with the clear button. Columns: glyph · Roll · Step · Total · vs · Outcome · Detail. Roll rows fill all columns they have (Step, Total, vs difficulty, Hit/Miss outcome, modifier labels); system / log / advancement rows put label in Roll and the detail + Legend / silver / coin in Detail; action rows (e.g. Stand up) show "—" in numeric columns; no fabricated numbers. Empty state message kept; clear confirm modal unchanged.
- **Why:** The owner wants the log as a clear table; nothing the current log shows is lost.
- **Tier:** 1 (sign-off: qa-log entries 1 and 3)
- **Acceptance criteria:** Every field the current `_logRow` renders appears in exactly one column; the Combat tab and Notes-tab Log still read the same store; newest-first order unchanged.
- **Open questions:** none

### T6 — Narrow-screen fold (≤720px)
- **What:** At the existing 720px breakpoint: header line wraps with Defence, Armour, Initiative, Karma kept together; sections stack Attack, Damage taken, Modifiers, Potions, Log; the log table folds into two-line stacked rows (line 1 glyph/Roll/Step/Total/vs/Outcome, line 2 muted Detail), still capped at 320px with internal scroll; segments share the row and wrap. No horizontal overflow.
- **Why:** UI-GUIDELINES §2.
- **Tier:** 1 (sign-off: qa-log entries 1 and 4)
- **Acceptance criteria:** No horizontal scroll at 375px; all controls reachable and ≥ tap-usable.
- **Open questions:** none

### T7 — Docs and tests
- **What:** Update the Combat row of `docs/UI-GUIDELINES.md` §4 (and any other doc statement that describes the old layout, e.g. the Combat-tab plan docs if they claim current layout) to the new design; update/extend the Combat tab tests that assert layout/structure.
- **Why:** Code and docs must agree (CLAUDE.md); layout assertions must follow the new design.
- **Tier:** 1 (guideline text; sign-off: qa-log entry 1)
- **Acceptance criteria:** UI-GUIDELINES §4 describes the new Combat tab accurately; `npm test` passes.
- **Open questions:** none
