# Guardrails — protected surfaces and change protocol

Single source of truth for what in EDCharSheet is protected and how to change
it. [CLAUDE.md](../CLAUDE.md), the `ed-change-guardrail` skill, and the agents
all link here; none of them restate these rules. If this file and another doc
disagree, that is a bug — resolve it explicitly.

The app's current UI/UX and its engine/taxonomy/schema decisions are considered
**load-bearing**. Future changes extend the system, they do not quietly
re-decide it. This applies to AI-assisted sessions and human contributors alike.

---

## Protected surfaces — three tiers

### 🔒 Tier 1 — Locked. Do not change without explicit owner sign-off.

Changing any of these is a decision the repo owner makes on purpose, not a
side effect of another task. If a task seems to require it, **stop and ask** —
quote the specific rule and say why the task appears to need it.

- **UI/UX contract** — every rule in [UI-GUIDELINES.md](UI-GUIDELINES.md):
  Overview fits the desktop viewport without vertical scroll; mobile folds to a
  single stacked column; two font weights only (400/500); six tabs with their
  defined contents; **derived values render as muted dashed placeholder pills,
  never a fabricated number**; every modal honors Escape-closes / Enter-confirms;
  everything is theme-aware (light + dark).
- **Architecture golden rule** — data flows *down* through render; events flow
  *up* through `dispatch`. The UI never mutates state or computes game values.
  The engine stays **pure and DOM-free** and **reads rule data as structured
  taxonomy, never by regex-parsing display strings** (see
  [ARCHITECTURE.md](../ARCHITECTURE.md) §3, §5.5; the `spells.js` parser is
  grandfathered, a deviation not a precedent).
- **Data-model invariant** — store only *inputs*; never store what a rule can
  recompute. `Attribute Value`/`Step` and other derived values do not live in
  character data (ARCHITECTURE.md §4.1).
- **Schema shapes & their version tags** — the top-level shape of each
  `data/characters/<id>.json` (current `schema: "ed-character/2"`; readers
  accept legacy `/1`), the `data/characters/index.json` index
  (`ed-characters-index/1`), and each `rules/*.json`
  (e.g. `schema: "ed-races/2"`). Adding data within the shape is fine (Tier 3);
  changing the *shape* or renaming its fields is Tier 1.

### 🔄 Tier 2 — Change only with ceremony.

The **effect taxonomy** ([EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md)) is
explicitly `v4, under review` — it is *meant* to evolve, but never silently.
A change to the taxonomy's field names or controlled vocabularies must:

1. Update the doc **and bump its version** (`v1` → `v2`).
2. **Migrate every data file** that uses the vocabulary (`rules/*.json`
   `effects` arrays) to the new form.
3. Update the version references that point at it — the `schema` tags and the
   `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (vN)"` field in the affected files.

All three happen together, or none do. A half-migrated repo is the failure mode
this tier exists to prevent.

### ✅ Tier 3 — Free. No special ceremony.

- New character data / new `rules/*.json` entries **that fit the existing
  schema and taxonomy** (a new race, talent, item — data, not code).
- New tabs' *content*, new views, new lazy-loaded engine modules — as long as
  they honor the Tier 1 UI and architecture rules.
- Styling and layout tweaks **within** the UI-GUIDELINES constraints.
- Bug fixes that restore the documented behavior.

---

## Change protocol (AI and humans)

Before editing the UI, character data, `rules/*.json`, `engine/*`, or the
taxonomy, run the guardrail pre-flight (AI sessions: the **ed-change-guardrail**
skill; a hook asks for it on the first protected edit of a session. Humans use
this checklist):

1. **Classify the change** against the three tiers above.
2. If it's **Tier 1**, do not proceed on your own — surface it to the owner
   with the specific rule it touches, and offer a Tier-3 alternative if one
   satisfies the request.
3. If it's **Tier 2**, do all three migration steps in the same change. If you
   can't complete all three, don't start.
4. If it's **Tier 3**, proceed — but still keep the Tier 1 rules intact.

### Before finishing

Re-check the Tier 1 rules you could have affected:

- Overview still fits the desktop viewport with no vertical scroll.
- Derived/unknown values still render as placeholder pills, not invented numbers.
- Light **and** dark mode both work; no hardcoded color that fails in one mode.
- Any modal touched still closes on Escape (and confirms on Enter if it has a
  primary action).
- Asset/`fetch` paths stay relative (`./…`), never root-absolute
  ([WORKFLOW.md](../WORKFLOW.md)).

### PR checklist (paste into the PR description)

```
- [ ] No Tier-1 invariant changed (UI-GUIDELINES rules, data-down/dispatch-up,
      pure DOM-free engine, "store only inputs", schema shapes) — or owner signed off
- [ ] Overview still fits the desktop viewport with no vertical scroll
- [ ] Derived values still show placeholder pills, never fabricated numbers
- [ ] Works in both light and dark mode; modals still Escape-closes/Enter-confirms
- [ ] Any taxonomy change bumped the version AND migrated all rules/*.json AND
      updated the schema/effectTaxonomy references (Tier 2) — or N/A
- [ ] Asset/fetch paths are relative (./…), never root-absolute (see WORKFLOW.md)
```
