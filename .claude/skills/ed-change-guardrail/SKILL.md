---
name: ed-change-guardrail
description: ALWAYS use this skill before changing the EDCharSheet UI, character/rules data, the engine, or the effect taxonomy. Triggers whenever the user asks to edit, add, fix, refactor, restyle, or extend anything in ui/*, engine/*, character data, rules/*.json, or docs/EFFECT-TAXONOMY.md — including layout, styling, tabs, modals, placeholder pills, theme/colors, schema fields, effect vocabulary, or derived-value logic. Load it to classify the change against the project's protected-surface tiers before touching code.
---

# EDCharSheet Change Guardrail

Process for respecting the project's protected surfaces. The rules themselves
(tiers, Tier-2 ceremony, final re-check, PR checklist) live in
[docs/GUARDRAILS.md](../../../docs/GUARDRAILS.md) — **read it now**; this skill
deliberately does not restate them, so there is one copy to keep true.

Related authority: [CLAUDE.md](../../../CLAUDE.md),
[docs/UI-GUIDELINES.md](../../../docs/UI-GUIDELINES.md),
[docs/EFFECT-TAXONOMY.md](../../../docs/EFFECT-TAXONOMY.md),
[ARCHITECTURE.md](../../../ARCHITECTURE.md).

## Steps

1. **Am I touching a protected surface?** `ui/*`, `engine/*`, character data,
   `rules/*.json`, or `docs/EFFECT-TAXONOMY.md`. If not, this skill doesn't apply.
2. **Classify** the change as Tier 1, 2 or 3 using GUARDRAILS.md.
3. **Act per tier** as GUARDRAILS.md's change protocol says: Tier 1 → stop and
   surface to the owner (quote the rule, offer a Tier-3 alternative); Tier 2 →
   all three migration steps or none; Tier 3 → proceed.
4. **Before finishing**, run GUARDRAILS.md's "Before finishing" re-check. For a
   PR, paste its checklist into the description with results included.
