# Plan — Karma ledger (converted/spent), Legend-log spend rows, file cleanup

Follow-on to the homebrew Karma economy
([PLAN-HOMEBREW-KARMA.md](PLAN-HOMEBREW-KARMA.md)). Three linked goals:

1. **Move Karma to a ledger model.** Stop storing `available` as a running
   balance; store **`converted`** (lifetime Karma gained) and **`spent`**
   (lifetime Karma spent) and **derive** `available = clamp(converted − spent, 0,
   max)`. This reconciles the imported bookkeeping (kolon `140 − 105 = 35` ✓,
   chakka-test `123 − 105 = 18` ✓), preserves history, is symmetric with Legend,
   and — unlike a stored balance — is **not coupled to `max`** (a circle-up
   doesn't silently grant Karma; you still ritual to fill).
2. **Legend-on-karma + Legend-log rows.** With the rule on, the Legend spent on
   Karma is simply **`converted × race cost`**. Show it in the existing Legend log
   (Notes tab): one virtual **historic** row plus a dated row per going-forward
   ritual event. Display-only; no new stored total.
3. **Drop the genuinely dead fields** (`legend.available`, `karma.fromRace`,
   `karma.legend`). **Now derived → also drop stored `karma.available`.** Keep
   `converted`, `spent`, `rituals`.

Owner confirmed 2026-08-13: **all Karma is bought with Legend** (no free starting
pool), so `converted` includes starting Karma and `converted × cost` charges
everything. A new character under the rule starts `converted = 0`.

> **Scope note:** this **revises already-shipped code.** *Today* the committed
> Karma-spend writes `available` (`available −= spend`, HEAD `ui/ed-app.js:470`),
> and this session's uncommitted ritual writes `available` + `rituals` (buy-back
> bumps `available` and appends a dated event). The **Step-3 rework repoints both
> to the ledger** — spend → `spent`, buy-back → `converted` — so `available`
> becomes derived. Both current writes are consumed by that rework (non-blocking).
> Plus a small **data migration** (below). Bigger than the earlier "just add
> display rows" framing — deliberately, to make the model correct for imports.
>
> **Out of scope:** `tools/archive/import-xlsx.mjs` — one-time spreadsheet import
> tooling, no longer used — is **not** updated for the ledger.

---

## Decisions (owner, 2026-08-13)

- **Karma ledger:** store `converted` + `spent`; **derive** `available =
  clamp(converted − spent, 0, max)`. Drop stored `available`.
- **All Karma is bought** (confirmed): `converted` includes starting Karma;
  `legend-on-karma = converted × ritualCost`; a new character starts
  `converted = 0`.
- **Legend-log rows are display-only** in the Notes Legend view (`_legendView`) —
  a virtual **historic** seed row + dated event rows. **No undo on these rows**
  (undo stays in the Overview ritual modal's "Recent rituals").
- **`rituals[]` stays** as the dated event log (display + undo). `converted` is
  the authoritative counter; a buy appends an event **and** `converted += N`; an
  undo removes the event **and** `converted −= N` (kept in lockstep).
- **Local files vs the live store (owner-managed).** The agent edits the
  **local** copies of `data/characters/*.json` (gitignored working copies, pulled
  via `scripts/sync-local-data.sh`) so the owner can test against the new logic.
  The **owner** manages syncing those changes to the **`character-data`** branch
  (the live store the deployed site reads) — no sync script or push action by the
  agent. UI/engine/store code lands on `dev` (→ `main` squash-merge per WORKFLOW).
- **Retroactive charge accepted:** enabling the rule seeds `converted × cost`
  Legend as spent, so Available Legend drops by that lump (Chakka: `123 × cost`).

---

## Context / current state

- **Karma was a stored running balance** (`resources.karma.available`), mutated in
  place. **This plan makes it derived** from the ledger. The imported bookkeeping
  fits the ledger: **`available = converted − spent`** (kolon `140 − 105 = 35` ✓,
  chakka-test `123 − 105 = 18` ✓). Local test files may carry drift — the agent's
  copy of `chakka.json` currently reads `available: 14` while `converted − spent
  = 18` (local files are a test bed, not authoritative; the `character-data`
  values are protected and the owner reconciles any mismatch).
- `resources.karma.rituals` (this session) → dated `[{ id, date, points, cost,
  legend }]` events. Under the ledger these stay for **display + undo**;
  `converted` (not `Σ rituals.legend`) is authoritative for the Legend sink.
- Legend Available is derived (`totalEarnt − audit total`, `store.js`); the
  `karma-rituals` audit sink already exists (currently `Σ rituals.legend`) — it
  becomes **`converted × ritualCost`**.
- **Dead now:** `resources.legend.available` (G1), `resources.karma.fromRace`
  (starting-karma tally the ledger folds into `converted`), `resources.karma.legend`
  (name-clashes with `rituals[].legend`), and — because it's now derived —
  `resources.karma.available`. **Live:** `karma.converted`, `karma.spent`,
  `karma.rituals`, `legend.{totalEarnt, totalSpent, earned}`.

---

## The Karma ledger model (core)

**Stored inputs:** `converted` (lifetime Karma gained, includes starting),
`spent` (lifetime Karma spent), `rituals[]` (dated buy-back events, display/undo).

**Derived:**
- `available = clamp(converted − spent, 0, max)` — `max` from the existing
  `maxKarma(modifier, circle, maxCap)`.
- `legendOnKarma = converted × ritualCost` (0 when the rule is off / no cost).

**Write operations** (all input writes, via `ed-edit-karma`):
| Action | Effect |
|---|---|
| Spend a Karma die | `spent += 1` |
| Buy-back N (rule on) | `converted += N`, append a dated ritual event |
| Undo a ritual event | `converted −= event.points`, remove the event |
| Free refill (rule off, PG p.83) | `converted += (max − available)` → available = max; no Legend cost (`ritualCost` null) |

**Assumptions / edges (flag):**
- *All Karma is bought* (owner-confirmed) → `legendOnKarma = converted × cost` is
  correct; new character `converted = 0`.
- *Rule-toggle edge:* free refills (rule off) raise `converted` with no Legend
  cost; if the rule is later turned on, those points get priced at `× cost` too.
  Acceptable for a mostly-on homebrew; documented, not handled specially.
- `available` clamps to `[0, max]` defensively (buy/​spend UIs already clamp, so
  `converted − spent ∈ [0, max]` in normal play; a `max` drop on circle-down is
  the only clamp case).
- *Undo at the `max` clamp (Q2 — accepted):* with `converted − spent > max`,
  undoing a ritual lowers `converted` but `available` stays pinned at `max` — the
  Legend is refunded, the Karma is not. Accepted as-is.
- *`rituals[].legend` is kept as audit history (Q3):* events continue to store the
  immutable `legend` snapshot (fallback `points × cost`). It is no longer the
  sink authority (`converted × cost` is), but remains for audit / display / event
  history.

---

## Build order

### 1. Data migration + dead-field cleanup (Tier 1 — local edits; owner syncs to `character-data`)

Per-character files (`data/characters/*.json`) — the agent edits the **local**
copies so the owner can test; the **owner** syncs the same field edits to the
**`character-data`** branch. `index.json` is untouched (no karma/legend fields).

- **Drop:** `resources.karma.available` (now derived), `resources.karma.fromRace`,
  `resources.karma.legend`, `resources.legend.available`. Per-file presence varies
  (verified 2026-08-13): `legend.available`/`fromRace` are in `chakka`,
  `chakka-test` (not `kolon`); `karma.legend` in all three.
- **Keep / ensure:** `karma.converted`, `karma.spent`, `karma.rituals`.
- **Migration for files lacking the ledger** (only `available` stored, no
  `converted`/`spent`): seed `converted = available`, `spent = 0` (so
  `converted − spent = available` is preserved). Chakka/kolon already carry
  `converted`+`spent` — leave their values (local `chakka.json` drift is a test
  artefact; the owner guards the `character-data` values).

### 2. Engine + store (Tier 3, pure)

- `engine/legend-spent.js` `auditLegendSpent(character, costs, { …, karmaRitualCost })`:
  `karma-rituals` sink = **`converted × karmaRitualCost`** (absent cost ⇒ 0).
  (Replaces the current `Σ rituals.legend`.)
- `store.js` `deriveModel`:
  - `characteristics.karma.available = clamp(converted − spent, 0, max)`
    (derived — no longer read from a stored `available`).
  - Pass `homebrewSets['karma.ritualCost']` into `auditLegendSpent`.
  - Attach `legend.spends` (display, never stored): a **virtual historic row**
    `{ virtual:true, points: converted − Σ rituals.points, legend: (…) × cost }`
    (only when that historic remainder > 0 and a cost exists), then a row per
    `rituals[]` event. `Σ spends.legend = converted × cost` (consistent with 2a).

### 3. App writes (Tier 3) — `ui/ed-app.js` `_editKarma`

Rework to the ledger: `spend → spent += 1`; `ritual → converted += N` + append
event; `removeRitual → converted −= points` + drop event; `refill → converted +=
(max − available)`. `available` is no longer written (it's derived). Keep the
Legend clamp / affordability guards. Refresh the open roll's karma snapshot from
the re-derived `available`.

### 4. UI (Tier 3)

- `ui/ed-notes.js` `_legendView()`: render `model.legend?.spends` inside the
  existing `.ltable`, below the earned rows — `−N Legend`, description (events:
  `Karma Ritual — +N Karma @ cost/pt`; historic: `Karma conversions (historic) —
  N points` with the `vrow`/`vtag` non-deletable pattern), date (10 chars; none
  for the historic row), **no delete cell**, and a one-line caption ("Karma Ritual
  spends — already reflected in Available Legend").
- `ui/ed-overview.js`: the ritual modal already reads `characteristics.karma`
  (`available`, `max`, `ritualCost`) — no change needed beyond `available` now
  being derived; verify the buy clamp still uses the derived `available`.

### 5. Tests

- **Ledger** (`store` / `engine`): `available = clamp(converted − spent, 0, max)`;
  buy raises `converted`+available and Legend sink; spend raises `spent`, lowers
  available; free refill raises `converted` to `max`.
- **Legend sink**: `karma-rituals` total = `converted × cost`; absent cost ⇒ 0.
- **Display**: `legend.spends` = historic row + event rows; `Σ = converted × cost`;
  not summed into `totalEarnt`; not in `legendEarned`; empty when converted 0 & no
  rituals.
- **Migration**: a fixture with only `available` derives the same value after
  seeding `converted = available, spent = 0`.
- Full suite green; the `set`-lever / max-cap tests untouched (extend, not rewrite).

### 6. Changelog

`unreleased` entry: Karma now tracks converted/spent with a derived pool, and the
Legend log shows Karma-Ritual spends (rule on).

---

## Guardrail classification

| Concern | Class | Why |
|---|---|---|
| Karma model: drop stored `available`; store `converted`+`spent`; derive `available` | 🔒 **Tier 1 — sign-off** | Data-model invariant: which fields are *inputs* vs *derived* changes (store-only-inputs — `available` becomes derived, `converted`/`spent` become the inputs). Revises committed Karma-spend behaviour. Owner-signed in Decisions. |
| Dead-field removal (`legend.available`, `karma.fromRace`, `karma.legend`) | 🔒 **Tier 1 — sign-off** | G1 + data-model cleanup; owner-signed. |
| Legend sink = `converted × cost`; `legend.spends` derivation | ✅ Tier 3 | Pure engine/store; recomputed from inputs. |
| Notes Legend-log rows | ✅ Tier 3 | View content; reuses `vrow`/`vtag`. |
| Engine pure / DOM-free; store-only-inputs | ✅ upheld | `available` and the Legend numbers are derived; only `converted`/`spent`/`rituals` are stored. |

---

## Considerations (owner — confirmed, kept for the record)

- **Retroactive Legend charge** on enabling the rule (`converted × cost`);
  Chakka drops by `123 × race cost`. Confirmed intended.
- **All-Karma-bought:** new characters start `converted = 0` (buy as they go);
  `converted` includes starting Karma for imports.
- **Rule-toggle edge:** off-state free refills raise `converted` without a Legend
  charge; turning the rule on later prices them at `× cost`. Documented, not
  specially handled.
- **Migration:** files with only `available` seed `converted = available,
  spent = 0`; imports with `converted`/`spent` are left as-is.

## Resolutions (owner, 2026-08-13)

- **Q1 — ledger reconciliation:** local test files may carry errors (agent copy of
  `chakka.json` reads `available 14` vs `converted − spent 18`). Local files are a
  **test bed**; the `character-data` values are authoritative and protected — the
  owner corrects any maths drift there.
- **Q2 — undo at the `max` clamp:** accepted (Legend refunded, Karma stays pinned
  at max).
- **Q3 — `rituals[].legend`:** kept as immutable audit history; the sink authority
  is `converted × cost`.
- **Q4 — rule-toggle edge:** accepted (off-state free refills raise `converted`
  and are priced `× cost` if the rule turns on).
- **Q5 — importer:** `tools/archive/import-xlsx.mjs` is one-time-only and **out of
  scope**; not updated.

## Open items

- None — all review questions (Q1–Q5) resolved 2026-08-13. This document awaits the
  owner's go-ahead before any code.
