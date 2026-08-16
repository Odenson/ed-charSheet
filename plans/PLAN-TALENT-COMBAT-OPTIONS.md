# Plan: Talent-granted combat options (True Shot — extra Karma dice)

> **Status: implemented on `dev` (2026-08-16).** All decisions D1–D11 landed;
> suite **529** green (8 new: `engine/dice.test.js` rollKarmaDice, `store-combat.test.js`
> talentOptions). **A second talent option — Mystic Aim (aim-roll pattern) —
> landed on the same rails; see §12. `+2 steps PER SUCCESS`, aim Karma-eligible,
> bonus consumed by one attack.** Suite **537**.

Extend the Combat tab so a **talent** can grant a combat-option bundle, the same
way a thread item or the global rules already do. The driving example is **True
Shot**: while a ranged (Missile or Throwing) weapon is the selected attack, the
player may toggle a *True Shot* option that, in the attack roll modal, lets them
add **up to `rank` extra Karma dice** to the Attack test (2 Strain).

This is the first time a **talent** feeds the combat-option list, and the first
time the roll modal rolls **more than one** Karma die.

- **Owner:** repo owner. **Created:** 2026-08-16. **Branch of record:** `dev`.
- **Reference:** [PLAN-COMBAT-TAB.md](PLAN-COMBAT-TAB.md) (option/pool model),
  [docs/THREAD-ITEMS.md](../docs/THREAD-ITEMS.md) §4.1 (item-scoped
  `combatOptions` — the pattern this mirrors),
  [docs/EFFECT-TAXONOMY.md](../docs/EFFECT-TAXONOMY.md) (why `karmaDice` is
  metadata, not an effect).

## Owner decisions (2026-08-16)

1. **Scope:** Missile **and** Throwing (`appliesTo: ["missile", "throwing"]`) —
   matches the rulebook/talent summary ("Missile or Throwing Weapons test").
2. **Karma dice = total, capped at rank** — one stepper `1 … maxDice` replaces
   the normal single Karma die for this roll (not "1 normal + rank extra"). The
   player picks an **initial batch** blind (set-dice state, D4), which is charged
   at commit; then a **one-at-a-time top-up** (D9) lets them add further dice
   after seeing the result. `maxDice = min(rank, availableKarma)`.
3. **Karma spend:** the **initial batch** is charged once at commit; each
   **top-up** die is charged as it is added (D3, revised). No refund, ever.
4. **Strain moves to commit** (Q-review): the option's 2 Strain is charged at the
   same commit point as the initial Karma batch, **not** at "Attack"-click — so
   Escape/✕ before commit charges nothing (Strain or Karma). Requires
   `_rollAttack` to stop pre-charging Strain when a set-dice option is armed.
5. **0-Karma gate:** when `min(rank, availableKarma) < 1` the True Shot pill is
   **disabled** (cannot be armed) — Q-review.
6. **Delivery:** plan first; do not build until reviewed.

---

## 1. What exists today (the rails)

- **Option sources** are merged in `ui/ed-combat.js` `_allOptions()`: the global
  `rules/combat.json` `options[]`, the **selected weapon's** `combatOptions`, and
  the equipped-non-weapon `combat.itemOptions` (added for Dark Archer Armour).
  Every bundle is `{ name, appliesTo?, excludes?, restricted?, effects[] }`.
- **Scoping** to an attack type already works: `_attackScopes()` derives the
  current pick's weapon-category tags and `_allOptions()` hides any bundle whose
  `appliesTo` doesn't include one. So `appliesTo: ["missile","throwing"]` gives
  the "ranged weapon only" gate with **no new code**.
- **Strain** declared in a bundle (`resource-modifier` on `{resource, Strain}`)
  folds into `attackPool.strain` (`engine/combat.js` `foldPool`) and is charged
  on the roll via `ed-combat.js` `_chargeStrain`. True Shot's 2 Strain reuses
  this untouched.
- **Karma in the roll modal** (`ui/ed-roll-modal.js`): supports **exactly one**
  Karma die — a single toggle button, spends 1 Karma (`_toggleKarma`, dispatches
  `ed-edit-karma {spend:1}` once per interaction). The modal receives
  `karma = { grants, available, stepRow }` from `ed-app.js`'s `ed-roll` handler,
  which builds it from the picked talent's `karma` context (`_karmaCtx` in
  `ed-combat.js`).

## 2. The two new capabilities

1. **A talent as an option source.** Today only items/globals contribute. Add a
   `combatOptions` array to a talent entry in `rules/talents.json`, and a
   `combat.talentOptions` list in the store, mirroring `combat.itemOptions`.
2. **N Karma dice in the modal (N ≤ rank), with top-up.** Grow the modal from a
   1-die toggle to a `1..maxDice` stepper for the initial batch (charged at
   commit), plus a **one-at-a-time top-up** after the roll (each added die
   charged as added), stopping at the target number / rank / Karma exhaustion
   (see Owner decisions #2–#3 and D9).

---

## 3. Data — `rules/talents.json` True Shot entry

Add a `combatOptions` array to the existing True Shot talent (same bundle shape
as `rules/combat.json` options, plus one metadata field):

```jsonc
"combatOptions": [
  {
    "name": "True Shot",
    "appliesTo": ["missile", "throwing"],
    "karmaDice": { "source": "rank" },
    "summary": "Add up to (rank) extra Karma dice to a ranged Attack test; 2 Strain.",
    "effects": [
      { "type": "resource-modifier",
        "target": { "domain": "resource", "name": "Strain" },
        "operation": "add", "value": 2, "measure": "points",
        "condition": "situational", "source": "condition",
        "summary": "2 Strain." }
    ]
  }
]
```

**Why `karmaDice` is *not* a taxonomy effect.** It sits at the bundle level,
next to `appliesTo` / `excludes` / `restricted` — all of which are **option
metadata**, not entries in the effect taxonomy. The "extra Karma dice" mechanic
has no representation in the `type`/`target`/`measure` vocabulary, and inventing
one would be a **Tier-2 taxonomy change** (bump + migrate every `rules/*.json`).
Modelling it as bundle metadata keeps the taxonomy untouched. `{ source: "rank" }`
means "the cap is the character's rank in the granting talent"; the store
resolves it to a number.

## 4. Store — `combat.talentOptions` (new, mirrors `itemOptions`)

In `deriveModel`, build a list from owned talents that declare `combatOptions`,
**injecting the resolved rank cap** so the modal never has to look the talent up:

```js
// combat: { ... }
talentOptions: disciplines
  .flatMap((d) => d.talents)
  .filter((t) => talentCatalog[t.name]?.combatOptions?.length && (t.rank ?? 0) > 0)
  .flatMap((t) =>
    talentCatalog[t.name].combatOptions.map((o) => ({
      ...o,
      // resolve karmaDice.source:"rank" → a concrete cap for this character
      karmaDice: o.karmaDice ? { ...o.karmaDice, max: t.rank } : null,
      grantedBy: t.name,
    })),
  ),
```

- Rank 0 / unowned talent → not offered (the talent gate is inherent — the
  option only exists because the talent is owned at rank ≥ 1).
- If a talent is owned in more than one Discipline, dedupe by option `name`
  keeping the **highest** rank (same spirit as `_allActions()`).

## 5. Combat tab — merge + thread the cap through

- `_allOptions()`: append `...(this.model?.combat?.talentOptions ?? [])`. Ordering:
  weapon bundles, then `itemOptions`, then `talentOptions`, then global. Existing
  `appliesTo` filtering handles the missile/throwing scope automatically.
- **`maxDice` wiring lives in exactly one seam: `_karmaCtx`** (`ui/ed-combat.js`),
  which runs for every Attack roll and already holds `characteristics.karma
  .available`. Extend it so that when the roll's pick is scoped to a **toggled**
  option carrying `karmaDice`, the returned `karma` object gains
  `maxDice = min(option.karmaDice.max, available)`. Non-True-Shot rolls keep
  `maxDice = 1` (unchanged behavior). `ed-app`'s `ed-roll` handler passes
  `maxDice` through untouched (it already reshapes `karma` to add `stepRow`), and
  the modal defaults it to `1`. Nothing else reads or computes it — one seam in
  the view, one pass-through, one default.
- **Karma-ctx edge (defined, not silent):** the dice control renders only when
  the roll's `karma` object has `grants` (modal renders the karma UI off
  `karma?.grants?.length`). Every missile/throwing talent attack has grants
  today, so this cannot bite yet — but a future `karmaDice` option on a roll
  whose pick carries no karma context must be tested to no-op (option visible,
  no dice control) rather than silently crash.
- **Strain moves to commit (Q-review).** Today `_rollAttack` calls
  `_chargeStrain(ap.strain)` *before* dispatching the roll, so a set-dice option's
  2 Strain would be paid at "Attack"-click even if the player then Escapes. When
  the armed pick carries a `karmaDice` (set-dice) option, `_rollAttack` must **not**
  pre-charge that option's Strain; instead the Strain rides the `ed-roll` detail
  and is charged at the modal's commit alongside the initial Karma batch. Ordinary
  (non-set-dice) attacks keep charging Strain at Attack-click, unchanged.
- **0-Karma gate (Q-review).** The Combat tab disables the True Shot pill when
  `min(rank, availableKarma) < 1` — armed state is impossible with no Karma to
  spend. Rank is always ≥ 1 (rank-0 talents aren't offered, §4), so this fires
  only when the Karma balance is 0.
- `excludes` needs no new handling — generic.

## 6. Roll modal — one die → N dice (the real UI work)

`ui/ed-roll-modal.js`:

- `karma` prop gains `maxDice` (default **1** → today's behavior for every other
  roll is byte-for-byte unchanged).
- When `maxDice <= 1`: render exactly the current single toggle.
- When `maxDice > 1` and the option is armed: the modal opens in a **set-dice
  state** (D4). The roll is **deferred** — it does NOT auto-roll on open, even
  though `stepRow` changed. The stepper is the primary control, with a primary
  **Roll (N dice)** action (Enter confirms, honoring the Tier-1 modal contract).
  Consequence: Escape / ✕ / overlay-click close the modal before any commit, and
  **nothing is charged** — cleaner than the legacy immediate-charge no-refund,
  and it is the only workable commit point, because the Attack roll has no
  Apply button today.
- Stepper range `1 … maxDice` (D7): arming True Shot means the player intends to
  spend at least one Karma die (a 0-die "True Shot" is just a normal attack, so
  don't arm it). `maxDice = min(rank, availableKarma)` already folds in the Karma
  balance, so the player can't pick more dice than they can pay for.
- Roll `count` Karma dice (`rollStep(karma.stepRow)` × count), and keep the
  result **in the existing `rollStep` result shape** (D6): `groups` (one per
  die), `step`, `dice`, `total`. The modal renders each die via the `.kdie`
  chain, sums into `_karmaResult.total`, and — critically — `_grandTotal()`
  and `ed-app`'s Roll Log reader (`karmaResult.step/dice/total`) keep working
  with **no change**, because the shape is identical to today's single die.
- **Charge on commit, then per top-up die (Decision D3, revised).** At the
  primary Roll action, charge the initial batch once: `ed-edit-karma { spend: C }`
  plus the option's 2 Strain (D-strain). Then the roll is **not** locked — see the
  top-up loop (D9).
- **Top-up loop (Decision D9).** After the initial roll, while **all** of these
  hold, offer an **"Add 1 Karma die"** action:
  1. dice used so far `< rank` (dice haven't run out), **and**
  2. `availableKarma > 0` (Karma remains), **and**
  3. a target number is set **and** the current total is **below** it (still a
     miss — once the total meets the target, stop offering: don't waste Karma).
     If **no** target number was entered, condition 3 is vacuously "keep offering"
     up to the rank/Karma caps.
  Each click: `ed-edit-karma { spend: 1 }`, roll **one** more Karma die
  (`rollStep`), append it to `_karmaResult` (same shape, D6), re-total, re-check
  the outcome. No refund. When any stop condition trips, the Add action
  disappears and the roll is final.
- **No "Roll again".** The testing-only "Roll again" button was removed from the
  modal for **all** rolls (2026-08-16) and replaced by a plain **OK** button that
  closes the modal — so a set-dice roll simply commits its batch, offers the
  top-up (D9), and OK/Escape closes. There is no re-roll to reconcile against the
  charge model.
- Escape / ✕ / overlay-click / **OK** close preserved (Tier-1 modal contract);
  closing after commit keeps whatever was charged (spent Karma/Strain are real),
  closing **before** commit charges nothing.

## 7. Engine — pure, minimal

Karma-dice rolling is `rollStep` called `count` times and summed. Put it in a
tiny pure helper so the view stays logic-free, and **return a `rollStep`-shaped
result** (D6) so the modal's existing render path, `_grandTotal()`, and
ed-app's Roll Log reader all keep working unchanged:

```js
// engine/dice.js — N Karma dice as ONE rollStep-shaped result { step, dice,
// groups:[{die, rolls:[], subtotal, exploded}], total } so every existing
// consumer (modal render, _grandTotal, ed-app's log) is shape-compatible.
export function rollKarmaDice(stepRow, count) {
  const n = Math.max(0, count | 0);
  const groups = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = rollStep(stepRow);
    groups.push(...r.groups);          // one group per die; each may explode
    total += r.total;
  }
  return { step: stepRow.step, dice: stepRow.dice, groups, total };
}
```

The alternative of a `{ rolls, total }` shape was rejected at review (D6): it
would have silently broken the modal's `.kdie` chain render, `_grandTotal()`,
and the Roll Log's `karmaResult.step/dice/total` reader — three separate
consumers, all fixed by keeping the shape identical to a single die.

No other engine change: `attackPool` already carries the 2 Strain; the Karma
dice add to the roll **total**, not the Step, exactly as the single Karma die
does today.

---

## 8. Tiers touched (guardrail classification)

- **Tier 1 — UI contract:** the roll-modal change (single toggle → N-dice
  stepper). Escape/Enter, light+dark, two-weight rules all preserved.
- **Tier 1 — architecture / engine-read data:** a new engine-read field
  (`combatOptions` on talent entries) and a new derived model list
  (`combat.talentOptions`); the karma-dice roll helper stays pure/DOM-free.
- **Taxonomy — no change (no bump).** `karmaDice` is bundle metadata, like
  `appliesTo`; no effect `type`/`vocabulary` is added or renamed.
- **`ed-talents/1` schema shape:** adding `combatOptions` is *adding data within
  the shape* (Tier 3 per CLAUDE.md), but because the engine now *reads* it, treat
  it as part of the Tier-1 sign-off above rather than a silent data add.

## 9. Decisions log

- **D1 (settled):** scope = Missile + Throwing.
- **D2 (settled):** cap = talent rank, further clamped by available Karma. Dice
  are the **total** for the roll (replace the normal 1 Karma die), not "1 + rank".
- **D3 (revised at 2nd review):** charge the **initial batch** once at commit;
  charge each **top-up** die as it is added (D9). No refund.
- **D4 (settled at review):** the initial-batch commit point is the modal's
  **primary "Roll (N dice)" action** — the modal opens in a set-dice state that
  **defers the auto-roll**; Escape / ✕ / overlay-click *before commit* charge
  **nothing**. Chosen over "charge on modal close" (Escape would then cost
  Karma) and "charge on first landing" (the modal auto-rolls, so undefined).
  **Note (2nd review):** the roll is *not* locked after commit — the top-up loop
  (D9) continues; the modal's OK button closes it (no "Roll again" — that
  testing-only button was removed from all rolls, see D11).
- **D-strain (settled at 2nd review):** the option's 2 Strain is charged at the
  initial-batch commit, not at "Attack"-click, so Escape-before-commit charges
  nothing. `_rollAttack` must skip pre-charging Strain for a set-dice option.
- **D-gate (settled at 2nd review):** disable the True Shot pill when
  `min(rank, availableKarma) < 1` (0 Karma) — it cannot be armed.
- **D9 (settled at 2nd review):** **top-up.** After the initial roll, the player
  may add Karma dice **one at a time** — each charged as added — while dice used
  `< rank`, Karma remains, and (if a target number is set) the total is still
  below it. Stops at rank / Karma exhaustion / target met.
- **D10 (settled at 2nd review):** **no-target top-up is allowed.** With no target
  number entered, the top-up still runs up to the rank and Karma caps (the
  "target met" stop simply never triggers) — a target-less roll is not denied the
  add-one-by-one.
- **D11 (done 2026-08-16):** **"Roll again" removed from every roll**, replaced by
  a plain **OK** button that closes the modal (`ui/ed-roll-modal.js`; stale
  comments in `ed-app.js`/`ed-roll-modal.js` scrubbed). It was a testing-only
  affordance; removing it also simplifies the set-dice charge model (no re-roll to
  reconcile). This change is already landed, independent of the rest of this plan.
- **D5 (settled):** display of the cap — show "up to N" next to the stepper,
  where N is the rank cap before the Karma clamp, so the player understands
  why it's limited.
- **D6 (settled at review):** `rollKarmaDice` returns a **`rollStep`-shaped**
  result (`groups` per die + `step`/`dice`/`total`), not `{ rolls, total }`,
  so the modal render, `_grandTotal()`, and ed-app's Roll Log reader need no
  changes.
- **D7 (settled at review):** stepper minimum is **1** (max `1 … maxDice`).
  The option folds its Strain as soon as it is armed, so count 0 would bill 2
  Strain for nothing.
- **D8 (settled at review):** `maxDice` is computed in exactly one seam —
  `_karmaCtx` in `ui/ed-combat.js` — then passed through `ed-app`'s `ed-roll`
  handler and defaulted to `1` in the modal.

## 9a. True Shot bundle (final, post-review)

```jsonc
"combatOptions": [
  {
    "name": "True Shot",
    "appliesTo": ["missile", "throwing"],
    "karmaDice": { "source": "rank" },
    "summary": "Add up to (rank) extra Karma dice to a ranged Attack test; 2 Strain.",
    "effects": [
      { "type": "resource-modifier",
        "target": { "domain": "resource", "name": "Strain" },
        "operation": "add", "value": 2, "measure": "points",
        "condition": "situational", "source": "condition",
        "summary": "2 Strain." }
    ]
  }
]
```

## 10. Files that change (when built)

| File | Change |
|---|---|
| `rules/talents.json` | Add `combatOptions` (True Shot). |
| `store.js` | Build `combat.talentOptions`; resolve `karmaDice.max` from rank. |
| `ui/ed-combat.js` | Merge `talentOptions` into `_allOptions()`; `_karmaCtx` adds `maxDice` (D8 seam); disable the pill at 0 Karma (D-gate); skip pre-charging Strain for a set-dice option, pass its Strain through `ed-roll` (D-strain). |
| `ui/ed-roll-modal.js` | `maxDice` prop; set-dice state (deferred roll); initial stepper `1 … maxDice`; commit charges batch + Strain; top-up loop "Add 1 Karma die" (D9). ("Roll again" already removed for all rolls, replaced by OK — D11, done 2026-08-16.) |
| `ui/ed-app.js` | Pass `maxDice` (and the deferred Strain) through the `ed-roll` → modal wiring; honor `spend: C` at commit and `spend: 1` per top-up. |
| `engine/dice.js` | `rollKarmaDice(stepRow, count)` pure helper — returns a `rollStep`-shaped result (D6). |
| `docs/THREAD-ITEMS.md` / a new `docs/` note | Document talent-sourced combat options alongside item-scoped ones, and the written boundary: numeric effects go in the taxonomy; roll-shape mechanics go in bundle metadata (`karmaDice` = first instance). |
| `store-combat.test.js`, `engine/dice.test.js` | Cover `talentOptions` surfacing/scoping and multi-die roll/spend. |

## 11. Test intent

- **Store:** True Shot owned at rank R (missile discipline) surfaces one
  `talentOptions` bundle with `karmaDice.max === R`; rank 0 / unowned → absent;
  dedupe keeps the highest rank.
- **Scope:** the bundle is offered for a missile/throwing pick, hidden for melee.
- **Engine:** `rollKarmaDice(stepRow, n)` returns a **`rollStep`-shaped** result:
  `n` groups and a summed total; `n <= 0` → empty `groups`, total 0; the shape
  matches a single die so the modal's existing render path works unchanged.
- **Modal (behavioral, layout):** `maxDice = 1` renders the legacy toggle;
  `maxDice > 1` renders a stepper clamped to `min(rank, available)` **min 1**,
  opens in the set-dice state (no auto-roll), commits via the primary action and
  charges `spend: C` + 2 Strain exactly once, and Escape/✕ *before* commit
  charges nothing (Karma **and** Strain).
- **Top-up (D9):** after commit, "Add 1 Karma die" charges `spend: 1` per click,
  rolls one die, re-totals; it is offered only while dice-used `< rank`, Karma
  remains, and (target set) total `<` target; it disappears when any stop trips.
  A roll with a target already met after the initial batch offers no top-up.
  **No-target roll (D10):** top-up still offered up to the rank/Karma caps.
- **Strain timing (D-strain):** a set-dice option pays 0 Strain if the modal is
  Escaped before commit, and exactly 2 Strain once committed.
- **0-Karma gate (D-gate):** the pill is disabled when the character has 0 Karma.
- **Karma-ctx edge:** a `karmaDice` option on a roll whose pick has no known
  grants renders no dice control (no-op), never throws.

---

## 12. Second instance — Mystic Aim (the aim-roll pattern)

**Status: implemented on `dev` (2026-08-16).** The owner-corrected design — `+2
steps PER SUCCESS`, aim Karma-eligible (MA8), bonus consumed by one attack (MA4),
canonical talent effect aligned to `step` (MA9) — is live. Suite **537** green
(added: `successCount` + per-success scaling in `engine/combat.test.js`, Mystic
Aim karma/perSuccess assertions in `store-combat.test.js`). Reuses the
talent-option rails (§3–§5) for a different mechanic: a **precursor roll that arms
a bonus**.

**Workflow.** Roll Initiative → select **Mystic Aim** (offered only for a
missile/throwing pick) → a modal opens with an **input for the target's Mystic
Defence** → roll Mystic Aim (Perception step + rank) vs that number → **the aim
scores some number of successes; each success arms +2 steps for the Attack roll**
(2 successes → +4 steps, 3 → +6, …); a miss (0 successes) arms nothing. A new
round (Initiative), a pick change, or deselecting the option disarms it.

**Success count (MA7).** The aim test resolves in Earthdawn success levels vs the
entered Mystic Defence: meeting it is **1 success**, and every additional **5**
over it is one more. So `successes = total ≥ MD ? 1 + floor((total − MD) / 5) : 0`
— the same rule as `attackSuccessLevels`, plus the base success for meeting the
number. The armed bonus is `2 × successes` **steps**.

**Relation to the rulebook data.** The stored Mystic Aim talent effect is already
`+2 to the Attack test, perSuccess` (measure `result`). The owner's correction
aligns the combat option to **per-success** too, but as a **step** bonus (`+2
steps` each), not a result bonus — that is the one intended divergence. Strain is
the talent's **1 Strain**, charged **when the aim test is rolled** (owner-confirmed).

### 12.1 How it is modelled (per-success revision — implemented)

- **Data** (`rules/talents.json` Mystic Aim `combatOptions`): `appliesTo:
  [missile, throwing]`, metadata `aimRoll: { vs: "Mystic", strain: 1 }`, and one
  `on-success` bundle effect — a `+2` **step** `test-modifier` on `{test, Attack}`
  **with `perSuccess: true`** (mirrors the talent's own effect, but measure
  `step`). `aimRoll` is bundle metadata, like `karmaDice` / `appliesTo` — **no
  taxonomy change**.
- **Store**: `combat.talentOptions` injects the talent's derived **Step** into
  `aimRoll.step` (as it injects `karmaDice.max` for True Shot). *No change.*
- **Engine** (`engine/combat.js`): **`armedOptions` carries a magnitude, not just
  a name.** Change it from a name array to a **map `{ optionName: successCount }`**
  (0/absent = not armed). In `addBundle`, an `on-success` effect of an armed
  option folds `value × successCount` when `perSuccess`, else once when
  `successCount > 0`; unarmed (count 0/absent) → withheld. This keeps the existing
  gate and adds the per-success scaling in one place.
- **Combat tab** (`ui/ed-combat.js`): selecting an `aimRoll` option fires the aim
  test at once (`_rollAim` → `ed-roll` with an `aim` config, with Karma die). The
  outcome flows back through the **Roll Log** the tab already observes
  (`_onRollLogged`): the newest entry whose label starts with the option name and
  is **newer than the select** (`_aimSince` freshness guard). **Compute
  `successes` from that entry's `total` and `difficulty` (the formula above) and
  store `_aimSuccesses` (0 = disarmed).** `_poolEffects` passes **`armedOptions:
  { [name]: _aimSuccesses }`**, so `2 × successes` steps fold into the Attack pool
  only while the aim is live. The pill shows a **✓ +N** badge (N = the step bonus).
- **Roll modal** (`ui/ed-roll-modal.js`): the **aim mode** (deferred, target-
  defence input, Strain on the Roll action, Escape-before-Roll is free) stays.
  **Outcome text shows the success count and resulting bonus** — e.g. "Aim hit —
  2 successes, +4 steps" — computed with the same formula so the player sees what
  armed. The entered difficulty already rides `ed-roll-logged`; the tab
  recomputes successes from `total`/`difficulty` (single source of truth).

### 12.2 Decisions (Mystic Aim)

- **MA1:** scope = ranged (missile, throwing) — matches "Boost ranged attack".
- **MA2 (revised):** bonus = **+2 steps PER SUCCESS** (owner correction), not flat.
  Still a **step** bonus (the intended divergence from the talent's `result`
  effect which needs to be updated to align).
- **MA3:** Strain = **1** (talent), charged when the aim test is **rolled**
  (owner-confirmed), deferred so Escape before the Roll charges nothing.
- **MA4 (revised):** the armed bonus is **consumed by one Attack roll** — a single
  buffed attack, then it disarms (re-aim to buff another). It also clears on
  Initiative / deselect / pick change, whichever comes first. **Implementation
  wrinkle:** `_aimSuccesses` is recomputed from the still-present aim Roll-Log
  entry on every `ed-roll-logged`, so consuming needs an explicit `_aimConsumed`
  flag — set when an Attack logs while armed — that suppresses re-arming until the
  next aim roll fires (a fresh `_aimSince`).
- **MA5:** arm state derives from the Roll Log entry + a freshness anchor
  (`_aimSince`), so it survives the cross-component boundary without new plumbing.
- **MA6 (revised):** the armed value is a **magnitude** (`2 × successes` steps),
  not a boolean — `armedOptions` becomes a name→successCount map in the engine.
- **MA7:** `successes = total ≥ MD ? 1 + floor((total − MD) / 5) : 0` (ED success
  levels: 1 for meeting MD, +1 per 5 over).
- **MA8 (owner edit):** the aim test is **Karma-eligible** — `_rollAim` passes the
  Mystic Aim talent's karma context, so the aim modal offers the single Karma die.
- **MA9 (settled):** align the talent's *canonical* `effects[]` to the houserule
  by switching its measure `result` → `step` (+2 **step** per success). A
  deliberate divergence from the rulebook (+2 to the *result*), owner-approved.

### 12.3 Tests (to update when the revision is built)

- `engine/combat.test.js`: a `perSuccess` `on-success` effect folds `value ×
  successCount` when armed (e.g. count 2 → +4 steps), once when non-perSuccess and
  count > 0, and is withheld at count 0; `armedOptions` frees only the named
  option.
- `store-combat.test.js`: Mystic Aim surfaces with `aimRoll.step` = Perception
  step + rank, `vs`/`strain` carried, the on-success `+2` **step** `perSuccess`
  effect present; absent when the talent is unowned.
- A success-count unit (either a small pure helper or via `attackSuccessLevels`):
  `total` beating `MD` by 0/5/10 → 1/2/3 successes → +2/+4/+6 steps; a miss → 0.

### 12.4 Delta from the flat-+2 first version (what the build changed — done)

- `rules/talents.json`:
  - Add `perSuccess: true` to Mystic Aim's `combatOptions` on-success **step** effect.
  - **(MA9, settled)** Change the talent's *canonical* `effects[]` entry from
    `measure: result` to `measure: step` so the reference effect matches the
    houserule (+2 **steps** per success). A deliberate divergence from the
    rulebook (+2 to the *result*), owner-approved.
- `engine/combat.js`: `armedOptions` array → `{name: successCount}` map; scale
  `perSuccess` on-success effects by the count.
- `store.js`: `combat.talentOptions` also injects the talent's **`karma`** context
  into `aimRoll` (as it injects `aimRoll.step`), so the aim test can offer a Karma
  die (owner edit — the aim roll is now Karma-eligible).
- `ui/ed-combat.js`:
  - `_aimArmed` (name) → `_aimSuccesses` (count); compute it from the log entry's
    `total`/`difficulty`; pass the map to `collectCombatEffects`; badge shows `+N`.
  - `_rollAim` passes the talent's `karma` context (was `null`) so the aim modal
    offers the single Karma die.
  - Add `_aimConsumed` (MA4): an Attack roll logged while armed disarms the bonus.
- `ui/ed-roll-modal.js`: aim outcome text shows successes + resulting step bonus.
  (Aim mode already supports the Karma toggle once the roll lands — no new work
  beyond passing a non-null `karma`.)
- Tests above.
