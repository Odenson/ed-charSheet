# Plan: Homebrew — learning a spell costs no Legend

A house rule that **negates the Legend cost of learning a spell**, so a magician
learns spells for free (Legend-wise). It is a **plan only — no implementation
yet**, for owner review, and a **fast-follow to [PLAN-LEARN-SPELLS.md](PLAN-LEARN-SPELLS.md)**
(it modifies the spell-learning Legend sink that plan introduces).

- **Owner:** repo owner.
- **Created:** 2026-08-19. **Status:** decisions resolved (Q1–Q3); ready to build after PLAN-LEARN-SPELLS.
- **Branch of record:** `dev` (current production is v1.15.1).
- **Depends on:** PLAN-LEARN-SPELLS **§5.1** — the Legend-spent audit's **spells
  sink** (`auditLegendSpent` gains `opts.spellCatalog`, sums the existing
  `spellCost(circle, rankTable)` over `character.spells.known`). This rule dials
  that sink to zero. Build order: learn-spell first, then this.
- **Reference:** [docs/HOMEBREW-RULES.md](../docs/HOMEBREW-RULES.md) §5.5 (the
  `set` lever), [PLAN-HOMEBREW-LEGEND-TIER.md](PLAN-HOMEBREW-LEGEND-TIER.md) (the
  exact precedent — a `set` lever threaded into `auditLegendSpent`), [[legend-spent-audit]].

---

## 1. Goal

When this homebrew rule is **enabled** (it **ships enabled** — Q3), learning a
spell contributes **0 Legend** to the Legend-spent audit — Available Legend is
unaffected by the spells the magician knows. The rule **also carries a silver
multiplier, fixed at 1** (Q2), so the silver copy cost is **unchanged for now**
while the knob exists to tune it later. Disabling the rule restores the standard
Legend cost (a spell costs a Novice talent at Rank = Circle).

---

## 2. Mechanism — a homebrew `set` lever (established pattern)

This reuses the `ed-homebrew/2` **`set` lever** exactly as
`hb-additional-tier-shift` does for `legend.additionalTierShift`:

1. **The rule** (`rules/homebrew.json`) declares `set: { "<target>": value }`,
   ships **enabled** for the current campaign (Q3 — the exception to the
   WORKFLOW "rules ship off" default, like `hb-additional-tier-shift`), and the
   owner switches it on/off from the rules file.
2. **`store.js`** whitelists the target in **`HOMEBREW_SET_TARGETS`** (currently
   `karma.step`, `karma.maxCap`, `karma.ritualCost`, `legend.additionalTierShift`),
   and `deriveModel` collects enabled rules' values into `homebrewSets[target]`.
3. The value is **threaded into the engine** — for tier-shift it becomes
   `tierShift = homebrewSets['legend.additionalTierShift']`, passed to
   `auditLegendSpent(character, costs, { …, tierShift })`. This rule adds a
   parallel opt for the spell sink.
4. The **Homebrew pill/list** UI (`ui/ed-homebrew.js`) already renders every
   enabled rule's name/summary automatically — **no UI change needed**; the new
   rule appears in the pill when on.

---

## 3. The rule + the lever

**Two multiplier levers** on the spell-learn costs, both defaulting to 1 when
absent — Legend set to 0 (waived), silver set to 1 (unchanged for now, Q2):

```jsonc
// rules/homebrew.json — a new rule (ships enabled:true — Q3)
{
  "id": "hb-free-spell-learning",
  "name": "Learning a spell costs no Legend",
  "overrides": "Player's Guide p.252 — Spell Legend Point Cost (house rule)",
  "summary": "A magician spends no Legend Points to learn a spell; the spell's Circle-based Legend cost is waived. The silver copy cost is unchanged.",
  "enabled": true,
  "note": "ed-homebrew/2 `set` levers (docs/HOMEBREW-RULES.md §5.5). `legend.spellLearnCostMultiplier: 0` multiplies every learned spell's Legend cost by 0 in the Legend-spent audit's spells sink (PLAN-LEARN-SPELLS §5.1). `spells.learnSilverMultiplier: 1` scales the Learn modal's suggested silver price — 1 leaves it unchanged; the knob exists to tune silver later without a new rule. Each multiplier defaults to 1 when absent.",
  "set": {
    "legend.spellLearnCostMultiplier": 0,
    "spells.learnSilverMultiplier": 1
  }
}
```

A **multiplier** (not a boolean) matches the numeric-lever convention and leaves
room for future partial-cost house rules (`0.5`, `2`, …) without new targets.
Owner-confirmed (Q1). A single rule carries both levers so "how spell learning is
priced" lives in one place.

---

## 4. Engine wiring

Additive changes, mirroring how tier-shift was threaded. Both levers are
collected the same way; they apply in different places (Legend → the audit;
silver → the Learn modal's suggested price).

1. **`store.js` — `HOMEBREW_SET_TARGETS`** gains **both**
   `'legend.spellLearnCostMultiplier'` and `'spells.learnSilverMultiplier'`, so
   the rule's values land in `homebrewSets`.

**Legend lever (→ the audit):**

2. **`store.js` — the `auditLegendSpent(...)` call site** (already gaining
   `spellCatalog` from PLAN-LEARN-SPELLS) also passes
   **`spellCostMultiplier: homebrewSets['legend.spellLearnCostMultiplier'] ?? 1`**.
   > ⚠ **Use `?? 1`, not `Number(x) || 1`.** The tier-shift lever defaults to 0
   > with `Number(...) || 0`, which is safe because 0 is the default. A **cost
   > multiplier defaults to 1**, and its *enabled* value is **0** — a falsy
   > number — so `|| 1` would silently turn the rule off. Nullish-coalesce only.
   > The same trap applies to any multiplier lever below.
3. **`engine/legend-spent.js` — the spells sink** multiplies each spell's cost by
   the opt: `sink += spellCost(circle, rankTable) * (opts.spellCostMultiplier ?? 1)`.
   Absent opt → ×1. Enabled rule → ×0 (free). Nothing else in the audit changes.

**Silver lever (→ the Learn modal's suggested price):**

4. **The silver multiplier folds into `learnPlan.suggestedSilver` — not the
   modal.** Per PLAN-LEARN-SPELLS §5, the engine composes one `learnPlan` object
   and the modal renders it (the `castPlan` precedent — the UI never combines
   pricing args). So the multiplier's whole path is engine-side:
   - `store.js` `HOMEBREW_SET_TARGETS` collects `spells.learnSilverMultiplier`;
     `buildSpellsContext` surfaces **`learnSilverMultiplier =
     homebrewSets['spells.learnSilverMultiplier'] ?? 1`** on the ctx (alongside
     `learnLegendMultiplier`).
   - `learnPlan(ctx, spellName)` sets **`suggestedSilver = spellSilverCost(rules,
     circle) × ctx.learnSilverMultiplier`** (and `legendCost = spellCost(circle,
     talentRank) × ctx.learnLegendMultiplier`).
   - The modal renders `learnPlan.suggestedSilver` verbatim as the overridable
     starting price; it **does not** call `spellSilverCost` or apply the
     multiplier itself. At value 1 the suggested price is unchanged (Q2); the
     player can still override it (PLAN-LEARN-SPELLS Q3).
   This keeps the "engine pre-computes everything the modal shows" rule intact —
   the free-learning rule (and any future silver tweak) touches **no modal code**.

Because the Legend sink is **derived** (PLAN-LEARN-SPELLS §5.1 stores no "spent"
number), toggling the rule instantly re-prices Available Legend on the next
`deriveModel` — no data migration, no per-character write. The silver lever only
sets the modal's default; nothing is stored either.

---

## 5. Tier classification

| Area | Tier | Why |
|---|---|---|
| New `rules/homebrew.json` rule (data) | **Tier 3** | A new rule entry in the existing `ed-homebrew/2` shape — data, ships disabled. |
| New `set` target + audit multiplier | **Tier 3 (additive)** | Same additive pattern as `legend.additionalTierShift`; no schema/taxonomy change. |

No Tier-1 or Tier-2 change. The homebrew `set`-lever mechanism is the sanctioned
extension point (docs/HOMEBREW-RULES.md §5.5).

---

## 6. Open decisions

| # | Decision | Owner answer |
|---|---|---|
| Q1 | Lever shape — **multiplier** vs. boolean. | **✅ Multiplier** (`legend.spellLearnCostMultiplier`); the boolean is off the table. |
| Q2 | Silver cost scope. | **✅ Add a parallel silver multiplier**, `spells.learnSilverMultiplier`, and set it to **1** in this rule — silver is **unchanged for now**, but the knob exists to adjust it later without a new rule. |
| Q3 | Default state. | **✅ Ship enabled** (`enabled: true`) — active for the current campaign, like `hb-additional-tier-shift`. |

---

## 7. Delivery phases

1. **Prereq** — PLAN-LEARN-SPELLS §5.1 (the spells sink) + §5 (`spellSilverCost`) are built and green.
2. **Data** — add the `hb-free-spell-learning` rule to `rules/homebrew.json`, **`enabled: true`** (Q3), with both `set` levers.
3. **Engine** —
   - `store.js` `HOMEBREW_SET_TARGETS` += `'legend.spellLearnCostMultiplier'` and `'spells.learnSilverMultiplier'`.
   - `store.js` audit call site passes `spellCostMultiplier` (**`?? 1`**); `engine/legend-spent.js` multiplies the spells sink.
   - `store.js` surfaces `model.spells.learnSilverMultiplier` (**`?? 1`**); `learnPlan` applies it to `suggestedSilver` (`spellSilverCost` stays pure — the castPlan precedent: the multiplier folds into the plan, never the pricing helper).
   - Tests: Legend enabled → 0, disabled → full cost, **falsy `0` not swallowed**; silver ×1 unchanged, and a hypothetical ×2 doubles the suggested price.
4. **Verify** — the Homebrew pill lists the rule; Available Legend rises by the summed spell cost when enabled and drops back when off; the Learn modal's suggested silver is unchanged at ×1.

---

## 8. Guardrail re-check

- **Store only inputs:** the rule is data; the waiver is **derived** in the audit,
  never a stored "spent" adjustment.
- **Rules as data:** the multiplier is a homebrew `set` value read by the engine,
  not a formula or a hard-coded special case.
- **Falsy-zero trap:** the multiplier defaults with `?? 1` (see §4.2) — the one
  real footgun, called out so the build doesn't repeat the tier-shift `|| 0` idiom
  where 0 is the *active* value.

---

## 9. Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-08-19 | Plan created. Fast-follow to PLAN-LEARN-SPELLS: a homebrew `set` lever (`legend.spellLearnCostMultiplier: 0`) that zeroes the learn-spell Legend sink, mirroring `hb-additional-tier-shift` → `legend.additionalTierShift` → `auditLegendSpent`. Three additive touchpoints (HOMEBREW_SET_TARGETS, the audit call site, the spells sink). Flagged the `?? 1` (not `|| 1`) default so the falsy `0` isn't swallowed. Silver cost unchanged. | Draft for review |
| 2026-08-19 | Owner review — **silver multiplier path locked to `learnPlan`.** It folds into the engine's `learnPlan.suggestedSilver` (`buildSpellsContext` surfaces `learnSilverMultiplier`; `learnPlan` applies it), and the modal renders that field — never calling `spellSilverCost` or the multiplier itself (the `castPlan` precedent). Introduced/locked `learnPlan` in PLAN-LEARN-SPELLS §5 as the single object the modal renders. §4.4. | Ready for build |
| 2026-08-19 | Owner answers folded in: **Q1** multiplier confirmed (no boolean); **Q2** add a parallel `spells.learnSilverMultiplier` fixed at **1** (silver unchanged now, tunable later) — scales the Learn modal's suggested price via `spellSilverCost` × multiplier, surfaced as `model.spells.learnSilverMultiplier`; **Q3** the rule **ships enabled**. Both multipliers default with `?? 1`. All decisions resolved. | Ready for build (after PLAN-LEARN-SPELLS) |
| 2026-08-19 | **Built.** `rules/homebrew.json` ships `hb-free-spell-learning` with `legend.spellLearnCostMultiplier: 0` + `spells.learnSilverMultiplier: 1` (`enabled: true`). `HOMEBREW_SET_TARGETS` whitelists both targets; the `auditLegendSpent` call site passes `spellCostMultiplier` (from `homebrewSets`, `?? 1`); the spells sink multiplies each spell's cost by it. `buildSpellsContext` already surfaced the ctx multipliers, so `learnPlan` folds them in. Tests: ×0 → sink 0, absent → full cost, ×0.5 → proportional, falsy‑0 not swallowed (`?? 1`); engine smoke verified ON=4154 vs OFF=2954 Available Legend for Chakka-TEST. §2 ships-enabled text fixed (was stale "ships disabled"); §7 silver bullet corrected to "multiplier folds into `learnPlan`, `spellSilverCost` stays pure." | Built & green |
