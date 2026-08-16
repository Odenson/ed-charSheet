# Plan: Homebrew rule — Additional-Discipline talents priced one tier higher

> **Status: implemented on `dev` (2026-08-16).**

A homebrew rule that reprices **every talent learned in an additional
Discipline** (2nd and later): each rank costs Legend from the talent's **own
tier bumped one step up** (Novice → Journeyman → Warden → Master, Master stays
Master) instead of the standard New-Discipline Rank-1 / Equivalent-Tier model.

**Worked example (Chakka):** Frighten is a Novice-tier talent in the
Nethermancer (2nd Discipline), Rank 3.

- First-Discipline baseline: 100 + 200 + 300 = **600**.
- Standard additional-Discipline model (current app): Rank 1 = 500 (New
  Discipline table, lowest Circle 3) + 300 + 500 (Journeyman) = **1300**.
- **Rule ON:** at own tier bumped once → Journeyman column, 200 + 300 + 500
  = **1000**.

This is a **Tier 3** change end-to-end: new data (`rules/homebrew.json` entry
via the existing `ed-homebrew/2` `set` lever), a small pure-engine extension
(`engine/legend-spent.js`), and store/UI wiring that reads the same flag. No
schema-shape, taxonomy, or UI-contract change; the engine stays pure and
DOM-free; derived values stay computed, never stored.

- **Owner:** repo owner. **Created:** 2026-08-16. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `b015377` (trade feature). Suite **502**.
- **Reference:** [HOMEBREW-RULES.md](HOMEBREW-RULES.md) (§5.5 `set` registry),
  `engine/legend-spent.js` (additional-Discipline costing), the karma-economy
  precedent [PLAN-HOMEBREW-KARMA.md](PLAN-HOMEBREW-KARMA.md).

---

## The rule (owner table)

- **Scope:** all additional Disciplines (ordinal 2, 3, 4+).
- **Pricing:** every rank of an affected talent is `talentRank[rank][ownTier+1]`,
  cumulative — i.e. exactly `talentRanksCost(rank, shiftedTier(tier))`, with
  **no separate Rank-1 New-Discipline price** and **no Equivalent-Tier table**.
- **Tier bump:** Novice → Journeyman, Journeyman → Warden, Warden → Master.
  **Master stays Master** (no higher column; zero surcharge at the top).
- **Missing `tier` input:** defaults to Novice, then shifts (mirrors the audit's
  skill default). Generic-unknown labels pass through and get flagged by the
  cost-table miss (null, placeholder pill) — never a fabricated number.
- **Rule OFF:** absent / `0` / disabled ⇒ exactly today's standard
  New-Discipline + Equivalent-Tier model, bit-for-bit.

**Decisions locked (owner, 2026-08-16):**

| Q | Decision |
|---|---|
| Scope | **All additional disciplines** (not just the 2nd) |
| Rank-1 price | **Replace entirely** — Rank 1 also uses the bumped column (Frighten Rank 1 = 200, not the 500 table price); example 200+300+500=1000 confirms |
| Master ceiling | **Keep Master prices** (no shift at the top) |
| Data carrier | A `set`-lever rule (`legend.additionalTierShift: 1`), a new `HOMEBREW_SET_TARGETS` target; ships **enabled: false** |

---

## Current state

- The audit prices additional-Discipline talents via
  `additionalDisciplineTalentCost(rank, realCircle, ordinal, lowestCircle, costs)`
  (`engine/legend-spent.js:180`): Rank 1 = `newDisciplineRank1Cost` (lowest
  Circle row), ranks 2+ at `equivalentTier` (ordinal-dependent column).
- `talentRankStepCost` (`engine/legend-spent.js`) derives step costs from the
  same function, so a step always equals `audit(after) − audit(before)` — an
  invariant the tests pin (REVIEW-FINDINGS, PLAN-RANK-EDITING).
- The `set` lever (`ed-homebrew/2`, HOMEBREW-RULES.md §5.5) already feeds
  engine/store through the `HOMEBREW_SET_TARGETS` registry (`store.js:526`) and
  `homebrewSets` resolution. `karma.ritualCost` is the precedent for a
  Legend-cost-looking target consumed by the audit.

---

## Engine / store design (Tier 3)

### 1. Pure engine — `engine/legend-spent.js`
- New `shiftedTier(tier, costs, shift = 1)`: push a label one step up the
  `costs.tiers` ladder, clamped at `Master`; unknown label passes through (the
  caller's table miss flags it). Step count comes from the rule's value
  (currently 1).
- `additionalDisciplineTalentCost(…, opts = {})` gains `opts.tierShift` and
  `opts.tier`. When `tierShift > 0`: return
  `{ cost: talentRanksCost(rank, shiftedTier(opts.tier ?? 'Novice'), costs.talentRank), tier: <shifted>, rank1: null }`
  — both surcharge tables skipped.
- `talentRankStepCost(t, ordinal, lowestCircle, costs, toRank, opts = {})` passes
  `opts` (with `tier` defaulted from `t.tier`) into the additional-Discipline
  path so **step cost == audit-diff holds under the rule too**.
- `auditLegendSpent(character, costs, opts)` reads `opts.tierShift` and threads
  it (plus each talent's `tier`) into the per-discipline line pricing. The
  existing `tierNote` shows `Novice → Journeyman` automatically.

### 2. Store — `store.js`
- `HOMEBREW_SET_TARGETS` gains `legend.additionalTierShift` (scalar target; the
  resolution loop handles scalars already).
- `const tierShift = Number(homebrewSets['legend.additionalTierShift']) || 0;`
- Passed into `auditLegendSpent(...)` (the `spent`, `model.legend.spent` feed)
  and into the rank-editing `pricing` block's two `talentRankStepCost` calls
  (`increaseCost` / `refund`), so `affordable` stays consistent.
- Exposed as `model.legend.tierShift` for the UI guard.

### 3. UI — `ui/ed-app.js`
- `_canAffordRank` re-audits a tentative clone; pass
  `tierShift: this._model?.legend?.tierShift ?? 0` so the guard and the Legend
  panel price identically. No other UI change — the audit's section lines render
  the shifted tier note already.

### 4. Data — `rules/homebrew.json`
- New rule `hb-additional-tier-shift`, `enabled: false`,
  `set: { "legend.additionalTierShift": 1 }`, standard authoring fields
  (`overrides`, `summary`, `note`). `schema` stays `ed-homebrew/2` —
  adding a target to the registry is an engine change, not a format change
  (HOMEBREW-RULES.md §5.5).

### 5. Docs — `docs/HOMEBREW-RULES.md`
- §5.5 registry list gains `legend.additionalTierShift` (scalar ≥ 0; typically
  1; semantics + pointer to this plan).

---

## Guardrail classification

| Concern | Class | Why |
|---|---|---|
| New `set` **target** (`legend.additionalTierShift`) | ✅ Tier 3 | Adding a registry target is an engine change, explicitly *not* a format/schema change (HOMEBREW-RULES.md §5.5). `ed-homebrew/2` shape untouched. |
| Engine pricing change | ✅ Tier 3 | Pure, DOM-free; gated on the rule flag; off ⇒ identical to today. Step-cost invariant preserved. |
| Store / model exposure | ✅ Tier 3 | Derived values stay derived; nothing new stored. |
| Data entry in `rules/homebrew.json` | ✅ Tier 3 | Fits the existing `set` shape, correct schema tag. |
| UI | ✅ Tier 3 | No layout/tab/modal/theme changes; placeholder-pill behaviour preserved; only the guard's audit input matches the panel. |
| Effect taxonomy / schema shapes | ✅ untouched | No taxonomy or `ed-*` schema changes. |

No Tier-1 or Tier-2 sign-off needed.

---

## Verification

- **`engine/legend-spent.test.js`** (new): `shiftedTier` ladder + Master clamp;
  `additionalDisciplineTalentCost` with `tierShift` = plain cumulative bumped
  column (rank 3 Novice→Journeyman = 1000, the Chakka anchor); Master talent
  costs Master prices; missing tier defaults Novice→Journeyman; unknown label →
  null; **step cost == audit(after) − audit(before)** under the rule; rule off
  ⇒ existing expectations untouched (the whole existing suite stays green).
- **`store-homebrew.test.js`** (new): enabled rule → `model.legend.tierShift ===
  1`, audit + `pricing.increaseCost` use the shifted price; disabled → current
  behaviour; unknown set target still ignored.
- `npm test` — baseline 502 stays green.

---

## Build order

1. Pure engine: `shiftedTier` + `additionalDisciplineTalentCost` / step-cost /
   audit threading + engine tests.
2. Store: registry target, `tierShift` resolution, audit + pricing wiring,
   `model.legend.tierShift`, store tests.
3. UI guard wiring.
4. Data + docs: the `hb-additional-tier-shift` rule (`enabled: false`),
   HOMEBREW-RULES.md registry entry.
5. Full suite + lint.

---

## Guardrail re-check (before landing)

- [ ] No Tier-1 invariant changed (UI-GUIDELINES, data-down/dispatch-up, pure
      DOM-free engine, store-only-inputs, schema shapes). Rule ships disabled.
- [ ] Rule OFF restores exactly today's additional-Discipline pricing.
- [ ] Additional-Discipline step cost still equals audit(after) − audit(before)
      with the rule ON.
- [ ] Derived values still show placeholder pills when unpriceable (Master-hostile
      / unknown labels) — never fabricated.
- [ ] Engine stays pure / DOM-free; store keeps storing only inputs.

---

## Progress log

- **2026-08-16** — Implemented on `dev`: `shiftedTier` + `tierShift` threading in
  `engine/legend-spent.js` (audit + `additionalDisciplineTalentCost` +
  `talentRankStepCost`), `legend.additionalTierShift` registered in
  `HOMEBREW_SET_TARGETS` (`store.js`) and resolved into the audit, pricing, and
  `model.legend.tierShift`; `_canAffordRank` reads it; rule
  `hb-additional-tier-shift` shipped (`enabled: false` → owner-enabled for the
  current campaign); docs + changelog entry added. 17 new tests (engine +
  store); suite **502 → 521**. Chakka anchor verified: Frighten R3 = 1000.