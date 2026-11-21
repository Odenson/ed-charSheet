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

## Review and doc sync
- Dev Lead review of 14c384c: clean (matches spec/rules; engine pure; nothing stored; pricing skipped for free rows; tests untouched, verified against snapshot). No revision needed.
- Doc sync applied (all Tier 3, no sign-off needed): ARCHITECTURE.md (engine file list; §4.1 free-talents note), docs/UI-GUIDELINES.md (dated Disciplines free-talents note), plan.md status `implemented`, `shipped: unreleased`.
- Deferred / owner actions: docs/RULES-FAQ.md Q036/Q037 cross-reference (owner decisions R3, R5, R6; Call Missile entry) — file has uncommitted changes, not touched. design-agent D5 (plans/update-shadow-meld/plan.md `shipped: v1.33.0`) is unrelated; not applied.

## Owner handoff
### GUARDRAILS PR checklist
- Tier classification: all Tier 3 — pass.
- No schema/version tag change, no new stored field — pass.
- Engine pure/DOM-free, reads `freeTalents` as structured data — pass.
- UI renders model data, dispatches nothing new, computes nothing — pass.
- Placeholder rule: step-less free talents show `—` — pass.
- Theme: chip uses existing CSS variables, weights 500 — pass (visual check pending).
- Gate: `npm test` 1491 pass, 0 fail — pass.
- Taxonomy unchanged; talents.json uses existing schema; conformance test passes.

### Manual UI verification (owner, on dev)
1. Chakka > Disciplines > Archer: Call Missile in Circle 1 group with "Free" chip, rank = Circle.
2. Roll Call Missile (dice button): Perception step, Karma offered, Strain 1.
3. Info modal: "Free" chip, summary text present.
4. Edit mode: free row shows plain rank, no stepper, no price.
5. Kolon > Thief: Danger Sense Free row; Kolon v2 Warrior unaffected.
6. Combat tab > Talent / Skill picker: Call Missile / Danger Sense listed; Standard Matrix never.
7. Light and dark mode; mobile width (chip must not break the row grid); Overview fit.
