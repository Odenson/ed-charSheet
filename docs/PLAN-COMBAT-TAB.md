# Plan: Combat Tab — non-spell combat simulation

A new **sixth tab** that runs a character through **non-spell** combat: roll
Initiative, pick a **weapon + attack talent**, layer **combat options** and
**situational (environmental) effects** and **equipped-magic-item** contributions,
roll the **Attack** against an *optional* target's Defense, roll **Damage**
against an *optional* Armor, and **auto-apply strain / incoming damage / healing**
to the sheet (with undo) — reusing the existing health engine, roll modal, active-
effect fold, and Legend-nothing-new store discipline. Spell combat stays in the
**Spells** tab; this tab owns everything else a character does in a combat round.

This file is the **living status page**: tick a step `[x]` and set its **Status**
when it lands, append to [Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner (Tier-1 sign-off + decisions below confirmed 2026-08-10).
- **Created:** 2026-08-10. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `13b6fb3`, with the **Notes-tab** feature and the
  **import-validator** tooling in the working tree (uncommitted). Suite at
  **381 tests** (`npm test`, which now runs `tools/check-imports.mjs` first).
- **Research constraint:** rules sourced **only** from `rulebook extracts/`
  (local ED4 Player's Guide + the curated `player-tables-narrative.txt`).

---

## Source rules (local rulebooks only)

All values below are transcribed from `rulebook extracts/`. **The authority is the
Player's Guide** (`text-RB-players-guide.txt`, Combat Options Table + prose
p.382–390, and the Situation Modifiers Table p.386–390). The curated
`player-tables-narrative.txt` contains **two transcription errors** and PG wins
(see the ⚠ notes) — the plan and `rules/combat.json` follow the PG.

**Combat options** — Combat Options Table, PG p.382–385. `name — strain — effect`:

| Option | Strain | Effect |
|---|---|---|
| Aggressive Attack | 1 / attack | +3 Attack **and** Damage; −3 Physical & Mystic Defense. **Mutually exclusive with Defensive Stance** in the same round (p.382). |
| Attacking to Knockdown | 0 | possibly knocks the opponent down; **inflicts no real damage** |
| Attacking to Stun | 0 | the **Damage test inflicts Stun damage** (a damage subtype) |
| Called Shot | **1** | −3 Attack; on success hits the designated area. **Cannot be used to increase damage** (p.384). |
| Defensive Stance | 0 | +3 Physical & Mystic Defense; −3 **all** tests **except Knockdown**. Mutually exclusive with Aggressive Attack. |
| Jump Up | 2 | **knocked-down only**; stand as a **Simple** action via a **Dexterity (6) test** (modified by armor Initiative penalty; the −3 knocked-down penalty does **not** apply); on success stand + a Standard action, no other movement. |
| Setting Against a Charge | 0 | unhorse a charging opponent |
| Shattering a Shield | 1 | break the opponent's shield |
| Splitting Movement | 1 | move/action/move; character becomes **Harried** |
| Tail Attack *(t'skrang)* | 0 | extra Unarmed Combat attack at −2 to all tests |

> ⚠ `player-tables-narrative.txt` errors corrected here: it lists **Called Shot as
> 0 strain** (PG = **1**), and it **merges Attacking to Stun with Attacking to
> Knockdown** — the "may knock down / no real damage" text is *Attacking to
> Knockdown*; *Attacking to Stun* is "Damage test inflicts Stun damage." Both are
> distinct 0-strain options in the PG.

**Situational effects** — Situation Modifiers Table, PG p.386–390.
`name — Action-test mod — Defense mod`:

| Situation | Action test | Defense mod* |
|---|---|---|
| Blindsided | — | −2 |
| Partial Cover | — | +2 |
| Full Cover | — | **NA** (cannot be attacked without special abilities) |
| Partial Darkness (Blindness/Dazzled) | −2 (sight-based tests) | — |
| Full Darkness (Blindness/Dazzled) | −4 (sight-based tests) | — |
| Harried | −2 | −2 |
| Impaired Movement — Light | −2 | — |
| Impaired Movement — Heavy | −4 | — |
| Knocked Down | −3 | −3 |
| Range — Short | — | — |
| Range — Long | −2 | — |
| Surprised | **No tests allowed** | −3 |

> **\* Defense modifiers are Physical & Mystic**; they apply to **Social Defense
> only at the gamemaster's discretion** (PG table footnote). So the earlier
> "P/M/S unconditional" reading was wrong — `rules/combat.json` encodes Physical +
> Mystic `defense-modifier`s and carries the Social-at-discretion caveat as a
> `note`.

**Round mechanics** (Player's Guide, transcribed):
- **Initiative Step = Dexterity Step − armor penalty** (p.304). Already
  derived — `model.characteristics.initiative` (`store.js:735`).
- **Attack test** = a Dexterity-based **attack talent** (Melee Weapon / Missile
  Weapon / Unarmed Combat / Thrown Weapon) vs. the target's **Physical Defense**
  (or Mystic Defense for mystic attacks).
- **Damage test** = **weapon Damage Step + Strength step** vs. the target's
  **Physical Armor** (net = result − armor). The app already treats *every*
  weapon category as "Strength-step base + weapon Damage Step" (see the `weapon`
  note in `rules/items.json` and EFFECT-TAXONOMY v3 §4.1). Missile ranges come
  from the weapon's `ref`.
- **Strain** = self-inflicted damage that **bypasses armor**; combat options and
  some talents cost it. Applied to the character's own Health.
- **Health / wounds / knockdown / recovery** are already implemented — see
  [PLAN-DAMAGE-HEALING.md](PLAN-DAMAGE-HEALING.md) and
  [PLAN-WOUNDS-KNOCKDOWN.md](PLAN-WOUNDS-KNOCKDOWN.md). This tab **reuses** them,
  it does not re-implement them.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| **New 6th "Combat" tab + tab wiring** | 🔒 **Tier 1 — owner sign-off 2026-08-10** | Alters the locked UI-GUIDELINES §4 rule *"Five tabs, each a distinct lens"* (Overview / Disciplines / Spells / Gear / Notes). The owner approved adding a **sixth** tab. The tab bar must still fit the desktop viewport and fold to a stacked column on mobile (§2). |
| New `ui/ed-combat.js` component | ✅ Tier 3 | New view for the new tab; composes the existing roll modal, health flows, and effect fold. Honors all Tier-1 UI rules. |
| New `rules/combat.json` (`schema: "ed-combat/1"`, `effectTaxonomy: v3`) — combat options + situational effects as **taxonomy-conformant effect bundles** | ✅ Tier 3 | A **new rules file within the existing taxonomy** — no shape change, no bump. Uses vocabulary already in v3: `attack-modifier` (attack/Damage **step**), `defense-modifier` (**Physical + Mystic**), `test`/`Action` modifiers (step **or** result — see B10), `resource-modifier` (`{domain:"resource",name:"Strain"}`, `measure: points` — verified in-vocabulary, no bump; see A9), `characteristic-modifier` (Initiative), and `note` for non-mechanical / unmodelled riders (Full Cover NA, Surprised, Stun). |
| New pure `engine/combat.js` — assemble the attack/damage **step + mods**, sum **strain**, resolve **outcome** vs an optional target | ✅ Tier 3 | Pure, DOM-free; **composes** existing derivations (talent step, weapon damage, folded effects). Computes nothing the store persists. |
| Reuse `engine/health.js` (`applyHealth`, `woundsFromHit`, `knockdown*`, recovery) for auto-apply | ✅ Tier 3 | **No change.** The tab dispatches `ed-edit-health` / `ed-roll`; the engine stays pure. |
| Combat **selections are ephemeral session state** (weapon, options, situational, target) — **not persisted** | ✅ Tier 3 | Upholds "store only inputs." The live combat setup is a transient scratchpad (like the roll modal's state), reset on reload / character switch. **Only results** — damage / wounds / recoveries — write to `resources.health`, which is already an input. |
| Effect taxonomy | ✅ Untouched (one **doc-only** candidate note) | No vocabulary change; **v3, no bump.** Defensive Stance's "except Knockdown" is carried as `scope: "except-knockdown"` and parsed by `engine/combat.js` (Knockdown is **not** a test-domain name — adding one would be Tier-2, taxonomy open-question #5). Add `"except-knockdown"` to the taxonomy's **candidate-scope list as a doc note only** — no field/vocabulary change, so no bump. |

**Tier-1 invariants this plan must not break:**
- **Store only inputs** — combat setup is ephemeral; the *only* writes are to the
  existing `resources.health` inputs (damage/wounds/recoveriesUsed/knockedDown).
  Attack/Damage/Initiative **steps**, dice, and hit/miss outcomes are derived and
  never stored.
- **Data down / events up** — the tab dispatches `ed-roll` (to the roll modal),
  `ed-roll-logged` (to the Roll Log), and `ed-edit-health` (to persist results);
  `ed-app` applies through the pure engine. The engine stays pure and DOM-free.
- **Derived values render as muted dashed placeholder pills, never a fabricated
  number** — if an attack talent, weapon Damage Step, Initiative, or a Defense is
  missing, the tab shows the pill; no invented step, no guessed outcome without a
  real roll.
- **Modals honor Escape-closes / Enter-confirms** (§7) — the roll modal, the
  take-a-hit / recovery flows, and any combat modal follow the contract.
- **Overview still fits the desktop viewport with no vertical scroll** — Overview
  is untouched. **New viewport risk: the tab bar now has 6 tabs** — it must still
  fit desktop on one row and fold on mobile (Phase G verify). The Combat tab's
  *own* content may scroll (only Overview is no-scroll).
- **Theme-aware, two font weights (400/500), relative `./…` paths.**

---

## Confirmed decisions (owner answers, 2026-08-10)

1. **New sixth "Combat" tab** (Tier-1 sign-off). Non-spell combat only; spell
   combat stays in the **Spells** tab. Proposed tab glyph **◎** (a target/strike
   mark, distinct from Equipment's `⚔`) — monoline, theme-aware, not color-emoji.
2. **Lightweight optional target.** Optional inputs: the target's **Physical /
   Mystic Defense** → the attack roll resolves **hit/miss** through the roll
   modal's existing `difficulty` support; the target's **Armor** → **net damage**
   = Damage result − Armor. **Empty target = roll-only** (assemble the pool, roll,
   GM adjudicates). **No opponent entity is tracked or stored** — the target is
   just the numbers needed for this one resolution.
3. **Auto-apply, with undo.** Confirming a result writes to the character's Health
   through the existing engine, and each write is **undoable** (a session
   revert of the last applied action). What auto-applies is only what lands on the
   *character*:
   - **Strain** from the character's own options/talents (self-damage, bypasses
     armor);
   - **Incoming damage** when the character is the defender ("take a hit" →
     wounds/knockdown via `engine/health.js`);
   - **Healing / Recovery** results.
   **Outgoing** damage to the target is **display-only** (no opponent is stored).
4. **Combat setup is ephemeral** (decision-tier consequence of #3 + "store only
   inputs"): the selected weapon/talent/options/situational/target and the undo
   stack are live UI state. **`ed-app` renders only the active tab (`ed-app.js:705`),
   so this state is destroyed on every tab switch** (not just reload/character
   switch) — intended behaviour for a per-encounter scratchpad (A15). Nothing about
   the encounter is persisted; only Health results are (and the roll history, via
   the device-local Roll Log).
5. **Options + situational effects live in `rules/combat.json`** as
   taxonomy-conformant effect bundles — one source of truth the engine folds
   exactly like race/talent/item effects. The UI renders them from data, never
   hardcodes the numbers.
6. **Equipped magic items on attack & defence.** The tab surfaces the
   attack/defense contributions that **equipped, thread-woven** magic items
   already fold (via their `effects`), and lists any **activatable** item effects
   as toggles — reusing the existing equipped-item fold. No new item mechanics.

---

## Review corrections (verified against the Player's Guide, 2026-08-10)

A code + rulebook review produced 16 findings; all are folded into the tables and
phases above. Inline citations use the reviewer's point number (e.g. `A9`, `B10`
— the letter just marks the phase that owns it). Ledger:

**Rule transcription (PG p.382–390 is authority; `player-tables-narrative.txt` was
wrong):**
1. **Called Shot = 1 Strain** (not 0). ✔ table + Phase A.
2. **Attacking to Stun ≠ Attacking to Knockdown** — two distinct 0-strain
   options; "may knock down / no real damage" is *Knockdown*, "Damage test
   inflicts Stun damage" is *Stun*. ✔ table (both rows) + Phase A note-riders.
3. **Defense modifiers are Physical & Mystic** (Social at GM discretion, per the
   table footnote), not P/M/S. ✔ table footnote + Phase A.
4. **Aggressive Attack = 1 Strain per attack** — charge per *confirmed attack*,
   not per toggle. ✔ Phase F (A12).
5. Riders: **Jump Up** is a Dexterity (6) Simple-action test (knocked-down only,
   ignores the −3), **Called Shot cannot increase damage**; and the initiative
   page ref was a typo (**p.304**). ✔ table + Round mechanics.

**Modeling decisions pinned (all keep taxonomy v3, no bump):**
6. **Full Cover "NA" / Surprised "no test"** have no taxonomy encoding (`default`
   = "set", not "unhittable") → **`note`-only display riders**, nothing folded.
7. **Defense modifiers are display-only in the tab** — never dispatched into the
   always-on derived defense; shown as "derived Defense + toggled mods" for the GM.
8. **"Except Knockdown"** → `scope: "except-knockdown"` parsed by
   `engine/combat.js`; add the value to the taxonomy's candidate-scope list as a
   **doc note only** (Knockdown as a test-domain would be Tier-2).
9. **Strain is a `resource-modifier` effect**, not a `strain` field —
   `{ domain: "resource", name: "Strain" }`, `measure: "points"`. **Taxonomy
   check (2026-08-10): valid v3, no bump** (§2 type, §3 `resource` domain includes
   `Strain`, §5 `points`). Caveat: first `resource-modifier` in the data,
   combat.js is its only consumer, and Strain has no stored pool (applied as
   damage) — a plain `strain` field is the equally-Tier-3 fallback.
10. **`step` vs `result` measures stay separate** — option/situational mods are
    **step** mods (change the dice); the knocked-down penalty is a **result** mod
    (`_rollTimeMods`). `attackPool` returns `{ step, resultMods, strain }`.
11. **No double-counting live conditions — and the strip is ASYMMETRIC**
    (verified during the Phase C review). Both chips are pre-selected/locked from
    `model.combat.conditions`, but the sheet already applies each **differently**,
    so Phase D must strip them differently (a naive "strip all locked effects"
    is wrong in both directions):
    - **Knocked Down** — the sheet applies −3 to **every roll** (`_rollTimeMods`,
      `ed-app.js` — fires on all `ed-roll`s) **and** −3 to **defense** (folded).
      → **Strip entirely** from the combat pool: its Action result-mod (already in
      `_rollTimeMods`) **and** its defence-display mod (already in derived defence).
    - **Harried** (encumbrance) — the sheet applies **only** −2 **defence**
      (`engine/encumbrance.js` `encumbranceEffects` emits *only* `defense-modifier`s;
      `_rollTimeMods` does **not** touch Harried, so its −2 **Action** reaches **no
      roll** today). → Strip only the **defence-display** mod; **keep Harried's −2
      Action in the roll pool** — the Combat tab is the first place it is applied.
      Dropping it (treating Harried like Knocked Down) would **under-count**.
    So `engine/combat.js` `resultMods` must **exclude Knocked Down** (added by
    `_rollTimeMods`) but **include Harried's Action −2** (added nowhere else).
    *Edge:* `conditions.harried` is BURDENED-only; an **Overburdened** character
    reports `harried:false` (correct — a distinct, worse stage with no combat
    chip; its defence penalty is already folded, just not lockable). Acceptable v1.
12. **Strain cadence** — charged once, on **Apply** (confirmed attack), never on
    "Roll again".
13. **Karma on the Damage test** — expose the Damage-test karma grant
    (`rules/disciplines.json:57`) so the Damage `⚄` offers it.
14. **Option exclusivity** — add an `excludes` field; Aggressive Attack ⇄
    Defensive Stance enforced in the UI.
15. **Ephemeral state also dies on tab switch** (`ed-app.js:705` renders only the
    active tab) — intended for a per-encounter scratchpad.
16. **Stun damage** (Attacking to Stun) is a real subtype the sheet can't record
    → explicit **v1 prose rider**, not modelled.

---

## Status summary

| Phase | Status |
|-------|--------|
| A — `rules/combat.json` (10 options + 12 situational as effect bundles) | ✅ done |
| B — `engine/combat.js` (pure attack/damage/strain/outcome assembly) | ✅ done |
| C — Model surface (weapons, attack talents, initiative, defenses/armor for the tab) | ✅ done |
| D — UI `ui/ed-combat.js` (the tab) | ✅ done |
| E — Roll integration (attack / damage / initiative / recovery via the roll modal) | ✅ done |
| F — Auto-apply + undo (strain / incoming damage / heal → `ed-edit-health`) | ✅ done |
| G — Tab wiring (6th tab; desktop-fit + mobile fold) | ✅ done |
| H — Tests | ✅ done |
| I — Docs & changelog | ✅ done |

---

## The combat round this tab supports

1. **Initiative** — one tap rolls the character's Initiative Step
   (`characteristics.initiative`) through the roll modal; the result seeds a
   turn-order readout (informational; no opponents tracked).
2. **Choose the attack** — pick an **equipped weapon** (or Unarmed) and the
   matching **attack talent**. The tab shows the base **Attack step** (talent
   step) and **Damage step** (weapon Damage Step + Strength step) as real numbers,
   or placeholder pills if a piece is missing.
3. **Layer modifiers** — toggle **combat options** (strain badge) and
   **situational effects** (Action/Defense mod), plus any **activatable
   equipped-item** effects. The live summary shows the **final Attack/Damage step**
   (step-measure mods baked in), any **result-measure mods** carried to the roll,
   and the running **strain**. Defense-modifier toggles are **informational only**
   (they never change the derived defense — B7).
4. **Roll Attack** — `final attack step` (+ result mods) vs the optional **target
   number** to beat → hit/miss (roll modal `difficulty`). Karma is offered where
   the talent allows (existing roll-modal behavior).
5. **Roll Damage** (on a hit) — `weapon damage step + STR step + Σ damage mods`
   vs the optional **Armor** → **net damage** (display-only; the target isn't
   stored).
6. **Apply to the character** (auto-apply, undoable) — the option **strain** lands
   on the character's Health; when the character is the **defender**, a "take a
   hit" flow runs incoming damage through the wound/knockdown engine.
7. **Manage health** — take damage, **Recovery test** (open-ended Toughness Effect
   test), heal, and reset recoveries are surfaced here too, reusing the Overview
   Health flows so a fight can be run entirely from this tab.

---

## Phase A — `rules/combat.json`

- New file `rules/combat.json` with `schema: "ed-combat/1"` and
  `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (v3)"`.
- Two arrays: `options` (10 combat options) and `situations` (12 situational
  effects), each entry
  `{ name, restricted?, excludes?, summary, effects: [ … ] }` where `effects` are
  v3-conformant. **Strain is an effect, not a field** (A9): a `resource-modifier`
  with target **`{ domain: "resource", name: "Strain" }`**, `operation: add`,
  `value: N`, `measure: "points"` — all in-vocabulary (EFFECT-TAXONOMY §2 type,
  §3 `resource` domain lists `Strain`, §5 `points` = pool), so **Tier 3, no bump**
  (verified 2026-08-10). It keeps every option's mechanics in one uniform
  `effects` array, and the strain badge renders from the effect. *Caveat:* this is
  the **first** `resource-modifier` in the data and `engine/combat.js` is its
  **only** consumer (no existing shared fold), and Strain has **no stored pool** —
  combat.js sums the declared strain and applies it as **damage** via
  `ed-edit-health` (still "store only inputs"). A plain numeric `strain` field is
  the equally-Tier-3 fallback if the effect read proves awkward.
  **`excludes`** lists mutually-exclusive option names (A14) — e.g.
  Aggressive Attack `excludes: ["Defensive Stance"]` and vice-versa.
  - Aggressive Attack → `attack-modifier` +3 **step** (attack **and** Damage) +
    two `defense-modifier` −3 (Physical, Mystic) + `resource-modifier` −1 Strain.
  - Called Shot → `attack-modifier` −3 **step** + `resource-modifier` −1 Strain +
    a `note` "cannot increase damage."
  - Defensive Stance → two `defense-modifier` +3 (Physical, Mystic) + a `test`/
    `Action` −3 with **`scope: "except-knockdown"`** (parsed by `engine/combat.js`
    — A8).
  - Attacking to Knockdown / Attacking to Stun → **`note`-only** riders (the
    knockdown side and the Stun damage subtype are unmodelled in v1 — A16); no
    folded modifier.
  - Jump Up → `note` only in v1 (a Dexterity (6) Simple-action test with its own
    rules; not part of the attack pool).
  - Situational e.g. Full Darkness → `test`/`Action` −4 `scope: "sight"`;
    Blindsided → **two** `defense-modifier` −2 (**Physical, Mystic** — *not* P/M/S)
    + a `note` "Social at GM discretion"; **Full Cover** and **Surprised** →
    **`note`-only** (Full Cover NA has no taxonomy encoding — `default` means "set
    to a value", not "unhittable" — A6; Surprised's "no test allowed" is likewise
    a display rider).
- Defense modifiers are **Physical + Mystic** across the board, with a `note`
  carrying the "Social at the gamemaster's discretion" caveat (PG footnote).
- Non-mechanical riders (Called Shot "hits the area", Split Movement "Harried",
  Shatter Shield) carry a `summary`/`note`; Split Movement cross-references the
  Harried situation — the engine applies the mechanical part, the UI shows prose.

## Phase B — `engine/combat.js` (pure)

- **`step` vs `result` mods are distinct measures (B10).** Combat-option and
  situational modifiers are **step** modifiers (PG default: "+3 to Steps… Step 10
  → Step 13"), but the knocked-down penalty is a **flat result** mod (see
  `_rollTimeMods`, `ed-app.js:617`). Do **not** conflate them.
- `attackPool({ talentStep, effects })` → `{ step, resultMods: [{label,value}],
  strain }` — folds the selected effect bundles: `measure: step` effects change
  `step`, `measure: result` effects become `resultMods` (passed to the roll
  modal's flat `mods`), and `resource-modifier` Strain sums into `strain`.
- `damagePool({ weaponDamageStep, strengthStep, effects })` → `{ step, resultMods }`.
- `resolveAttack(result, targetNumber)` → `hit | miss | null` (null when no target
  number — roll-only); `netDamage(result, armor)` → number | null.
- **Defense modifiers are never folded here (B7).** Defensive Stance /
  Blindsided / Cover etc. are *display-only* in the tab (see Phase D); they do not
  enter `attackPool`/`damagePool` and are **never dispatched into the derived
  defense** (that is an always-on derived stat).
- Parses `scope: "except-knockdown"` (B8) so Defensive Stance's −3 is excluded
  from a Knockdown test if the tab ever assembles one.
- Pure and DOM-free; unit-tested against the `rules/combat.json` values.

## Phase C — Model surface (`deriveModel`)

- Expose the pieces the tab needs, all already derived elsewhere: the character's
  **attack talents** (Melee/Missile/Unarmed/Thrown with their steps), **equipped
  weapons** (name + Damage Step + category + range + **`ref.image`** from
  `rules/items.json`), **Strength step**, **Initiative**, current **P/M Defense**,
  **Armor**, and **Health**. No new stored values.
- **Expose the character's current combat conditions** (Knocked Down, encumbrance
  **Harried**) so the tab can **pre-select and lock** those situation chips
  (B11) — they are already folded into the sheet, so the player must not be able
  to add them a second time.
- **Damage-test karma (B13):** expose any **Damage-test** karma-use grant (the
  ranged-weapon grant exists — `rules/disciplines.json:57`) alongside the
  attack-test one, so the Damage `⚄` can offer Karma like any roll.

## Phase D — UI `ui/ed-combat.js`

- Layout per the reviewed mock ([Mock](#mock)): wide **"Your attack"** panel
  (weapon image + weapon/talent pickers, compact Attack/Damage/Strain stat-lines
  with an inline target-# field, collapsible **chip** sections for options /
  situational / blood charms) + a thin rail (**Damage taken** + the device-local
  **Combat log**).
- **Defense-modifier chips are informational (B7):** where the tab shows a
  defense figure, render it as "derived Defense **+ toggled mods**" for the GM's
  reference — the toggle never changes the real derived stat.
- **Mutual exclusivity (A14):** selecting an option disables/clears any option in
  its `excludes` list (Aggressive Attack ⇄ Defensive Stance).
- **Locked current-condition chips (B11):** Knocked Down / Harried show
  **pre-selected and disabled** when `model.combat.conditions` reports them; the
  player adds only *other* situations. **The effects fed to `attackPool` are
  stripped asymmetrically** (see B11): drop Knocked Down's effects entirely, but
  **keep Harried's Action −2** in the pool while dropping its defence mod from the
  informational display. Don't hand the raw locked-chip bundles to `attackPool`.
- Derived numbers (steps, initiative, defenses) use the placeholder-pill helper
  when absent. Every option/situational chip renders from `rules/combat.json`.

## Phase E — Roll integration

- Roll Attack / Damage / Initiative / Recovery all dispatch **`ed-roll`** with the
  assembled `stepRow`, the flat **`mods`** (= `resultMods` from Phase B — the
  step-measure mods are already baked into `stepRow`), optional `difficulty` (the
  target #), and `karma` where offered — **including the Damage-test karma grant
  (B13)**, so the Damage `⚄` offers Karma too. The **existing** roll modal handles
  the dice, karma, and outcome display, and emits **`ed-roll-logged`** so every
  combat roll lands in the device-local Roll Log automatically. The engine stays
  pure; the view computes no game values.
- **`ed-roll` currently ignores an event `mods` and always sets
  `mods: this._rollTimeMods(...)`** (Knocked Down only). Phase E must extend the
  `ed-roll` handler to accept the combat tab's `mods` and **merge** them with
  `_rollTimeMods` — **not** overwrite. This dovetails with the B11 strip rule and
  keeps the two channels disjoint: `_rollTimeMods` carries **Knocked Down**, the
  combat tab's `resultMods` carry **Harried's Action −2** (and any other
  result-measure combat mods), so nothing double-counts. Verify the merge does not
  re-add Knocked Down from the combat side.

## Phase F — Auto-apply + undo

- Applying strain / incoming damage / a heal dispatches **`ed-edit-health`**
  (existing path) so `ed-app` persists and re-derives. A small **session undo
  stack** in `ed-combat` records the pre-apply Health snapshot and offers a
  one-tap **Undo** on the result card (Escape-dismissable). Undo re-dispatches the
  prior Health input. Nothing new is stored — undo lives in ephemeral UI state.
- **Strain cadence (A12):** option strain is charged **once per confirmed
  attack** — i.e. on **Apply**, reading the *current* toggle state — **not** per
  toggle and **not** per modal "Roll again". Re-rolling the same attack never
  re-charges strain.

## Phase G — Tab wiring (Tier-1 surface)

- Add `{ id: 'combat', label: 'Combat', icon: '◎' }` to `TABS` (`ui/ed-app.js:24`)
  and route it to `<ed-combat>`. **Verify the Tier-1 fit:** 6 tabs still fit the
  desktop viewport on one row, and the bar folds to a stacked column on mobile
  (§2). If 6 labels overflow, the fallback is icon-first/short labels — **not**
  dropping the no-scroll or fold rules.

## Phase H — Tests

- `engine/combat.test.js`: attack/damage pool assembly and strain totals from the
  real `rules/combat.json`; Aggressive Attack (+3/+3 **step**, −3/−3 Physical &
  Mystic, −1 Strain), Called Shot (1 Strain), Defensive Stance
  (`except-knockdown` scope), Full Darkness sight scope; **step-vs-result mods
  are separated** (B10); **defense mods are excluded from the pool** (B7);
  **note-only riders** (Full Cover, Surprised, Attacking to Stun/Knockdown) fold
  **nothing**; `resolveAttack` hit/miss/null and `netDamage` with/without armor.
- `rules/combat.json` shape/`schema`/`effectTaxonomy` guard; every effect validates
  against the taxonomy vocabulary (reuse `engine/validate-item.js`-style checks).
- Model surface: attack talents + equipped weapons + steps exposed; missing pieces
  derive `null` (placeholder pill), never a fabricated step.
- Suite stays green (`npm test`, incl. the import check).

## Phase I — Docs & changelog

- `data/changelog.json` `unreleased` entry.
- **UI-GUIDELINES §4 must be updated to say "Six tabs"** and add the Combat row —
  this is the doc half of the Tier-1 sign-off (the rule is *changing by owner
  decision*, so the doc changes with it). Note the sign-off date.
- No taxonomy touch (v3 stays).

---

## Open questions / v1 scope boundaries

- **Multi-attack / second-weapon talents** (Momentum Attack, Second Weapon, Tail
  Attack's extra attack) — v1 treats each attack as one pass; chaining is a
  follow-up. Tail Attack's −2 is available as an option; the extra *attack* is
  manual (roll twice).
- **Weapon special riders** (Flail/Whip entangle, Net) — shown as informational
  `summary` text in v1, not mechanized.
- **Ranged ammo tracking** (arrows/bolts consumed) — out of scope v1; ranges are
  shown, ammo count is not decremented.
- **Turn order across multiple combatants** — Initiative is rolled and shown for
  the character only (no opponent Initiative), consistent with "no opponent
  stored."

---

## Mock

Interactive UI mock: [mock-combat-tab.html](mock-combat-tab.html), kept in
`docs/` as the reference mock (not published). **Mock is for UX approval only —
no engine, representative numbers.**

The mock reflects the **owner-reviewed final layout** (2026-08-10), which refines
several plan defaults — implementers follow the mock where it differs from the
prose above:

- **Full tab width** (`max-width: 60rem`, matching `ed-app`) and **Overview
  design language** — `0.62rem` uppercase section headings, `0.8rem` lines,
  `1rem` values, `0.72rem` chips, `22px` round `⚄` roll icons.
- **One wide "Your attack" panel + a thin right "Damage taken" column.**
- **Attack / Damage / Strain as compact stat-lines**, not large step tiles: the
  Attack line carries an inline **target-# field** (the number to beat → hit/miss
  via the roll modal's `difficulty`) and its `⚄`; the Damage line carries its
  `⚄` and the **Strain** total on the same row.
- **Combat options / Situational / Blood charms are collapsible chip sections**
  (headers show a live active-count). **Blood charms render as chips** (not rows),
  combat-relevant only, implant Blood-Magic-Damage not surfaced (it is already
  folded by the engine while equipped).
- **Blood charms are spent at the new round's Initiative roll** (owner decision,
  2026-08-11): a charm armed (chip on) during a round is a use. Rolling
  Initiative signals the start of a new round, so every armed charm is
  **deactivated** (chip off) and **unequipped** (`equipped: false` persisted via
  `ed-edit-items`; `ui/item-equip-state.js` `unequipSpentCharms` reshapes the
  inputs — pure, tested). It returns via the Equipment tab's Equipped/Stored
  toggle once its Blood Magic Damage has healed — the sheet doesn't model the
  heal, so re-equipping is the player's call. Note the ordering: arm charms
  *after* rolling Initiative for a round, or the first Initiative roll spends them
  before any attack uses the bonus.
- **No separate Opponent panel** — the single target number lives on the Attack
  row (Decision #2's "lightweight optional target", inlined).
- **"Damage taken"** is a thin column mirroring the Overview Health panel with
  less detail: **Current damage** + Unconscious/Death ratings + a `✚`
  take-damage affordance and a `⚄` Recovery test, with a live status pill
  (Unhurt → Conscious → Unconscious → Dead). **Wounds and Knockdown are not shown
  in v1** (deferred with the opponent-side modelling).
- **Weapon image** — a **square** placeholder to the left of the
  dropdowns / Attack / Damage rows (sized to their combined height via CSS grid,
  not flex — flex collapses the square to its content width). Shows the selected
  weapon's image from its item entry (same repo-image pattern as the Overview
  portrait; `ref.image` on the weapon / custom item), falling back to a
  **missing-image marker** when absent.
- **Combat log** — the right rail's second panel (under "Damage taken"): a
  **view of the device-local Roll Log** (`store-rolllog.js`, the Notes-tab log
  from [PLAN-NOTES-TAB.md](PLAN-NOTES-TAB.md) decisions #2/#5), newest-first, with
  a **Clear**. It is **roll-only** — selecting options/charms/situational does
  **not** add rows; instead each **attack/damage/initiative roll** logs one line
  with the **active options summarized on it** (e.g. `Attack Step 17 → 16 vs 11 —
  Hit · Aggressive Attack, Desperate Blow`). Because it is the same Roll Log,
  combat rolls appear here **and** on the Notes tab, and never ride an export or a
  GitHub save.

---

## Issues & learnings

- *(none yet — first fill on implementation.)*

## Progress log

- **2026-08-10** — Plan created. Rules transcribed from `rulebook extracts/`
  (combat options + situational effects tables, initiative, attack/damage flow).
  Owner Tier-1 sign-off to add a **sixth Combat tab**; decisions locked
  (lightweight optional target; auto-apply strain/damage/heal with undo; combat
  setup ephemeral; options/situational as `rules/combat.json` effect bundles;
  equipped-magic-item contributions surfaced via the existing fold). No code yet.
- **2026-08-10** — Mock iterated with the owner to a final layout and saved to
  `docs/mock-combat-tab.html` (see the [Mock](#mock) section for the deltas it
  locks in): full tab width + Overview sizing; wide attack panel + thin
  "Damage taken" column; compact Attack/Damage/Strain stat-lines with an inline
  target-# field; collapsible option/situational/**blood-charm chip** sections;
  Opponent panel dropped; Wounds/Knockdown deferred in v1. Phase D to follow this
  layout. Still no code.
- **2026-08-10** — Two more mock rounds locked in (final `docs/mock-combat-tab.html`):
  a **square weapon-image** area (missing-image marker fallback) left of the top
  three rows, and a right-rail **Combat log** that is a **roll-only view of the
  device-local Roll Log** (`store-rolllog.js`) — options are summarized on each
  roll line rather than logged per toggle, and the log is shared with the Notes
  tab. Plan Mock section updated to match.
- **2026-08-10** — Owner code+rulebook review folded in (16 findings — see
  [Review corrections](#review-corrections-verified-against-the-players-guide-2026-08-10)).
  **Rule fixes verified against `text-RB-players-guide.txt`** (PG p.382–390):
  Called Shot = 1 Strain; Attacking to Stun vs Attacking to Knockdown split;
  defense mods are Physical & Mystic (Social at GM discretion); Jump Up /
  Called-Shot riders; initiative p.304. **Modeling pinned** (all keep v3, no bump):
  strain as a `resource-modifier` effect, `step`-vs-`result` measures separated,
  defense mods display-only, `except-knockdown` scope (doc-note candidate),
  `excludes` for mutual exclusivity, pre-locked live conditions, strain charged
  on Apply, Damage-test karma, tab-switch-resets-state, Stun as a v1 prose rider.
  Tables + Phases A–F + guardrail rows updated. Still no code — ready for Phase A.
- **2026-08-10** — **Strain-resource taxonomy check** (owner-requested, de-risks
  Phase A): confirmed `resource-modifier` + `{domain:"resource",name:"Strain"}` +
  `measure:"points"` are all present in EFFECT-TAXONOMY v3 (§2/§3/§5) ⇒ **Tier 3,
  no bump**. Flagged the caveats the review's rationale missed — it is the *first*
  `resource-modifier` in the data, `engine/combat.js` is its *only* consumer (no
  shared fold to reuse), and Strain has no stored pool (combat.js applies the
  summed cost as damage). Plan A9 + Phase A + guardrail row corrected; a plain
  `strain` field noted as the equally-Tier-3 fallback. No taxonomy touch.
- **2026-08-11** — **Phase A landed.** `rules/combat.json` written and handed
  over; verified against the taxonomy and the PG-derived tables above:
  - 10 options + 12 situations, `schema: "ed-combat/1"`,
    `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (v3)"`; **288 automated
    conformance checks pass** (types, operations, measures, conditions, targets,
    sources across every effect).
  - Strain as `resource-modifier` (A9), `excludes` (A14), `scope:
    "except-knockdown"` (A8) and `"sight"`, `mapsToCondition` for Harried /
    Knocked Down (B11), defense mods Physical+Mystic with the Social-at-GM
    `note` (PG footnote), note-only riders for Full Cover / Surprised / Stun /
    Knockdown / Jump Up / Tail Attack / Shatter / Split (A6/A16).
  - Cross-file fix: `rules/races.json` T'skrang `enable-option` now targets
    `Tail Attack` (was `TailAttack`) to match the option `name` — the key Phase B
    will resolve on. Taxonomy §3 `option`-domain example synced (doc-only, "e.g.",
    no bump). Both are Tier-3 data/`doc` edits; no schema or taxonomy change.
  - Not yet wired into `store.js` (Phase B/C consume it). Tests for the file's
    shape/conformance are Phase H.
- **2026-08-11** — **Phase B landed.** `engine/combat.js` (pure, DOM-free) +
  `engine/combat.test.js`:
  - `attackPool({ talentStep, effects, opts })` → `{ step, resultMods, strain }`;
    `damagePool({ weaponDamageStep, strengthStep, effects })` → `{ step,
    resultMods }`; `resolveAttack(result, targetNumber)` → `hit|miss|null`;
    `netDamage(result, armor)` → number|null (floored at 0).
  - Step-vs-result separation (B10): `measure:"step"` folds into `step`,
    `measure:"result"` becomes a flat `mods` entry (Knocked Down −3).
  - Defense modifiers excluded from pools (B7); `note` riders fold nothing
    (A6/A16); Strain sums across selected options (A9).
  - Test-kind policy: the Attack test is an Action test (Action mods fold);
    the Damage test is an Effect test (plain Action mods don't, but
    `scope:"except-knockdown"` does — Defensive Stance B8). `scope:"sight"`
    is skipped for an attack when `opts.sightBased: false`.
  - Missing base (talent/weapon/Strength step) keeps `step: null` → placeholder
    pill, never a fabricated step.
  - **15 new tests** against the real `rules/combat.json` (all plan B10/B7/B8
    cases + resolvers). Suite **396/396 green**. `engine/combat.js` is picked up
    by `npm run lint:imports` automatically (engine/* scan).
- **2026-08-11** — **Phase C landed.** New `model.combat` surface in
  `store.js` `deriveModel` (all derived from values already folded — no new
  stored inputs):
  - `combat.attackTalents` — the canonical Melee/Missile/Unarmed/Throwing Weapon
    talents in fixed order, resolved from the character's owned talents
    (highest-rank instance); unowned ones derive `known: false`, `step: null`
    (placeholder pill), never a fabricated number.
  - `combat.equippedWeapons` — the equipped `weapon`-kind items with
    category / Damage Step / short-long range / **`ref.image`** (Ork Dagger →
    `data/Std-ork-dagger.png`); melee weapons carry no range (null); stored and
    non-weapon items excluded.
  - `combat.strengthStep`, `combat.conditions` (`knockedDown` from the stored
    health input; `harried` = Burdened encumbrance stage → the tab pre-selects
    and locks both chips, B11) and `combat.damageKarma` (`karmaUse('Damage',
    activeEffects)` — the Archer circle-5 ranged-weapon grant, B13).
  - Initiative / P-M Defense / Armor / Health were already derived
    (`characteristics` + `healthState`) — test locks them as real numbers.
  - **6 new tests** (`store-combat.test.js`, real rules files, no deps). Suite
    **402/402 green**. Phase H's model-surface checklist item covered.
- **2026-08-11** — **Phase C review.** Approved (correct, well-scoped, no new
  stored values). The review surfaced one **non-obvious correctness trap for
  Phase D**, now captured in **B11** and the Phase D/E bullets: the pre-lock strip
  is **asymmetric** — Knocked Down is already applied to both rolls
  (`_rollTimeMods`) and defence, so strip it entirely; Harried is applied **only**
  to defence (`encumbranceEffects` emits no Action test-modifier), so its −2
  **Action must be kept** in the combat pool or it under-counts. Related Phase E
  note added: `ed-roll` currently overwrites `mods` with `_rollTimeMods` and must
  be extended to **merge** the combat tab's `resultMods` instead. Minor edge
  noted: `conditions.harried` is Burdened-only (Overburdened → `false`, no chip).
- **2026-08-11** — **Phases D–H landed.** `ui/ed-combat.js` (the tab, following
  the owner-reviewed mock), the **B11 asymmetric strip** in
  `engine/combat.js` (`collectCombatEffects` — Knocked Down stripped entirely,
  Harried keeps its Action −2 but sheds its defence mods, player toggles return
  informational `defenseMods`), and `store.js` exposing **`model.combatRules`**
  (the `rules/combat.json` bundles the chips render from). Phase E wiring:
  `ed-app`'s `ed-roll` handler now **merges** the view's `mods` with
  `_rollTimeMods` (pool result-mods first, then the universal Knocked Down −3) —
  the two channels stay disjoint; the roll modal honours `difficulty.win/lose`
  words (Hit/Miss) and the Roll Log shows the outcome. Phase F: strain charged
  once on Apply (A12), session undo stack (max 8, Escape-dismissable), damage
  modal auto-wounds via `woundsFromHit` and triggers the Knockdown test 5+
  over threshold, Recovery test reuses the existing `recovery-heal` apply and
  lands on the undo stack. Phase G: `{ id:'combat', label:'Combat', icon:'◎' }`
  added to `TABS` + routed (6 tabs, bar wraps on mobile). Phase H: 6 new
  `collectCombatEffects` tests + 1 `combatRules` model test. A stale
  `rules/combat.json` Knocked Down note claiming Recovery/Knockdown exemptions
  was corrected to match the Option-B policy (every test, Karma die only
  excluded). **408/408 tests green; import check 37 modules clean.** Uncommitted
  on `dev`.
- **2026-08-11** — **Blood-charm spend mechanic.** Owner decision: a blood charm
  armed in the Combat tab is a per-round use; the **Initiative roll** (start of a
  new round) deactivates every armed charm and **unequips** it — `equipped:false`
  persisted through `ed-edit-items`, re-equip via the Equipment tab once healed.
  Pure helper `unequipSpentCharms` added to `ui/item-equip-state.js` (input-shape
  reshape, threadRank preserved, 4 new tests); `ed-combat._rollInitiative` spends
  before rolling. **412/412 tests green; import check 37 modules clean.**
  Uncommitted on `dev`.
