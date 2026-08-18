# Plan: end-of-day reset for recoveries, combat state, and damage/wounds

This plan covers a single, owner-reviewed function that resets a character to a new day state. It is intentionally a plan only; no implementation yet. **Reviewed 2026-08-17 — owner decisions A–K are recorded in the Owner decisions section below and are normative for this plan.**

The reset is triggered from two places:
- the Overview Health panel
- the Combat Damage-taken rail

The affordance is a circular icon in the app's heal green, consistent with the roll-dice / take-damage circular icons, signalling a "new-day" action rather than a negative removal action.

The function does three things:
1. resets recoveries to 0
2. clears all combat options and armed options — armed options, situational chips, blood charms, transient state, and any armed healing aid — **unconditionally when the reset finalizes** (decision H)
3. if there is damage (or, once damage is 0, wounds) and remaining recoveries, prompts the user to spend the remaining recoveries before the day resets

This is a read/write UI + engine change around existing state inputs (`resources.health`, combat option selections, rollback of day-scoped session state). It is not a schema change, not a taxonomy change, and does not add a new stored "reset" field. (Decision I drops the app-level `knockedDown` runtime input from persisted health — an app change, not an `ed-character/1` shape change: the field never appears in the schema files.)

- **Owner:** repo owner.
- **Created:** 2026-08-17. **Reviewed:** 2026-08-17 (decisions A–K).
- **Branch of record:** `dev`.
- **Baseline:** current working tree as reviewed, with existing Health/Combat slices.
- **Reference:** [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md); [ARCHITECTURE.md](../ARCHITECTURE.md); existing Overview Recovery (ui/ed-overview.js), Combat Damage-taken + session state (ui/ed-combat.js), and the recovery-heal roll path (ui/ed-app.js `_editHealth`, engine/health.js `applyHealth` / `recoveriesRemaining`).

---

## Owner decisions (normative)

| # | Decision |
|---|---|
| **A** | Spend mechanics — **each recovery spent individually**: a damage-heal recovery is **rolled** (the existing Recovery-test roll; the result heals that much Damage). Once Damage is 0, a spent recovery removes exactly **one Wound** (flat 1-recovery = 1-wound, no roll). |
| **B** | Over-heal rule — when a damage-heal roll's result exceeds the remaining Damage, the **excess is wasted**; it is not applied to Wounds. Wound removal only happens via a separate flat recovery spent after Damage is already 0. |
| **C** | Wound-healing rule (owner-stated 4E) — at the cost of a recovery after a day's rest, a character with **zero Damage** can heal a Wound. Hence Damage-healing comes first; Wound removal is only reachable at 0 Damage. |
| **D** | Combat clear scope — clear **all options and effects under the Combat options** (armed options, situational chips, blood charms) plus the day-scoped transient state (aim successes/consumed, manual successes, last-attack memory, target). **Keep the roll log** (it has its own clear feature), and **keep** weapon/talent picks and collapsed-state (preferences, not day state). |
| **E** | Icon — the reset affordance is the app's **heal green** (the `--good`/`--karma` family, `light-dark(#3d6b4a, #82c39a)`), a **circular** control with the ⟳ glyph inside, matching the `.roll` / take-damage circle conventions rather than a plain glyph. |
| **F** | Spend loop — the spend is **one recovery at a time**, in sequence: while recoveries remain and Damage > 0, each recovery is rolled as a damage-heal; once Damage = 0, each remaining recovery removes exactly one Wound. After the spend loop ends, the reset finalizes with `recoveriesUsed = 0`. |
| **G** | Combat-clear mechanism — the clear runs from **ed-app's single reset flow** via a new **exported `clearCombatScratch(id)`** in `ui/ed-combat.js` (the module `SCRATCH` cache + the mounted element's ephemeral state). A reset triggered from the Overview — Combat tab unmounted — still clears the character's cached scratch, so the next Combat visit starts clean. |
| **H** | Armed-option clear — when the new-day reset **finalizes**, all combat options and armed options clear **unconditionally, independent of the recovery-spend logic**: armed options, situational chips, blood charms, transient state, and any **armed healing aid** (the potion step-boost, `_pendingUse`). This preserves decision K (armed aids boost spend-loop Recovery-test rolls) and still guarantees the aid never survives the reset. The reset flow clears it directly, not via `_editHealth`'s used→0 transition side effect (which misses the already-at-0 plain path). |
| **I** | Knockdown — **not persisted.** Like any other situational effect, knockdown is session state, not a stored character input: `resources.health.knockedDown` is dropped from the design (supersedes the persistence aspect of PLAN-WOUNDS-KNOCKDOWN.md). The reset therefore has **no knockdown input to clear**; knockdown state dies with the session/encounter like the combat chips. |
| **J** | Blood charms — the reset **un-toggles** `_charmsOn` only; it never unequips or persists a charm (no item write). |
| **K** | Spend boosts — an **armed healing aid boosts the spend-loop Recovery-test rolls** exactly like a normal Recovery test (the existing `recovery-heal` path applies the armed step bonus). |

---

## Goal and problem statement

The app already models per-day recoveries and current combat state, but it lacks a single reset action that cleanly closes the day. Recoveries are tracked in the Health panel (an existing ⟳ reset already zeroes `recoveriesUsed`), combat options/chips are session-level scratch state in the Combat tab, and at end of day the player should be able to clear all day-scoped state in one place and decide whether remaining recoveries are spent before the day resets.

This plan defines a single, explicit reset action governed by the same inputs the app already stores and derives.

---

## Guardrail classification

| Concern | Class | Why |
|---|---|---|
| `resources.health` fields (`damage`, `wounds`, `recoveriesUsed`) | ✅ Tier 3 | Stored inputs already exist; this is an edit flow and a day-reset helper on the same shape. |
| Combat option scratch state | ✅ Tier 3 | Session-only UI state; not a persisted rule-data change. |
| Overview/Combat UI affordance | ✅ Tier 3 | New UI affordances within the existing layout and icon conventions; must respect Tier 1 UI rules. |
| Architecture (data flows down, events flow up) | ✅ Tier 1 held | The reset dispatch path stays in the store/engine; the view only dispatches the action and renders derived state. The combat-options clear is a session-state reset via the exported `clearCombatScratch(id)` (decision G), never a mutation of character data. |
| Schema / rules data | ✅ Tier 1 held | No new persisted character fields and no rule-shape change. |
| Effect taxonomy | ✅ No change | No new effect type or vocabulary change. |

**Tier-1 invariants this plan must not break:**
- Overview still fits the viewport without a vertical scroll.
- Derived values remain derived; the UI never computes game values.
- The UI still uses the existing light/dark theme conventions and modal keyboard rules (Escape closes, Enter confirms).
- The reset action must be a dispatch-driven flow, not UI-side mutation. The spent-heal applier stays on the `ed-edit-health` path already owned by ed-app.

---

## Functional rule

At the end of a day, the character resets its daily state in a single action, with a confirmation flow when recoveries can still be used.

### Reset steps

1. **Offer the spend first.** If recoveries remain (`recoveriesRemaining(used, max) > 0`) and (Damage > 0 or Wounds > 0), the modal offers to spend them before closing the day. The player may instead skip the spend and just clear the day.
2. **Spend, one recovery at a time** (decisions A, B, F):
   - A **damage-heal recovery** uses the existing Recovery-test roll: the open-ended result heals that much Damage (`applyHealth({ damage: -result, recoveriesUsed: 1 })`). Any result beyond the remaining Damage is **wasted** (decision B).
   - Once Damage is **0** and Wounds remain, a spent recovery removes exactly **one Wound** (`applyHealth({ wounds: -1, recoveriesUsed: 1 })`, flat, no roll) — decision C. Damage-healing always comes first; Wound removal is unreachable while Damage > 0.
   - The spend loop is sequential and re-evaluates the state after each recovery: while recoveries remain and Damage > 0, damage-heal; when Damage reaches 0, continue until recoveries run out or Wounds are 0. The loop stops early if the player chooses to halt, when recoveries run out, or when both Damage and Wounds are 0.
3. **Reset recoveries to 0** — after the spend loop completes, write `recoveriesUsed: 0` via the existing reset/`saveHealthEdits` path (ui/ed-overview.js today). The armed healing aid is cleared at reset **finalize** (decision H) — not by `_editHealth`'s used→0 side effect, which only fires on a transition and would miss the already-at-0 plain path.
4. **Clear combat options and armed options** (decisions D, G–J): armed options, situational chips, blood charms (**un-toggled only**, decision J), and the day-scoped transient state (aim successes/consumed, manual successes, last-attack memory, target) — applied via the exported `clearCombatScratch(id)` from ed-app's single flow (decision G), so an Overview-triggered reset clears the cached scratch too. Knockdown is not a stored input to clear (decision I). The roll log and the weapon/talent picks and collapsed-state are kept.

### Decision boundary

The spend is always explicit: spend actions are rolled/confirmed by the player, never auto-consumed. The reset itself confirms via a modal; the no-recoveries case keeps a plain confirm (the other half of the reset — the combat clear — is still a real action).

---

## UI behavior

### Trigger locations

- Overview / Health section: replace the current ⟳ recovery reset with the new-day circular icon on the Recoveries row.
- Combat / Damage-taken section: add the same circular icon in the damage-taken panel. Both hitpoints dispatch the same reset-open event (ed-app owns the single flow).

### Visual requirements (decision E)

- Circular control (matches `.roll` / take-damage circles), bordered + tinted background.
- **Heal green** — `--good` family `light-dark(#3d6b4a, #82c39a)` (the same positive/heal tone already used for Karma and "aimed" chips), never the amber accent or the emergency red.
- Same label/tooltip/aria-label at both locations; compact and low-noise; keyboard-focusable (Tier 1).

### User-facing sequence

- Click the circular new-day icon.
- A modal opens explaining the day reset and, when spendable, the spend options.
- **Spend path** (recoveries remain + Damage/Wounds present): the modal presents the sequential spend loop (decision F): while Damage > 0, each recovery is rolled as a damage-heal; once Damage = 0, each remaining recovery removes one Wound. The player may skip the spend and just clear the day. Enter confirms the selected action; Escape closes the modal without applying.
- **Plain path** (no spendable recoveries, or the player declines): a simple confirm for the reset (recoveries → 0 + combat clear). Enter confirms, Escape closes.

---

## Engine and store behavior

### Planned pieces

- A pure **decision-support** helper (engine/health.js or a sibling) that, from the inputs it is handed, tells the modal what a reset would entail — this is *decision support, not mutation*:
  - `recoveriesRemaining` (already exists)
  - whether a damage-heal spend is possible (`remaining > 0 && damage > 0`)
  - whether a wound spend becomes possible once Damage is 0 (`remaining > 0 && damage === 0 && wounds > 0`)
- The **spend applier** reuses the existing path:
  - damage-heal: the Recovery-test roll already dispatches `ed-roll` → `applyHealth({ damage: -result, recoveriesUsed: 1 })`. The spend modal drives the same roll per recovery; the over-heal clamp (`Math.max(0, …)` in `applyHealth`) already wastes excess (decision B falls out of the existing clamp).
  - wound-heal: a new flat apply `applyHealth({ wounds: -1, recoveriesUsed: 1 })` — same shape, no new rule.
- **Recoveries reset**: existing `saveHealthEdits` / `ed-edit-health` `{ recoveriesUsed: 0 }` path.
- **Combat-options clear**: a new **exported `clearCombatScratch(id)`** in ui/ed-combat.js (decision G): clears the module-level `SCRATCH` entry for the id and, when the Combat element is mounted, its ephemeral state — mirroring `_resetSession()` but scoped (decision D: keep weapon/talent picks + collapsed; clear armed options, situations, charms, target, aim state, manual successes, attack memory). Blood charms are **un-toggled** only (decision J); no item write. ed-app calls it from its single reset flow so the clear works from both trigger locations. `SCRATCH` is module memory — it survives **tab switches**, not reloads; the reset needs no reload persistence. This is UI state — **not a store/engine write**.

### Constraints

- Works from the current character model; never rewrites raw "stored" values except the explicit inputs being reset (`recoveriesUsed`, or spent heal deltas through `applyHealth`) and `saveHealthEdits` for the persisted ones.
- Safe when there are no remaining recoveries or no combat options.
- The armed healing aid clears at reset finalize unconditionally (decision H); knockdown is never written to `resources.health` (decision I).
- Never silently consumes recoveries; every spend is confirmed/rolled by the player.
- UI dispatches, ed-app/store applies (Tier-1 golden rule).

---

## Scope

### In scope

- A single end-of-day reset command available from Overview Health and Combat Damage-taken, via one ed-app-owned flow.
- Spend flow: roll each damage-heal recovery individually; flat 1-wound-per-recovery at 0 Damage (decisions A–C).
- Reset of recoveries to 0.
- Clearing day-scoped combat options/effects and transient state via the exported `clearCombatScratch(id)` (decision G); keeping the roll log and picks (decision D).
- Dropping the app-level `knockedDown` health input in favour of session-only knockdown state (decision I).
- New-day circular heal-green icon at both locations (decision E).
- Re-derivation of the model after the reset and spend choice.

### Out of scope

- Long-term "campaign reset" or world-state resets.
- Automatic healing without a confirmation/roll.
- Any change to permanent character progression or rank data.
- Any schema or taxonomy change.
- Persisting knockdown as a character input (decision I — knockdown is session state, not stored).
- Generic daily reset logic outside the Health/Combat flows.
- Changes to the roll log's own clear feature.

---

## File changes

| File | Planned change |
|---|---|
| `ui/ed-overview.js` | Replace the ⟳ with the circular heal-green new-day icon; open the shared reset-spend flow. |
| `ui/ed-combat.js` | Add the circular heal-green icon in the Damage-taken area; **export `clearCombatScratch(id)`** implementing the decision-D clear (keep picks/roll log; un-toggle charms). |
| `ui/ed-app.js` | Own the single reset flow: receives the open dispatch, drives the spend modal + reset, applies via `applyHealth`/`saveHealthEdits`; **clears the armed healing aid at reset finalize (decision H)** and calls `clearCombatScratch(id)` (decision G). |
| `store.js` | Reuse existing `saveHealthEdits`/`deriveModel` re-ran on the edited character (no new store action beyond today's health path). |
| `engine/health.js` or equivalent | Add the pure decision-support helper for what a reset can spend (remaining, damage-spendable, wound-spendable). Possibly an `endOfDaySpend` pure projection. |
| `engine/*.test.js`, `store-health.test.js` | Unit tests for decision-support, damage-then-wound spend, over-heal waste, flat wound removal, reset safety at no recoveries. |
| `plans/PLAN-END-OF-DAY-RESET.md` | This plan. |

---

## Implementation notes

- The recovery reset and spend reuse the existing `applyHealth` / `recoveriesRemaining` / `saveHealthEdits` / `ed-edit-health` paths — no special-case mutations.
- Over-heal waste is already enforced by `applyHealth`'s `Math.max(0, …)` clamp; the spend modal just never lets a rolled result "carry" into Wounds (decision B).
- The combat clear is session state only, applied through the exported `clearCombatScratch(id)` (decision G), and never touches `character.json`; blood charms are un-toggled, never unequipped (decision J).
- The armed healing aid is cleared at reset finalize unconditionally (decision H): the reset flow clears `_pendingUse` directly rather than relying on `_editHealth`'s used→0 transition rule.
- Knockdown is never persisted (decision I): the reset has no `knockedDown` input to write, and the design drops `knockedDown` from the app's persisted health inputs.
- The wound-heal is a flat 1-recovery = 1-Wound cost at 0 Damage (decision C), applied through the same health-edit path as damage heals.
- The green circle reuses the `.roll` circle pattern (border + tinted background) with the heal-green tokens, so the icon grammar stays consistent.

---

## Test intent

- Spend decision-support: remaining = 0 → nothing spendable; damage > 0 → damage-spendable; damage === 0 && wounds > 0 → wound-spendable.
- A damage-heal recovery rolls and heals the result; over-heal above remaining Damage is wasted (existing clamp).
- At 0 Damage, a recovery removes exactly one Wound (flat); Wound removal is never offered while Damage > 0.
- Reset clears recoveries to 0 and (decision D) clears armed options/situations/charms/transient state, keeps the roll log and picks.
- A reset from the Overview clears the character's cached combat scratch (`clearCombatScratch`) even with the Combat tab unmounted (decision G).
- The armed healing aid is cleared at reset finalize in the no-spend path (decision H).
- No `knockedDown` write on reset; knockdown is not a stored input (decision I).
- No spendable recoveries → reset still succeeds without an invalid state.
- Reset keeps the engine pure and writes no new persisted field.

---

## Open questions for owner review

Resolved:
1. Damage vs Wounds ordering → damage-heal **first** (rolled), then flat 1-wound-per-recovery once Damage is 0 (decisions A–C).
2. All-vs-quantity spend → each recovery spent **individually** via the roll modal; the player drives one at a time (decisions A/F).
3. Reset with no remaining recoveries → defaults to the **same confirm modal** (the combat clear is still a real action). Flagging as a default; one-click is possible if preferred.
4. Confirmed — over-heal excess is **wasted** (decision B).
5. **Resolved — spend loop is one recovery at a time, with re-evaluation after each recovery** (decision F). The player does not batch a quantity; each recovery is handled sequentially, which keeps the issue clear and the existing roll flow intact.
6. **Resolved — combat-clear reachability from the Overview** → the clear lives in ed-app's flow via an exported `clearCombatScratch(id)` in ui/ed-combat.js (decision G).
7. **Resolved — armed healing aid on a new-day reset** → cleared unconditionally at reset finalize, preserving spend-loop boosts (decision H/K).
8. **Resolved — knockdown persistence** → knockdown is not stored; it is session/situational state like the combat chips (decision I).
9. **Resolved — blood charms** → un-toggled only, no item write (decision J).
10. **Resolved — armed boosts on spend-loop rolls** → they apply, exactly like a normal Recovery test (decision K).

The plan is now normative on the spend loop: recoveries are spent in order, damage-healing first, wound-healing only after Damage reaches 0, then the final reset writes `recoveriesUsed = 0`.

---

## Progress log

| Date | Change | Tests |
|---|---|---|
| 2026-08-17 | Aligned the implementation with decisions A–K, replacing the earlier deterministic flat-heal prototype: engine now exposes pure decision-support `endOfDayResetPlan` (no mutation — spends run through the existing `recovery-heal` roll path); a new presentational `ui/ed-day-reset.js` modal owns the one-recovery-at-a-time spend loop and hosts it in ed-app's single reset flow (Overview + Combat dispatch the same `ed-day-reset` event); `clearCombatScratch(id)` preserves weapon/talent/collapsed picks while clearing day-scoped fields; `_pendingUse` and session knockdown cleared at finalize; `window.confirm` removed (modal is Tier-1-rule compliant); `knockedDown` strip covered by a store test | 576/576 pass |
| 2026-08-17 | Flow fix: the spend loop now **auto-finalizes** — the reset (combat options clear + `recoveriesUsed = 0`) completes on its own the moment nothing more can be spent (recoveries exhausted, or Damage/Wounds cleared, or the only remaining spend needs a Toughness roll the character lacks). No extra "Reset the day" click after the loop; "Skip spend & reset" remains for ending early. `_dayReset` made reactive state (the modal previously only appeared on an unrelated re-render). | 576/576 pass |