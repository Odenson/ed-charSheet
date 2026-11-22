# Brief: Skill model (skill-model)
## What & why
Edit-mode "+ add skill" picker only lists catalog skills. Make it creation-style (sections, search, free-text Knowledge/Artisan rows stored as `Knowledge (<text>)`) while keeping edit-mode pricing (Novice Rank 1 Legend + editable silver fee). Schema unchanged.
## Tickets & tiers
- T1 Engine: free-text/generic options + validation helper — Tier 3 — n/a
- T2 Learn flow accepts text, prices as Novice — Tier 3 — n/a
- T3 Creation-style edit picker UI — Tier 3 — n/a
## Items
- I1 — `resolveSkillName(entry, text, existing)` (generic/language gate, name composition, text + case-insensitive duplicate validation); export MAX_TEXT, isLanguage — engine/skill-options.js, engine/creation.js (imports it) — T1 — R1, R3, R4
- I2 — learnableSkills exposes category/generic/freeText, skips language templates, dedupes, case-insensitive known filter (skipped only for generics) — engine/skill-options.js(+test), store.js:1683 — T1 — R2, R3, R4
- I3 — pure `learnSkillPlan` (mandatory, tested) + thin `_learnSkill`, `text` in `ed-learn-skill` — engine/skill-options.js, ui/ed-app.js, ui/ed-disciplines.js `_learnSkillPick` — T2 — R1, R2
- I4 — sectioned picker UI + manual checklist — ui/ed-disciplines.js `_learnSkillModal` (share rows with `_creationTextRow`) — T3 — R3
- I5 — tests/docs — npm test, UI-kit check — T1-T3 — none
## Rules
- R1 — subject player-named, GM-approved (not tracked) — no Decision
- R2 — Knowledge/Artisan Novice; Rank 1 = 200 LP Novice / 300 Journeyman, 10 sp — no Decision
- R3 — languages per-language catalog entries, no free text — no Decision
- R4 — multiple Knowledge skills allowed, no cap — no Decision
## Owner decisions
- 2026-11-22 full creation-style picker (sections, free-text, search), edit-mode Legend+silver, no pools.
- 2026-11-22 free-text priced as Novice Rank 1 + editable silver (costs.skillTraining[1]).
- 2026-11-22 Journeyman General skills stay learnable.
- 2026-11-22 non-goals: Language free-text, rename/edit skills, schema change.
## Constraints & gotchas
- Helper lives in skill-options.js (no imports); creation.js imports it; no cycle. Remove creation.js private `isLanguage` (:309) and `MAX_TEXT` (:416).
- Duplicate checks must be case-insensitive everywhere (`_learnSkill` currently exact-match at ed-app.js:1669; store.js:1685 known Set).
- Catalog lists Bribery/Skinning twice; dedupe. Free-text rows are not hidden by `known`; ordinary/per-language known names are.
- `_canAffordRank` is UI-side; keep behavior identical when moving guards into `learnSkillPlan`.
- `makeSkillRef` already resolves `Knowledge (X)` (store-creation-audit.test.js:468).
- Creation picker must not change; modals via ui/kit, Escape/Enter, theme-aware.
