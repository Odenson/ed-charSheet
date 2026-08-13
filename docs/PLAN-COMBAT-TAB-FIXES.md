# Plan: Combat Tab — bug fixes & feature follow-ups (v1.1)

Follow-up work on the Combat tab (`ui/ed-combat.js`, `engine/combat.js`,
`rules/combat.json`) from owner testing, 2026-08-11. Each item below is analysed,
tier-classified against [CLAUDE.md](../CLAUDE.md), and given a proposed fix +
files touched. **Nothing is implemented yet — this document is for owner review.**

Open questions that block implementation are collected in
[§Open questions](#open-questions).

---

## Item 0 — Move the Combat tab after Disciplines  🔒 Tier 1 (owner-directed)

**Now:** `TABS` order is Overview · Disciplines · Spells · Equipment · Combat · Notes
(`ui/ed-app.js:25`).
**Change:** Overview · Disciplines · **Combat** · Spells · Equipment · Notes.

- Reordering the tab set touches the locked UI-GUIDELINES §4 tab contract, but it
  is explicitly owner-requested, so it is authorised.
- **Files:** `ui/ed-app.js` (`TABS` array only) + `docs/UI-GUIDELINES.md` §4 (note
  the new order + sign-off date). No logic change; `ed-app` routes by `id`, not
  index. Verify the 6-tab bar still fits desktop on one row and folds on mobile.

---

## Item 8 — Knockdown "adds +3" ~~instead of −3~~  ❌ REMOVED (owner)

**Owner 2026-08-11: could not reproduce, removed from scope.** For the record, a
full trace showed the engine yields −3 on every path (`KNOCKED_DOWN_EFFECT.value =
-3`, merged mod sum −3, chip badge "−3 act"), consistent with the rules.

---

## Item 2 — Stand up from the Combat tab  ✅ Tier 3

**Now:** Overview shows a "Stand up" button on the Knocked Down active-effect row
(`ui/ed-overview.js:675`) that dispatches `ed-edit-health { knockedDown: false }`.
The Combat tab has no equivalent.

**Fix:** When `model.combat.conditions.knockedDown`, surface a "Stand up" chip/
button (mirrors the locked Knocked Down situational chip) that dispatches the same
`ed-edit-health { knockedDown: false }`. Optionally fold in the **Jump Up** option
(2 Strain, Dexterity (6) test) later — v1 just stands (Standard action), matching
Overview.

- **Files:** `ui/ed-combat.js` only. Data-down / events-up preserved.

---

## Item 4 + 5 — Filter the attack picker by weapon, and include skills  ✅ Tier 3

Two related changes to the "Attack talent" dropdown.

**4 — Filter by weapon category.** Each weapon's `ref.category` is `melee` /
`missile` / `throwing`. Map category → the talents/skills that can wield it:

| Weapon category | Allowed attack talents/skills |
|---|---|
| `melee`    | Melee Weapon |
| `missile`  | Missile Weapon |
| `throwing` | Throwing Weapon *(owner decision: throwing-only, no melee)* |
| Unarmed (synthetic) | Unarmed Combat |

The dropdown shows only the allowed entries for the selected weapon; switching
weapon re-filters and resets the pick to the first valid one.

**5 — Include skills.** A character may have "Melee Weapon" etc. as a *skill*
(`model.skills`) rather than a talent. Merge attack-capable skills into the same
picker, matched by the same category map, labelled to show talent vs skill (e.g.
`Melee Weapon · skill · 9`). Skills carry `step` / `action`.
**Karma caveat:** the skill model has **no `karma` field today** (store.js skill
shape = name/rank/attribute/action/step/dice/…, no karma context). v1 rolls skills
with **`karma: null`** (no Karma toggle). If the owner wants Karma on skill tests,
that is a small follow-up (`karmaUse(skill.name, …)` in `store.js`) — flag, not a
blocker.

- **Engine:** add a pure `attackTalentsFor(category)` / category→names map in
  `engine/combat.js` (or a small `rules/combat.json` `weaponTalents` block so the
  mapping is data, not code — preferred, keeps it authorable). Store surfaces
  `combat.attackTalents` already; add `combat.attackSkills` (owned skills whose
  name is in the attack-talent set), same shape.
- **UI:** `ui/ed-combat.js` `_talents()` becomes `_attackOptions()` = filtered
  talents + skills; the selected option feeds `attackPool` unchanged (it just
  needs a `step` + `karma`).
- **Files:** `store.js` (expose `attackSkills` + category), `engine/combat.js`
  (mapping), `ui/ed-combat.js` (filtered picker), `rules/combat.json` (optional
  `weaponTalents` map). All Tier 3 (data within schema + pure logic + view).

---

## Item 6 — Free-action talent/skill, no weapon needed  ✅ Tier 3

**Need:** roll a combat talent/skill that is *not* an attack — Avoid Blow,
Anticipate Blow, etc. — as a standalone action, not tied to a weapon.

**Fix (owner design 2026-08-11):** add a **"None"** default entry to the *weapon*
dropdown (alongside Unarmed). When **None** is selected, the talent/skill picker
drops the weapon-category filter and lists **every** talent and skill the
character owns that has a `step` (each rollable). Picking one and hitting the
Attack-line `⚄` rolls that talent/skill on its own `step` / `karma` — a plain
action roll, no weapon coupling. This reuses the existing picker + roll modal
instead of a separate section.

- With **None**: the Damage line has no weapon, so it shows the placeholder pill
  (no fabricated damage); Strain from combat options still applies if toggled.
  Show the picked talent/skill's `action` cost (Free/Simple/Standard/Sustain) as a
  badge so the player sees it.
- This unifies with Items 4+5: a real weapon → category-filtered list; **None** →
  full list. One code path (`_attackOptions()` keyed off the selected weapon).
- **Files:** `ui/ed-combat.js` (None entry + unfiltered list), reusing the
  `store.js` `attackSkills`/talents surface from Items 4+5. Tier 3.

---

## Item 7 — Bonus damage on extra attack success levels  ✅ Tier 3 (rules Q2)

**Rule (owner):** every 5 the attack test beats the target number is one success
level; **extra** success levels add to damage. Example: target 5, attack rolls
17 → beats by 12 → 2 extra levels → **+2 steps** to the Damage step.

**Confirmed formula (owner):** a success level = every whole 5 the attack result
is above the target number, and each level gives the Damage roll **+1 step**:

```
successLevels  = max(0, floor((attackResult − targetNumber) / 5))  // clamp: miss → 0
damageStepBonus = successLevels                                     // +1 Damage step per level
```

Note the `max(0, …)`: on a miss `attackResult < targetNumber`, `floor` goes
negative — clamp to 0 so a miss never *reduces* damage. Worked examples (owner):
target 5 → result 11 = 1 level (+1); result 17 = 2 (+2); result 24 = 3 (+3).
Only applies on a **hit** with a **target number** entered.

**Architecture:** attack and damage are currently independent rolls; the attack
result must reach the damage pool.

1. `engine/combat.js` — add pure `attackSuccessLevels(result, target)` (with the
   clamp) and thread `bonusSteps` into `damagePool({ …, bonusSteps })` (added to
   `step`).
2. `ui/ed-combat.js` — source the last attack's **final total** and **target** from
   the Roll Log it already reloads on `ed-roll-logged`: the newest **attack** entry
   carries `total` (post-mods, incl. any Knocked Down −3) and `difficulty`. Match
   the attack roll specifically (its label starts "Attack"), not damage/initiative.
   Compute the bonus, show it as a badge on the Damage line (e.g. "+2 dmg · 2
   successes"). Clears when the weapon/talent pick changes.
3. Placeholder-pill rule intact: no target or no attack result → no fabricated
   bonus (bonus is 0, base Damage step shows normally).

- **Files:** `engine/combat.js`, `ui/ed-combat.js`, tests. Tier 3.

---

## Item 3 — Karma tracking across the whole app  ✅ Tier 3 architecture, ⚠ cross-cutting

**Now:** `character.resources.karma.available` is a stored **input** (store.js:745
reads it; nothing writes it). The roll modal's "Spend Karma" toggle rolls a +D6
but **never decrements** the stored Karma.

**Fix:** when a Karma die is spent on a roll, persist `available − (dice spent)`.

- The modal (`ui/ed-roll-modal.js`) dispatches a new **`ed-edit-karma`** (or reuse
  a generic resource edit) event up when Karma is toggled **on**; `ed-app`
  persists `resources.karma.available` and re-derives. Events-up / store-only-
  inputs preserved (`available` is already an input).
- **Toggle semantics (owner: charge, no refund):** toggling Karma **on**
  decrements `available` by 1 and it **stays spent** even if toggled off. One
  Karma die = −1 Karma. Guard against double-charge on "Roll again" and on a
  repeated on→off→on within the same modal open (charge only the first on for a
  given roll interaction / `rollId`), so a single roll never costs more than the
  dice actually rolled. No refund path.
- **App-wide:** this lives in the shared roll modal, so it applies to **every**
  Karma-eligible roll (attributes, talents, initiative, damage, combat) — not just
  the Combat tab. That is the owner's intent ("across the whole app").
- Undo: the Combat tab's undo stack covers Health only; Karma spend is a separate
  resource. v1: no undo on Karma (the player can edit Karma in the Overview/edit
  mode). Owner accepted (charge, no refund).
- **Guards (must-have):**
  - Only charge when `available` is a finite number **> 0** — never write
    `null − 1` (NaN) or go negative. When `available <= 0`, the "Spend Karma"
    toggle is disabled (no die to spend).
  - `ed-app` holds the open roll's config in `this._roll` (with a `karma.available`
    snapshot taken at open). After a spend + re-derive, **update `this._roll.karma
    .available`** too, or the modal's "X Karma" readout won't decrement live.
  - Each spend persists the overlay (a save), same as any `ed-edit-*`. Expected.
- **Files:** `ui/ed-roll-modal.js` (dispatch on spend + per-`rollId` charged flag +
  disable at 0), `ui/ed-app.js` (persist + re-derive + refresh `this._roll.karma`),
  `store.js` (nothing — `available` already read). Tier 3, but verify no derived
  value is stored (only `available`, an input, is written).

---

## Item 1 — Ranged ammo tracking (arrows/bolts consumed)  ⏸ DEFERRED (owner)

**Owner decision 2026-08-11: deferred.** Not in this batch — revisit separately.
The analysis below is kept for that future ticket.

---

<details><summary>Deferred analysis (Tier 1 flag)</summary>

**Now:** ammo items are `kind: "ammunition"` (e.g. "20 Longbow Arrows") with the
count **baked into the name** — there is **no quantity field** on an item input,
and **no linkage** from ammo → weapon. The item input shape has no per-item count.

**Two blockers, both needing an owner decision (Q6):**

1. **Storing a count is an item-input *shape* change** → 🔒 Tier 1 (character.json
   / `ed-items` schema shape). Storing a `quantity` (or `consumed`) is storing an
   *input*, which is allowed, but **adding the field to the item shape** is a
   locked-shape change that needs owner sign-off. Options:
   - (a) Add optional `quantity` to the item input (canonical fix; Tier 1 sign-off).
   - (b) Track consumption in a separate ephemeral/session counter only (no
     persistence) — Tier 3, but resets on reload, so "tracking" is weak.
2. **Ammo → weapon matching** has no data. Need either a `ref.ammoFor`
   (weapon name/category) on each ammunition item, or a name heuristic
   ("Longbow Arrows" ↔ "Longbow"). Adding `ref.ammoFor` is Tier 3 data within the
   items shape (preferred, explicit).

**Proposed design (pending Q6):**
- Add `ref.ammoFor: [weapon names or category]` to ammunition entries in
  `rules/items.json` (Tier 3 data).
- Add optional `quantity` to the item input shape (Tier 1 — owner sign-off).
- On a **missile/throwing** attack roll, if the selected weapon has matching
  equipped ammo, decrement its quantity by 1 via `ed-edit-items` (events-up). Show
  remaining ammo on the Damage/range line; block or warn at 0.
- Throwing weapons that *are* the ammo (daggers, spears) — decrement the weapon
  itself? Or infinite? — Q6.

**Files (if approved):** `rules/items.json` (ammoFor), item input schema +
`store.js` (quantity surfacing), `ui/ed-combat.js` (decrement on ranged roll +
count display).

</details>

---

## Summary — tiers & sequencing

| # | Item | Tier | Status |
|---|------|------|--------|
| 0 | Move Combat tab after Disciplines | 🔒 T1 (owner-directed) | ready |
| 2 | Stand up in Combat tab | ✅ T3 | ready |
| 4+5 | Filter picker by weapon + include skills | ✅ T3 | ready (throwing-only) |
| 6 | "None" weapon → all talents/skills | ✅ T3 | ready |
| 7 | Bonus damage per success level | ✅ T3 | ready (formula confirmed) |
| 3 | Karma tracking app-wide | ✅ T3 (cross-cutting) | ready (charge, no refund) |
| ~~8~~ | ~~Knockdown +3 bug~~ | — | ❌ removed (not reproducible) |
| 1 | Ranged ammo tracking | 🔒 T1 | ⏸ deferred |

**Build order:** 0, 2 (trivial) → 4+5+6 (unified picker) → 7 (damage) →
3 (karma, app-wide, test carefully). #8 removed; #1 deferred.

Every item keeps: data-down/events-up, pure DOM-free engine, store-only-inputs,
placeholder pills for missing derived values, Escape/Enter on modals, light+dark,
relative paths.

**Tests & docs (each item):**
- `engine/combat.test.js` — `attackSuccessLevels` (miss→0, exact bands, examples
  11/17/24), `damagePool` with `bonusSteps`, and the category→talent map.
- `store-combat.test.js` — `attackSkills` surface + category on weapons.
- `data/changelog.json` `unreleased` entry; `docs/UI-GUIDELINES.md` §4 tab-order
  note (Item 0). Suite must stay green (`npm test`, incl. the import check).

---

## Resolved (owner, 2026-08-11)

- **Q2 (item 7):** ✅ success level = `floor((result − target)/5)`; **+1 Damage
  step per level**. First 5-band (hit, 0–4 over) = 0 bonus.
- **Q3 (item 4):** ✅ **Throwing-only** for throwing-category weapons (no melee).
- **Q5 (item 3):** ✅ **Charge, no refund** — toggle-on = −1 Karma, stays spent;
  guard against double-charge on "Roll again". App-wide.
- **Q6 (item 1):** ✅ **Deferred** — ammo not in this batch.

- **Q1 (item 8):** ✅ Removed — not reproducible.
- **Q4 (item 6):** ✅ Resolved — a **"None"** weapon entry unfilters the picker to
  **all** owned talents + skills (no separate Actions section).

## Still open

- *(none — ready to implement Items 0, 2, 4+5+6, 7, 3.)*
