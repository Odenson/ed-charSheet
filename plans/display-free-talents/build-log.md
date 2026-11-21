# Build log: display-free-talents

## Run 1 — 2026-11-21 (since 2026-11-21T04:21:31Z)

### Alignment (Phase 0)
- Guardrails: I1-I7 all Tier 3; no Tier-1/2 item; no sign-off needed.
- Rules: R1-R7 present with sources; R3 and R6 (NOT-COVERED) carry owner decisions (2026-11-21); R5 owner decision recorded.
- Open questions: none (the "Free chip beside required i marker" default stands; knack-parent and homebrew `talent|` gaps are recorded non-goals). review.md findings F1-F5 all addressed in plan.md.
- Tree: `docs/RULES-FAQ.md` has uncommitted owner/rule-agent changes (NOT staged, NOT touched by the build). `plans/display-free-talents/` untracked (planning artifacts). Local `dev` not behind `origin/dev`.
- Outcome: aligned, proceeding.

## Build run — 2026-11-21
- Added engine/free-talents.js (`freeTalentRows`); store.js `buildTalentRow` shared by learned and free rows, free rows appended last with `free: true`, `pricing: null` in the pricing pass.
- rules/talents.json Call Missile completed from R7 (strain 1, skillUse not allowed, shortEffect, own-words summary).
- ui/ed-disciplines.js: Free chip (`.fchip`), read-only rank on free rows in edit mode, modal Free chip replacing Required, legend entry.
- Changelog line added to data/changelog.json unreleased.
- Consumer audit: `_allActions` unchanged (dedupes by highest step); `_talentResultMods` unchanged (resultMods fold by name, identical across same-name rows; tested by tester). attackTalents, knack options, ed-spells/ed-app lookups acceptable per spec. Known gaps unchanged.
- Gate: `npm test` green (1491 pass, 0 fail). No test disputes.
- I7 proposed doc text (protected docs not edited):
  - UI-GUIDELINES (Disciplines tab): "Free talents (derived, `free: true`) show a Free chip beside the name and a read-only rank; no stepper or remove control in edit mode."
  - ARCHITECTURE: "engine/free-talents.js derives free-talent model rows from rules/disciplines.json freeTalents at rank = Circle; appended after learned rows, pricing null; nothing stored."
  - RULES-FAQ: record owner decisions R3, R5, R6 (Q036) and Call Missile entry (Q037).
