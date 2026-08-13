# Thread Items — Data Model & Implementation

A companion to [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md): how the effect taxonomy
is applied to **thread items**, field by field, and how the engine consumes it.
Read this when you need to understand (or extend) a thread item — the vocabulary
itself lives in the taxonomy; this doc is the *implementation* of that vocabulary
for the `rules/thread-items.json` catalog.

> Scope: the **data** side (schema shapes, field meanings, engine-read vs
> display-only) and the **engine** side (resolution, stacking collapse, Legend
> audit). The UI rendering is covered where it clarifies a field's purpose, not
> exhaustively.

---

## 1. Where thread items live

| Piece | File | Schema |
|---|---|---|
| Catalogue | `rules/thread-items.json` | `ed-thread-items/1` |
| Character ownership | `data/characters/<id>.json` → character `items[]` | `ed-character/1` |
| Effect vocabulary | `docs/EFFECT-TAXONOMY.md` | v3 |
| Legend cost tables | `rules/legend.json` → `costs.talentRank` | — |

The top-level shape of `rules/thread-items.json` is:

```jsonc
{
  "schema": "ed-thread-items/1",                 // Tier-1: don't rename fields
  "effectTaxonomy": "docs/EFFECT-TAXONOMY.md (v3)",
  "source": "Earthdawn 4E Gamemaster's Guide …", // provenance note
  "notes": { /* field-by-field commentary */ },
  "tiers": { "Novice": {"rankLimit": 4, "mysticDefenseRange": [8,12]}, /* … */ },
  "weavingDifficulty": { "1": 8, "2": 9, /* … */ },
  "items": { "<Item Name>": { /* §2 */ } }
}
```

**`tiers`** and **`weavingDifficulty`** are **display-only reference** — the
typical maximum ranks per tier and the Thread Weaving test Difficulty per rank.
The engine never reads them.

---

## 2. An item entry — every attribute

```jsonc
"Bracers of Aras": {
  "kind": "thread-item",
  "tier": "Journeyman",
  "maximumThreads": 3,
  "mysticDefense": 12,
  "base": { "effects": [] },
  "ref": { "source": "GMG p. 208", "description": "…" },
  "threadRanks": [ { "rank": 1, "keyKnowledge": "…", "effects": [ /* §3 */ ] } ]
}
```

| Field | Required | Engine-read? | Meaning |
|---|---|---|---|
| `kind` | yes | yes (UI) | `"thread-item"` — drives the ✦ star, the Thread Items section, and the picker label. |
| `tier` | yes | **yes (audit)** | `Novice` / `Journeyman` / `Warden` / `Master`. Selects the Legend-cost *column* (§5). |
| `maximumThreads` | no | no | Max characters who can weave a thread to the item (GMG p.202). Display-only. |
| `mysticDefense` | no | no | The item's MD — the DN for Item History tests to learn its Key Knowledges. Display-only. |
| `legendary` | no | no | `true` flags a legendary item (same shape, usually more ranks/deeds). Display-only. |
| `rankLimit` | no | no | Entry-level override of the tier's typical max ranks. Display-only. |
| `base` | yes | **yes** | `{ "effects": [] }` — the item's state with **no thread woven**. Most items are mundane until threaded; `[]` means "nothing until threaded". |
| `ref` | no | no | Source page + flavour description for the detail modal. Display-only. |
| `threadRanks` | yes | **yes** | Ordered rank entries (§4); the rank-gated effect source. |

### Per-rank entry

| Field | Required | Engine-read? | Meaning |
|---|---|---|---|
| `rank` | yes | **yes** | The 1-based rank. Effects apply when `rank <= owned.threadRank`. |
| `keyKnowledge` | no | no | Test Knowledge the owner must learn to weave that rank (odd ranks typically). Display-only reference. |
| `deed` | no | no | Deed required for legendary ranks. Display-only reference. |
| `effects` | yes | **yes** | Taxonomy effects (empty array allowed). |

---

## 3. The character-side input (store only *inputs*)

Ownership is expressed as an entry in the character's `items` array — never any
derived value (Tier-1 data-model invariant):

```jsonc
{ "name": "Bracers of Aras", "equipped": true, "threadRank": 3 }
```

| Field | Meaning |
|---|---|
| `name` | Must match a catalogue key. Unknown names degrade gracefully (kept, contribute nothing). |
| `equipped` | Default `true`. Unequipped items still appear in the sheet but their effects drop out of the fold. |
| `threadRank` | **The woven-rank input.** `0` (or absent) = no thread woven. Only thread items carry it; plain items never store it. |

`threadRank` is edited through the Equipment tab's rank `<select>` and travels up
via `ed-edit-items` exactly like the `equipped` flag — the store persists the
input, the engine re-derives everything.

---

## 4. Resolution — the model the UI sees

`store.js` `resolveThreadItem` turns the input + catalogue into the resolved item
the UI renders. It emits **two** things with different fates:

1. **`effects`** — engine-read. Computed as
   `base.effects` **plus** the effects of every rank `≤ threadRank`,
   concatenated. For Bracers at rank 3 that's ranks 1–3's effects (rank 4–6
   remain locked).
2. **`thread` block** — **display-only, never engine-read**:
   `{ tier, maximumThreads, mysticDefense, legendary, threadRank, threadRanks }`.
   The UI reads these for the tile sub-line, the rank select, and the modal's
   reference zone (tier / MD / max-threads chips + the per-rank list).

The `thread` block deliberately mirrors catalogue data rather than *being* the
catalogue — the UI never re-derives; it reads what the store resolved.

---

## 5. Every effect attribute, in thread-item context

An effect in a thread rank uses the same object grammar as any other effect
(taxonomy §1). This table expands each field with what it means *here*.

```jsonc
{ "type": "defense-modifier",
  "target": { "domain": "defense", "name": "Physical" },
  "operation": "add", "value": 1, "measure": "rating",
  "condition": "always", "stacking": "replace",
  "source": "thread", "summary": "+1 Physical Defense." }
```

| Field | Required | In thread items |
|---|---|---|
| `type` | always | The dispatch key. Bracers uses `defense-modifier`, `test-modifier`, `note`. A thread *weapon/armour* would use `attack-modifier` / `armor-modifier`; a thread item granting a talent would use `grant-ability`. |
| `target` | modifiers | `{ "domain", "name" }` path — e.g. `{defense, Physical}`. The same `target` across two ranks is what triggers stacking (§6). |
| `operation` | modifiers | `add` / `subtract` / `set` / … — how `value` combines. Thread rank effects are almost always `add`. |
| `value` | modifiers | The magnitude. Numeric for static bonuses; `{ "ref": "…" }` when it mirrors another value. |
| `measure` | modifiers | What the value counts in — `rating` for a static stat (defense/armor), `step`/`result` for tests. The engine applies this as a guard (§7). |
| `condition` | optional (`always`) | `always` folds into static ratings; `situational` is **surfaced, never baked** (§7). Bracers rank 5's +3 Swimming is `situational` + `scope: "1 Strain"`. |
| `scope` | optional | Narrows a situational effect ("1 Strain", "when underwater"). |
| `perSuccess` | optional | `true` when `value` applies per success (rare in thread ranks). |
| `stacking` | optional (`cumulative`) | **The thread-item key** — `replace` (or `highest`) so a higher rank supersedes, never adds (§6). |
| `duration` | optional (`permanent`) | `permanent` default; Strain-powered effects are recorded in the summary rather than a duration. |
| `source` | usually engine-set | `"thread"` — provenance, carried into the fold so tooltips name the source. |
| `gmDiscretion` | optional (`false`) | `true` marks a GM-judgement effect; never auto-applied. |
| `summary` | yes | Human-readable, original wording (no verbatim rulebook prose). The only text the UI shows for an effect. |

`type: "note"` ranks (like Bracers rank 6, *breathe underwater for 2 Strain*)
carry just `type`, `source`, `summary` — no `target`/`operation`/`value`. They
are reference/roleplay entries: the modal shows them, the fold ignores them.

---

## 6. `stacking` — how rank effects combine

**The single most important field for thread items.** Weaving Thread Rank 3 to
the Bracers does *not* add rank 3's +2 PD on top of rank 1's +1 PD — the +2
**replaces** the +1 (GMG p.208). `stacking: "replace"` is how that rule is
expressed in data.

### The modes

| `stacking` | Engine keeps | Typical use |
|---|---|---|
| `cumulative` (default) | every instance | unrelated additive bonuses |
| `highest` | only the largest | Discipline circle progressions |
| `replace` | only the **last** | thread rank progressions |
| `unique` | only the first, across all sources | one-active-only effects |

### How the engine decides

`collapseStacking` (engine/characteristics.js) runs as pass 2 of `applyModifiers`:

1. **`unique`** is resolved first, globally: only the first instance of any
   `unique` effect survives, regardless of origin.
2. Remaining effects are **grouped by their `origin` `kind:name`** — all thread
   ranks of one item share `origin { kind: "thread", name: "<item>" }`, so they
   form one progression. A shield and a thread item have different origins, so
   their bonuses **still add**.
3. Each group is collapsed by its declared mode:
   - `replace` → keep `group[last]`
   - `highest` → keep the max `value`
   - `cumulative` → keep all
4. Effects with no `origin` are their own group (no collapse) — bare engine tests
   keep additive behaviour.

**Bracers of Aras, rank 3 woven:** the fold sees rank 1 `+1 PD`, rank 2 `+1 MD`,
rank 3 `+2 PD`, all under origin `thread:Bracers of Aras`. The PD pair collapses
to `+2 PD` (rank 3 replaces rank 1); `+1 MD` stands → **PD +2, MD +1**. Without
`replace` the engine would wrongly report **PD +3**.

### Authoring rules of thumb

- Mark **every** rank effect that shares a `target` with another rank
  `stacking: "replace"` (or `highest` for "best rank wins"). One consistent mode
  per target per item.
- Two *different* origins always add — that's correct, don't try to prevent it.
- `replace` replaces *on the same target only*; a rank's `+1 MD` (rank 2) and a
  later rank's `+2 MD` (rank 4) replace each other, while `PD` and `MD` never
  collide.

---

## 7. The engine fold — what actually applies

Static derived values (defenses, armor, etc.) go through `applyModifiers` in
engine/characteristics.js, with an explicit auto-apply rule:

- **Only `condition: "always"` and not `gmDiscretion` fold into a static number.**
  `situational` / `on-success` / triggered effects are surfaced in the UI (the
  modal's green/situational treatment) but never silently baked in.
- `measure` is an apply-time **guard**: a `rating`-measure modifier applies to a
  static rating, not to a step or result.
- `set` effects establish the base first (pass 1), then `collapseStacking` (pass
  2) collapses, then `add`/… fold on top.

Equipped thread items contribute their resolved `effects` to the active-effects
fold with `origin { kind: "thread", name, rank }`. Unequipped items keep their
row but contribute nothing.

---

## 8. Legend audit — pricing a woven item

`auditLegendSpent` (engine/legend-spent.js) prices every owned thread item into
a **"Thread Items"** section (`key: "threads"`). The rule: weaving Thread Rank N
costs the **cumulative** talent-rank cost for the item's tier
(`costs.talentRank[1..N][tier]` from rules/legend.json — GMG p.202 correlates
thread ranks to talent-rank costs).

| `threadRank` | Cost |
|---|---|
| `0` / absent | **0** — "no thread woven" (a line still appears so the item is visible) |
| `N > 0` | `Σ cost[1..N][tier]` |
| unknown `tier` | `null` — **unpriced**, never a fabricated number (shown as `—`) |

**Bracers of Aras (Journeyman), rank 3:** 200 + 300 + 500 = **1,000** Legend.

The section feeds `spent.total`, so `legend.available = totalEarnt − spent.total`
shrinks by the threaded item's cost — the reconciliation delta on the Overview
Legend panel picks this up automatically.

---

## 9. Worked example — Bracers of Aras

| Rank | Key knowledge (display) | Effect | Folds? |
|---|---|---|---|
| 1 | learn the item's Name | `+1 PD` (`replace`) | ✅ always |
| 2 | — | `+1 MD` (`replace`) | ✅ always |
| 3 | learn the mine's Name | `+2 PD` (replaces rank 1's +1) | ✅ always |
| 4 | — | `+2 MD` (replaces rank 2's +1) | ✅ always |
| 5 | learn the water/air ratio | +3 Swimming (`situational`, 1 Strain) | ⛔ surfaced only |
| 6 | — | breathe underwater 10 min (2 Strain) | ⛔ `note` |

Weave rank 3 → **PD +2, MD +1**, and the audit reports **1,000** Legend. Weave
rank 6 → the always-on ranks 1–4 collapse to **PD +2, MD +2**; ranks 5–6 stay in
the modal as situational/reference text, never folded.

---

## 10. Adding a new thread item — checklist

1. Add the entry to `rules/thread-items.json` `items`, `kind: "thread-item"`,
   keeping the existing shape (no schema change — Tier 3 data).
2. Set `tier` from the tier table (drives Legend pricing); add
   `maximumThreads` / `mysticDefense` / `ref` for display.
3. Write `base.effects` (empty for a mundane-until-threaded item) and ordered
   `threadRanks`, each effect in taxonomy vocabulary with a `summary`.
4. Mark rank effects that share a `target` `stacking: "replace"` (or `highest`).
5. Verify: `npm test` green; spot-check the derived value (fold) and the Legend
   audit line (cumulative tier cost) for a representative rank.

> Changing the *shape* of the item entry, renaming fields, or editing the
> taxonomy vocabulary is **Tier 1 / Tier 2** — stop and surface it
> (CLAUDE.md, CHANGE PROTOCOL).
