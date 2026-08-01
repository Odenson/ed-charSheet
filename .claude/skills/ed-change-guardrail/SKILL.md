---
name: ed-change-guardrail
description: ALWAYS use this skill before changing the EDCharSheet UI, character/rules data, the engine, or the effect taxonomy. Triggers whenever the user asks to edit, add, fix, refactor, restyle, or extend anything in ui/*, engine/*, data/character.json, rules/*.json, or docs/EFFECT-TAXONOMY.md — including layout, styling, tabs, modals, placeholder pills, theme/colors, schema fields, effect vocabulary, or derived-value logic. Load it to classify the change against the project's protected-surface tiers before touching code.
---

# EDCharSheet Change Guardrail

This project's UI/UX and its engine/taxonomy/schema decisions are load-bearing.
Future changes **extend** the system; they do not silently re-decide it. Run this
pre-flight before editing the protected surfaces, then follow the tier's rule.

The authority for *what* the rules are is the docs — this skill is the *process*
for respecting them:
- [CLAUDE.md](../../../CLAUDE.md) — the tiered working agreement
- [docs/UI-GUIDELINES.md](../../../docs/UI-GUIDELINES.md) — UI/UX contract
- [docs/EFFECT-TAXONOMY.md](../../../docs/EFFECT-TAXONOMY.md) — effect vocabulary
- [ARCHITECTURE.md](../../../ARCHITECTURE.md) — layers & data model

## Step 1 — Am I touching a protected surface?

Yes if the change lands in any of: `ui/*`, `engine/*`, `data/character.json`,
`rules/*.json`, or `docs/EFFECT-TAXONOMY.md`. If no, proceed normally — this
skill doesn't apply.

## Step 2 — Classify the change

**🔒 Tier 1 — Locked.** The change alters one of these:
- A UI-GUIDELINES rule — Overview fits desktop viewport with no vertical scroll;
  mobile folds to one stacked column; two font weights only (400/500); the five
  tabs and their contents; **derived values show muted dashed placeholder pills,
  never a fabricated number**; modals honor Escape-closes / Enter-confirms;
  theme-aware (light + dark).
- The architecture golden rule — data down via render, events up via `dispatch`;
  UI never mutates state or computes game values; engine stays pure and DOM-free.
- The data-model invariant — store only inputs; never store a value a rule can
  recompute (no derived `Value`/`Step` in `character.json`).
- The **shape** or field names of `character.json` or a `rules/*.json` file, or
  its `schema` version tag.

**🔄 Tier 2 — Ceremony.** The change modifies the effect taxonomy's field names
or controlled vocabularies (the `effects`-object grammar in EFFECT-TAXONOMY.md).

**✅ Tier 3 — Free.** New data entries that fit the existing schema/taxonomy, new
views/tabs/modules, or styling within the guidelines. Proceed — just keep the
Tier 1 rules intact.

## Step 3 — Act per tier

- **Tier 1 → do not proceed autonomously.** Stop and surface it to the owner:
  quote the exact rule being touched and explain why the task appears to need it.
  Offer a Tier-3 alternative that satisfies the request without breaking the rule
  if one exists.
- **Tier 2 → do all of these in the same change, or none:**
  1. Update `docs/EFFECT-TAXONOMY.md` **and bump its version** (e.g. v1 → v2).
  2. Migrate **every** `rules/*.json` `effects` array to the new vocabulary.
  3. Update the references: each file's `schema` tag and its
     `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (vN)"` field.
  A half-migrated repo is the failure this tier prevents. If you can't complete
  all three, don't start — surface it instead.
- **Tier 3 → proceed.** Confirm the Tier 1 UI/architecture rules still hold.

## Step 4 — Before finishing

Re-check the Tier 1 rules you could have affected:
- Overview still fits the desktop viewport with no vertical scroll.
- Derived/unknown values still render as placeholder pills, not invented numbers.
- Light **and** dark mode both work; no hardcoded color that fails in one mode.
- Any modal touched still closes on Escape (and confirms on Enter if it has a
  primary action).
- Asset/`fetch` paths stay relative (`./…`), never root-absolute (WORKFLOW.md).

If the change is a PR, add the checklist from CLAUDE.md to the description.
