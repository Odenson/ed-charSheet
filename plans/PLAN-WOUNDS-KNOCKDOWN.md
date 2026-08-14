# Plan: Wounds & Knockdown + Active Effects + Recoveries Reset (Overview)

Status page for the **wounds & knockdown slice**: a single hit at or above the
Wound Threshold auto-records a **Wound**; a hit **five or more over** the
threshold forces a **Knockdown test** (Strength vs. Difficulty = hit −
threshold); the **Knocked Down** condition surfaces in a new **Active Effects**
panel with a roll-time **−3 to Action tests** and a **Stand up** reversal; and a
**Recoveries reset** clears the per-day Recovery-tests-used count. This file is
the **living status page**: tick a step `[x]` and set its **Status** when it
lands, append to [Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner.
- **Created:** 2026-08-08. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `d21de2f` (+ bug fix `158a0d9`) — clean working tree, **162/162 tests pass**.
- **Source rules:** Earthdawn 4E Player's Guide (Health section) + errata + fasa.wiki/4E:
  - **Wound:** a single attack whose damage meets or exceeds the **Wound
    Threshold** inflicts one Wound.
  - **Knockdown:** when that hit is **5 or more over** the Wound Threshold, the
    character rolls an open-ended **Strength (Knockdown) test** against a
    **Difficulty Number = hit damage − Wound Threshold**. Meeting or beating the
    difficulty keeps you on your feet; a lower result means **Knocked Down**.
  - **Knocked Down** (errata): **−3 to Action tests** until the character gets
    up again. Recovery tests and the Knockdown test itself are exempt.
  - **Recovery tests** reset per day (a new day begins).

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| `resources.health.knockedDown` (new boolean input) | ✅ Tier 3 | Adding data *within* the existing `resources.health` input shape is Tier 3 — never a derived value stored. |
| New engine helpers (`woundsFromHit`, `knockdownTriggered`, `knockdownDifficulty`, `knockdownOutcome`, `KNOCKED_DOWN_EFFECT`) | ✅ Tier 3 | Pure, DOM-free additions to `engine/health.js`. |
| Synth condition effect | ✅ Tier 3 | Uses existing taxonomy v3 vocabulary: `test`/`Action`, `operation: add`, `measure: result`, `source: condition`. **No taxonomy bump.** |
| `deriveModel` `activeEffects` (always-on fold + condition) | ✅ Tier 3 | Re-exposes the existing fold under a new key; adds the condition effect when the input is set. |
| Store overlay (`saveHealthEdits` / `SAVED_CATEGORIES` / `applyEdits`) | ✅ Tier 3 | Unchanged shape; `applyEdits` already merges `health` so `knockedDown` round-trips. |
| Overview UI (damage modal, Active Effects panel, Recoveries reset) | ✅ Tier 3 | New content within the Overview — must **hold** the Tier 1 rules below. |
| Effect taxonomy | ✅ Untouched | Stays **v3, no bump**. |

**Tier-1 invariants this plan must not break:**
- **Store only inputs** — the wound count is *derived* from a hit + Wound
  Threshold at apply time; `knockedDown` is the only new stored input. Ratings,
  outcomes and the −3 never live in `character.json`.
- **Overview fits the desktop viewport without vertical scroll** — the right
  stack gains an **Active Effects** panel; that is the viewport-fit risk this
  slice verifies (§ Phase C risk).
- **Derived values render as muted dashed placeholder pills, never a fabricated
  number** — no wound/knockdown prompt when the Wound Threshold or Knockdown
  step is missing; no outcome guessed without a real roll.
- **Data flows down, events flow up** — the damage modal dispatches
  `ed-edit-health` / `ed-roll`; `ed-app` applies through the pure engine. The
  engine stays pure and DOM-free; the roll modal only *displays* the comparison
  and re-derives nothing.
- **Modals honor Escape-closes / Enter-confirms** (UI-GUIDELINES §7) — the
  damage modal, the recoveries-reset confirm and the roll modal all follow it.
- **Theme-aware, two font weights (400/500), relative `./…` paths.**

---

## Confirmed decisions (owner answers, 2026-08-08)

1. **Knockdown test adjudication = resolves at roll time** — the damage modal
   routes a triggering hit to the roll modal ("Knockdown test, vs Difficulty N").
   There is **no verify button**: the moment the dice land, the outcome is
   applied automatically — a failed test knocks the character down, a success
   leaves them standing (re-derived through the engine, `knockdownOutcome`). The
   roll modal stays open so the player sees the roll and its outcome line
   (Stayed up / Knocked down), then dismisses it.
   *(Revised after E: originally "Roll, then click outcome" — owner asked to drop
   the verification click.)*
2. **Knocked Down penalty = a modifier, applied at roll time + folded defense** —
   PG p.389: "the character suffers a –3 penalty to his tests, and subtracts –3
   from his Physical and Mystic Defense." It is a **modifier**, never a step
   stored/derived change: the roll-time −3 is applied flat to the test **result**
   (the book's default is Step-modification, but a result modifier is the
   explicitly-sanctioned GM-discretion alternative — "Bonuses and Penalties").
   The −3 hits **every test** while prone — the worked example names the next
   Initiative test, so there are no Action-only / Knockdown / Recovery / Karma
   exemptions (the Karma *die* is a die roll, not a test, so it never takes it).
   The **−3 to Physical and Mystic Defense** folds into the derived ratings while
   the condition is set; Social Defense is left to GM discretion and is not
   folded. *(Revised after E: originally "Action tests only, −3 result" — owner
   chose Option B, the book's prose reading.)*
3. **Stand up** — the condition is cleared with a **"Stand up"** button in the
   Active Effects panel.
4. **Remove the manual Wounds field from the damage modal** — a hit auto-records
   its Wound via the engine; the edit-mode fields remain the manual correction
   path.

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--engine) | wounds/knockdown helpers + `KNOCKED_DOWN_EFFECT` | ✅ Complete |
| [B](#phase-b--store-wiring) | `activeEffects` fold + condition in `deriveModel` | ✅ Complete |
| [C](#phase-c--overview-ui) | damage modal, roll modal difficulty/mods, roll-time −3, Active Effects panel, recoveries reset | ✅ Complete |
| [D](#phase-d--tests) | engine + store tests | ✅ Complete |
| [E](#phase-e--docs-verification) | Plan doc, changelog, verification, push | ✅ Complete |

---

## Phase A — Engine (`engine/health.js`)

- [x] A1. **`woundsFromHit(take, woundThreshold)`** → `1 | 0`: one Wound when a
      single hit's damage is ≥ the Wound Threshold (4E: binary per hit). Null-safe:
      no threshold → `0` (never a fabricated Wound).
- [x] A2. **`knockdownTriggered(take, woundThreshold)`** → `take >= threshold + 5`
      (the owner-stated "5 over" rule).
- [x] A3. **`knockdownDifficulty(take, woundThreshold)`** → `take − threshold`;
      `null` unless triggered (so ≥ 5).
- [x] A4. **`knockdownOutcome(result, difficulty)`** → `'up' | 'down' | null`:
      `result >= difficulty` → `'up'`; impossible comparison → `null`.
- [x] A5. **`KNOCKED_DOWN_EFFECT`** — the synthesized condition effect
      `{ type: 'test-modifier', target: { domain: 'test', name: 'Action' },
      operation: 'add', value: -3, measure: 'result', condition: 'always',
      source: 'condition', summary: '−3 to Action tests while knocked down.' }`
      — one source feeds both the Active Effects panel and the roll-time −3.

## Phase B — Store wiring (`store.js`)

- [x] B1. `deriveModel` exposes **`activeEffects`**: the existing always-on fold
      (race / discipline circles / equipped item + thread effects, each tagged
      with its `origin`) plus the condition effect
      (`{ ...KNOCKED_DOWN_EFFECT, origin: { kind: 'condition', name: 'Knocked
      Down' } }`) when `resources.health.knockedDown` is truthy. Derived, never
      stored; clearing the input folds it back out.
- [x] B2. No `SAVED_CATEGORIES` / `applyEdits` change — the health merge already
      round-trips the extra `knockedDown` key. (Deviation: the app now persists
      the *full merged* health object, see Issues.)

## Phase C — Overview UI

- [x] C1. **Damage modal** (`ui/ed-overview.js`): the **Wounds field is gone**; a
      hint line states the auto-wound + knockdown rules. Applying a take:
      `wounds = woundsFromHit(take, wt)` merged via `applyHealth`, then — when
      `take > 0` and `knockdownTriggered` (and a Knockdown step exists to roll) —
      dispatch `ed-roll` for a **"Knockdown test"** with
      `difficulty: { value }`, `kind: 'knockdown'` (exempt from the −3) and
      `apply: { action: 'knockdown-result' }`. The hit's damage/wound land
      immediately; the test only decides the knocked-down state.
- [x] C2. **Roll modal** (`ui/ed-roll-modal.js`): gains generic **`difficulty`**
      ("vs Difficulty N" in the sub-header, plus an outcome line) and **`mods`**
      (a Mods row; the total includes them). A Knockdown test shows **no Apply
      button** — `_roll()` auto-applies the resolved outcome; `ed-roll-apply`
      carries `{ action, result, difficulty }`.
- [x] C3. **`ed-app.js`**: `_rollTimeMods()` appends
      `{ label: 'Knocked Down', value: KNOCKED_DOWN_EFFECT.value }` to **every**
      roll while knocked down (PG p.389 — all tests, Initiative included); only
      the Karma die (a die roll, not a test) is skipped. The `ed-roll-apply`
      handler re-derives `knockdownOutcome(result, difficulty)` and stores
      `knockedDown`. Combat / Karma roll buttons still tag their `kind`.
- [x] C3b. **Defense fold** — while knocked down, the engine's synthesized
      `KNOCKED_DOWN_DEFENSE_EFFECTS` (−3 `defense-modifier`, `rating` measure,
      Physical + Mystic) are folded into the derived defenses (not Social, which
      is GM discretion); they clear with the condition.
- [x] C4. **Active Effects panel** — a new block under Special Features listing
      every effect in `model.activeEffects` (origin tag + summary); the Knocked
      Down condition row is highlighted and carries **Stand up** (dispatches
      `ed-edit-health { knockedDown: false }`).
- [x] C5. **Recoveries reset** — a ⟳ button beside the Recoveries readout opens
      an `ed-confirm` ("A new day begins — reset Recovery tests used today to
      0?"); confirming dispatches `ed-edit-health { recoveriesUsed: 0 }`.

> **Risk (Tier 1):** the Active Effects panel (40 effects for Chakka) could push
> the right stack past the viewport (UI-GUIDELINES §1). Mitigation: the list is
> bounded with **internal scroll** — the page itself never scrolls, whatever the
> effect count. Verified in § Phase E.

## Phase D — Tests

- [x] D1. `engine/health.test.js` — `woundsFromHit` (at/below/missing threshold),
      `knockdownTriggered` (the 5-over gap), `knockdownDifficulty`, `knockdownOutcome`
      (up/down/null), `KNOCKED_DOWN_EFFECT` shape, and one end-to-end big-hit flow.
- [x] D2. `store-health.test.js` — `deriveModel.activeEffects` (base fold, no
      condition when standing; the condition effect + its shape + the static
      Knockdown step staying un-penalized when knocked down; folding back out
      when cleared).

## Phase E — Docs, verification

- [x] E1. `data/changelog.json` — `unreleased.changes` gains `added` + `fixed`
      entries (wounds/knockdown/Active Effects/recoveries reset; partial health
      edits no longer clobber the overlay).
- [x] E2. `node --check` on touched JS; full test suite green (162 + new).
- [x] E3. Verify Tier 1: Overview still fits the viewport (no vertical scroll)
      with the new Active Effects panel in light + dark; wounds/knockdown prompt
      shows pills, never fabricated numbers; modals Escape-closes /
      Enter-confirms; theme-aware.
- [x] E4. Commit to `dev`, push.

---

## Issues & learnings

- **C1 deviation (data-safety fix):** the plan said `saveHealthEdits` "needs no
  change". While wiring `knockedDown` it became clear that a **partial** health
  save (`{ knockedDown: true }`, and the existing edit-mode `_setHealth`
  single-key saves) **replaced** the overlay's stored health object, so the
  recorded damage/wounds would vanish on the next overlay replay. Fix, with no
  store change: `_editHealth` now persists the **full merged** health object to
  the overlay (`saveHealthEdits(merged, id)`), so every stored health object is
  complete and no key is ever dropped.
- **C3 note (faithful errata):** the roll-time −3 is applied to Action tests.
  Beyond the explicitly-exempt Knockdown + Recovery tests, the Implementation
  also skips Initiative and Karma rolls, which are not Action tests. The
  overview's combat/karma roll buttons tag their `kind` to make that decision.
- **C2 revision (owner, post-E):** the Knockdown test's outcome is no longer
  confirmed with a click — `_roll()` auto-applies it the moment the dice land
  (a failed test knocks the character down) and the roll modal's Apply button
  is dropped for `knockdown-result`; the modal stays open showing the roll and
  its outcome line, and `ed-app` no longer closes it on that apply.
- **C3 revision (owner, post-E — Option B):** the local rulebooks were checked
  (PG p.389 + Situation Modifiers Table + "Bonuses and Penalties"): Knocked Down
  is a **modifier**, not a step change. The earlier "Action tests only /
  Knockdown + Recovery + Initiative + Karma exempt" reading was dropped — the
  −3 hits **every** test while prone (prose; the example names the next
  Initiative test). The missing **−3 Physical/Mystic Defense** fold was added
  (`KNOCKED_DOWN_DEFENSE_EFFECTS`, `rating` measure). Result-measure (not the
  book's default Step-measure) was kept as the sanctioned alternative.

## Progress log

| Date | Change | Result |
|------|--------|--------|
| 2026-08-08 | Plan created; owner answered 4 scope questions (Roll-then-click outcome / roll-time −3 / Stand up / drop the modal Wounds field) and corrected the knockdown rule to "5 over the threshold, Difficulty = hit − threshold" | Baseline `d21de2f`, 162/162 tests |
| 2026-08-08 | Phases A–D + E1–E4: engine wounds/knockdown helpers + `KNOCKED_DOWN_EFFECT`; `deriveModel.activeEffects` + condition; damage modal auto-wound + knockdown routing; roll modal `difficulty`/`mods` + outcome; roll-time −3 + `knockdown-result` apply; Active Effects panel + Stand up; Recoveries reset; `_editHealth` full-merge fix; 11 new engine tests + 2 new store tests | 174/174 tests pass; pushed to `dev` |
| 2026-08-08 | Owner revisions: Active Effects lists conditions only (no Special Features / items); recoveries-reset ⟳ moves beside the label; **Knockdown test auto-applies its outcome at roll time** (no verify button — `ed-roll-modal._roll()` dispatches `ed-roll-apply`, `ed-app` stops closing the modal on `knockdown-result`) | 174/174 tests pass; uncommitted on `dev` |
| 2026-08-08 | Option B (local-rulebook check): Knocked Down is a **modifier** — the roll-time −3 now hits **every** test while prone (no Action-only / Initiative / Knockdown / Recovery exemptions; Karma die only excluded), and the **−3 Physical + Mystic Defense** fold was added (`KNOCKED_DOWN_DEFENSE_EFFECTS`, `rating` measure; Social left to GM discretion). Result-measure kept as the book's sanctioned alternative | 176/176 tests pass; uncommitted on `dev` |
