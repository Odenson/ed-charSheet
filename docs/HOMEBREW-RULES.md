# Homebrew Rules — Data Model & Authoring

How to author a **homebrew rule**: the file, the rule shape, the formula term
grammar, the ref vocabulary, and the engine semantics that consume it. This doc
is the authority for the `rules/homebrew.json` format — read it before creating
or editing a rule. The active build plan lives in
[PLAN-HOMEBREW.md](PLAN-HOMEBREW.md); the effect vocabulary that a rule's
`effects` reuse lives in [EFFECT-TAXONOMY.md](EFFECT-TAXONOMY.md).

> A homebrew rule is **pure data**: inputs plus plain-English notes. It never
> stores a derived value — every number a rating shows is computed by the engine
> from the rule's inputs and the character's inputs, exactly like the standard
> rules it overrides.

---

## 1. Where homebrew rules live

| Piece | File / location | Schema |
|---|---|---|
| Rules file | `rules/homebrew.json` | `ed-homebrew/1` |
| Loading | `store.js` `loadCharacter` — optional (`loadJSONOptional`, knacks/thread-items precedent) | — |
| Effect vocabulary | `docs/EFFECT-TAXONOMY.md` | v3 |
| Build plan | `docs/PLAN-HOMEBREW.md` | — |

The file is **optional**: if it's absent the app behaves exactly as before.
Rules are **global** — an enabled rule applies to every character (there is no
per-character opt-in in v1).

Top-level shape:

```jsonc
{
  "schema": "ed-homebrew/1",                 // Tier-1: don't rename fields
  "source": "… provenance note …",
  "effectTaxonomy": "docs/EFFECT-TAXONOMY.md (v3)",
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

- The file's shape is its own schema (`ed-homebrew/1`). A **format change** must
  bump the schema tag **and** migrate `rules/homebrew.json` in the same change.
- A rule's `effects` must conform to the effect taxonomy; a taxonomy change is
  governed by EFFECT-TAXONOMY.md (bump + migrate + update references).
- Authoring a new rule that fits this format is **Tier 3** (new data); changing
  the format or schema is **Tier 1** (owner sign-off).
