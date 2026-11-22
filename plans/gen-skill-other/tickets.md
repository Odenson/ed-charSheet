# Feature: Custom skills and picker filters (gen-skill-other)

## Summary
Owners can create their own Knowledge, Artisan and General skills (name, attribute, optional description; General also picks tier). They are saved to a shared custom-skills rules file, mirroring custom items, and appear in the skill pickers tagged Custom for every character. Both skill pickers (edit-mode learn picker and Adept creation picker) gain category filter chips. Creating custom skills is switched by a homebrew rule, on for now. Characters keep storing only the skill name.

## Goals / Non-goals
- Goal: filter chips All / Knowledge / Artisan / Speak Language / Read/Write Language / General / Custom in both pickers.
- Goal: "Create custom skill" per Knowledge/Artisan/General section; form = name, attribute (Knowledge/Artisan prefilled editable default), optional description, tier (General only: Novice/Journeyman; others Novice).
- Goal: custom skills live in their own file (`data/custom-skills.json` folded to `rules/custom-skills.json`), shared across characters, resolved like catalog skills (description, attribute shown on the sheet), clearly marked Custom.
- Goal: gated by a homebrew boolean `set` rule, shipped enabled.
- Non-goal: edit/delete of custom skills (follow-up); change to the stored character skill shape `{name, rank, tier}`; Language free-text; removal of the existing Knowledge (…)/Artisan (…) quick-add rows.

## Guardrail alignment
Docs: GUARDRAILS, UI-GUIDELINES (modals: ui/kit, Escape/Enter, theme), HOMEBREW-RULES, GITHUB-SERVERLESS-SAVE, ARCHITECTURE. Character data shape unchanged, taxonomy untouched, engine stays pure. The new `rules/custom-skills.json` reuses the existing `ed-skills/1` shape (new data file within the schema, per the custom-items precedent). The homebrew toggle is a new boolean `set` registry target (code + doc), not a change to the `ed-homebrew/3` file shape. All tickets Tier 3; no Tier 1 sign-off needed. Owner earlier declined a Tier 1 schema change (qa-log). Worker change requires an owner redeploy.

## Tickets
### T1 — Engine/store: custom skill catalog and validator
- **What:** Pure validator for a custom skill (name unique vs core and custom case-insensitively, attribute exists in attributes.json, tier, description length, kind in knowledge/artisan/general). Load `rules/custom-skills.json` optionally and merge into the skill catalog used by `makeSkillRef`, `learnableSkills` and the creation candidates; each custom entry carries `custom: true`. Core rulebook entries are never overridden (collision refused).
- **Why:** Custom skills must resolve like any catalog skill (description, attribute, step) with no change to stored character data.
- **Tier:** 3
- **Acceptance criteria:** Custom skill resolves to its own description/attribute; absent file = behavior unchanged; validator tests (duplicate, bad attribute, empty name, tier).
- **Open questions:** none

### T2 — Persistence: shared custom-skills file
- **What:** `/save-skills` worker route, `data/custom-skills.json` on character-data, CI fold into `rules/custom-skills.json`, client `store-custom-skills.js` with local overlay (mirror custom items).
- **Why:** Share custom skills across characters and devices.
- **Tier:** 3 (worker redeploy by owner)
- **Acceptance criteria:** Save merges and re-validates server side; overlay shows a created skill immediately; docs updated.
- **Open questions:** none

### T3 — Homebrew toggle
- **What:** Boolean `set` target (e.g. `skills.allowCustom`) in the homebrew registry; new rule in `rules/homebrew.json` with `enabled: true`; HOMEBREW-RULES doc updated. When off, no Create actions show; existing custom skills still resolve.
- **Why:** Owner wants custom skill creation switchable as a house rule.
- **Tier:** 3
- **Acceptance criteria:** Toggle off hides Create; on shows it; tests in homebrew tests.
- **Open questions:** none

### T4 — UI: category filter chips in both pickers
- **What:** Chip row (All, Knowledge, Artisan, Speak Language, Read/Write Language, General, Custom) in the learn picker and creation picker; combines with search; Custom chip lists only custom skills.
- **Why:** Quick filtering of a long skill list.
- **Tier:** 3
- **Acceptance criteria:** Chips filter sections, keyboard accessible, theme-aware, modal kit rules kept.
- **Open questions:** none

### T5 — UI: Create custom skill form
- **What:** Per-section Create action (Knowledge, Artisan, General) opening a modal form: name, attribute select, optional description, tier (General only). Saves via T2, then the skill is selectable. Shown only when T3 enabled.
- **Why:** Let owners add unlisted skills with their own description and attribute.
- **Tier:** 3
- **Acceptance criteria:** Escape closes, Enter confirms; validation messages; light/dark; creation and learn pickers both offer it.
- **Open questions:** none

### T6 — Custom badge and sheet display
- **What:** Custom skills carry a Custom pill in pickers and on the skills list; description and attribute show as for catalog skills.
- **Why:** Distinguish core rulebook skills from custom ones.
- **Tier:** 3
- **Acceptance criteria:** Badge visible in light/dark; no fabricated values.
- **Open questions:** none
