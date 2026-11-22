# Feature: skill-model (skill-model)

## Summary
The edit-mode "+ add skill" picker only offers catalog skills; the Adept creation picker also supports free-text Knowledge (…) / Artisan (…) skills in a sectioned, searchable layout. Make edit mode use the creation-style model so unlisted skills can be added from the base generic types.

## Goals / Non-goals
- Goal: edit picker gets creation-style sections, search and free-text Knowledge/Artisan rows; stored as `Knowledge (<text>)`.
- Goal: pricing stays edit-mode (Novice Rank 1 Legend + editable silver fee).
- Non-goal: Language free-text (per-language entries stay), renaming/editing existing skills, schema change, Novice-only gate (Journeyman stays learnable).

## Guardrail alignment
No Tier 1/2 surfaces: stored skill shape `{name, rank, tier}` unchanged; engine stays pure; UI in-guideline (modal kit, Escape/Enter, theme-aware). All Tier 3. Rules: rules.md R1-R4.

## Tickets
### T1 — Engine: generic/free-text skill options for learning
- **What:** Extend `engine/skill-options.js` `learnableSkills` to expose `category`, `generic`/`freeText`, skip language templates, stop listing bare generic Knowledge/Artisan as plain entries; add pure validation/naming helper (trim, 1–40 chars, no parentheses, case-insensitive duplicate refusal) reusing the creation rules (share MAX_TEXT, not duplicate).
- **Why:** Engine owns validation; UI stays dumb.
- **Tier:** 3
- **Acceptance criteria:** Knowledge/Artisan produce free-text candidates; multiple Knowledge subjects allowed; bad text/duplicates refused; tests in skill-options.test.js.
- **Open questions:** none

### T2 — Learn flow: accept free text and price as Novice
- **What:** `ed-learn-skill` carries optional `text`; `_learnSkill` in ui/ed-app.js resolves the stored name via the engine helper, uses catalog tier (Novice), same Legend/silver guards, log entry uses the full name.
- **Tier:** 3
- **Acceptance criteria:** `Knowledge (Barsaive History)` stored `{rank 1, tier Novice}`, Legend and silver deducted/logged; refusals leave state unchanged.
- **Open questions:** none

### T3 — UI: creation-style edit picker
- **What:** `_learnSkillModal` in ui/ed-disciplines.js: sections (Knowledge, Artisan, Speak/Read-Write Language, General), free-text rows with Add and Enter-in-field, search, keeping fee input and Legend/silver affordability checks; no creation pools/badges. Prefer sharing row rendering with the creation picker.
- **Tier:** 3
- **Acceptance criteria:** Escape closes, Enter activates; light/dark; fits modal rules (ui/kit); creation picker behavior unchanged.
- **Open questions:** none
