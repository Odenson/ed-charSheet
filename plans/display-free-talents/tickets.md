# Feature: Display free talents (display-free-talents)

## Summary
Disciplines award free talents (Archer: Call Missile; Thief: Danger Sense; Nethermancer: two Standard Matrix) whose rank always equals the discipline's Circle. `rules/disciplines.json` already lists them, but the sheet never shows them, so they cannot be seen or rolled. This feature derives them from rule data and shows them on the Disciplines tab and in the Combat tab talent picker. Nothing new is stored.

## Goals / Non-goals
- Goal: every discipline the character has shows its free talents, rank = that discipline's Circle, derived (never stored).
- Goal: rollable free talents (those with a step) behave like learned talents: step/dice, Karma, Strain, info modal, thread/item rank bonuses.
- Goal: rollable free talents appear in the Combat tab talent picker.
- Non-goal: editing a free talent's rank, Legend cost, or the optional "Increasing Free Talent Ranks" rule (Companion p.435).
- Non-goal: changing Circle advancement (free talents stay excluded, as today) or option slots.
- Non-goal: modelling the Nethermancer Circle 5 Enhanced Matrix; it stays a note only.
- Non-goal: adding free talents to disciplines not yet in `rules/disciplines.json`.
- Non-goal: any change to character data or schema.

## Guardrail alignment
Docs touched: ARCHITECTURE.md (engine/store/UI layers), docs/UI-GUIDELINES.md (Disciplines tab, Combat tab), docs/EFFECT-TAXONOMY.md (no change), docs/RULES-FAQ.md (Q036). All tickets are Tier 3: derived data only, no schema or taxonomy change, no stored inputs, engine stays pure, UI renders model data and dispatches events only. No Tier 1 sign-off needed. The UI must keep the Tier 1 rules intact (placeholder pills for unknown steps, theme-aware, no new modal-less patterns).

## Tickets
### T1 — Derive free talents (engine)
- **What:** A pure, DOM-free function that, from a discipline's rule entry and its Circle, returns its free-talent rows (name, rank = Circle, `free: true`, source discipline). Duplicate names are kept as separate rows (two Standard Matrix). A free talent is suppressed when the character already stores a talent of the same name in the same discipline. Reads `freeTalents` as structured data.
- **Why:** Rank = Circle is a rule, so it is derived, not stored (ARCHITECTURE §4.1).
- **Tier:** 3
- **Acceptance criteria:** Archer Circle N gives Call Missile at rank N; Nethermancer gives two Standard Matrix; Thief gives Danger Sense; second discipline uses its own Circle; same-discipline stored copy suppresses the row; no change to `circleStatus` or `countableTalents` results.
- **Open questions:** none

### T2 — Free talents in the store model
- **What:** Add free rows into each discipline's model talents with the same derived fields as learned rows (attribute, step, dice, karma, strain, brief, detail, rank-grant folding), plus `free: true` and read-only rank. Non-rollable ones (no attribute/step, e.g. Standard Matrix) carry no step and no roll.
- **Why:** One model row shape lets every surface (Disciplines, Combat, roll log) treat free talents like any talent.
- **Tier:** 3
- **Acceptance criteria:** Free rows carry a step only when the catalog gives an attribute; Karma only when a step exists; thread/item rank bonuses fold as for learned talents; no free row is editable or costs Legend; Legend-spent audit and advancement gate unchanged.
- **Open questions:** none

### T3 — Disciplines tab: Free rows
- **What:** Render free rows in the Circle 1 group with a small "Free" chip and a read-only rank (no edit/remove). Rollable ones get the same roll button as learned talents; Standard Matrix rows show no roll. Info modal works as for learned talents.
- **Why:** Reintroduce the missing talents where the user expects them.
- **Tier:** 3 (stays inside UI-GUIDELINES; model-driven render only)
- **Acceptance criteria:** Chakka's Archer shows Call Missile at his Circle with a Free chip; a Nethermancer shows two Standard Matrix rows; light and dark mode correct; no layout overflow on mobile.
- **Open questions:** none

### T4 — Combat tab talent picker
- **What:** Include rollable free talents in the Combat "Use" talent/skill picker. Dedupe by name across disciplines and learned talents, using the highest rank. Non-rollable free talents never appear.
- **Why:** The user must be able to roll Call Missile and Danger Sense in combat.
- **Tier:** 3
- **Acceptance criteria:** Chakka can pick Call Missile and roll it with its step, Karma and Strain; a duplicate name appears once at the highest rank; Standard Matrix never appears.
- **Open questions:** none

### T5 — Catalog check for free talents
- **What:** Verify `rules/talents.json` has what the rows need for Call Missile, Danger Sense and Standard Matrix (attribute, action, strain, short effect, paraphrased summary). Fill gaps with data that fits the existing schema (Call Missile currently has only action and attribute).
- **Why:** Rows should show a useful effect line and info modal.
- **Tier:** 3 (data within schema/taxonomy; paraphrase, no verbatim rulebook prose)
- **Acceptance criteria:** Each free talent has a brief and detail; `tools/rules-conformance.test.js` passes.
- **Open questions:** none

### T6 — Tests and docs
- **What:** Engine and store tests for T1 and T2, a picker test for T4; update the design docs (UI-GUIDELINES Disciplines and Combat sections, RULES-FAQ cross-reference) to describe free rows. Doc edits to protected docs are proposed for the owner to apply.
- **Why:** Keep docs truthful to the code.
- **Tier:** 3
- **Acceptance criteria:** `npm test` passes; docs describe free rows and the Combat inclusion.
- **Open questions:** none
