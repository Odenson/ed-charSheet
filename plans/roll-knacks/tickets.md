# Feature: Roll knacks (roll-knacks)

## Summary
A knack row today has no roll button: only its parent talent rolls, so the roll log and Discord message can never name the knack. This adds a roll button to knack rows whose label is the knack's name, rolled at the knack's own step (parent rank + the knack's attribute), Karma-eligible and mod-aware like the parent. The same change makes rolling a talent or knack automatically charge its Strain to Health (previously missed) and report it in the modal, log and Discord.

## Goals / Non-goals
- Goal: roll a knack from its row; log + Discord show the knack name.
- Goal: knack step = knack's own `Rank+ATTR` formula using the governing talent's (or skill's) Rank (R1).
- Goal: Karma eligibility and parent-talent roll mods carry to the knack roll (R2, R5 owner rulings).
- Goal: Strain (knack's printed Strain replaces the parent's) charged to Health at roll commit for talent and knack rolls; shown in modal hint, log entry and Discord (R3, R6, R7).
- Non-goal: knacks with step N/A / null (Special Maneuver, crafting, etc.) get no roll button (R4).
- Non-goal: authoring missing `strain` values for the ~400 talents without data; no data means no charge (owner decision).
- Non-goal: Combined knacks, Battle Rites Strain reduction, Blood Magic damage Strain.
- Non-goal: changing Combat-tab roll paths or the already-working aim/set-dice Strain charge (must not double charge).

## Guardrail alignment
Touches ui/ed-disciplines.js, ui/ed-app.js, ui/ed-roll-modal.js, store.js / engine (derived knack step, report shape), engine/discord-roll.js, store-log.js, rules/knacks.json. Data flows down through render; the button dispatches `ed-roll`; the engine derives the step (UI computes nothing). No schema shape, taxonomy, or UI-guideline change. All tickets Tier 3; no Tier-1 sign-off needed. Existing placeholder-pill behavior unchanged (no step => no button, never an invented number). Roll button must work in light and dark and keep modal Escape/Enter behavior.

## Tickets
### T1 — Derive a knack's roll step in the model
- **What:** For each resolved knack with a "Rank+ATTR" step, derive `step` (+ `dice`) in the model from the governing talent's (or, for skill-learned knacks, the skill's) Rank plus the character's attribute step; null for N/A/null steps. Expose the knack's plain-number `strain` and Karma context (inherited from parent talent) and parent roll mods.
- **Why:** The UI must not compute game values; rows need a model-provided step (R1, R4).
- **Tier:** 3
- **Acceptance criteria:** Lip Reading (Rank+PER, parent Awareness rank 4) yields Awareness rank + PER step; N/A and null-step knacks yield null; a knack with a different attribute than its parent uses its own; skill-learned knack uses the skill rank; tests cover each.
- **Open questions:** none

### T2 — Roll button on knack rows
- **What:** `_knackRow` gains a roll button (existing `.roll` style) for knacks with a step; click dispatches `ed-roll` with label = knack name, the knack's step, parent's Karma context and mods. Also appears under skills when the `knackParents` lever is on.
- **Why:** Core request: roll the knack, log/Discord show the knack name.
- **Tier:** 3
- **Acceptance criteria:** Button present only when step != null; label is the knack name (e.g. "Lip Reading") in the roll modal, log and Discord (plain + embed); Karma offered as for the parent; parent roll mods applied; keyboard/aria label "Roll <knack>".
- **Open questions:** none

### T3 — Auto-charge Strain on talent and knack rolls
- **What:** Disciplines-tab talent and knack rolls pass their Strain to the roll config; the roll modal charges it to Health at roll commit via the existing `ed-strain` path (Escape before rolling costs nothing for aim/set-dice rolls only; ordinary auto-rolled modals charge when they open, once per roll — owner accepted 2026-11-15). Knack Strain replaces the parent's. No `strain` data (null) => no charge. Arms/aim talents keep their existing path (no double charge).
- **Why:** Owner: Strain was missed for talent rolls; knack rolls need it too (R3, R6, R7, R9).
- **Tier:** 3
- **Acceptance criteria:** Rolling a Strain-1 talent adds 1 Health damage once at commit; Strain 0 / null charges nothing; modal shows "N Strain on roll" hint; Strain applies as full unmodified damage (no Wound check, as the existing `applyHealth` damage path); Karma toggles don't re-charge; Mystic Aim not double charged.
- **Open questions:** none (resolved: ordinary modals charge on open, owner-accepted).

### T4 — Report Strain in log and Discord
- **What:** Add the Strain charged to the roll report: log entry, Discord plain and embed formatters (engine/discord-roll.js), with escaping and length caps intact.
- **Why:** Owner decision: the table sees the cost.
- **Tier:** 3
- **Acceptance criteria:** Strain line appears only when > 0; existing discord tests still pass; new tests cover plain + embed.
- **Open questions:** none

### T5 — Normalize rollable knack Strain to plain numbers
- **What:** rules/knacks.json: Swinging Move "0+ (see text)" -> "0"; Take the Hit "2+ (Special)" -> "2". Non-rollable knacks (N/A step) keep their strings and are never charged.
- **Why:** Owner ruling (R8): strain is a plain number on rollable knacks.
- **Tier:** 3 (fits the existing schema)
- **Acceptance criteria:** every knack with step "Rank+ATTR" has a plain-number strain; conformance test passes; extra-Strain text remains in the summary.
- **Open questions:** none
