# Feature: Taxonomy on action type (taxonomy-on-action-type)

## Summary
Death's Head changes Frighten's action from Standard to Simple, but the effect taxonomy has no way to change a talent's action type. Introduce a new effect type `action-modifier` (taxonomy v5) so any effect can set a talent's action, resolve conflicts deterministically (fastest wins), fold it into derived talent data, and show a changed action in the UI: accent colour plus an explanatory hover on the Disciplines tab, colour only in the Combat attack picker.

## Goals / Non-goals
- Goal: taxonomy v5 adds type `action-modifier` (`operation: set`, new `measure: action`, string `value` from a controlled list Free/Simple/Standard, target `{domain: "ability", name: <talent>}`), with doc, conformance checks and migration.
- Goal: engine folds active `action-modifier` effects onto talents AND skills (owner decision 2026-10-03: skills have full parity); multiple effects: fastest wins (Free > Simple > Standard) (owner rule R2); sources tracked for the hover.
- Goal: Death's Head base effect becomes a sustained `action-modifier` on Frighten (Simple), active whenever the spell is active (also with 0 extra threads).
- Goal: Disciplines talent row and talent details modal show the changed action in `--accent` with a hover explaining why (source spell(s), base to new action). Combat attack picker option shows the changed action in `--accent`, no hover.
- Non-goal: knacks UI, migrating Beguiling Blade/Swift Link or other abilities, new colour tokens, direction-aware colours, conflict UI.
- Non-goal: Sustained/NA/other action values (only Free/Simple/Standard valid).

## Guardrail alignment
- T1 is **Tier 2** (taxonomy vocabulary): commits to all three steps — bump docs/EFFECT-TAXONOMY.md v4 to v5; migrate every `rules/*.json` `effectTaxonomy` ref to v5; update schema tags/refs and any code that stamps the version (save worker, dev server).
- T2 engine (pure, DOM-free, structured fields): Tier 3.
- T3 UI: Tier 3 within UI-GUIDELINES (accent token exists for both themes, no new weights, no derived-value fabrication; data flows down, no UI computation of the action).
- T4 data: Tier 3 (fits the new taxonomy once T1 lands).
No Tier-1 item; no sign-off needed.

## Tickets
### T1 — Taxonomy v5: `action-modifier` type (Tier 2 ceremony)
- **What:** Add `action-modifier` to §2 (target domain `ability`), `action` to §5 measures, note in §1/§4 that its `value` is a controlled word (Free/Simple/Standard) and `operation` is `set`; add a §10 worked example; v5 changelog note; bump to v5; update every `rules/*.json` `effectTaxonomy` ref; update `tools/rules-conformance.test.js` vocab as needed and any version stamps in code.
- **Why:** The vocabulary must exist before data or engine use it.
- **Tier:** 2 (all three steps committed)
- **Acceptance criteria:** doc says v5 with the new vocabulary; all `rules/*.json` reference v5; `npm test` incl. rules-conformance green; conformance rejects an invalid `action-modifier` value.
- **Open questions:** none.

### T2 — Engine: fold `action-modifier` onto talents and skills
- **What:** Store/engine collects active `action-modifier` effects (same sustained/active-effects path as test-modifiers), resolves fastest-wins, and writes onto each affected talent or skill the effective action plus the original (`actionBase`) and contributing sources (`{name, action, applied}`; ties: all sources equal to the winning value are `applied`), so UI only renders.
- **Why:** UI must not compute game values.
- **Tier:** 3
- **Acceptance criteria:** with Death's Head active, Frighten reports action Simple, base Standard, source Death's Head; after expiry reverts; two effects (Simple and Free) give Free; an effect whose set value equals the base is not flagged as changed; unaffected talents unchanged.
- **Open questions:** none.

### T3 — UI: show changed action
- **What:** (talents AND skills, full parity) Disciplines talent/skill row action cell and talent/skill modal action chip render the effective action in `--accent` with a title/hover explaining: base → final action, then EVERY contributing source with its value, the winner marked "applied" and the others "overridden" (owner decision 2026-10-03); Combat attack picker option text (talent and skill options) uses the accent colour for a changed action, no hover.
- **Why:** Player must see that the action differs and why.
- **Tier:** 3 (in-guideline; theme-aware via `--accent`)
- **Acceptance criteria:** changed action visibly accent-coloured in light and dark; hover text names base action, new action and source(s); Combat picker colour-only; unchanged actions render exactly as before; no new font weights or tokens. Owner verifies UI manually.
- **Open questions:** none. Owner accepted: Safari ignores `<option>` colour (colour on closed select only, no marker); hover is desktop-only, no mobile UI (qa-log 2026-10-03).

### T4 — Death's Head uses `action-modifier`
- **What:** In `rules/spells.json` Death's Head, add a sustained `action-modifier` (target Frighten, set, measure action, value Simple) to the base `effects` alongside the existing note; keep the +2 Frighten extra thread.
- **Why:** First consumer; matches PG p. 323.
- **Tier:** 3
- **Acceptance criteria:** self-cast shows Frighten as Simple while active, with or without extra threads; existing step-bonus behaviour (+2 per thread) unchanged; Death's Head tests updated and green.
- **Open questions:** none.
