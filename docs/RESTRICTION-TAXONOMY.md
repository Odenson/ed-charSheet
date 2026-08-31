# Restriction Taxonomy — v1

A controlled vocabulary for **restrictions**: the structured, machine-applicable
prerequisites that gate whether an adept may learn a knack. The engine reads the
`restrictions` object on a knack to decide if that knack is learnable for a given
character. A consistent taxonomy keeps that logic general instead of a pile of
special cases, and keeps the engine reading structured data rather than
regex-parsing display text (ARCHITECTURE.md §5.5).

> Status: **v1, under review.** Field names and vocabularies may change. When they
> do, bump the version and migrate the data files that reference it
> (`rules/*.json` `schema` fields).
>
> **v1 (2026-08-31):** introduced. Only the `discipline` type is engine-enforced
> on a knack. The `attribute`, `race`, `ability`, and `note` types are structured
> for future enforcement and currently render as "GM adjudicates". A knack with an
> empty `restrictions` object (`{}`) has no restriction.

---

## 1. The restrictions object

Knacks in `rules/knacks.json` carry a `restrictions` object. Each key is one
restriction *type*; a knack may combine more than one (e.g. `Strength of Bronze`
requires an attribute **and** a race — an AND). The absence of a key, or an
empty object `{}`, means no restriction.

```jsonc
{
  "discipline": "Nethermancer",            // §2  engine-enforced (v1)
  "race":       ["Dwarf"],                 // §3  AND with the above; GM (v1)
  "attribute":  { "name": "Strength", "value": 14 }, // §4  AND; GM (v1)
  "note":       "Any Discipline"           // §5  free text; GM (v1)
}
```

Two restriction types in the same object are combined with **AND** (the character
must satisfy every present type). Within the `discipline` type, entries are an
**OR**-list at the character's circle (see §2).

---

## 2. `discipline` — engine-enforced (v1)

The only type the engine gates on in v1. A knack with a non-empty `discipline`
entry is learnable **iff** the character's discipline-name set intersects the list
**and**, for the matched entry that carries a `circle`, the character's discipline
of that name has `circle >= entry.circle`.

Value shape — one of:

- a bare **string** — a single discipline with no circle requirement:
  ```jsonc
  { "discipline": "Nethermancer" }
  ```
- an **array** whose entries are each either a bare `string` (→ `{ name }`) or an
  object `{ name, circle? }`:
  ```jsonc
  { "discipline": [{ "name": "Elementalist", "circle": 4 }, "Wizard"] }
  ```
  An OR-list: qualifies if **any** entry matches (Entry A at its circle, or Entry
  B at any circle).

A bare string in any position normalizes to `{ name }`, so the engine always sees
a list of `{ name, circle? }`. Circle-qualified entries use the object form; a
single discipline with a circle uses the single-entry array form.

**Not used in v1:** a `circle` value with no named discipline ("any discipline at
Circle 5"). Reserved for future use.

---

## 3. `race` — structured, GM-adjudicated (v1)

An **array** of allowed race names. The character must be one of them.
```jsonc
{ "race": ["Dwarf"] }
```
Not enforced by the engine in v1; renders as "GM adjudicates".

---

## 4. `attribute` — structured, GM-adjudicated (v1)

An object requiring a named attribute to be at least a value.
```jsonc
{ "attribute": { "name": "Strength", "value": 14 } }
```
`value` is optional (a plain stat floor with no threshold). Attribute names come
from `rules/attributes.json` `order`. Not enforced in v1; renders as "GM
adjudicates".

---

## 5. `ability` — structured, GM-adjudicated (v1)

An **array** of `{ name, rank? }` entries requiring a learned ability/talent at a
rank (an AND within the array).
```jsonc
{ "ability": [{ "name": "Melee Weapons", "rank": 5 }, { "name": "Unarmed Combat" }] }
```
`rank` is optional. Not enforced in v1; renders as "GM adjudicates".

---

## 6. `note` — free text, GM-adjudicated (v1)

A plain-language fallback for any restriction the vocabulary doesn't yet capture
(e.g. "Any Discipline", or a compound the taxonomy can't express). Always render
verbatim; never gate on it.
```jsonc
{ "note": "Any Discipline" }
```

---

## 7. Versioning & migration

Restriction-types live in the `rules/*.json` `restrictions` objects. When a type's
field names or value shapes change:

1. Update this doc **and bump its version** (v1 → v2).
2. Migrate **every** data file that uses the vocabulary to the new form.
3. Update the references that point at it — each file's `schema` tag and its
   `restrictionTaxonomy: "docs/RESTRICTION-TAXONOMY.md (vN)"` field.

All three together, or none. A half-migrated repo is the failure this document
exists to prevent. This is the same contract as the EFFECT-TAXONOMY.
