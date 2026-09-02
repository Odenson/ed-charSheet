# Plan: Spells tab — Grimoire management and in-combat casting

This plan defines a new **Spells tab** for the app: a place to list and manage a
character's spells (a *Grimoire*) and to *cast* them in play. It is a **plan
only — no implementation yet**. It exists to be reviewed and refined; the data
model in particular touches a **Tier-1 surface (schema shape)** and does not
proceed without owner sign-off.

The tab already exists as a stub in `ui/ed-app.js` (`TABS` has
`{ id: 'spells', label: 'Spells', icon: '✦' }` rendering a "Coming soon"
placeholder), so adding it does **not** change the five-tab contract — it fills
a tab the UI already reserves.

- **Owner:** repo owner.
- **Created:** 2026-08-18. **Status:** shapes signed off (2026-08-19);
  implementing on `dev`. Phases 8.2–8.6a delivered plus 6b prep; 8.6b + 8.7
  pending. Owner decisions below are normative. See the §10 changelog.
- **Branch of record:** `dev`.
- **Design reference:** [plans/mock-spells-tab.html](mock-spells-tab.html) — the
  interactive mockup produced with this plan (Option A/C merge: a left cast-type
  chooser + spell list + description, a right guided-cast workspace with a
  step-by-step fallback). Open it in a browser; the cast-type pills, the ✦
  matrix toggle (shorthand for placing/releasing a spell in a matrix), the
  guided/step-by-step switch, and the Cast button (target + Karma
  pause-and-offer prompt) are all live.
- **Rule reference:** [docs/UI-GUIDELINES.md](../docs/UI-GUIDELINES.md),
  [ARCHITECTURE.md](../ARCHITECTURE.md),
  [docs/EFFECT-TAXONOMY.md](../docs/EFFECT-TAXONOMY.md),
  [docs/THREAD-ITEMS.md](../docs/THREAD-ITEMS.md) (the closest existing pattern:
  a `rules/*.json` catalog + a thin per-character input block + a pure engine
  fold). Casting mechanics: Earthdawn 4E Player's Guide — Spellcasting, Thread
  Weaving, Spell Matrices.

---

## 1. Goal and scope

A spellcasting character (e.g. a Nethermancer/Wizard/Elementalist) needs to:

1. **Manage a Grimoire** — see every spell they know, grouped by Discipline and
   Circle, with each spell's full mechanics and an original-wording description;
   learn new spells and remove spells (edit-mode only); place spells into their
   spell matrices (any time, not just edit mode).
2. **Cast in combat** — pick a *cast type* (Matrix / Grimoire / Raw; **Item** is
   a parked future enhancement), pick a spell, and resolve the cast either via a
   **guided** stepped flow (the fast path, with decision points) or a
   **step-by-step** manual flow (full control).

Non-goals for this plan: spell creation/homebrew authoring UI; the Item cast
type (pre-threaded spell matrices built into magic items — deferred, see §7);
grimoire spell *search/filter* beyond Discipline+Circle grouping; astral
sensing/patterning. These can be layered later without reworking the model.

---

## 2. Tier classification (read before building)


| Area                                       | Tier                        | Why                                                                                                                                                              |
| ------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New`rules/spells.json` catalog             | **Tier 1**                  | New`rules/*.json` file → a new **schema shape** (`schema: "ed-spells/1"`). The *shape* is Tier 1; the entries inside are Tier 3.                                |
| New`spells` block on `data/character.json` | **Tier 1**                  | Adds top-level fields to the`ed-character/1` shape (learned spells + matrices as **inputs**). Owner must sign off the field names/shape.                         |
| `engine/spells.js` (new pure module)       | **Tier 3**                  | New lazy-loaded engine module; must stay pure + DOM-free.                                                                                                        |
| `ui/ed-spells.js` (new tab view)           | **Tier 3**                  | New view honoring the Tier-1 UI rules.                                                                                                                           |
| `effects` vocabulary used by spells        | **Tier 2 only if extended** | Spells reuse the existing taxonomy (v3). If a spell needs a verb the vocabulary lacks, that is a separate Tier-2 change (bump + migrate) —**not** bundled here. |

**Gate:** §3 and §4 (the two Tier-1 shapes) require explicit owner approval of
field names before any code. Everything else is Tier 3 and follows once the
shapes are fixed.

---

## 3. Data model — `rules/spells.json` (Tier 1 shape) — PROPOSED

Mirrors `ed-talents/1` and `ed-thread-items/1`: a versioned catalog, mechanics +
original-wording summaries (never verbatim rulebook prose), effects in the
controlled taxonomy vocabulary. Each spell also carries a `description` — a
player-facing **paraphrase** (flavor + resolution + core mechanic) shown in the
spell's detail modal / Cast-view description panel; `summary` remains the terse
mechanic readout. `description` is catalog metadata, **not** an effect — no
taxonomy change, no version bump.

```jsonc
{
  "schema": "ed-spells/1",
  "effectTaxonomy": "docs/EFFECT-TAXONOMY.md (v3)",
  "source": "Earthdawn 4E Player's Guide — spells. Mechanics + original-wording summaries, no verbatim prose.",
  "threadCap": [                          // §3.1 — extra-thread cap by Circle band (rules data,
    { "minCircle": 1,  "maxCircle": 4,  "extraThreads": 1 },  //  not engine logic). The engine reads
    { "minCircle": 5,  "maxCircle": 8,  "extraThreads": 2 },  //  this table; it does not hard-code it.
    { "minCircle": 9,  "maxCircle": 12, "extraThreads": 3 },
    { "minCircle": 13, "maxCircle": 15, "extraThreads": 4 }
  ],
  "spells": {
"Soul Armor": {
      "name": "Soul Armor",
      "description": "Draws jagged blue sigils that coalesce into a glimmering suit of chain mail, which sinks into the target and adds +3 to his Mystic Armor. Cast against the target's Mystic Defense.",
                                             // long prose shown in the spell's detail modal /
                                             // Cast-view description panel; a player-facing
                                             // paraphrase of the rulebook (copyright-safe),
                                             // NEVER a mechanic readout — `summary` stays terse
      "discipline": "Nethermancer",       // which spellcasting Discipline's list — grouping only;
                                             // spells are unique across lists, so the character
                                             // block never stores it (§3.2 #5)
      "circle": 1,                          // spell Circle (drives Legend cost + grouping)
      "threadsToWeave": 1,                  // threads required to power the cast — forged
                                            // for ANY cast type (a Standard matrix holds
                                            // none; see §3.1); extra threads are assigns (§3.2 #2)
      "weavingDifficulty": { "value": 5, "reattune": 10 },
                                            // value    = the Thread Weaving target number (roll vs this)
                                            // reattune = on-the-fly matrix-swap difficulty — a
                                            //   POST-v1 mechanic; carried now so the Tier-1 shape
                                            //   is fixed once (§3.2 #1)
      "range": "10 yards",
      "duration": "Rank minutes",          // active while in the session active-effect set — in
                                            //   combat 1 minute = 10 rounds = 10 Initiative rolls
                                            //   (§3.2 #3, §3.3)
      "castingTarget": "Target's Mystic Defense",   // hint for the cast prompt: usually the target's
                                            //   defense (TMD), occasionally a fixed base number like
                                            //   6 — the test is always vs a NUMBER entered at cast time,
                                            //   pre-filled from the spell when fixed (§3.2 #4)
      "area": null,
      "successes": [
        // Per-EXTRA-success (success−1) effects riding the cast's own Spellcasting test.
        { "label": "Increase Duration (+2 minutes)",
          "effects": [
            { "type": "note", "condition": "on-success", "perSuccess": true,
              "scope": "spell-duration", "source": "spell",
              "summary": "Extends the active duration by +2 minutes per extra success." }
          ] }
        // The guided flow multiplies the perSuccess over extra successes and hands the
        // result to the session duration tracker (§3.3); a machine `duration-modifier`
        // type would be a Tier-2 migration later — `note` keeps today's shape taxonomy-clean.
      ],
      "extraThreads": [
        { "label": "Increase Duration", "benefit": "Duration +2 minutes", "effects": [] },
        { "label": "Increase Effect",   "benefit": "+2 Mystic Armor",
          "effects": [ /* folds with the active cast, +2 rating per assigned thread (§3.2 #2) */ ] },
        { "label": "Increase Range",    "benefit": "Range +10 yards",      "effects": [] },
        { "label": "Additional Target", "benefit": "+1 target",             "effects": [] }
      ],
      // Each extra thread woven beyond the required count is ASSIGNED one option
      // above; an option may be assigned many times and stacks 1:1 per thread.
      // The COUNT of extra threads is capped by the Circle table (§3.1): 1 at
      // Circles 1-4, 2 at 5-8, 3 at 9-12, 4 at 13-15. Extra-thread
      // rolls use the SAME weavingDifficulty.value as the first thread.
      "effects": [
        // SUSTAINED effect archetype (§3.4) — a static READOUT, never rolled
        // (Clarification A). Folds into the character's derived Mystic Armor ONLY
        // while this cast is in the session active-effect set (§3.3, a POST-v1
        // mechanism — phase 6b): a known-but-uncast spell contributes nothing.
        // `duration: sustained` is what marks it foldable and stops a passive
        // always-on fold.
        { "type": "armor-modifier", "target": { "domain": "armor", "name": "Mystic" },
          "operation": "add", "value": 3, "measure": "rating",
          "duration": "sustained", "source": "spell",
          "summary": "+3 Mystic Armor while the spell is active." }
      ],
      "summary": "Draws jagged blue sigils in the air; on a Spellcasting test vs the target's Mystic Defense a glimmering chain shirt sinks into the body, adding +3 to the target's Mystic Armor."
    },
    "Astral Spear": {
      "name": "Astral Spear",
      "description": "Weaves raw astral energy into a hurled spear of force; strikes the target's Mystic Defense; a successful cast deals its Effect step in damage.",
      "discipline": "Nethermancer",
      "circle": 1,
      "threadsToWeave": 1,        // same weave rules as Soul Armor (§3.1)
      "weavingDifficulty": { "value": 5, "reattune": 10 },
      "range": "40 yards",
      "duration": "1 round",
      "castingTarget": "Target's Mystic Defense",
      "area": null,
      "successes": [
        { "label": "Increase Effect (+2 Effect Step)",
          "effects": [
            { "type": "attack-modifier", "target": { "domain": "attack", "name": "Damage" },
              "operation": "add", "value": 2, "measure": "step",
              "condition": "on-success", "perSuccess": true, "duration": "test",
              "source": "spell",
              "summary": "+2 to the Effect step per extra success." }
          ] }
      ],
      "extraThreads": [
        { "label": "Increase Effect", "benefit": "+2 Effect Step",
          "effects": [ /* +2 step per assigned thread, folds with the active cast */ ] },
        { "label": "Increase Range",  "benefit": "Range +10 yards", "effects": [] }
      ],
      "effects": [
        // INSTANTANEOUS effect archetype (§3.4) — a one-shot Effect ROLL resolved
        // against the target at cast time, `duration: test`. NEVER a sustained fold
        // onto the caster's derived values (that would wrongly add +Willpower step
        // to the caster's other attacks). Built via the set-as-base contract in
        // docs/EFFECT-TAXONOMY.md §4.1: `set` declares the base (Willpower step),
        // `add` stacks on top — the same gather path as weapon damage, resolved
        // once, not folded.
        { "type": "attack-modifier", "target": { "domain": "attack", "name": "Damage" },
          "operation": "set", "value": { "ref": "attribute|Willpower|Step" },
          "measure": "step", "duration": "test", "source": "spell",
          "summary": "Effect = Willpower step." },
        { "type": "attack-modifier", "target": { "domain": "attack", "name": "Damage" },
          "operation": "add", "value": 4, "measure": "step", "duration": "test",
          "source": "spell",
          "summary": "+4 Effect step." }
      ],
      "summary": "Weaves raw astral energy into a hurled spear of force; strikes the target's Mystic Defense; a successful cast deals its Effect step in damage."
    }
  }
}
```

### 3.1 Matrix & thread-forging model (owner-confirmed)

Spells are **powered by the threads they require before the Spellcasting test**.
The owner settled the exceptions and the vocabulary:

- **A Standard matrix holds NO threads.** Placing a spell in a matrix (which
  enables the **Matrix** cast type) does **not** pre-forge its required threads.
  Casting a threaded spell — from a matrix, the grimoire, **or** raw — still
  requires forging `threadsToWeave` threads with the associated Thread Weaving
  talent. *"Matrix cast" ≠ "already woven"*: the weave step is driven by
  `threadsToWeave`, never skipped purely because the spell is in a matrix.
- **A 0-thread spell needs no weaving at all**, for any cast type — the caster
  may cast directly.
- **Any *forged* thread is a pre-condition of the cast (owner rule, 2026-09-02).**
  `threadsToWeave: 0` means "nothing required *up front*", **not** "never a
  pre-condition": the moment the caster rolls *any* thread — required **or**
  extra, on **any** spell — that thread is a pre-condition the cast must carry
  and consume. So a 0-thread spell suffices without a thread only until the
  caster chooses to weave an extra one; from the weave until the cast lands the
  cast "owns" the forged thread (it rides the cast and is spent on landing). A
  failed weave forges no thread and is no pre-condition. (See
  [PLAN-SPELLS-WEAVE-EFFECT.md §1e](PLAN-SPELLS-WEAVE-EFFECT.md).)
- **Extra threads are optional adds, for any spell.** Even a spell with
  `threadsToWeave: 0` (or one whose required threads are already covered) may
  have *extra* threads forged to boost its effects — the `extraThreads` options.
  This is the only sense in which a cast can "carry more threads than the spell
  requires".
- **Enhanced Matrix** and **Armoured Matrix** (talents at later Circles) are the
  two exceptions to "a matrix holds no threads": each can **hold up to one
  thread**, so a 1-thread spell cast from either skips forging that one required
  thread. The caster may *still* add extra threads on top. A 2+ thread spell
  still requires the remaining threads forged. (A bare "matrix" always means a
  **Standard** matrix, which holds none.)
- **Extra-thread cap — a Circle table, not an open count.** The number of *extra*
  threads (beyond the spell's required count) a caster may weave is fixed by the
  character's **Circle in the spell's Discipline**:

  | Circle | Max extra threads |
  |--------|-------------------|
  | 1–4    | 1                 |
  | 5–8    | 2                 |
  | 9–12   | 3                 |
  | 13–15  | 4                 |

  This table replaces any earlier "unlimited extra threads" reading. The cast
  flow **warns at the cap** and never offers beyond it.

  **The cap table is rules data, not engine logic (owner note).** It ships as a
  top-level `threadCap` block in `rules/spells.json` (part of the `ed-spells/1`
  shape), keyed by Circle band, so raising or retuning it is a data edit — the
  engine reads the table, it does not hard-code the numbers:

  ```jsonc
  "threadCap": [
    { "minCircle": 1,  "maxCircle": 4,  "extraThreads": 1 },
    { "minCircle": 5,  "maxCircle": 8,  "extraThreads": 2 },
    { "minCircle": 9,  "maxCircle": 12, "extraThreads": 3 },
    { "minCircle": 13, "maxCircle": 15, "extraThreads": 4 }
  ]
  ```

Consequently `castPlan`'s effective `threadsToWeave` = the spell's required
threads **minus** any thread the casting matrix already holds (0 for a Standard
matrix, up to 1 for Enhanced/Armoured), floored at 0 — and **independent of
cast type** otherwise.

Open shape questions for review:

- **Q1.** `castingTarget` — enum of Defenses (`Mystic Defense` / `Physical Defense` / `Social Defense`) plus a fixed-number form, or free text? (Affects
  whether the guided cast can auto-suggest the target number from the *target's*
  sheet later.)
  - A1. This is a numeric number that the casting roll will need to succeed, the number initially will be input by user but future versions could source a target from previous rolls asking if you are attacking the same target.
- **Q2.** Do we model `effect.step` vs `effect.static` split now, or store the
  effect purely as taxonomy `effects[]` and treat the readout as derived? (Lean:
  taxonomy `effects[]` is the source of truth; `effect.summary` is display only —
  consistent with talents/items.)
  - A2. Stick to taxonomy established patterns to ensure consistency
- **Q3.** File size — 4E has hundreds of spells across Disciplines. Do we seed
  only the Disciplines in play (Nethermancer first, like talents were seeded for
  Chakka), enriching incrementally? (Lean: yes, incremental, same as talents.)
  - There is a ready made extract for spells in the local rulebook extracts, lets use that and model only the Nethermancer for now.

### 3.2 Resolved shape decisions (owner-confirmed)

The §3 fields are settled as follows:

1. **`weavingDifficulty`** — two numbers, two purposes. `value` is the Thread
   Weaving target the caster rolls against to *power* the spell; `reattune` is
   the difficulty to **swap a spell in a matrix on the fly/instantly** — a
   **post-v1** mechanic. Both ride in the shape now (a Tier-1 shape is fixed
   once), but v1 flows use only `value`.
2. **`extraThreads`** — a structured options list. Each extra thread woven
   beyond the required count is **assigned one option**; an option may be
   assigned **many times** and its benefit stacks **1:1 per thread** (each
   thread = one pick). Example (Nightflyer's Cloak): a 2-thread spell with two
   extra options — a 3ᵗʰ thread is assigned "increase effect ×1", a 4ᵗʰ can be
   assigned either option again, giving duration ×2, effect ×2, or one each.
   **The count of extra threads is capped by the Circle table** (§3.1 — 1 at
   Circles 1–4, up to 4 at Circles 13–15), derived from the character's Circle
   in the spell's Discipline — the flow **warns at the cap** and never offers
   beyond it. Extra-thread rolls use the **same `weavingDifficulty.value`** as
   the first thread.
3. **`successes`** — structured array; each entry is a `label` plus optional
   taxonomy `effects[]`. Machine-applicable entries use `on-success` +
   `perSuccess` on the **cast's Spellcasting test**; the multiplier is the
   number of **extra successes** (successes above the first — the first success
   is the cast itself). Two kinds seen so far:
   - **Effect boosts** — e.g. Last Chance casts its base effect (+4 steps to
     Recovery tests) and **+2 per extra success**: a `test-modifier` on
     `{test, Recovery}`, `measure: step`, `condition: on-success`,
     `perSuccess: true`.
   - **Duration boosts** — e.g. Soul Armor extends its active duration **per
     extra success**. Durations are **live countdown effects, not
     display-only**: a successful cast activates the spell's effect on the
     character for `Duration: Rank minutes`, and in combat the countdown ticks
     a round off **each Initiative roll** (owner's rule: **1 round = 1
     Initiative roll**, 1 minute = 10 rounds, so Rank 1 = 10 initiative rolls).
     This is a session-side
     active-effect tracker (Clarification A / §6.1 step 5), never persisted as
     a derived number.
4. **`castingTarget`** — the cast test is always vs a **number**, entered at
   cast time (A7). The field is a *hint label*: usually the target's defense
   (`"Target's Mystic Defense"` = TMD), occasionally a fixed base number (`6`)
   the cast prompt can pre-fill.
5. **`known[].discipline`** — **dropped** (§3.2 #5). Spell names are unique
   across Disciplines, so the character block never stores it — the engine
   derives it from `rules/spells.json`. The catalog keeps `discipline` for
   Grimoire grouping.

### 3.3 Effect subject — fold or no-fold (owner-confirmed, Clarification B)

A spell's `effects[]` are always written for the spell's **subject** (the
character the spell is cast on). The rule that was tripping both of us up: the
**subject is decided at cast time**, and it decides whether the effects fold
into *this* character sheet:

- **Cast on this character** — the spell's `effects[]` enter the session's
  **active-effect set** and fold into the character's derived values for the
  spell's duration — the same mechanics as the knock-down condition fold,
  counted down each Initiative roll (Soul Armor's +3 **Mystic Armor** adds onto
  the character's derived Mystic Armor while active).
- **Cast on another character** — the effects **do not** fold into this sheet.
  The cast is recorded (roll log; the target and its number were entered at
  cast time), and the fold is someone else's sheet — a future multi-character
  concern, never this one's derived values.

So **there is no "intended target" taxonomy field, and no catalog change**:
the `effects[]` describe potency on a subject; *who the subject is* is chosen
in the cast flow, recorded on the session's active-cast record, and the engine
folds only the casts whose subject is this character. Nothing about it is
persisted in `character.json` (store only inputs — a cast's subject is exactly
the kind of transient that belongs in session state, alongside knock-down).

### 3.4 Effect archetypes — sustained vs instantaneous (owner review flag)

Every spell `effects[]` entry is **one of two archetypes**, distinguished by
`duration`, and the engine treats them on **different paths** — conflating them
is a correctness bug:

| Archetype | `duration` | How it resolves | Example |
|---|---|---|---|
| **Sustained** buff/debuff on a subject | `sustained` | Enters the session active-effect set and **folds into derived values** for the duration; counts down per Initiative roll. Fold applies **only when the subject is this character** (§3.3). | Soul Armor — +3 Mystic Armor while active |
| **Instantaneous** attack / effect roll | `test` (or `rounds` for a lingering rider) | Resolved **once at cast time** against the target — the Effect pill rolls it. **Never folded** onto the caster's derived values. | Astral Spear — Effect = Willpower step +4, dealt once |

Rule for the catalog and engine: a one-shot damage/heal/effect uses
`duration: test` and is **never** marked `sustained`; only a genuine
maintained-on-subject buff is `sustained`. The engine folds `sustained` effects
(and only when subject = this character); it rolls `test` effects through the
Effect pill and applies the result to the recorded target. A short lingering
side-effect (e.g. a 1-round penalty on the victim) is `rounds` with `"rounds": 1`
and belongs to the *target's* sheet, not the caster's — out of v1 scope, same as
any other cast-on-another fold.

**Scope — resolved (owner), but staged (B1):** folding self-cast effects into
derived values is **wanted** and is specified here — the effect is what a sheet
is for. **Correction:** this is **net-new infrastructure**, not a reuse of
knock-down — knock-down is a *condition chip* (session scratch cleared on
Initiative), not a duration-counted fold of a modifier into derived values, and
the engine has no such fold today (grep: `duration` appears only in
`validate-item.js`). So it is **staged into phase 6b**, after the core cast flow
ships in 6a. When built, a successful self-cast enters the session active-effect
set
and folds (Soul Armor's +3 Mystic Armor shows on the character), counted down
per Initiative roll; a cast on another folds nothing here. To make the subject
unambiguous at the table, the cast flow carries an **explicit target indicator**
(see §6.1 step 1) so it is always visible whether this cast folds into this
sheet or is aimed elsewhere — the trigger for (and mirror of) the active-effect
fold.

---

## 4. Data model — character `spells` block (Tier 1 shape) — PROPOSED

**Store only inputs.** Learned = the list of spells the character knows;
matrices = the matrix-placement inputs (which spell each owned matrix holds).
Everything derived (steps, difficulties, Legend spent, effect numbers, the
effective threads to forge) comes from the engine + `rules/spells.json`.

```jsonc
// data/character.json (ed-character/1) — NEW top-level block
"spells": {
  "known": [
    { "name": "Soul Armor",  "learntSuccess": 1 },
    { "name": "Shadow Meld", "learntSuccess": 0 }
    // learntSuccess = the extra successes achieved on the Learn test when the
    // spell was added to the grimoire — an INPUT recorded from the learn roll
    // (§6, Grimoire → Learn), never a recomputed number. circle/discipline/
    // mechanics are NOT stored — looked up from rules/spells.json (names are
    // unique across lists; §3.2 #5).
    // N4 resolved (owner): KEEP. Consumer = the Learn-a-spell flow (§6). The
    // learn test rolls for success; the number of success levels reached is
    // recorded here as an input, so the Grimoire preserves how well each spell
    // was learnt.
  ],
  "matrices": [
    { "type": "Standard", "spell": "Soul Armor" },   // spell = the spell placed
    { "type": "Standard", "spell": "Shadow Meld" },  //  in this matrix (enables
    { "type": "Standard", "spell": null }            //  Matrix cast type) — input
  ]
}
// A Standard matrix holds NO threads (§3.1): placing a spell here never forges
// its required threads — it only makes Matrix casting available.
```

Open shape questions for review:

- **Q4.** Matrix model — is a matrix a **slot the character owns** (Standard /
  Enhanced / Armoured, each with a rank/capacity) that a spell is placed *into*,
  as above? Or do we place at the spell level (`known[i].placed: true`) and
  skip modelling matrix objects for v1? (The mockup's ✦ toggle currently implies
  the simpler spell-level flag; the explicit matrix list is more faithful to 4E
  and needed for Enhanced/Armoured matrices later. **Owner call.**)
  - A4. A Matrices approach is best
- **Q5.** Does the Legend-spent audit (`engine/legend-spent.js`) need to count
  spells now (a spell costs the same as a Novice talent bought to Rank = the
  spell's Circle — already noted in `rules/legend.json`)? If yes, that is an
  additive engine change folded into this feature; if later, we defer.
  - A5. Lets defer legend cost for spells for this version

---

## 5. Engine — `engine/spells.js` (pure, DOM-free) — PROPOSED

New lazy-loaded module. Pure functions only; no DOM, no state mutation. Feeds
derived values *down* to the UI. Proposed surface:

- `knownSpells(character, rules)` → the character's known spells joined to their
  catalog mechanics, grouped by Discipline then Circle (for the Grimoire list).
- `castTypeList(character, rules, castType)` → the spell list for a cast type:
  `matrix` = spells currently placed in a matrix; `grimoire` = **any learnt
  spell** from the magician's grimoire (the `known` list); `raw` = **any spell
  in the character's Disciplines' spell lists** (learnt or not). *(S2 resolved
  2026-08-18 — the two were swapped to the intuitive sense: the grimoire is your
  learnt book, raw magic reaches any pattern in your Disciplines.)*
- `castPlan(character, rules, spellName, castType)` → the pure decision-support
  object the cast UI renders: `{ threadsToWeave, weavingDifficulty, weavingStep, castingStep, castingTarget, effectStep|effectStatic, canKarma }`. Mirrors
  `endOfDayResetPlan` — reports what a cast *could* need; the UI owns the loop.
  `threadsToWeave` here is the **effective** forge count per §3.1: required
  threads minus any thread the casting matrix already holds (0 for a Standard
  matrix, up to 1 for Enhanced/Armoured), floored at 0 — never reduced by cast
  type alone. `weavingDifficulty.reattune` is carried in the catalog but no v1
  flow uses it (§3.2 #1).
- `weavingStep(character, discipline)` / `castingStep(character)` — the Thread
  Weaving and Spellcasting **talent steps** from the character's existing talent
  data (reuse the talent-step derivation the Disciplines tab already uses).
  **Thread Weaving is discipline-named** in the data (`Thread Weaving
  (Nethermancer)`, `(Archer)`, …), so `weavingStep` **must take the spell's
  discipline** to pick the right talent — a caster with two Disciplines has two
  Thread Weaving talents. `castPlan` resolves the spell's `discipline` from the
  catalog and passes it in. (Spellcasting is a single shared talent, so
  `castingStep` needs only the character.)
- Karma eligibility helper (Spellcasting is Karma-eligible by default, per the
  talent rules the engine already encodes).

The engine never rolls dice or spends Karma — the UI dispatches `roll` /
`spend-karma` up to `ed-app`, exactly as the recovery/attack flows do today.

---

## 6. UI — `ui/ed-spells.js` (new view) + `ed-app` wiring — PROPOSED

Replaces the stub `case 'spells'` in `ui/ed-app.js` with
`<ed-spells .model=${m} .editMode=${this._editMode} .arming=${...}>`. Layout is
the reviewed A+C merge (all in the app's tokens; a mystic **violet** accent to
distinguish Spells from Disciplines' brown, karma **green** on cast/roll):

**Top:** a two-item seg — **Cast** and **Grimoire** — the single-toggle rhythm
of the Disciplines tab. Available-Karma chip on the right.

**Cast view** — two columns:

- *Left:* **Cast type** pills — **Matrix / Grimoire / Raw**, and **Item**
  rendered disabled with a "soon" tag (§7). A one-line hint per type:
  **Matrix** = a spell placed in a Standard matrix (holds no threads — the
  weave still happens on cast, §3.1); **Grimoire** = any **learnt** spell from
  the magician's grimoire (`known`); **Raw** = any spell in the character's
  Disciplines' spell lists (learnt or not). Below: the spell list for that type (a ● dot marks
  spells currently placed in a matrix — combat-ready; a ✦ **matrix toggle** to
  place/release the spell, working **outside edit mode**, per decision). Below
  the list: the selected spell's **full description**.
- *Right:* a **cast-mode** sub-toggle — **Guided cast** (default) and
  **Step-by-step** — plus the spell's main **detail grid** (Effect, Threads,
  Duration, Range, Area, Weave, Successes, Extra threads). When this character
  is the subject of a live self-cast (§3.3), a **sustained-effect chip**
  shows the active folds and its countdown (duration left in Initiative
  rolls) — the visible mirror of what the engine folds in.

**Grimoire view:** the learnt/known-spells table grouped by Discipline + Circle
(reusing the `.trow`-style grid so columns line up with the talent table); an
info control per spell opens the paraphrased detail modal (mirrors the talent
info button). **Learn / remove** spell controls appear **only in edit mode**;
**placing a spell into a matrix** is available any time.

Learning new spells will be a modal window that will need to capture the spell from the discipline, its difficulty to learn, any bonuses to the learning test and then roll for sucesses.  The level of the success is recorded and the new spell is added to the grimoire — the success level is stored as the new entry's `learntSuccess`, an input recorded from the Learn test (§4).

### 6.1 Casting flow (the interaction spec)

**Guided cast** — chains the steps but *stops for the decisions the owner
flagged*:

1. **Pick the target and its number.** The Spellcasting test is vs a **number**
   (§3.2 #4): usually the target's Mystic Defense, occasionally a fixed base
   number the spell prints. The UI prompts for it once (default remembered per
   cast, pre-filled from the spell when `castingTarget` is fixed, changeable per
   cast). The **subject** is chosen here too, shown by an **explicit target
   indicator** (§3.3) so it is always visible whether the cast folds into this
   sheet — **This character** (fold) vs **Other** (no fold):
   - Casting on **self** means the spell's effects apply to this character.
     Special rule: the character may **intentionally lower their own Mystic
     Defense** against a spell they want to land — the indicator has room for
     that reduced self-cast defence number.
2. **Forge threads** — roll Thread Weaving vs `weavingDifficulty.value` for each
   thread to forge. This happens for **any** cast type: a Standard matrix holds
   no threads, so a matrix cast still forges its required threads (§3.1). Skip
   the step entirely when the effective count is 0 threads (a 0-thread spell, or
   a 1-thread spell whose one required thread an Enhanced/Armoured Matrix
   already holds). **Before the roll**, pause-and-offer the +D6 Karma toggle
   (Weaving is Karma-eligible if the character's Thread Weaving is) — Karma is
   spent pre-test, never on a resolved result (A6).
   - In **step-by-step** mode the caster may keep weaving **extra** threads: each
     one beyond the required count is **assigned one** `extraThreads` option
     (repeatable, stacks 1:1, §3.2 #2), and extra weave successes can also affect
     outcomes (the `successes` entries). The **Circle table caps the extra
     threads** (§3.1): 1 at Circles 1–4 up to 4 at Circles 13–15, from the
     character's Circle in the spell's Discipline — the flow **warns at the cap**
     and never offers beyond it.
3. **Spellcasting** — roll vs the target number. **Before rolling**, the flow
   pauses to offer the +D6 Karma toggle when it could matter ("spend 1 Karma to
   buy a D6?"), per A6 — Karma is spent pre-test (ED4), matching the existing
   roll modal; it is never added to an already-resolved result.
4. **Effect** — roll/apply the effect once the cast succeeds.
   Each roll reuses the embedded `ed-roll-modal` and shows the app's **dashed
   placeholder pill until rolled** (Tier-1 rule: never a fabricated number).
   On a successful cast the effect **activates** for the spell's duration
   (`Duration: Rank minutes` — in combat 1 round = 1 Initiative roll, 1 minute
   = 10 rounds, owner's rule), and the per-success Duration boosts extend it
   (Soul Armor: +2 per extra success). Whether it **folds into this sheet is
   the cast's subject** (§3.3): cast on this character → the effects enter the
   session active-effect set and fold into derived values (the +3 Mystic Armor
   shows on the character) for the duration; cast on another → recorded only,
   nothing folds here. Static (sustained) effects (Soul Armor's +3 Mystic Armor)
   fill a readout, not a roll; step (instantaneous) effects roll an Effect test
   (§3.4). The active spell is **session state** and counts down each Initiative
   roll, never persisted as a derived value. (The fold + countdown is **staged
   to phase 6b** — the core cast flow in 6a rolls/logs/spends Karma without it;
   see the §3.3 correction and B1. It is **not** a reuse of knock-down, which is
   a condition chip, not a duration-counted fold.)

**Step-by-step** — reverts to the **Option A pipeline**: three independent roll
pills (Weave / Cast / Effect) the player rolls and arms by hand, for full
control and mid-step Karma. This is always available as the escape hatch from
the guided flow.

Open interaction questions for review:

- **Q6.** Karma prompting — reactive-on-miss only, up-front-allocation only, or
  both offered? (Mockup shows reactive-on-miss as the primary moment.)
  - A6. **Pause-and-offer**: the cast flow pauses *before* the roll and offers
  the +D6 Karma toggle when it could matter (e.g. the target number is within
  reach of a Karma die). Karma is spent pre-test, per ED4 — the exact
  interaction the existing roll modal already supports, and it is never added
  to an already-resolved result. Applies to the Thread Weaving roll and the
  Spellcasting roll alike.
- **Q7.** Target number — manual entry for v1 (as mocked), with a later
  enhancement to read a selected target's Mystic/Physical Defense from an
  encounter/target model? (Lean: manual now, structured `castingTarget` in the
  schema so auto-fill is a drop-in later.)
  - A7. Manual only
- **Q8.** Does a successful cast **auto-decrement** anything (e.g. a
  Karma spent, a matrix marked "cast/needs reattune"), or is casting
  non-mutating in v1 beyond the roll log? (Lean: v1 casting writes only the roll
  log + Karma spend; matrix reattune tracking is a later enhancement.)
  - A8. For v1 no auto-decrement except for karma that should be reduced as
  triggered. (A self-cast additionally enters the session **active-effect set**
  for folding + the Initiative countdown — §3.3 — which is session state, never
  a stored input.)

All modals Escape-closes / Enter-confirms; theme-aware; two font weights.

---

## 7. Deferred — Item cast type (future enhancement)

**Item** cast type is parked. It will cast a spell from a magic item that has a
**spell matrix built in with a pre-threaded spell** — the player triggers the
item's stored spell rather than weaving it themselves. These items are **not
planned yet**, so the pill ships **disabled with a "soon" tag**. When built, it
slots into the same cast-type chooser and reads from item data (likely an
extension of the thread-item / charm model) — no rework of §3–§6 expected.

---

## 8. Delivery phases

1. **Schema sign-off (Tier 1).** Owner approves §3 + §4 field names/shapes.
   Q1–Q8 are all answered (A1–A8); the only open review items are the S2
   Grimoire/Raw confirm (§5) and the S4 `threadCap` home (now in §3.1/§3, for
   ack). Nothing else starts until the shapes are fixed.
2. **Catalog seed.** Author `rules/spells.json` for the Discipline(s) in play
   (Nethermancer first), mechanics + summaries + taxonomy `effects[]`.
3. **Character block.** Add the `spells` input block to the test character(s);
   confirm `ed-character/1` round-trips (load/save) with the new block.
4. **Engine.** `engine/spells.js` pure helpers (§5) + unit tests
   (`engine/spells.test.js`), reusing existing talent-step derivation.
5. **UI — Grimoire.** `ui/ed-spells.js` list/detail/matrix placement; learn/remove behind
   edit mode. Wire into `ed-app` (replace the stub). Learn is a modal to test the ability for a chracter to learn a new spell and add it to the grimoire
6a. **UI — Cast core (the v1 cast flow, no fold).** Cast-type chooser, guided
   flow (embedded `ed-roll-modal`, target prompt with the **cast-subject
   indicator**, Karma pause-and-offer), step-by-step fallback, roll log.
   Dispatch `roll` / `spend-karma` up to `ed-app`. **Ships without any
   active-effect fold** — a cast rolls, logs, and spends Karma; nothing is
   folded into derived values yet. This is the complete, useful cast experience
   and de-risks the release from the hardest runtime piece (6b).
6b. **UI — Sustained self-cast fold + countdown (net-new infrastructure).** A
   session **active-effect set** so a `sustained` self-cast (§3.4) folds its
   effects into derived values (Soul Armor's +3 Mystic Armor shows on the sheet)
   and counts down per Initiative roll. **This is not existing infrastructure**
   — the engine has no duration-counted fold today, and knock-down is a
   *condition chip* (session scratch cleared on Initiative), not a
   modifier-into-derived-values fold. Hook the countdown to the existing
   `_rollInitiative` "new round" signal in `ui/ed-combat.js` (the same signal
   blood charms already react to). Can slip to a follow-up without blocking 6a.
7. **Polish.** Legend-spent inclusion (Q5) if in scope; light/dark + mobile
   single-column pass; Tier-1 re-check.

---

## 9. Tier-1 guardrail re-check (applies at every phase)

- Data flows **down** via render; events flow **up** via dispatch. `ui/ed-spells`
  never mutates state or computes game values — the engine does.
- Store **only inputs** (`known`, `matrices`); no derived step/difficulty/effect
  numbers persisted in `character.json`.
- Derived/unrolled values render as **dashed placeholder pills**, never a
  fabricated number.
- Every modal Escape-closes / Enter-confirms; theme-aware (light + dark); two
  weights (400/500).
- Any taxonomy verb a spell needs but the vocabulary lacks is a **separate
  Tier-2 change** (bump + migrate all `rules/*.json`), never smuggled in here.
- Asset/fetch paths relative (`./…`).

---

## 10. Changelog

| Date | Change | Status |
|------|--------|--------|
| 2026-08-18 | Plan created; owner review round: confirmed A2 taxonomy-true, A4 matrices, A6 Karma pause-and-offer, A8 karma auto-decrement; resolved §3.1 (matrix holds no threads — weaving always forges required threads), §3.2 all five shapes, §3.3 (self-cast folds into the session active-effect set **in v1** + explicit cast-target UI indicator); re-modeled §3 example (Soul Armor static + Astral Spear step); 1 minute = 10 rounds; perSuccess = extra successes. Mockup copy synced to the confirmed model (place/release matrix, no "pre-woven"). | Draft for review |
| 2026-08-18 | Owner clarifications: **Armoured Matrix** holds 1 thread alongside Enhanced (bare "matrix" = Standard, holds none); **extra-thread cap is a Circle table** (C1–4 → 1, C5–8 → 2, C9–12 → 3, C13–15 → 4), replacing the "no limit" reading in §3.1/§3.2/§6.1; **Raw** casting = any **learnt** spell, **Grimoire** casting = any spell in the Disciplines' lists (§5 `castTypeList`, §6 cast-type pills, mockup `known` flag + filters). | Draft for review |
| 2026-08-18 | Shape: `spells.known[]` entries gain `learntSuccess` — the extra successes achieved on the Learn test, an input recorded from the learn roll (§4 example, §6 Learn modal). | Draft for review |
| 2026-08-18 | Shape: each spell entry in `rules/spells.json` gains `description` — player-facing prose (flavor + resolution + core mechanic), a paraphrase of the local rulebook extracts (copyright-safe); sits after `name`, sibling to the terse `summary`; catalog metadata, no taxonomy impact. All 123 Nethermancer spell descriptions authored. | Draft for review |
| 2026-08-18 | Review pass (B1–S4 + nits) applied. **B1:** phase 6 split into 6a (core cast, no fold — ships v1) and 6b (net-new sustained self-cast fold + Initiative countdown); §3.3/§6.1 corrected — this is NOT a reuse of knock-down (a condition chip, not a duration-counted fold; engine has no `duration` fold today). **B2:** `weavingStep(character, discipline)` — Thread Weaving is discipline-named, must take the spell's discipline. **S1:** new §3.4 effect-archetype rule (sustained-buff folds vs instantaneous `duration: test` effect roll); Astral Spear retagged `sustained`→`test`; Soul Armor comment names the archetype. **S3:** dangling "§4.1" cites docs/EFFECT-TAXONOMY.md §4.1. **S4:** extra-thread cap is rules data — added `threadCap` block to the `ed-spells/1` shape (§3, §3.1). **Nits:** phase-1 stale "Q1–Q5" removed (all A1–A8 answered); "Decision N = letter" tags normalized to `§3.2 #N`; §6.1 steps renumbered 1–4 (self-target folded into step 1). **Open flags for owner:** S2 (Grimoire/Raw read inverted — confirm) and N4 (name a `learntSuccess` consumer or drop it). | Draft for review |
| 2026-08-18 | **S2 resolved:** Grimoire/Raw definitions **swapped** to the intuitive sense — `grimoire` = learnt spells (`known`), `raw` = any spell in the Disciplines' lists (§5 `castTypeList`, §6 cast-type pills). This supersedes the earlier "Raw = learnt / Grimoire = discipline lists" reading. N4 (`learntSuccess` consumer) remains the only open flag. | Draft for review |
| 2026-08-18 | **N4 resolved (owner):** keep `learntSuccess` — consumer is the Learn-a-spell flow; the learn test's success levels are recorded per spell (§4, §6). No open flags remain; §3/§4 Tier-1 shapes ready for sign-off. | **Shapes ready — awaiting sign-off** |
| 2026-08-19 | **Shapes signed off (owner) — implementation started on `dev`.** Phase **8.2** catalog seed: `rules/spells.json` (`ed-spells/1`) with all **123 Nethermancer** spells, Circles 1–15 — mechanics + Success Levels/Extra Threads + `threadCap` + taxonomy `effects[]` (19 curated combat spells, `note` for rituals/summons), seeded via `tools/archive/build-nethermancer-spells.mjs`. **8.3** character `spells` block added to the local `chakka-test` fixture (Archer C4 / Nethermancer C3; gitignored, not committed). **8.4** `engine/spells.js` pure derivations + 13 tests; wired into the store as `model.spells`. **8.5** Grimoire view (`ui/ed-spells.js`): list by Discipline/Circle, detail modal, ✦ matrix place/release, edit-mode remove; `saveSpellEdits` overlay. **8.6a** cast workspace: cast-type chooser (Matrix/Grimoire/Raw, Item disabled), Weave/Cast/Effect rolls through the shared modal (Karma + pass/fail), step result readouts, thread counter + greying, **extra-thread → option assignment**, **cast success-levels visual**, learnt marker + fixed-height Raw scroll. | Implemented (8.2–8.6a) |
| 2026-08-19 | **Owner UI decisions during 8.6a:** Guided mode parked as a disabled "soon" pill (Step-by-step is the working mode); step result readouts simplified to "rolled N"; weave forges required **+ extra up to the cap** (stops at required+extraThreadCap). **6b prep landed:** the ⚄ **Initiative** control on the Spells tab (Step-by-step line, far right) rolls initiative and is the round start/end signal — `ed-app._advanceRound()` fires on any initiative roll (Combat or Spells); and the **Active effects** card (Option A) sits at the bottom of the cast panel with a resting state, ready for 6b to populate `model.spells.active` and count down `roundsLeft` per round. | Implemented (6b prep) |
| 2026-08-19 | Phase **8.6b** delivered: the sustained self-cast active-effect set. Engine — `durationRounds` (1 min = 10 rounds), `sustainedEffectsOf`, `buildActiveSpell`, `tickActiveSpells`, `activeSpellEffects` (+5 tests). Store — `session.activeSpells` folds into `activeEffects` like an equipped item (buffs reach derived values, e.g. Soul Armor +3 Mystic Armor); `model.spells.active` feeds the card. ed-app — session active-spell set (never persisted); `ed-spell-activate` adds/refreshes; `_advanceRound` (any Initiative roll) ticks it. ed-spells — a successful self-cast dispatches activation; the Active-effects card counts down. | Implemented (8.6b) |
| 2026-08-19 | Spell `description` field added to §3 shape (Tier-3 catalog metadata, no taxonomy change) and populated for all 123 Nethermancer spells — a player-facing paraphrase distinct from the terse `summary`; the detail modal + Cast description panel show `description ?? summary`. | Implemented |
| 2026-08-19 | Phase **8.7** Tier-1 re-check (code): view never mutates state/computes game values (data-down/dispatch-up), derived values fall back to placeholder pills, `activeSpells` is session-only (never persisted), mobile single-column breakpoints present, theme-aware tokens. Legend-spent inclusion deferred (A5). **Remaining:** owner's light/dark + mobile *visual* pass. | Code re-check done |
| 2026-08-19 | **Bug fix (owner testing):** a **sustained** self-cast (e.g. Soul Armor) folded only its base effect — the assigned extra-thread and extra-success boosts were ignored. Root cause was the **engine** (`buildActiveSpell`), not data: it now takes the cast context `{ extraPicks, successLevels }` and applies `increaseEffectAmount` (raise the folded rating, +3 → +5 Mystic Armor) and `increaseDurationRounds` (extend the countdown per extra success). ed-spells passes the picks + success levels on activation; ed-app forwards them. +2 tests (598 green). | Fixed |
| 2026-08-19 | **Bug fixes (owner testing):** (1) the Effect roll now folds the accumulated boosts — engine `effectStepBonus` adds each assigned extra-thread "Increase Effect (+N Step)" once plus the Success-Levels boost per EXTRA success (levels − 1); Astral Spear with 1 extra thread + 4 successes rolls Step 10 +8 = 18, shown in the readout (+2 tests, 596 green). (2) A self-cast defence/armour spell now shows its contribution as a signed badge on the Combat tab's Defence & Armour (`_spellRatingMods` pulls the spell delta out of the derived base and re-adds it as a sourced mod — total unchanged; Mystic Armour shows "5 +3", tooltip "Soul Armor +3"), matching the session-mod badges. | Fixed |
| 2026-08-19 | **Tier-2 taxonomy change (owner-approved, options 2+3) — remove all runtime label parsing.** Root cause of the boost bugs was **data**: every `successes[].effects` / `extraThreads[].effects` was empty, so the engine inferred boosts by regex-parsing the option labels. Fix: (a) **taxonomy v3 → v4** — new `duration-modifier` type + `rounds`/`minutes`/`hours` measures ([docs/EFFECT-TAXONOMY.md](../docs/EFFECT-TAXONOMY.md)), additive/backward-compatible; validator (`engine/validate-item.js`) updated; **every `rules/*.json` `effectTaxonomy` bumped v3 → v4**. (b) **Migration** (`tools/archive/enrich-spell-options.mjs`) structured all 43 success + 108 extra-thread options — "Increase Effect (+N)" mirrors the spell's base add-effect (step/rating), "Increase Duration (+N)" → `duration-modifier`, range/target → `note`; 55 duration-modifiers, all validated. (c) **Engine** reads the structured effects (`sumOptionBoosts`/`castBoosts`); the three regex helpers deleted — `effectStepBonus` + `buildActiveSpell` now parse nothing at runtime. Full suite 596 green. | Fixed (Tier-2) |
| 2026-09-02 | [PLAN-SPELLS-WEAVE-EFFECT.md](PLAN-SPELLS-WEAVE-EFFECT.md): 0-thread spells with `extraThreads` options now show a usable Weave step (extras forged to the Circle cap and assigned), and the Effect **button** renders only for `step` (instantaneous) effects — static/none effects are a readout that auto-applies at cast land. Also fixed the review-found gap where the **Cast** trail bypassed a pending extra-thread pick (button disable + `_rollCast` guard, mirroring Weave). **Owner rule added (§1e/§3.1): any forged thread — required or extra — is a pre-condition of the cast; the cast carries/consumes it, so a 0-thread spell is thread-free only until the caster chooses to weave an extra.** UI-only (`ui/ed-spells.js`); suite 725 green. | Implemented |
