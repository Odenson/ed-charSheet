# Plan: Homebrew Rules

Homebrew Rules lets the rules files override the standard rulebooks with a list
of data-only rules. Rule #1 covers the **Unconsciousness and Death rating
calculation** (a `formula` override that replaces the standard base and adept
bonuses); the file's `effects` array is the general lever for future rules that
*adjust* a rating rather than replace its computation. This file is the
**living status page**: tick a step `[x]` and set its **Status** when it lands,
append to [Issues & learnings](#issues--learnings) and the
[Progress log](#progress-log), and keep it in sync with the code.

- **Owner:** repo owner (sign-off obtained for the three locked decisions below).
- **Created:** 2026-08-10. **Branch of record:** `dev`.
- **Baseline:** `dev` @ `0439c20` — clean working tree, **320/320 tests pass**.
- **Source rules:** Earthdawn 4E Players' Guide p.64 (standard Health Ratings:
  Unconsciousness = 2× Toughness value + Durability; Death = Unconsciousness +
  Toughness Step + Durability + highest Circle). **Rule #1 replaces this** with
  a Durability-scaled homebrew (see [Rule #1](#rule-1--durability-scaled-health-ratings)).
- **Slice:** repo-level global rules with an `enabled` flag; no per-character
  opt-in, no UI, no taxonomy change in v1.
- **Format authority:** the rule file format, term grammar, ref vocabulary, and
  authoring workflow are defined in
  [docs/HOMEBREW-RULES.md](HOMEBREW-RULES.md) — this plan is the status page,
  that doc is the format contract.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| New `rules/homebrew.json` + schema `ed-homebrew/1` | ✅ Tier 3 (owner-approved) | New file, own schema tag; existing `rules/*.json` shapes untouched (knacks / thread-items precedent). |
| Rule payloads are pure inputs (numbers/booleans), never derived values | ✅ Tier 3 | Honors the "store only inputs" invariant. |
| Effect taxonomy | ✅ Untouched | Stays **v3, no bump**. A rule's optional `effects` reuse the existing grammar; the `formula` override is a data structure outside the vocabulary, not a new vocabulary. |
| Engine change: optional `formula` param on the two rating functions | ✅ Tier 3 | Pure, DOM-free, same return shape `{base, value, modifiers}` — UI-visible contract unchanged. |
| UI | ✅ Untouched | No UI change in v1. |

**Tier-1 invariants this plan must not break:** store only inputs; data down /
events up; derived values render as placeholder pills, never fabricated numbers;
relative `./…` fetch paths.

---

## Confirmed decisions (owner answers, 2026-08-10)

1. **Repo-level, global** — one `rules/homebrew.json` for every character;
   enabled rules are always active. No change to the character data shape.
2. **Data-only formula** for rule #1 — the Unconscious/Death override is a
   structured "sum-of-products of refs" expression in the rule file, not a code
   DSL and not effects-with-`ref` (the latter is unimplemented in
   `applyModifiers`, which only folds numeric values). Exact term grammar is
   under discussion in [Rule #1](#rule-1--durability-scaled-health-ratings).
3. **`enabled` flag per rule** — a rule ships `enabled: true/false`; flipping
   it is a data edit, no UI needed.

---

## Rule #1 — Durability-scaled Health Ratings

**Campaign rule (owner, 2026-08-10):**

| Rating | Homebrew formula |
|--------|------------------|
| Unconsciousness | `(Durability Rank × Toughness Step) + table uncon` (the characteristics-table `uncon` column for the character's Toughness value) |
| Death | `((Durability Rank + 1) × Toughness Step) + table death` (the `death` column) |

Compared with the standard (PG p.64):
- Unconsciousness = table `uncon` (2× Toughness value) + Σ(Durability × rank)
- Death = table `death` (2× Toughness value + Toughness Step) + Σ(Durability ×
  rank) + highest Circle

**What the rule changes / keeps:**
- **Keeps** the table base as a term in the formula — the "base" was confirmed
  to be the Toughness-driven `uncon`/`death` table columns.
- **Replaces** the standard adept synthesis (Σ Durability × rank, and the
  +Circle on Death) with the `Durability Rank × Toughness Step` scaling. When a
  rating has a formula, `adeptHealthEffects` is skipped for it — no double
  counting.
- **Keeps** rule `effects` folding on top (unchanged), the placeholder-pill /
  `null` contract (missing Toughness → `null`), and the return shape
  `{base, value, modifiers}` — UI untouched.

### Proposed data format — "sum-of-products of refs"

Every rule carries an **`enabled` toggle** (boolean): `false` ships the rule
dormant, `true` activates it globally. Flipping it is a data edit, no UI needed.

Every rating is a flat **signed list of terms** — a "sum of signed monomials". A
term is a single value (`{ "ref": … }`) or a product of refs
(`{ "times": […refs…] }`), with optional:

- `coef` — numeric scalar (default 1)
- `sign` — `"add" | "subtract"` (default `"add"`)
- `over` — denominator refs (default none)

Each term evaluates to `sign × coef × Π times ÷ Π over`, and the rating is the
**sum** of all terms.

- **Addition/subtraction happen *across* terms** (`sign`). `A − B` is
  `[{ "ref": "…A…" }, { "ref": "…B…", "sign": "subtract" }]`.
- **Multiplication/division happen *within* a term** (`times` / `over`). `A ÷ B`
  is `{ "times": ["…A…"], "over": ["…B…"] }`.

No operator DSL: `(Rank + 1) × Step` is written as two additive terms
`Rank × Step` + `Step`. Each rating and term may carry a plain-English `note`
(documentation only — the engine ignores it). An unresolvable ref **or** a
denominator summing to zero makes the rating `null` (placeholder pill), never a
guess.

```json
{
  "id": "hb-uncon-death",
  "name": "Durability-scaled Health Ratings",
  "overrides": "Players' Guide p.64 — Health Ratings (Unconsciousness & Death)",
  "summary": "These rules are added to better reflect a true unconsciousness & death rating based on a characters base Toughness and how much they train their Durability",
  "enabled": false,
  "formula": {
    "unconsciousness": {
      "note": "Term1 + Term2 = (Durability Rank × Toughness Step) + table uncon",
      "terms": [
        {
          "times": ["talent|Durability|Rank", "attribute|Toughness|Step"],
          "sign": "add",
          "note": "Durability Rank × Toughness Step."
        },
        {
          "ref": "characteristics|uncon",
          "sign": "add",
          "note": "The standard Unconsciousness base from the characteristics table."
        }
      ]
    },
    "death": {
      "note": "Term1 + Term2 + Term3 (Durability Rank × Toughness Step) + Toughness Step + table death",
      "terms": [
        {
          "times": ["talent|Durability|Rank", "attribute|Toughness|Step"],
          "sign": "add",
          "note": "Durability Rank × Toughness."
        },
        {
          "ref": "attribute|Toughness|Step",
          "sign": "add",
          "note": "The Toughness Step."
        },
        {
          "ref": "characteristics|death",
          "sign": "add",
          "note": "The standard Death base from the characteristics table."
        }
      ]
    }
  }
}
```

**`note` annotations.** Each rating and each term may carry a `note` — plain
English describing what that term contributes to the result. `note` is
**documentation only**: the engine ignores it (pure inputs stay pure; no
behavior derives from the text).

**Ref grammar** (resolved against character inputs by the store, engine stays
pure): `attribute|<name>|<Value|Step>`, `talent|<name>|<Rank>`,
`characteristics|<column>` (the table column for the character's Toughness
value, e.g. `uncon` / `death`). `talent` resolves to the **highest** owned rank
of the named talent — an untrained talent is rank 0, so the term contributes
0 rather than nulling the rating. An unresolvable ref (a missing attribute, an
unknown column) makes the rating `null` (placeholder pill), never a guess.

### Format decisions (owner answers, 2026-08-10)

1. ✅ **Characteristics-table base** — the `uncon` / `death`
   columns in `rules/characteristics.json` for the character's base values
2. ✅ **Durability Rank is the single owned Durability talent rank** — one
   talent, shared across Disciplines (not a per-Discipline sum).
3. ✅ **Signed-monomial term grammar** — additive `terms[]`, each a `{ref}` or
   `{times:[refs]}` with optional `coef`, `sign` (`add`/`subtract`, across
   terms) and `over` (denominator refs, within a term).

---

## Status summary

| Phase | What | Status |
|-------|------|--------|
| [A](#phase-a--data-file-ruleshomebrewjson) | `rules/homebrew.json` + validation | ✅ Done |
| [B](#phase-b--engine-enginecharacteristicsjs) | Optional `formula` override on the health ratings | ✅ Done |
| [C](#phase-c--store-wiring-storejs) | Optional load + enabled-rule resolution + effects merge | ✅ Done |
| [D](#phase-d--tests) | Engine + store tests | ✅ Done |
| [E](#phase-e--docs-verification) | Docs, changelog, verification, push | ⏳ In progress |

---

## Phase A — Data file (`rules/homebrew.json`)

- [x] A1. Create `rules/homebrew.json`: schema `ed-homebrew/1`, `note`,
      `effectTaxonomy: "docs/EFFECT-TAXONOMY.md (v3)"`, and `rules: []`.
- [x] A2. Rule shape: `id`, `name`, `overrides` (which rulebook section),
      `summary`, `enabled` (boolean), optional `formula`, optional `effects`
      (existing taxonomy vocabulary). Formula grammar: `terms[]`, each a
      `{ "ref": "…" }` or `{ "times": ["…", …] }`, optional `{ "coef": n }`,
      `"sign": "add"|"subtract"` (across terms), `"over": ["…", …]`
      (denominator refs, within a term); refs `attribute|<name>|<Value|Step>`,
      `talent|<name>|<Rank>`, `characteristics|<column>`. Plain-English `note`
      annotations are allowed on each rating and each term — documentation
      only, the engine ignores them. Validate all fields are pure inputs.
- [x] A3. Author rule `hb-uncon-death` (Durability-scaled Health Ratings) with
      the two formulas above and an original-wording `summary`.
  - Note: shipped the rule with `enabled: false` so behavior is unchanged until
    the owner flips it — safe default, still exercises the full pipeline.

## Phase B — Engine (`engine/characteristics.js`)

- [x] B1. New pure `engine/formula.js`: `evalFormula(formula, resolve)` sums the
      terms; each term = `sign × coef × Π times ÷ Π over` (defaults: sign
      `"add"`, coef 1, no over). Returns `null` on an unresolvable ref or a
      denominator of zero. `note` fields are ignored.
- [x] B2. `unconsciousnessRating`/`deathRating` accept optional trailing
      `(formula, resolve)` args: when a `formula` is given, `base =
      evalFormula(formula, resolve)` replaces the table base and the
      caller-supplied `effects` still fold on top; `null` (placeholder pill) on
      an unresolvable ref. The adept synthesis is skipped **by the caller** (the
      store) for overridden ratings so nothing is double-counted. Return shape
      `{base, value, modifiers}` unchanged.
- [x] B3. Engine stays pure and DOM-free; the `formula` contract is documented
      in the JSDoc for both functions and in `engine/formula.js`.

## Phase C — Store wiring (`store.js`)

- [x] C1. `loadCharacter`: `loadJSONOptional('./rules/homebrew.json', { rules: [] })`
      → `rules.homebrewFile` (knacks/thread-items precedent).
- [x] C2. `deriveModel`: resolve enabled rules (filter `enabled !== false`);
      build the `{ rating: formula }` override map by iterating the enabled
      rules' `formula` objects (last-enabled-wins per rating).
- [x] C3. Merge each enabled rule's `effects` into `activeEffects` with
      `origin: { kind: 'homebrew', name: <rule name> }`.
- [x] C4. Build `resolveRef(ref)`: `attribute|<name>|<Value|Step>` from the
      character attributes (`attrVal` / `attrStepByName`),
      `talent|<name>|<Rank>` from the **highest** owned rank of the named talent
      (an untrained talent is rank 0), `characteristics|<column>` from the table
      row at the character's Toughness (`lookupChar(touVal)`).
- [x] C5. Pass `(formula, resolveRef)` into `unconsciousnessRating` /
      `deathRating` (store.js:607-608); for a rating with a formula the store
      folds the always-on effects only — `effectsForRating` skips the adept
      synthesis there so nothing is double-counted.

## Phase D — Tests

- [x] D1. New `engine/homebrew.test.js`: `evalFormula` term grammar (`ref`,
      `times`, `coef`, `sign` subtract, `over` divide, combined), base override
      for both ratings, ref resolution, `null` on missing Toughness /
      unresolvable ref / denominator of zero, standard adept synthesis skipped,
      rule `effects` still fold on top of the overridden base.
- [x] D2. Store case with a homebrew rules fixture (`store-homebrew.test.js`):
      `deriveModel` reflects the overridden `unconsciousness`/`death`; disabled
      rules are ignored; homebrew `effects` appear in Active Effects with
      `kind: 'homebrew'`; a formula-less enabled rule only contributes effects;
      an untrained talent resolves to rank 0.
- [x] D3. `npm test` green (**336/336** — 320 existing + 16 new),
      `node --check` on all touched JS.

## Phase E — Docs, verification

- [x] E1. `ARCHITECTURE.md`: note the homebrew rules file in the rules pipeline
      (rules tree + a "Homebrew rules are data, not code" paragraph).
- [x] E2. `docs/REVIEW-FINDINGS.md`: entry recording the pre-existing
      `rules/races.json` health-modifier gap (PG p.64 "Some races receive
      special modifiers…") and that Homebrew is the sanctioned vehicle.
- [x] E3. `data/changelog.json` `unreleased` `added` entry (Homebrew Rules,
      rule #1 Unconscious/Death).
- [x] E4. Commit + push to `dev` (`8ed5a7d`).

---

## Issues & learnings

| Date | Issue / learning | Resolution |
|------|------------------|------------|
| — | — | — |

---

## Progress log

| Date | Step | Note |
|------|------|------|
| 2026-08-10 | — | Plan created; owner confirmed repo-level scope, parameterized formula, `enabled` flag; baseline `0439c20` (320/320), clean tree. |
| 2026-08-10 | — | Rule #1 modeled (Durability-scaled Health Ratings). Owner corrected "race base" → the characteristics-table base; confirmed Durability Rank = single owned talent rank and sum-of-products term grammar; requested plain-English `note` annotations on the rule/formula/rating/terms (documentation only). |
| 2026-08-10 | A | `rules/homebrew.json` authored + validated (schema `ed-homebrew/1`, rule `hb-uncon-death`, notes on every term, `enabled: false`); JSON parses; suite still **320/320**. |
| 2026-08-10 | — | Plan re-synced after an owner edit reverted the data-format update: restored the `note`-annotated format and added the `enabled` toggle to the example JSON. |
| 2026-08-10 | A | Format trimmed per owner: removed the rule-level `note` (summary suffices) and the `formula.note` (overkill); kept rating- and term-level notes. `rules/homebrew.json` + plan example updated. |
| 2026-08-10 | A | Owner edited `rules/homebrew.json` (narrative `summary`, Term1/Term2/Term3 note style); plan example re-synced to match. |
| 2026-08-10 | A | Owner fixed the death rating note's parenthesis (`(Durability Rank × Toughness Step) + Toughness Step + table death`); validated JSON + term expansion, plan example re-synced. |
| 2026-08-10 | A | Term grammar extended: `sign` (add/subtract, across terms) and `over` (denominator refs, within a term); owner chose "implement now". Plan documents the grammar + eval contract (`sign × coef × Π times ÷ Π over`); every term in `rules/homebrew.json` now carries explicit `sign: "add"` for clarity (validated, suite 320/320). |
| 2026-08-10 | A | New format authority created: `docs/HOMEBREW-RULES.md` (rule shape, term/ref grammar, eval + override semantics, authoring workflow, versioning). Referenced from the plan header, `rules/homebrew.json` source note, and CLAUDE.md source-of-truth map. |
| 2026-08-10 | B | `engine/formula.js` landed: `evalFormula`/`evalTerm` implement `sign × coef × Π times ÷ Π over` with `null` on an unresolvable ref or a zero denominator. `unconsciousnessRating`/`deathRating` take optional trailing `(formula, resolve)`; a formula replaces the table base, effects still fold. Adept-synthesis skip is decided by the caller (store) — refined from the B2 wording, which had put it in the engine. |
| 2026-08-10 | C | Store wiring: `loadJSONOptional('./rules/homebrew.json', { rules: [] })` → `rules.homebrewFile`; enabled rules → `{ rating: formula }` override map (last-enabled-wins) + `homebrew`-origin effects folded into `activeEffects`; `resolveRef` resolves attribute/talent/characteristics refs (talent = highest owned rank, untrained = 0); ratings call with `(formula, resolveRef)` and `effectsForRating` skips the adept synthesis for overridden ratings. |
| 2026-08-10 | C | Bug caught by tests: `characteristics|<column>` is a two-part ref, so the column lands in the second segment (`a`), not the third — `resolveRef` originally read `row?.[b]` and every overridden rating went `null`. Fixed to `row?.[a]`; the engine tests pin the term grammar. |
| 2026-08-10 | D | Tests landed: `engine/homebrew.test.js` (grammar forms, defaults, null paths, rating overrides, effects fold) + `store-homebrew.test.js` (override + adept-skip, disabled-rule ignore, homebrew origin, formula-less rule, untrained talent = rank 0). Suite **320 → 336, all passing**; `node --check` clean on all touched JS. One test assertion fixed: for a non-overridden rating `base` is the table base (41), with the adept synthesis as modifiers. |
| 2026-08-10 | E | Docs: `ARCHITECTURE.md` rules tree + "Homebrew rules are data, not code" paragraph; `docs/REVIEW-FINDINGS.md` homebrew scope-notes section (races.json health-modifier gap → Homebrew is the vehicle) + re-review log row; `data/changelog.json` `unreleased` entry. HOMEBREW-RULES.md + plan ref-grammar updated for the untrained-talent-→-0 rule. |
| 2026-08-10 | E | Shipped: committed + pushed to `dev` as `8ed5a7d` ("Homebrew rules: data-only formula/effects overrides (rule #1 Unconscious/Death)"). Suite **336/336**; `rules/homebrew.json` still ships `enabled: false` — behavior unchanged until the owner flips the rule. |
