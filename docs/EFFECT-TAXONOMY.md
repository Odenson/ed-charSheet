# Effect Taxonomy — v3

A controlled vocabulary for **effects**: the structured, machine-applicable
modifiers and grants that races, talents, skills, items, spells, and conditions
confer on a character. The engine reads effects to compute derived values and
resolve actions; a consistent taxonomy keeps that logic general instead of a pile
of special cases.

It deliberately reuses the vocabulary already present in the source spreadsheet:
the `Target | Characteristic | Property` addressing model, the operation words
(`ADD, MINUS, MULTIPLY, DIVIDE, DEFAULT, MIN, MAX, REF`), and the trigger
comparisons (`GE, GR, LS, LE, EQ, NE`). One language, end to end.

> Status: **v3, under review.** Field names and vocabularies may change. When they
> do, bump the version and migrate the data files that reference it
> (`rules/*.json` `schema` fields).

---

## 1. The effect object

Effects are held in an **`effects` array** on their parent (a racial ability, a
talent, an item, a spell…), because one ability can confer several — e.g.
T'skrang *Tail Combat* is a `grant-attack` **and** an `enable-option`. A parent
with no mechanics may have an empty array.

An effect is an object with a fixed set of fields. Only `type` is always
required; the rest are used as each `type` needs.

```jsonc
{
  "type":        "defense-modifier",              // §2  what kind of effect (engine dispatch key)
  "target":      { "domain": "defense", "name": "Physical" }, // §3  what it affects
  "operation":   "add",                            // §4  how the value combines
  "value":       2,                                // the magnitude (number, or a { "ref": … })
  "measure":     "rating",                         // §5  what the value counts in
  "condition":   "always",                         // §6  when it applies
  "scope":       null,                             // §6  optional qualifier
  "stacking":    "cumulative",                     // §7  how multiples combine
  "duration":    "permanent",                      // §8  how long it lasts
  "source":      "race",                           // §9  provenance
  "gmDiscretion": false,                           // judgement call, not auto-applied
  "summary":     "…"                               // human-readable, original wording (no rulebook prose)
}
```

| Field | Required | Purpose | Vocabulary |
|---|---|---|---|
| `type` | always | Engine dispatch key — the *kind* of effect | §2 |
| `target` | modifiers & grants | What is affected, as a path | §3 |
| `operation` | modifiers | How the value combines | §4 |
| `value` | modifiers | Magnitude — a number, or `{ "ref": "<target-path>" }` | — |
| `measure` | modifiers | What the value counts in (prevents step/result/rating confusion) | §5 |
| `condition` | optional (default `always`) | When it applies | §6 |
| `scope` | optional | Narrowing qualifier (enum-or-text) | §6 |
| `perSuccess` | optional (default `false`) | `value` applies per success on the triggering test (e.g. +2 PD per success) | boolean |
| `stacking` | optional (default `cumulative`) | How multiples on the same target combine | §7 |
| `duration` | optional (default `permanent`) | How long it lasts | §8 |
| `source` | usually engine-set | Provenance, for tracking & display | §9 |
| `gmDiscretion` | optional (default `false`) | Marks a non-automatable judgement call | boolean |
| `summary` | yes | Concise original-wording description; **never** verbatim rulebook text | — |

---

## 2. `type` — effect kinds (engine handlers)

Small on purpose. Each maps to one way the engine applies the effect.

| `type` | The engine… | Typical `target.domain` |
|---|---|---|
| `attribute-modifier` | adjusts one of the six attributes | `attribute` |
| `defense-modifier` | adjusts a defense | `defense` |
| `characteristic-modifier` | adjusts a **derived** characteristic | `characteristic` |
| `armor-modifier` | adjusts armor | `armor` |
| `attack-modifier` | adjusts an **attack's** step or result (weapon / natural-attack damage step, to-hit step) | `attack` |
| `test-modifier` | adjusts a specific test (roll) | `test` |
| `grant-ability` | gives a talent / skill / knack | `ability` |
| `grant-attack` | gives a natural attack | `attack` |
| `sense` | gives a sensory capability | `sense` |
| `resource-modifier` | adjusts a pool | `resource` |
| `enable-option` | unlocks a combat / action option | `option` |
| `grant-karma-use` | grants permission to spend Karma on a category of test | `test` |
| `note` | records a non-numeric / roleplay effect (no dispatch) | — |

`attack-modifier` is the attack-surface counterpart of `armor-modifier` and
`defense-modifier`: a weapon's Damage step, a natural attack's damage, or a
future to-hit bonus all target the `attack` domain so the combat resolver can
gather them in one dispatch — exactly as armor/defense resolution does today.
Natural attacks pair a `grant-attack` (which *names* the attack) with
`attack-modifier` effects (which adjust it). `test-modifier` stays for generic
roll bonuses that are not attack-specific (a +1 to all `Action` tests, a skill
modifier).

`grant-karma-use` mirrors the source spreadsheet's `…UseKarma` flags: a Discipline
circle grants the adept the right to spend a Karma Point on a class of test (e.g.
Perception, Initiative, ranged Damage). `target` is a `test`; use `scope` to
narrow it ("sight-based", "ranged weapons", "vs Horrors/undead"). It carries no
`value`/`operation` — it is a permission, not a numeric change.

> `enable-option` **unlocks a global option** — its `target.name` must match an
> option's `name` in `rules/combat.json` (e.g. `Tail Attack`), and it is always
> on once granted. A *different* delivery — a single thread weapon shipping its
> own option for the Combat tab while selected — is data, not vocabulary: the
> bundles live in the item entry as `combatOptions` (same bundle shape, see
> THREAD-ITEMS.md §4.1) and their effects reuse the types above
> (`test-modifier`, `resource-modifier`, `note`). No vocabulary change, no bump.

---

## 3. `target` — what is affected

A path object, echoing `Target | Characteristic | Property`:

```jsonc
"target": { "domain": "attribute",      "name": "Strength" }
"target": { "domain": "characteristic", "name": "Movement", "property": "Fly" }
"target": { "domain": "ability",        "name": "Avoid Blow" }
```

**`domain`** vocabulary and the `name` values allowed in each:

| `domain` | `name` values |
|---|---|
| `attribute` | `Dexterity` `Strength` `Toughness` `Perception` `Willpower` `Charisma` |
| `defense` | `Physical` `Mystic` `Social` |
| `characteristic` | `WoundThreshold` `DeathRating` `UnconsciousnessRating` `RecoveryTests` `Initiative` `Movement` (+ `property`: `Walk`\|`Fly`\|`Swim`) `CarryingCapacity` |
| `armor` | `Physical` `Mystic` — **no Social Armor** |
| `resource` | `Karma` `Legend` `Strain` `Recoveries` |
| `ability` | a talent / skill / knack name |
| `attack` | `Damage` `Attack` \| natural attacks (`tail` `horns` `claws` `bite` …) |
| `test` | `Action` `Attack` `Damage` `Effect` `Initiative` \| a named ability |
| `sense` | `HeatSight` `LowLightVision` `AstralSight` |
| `option` | a combat/action option, e.g. `Tail Attack` (the `name` must match the option's `name` in `rules/combat.json`) |

`property` is an optional third segment for targets that need it (e.g.
`Movement.Fly`, or an ability's `Step`/`Rank` when used inside a `ref`).

**Naming convention.** `name` holds the bare term (`Physical`), never the full
label. The human-readable name is `{name} {Domain}` — so `{domain:"defense",
name:"Physical"}` displays as "Physical Defense" and `{domain:"armor",
name:"Physical"}` as "Physical Armor". The `domain` is what distinguishes them;
the two lists are maintained independently (they are *not* a shared axis).

**Attack vs test.** The `attack` and `test` domains overlap on `Damage`/`Attack`
on purpose, but they are different axes:
- `attack/Damage` is the **attack's damage step** (what `attack-modifier` and
  `grant-attack` touch); `attack/Attack` is the to-hit test of an attack.
- `test/Damage` is the **Damage test as a roll category** — what
  `grant-karma-use` permits ("spend Karma on Damage tests") and what generic
  `test-modifier`s adjust.
- The `attack` domain's generic `Damage`/`Attack` names coexist with the
  natural-attack appendage names (`tail`, `horns`, …); `type` disambiguates
  them (`grant-attack`/`tail` names an attack; `attack-modifier`/`Damage`
  adjusts one).

**Defense vs armor.** These are separate domains with overlapping `name` values:
- `defense` has three variants — `Physical`, `Mystic`, `Social`. A defense value
  is the target number for the matching kind of attack/maneuver (physical attacks
  vs Physical Defense, spells vs Mystic Defense, social maneuvers vs Social
  Defense).
- `armor` has two — `Physical`, `Mystic` (**no Social Armor**). An armor value
  reduces incoming damage of the matching kind (Physical Armor reduces physical
  damage; Mystic Armor reduces mystic damage).

---

## 4. `operation` — how the value combines

Mirrors the spreadsheet's reserved words.

| `operation` | Sheet word | Meaning |
|---|---|---|
| `add` | ADD | target + value |
| `subtract` | MINUS | target − value |
| `multiply` | MULTIPLY | target × value |
| `divide` | DIVIDE | target ÷ value |
| `set` | DEFAULT | override target to value (acts as a base/floor) |
| `min` | MIN | take the lower of target, value |
| `max` | MAX | take the higher of target, value |
| `ref` | REF | `value` is pulled from another target-path, e.g. `"value": { "ref": "attribute|Strength|Step" }` |

### 4.1 Damage base — the `set`-as-base pattern (v3)

A Damage (or Effect) test resolves as **base + modifiers**, and `operation: set`
on `attack/Damage` is how the base is declared. This is the contract the engine
uses to gather weapon *and* spell damage through one code path:

- **Weapon attacks** base on the attacker's **Strength step** — a *universal
  rule*, not per-item data. It lives as the engine's default (mirroring how
  `Initiative = Dexterity step` and `Knockdown = Strength step` are engine logic
  with no taxonomy entry). A weapon entry therefore carries only its own
  `add` (the weapon's Damage Step), e.g. the Medium Crossbow's `add 5` — it has
  **no** `set`. *Missile and thrown weapons are not exceptions:* they add their
  Damage Step to Strength exactly like melee (PG, Damage test; the Silar crossbow
  example is STR 5 + crossbow 5 = Step 10).
- **Spell attacks** have a **per-spell base** (usually Willpower, sometimes
  another attribute or the spell's own step) — this is *input data* that must
  live in the spell file. A spell declares its base with a `set` effect whose
  `value` is a `ref` to the governing step, then stacks its `add` modifiers on
  top. *No universal "spell → Willpower" default:* talent substitution (e.g.
  Flame Arrow replacing Strength with its own step) and non-Willpower spells
  break it, which is exactly why the base must be explicit for spells.
- **Substitution talents** (Flame Arrow, Crushing Blow, Surprise Strike, …) are
  `set` on the base — they override the default, same as any `set`.

**Resolution order.** All `set` effects on a target establish the base first
(later `set` overrides earlier), then `add`/`subtract`/… fold on top — matching
the fold order `engine/characteristics.js` already implements for armor/defense
(`applyModifiers`, pass 1 then pass 2). With no `set` in play (the common weapon
case) the behavior is unchanged: the engine default base plus `add`s.

```jsonc
// Weapon — no base declared; the engine default (Strength step) applies.
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "add", "value": 5, "measure": "step",
  "condition": "always", "source": "item" }

// Spell — `set` declares the base (Willpower step), `add` stacks on top.
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "set", "value": { "ref": "attribute|Willpower|Step" },
  "measure": "step", "condition": "always", "source": "spell" }
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "add", "value": 8, "measure": "step",
  "condition": "always", "source": "spell" }
```

---

## 5. `measure` — what the number counts in

Earthdawn "+2" is ambiguous without this. **The most correctness-critical field.**

| `measure` | Applies to | Example |
|---|---|---|
| `value` | attribute value | +2 Strength value |
| `step` | a step (adds dice via the step table) | +2 steps to a test |
| `result` | a test's final total (flat) | Gahad's +1 to the roll |
| `rating` | a static stat (defense / armor / threshold / movement) | +2 Physical Defense |
| `rank` | talent / skill rank | starts at rank 0 |
| `dice` | explicit dice | +1D6 |
| `points` | karma / legend pool | +5 Legend |
| `yards` | distance | range |
| `count` | discrete count | +1 recovery test/day |

---

## 6. `condition` and `scope` — when it applies

- `"always"` (default) — permanent; the engine applies it automatically.
- `"situational"` — applies only in the context named by `scope`; usually paired
  with `gmDiscretion: true`.
- `"on-success"` — applies only when the triggering test (usually the talent's
  own roll) succeeds. Pair with `perSuccess: true` when the effect scales per
  success, and often with `duration: "rounds"`. Used mainly by talent outcomes.
- A structured **trigger** for future automation, reusing the sheet's model:

```jsonc
"condition": {
  "trigger": {
    "target": "attribute", "name": "Toughness", "property": "Step",
    "comparison": "GE", "value": 8            // GE GR LS LE EQ NE
  }
}
```

`scope` narrows applicability. Free text for now; candidate controlled values:
`carryingCapacity`, `close-combat`, `ranged-combat`, `vs-horrors`, `adept-only`,
`unarmed`.

**Engine auto-apply rule (as of Phase 3).** When computing a static value
(a rating, a derived characteristic), the engine folds in **only** effects that
are `condition: "always"` *and* not `gmDiscretion`. Situational, `on-success`,
triggered, and GM-discretion effects are **surfaced** to the player/GM but never
silently baked into a number. A `measure` mismatch is also a guard: a
`rating`-measure modifier applies to a static rating, not to a step or result.
This is engine *behavior*, not a vocabulary change. (v2 added the
`attack-modifier` type and the `attack` domain's generic `Damage`/`Attack`
names; v3 documented the `set`-as-base damage contract in §4.1. The auto-apply
rule is unchanged.)

---

## 7. `stacking` — how multiples on the same target combine

| `stacking` | Meaning |
|---|---|
| `cumulative` (default) | all instances add together |
| `highest` | only the largest applies |
| `replace` | this effect overrides others on the target |
| `unique` | only one instance regardless of source |

---

## 8. `duration` — how long it lasts

| `duration` | Meaning |
|---|---|
| `permanent` (default) | always in effect |
| `sustained` | while actively maintained |
| `rounds` | for a number of rounds (add `"rounds": N`) |
| `test` | for a single test |
| `encounter` | for the current encounter |
| `special` | see `summary` (non-standard) |

---

## 9. `source` — provenance

Where the effect comes from. Usually set by the engine from where the effect
lives, but may be stated explicitly.

`race` · `discipline` · `talent` · `skill` · `knack` · `item` · `blood-magic` ·
`spell` · `thread` · `trait` · `condition` · `horror`

---

## 10. Worked examples

```jsonc
// Windling — Increased Physical Defense
{ "type": "defense-modifier",
  "target": { "domain": "defense", "name": "Physical" },
  "operation": "add", "value": 2, "measure": "rating",
  "condition": "always", "source": "race",
  "summary": "Small size and mobility add +2 to Physical Defense." }

// Dwarf — Strong Back (Strength, carrying only)
{ "type": "attribute-modifier",
  "target": { "domain": "attribute", "name": "Strength" },
  "operation": "add", "value": 2, "measure": "value",
  "condition": "situational", "scope": "carryingCapacity", "source": "race",
  "summary": "+2 Strength for carrying capacity only." }

// Ork — Gahad (+1 to the test result, situational, GM call)
{ "type": "test-modifier",
  "target": { "domain": "test", "name": "Action" },
  "operation": "add", "value": 1, "measure": "result",
  "condition": "situational", "scope": "resolving a gahad trigger",
  "gmDiscretion": true, "source": "race",
  "summary": "+1 to Action/Effect tests aimed at resolving a triggered gahad." }

// A future talent example: talentStep = attributeStep + rank
{ "type": "test-modifier",
  "target": { "domain": "test", "name": "Avoid Blow" },
  "operation": "add", "value": { "ref": "ability|Avoid Blow|Rank" },
  "measure": "step", "condition": "always", "source": "talent",
  "summary": "Avoid Blow test = Dexterity step + rank." }

// Battle Axe — melee weapon: damage = Strength step + 7
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "add", "value": 7, "measure": "step",
  "condition": "always", "source": "item",
  "summary": "Melee damage: Strength step + 7." }

// Spirit Bolt (simulated spell) — base declared by `set`, damage by `add`.
// Resolves to Willpower step + 8, using the same fold as the Battle Axe above.
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "set", "value": { "ref": "attribute|Willpower|Step" },
  "measure": "step", "condition": "always", "source": "spell",
  "summary": "Effect test = Willpower step + spell's damage step." }
{ "type": "attack-modifier",
  "target": { "domain": "attack", "name": "Damage" },
  "operation": "add", "value": 8, "measure": "step",
  "condition": "always", "source": "spell",
  "summary": "Spirit Bolt damage: Willpower step + 8." }
```

---

## 11. Open questions (v3 review)

1. `measure` granularity — is `value`/`step`/`result`/`rating` the right split?
   *(Phase 3 leans keep: the engine already uses `measure` as an apply-time guard.)*
2. ~~`operation: set` as the model for "base that other bonuses add to" (Natural
   Armor), or introduce an explicit `base` semantic?~~ **Resolved (v3).** `set`
   **is** the base semantic (§4.1); no separate `base` field. Weapon damage uses
   the engine's universal Strength-step default (no `set`); spells and
   substitution talents declare their base with `set`.
3. `type` naming — single kebab-case dispatch key (current), or a two-axis
   `op` + `domain` split? *(Phase 3 leans keep the single dispatch key.)*
4. `scope` — free text now, or lock a controlled enum immediately? *(Still open;
   free text until enough real scopes accumulate to lock an enum.)*
5. `Knockdown` — a Strength-step combat test the engine now derives and displays
   (like `Initiative`), but it is **not yet** in the `characteristic` vocabulary
   (§3). Base derivation needs no vocabulary entry, so it is supported today; add
   `Knockdown` to §3 when the first effect modifies it — a **Tier-2** change
   (bump + migrate). Deferred until that effect exists.
6. `attack-modifier` scope (added v2) — currently only weapon *damage* uses it.
   The to-hit bonuses (talent `test-modifier`/`{test, Attack}` like Mystic Aim)
   stay in the `test` domain for now; if combat resolution lands, decide whether
   `{attack, Attack}` becomes their home in a later migration. Weapon damage
   keeps `operation: add` for all categories — missile/thrown are **not** flat
   steps independent of Strength; they add their Damage Step to Strength like
   melee, so they keep `add` and take the engine's Strength default (§4.1). Only
   spells and substitution talents carry an explicit `set` base.
