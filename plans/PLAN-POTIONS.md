# Plan: Consumable Potions + Item Quantity (Equipment)

Status page for the **potions** slice: drinking a potion consumes one dose of the
item (removing the last one edits the `character.items` list), and bestows its
one-shot benefit — the core example, **Booster Potion**, arms a **+8 step** on
the **next Recovery test**. The same engine drives the whole consumable pattern
for healing aids, plus a companion change: **items can be owned in quantity**
(one row per item with an amount), which the consume flow decrements. This file
is the **living status page**: tick a step `[x]` and set its **Status** when it
lands, append to [Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner.
- **Created:** 2026-08-13. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `8470483` — clean working tree, **459/459 tests pass**.
- **Source rules:** Earthdawn 4E Player's Guide (Alchemy / Healing Aids), as
  encoded in `rules/items.json` — the four `* Potion` entries are the reference
  mechanics; this plan makes them *run*.

---

## Scope

Two cooperating slices:

1. **Consumable potions** — the Equipment tab can show a **`Use/Drink` action on a
   consumable item row** (and the Combat tab offers the same via its Potions
   dropdown) that:
   - decrements the potion's quantity (removes the entry when the last dose
     goes), persisted through the normal `ed-edit-items` / overlay path;
   - arms the potion's **one-shot benefit** as *session-only* pending state
     (dies on reload — same contract as the Combat tab scratchpad);
   - applies any **immediate** benefit (Healing Potion heals 1 Wound now).
2. **Item quantity** — `character.items` entries gain `qty` (default 1); the
   Equipment tab manages the amount; weight, equip reshapes and consumption all
   respect it. **Model: one row per item name with a quantity** (owner-agreed).

### The four potions

| Potion | kind | v1 behaviour on Consume |
|---|---|---|
| Booster Potion | `healing-aid` | Arm **+8 step** on the next Recovery test. |
| Healing Potion | `healing-aid` | Heal **1 Wound** now (or **warn** when there is nothing to heal — see below); **then** arm **+8 step** on the next Recovery test, **or** — when **0 Recovery tests remain** at drink time — arm an **emergency "Heal only" roll** (immediate Step 8 Recovery test, **no** test budget) surfaced as an Active Effects row. |
| Cure Disease Potion | `healing-aid` | Consume-only **+ Roll-Log action entry**; no dice (the app has no disease surface yet). |
| Halt Illness Potion | `healing-aid` | Consume-only **+ Roll-Log action entry** (8h-note recorded). |

**Consume always logs + decrements.** Every Consume — even a no-effect one (Cure
Disease / Halt Illness, or a Healing Potion drunk with no Wound and no damage) —
**writes the Roll-Log entry and decrements `qty`**. A dose is spent whether or not
it did anything. The consume log is **device-local and survives reloads** — the
same `localStorage` Roll Log (`store-rolllog.js`) as the Combat log's Stand-up
actions, *not* the session-only pending state; the qty decrement is a persisted
item input.

### Decisions recorded (owner-confirmed)

- **ALL healing-aid `test-modifier`s are STEP increases, never result mods
  (owner decision, firm — not up for veto).** *Every* `healing-aid`
  `test-modifier` in `rules/items.json` uses `measure: "step"`. This corrects
  **all three** entries that currently say `measure: "result"`:
  - **Booster** — Recovery +8 (items.json:3313)
  - **Healing** — Recovery +8 (items.json:3393)
  - **Cure Disease** — resist-disease Action +5 (items.json:3339)

  Note that flipping Cure Disease from `result` to `step` is a real mechanical
  buff (+5 **steps** on the resist test, not +5 to the result) — this is
  intended. **Kelix's Poultice (items.json:3447) is *not* a step**: its +5
  applies only under a Poison-resist test (not every condition), so the poultice
  stays a **note-only** aid (its `test-modifier` becomes a `note` — see Phase
  B.2). Note-only aids (Kelix's, Halt Illness, Kelia's Antidote, Last Chance
  Salve, Salve of Closure) carry no `test-modifier` and need no change. **Any
  future healing-aid added to the catalog with a `test-modifier` must use
  `measure: step`** — no `measure: result` on a `healing-aid` test-modifier,
  ever.
- **No stacking — consume one at a time.** At most **one** armed recovery entry
  (step-boost *or* emergency) exists per character at a time. `_usePotion`
  **blocks** a second consumable that would arm while one is already armed, with a
  warning that the pending one must be used or cleared first. (This replaces the
  earlier "stacking sums (+16)" idea — dropped.)
- **Thread items are always `qty: 1`.** Thread items are unique. The quantity
  model never applies to them: the picker increment and the row stepper are
  **suppressed** on thread-item rows, and `qty` is not written for them.
- **Equip is all-or-nothing per stack.** A row's single `equipped` flag governs
  the whole quantity — equipping a potion equips all `N` of them; there is no
  partial equip of a stack.
- **Healing Potion with nothing to heal warns.** When a Healing Potion is drunk
  with **0 Wounds and 0 damage**, the confirm dialog warns that the heal does
  nothing; on confirm the dose is still spent (logged + decremented), and the
  Recovery arm still applies per the normal branch.
- **Pending boost state is session-only** — module memory in `ed-app`, keyed per
  character; survives tab switches, cleared on reload, character switch, manual
  clear, and the new-day reset.
- **No-recoveries branch decides at drink time** using
  `recoveriesRemaining(recoveriesUsed, maxRec)` (engine/health.js:87): a
  *confirmed* `0` arms the emergency; anything else (incl. `null`/unknown max)
  arms the +8 step.
- **No stacking (see above)** — one armed entry at a time; a second drink is
  blocked while one is pending.
- **Booster at 0 remaining is HARD BLOCKED (owner update 2026-08-14).** A pure
  step-boost aid drunk with no Recovery tests left has nothing to boost, so the
  confirm dialog **disables Drink** and states "no Recovery tests left — this
  potion would have no effect; drinking it is blocked." The dose is **not** spent
  and nothing is logged (this is the one exception to always-consume — a no-op
  drink is refused, not wasted). `ed-app._usePotion` refuses it as the fail-safe.
  Healing at 0 still arms its emergency heal; only pure boosts are no-effect.
  `engine/potions.boostHasNoEffect()` is the single decision point.
- **Potions can be consumed whether equipped or stored** — the Combat tab's
  Potions dropdown lists *all* owned potions (equipped or stored) for a drink;
  the Equipment tab's `Use/Drink` button appears on owned consumable rows.
- **Quantity adds** happen from the existing search picker (+1 per pick of an
  owned item, the current duplicate no-op becomes an increment) and a row
  stepper; `✕` still removes the whole entry (no per-dose remove for now).
- Expiry of a stale boost (armed, never rolled): **manual clear pill** + the
  existing **new-day reset** (`ed-edit-health { recoveriesUsed: 0 }`).

---

## Guardrail classification

| Concern | Class | Why |
|---|---|---|
| `rules/items.json`: add `consumable` block to the four potions + set all three `healing-aid` `test-modifier`s to `measure: step` (Kelix's becomes a `note`) | ✅ Tier 3 | Additive data within the existing entry shape; `step` is already valid `measure` vocabulary. **No `schema`/`effectTaxonomy` tag change, no taxonomy bump.** |
| `character.items` `qty` (+ default 1; **thread items pinned to 1**) | ✅ Tier 3 | Additive within the item-input shape; `qty` is an input, never derived. |
| New pure `engine/potions.js` (consume reshape, armed-bonus read, emergency spec) | ✅ Tier 3 | Pure, DOM-free, new module; computes nothing the store persists. |
| Session-only pending boost in `ed-app` (no overlay category, no worker change) | ✅ Tier 3 | Same ephemeral contract as the Combat scratchpad and armed blood charms. |
| Quantity plumbing: `store.js` forward, `engine/weight.js` multiply, `item-equip-state.js` reshapes | ✅ Tier 3 | Inputs-only reshapes; no stored derived values. |
| Equipment tab (stepper, Use button, pending pill), Overview/Combat recovery hints, Active Effects emergency row | ✅ Tier 3 | New content within the Tabs — must **hold** the Tier-1 rules below. |
| Effect taxonomy | ✅ Untouched | Stays **v3, no bump**; `test-modifier`/`step` are existing vocabulary. |

**Tier-1 invariants this plan must not break:**
- **Store only inputs** — the pending boost is session state (never written); the
  +8 step is derived at roll time from the pending entry + item data; `qty` and
  the post-consume item list and the wound heal are inputs. Nothing derived lands
  in `character.json`.
- **Data flows down, events flow up** — equipment/overview/combat dispatch
  (`ed-use-potion`, `ed-clear-pending-use`, `ed-edit-items`, `ed-edit-health`,
  `ed-roll`); `ed-app` owns the session state, the roll-step bump and all
  persistence; `engine/potions.js` + `engine/health.js` compute the values the
  app applies. Views never compute a game value.
- **Overview fits the desktop viewport without vertical scroll (UI-GUIDELINES
  §1)** — the Active Effects strip gains a transient emergency row; the strip's
  scroll bound holds it.
- **Derived values render as placeholder pills / never a fabricated number** —
  recovery hints and the emergency row render only while armed (session state),
  and the emergency's Step 8 comes from the item's data (a rule constant), never
  a hardcoded view literal.
- **Modals honor Escape-closes / Enter-confirms** — the consume confirmation (and
  existing swap/health modals) follow it.
- **Theme-aware, two font weights (400/500), relative `./…` paths.**

---

## Phase A — Item quantity: data + plumbing + Equipment UI

1. **`store.js` item resolution** (store.js:659-678) forwards `qty`:
   `qty: owned.qty ?? 1` (default 1), so the model items carry it. **Thread items**
   (the `resolveThreadItem` branch, store.js:660) are **pinned to `qty: 1`** — the
   quantity model never applies to unique items.
2. **`engine/weight.js`** `carriedWeight` multiplies each entry by its `qty`
   (weight.js:58-69): carried += `w * qty`; the **`unweighed` count also scales by
   `qty`** (a stack of 3 unknown-weight items reports **3** unknown, not 1), so the
   UI never under-reports.
3. **`ui/item-equip-state.js`** — new pure `bumpQuantity(items, name, delta)`:
   returns the next input list with `delta` applied to the named entry's `qty`,
   **removing the entry when it would reach 0**. **Thread-item names are a no-op**
   (unique, stay at 1). `equipArmour` / `applyArmourSwap` / `unequipSpentCharms`
   forward `qty` untouched when they rebuild entries.
4. **`ui/ed-equipment.js`**
   - `_add(name)` (ed-equipment.js:364): an already-owned **non-thread** name now
     **increments `qty`** via `bumpQuantity(..., +1)` instead of the current no-op;
     picker `.owned` result rows stay clickable and read "Owned ×N". Owned **thread
     items** keep the current no-op (no quantity).
   - `_itemRow` (ed-equipment.js:469): non-thread rows show `×N` and, in edit
     mode, a `− N +` stepper (aria-labels, dispatches `ed-edit-items` through the
     existing `_commitItems`); the stepper is **omitted on thread-item rows**. `✕`
     still removes the entry entirely.
5. **Validation/tests** — `weight` ×qty (carried **and** unweighed count), thread
   item stays `qty: 1` / weighs once, `bumpQuantity` (increment, decrement to
   remove, thread-name no-op, forward through
   `equipArmour`/`unequipSpentCharms`), `store` forwards `qty` default 1 and pins
   thread items to 1.

## Phase B — Catalog: consumable marker + measure correction

1. **`rules/items.json`** — add a `consumable` block to the four potions and a
   short `notes` note:
   - Booster: `"consumable": { "use": { "armNextRoll": true } }`
   - Healing: `"consumable": { "use": { "armNextRoll": true, "healWounds": 1,
     "emergencyHeal": { "step": 8 } } }` *(shipped: the emergency Step lives in
     data, not a `…Allowed: true` flag — see Issues & learnings)*
   - Cure Disease / Halt Illness: `"consumable": { "use": {} }`
2. Set **every `healing-aid` `test-modifier`** to `measure: "step"` — the three
   result→step flips are **Booster** Recovery (items.json:3313), **Healing**
   Recovery (items.json:3393) and **Cure Disease** resist-disease Action
   (items.json:3339). In addition, **convert Kelix's Poultice's `test-modifier`**
   (items.json:3447) **to a `note`** — its +5 applies only while resisting
   poison, not to every condition, so as data it is a note, not a step modifier.
   Note-only aids (Kelix's, Halt Illness, Kelia's Antidote, Last Chance Salve,
   Salve of Closure) carry no `test-modifier` and are left as-is. **Verify with a
   grep** that no `healing-aid` block still contains `"measure": "result"` before
   closing this phase.
3. **`store.js`** forwards `consumable: ref?.consumable ?? null` in item
   resolution (used by the Use button + engine).
4. Run the worker `validate-item` gate + `npm test` to confirm `measure: step`
   `test-modifier`s and the Kelix's `note` conversion pass validation.

## Phase C — Engine `engine/potions.js` (new, pure)

- `consumePotion({ items, name })` → next items input list: decrement the named
  entry's `qty` (removes it at 0). Reuses `item-equip-state.bumpQuantity`.
- `armedRecoveryBonus(pending)` → `{ stepBonus, emergency }`:
  - `stepBonus`: the single armed `step-boost` entry's value (reads the potion's
    Recovery `test-modifier measure: step` value via the catalog — Booster 8 /
    Healing 8), or `null` when none armed (no stacking — one entry max);
  - `emergency`: the armed emergency spec `{ step: 8 }` or `null`.
  All values derived from `rules/items.json`, never hardcoded in the view.
- Constants for the new-day/manual clear + per-character reset (pure, no closure
  state here — the session lives in `ed-app`).

## Phase D — `ed-app`: session pending + consume + roll wiring

1. **Session pending** — module-memory map keyed by `characterId`, holding **at
   most one** armed recovery entry per character (no stacking):
   `{ name, kind: 'step-boost'|'emergency-heal', value, step, at }`
   (reuse the SCRATCH-map pattern from `ui/ed-combat.js`). Cleared on reload
   (module reset), character switch (`_loadCharacter`), manual clear, and when a
   health edit zeroes `recoveriesUsed` (the new-day reset path). Consume-only
   potions (Cure Disease / Halt Illness) **do not** create a pending entry — they
   log + decrement only.
2. **`_usePotion(name)`** handler for a new `ed-use-potion` event:
   - guards: potion exists, `consumable` marker, owned (`qty ≥ 1`) — equipped
     **or** stored;
   - **no-stacking guard:** if a recovery entry is already armed for this
     character **and** this potion would arm another, **block** with a warning
     ("use or clear the pending Recovery boost first") and do nothing (no
     decrement, no log). Consume-only potions are exempt (they never arm).
   - decides the arm: for Healing, `recoveriesRemaining(...) === 0` (confirmed)
     → **emergency** arm; otherwise/other arming potions → **step-boost** arm;
   - applies immediate **wound heal** (`applyHealth({ wounds: -1 })`) for Healing
     **only when there is a Wound to heal**; when Healing is drunk at **0 Wounds
     and 0 damage**, no heal is applied but the dose is **still** spent (the UI
     confirm already warned — see Phase E);
   - **always** persists the item decrement (and any wound heal) through the
     existing `saveItemEdits`/`saveHealthEdits` + `_character` + one `deriveModel`
     pass, and **always** pushes the Roll-Log **action** entry for the consume
     (same mechanism as the Combat tab's stand-up action) — even for a no-effect
     consume;
   - for an arming potion, sets the single session pending entry.
3. **`ed-roll` assembly for recovery** (ed-app.js:218-244): when
   `apply.action === 'recovery-heal'` and `armedRecoveryBonus(pending).stepBonus`,
   roll at `detail.step + stepBonus` (lookup `stepRow` at the bumped step so the
   dice + log show it).
4. **`ed-roll-apply`** (ed-app.js:282-307):
   - `recovery-heal` (existing): on a **successful** apply, clear the armed
     step-boost — the boost survives a refused roll (0 remaining guard
     returns before the heal). *Matches "stays until rolled AND recorded".*
   - `emergency-recovery-heal` (new): heal `applyHealth({ damage: -result })` —
     **no** `recoveriesUsed` increment — clear the emergency entry, close. Fail
     closed if no emergency pending (a stale modal can't grant a budget-free
     heal).
5. **`ed-clear-pending-use`** event clears a session entry by name (the pill's ✕).
6. Pass a curated `arming` property down to the tabs (the single armed boost,
   emergency spec, consume-able potion names) derived from session +
   `model.itemCatalog`.

## Phase E — UI surfacing

1. **Equipment** (`ed-equipment.js`):
   - `Use/Drink` button on **equipped** rows whose item has a `consumable`
     marker → confirm dialog (Escape/Enter) → `ed-use-potion`. The dialog carries
     a **warning line** when relevant: (a) Healing Potion with **0 Wounds + 0
     damage** — "nothing to heal; the dose will still be spent"; (b) any arming
     potion when a recovery entry is **already armed** — "a Recovery boost is
     already pending; use or clear it first" (and the confirm is disabled, since
     `_usePotion` will block it).
   - **Pending pill** row for armed session entries (name + "next Recovery +8"
     / "Heal only (Step 8)") with a ✕ dispatch `ed-clear-pending-use`.
2. **Combat — Potions section** (`ed-combat.js`): keep the **Defence & Armour**
   card (`_defArmourSection`, ed-combat.js:688) intact, and **split the row it
   occupies in two**: the Defence & Armour card keeps the left cell, a new
   **Potions** card takes the right cell — the two sit **side by side, at the
   same vertical level**, replacing the single full-width Defence & Armour card
   (`.left` stack: Your attack → [Defence & Armour | Potions] → Combat
   Modifiers). The Potions card holds a `<select>` listing **every owned potion**
   (equipped or stored, from the model items with a `consumable` marker, showing
   `×N`) plus a **Drink** button; picking one arms a confirm (Escape/Enter) then
   dispatches `ed-use-potion` with the selected name. Render the session
   **pending pill** here too (name + "next Recovery +8" / "Heal only (Step 8)" +
   ✕ → `ed-clear-pending-use`). Both cells share the existing `dabrow`/`dablk`
   block styling; each `blk` stretches to the row height. On narrow screens the
   pair folds into two stacked full-width cards (mirrors the existing mobile
   behaviour — UI-GUIDELINES §1 applies to Overview only, no viewport
   constraint on the Combat tab).
3. **Overview Active Effects** (`ed-overview.js:737` `_activeEffects`): render
   the session **emergency** entry as a row — "Healing Potion — Step 8 heal, no
   test" with a `⚄` roll button (mirrors the `.stand` affordance) dispatching
   `ed-roll { step: emergency.step, apply: { action: 'emergency-recovery-heal' } }`.
   No new row while empty; strip scroll bound holds (UI-GUIDELINES §1).
4. **Recovery buttons** (Overview ed-overview.js:544, Combat ed-combat.js:806):
   when an armed boost exists, surface a `+8` hint/aria and (Combat) the stat
   line; dispatch unchanged (the step bump lives in ed-app).

## Phase F — Tests, changelog, docs

1. **Tests**
   - `engine/potions.test.js`: consume decrement + remove-at-0; arm decision
     (step-boost vs emergency at confirmed-0); `armedRecoveryBonus` returns the
     single boost + emergency spec (no summing).
   - `engine/weight.test.js`: ×qty on carried **and** unweighed count.
   - `ui/item-equip-state.test.js`: `bumpQuantity` (increment / decrement-to-
     remove / **thread-name no-op**), qty forwarded through
     `equipArmour`/`unequipSpentCharms`.
   - `store`/`store-weight`: `qty` default 1 forwarded; **thread items pinned to
     1**.
   - Flow tests: apply `ed-use-potion` → items decremented + pending armed +
     (Healing) 1 Wound healed; **no-stacking block** (second drink refused while
     armed, no decrement/log); **no-effect consume** (Cure Disease, or Healing at
     0 Wounds/0 damage) still logs + decrements; recovery roll lands at boosted
     step; successful apply clears pending; emergency apply heals without using a
     test; new-day / manual clear clears pending.
2. **`data/changelog.json`** — unreleased entry for potions + item quantity.
3. **Docs** — point `docs/ARCHITECTURE.md`/`rules/items.json` `notes` at the
   consumable semantics; keep `UI-GUIDELINES` Tab contents note in sync if the
   Equipment/Overview copy changes.

---

## Open assumptions (owner can veto)

- **No stacking** — one armed entry at a time; a second drink is blocked until the
  pending one is used or cleared (owner-decided 2026-08-14).
- **Thread items are always `qty: 1`** — no stepper, no increment (owner-decided).
- **Equip is all-or-nothing** — one `equipped` flag per stack governs all `N`
  (owner-decided).
- **Every Consume logs + decrements**, even a no-effect one (owner-decided); the
  log is **device-local and survives reloads** (the `localStorage` Roll Log), the
  decrement is a persisted input.
- **Healing with nothing to heal** warns in the confirm but still spends the dose
  (owner-decided).
- **All `healing-aid` `test-modifier`s are `measure: step`** — firm, no veto;
  includes Cure Disease, **excludes Kelix's Poultice** (a note — resist-poison
  only), and binds any future healing-aid with a `test-modifier`.
- Booster (pure step-boost) at 0 remaining is hard-blocked — the confirm's Drink
  is disabled and the dose is NOT spent (owner update 2026-08-14).
- Stored potions are consumable from the Combat Potions dropdown (equipped-only
  restriction dropped — see Decisions).
- `✕` removes the whole entry; the stepper is the fine-grained control.
- Emergency "Heal only" only arms when the Healing Potion is drunk at a
  **confirmed** 0 remaining; at ≥ 1 it arms the +8 boost instead.

**Deliberately out of v1:** Cure Disease 24h passive / fresh Resistance test and
Halt Illness 8h note (consume + log only); persisting the armed boost across a
reload (session-only per decision); per-dose remove via `✕`; custom
healing-aid consumption beyond what the `consumable` marker naturally enables.

---

## Issues & learnings

- **Emergency step moved into data.** The marker is `emergencyHeal: { step: 8 }`
  (not the planned `emergencyHealAllowed: true`) so the Step 8 is a rule constant
  read from `rules/items.json`, honouring "never a hardcoded view literal."
- **`consumePotion` lives in `engine/potions.js` standalone** (a tiny inline
  decrement), *not* importing `ui/item-equip-state.bumpQuantity` — the engine
  must not depend upward on the ui layer. The ui stepper still uses
  `bumpQuantity`; the two are behaviourally identical and both unit-tested.
- **Kelix's Poultice became a `note`** (resist-poison only), so the "all
  healing-aid `test-modifier`s are step" rule holds with no odd +5-step resist
  buff on a conditional aid.
- **`ed-confirm` gained `warn` + `disabled`** (optional, backward-compatible) to
  carry the consume warnings and block the drink when already armed — a small
  shared-component extension; still Escape-closes / Enter-confirms.
- **Read-mode `×N` shows only when qty > 1.** Plain single items (swords, armour)
  are not decorated with `×1`; the Edit-mode stepper is always available. The
  owner-reviewed mock showed `×1`, but suppressing it keeps the whole Equipment
  tab clean — flag if `×1` everywhere is wanted.
- **Pending pill is anchored to the Charms & Consumables section** (not the
  drunk item's row) so it survives after the last dose is gone.
- **ed-app flow not unit-tested.** The repo has no Lit component-test harness
  (ui tests cover only pure state modules), so the `_usePotion` orchestration
  (stacking block, new-day clear, roll bump) is exercised through its pure pieces
  (`engine/potions.test.js`, `store-weight`, `item-equip-state`) rather than an
  end-to-end ed-app test. In-browser verification still pending (owner's standing
  UI-verification preference).

## Progress log

- **2026-08-14 (fix)** — Emergency heal was only triggerable from the Overview
  Active Effects row; from Combat/Equipment (where you drink the potion) the
  pending pill had no roll affordance. Added a **⚄ Roll** button to the
  emergency pending pill on **both** the Equipment and Combat pills (mirrors the
  Overview row, dispatches `emergency-recovery-heal`), plus an **informational
  confirm warning** when a Healing Potion is drunk at 0 Recovery tests ("heals a
  Wound now and arms an immediate Step 8 heal — roll it from the pill / Active
  Effects"). The drink is allowed (not blocked); only the pure-boost no-effect
  case blocks.
- **2026-08-14** — Phases A–F implemented on `dev`. Data + plumbing (store `qty`
  + `consumable`, weight ×qty, `bumpQuantity`), catalog (consumable markers, all
  healing-aid modifiers → `measure: step`, Kelix's → note), new pure
  `engine/potions.js`, ed-app session pending + consume + roll wiring, and UI
  surfacing (Equipment stepper/Use/pending pill, Combat Potions card, Overview
  emergency row + recovery hints). **479/479 tests pass** (was 459; +20). JSON
  and syntax checks clean. Not yet verified in-browser.