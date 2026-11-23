# Brief: Custom skills and picker filters (gen-skill-other)
## What & why
Owners create their own Knowledge/Artisan/General skills (name, attribute, optional description, General picks tier). They live in a shared custom-skills file (mirror custom items) and show in both skill pickers tagged Custom. Both pickers gain category filter chips. Creation is gated by a homebrew boolean `set` rule (on for now). Character stored skill shape `{name, rank, tier}` must NOT change.
## Tickets & tiers
- T1 Engine/store custom catalog + validator — Tier 3 — n/a
- T2 Persistence (/save-skills, data file, fold, overlay) — Tier 3 — n/a (owner redeploys worker)
- T3 Homebrew toggle — Tier 3 — n/a
- T4 Filter chips in both pickers — Tier 3 — n/a
- T5 Create custom skill form — Tier 3 — n/a
- T6 Custom badge/sheet display — Tier 3 — n/a
## Items
- I1 — validator — engine/validate-skill.js (+test) — T1 — R1,R3,R4
- I2 — catalog load/merge + `custom` flag — store.js (loadCustomSkills, mergeSkillCatalog, deriveModel, creationContext), ui/ed-app.js l.1674, engine/skill-options.js, engine/creation.js, rules/custom-skills.json — T1,T6 — R3
- I3 — client overlay/save — store-custom-skills.js, ui/ed-app.js — T2
- I4 — worker route + dev-server — tools/worker/worker.js, wrangler.toml, tools/dev-server.mjs, scripts/sync-local-data.sh, .gitignore — T2
- I5 — CI fold — tools/fold-custom-skills.mjs, .github/workflows/fold-custom-skills.yml — T2
- I6 — homebrew `skills.allowCustom` — store.js HOMEBREW_SET_TARGETS, rules/homebrew.json, docs/HOMEBREW-RULES.md — T3 — R4
- I7 — filter chips — ui/skill-filter.js, ui/ed-disciplines.js (_learnSkillModal, _creationSkillModal) — T4
- I8 — create form — ui/ed-custom-skill.js (+state), ui/ed-disciplines.js, ui/ed-app.js — T5 — R1,R2,R4
- I9 — Custom badge — ui/ed-disciplines.js (_skillRow, _skillModal, pickers) — T6 — R3
- I10 — docs — GITHUB-SERVERLESS-SAVE(+RUNBOOK), HOMEBREW-RULES, ARCHITECTURE, WORKFLOW, README — T2,T3
## Rules
- R1 (Q043,Q044) — Knowledge/Artisan Novice, Strain 0, default attr PER/CHA (prefill from generic template entry in data), GM approves — FAQ-HIT.
- R2 (Q045,Q043) — tier prints per skill; costs from rules/legend.json; creation only Novice — ANSWERED.
- R3 (Q045) — Step = Rank + attribute Step — ANSWERED.
- R4 — book silent on custom General tier/attribute — Decision (owner house rule 2026-11-22): General gets owner-chosen attribute and Novice/Journeyman tier; Knowledge/Artisan Novice with editable default attribute; gated by homebrew rule.
## Owner decisions
- 2026-11-22: declined stored-shape change; custom skills = shared rules file, catalog entries, tagged Custom.
- 2026-11-22: attribute (not talent) association.
- 2026-11-22: persistence mirrors custom items (/save-skills, data/custom-skills.json, CI fold to rules/custom-skills.json); owner redeploys worker.
- 2026-11-22: keep Knowledge (...)/Artisan (...) quick rows; add per-section Create action; chips in both pickers incl. Custom.
- 2026-11-22: create only; edit/delete is a follow-up.
- 2026-11-22: homebrew boolean `set` target, rule enabled: true.
## Constraints & gotchas
- Merge the catalog with a pure `mergeSkillCatalog` at store.js `deriveModel`, `creationContext` and ed-app.js l.1674; `makeSkillRef` signature unchanged; core wins on name collision.
- Custom names: <=40 chars, no parentheses (matches skill-options.js resolveSkillName), unique vs core+custom case-insensitive.
- Custom entries carry `custom: true`, no `action`/`versus`/`effects`; no description => no fabricated text.
- rules/custom-skills.json: schema `ed-skills/1`; tools/rules-conformance.test.js enumerates all rules/*.json.
- Creation already excludes General tier !== 1 (engine/creation.js l.398).
- Toggle is strict `=== true` (precedent advancement.optionalTable); it gates UI only, worker does not read homebrew.
- Worker must always check attribute + core collision (bundle rules/attributes.json + skills.json, or generated lists with a matching test); fold drops/reports invalid entries and folds the rest.
- mergeSkillCatalog with no custom file returns identical core elements; add `custom` only when true (existing tests deepEqual catalogs).
- I2 and I8 each ship as two sub-deliveries; I7/I8b/I9 need owner-manual light/dark UI check.
- I6 also updates rules/homebrew.json `source` prose and any registry/rule-count test assertions.
- Fold workflow must exist on `character-data` for the push trigger (same as custom items).
- Modals: use ui/kit modalFrame; Escape closes only the top modal; Enter confirms (not in textarea); theme tokens, light/dark.
