# Homebrew Rules — Data Model & Authoring

How to author a **homebrew rule**: the file, the rule shape, the formula term
grammar, the ref vocabulary, and the engine semantics that consume it. This doc
is the authority for the `rules/homebrew.json` format — read it before creating
or editing a rule. The active build plan lives in
[PLAN-HOMEBREW.md](../plans/PLAN-HOMEBREW.md); the effect vocabulary that a rule's
`effects` reuse lives in [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md).

> A homebrew rule is **pure data**: inputs plus plain-English notes. It never
> stores a derived value — every number a rating shows is computed by the engine
> from the rule's inputs and the character's inputs, exactly like the standard
> rules it overrides.

---

## 1. Where homebrew rules live

| Piece | File / location | Schema |
|---|---|---|
| Rules file | `rules/homebrew.json` | `ed-homebrew/2` |
| Loading | `store.js` `loadCharacter` — optional (`loadJSONOptional`, knacks/thread-items precedent) | — |
| Effect vocabulary | `docs/EFFECT-TAXONOMY.md` | v3 |
| Build plan | `plans/PLAN-HOMEBREW.md` | — |

The file is **optional**: if it's absent the app behaves exactly as before.
Rules are **global** — an enabled rule applies to every character (there is no
per-character opt-in in v1).

Top-level shape:

```jsonc
{
  "schema": "ed-homebrew/2",                 // Tier-1: don't rename fields
  "source": "… provenance note …",
  "effectTaxonomy": "docs/EFFECT-TAXONOMY.md (v4)",
  "note": "… file-level note (optional, documentation only) …",
  "rules": [ /* §2 */ ]
}
```

---

## 2. A rule entry — every attribute

```jsonc
{
  "id": "hb-uncon-death",                     // required, stable key (§2.1)
  "name": "Durability-scaled Health Ratings", // required, human-readable
  "overrides": "Players' Guide p.64 — Health Ratings (…)", // required, which rulebook section
  "summary": "… plain-English one-liner …",   // required
  "enabled": false,                           // required, boolean toggle
  "formula": { /* §3 — optional: replace a computation */ },
  "effects": [ /* optional: taxonomy effects, adjust a value */ ],
  "note": "… optional, documentation only …"
}
```

| Field | Required | Engine-read? | Meaning |
|---|---|---|---|
| `id` | yes | yes | Stable machine key, `hb-` prefix, kebab-case (§2.1). |
| `name` | yes | no | Display name; free to reword without changing identity. |
| `overrides` | yes | no | Which rulebook section the rule replaces (provenance). |
| `summary` | yes | no | One plain-English sentence describing the rule. |
| `enabled` | yes | yes | Global toggle: `true` applies the rule to every character. |
| `formula` | no | yes | Replaces the standard computation for the named ratings (§3). |
| `effects` | no | yes | Taxonomy effects merged into the active-effects fold (§5). |
| `set` | no | yes | **v2:** override a registry target with a scalar or race-keyed value (§5.5). |
| `note` | no | no | Documentation only; the engine ignores it. |

### 2.1 The `id`

- **`hb-`** namespace prefix — the same idea as the repo's `ed-*` schema tags;
  keeps rule ids out of collision with anything else.
- **kebab-case slug** naming what the rule overrides (e.g. `hb-uncon-death`).
- It is the **stable key** the engine references (override-map keys, effect
  `origin`s). Unlike `name`, it must not change meaning — reword the name, not
  the id.

---

## 3. Formula — the term grammar

A `formula` maps a **rating** (e.g. `unconsciousness`, `death`) to a flat list
of terms. A rating is a **sum of signed monomials**:

```jsonc
"formula": {
  "unconsciousness": {
    "note": "… rating-level plain-English note …",
    "terms": [ /* §3.1 */ ]
  },
  "death": {
    "note": "…",
    "terms": [ /* §3.1 */ ]
  }
}
```

### 3.1 A term

```jsonc
{
  "ref": "characteristics|uncon",          // OR "times": ["ref", …]  (exactly one)
  "sign": "add",                           // optional: "add" | "subtract"  (default "add")
  "coef": 1,                               // optional number (default 1)
  "over": ["…denominator refs…"],          // optional (default none)
  "note": "… term-level plain-English note …"  // optional, documentation only
}
```

| Field | Meaning |
|---|---|
| `ref` | The term is this single value. Mutually exclusive with `times`. |
| `times` | The term is the **product** of these refs. Mutually exclusive with `ref`. |
| `sign` | **Across** terms — `"subtract"` negates the whole term (`A − B`). |
| `coef` | Numeric scalar multiplying the term. |
| `over` | **Within** the term — denominator refs (`A ÷ B`). |
| `note` | Plain English of what the term contributes; documentation only. |

**Evaluation contract:**

```
term value  = sign × coef × Π times ÷ Π over
rating base = Σ term values
```

- Defaults: `sign: "add"`, `coef: 1`, `over: none`.
- **Addition/subtraction across terms**, **multiplication/division within a
  term.** No operator DSL — `(Rank + 1) × Step` is written as two additive
  terms `Rank × Step` + `Step`.
- **Null propagation:** an unresolvable ref, or a denominator summing to zero,
  makes the whole rating `null` (renders as a placeholder pill, never a
  fabricated number).

---

## 4. Ref grammar

Refs are resolved against character inputs by the store; the engine stays pure
(it receives a `resolve(ref)` callback). An unresolvable ref → `null`.

| Ref | Resolves to |
|---|---|
| `attribute|<name>|<Value\|Step>` | The character's attribute value, or its Step (`valueToStep`). |
| `talent|<name>|<Rank>` | The highest owned rank of the named talent (e.g. `talent|Durability|Rank`). An untrained talent is rank 0 — the term contributes 0, it does not null the rating. |
| `characteristics|<column>` | The `rules/characteristics.json` column for the governing attribute's value (e.g. `uncon`, `death`, `wound`, `recovery`, `carry`, `step`, `defense`, `mysticArmor`). |

Example: `{ "ref": "characteristics|uncon" }` = the Unconsciousness base for
the character's Toughness value.

---

## 5. Semantics — what a formula overrides

When an enabled rule declares a formula for a rating:

1. **The rating's base** becomes `evalFormula(formula.terms)` instead of the
   standard table row.
2. **The standard adept synthesis is skipped** for that rating (the
   Σ Durability × rank, and the +Circle on Death — `adeptHealthEffects`). This
   avoids double counting; the rule's own terms carry the intended scaling.
3. **Rule `effects` still fold on top** through the normal `applyModifiers`
   path (so a rule can both replace the base with `formula` *and* adjust it with
   `effects`).
4. The return contract stays `{base, value, modifiers}` — the UI is untouched.
5. Missing/unresolvable inputs → `null` → placeholder pill.

Rules are applied **last-enabled-wins**: if two enabled rules declare a formula
for the same rating, the later rule in the `rules` array wins.

---

## 5.5 `set` — value overrides (v2)

`formula` computes a *rating* as a term sum; it cannot express a **flat
constant**, has **no race-keyed values**, and only targets the health ratings.
`set` (ed-homebrew/2) fills those gaps: it overrides a **named engine target**
with a scalar or a **race-keyed map**.

```jsonc
"set": {
  "karma.step":   { "Dwarf": 4, "Human": 5, "Windling": 6, … },  // race-keyed
  "karma.maxCap": 25,                                             // or a scalar
  "karma.ritualCost": { "Human": 6, … }
}
```

- **Value forms.** A **scalar** applies to every character; a **race-keyed map**
  `{ "<race>": <value> }` resolves against the character's race. A race **absent**
  from the map leaves that target **un-overridden** (the standard derivation
  stands). The keys are race names as in `rules/races.json`.
- **Target registry.** Only targets in `HOMEBREW_SET_TARGETS` (`store.js`) are
  honoured; any other target name is **ignored** (never a silent override of the
  wrong value). v2 registry:
  - `karma.step` — the Karma die Step (replaces the `KARMA_STEP` constant).
  - `karma.maxCap` — a **cap** fed to `maxKarma(modifier, circle, maximum)`; the
    engine applies `min(Modifier × Circle, maxCap)` (absent ⇒ no cap).
  - `karma.ritualCost` — Legend per Karma point for the paid Karma Ritual
    (read by the ritual feature; not a rating). Its presence switches the ritual
    from the free refill to the paid buy-back.
  - `legend.additionalTierShift` — scalar (≥ 0; typically 1): prices every rank
    of an additional-Discipline talent at its own tier bumped that many steps up
    (Novice→Journeyman→Warden→Master, Master stays Master), replacing the
    New-Discipline Rank-1 and Equivalent-Tier tables for those talents (plans/
    PLAN-HOMEBREW-LEGEND-TIER.md). Absent/0 ⇒ the standard tables. Read by the
    Legend-spent audit and the rank-editing pricing (engine/legend-spent.js,
    store.js `tierShift`).
- **Semantics.** `set` **replaces** the target's standard value; a rule may pair
  `set` with `effects`/`formula` on *different* targets. **Last-enabled-wins** if
  two enabled rules `set` the same target. A `set` value is a **constant** in v2
  (no refs). Where a target needs clamping (e.g. `karma.maxCap`), the *engine*
  owns the clamp — `set` only supplies the parameter.

> **Adding a target** to the registry is an engine change (wire the consumption
> site + add the target to `HOMEBREW_SET_TARGETS`), not a format change. Adding a
> *new lever* (beyond `formula`/`effects`/`set`) is a format change (§7).

---

## 6. Authoring workflow — creating a new rule

1. **Identify the standard rule** being overridden and cite it in `overrides`
   (e.g. "Players' Guide p.64 — Health Ratings").
2. **Pick an id** — `hb-` prefix + kebab-case slug naming the subject.
3. **Write the summary** — one plain-English sentence.
4. **Choose the lever** — `formula` to *replace* a computation, `effects` to
   *adjust* one, or both.
5. **Express the formula as terms** — product refs go in `times`, subtraction
   in `sign`, division in `over`, scalars in `coef`. Keep terms minimal.
6. **Annotate** each rating and each term with a plain-English `note` stating
   what that term contributes.
7. **Ship dormant** — set `enabled: false` and validate. Flipping the toggle
   later is a data edit; no UI or code change.
8. **Test** — every grammar form used (`ref`, `times`, `coef`, `sign`, `over`)
   needs a case in `engine/homebrew.test.js`.

---

## 7. Versioning & governance

- The file's shape is its own schema (`ed-homebrew/2`). A **format change** must
  bump the schema tag **and** migrate `rules/homebrew.json` in the same change.
  **v2 (2026-08-13)** added the `set` lever (§5.5) — the `formula`/`effects`
  shape from v1 is unchanged, so v1 rules validate as-is under v2.
- A rule's `effects` must conform to the effect taxonomy; a taxonomy change is
  governed by EFFECT-TAXONOMY.md (bump + migrate + update references).
- Authoring a new rule that fits this format is **Tier 3** (new data); changing
  the format or schema is **Tier 1** (owner sign-off).
