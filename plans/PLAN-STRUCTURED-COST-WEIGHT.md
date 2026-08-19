# Plan: Structured `ref.cost` / `ref.weight` (kill the regex parsers)

**Status:** Draft — awaiting owner sign-off (Tier 1 shape change, see Guardrail classification).
**Owner:** Gary
**Created:** 2026-08-19
**Baseline:** current `dev`/`main` working tree.

## Context

Two grandfathered engine parsers violate the structured-taxonomy rule that
ARCHITECTURE.md now locks in (§3, §5.5):

- `engine/weight.js` `parseWeight()` regex-parses `ref.weight` free text
  (`"5 lb"`, `"8 oz"`, `"8-10 lb"`, `"Neg."`, `"—"`, `"NA"`).
- `engine/wealth.js` `parseCostSilver()` regex-parses `ref.cost` free text
  (`"8 cp"`, `"5,000"`, `"100-175"`).

The data has no structural reason to be text. The fix is the one this repo's
architecture rule demands: **move the structure into the data** so the engine
reads typed fields, with units/rates as data tables (the `COIN_DENOMINATIONS`
precedent), never regex.

Current catalog reality (`rules/items.json`, 182 entries):

| Field | Today | Structured target |
|---|---|---|
| `ref.cost` | 168 numbers (silver) + 14 strings | **always a silver number**; the 14 strings become numbers, and the one range (`"100-175"`) becomes its midpoint `137.5` |
| `ref.weight` | 182 strings (159 `"N lb"`, 14 `"N oz"`, 1 range, 6 negligible, 2 `"NA"`) | `{ amount, unit }` / `{ negligible: true }` / `null` — the one range (`"8-10 lb"`) becomes its midpoint `{ "amount": 9, "unit": "lb" }` |

## Guardrail classification

**Tier 1 — schema shape change, owner sign-off required.**

The change alters the **shape** of `ref.cost` and `ref.weight` inside
`rules/items.json` (schema tag `ed-items/2`) and `rules/thread-items.json`
(schema tag `ed-thread-items/1`) — string fields become structured
objects/numbers. Per CLAUDE.md, "changing the shape or renaming its fields is
Tier 1", so this plan proceeds only with the owner's explicit approval (the
engine rule edit in ARCHITECTURE.md/CLAUDE.md was the preceding owner-directed
step; this is its first enforcement).

No `character.json` change, no UI-UX contract change, no effect-taxonomy
vocabulary change (Tier 2 N/A). Tier 1 is the whole story here.

## Source of truth

- Catalog: `rules/items.json` (schema `ed-items/2`) → `ref.cost`, `ref.weight`.
- Thread catalogue: `rules/thread-items.json` (schema `ed-thread-items/1`) → 2 entries
  with `ref.weight` strings + numeric `ref.cost`.
- Parsers to replace: `engine/weight.js` `parseWeight` / `carriedWeight`,
  `engine/wealth.js` `parseCostSilver`.
- Consumers of the parsers: `store.js` — `parseWeight` call sites at **705 & 741**
  (plus its **import at 35**; `carriedWeight` at **885** is a consumer too but is
  *not* renamed — see Phase A/D), `ui/ed-trade-modal.js` (15, 131, 263),
  `ui/ed-equipment.js` (42 `costText`, 878–879 display).
- Validator: `engine/validate-item.js` (156–161: cost must be number; weight in the
  string list) + `tools/worker/worker.js` (46, 253–312) + `store-custom-items.js` (42).
- Data extractor that writes these fields: `tools/add-items.py`
  (`norm_cost` / `norm_weight`).
- Docs to update: ARCHITECTURE.md §5.5, CLAUDE.md Tier-1 bullet, PLAN-TRADE-ITEMS.md,
  docs/THREAD-ITEMS.md §schema table.

## Target schema

### `ref.cost` — silver-denominated

Silver is the catalog's and the trade modal's unit of account (`COIN_DENOMINATIONS`).
A plain number is already silver, so 168 entries are untouched.

```
ref.cost = 137.5      // silver (number ≥ 0) — always a single number
```

String migrations:
- `"8 cp"` → `0.8`, `"3 cp"` → `0.3`, `"2 cp"` → `0.2`, `"5 cp"` → `0.5`,
  `"15 cp"` → `1.5` (exact copper→silver conversion, no drift)
- `"5,000"` → `5000`
- `"100-175"` → `137.5` (the midpoint of the two listed prices — **owner decision**:
  `ref.cost` is always a single number; a range is collapsed to its midpoint at
  authoring time, not kept as a range. This is a deliberate departure from "never
  fabricate a number" for this one field, chosen for a uniform scalar shape. The
  original `"100-175"` range can be preserved in the item's `ref.description` if
  keeper fidelity matters.)

### `ref.weight` — physical-quantity object

Pounds is the engine's unit; ounces must keep their book spelling, so weight
is a unit-carrying object (not a bare number). Unit→pounds is a data table.

```
ref.weight =
  null                                  // unknown / unrecorded (was "NA")
  { "amount": 5,  "unit": "lb" }        // was "5 lb" (159 entries)
  { "amount": 10, "unit": "oz" }        // was "10 oz" (14 entries)
  { "amount": 9,  "unit": "lb" }        // was "8-10 lb" (Pole Arm) — the
                                        // midpoint, chosen at authoring time
  { "negligible": true }                // was "Neg." / "—" (6 entries)
```

`carriedWeight` behaviour is preserved exactly:
- `null` → counts toward `unweighed`
- `{ negligible: true }` → 0 lb, weighed
- `{ amount, unit }` → amount × unit factor (lb=1, oz=1/16)
- `carriedWeight` multiplies by `qty` and sums as today

Ranges are collapsed to their midpoint **at authoring time**, exactly like the
`ref.cost` decision (owner-approved): `ref.weight` is always a single liquid
amount + unit, never a `{ min, max }` pair. The midpoint choice is a deliberate
departure from "never fabricate a number"; the original `"8-10 lb"` can be
preserved in the item's `ref.description` if keeper fidelity matters.

## Phases

### A. Engine — structured readers (pure, testable standalone)

- `engine/weight.js`:
  - Add `WEIGHT_UNITS = [{ key: 'lb', pounds: 1 }, { key: 'oz', pounds: 1/16 }]`
    (a data table, mirroring `COIN_DENOMINATIONS`).
  - Replace `parseWeight(string)` with `weightPounds(w)` reading the object
    shape above; a bare number remains accepted as pounds. No range branch —
    `ref.weight` is always a single `{ amount, unit }`.
  - `carriedWeight` keeps its signature/behaviour, calling `weightPounds`.
- `engine/wealth.js`:
  - Replace `parseCostSilver(x)` with `costSilver(c)`:
    number → itself; anything else → 0 (never a fabricated price). No range
    handling — `ref.cost` is now always a single silver number.
- Update the two `.test.js` files to the structured inputs, keeping every
  current assertion's *result* identical (5 lb → 5, 8 oz → 0.5, 8-10 lb → 9
  [midpoint amount],
  Neg. → 0, NA → null; 8 cp → 0.8, 100-175 → 137.5 [midpoint], 5,000 → 5000).

### B. Catalog migration — mechanical, verified

- `rules/items.json`:
  - 14 string costs → silver numbers per target schema.
  - 182 weights → structured objects per target schema (`"8-10 lb"` → `{ "amount": 9, "unit": "lb" }`).
  - Bump `schema: "ed-items/2"` → `"ed-items/3"`.
- `rules/thread-items.json`: the 2 `ref.weight` strings ("20 lb", "15 lb") →
  `{ amount, unit: 'lb' }`; bump `schema: "ed-thread-items/1"` → `"ed-thread-items/2"`.
- One-off verification script (`tools/verify-cost-weight.mjs`), the migration's
  gate. **Engines**: the script imports the *new* readers (`weightPounds`,
  `costSilver`) from `engine/` and embeds **frozen inline copies of the old
  `parseWeight`/`parseCostSilver` logic as the reference oracle** — required
  because Phase A *deletes* the old parsers before B runs, so the pre-migration
  values can't be recomputed from the live engine afterward. Two-run shape,
  keyed by the item's **map key** (the stable identity in both `rules/*.json`):
  1. **Before** (catalog still strings): for every item in `items.json` +
     `thread-items.json`, compute `{ weightPoundsOld, costSilverOld }` via the
     frozen oracle and write `tools/.verify-cost-weight.baseline.json`
     (git-ignored, one entry per item key). Items without a `ref.cost`
     (thread-items) record `costSilverOld: null`.
  2. **After** (catalog migrated): re-read both files and, for every entry,
     assert *exactly*: `weightPounds(it.ref.weight) === baseline.weightPoundsOld`
     (weights; `{ negligible }` → 0, `null` → null) and, **when the item carries
     a cost**, `costSilver(it.ref.cost) === baseline.costSilverOld` (thread-items
     have no cost — skip, don't force a 0-vs-null compare).
     Also assert the **key sets are identical** before/after (no item dropped,
     renamed, or added) and the expected conversion counts hold: exactly 14
     string→number costs, 182 string→object weights in `items.json`, and 2 in
     `thread-items.json`. Any mismatch → non-zero exit, migration rejected.
  - Run before the edits (writes the baseline), re-run after — both must be green.
- Since `validate-item.js` will have produced errors for 14 catalog costs today
  (it already rejects string costs), phase C fixes that validator's expectations.

### C. Validator + worker + custom items

- `engine/validate-item.js` (156–161):
  - `ref.cost`: number ≥ 0 **only** (unchanged — already the rule; the 14 legacy
    strings were failing it).
  - `ref.weight`: `null`, `{ negligible: true }`, or `{ amount ≥ 0, unit ∈ {lb, oz} }`.
    Remove `weight` from the string list.
  - Update header comment `ed-items/2` → `ed-items/3`.
- `tools/worker/worker.js` (~253–312) and `store-custom-items.js` (42, commit
  schema tag) references → `ed-items/3`.
- `tools/dev-server.mjs` — **runtime** fixture, not just a comment: `FRESH_CATALOG`
  (69) hardcodes `schema: 'ed-items/2'`, which is what the dev server serves for a
  fresh catalog (asserted by `dev-server.test.js:178`). Bump to `/3` or the
  fresh-catalog path fails validation and the test breaks. Also the header comment
  at line 7.
- `tools/probe-custom-items.mjs` — fixture strings at 79, 88, 94, 133, 141 and
  the wrong-schema regex at 85 (`/ed-items\/2/`) → `ed-items/3`. Standalone smoke
  (not under `node --test`), but its asserts hard-fail otherwise.
- `tools/fold-custom-items.mjs` — header comment reference at line 6
  (`ed-items/2`) → `ed-items/3` (the file itself validates via
  `validateItemsFile`, so no runtime schema constant — comment only).
- `ui/custom-item-builder.js` (97–98): custom items already emit number cost and
  no weight — both already conform; no code change beyond comments.
- `tools/add-items.py`: as the catalog is now the source of truth,
  note the tool as archive-only.

### D. UI display

- `ui/ed-equipment.js` (42, 878–879):
  - `costText`: number → `"N sp"` (no range branch — cost is always a number).
  - **`weightText` — a new UI-local formatter in `ui/ed-equipment.js`, colocated
    with `costText` (next to line 42).** Weight formatting is a *display* concern
    (`weightPounds` in the engine stays numeric), mirroring the `costText`
    precedent: `costText` lives in the UI while `costSilver` lives in the engine.
    Exhaustive output contract — exactly three post-migration inputs:
    - `null` (unrecorded/unknown) → returns `null`, so the chip call site
      `weightText(ref) ? { v: \`Weight ${weightText(ref)}\` } : null` **omits the
      chip** (the carried-weight banner's separate "N items with unrecorded
      weight" note at ed-equipment.js:768 already covers the unrecorded case —
      the chip itself must not render "Weight unrecorded").
    - `{ negligible: true }` → `"Negligible"`.
    - `{ amount >= 0, unit: 'lb' | 'oz' }` → `"N lb"` / `"N oz"` (format the
      amount with the existing `grp` helper, same as `costText`).
    The three cases above replace today's truthy-string check `ref.weight ?
    { v: \`Weight ${ref.weight}\` } : null` (line 878–879) — as written, a plain
    `{ amount, unit }` object would render `Weight [object Object]`.
    (Tolerates a stale pre-migration local copy of the catalog gracefully:
    a legacy string weight degrades to the placeholder-pill path, never a
    fabricated number.)
- `ui/ed-trade-modal.js` (15, 131, 263): `parseCostSilver(it.ref.cost)` →
  `costSilver(it.ref.cost)`.
- `store.js` (35, 705, 741): rename the `parseWeight` import (35) and its **two**
  call sites (705, 741) to `weightPounds`. Line **885** (`carriedWeight(items)`)
  is **not** renamed — `carriedWeight` keeps its name and internally calls
  `weightPounds` (Phase A); there is nothing to change there.

### E. Docs + references

- ARCHITECTURE.md §5.5 grandfathered list: drop `wealth.js` and `weight.js`;
  keep only `spells.js`. Same for CLAUDE.md Tier-1 bullet.
- PLAN-TRADE-ITEMS.md §Source of truth / §Phases: replace `parseCostSilver`
  and the `"8 cp"` examples with the `costSilver` + structured-cost description.
- docs/THREAD-ITEMS.md schema table: `ed-thread-items/1` → `ed-thread-items/2`.
- WORKFLOW.md / PR checklist: no new/removed runtime deps, paths stay relative.

### F. Tests + release

- `npm test` green: rewrite `engine/weight.test.js`, `engine/wealth.test.js`,
  update `validate-item.test.js` (`badCost` case and add weight-shape cases),
  update `tools/fold-custom-items.test.js` + `tools/worker/worker.test.js` +
  `tools/dev-server.test.js` schema fixtures (`ed-items/2` → `ed-items/3`),
  and `store-thread-item.test.js` (schema assert at line 40,
  `'ed-thread-items/1'` → `'ed-thread-items/2'` — the *only* change there; its
  cost/weight assertions are thread-rank figures, untouched). `store-weight.test.js`
  needs **no edit**: it asserts derived pounds only (identity-guaranteed by Phase A),
  no raw `ref.cost`/`ref.weight`/`parseWeight` strings surface in the file.
- Confirm the carried-weight banner totals and trade modal prices are byte-identical
  after the change (the verify script's outputs are the gate).

## Out of scope

- **Spells — everything.** This plan touches **only** `ref.cost` / `ref.weight` in the
  item catalogues (`rules/items.json`, `rules/thread-items.json`) and their engine/UI
  consumers. It does **not** touch `rules/spells.json`, `engine/spells.js`, spell
  durations, `successes` options, the Spells tab, or `plans/PLAN-SPELLS.md` in any way.
  The separate spells-`duration`/`successes` regex migration is a distinct, larger
  effort (spell durations + the taxonomy `duration-modifier` groundwork that already
  landed in EFFECT-TAXONOMY v4) and is explicitly **not** part of this plan — the two
  streams do not conflict on any file.
- Any display-styling changes beyond the two formatters.

## PR checklist (paste into the PR description)

- [ ] Tier-1 schema shape change (`ed-items/2`→`ed-items/3`, `ed-thread-items/1`→`ed-thread-items/2`) — owner signed off on this plan
- [ ] `rules/items.json` + `rules/thread-items.json` migrated to structured cost/weight; `ref.cost` is a single silver number everywhere (range `"100-175"` → midpoint `137.5`) and `ref.weight` is a single `{ amount, unit }` everywhere (range `"8-10 lb"` → `{ "amount": 9, "unit": "lb" }`); verify script results before == after
- [ ] No regex in `engine/weight.js` / `engine/wealth.js`; units/rates are data tables
- [ ] `npm test` green; trade prices + carried-weight totals unchanged
- [ ] Docs updated: ARCHITECTURE §5.5, CLAUDE.md, PLAN-TRADE-ITEMS.md, THREAD-ITEMS.md
- [ ] No Tier-1 invariant regressed: Overview viewport fit, placeholder pills, light/dark, modals, relative paths