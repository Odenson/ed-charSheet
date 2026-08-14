# Plan: Homebrew rule — race-driven Karma economy (ED-classic buy-back)

A homebrew rule that replaces the standard "free Karma Ritual" with the
**ED-classic Karma economy**: you **buy Karma back with Legend** at a
**race-driven cost**, up to a **race-driven maximum**, and the **Karma die** is
also race-driven. To carry it cleanly the homebrew format gains a new **`set`**
lever (a flat / race-keyed value override) — bumping the format to
**`ed-homebrew/2`**.

This is the plan for owner review — **nothing implemented yet.** It bundles a
Tier-1 format change (`set` in `ed-homebrew/2`) and a Tier-1 Legend-model change
(the ritual is a new **Legend sink**). Those need explicit sign-off; the rest is
Tier-3 wiring on top.

- **Owner:** repo owner. **Created:** 2026-08-12. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `f0aca37` + the uncommitted Karma-Ritual `+` (free refill,
  PG p.83) and the save-visibility/autosave work. Suite **443**.
- **Reference:** [HOMEBREW-RULES.md](HOMEBREW-RULES.md) (format — gets updated),
  [PLAN-HOMEBREW.md](PLAN-HOMEBREW.md), `engine/legend-spent.js` (sinks /
  reconciliation), the legend-spent memory.

---

## The rule (owner table)

Per race: **Cost** (Legend per Karma point bought back), **Step** (Karma die
step), **Maximum** (Karma-pool ceiling), **Modifier** (existing racial Karma
Modifier). (Owner-revised table, 2026-08-12: original Costs; **Step now varies per
race** — it equals the racial Modifier.)

| Race | Cost (Legend/pt) | Step (die) | Maximum | Modifier |
|---|---|---|---|---|
| Dwarf | 10 | 4 | 25 | 4 |
| Elf | 10 | 4 | 25 | 4 |
| Human | 6 | 5 | 40 | 5 |
| Obsidiman | 10 | 3 | 20 | 3 |
| Ork | 7 | 5 | 40 | 5 |
| T'skrang | 8 | 4 | 25 | 4 |
| Troll | 10 | 3 | 20 | 3 |
| Windling | 5 | 6 | 60 | 6 |

**What changes when the rule is ON:**
1. **Karma Ritual costs Legend.** Restoring `N` Karma spends `N × Cost` Legend
   (race-driven), recorded as a dated, undoable sink. No longer free (the free
   PG p.83 refill `+` is the *off* behaviour).
2. **Max Karma is capped:** `min(Circle × Modifier, Maximum)` (Q1).
3. **The Karma die is race-driven** (Step) — and it now **varies**: D4
   (Obsidiman, Troll), D6 (Dwarf, Elf, T'skrang), D8 (Human, Ork), D10
   (Windling). Standard is the flat `KARMA_STEP = 4` constant, so this is a real
   change for every non-Step-4 race.

All three (#1 Legend cost, #2 capped max, #3 varied die) are real behaviour
changes now.

---

## Current state

- `maxKarma(modifier, circle) = modifier × circle` (`engine/characteristics.js:524`);
  store sets `characteristics.karma.max` from it (`store.js:815`).
- `KARMA_STEP = 4` constant drives the Karma die (read via `characteristics.karma.step`).
- `races.json` carries `karmaModifier` only (not Cost/Step/Maximum).
- **Karma Ritual `+`** (uncommitted): free refill to max — becomes the rule-**OFF**
  behaviour.
- **Legend is derived:** available = `totalEarnt − Σ sinks`, sinks priced by
  `engine/legend-spent.js`, reconciled against `resources.legend.totalSpent`.
  **No "Karma purchase" sink exists today** — this rule adds one.
- **Homebrew format** `ed-homebrew/1`: a rule overrides a *rating* via `formula`
  (Σ of `ref × coef` monomials) and/or adjusts via `effects`. **It cannot express
  a flat constant** (every term needs a `ref`/`times`), has **no race-keyed
  values**, and has **no override targets beyond the health ratings**.

---

## Format change — `ed-homebrew/2`: the `set` lever (Tier 1)

`set` is a new rule lever alongside `formula`/`effects`: a **flat or race-keyed
value override** for a named engine target. It fills the "override a value to a
constant" gap `formula` can't, and adds race-keying without a bespoke block.

```jsonc
"set": {
  "<target>": <value>            // <value> = a scalar, OR a race-keyed map
}
```

- **`<value>` scalar** → the override applies to every character.
- **`<value>` race map** `{ "Dwarf": 4, … }` → the engine resolves it against the
  character's race; a race **absent** from the map leaves that target
  **un-overridden** for that character (falls back to the standard derivation).
- **Target registry (fixed, validated).** Only these targets are overridable; an
  unknown target fails validation (never a silent no-op). v2 registry:
  - `karma.step` — replaces `KARMA_STEP` for the Karma die.
  - `karma.maxCap` — the `maximum` fed to `maxKarma` (engine applies the `min`;
    absent ⇒ no cap).
  - `karma.ritualCost` — Legend per Karma point for the ritual (read by the
    ritual feature, D — not a derived rating).
- **Semantics.** When a rule is enabled, the engine consults its `set` overrides
  at each target's derivation site. `set` **replaces the base**; any `effects`
  still fold on top (mirrors `formula` §5). **Last-enabled-wins** across rules.
- **`formula` vs `set`** don't collide: `formula` targets ratings, `set` targets
  the registry values above.

**Ceremony (all in one change):**
1. Update [HOMEBREW-RULES.md](HOMEBREW-RULES.md): document `set`, the value forms
   (scalar / race map), the target registry, precedence — and **bump the doc's
   version references**.
2. **Bump `rules/homebrew.json` `schema` `ed-homebrew/1` → `ed-homebrew/2`.** The
   existing **Durability-scaled Health Ratings** rule uses only `formula`
   (unchanged shape, valid under v2) — its **migration is the schema-tag bump plus
   re-validation** against the v2 format; no content change. (A test asserts the
   v1 Durability rule still evaluates identically under v2.)
3. Add the `set`-consuming resolver + the target registry to the engine/store.

> **`condition` — deferred.** The earlier idea of a `condition` factor (race /
> discipline / circle *applicability* gating) is **not needed for this rule**: a
> race-keyed `set` value already selects per race (the map keys are the applicable
> races). `condition` earns its place only when a rule must apply-or-not with **no
> per-key value to pick** (e.g. "add an effect *only* for Windlings", a
> circle-threshold gate). Add it then — not now — to avoid carrying an unused
> factor.

---

## The rule as data (Version A — one rule, one toggle)

```jsonc
{
  "id": "hb-karma-economy",
  "name": "Race-driven Karma economy (ED-classic buy-back)",
  "overrides": "Players' Guide p.83 — Karma Ritual (house rule)",
  "summary": "Buy Karma back with Legend at a race-driven cost, capped at a race maximum; race-driven Karma die.",
  "enabled": false,
  "set": {
    "karma.step":       { "Dwarf":4,  "Elf":4,  "Human":5,  "Obsidiman":3,  "Ork":5,  "T'skrang":4,  "Troll":3,  "Windling":6  },
    "karma.maxCap":     { "Dwarf":25, "Elf":25, "Human":40, "Obsidiman":20, "Ork":40, "T'skrang":25, "Troll":20, "Windling":60 },
    "karma.ritualCost": { "Dwarf":10, "Elf":10, "Human":6,  "Obsidiman":10, "Ork":7,  "T'skrang":8,  "Troll":10, "Windling":5  }
  }
}
```

One rule, one `enabled` toggle. (Rejected: **Version B** — eight
`condition:{race}` rules with scalar `set`, repeating all the boilerplate and
requiring eight toggles.)

---

## Engine / store design

### B. Race-driven Karma die step (Tier 3)
When the rule is enabled, `characteristics.karma.step` resolves from the
`karma.step` `set` override (race-keyed) instead of `KARMA_STEP`. Off / race
absent → the constant. Every Karma-die roll path already reads
`characteristics.karma.step`, so no downstream change.

### C. Capped max Karma — a single function (Tier 3) — Q1 decided
`maxKarma` gains an optional cap; **one derivation, no branch**:

```
maxKarma(modifier, circle, maximum = null):
    base = modifier × circle
    return maximum == null ? base : min(base, maximum)
```

- **Rule OFF** → no `karma.maxCap` override → `maximum = null` → the `min` drops
  out → `Circle × Modifier` (today's behaviour, untouched; existing callers pass
  no `maximum`).
- **Rule ON** → `maximum` = the race's `karma.maxCap` → `min(Circle × Modifier,
  Maximum)`.

`modifier` stays `races.json.karmaModifier`; `maximum` comes from the rule's
`set`.

### D. Karma-Ritual Legend cost — the new sink (Tier 1) — Q3 decided
The imperative half, kept as **feature code that reads the declared cost** (not
expressed in the taxonomy). Buying `N` Karma spends `N × cost` Legend:

- **Store a dated, undoable ritual-purchase log** (input) — one event per buy:
  `resources.karma.rituals: [{ id, date, points, cost, legend }]` (or a top-level
  log mirroring the Legend-earned log). Each is an *input*; totals are derived —
  "store only inputs" holds. Undoable/editable like Legend-earned entries
  (PLAN-NOTES-TAB precedent); can surface in the Notes-tab History/Legend views.
- **Add a modeled sink** in `engine/legend-spent.js`: `Karma purchases =
  Σ (event.points × cost)`, its own audit line. Available Legend then reflects it
  automatically (already `= earnt − Σ sinks`); undoing an event returns the Legend.
  `cost` is read from the rule's `karma.ritualCost` for the character's race.
- **Reconciliation** stays honest — the sink is *modeled*, never dumped into
  `totalSpent`. Test: a ritual event moves Karma `+N` and available Legend
  `−N × cost`; undo reverses both exactly.

### E. Ritual UI (Tier 3) — Q5 decided: partial buy
The Overview Karma `+` becomes rule-aware:
- **Rule OFF:** today's free refill to max (already built).
- **Rule ON:** a small modal — the player **chooses how many points to buy** (a
  stepper/number, default the amount that refills to max), showing `points ×
  cost` Legend, the resulting Karma, and available Legend after. Clamped to
  `[0, min(max − current, floor(availableLegend ÷ cost))]` so it never overspends
  or exceeds max, and **available Legend never goes negative** (Q6). Disabled when
  Karma is full or Legend can't afford one point. Confirm appends the log event
  (D). Escape-closes / Enter-confirms; the confirmation toast already exists.
- Gated by the rule's `enabled` flag surfaced in the model (the homebrew system
  already exposes active rules — the Homebrew pill/panel).

---

## Guardrail classification

| Concern | Class | Why |
|---|---|---|
| `set` lever + target registry in `ed-homebrew/2` | 🔒 **Tier 1 — sign-off** | Homebrew **format/schema shape change** (HOMEBREW-RULES.md §7): bump `ed-homebrew/1`→`/2`, update the doc, migrate `rules/homebrew.json` (schema tag + re-validate the Durability rule) in the same change. |
| Karma-Ritual **Legend cost = new Legend sink** | 🔒 **Tier 1 — sign-off** | New **stored input** (the dated ritual log) + new **modeled sink** in `engine/legend-spent.js`; touches store-only-inputs + the Legend-audit reconciliation. |
| Race-driven **Karma die step** (`set: karma.step`) | ✅ Tier 3 | Read the step per race when the rule is on; pure wiring. |
| Capped **max Karma** (`maxKarma(…, maximum)`) | ✅ Tier 3 | One pure function, backward-compatible; gated by the `karma.maxCap` override. |
| Ritual UI (paid flow when on) | ✅ Tier 3 | New view behaviour; honours modal / theme / placeholder rules. |
| Engine pure / DOM-free; store-only-inputs | ✅ upheld | Every derived Karma value stays derived; only the ritual log + existing Legend inputs are stored. |

**Tier-1 sign-off needed before build:** (1) the `ed-homebrew/2` `set` format
change, (2) the Legend sink + stored ritual log.

---

## Resolved (owner, 2026-08-12)

- **Q1 — Max Karma:** `min(Circle × Modifier, Maximum)`; absent Maximum ⇒ no cap
  ⇒ `Circle × Modifier`. One `maxKarma(modifier, circle, maximum)` function.
- **Q2 — Data home / format:** a new **`set`** lever in **`ed-homebrew/2`**;
  **Version A** (one rule, race-keyed `set`). `races.json` untouched. `condition`
  deferred.
- **Q3 — Legend sink:** a **dated, undoable** ritual log → a *modeled* audit sink.
- **Q5 — Partial buy:** player chooses N (clamped to max and to affordable Legend).
- **Q6 — Legend floor:** N capped at `floor(availableLegend ÷ cost)`; never negative.
- **Table (revised 2026-08-12):** original Costs (10/10/6/10/7/8/10/5); **Step
  varies per race** (= Modifier): D4/D6/D8/D10 across the races.

## Still open

- **Q4 — Free-ritual interaction (confirm):** the free "restore to max" `+`
  (already built) is the rule-**OFF** behaviour, fully **replaced** by the paid
  flow when the rule is ON — not both. Assumed yes; flag if not.

---

## Build order

1. **Tier-1 sign-off** for the `ed-homebrew/2` `set` format change and the Legend
   sink; confirm Q4.
2. **Format (Tier 1):** update HOMEBREW-RULES.md (`set` grammar + target
   registry + precedence, version bump); bump `rules/homebrew.json` to
   `ed-homebrew/2`; add the `set` resolver + registry to the engine/store; test
   the Durability rule evaluates identically under v2.
3. **Engine (Tier 3):** race-driven `karma.step` (B) + capped `maxKarma` (C),
   gated on the rule — pure, tested.
4. **Legend sink (Tier 1):** store the dated ritual log, add the audit sink;
   tests that Karma↑ / available-Legend↓ by `N × cost`, and undo reverses both.
5. **UI (Tier 3):** the rule-aware ritual `+` partial-buy modal.
6. **Data + ship:** add the `hb-karma-economy` rule `enabled: false`; changelog +
   HOMEBREW pill copy.

---

## Guardrail re-check (before landing)

- [ ] Tier-1 sign-off obtained for the `ed-homebrew/2` `set` format change and the
      Legend sink before any code.
- [ ] Format change is complete in one change: HOMEBREW-RULES.md updated + version
      bumped, `rules/homebrew.json` migrated to `ed-homebrew/2`, existing
      Durability rule re-validated (identical evaluation test).
- [ ] Store only inputs — Karma max/step and available Legend stay derived; only
      the ritual log + existing Legend inputs are stored.
- [ ] Engine stays pure / DOM-free; data down, events up.
- [ ] Ritual modal honours Escape-closes / Enter-confirms; theme-aware; two
      weights; placeholder pills for any missing derived value.
- [ ] Rule ships `enabled: false`; the off path is exactly today's behaviour
      (free refill, `Circle × Modifier` max, `KARMA_STEP` die).
