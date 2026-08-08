# Plan: Damage & Healing (Overview)

Status page for **running a character through combat**: track current damage on
the Overview, take damage, heal it (manually or via a Recovery test roll), and
see where the character stands against their Unconsciousness / Death / Wound
Threshold ratings. This file is the **living status page**: tick a step `[x]`
and set its **Status** when it lands, append to
[Issues & learnings](#issues--learnings) and the [Progress log](#progress-log),
and keep it in sync with the code.

- **Owner:** repo owner.
- **Created:** 2026-08-08. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `8454a46` (release v1.7.0) — clean working tree, **142/142 tests pass**.
- **Source rules:** Earthdawn 4E Player's Guide (Health section) + fasa.wiki/4E:
  - Current Damage ≥ Unconsciousness Rating → **unconscious**; ≥ Death Rating → **dead**.
  - **Wound Threshold** = the damage it takes to wound from a single attack (the
    characteristics table `wound` column). Wounds heal more slowly than normal
    damage and impair actions — **penalties deferred** this slice; tracking only.
  - **Recovery test** = an open-ended **Effect test** at the character's
    **Toughness step**; **the result is the damage healed**. Each test spends one
    of the per-day **Recovery Tests** resource; a test may alternatively heal a
    Wound.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| `resources.health` inputs (`damage`, `wounds`, `recoveriesUsed`) | ✅ Tier 3 | Already the stored input shape (`data/characters.json`); we only add an edit path + a derived readout. Adding data within the shape is Tier 3. |
| New engine derivation (`woundThreshold`, `damageState`) | ✅ Tier 3 | Pure, DOM-free module; mirrors `engine/characteristics.js`. `WoundThreshold` is already in the taxonomy v3 `characteristic` vocabulary — no taxonomy change. |
| Store `saveHealthEdits` overlay + SAVED_CATEGORIES | ✅ Tier 3 | Same pattern as `saveMetaEdits`/`saveItemEdits`/`saveWealthEdits`; inputs only. |
| Overview UI (edit fields + damage modal) | ✅ Tier 3 | New content within the Health panel — must **hold** the Tier 1 rules below. |
| Effect taxonomy | ✅ Untouched | Stays **v3, no bump**. No new effect types needed. |

**Tier-1 invariants this plan must not break:**
- **Store only inputs** — current damage / wounds / recoveries-used stay raw
  inputs; *remaining*-to-threshold and conscious state are engine-derived.
- **Overview fits the desktop viewport without vertical scroll** — the Health
  panel gains a Wound Threshold line + a status chip; the panel must not outgrow
  its column. Read-view height is a verify item (§ Phase C risk).
- **Derived values render as muted dashed placeholder pills, never a fabricated
  number** — `woundThreshold` and the state chip are engine values; if the engine
  hasn't computed them, show the pill, never a guess.
- **Data flows down, events flow up** — the panel dispatches `ed-edit-health`;
  `ed-app` persists and re-derives. The engine stays pure and DOM-free.
- **Modals honor Escape-closes / Enter-confirms** (UI-GUIDELINES §7) — the damage
  modal is a new modal and must follow the contract.
- **Theme-aware, two font weights (400/500), relative `./…` paths.**

---

## Confirmed decisions (owner answers, 2026-08-08)

1. **Both edit paths** — the Health panel gets **edit-mode number fields** for
   precise editing (matching the existing click-to-edit pattern) **and** a
   compact **damage modal** available in read mode for mid-session use.
2. **Healing = manual heal + Recovery test roll** — a manual "heal X" reducer,
   plus a one-tap **Recovery test** that rolls the open-ended Effect test at
   Toughness step (reusing `ed-roll-modal`); the result is applied to current
   damage and the action records +1 `recoveriesUsed` against the derived
   per-day max.
3. **Slice = damage + thresholds + state** — Wound Threshold is derived (new
   engine line), the panel shows a **conscious/unconscious/dead** state readout,
   and wounds are tracked. Wound *penalties* are deferred to a later slice.

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--engine) | `woundThreshold()` + `damageState()` | ✅ Complete |
| [B](#phase-b--store-wiring) | derive both; `saveHealthEdits` overlay | ✅ Complete |
| [C](#phase-c--overview-ui) | Health panel fields + damage modal + Recovery test | ✅ Complete |
| [D](#phase-d--tests) | engine + store overlay tests | ✅ Complete |
| [E](#phase-e--docs-verification) | Plan doc, changelog, verification, push | 🔄 In progress |

---

## Phase A — Engine

- [x] A1. **`woundThreshold(toughnessValue, effects, lookup)`** in
      `engine/characteristics.js`, mirroring `recoveryTests` (`healthRating` with
      the taxonomy name `WoundThreshold`; the `wound` column is already in
      `rules/characteristics.json`). Clamps above the table like the others.
- [x] A2. **`damageState(inputs, ratings)`** in a new `engine/health.js` (keeps
      session-state logic out of `characteristics.js`), pure + DOM-free:
      - inputs: `{ damage, wounds }`; ratings: `{ unconsciousness, death }` (the
        derived `{value}` objects).
      - returns `{ damage, wounds, state, toUnconscious, toDeath }` where
        `state` ∈ `'unhurt' | 'conscious' | 'unconscious' | 'dead'` and the
        `to*` fields are the remaining headroom (`max(0, rating − damage)`).
      - null-safe: missing ratings → `state: null` (UI shows the pill, never a
        fabricated readout — Tier 1).

## Phase B — Store wiring

- [x] B1. `store.js` `deriveModel`: add
      `woundThreshold: woundThreshold(touVal, healthEffects, lookupChar)` to
      `characteristics`, and a top-level `damageState` built from
      `character.resources.health` + the derived `unconsciousness`/`death`.
- [x] B2. **`saveHealthEdits(health, id)`** — merges the health input object into
      the edits overlay (`edits.health`), same shape as `saveWealthEdits`.
- [x] B3. Add `'health'` to `SAVED_CATEGORIES`; extend `applyEdits` to merge
      `edits.health` into `character.resources.health`.

## Phase C — Overview UI (`ui/ed-overview.js`)

- [x] C1. **Read view** (footprint-safe — see risk):
      - Health panel gains a **Wound Threshold** line (`this._char('woundThreshold')`).
      - **Damage** row shows `current` (input) with the derived **state chip**
        (`conscious`/`unconscious`/`dead`/pill) on the same row or the panel
        heading — compact, single line.
      - **Recoveries** row becomes `used / max` (used = input, max = derived),
        keeping one line.
- [x] C2. **Edit-mode fields** — in edit mode, Damage / Wounds / Recoveries-used
      swap to small number inputs (pattern: the thread-rank `<select>` in
      `ed-equipment.js`); a change dispatches `ed-edit-health` with
      `{ damage, wounds, recoveriesUsed }`.
- [x] C3. **Damage modal** — a compact `✚` affordance on the Health panel
      (hover-revealed like the `.info` icons; always visible on touch) opens it.
      Contents: **Take damage** (`+`), **Heal** (`−`), **Recovery test** button,
      and a wounds stepper. Confirms on Enter, closes on Escape (§7).
      - **Recovery test**: dispatches `ed-roll` (label `"Recovery test"`, step =
        Toughness step, open-ended) → the existing roll modal shows the result;
        the roll modal now carries a generic optional **`apply`** property and
        emits `ed-roll-apply` `{ action, result }`. For a Recovery test the Apply
        button **one-taps the result**: `ed-app` heals that amount and records
        +1 `recoveriesUsed` via the pure `applyHealth`, then closes the roll
        modal — no manual typing, per the owner's "manual heal + Recovery roll"
        choice. (`ed-roll-modal` itself stays a generic roll display; the Apply
        button is opt-in per roll.)
- [x] C4. `ed-app.js` — `_editHealth(health)` handler (replace `resources.health`,
      `saveHealthEdits`, mark dirty, re-derive) + the `ed-edit-health` listener.

> **Risk (Tier 1):** adding a line to the Health panel can push the left stack
> past the viewport (UI-GUIDELINES §1). Mitigations: fold the state chip into
> the existing Damage row; keep Wound Threshold as the only new line; verify the
> Overview still fits with no vertical scroll in both light/dark modes before
> closing.

## Phase D — Tests

- [x] D1. `engine/health.test.js` — `woundThreshold` Chakka anchors (Tou 17 →
      11), effect application, off-table clamp; `damageState` boundaries
      (unhurt/conscious/unconscious/dead, `toUnconscious`/`toDeath` headroom,
      null-rating guards).
- [x] D2. Store overlay test — `saveHealthEdits` round-trip, `'health'` in
      `SAVED_CATEGORIES` (dirty flag), `applyEdits` merge, `deriveModel` exposes
      `woundThreshold` + `damageState`.

## Phase E — Docs, verification

- [x] E1. `data/changelog.json` — `unreleased.changes` gains an `added` entry
      (track current damage on the Overview; take damage, heal, Recovery tests).
- [x] E2. `node --check` on touched JS; full test suite green (142 + new).
- [x] E3. Verify Tier 1: Overview fits viewport (no vertical scroll) with the new
      line/chip in light + dark; pills not numbers when ratings are absent;
      modal Escape-closes / Enter-confirms; theme-aware.
- [ ] E4. Commit to `dev`, push. Release v1.8.0 per WORKFLOW.md when owner calls it.

---

## Issues & learnings

- **C3 deviation (improvement):** the plan said the player *types* the rolled
  result as the heal amount; implemented as a **one-tap** Apply button instead —
  the roll modal gained a generic opt-in `apply` property (`{ action, label }`)
  and emits `ed-roll-apply` with the resolved total; `ed-app` applies it through
  the pure `applyHealth`. The roll modal's own roll/karma logic is untouched, so
  it stays a generic display for every other roll type.

## Progress log

| Date | Change | Result |
|------|--------|--------|
| 2026-08-08 | Plan created; owner answered 3 scope questions (Both edit paths / Manual heal + Recovery roll / Damage + thresholds + state) | Baseline `8454a46`, 142/142 tests |
| 2026-08-08 | Phases A–D + E1–E3: engine (`woundThreshold`, `damageState`, `applyHealth`), store overlay (`saveHealthEdits`, SAVED_CATEGORIES, `applyEdits`), Overview Health panel + damage modal + one-tap Recovery test; 15 new engine tests + 5 new store tests | 162/162 tests pass |
