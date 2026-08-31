# Plan: Structured Knack Restrictions + Discipline Enforcement

Converts the free-text `restrictions` field on every knack in
`rules/knacks.json` into a structured name→value object (new controlled
vocabulary, new `docs/RESTRICTION-TAXONOMY.md`), bumps the file's schema tag to
`ed-knacks/2`, and has the engine **enforce** the `disciplines` subset of those
restrictions so each character's knack pickers only present knacks whose
discipline gate matches their own disciplines. This file is the **living status
page**: tick a step `[x]` and set its **Status** when it lands, append to
[Issues & learnings](#issues--learnings) and the [Progress log](#progress-log),
and keep it in sync with the code.

- **Owner:** repo owner (sign-off obtained for the locked decisions below).
- **Created:** 2026-08-31. **Branch of record:** `dev`.
- **Baseline:** `dev` — clean working tree, **705/705 tests pass**, lint + import
  check clean (after the prior knack/homebrew work).
- **Related:** completes the outstanding discipline-restriction note left in the
  unreleased `data/changelog.json` entry. Builds directly on
  [PLAN-ADD-KNACKS.md](PLAN-ADD-KNACKS.md) (knack picker, `learnableKnacks`,
  `restriction` display) and reuses the taxonomy-doc precedent from the
  [effect taxonomy](docs/EFFECT-TAXONOMY.md).
- **Taxonomy authority:** `docs/RESTRICTION-TAXONOMY.md` (v1) — new; this plan
  is the status page, that doc is the vocabulary contract. This plan has the
  engine **enforce** the `discipline` subset of restrictions so each character's
  knack pickers only present knacks whose discipline gate matches their own
  disciplines.

---

## Why now (scope note)

The original ask — *enforce discipline restrictions on Spellcasting knacks* —
was a small engine tweak. Review showed every `restrictions` value in
`rules/knacks.json` is a free-text string, so enforcing *any* of it would mean
regex-parsing display strings, which violates the ARCHITECTURE.md §5.5 invariant
("engine reads rule data as structured taxonomy, never by regex-parsing display
strings"). Restructuring `restrictions` into an object is therefore the gate to
enforcement, and it balloons into a full-catalog migration + new vocabulary +
schema bump. That is this plan.

---

## Guardrail classification

| Concern | Class | Why |
|---------|-------|-----|
| `restrictions` field value-type change string→object on `rules/knacks.json` | 🔒 Tier 1 (owner-sign-off obtained) | A field's value type changed = top-level schema shape change on a rules file. Owner approved via the three question answers (2026-08-31). |
| `schema` tag `ed-knacks/1` → `ed-knacks/2` | 🔒 Tier 1 (owner-sign-off obtained) | The schema-tag bump accompanies the field type change. Owner approved. |
| New restriction vocabulary + `docs/RESTRICTION-TAXONOMY.md` | 🔄 Tier 2 (ceremony: new doc + migrate all data + update refs in one change) | Mirrors the EFFECT-TAXONOMY precedent: a controlled vocabulary gets a versioned authority doc, and every data file using the vocabulary (all of `rules/knacks.json`) migrates in the same change. |
| Engine gate (discipline subset) + store wiring | ✅ Tier 3 | Pure, DOM-free, additive; honors "store only inputs" (disciplines are already inputs). |
| UI picker copy/render for structured `restrictions` | ✅ Tier 3 | Within UI-GUIDELINES constraints; no UI/UX-contract change. |

**Tier-1 invariants this plan must not break:** store only inputs; data down /
events up; pure DOM-free engine reading structured taxonomy (never regex on
display strings); derived values as placeholder pills; relative `./…` paths;
UI/UX contract (tabs, modals, theme, two font weights).

---

## Confirmed decisions (owner answers, 2026-08-31)

1. **Fully structure all 16 free-form compounds now** — not just the 26 bare
   singles. Every `restrictions` value becomes a typed object; `discipline` is
   engine-enforced (via the `discipline` key in the structured object), the
   other types are structured for future enforcement and render "GM adjudicates"
   until then.
2. **New `docs/RESTRICTION-TAXONOMY.md` (v1)** — the controlled-vocabulary
   authority, mirroring EFFECT-TAXONOMY (recorded `v1, under review`).
3. **Schema bump to `ed-knacks/2`** — accompanies the field type change, and
   `store-knack.test.js`'s schema assertion updates accordingly.

## Open items / decisions pending

| # | Item | Recommendation | Owner? |
|---|------|----------------|--------|
| A | `discipline` shape (confirmed) | Separate `discipline` key: `string` for single, `{name, circle?}[]` array for OR-lists. **Confirmed in session** | Confirmed |
| B | `"None"` → `{}` sentinel | `{}` = empty = no restriction | Confirmed |
| C | `"Any Discipline"` semantics | Equivalent to no restriction; `{ "note": "Any Discipline" }` stays | Confirmed |
| — | `Strength` attribute vs same-named ability exclusivity (3 knacks) | Re-verify at Step A against catalog | Self |

---

## Restriction vocabulary (v1) — proposed

| Key | Value shape | Enforced? | Semantics |
|-----|-------------|-----------|-----------|
| `discipline` | `string \| {name:string, circle?:number}[]` | **Yes (now)** | OR-list; a knack is learnable iff some entry's `name` is in the character's discipline-name set **and** (when the entry carries `circle`) that discipline's circle ≥ it. A bare string entry normalizes to `{name}`. Single discipline may carry its own circle. Empty/missing → no gate. `circle` as a top-level sibling key is reserved for future use; use the array-object form for circle-gated disciplines. |
| `attribute` | `{ name, value? }` | No (GM) | Requires named attribute ≥ `value`. |
| `race` | `string[]` | No (GM) | Requires character's race ∈ list. |
| `ability` | `{ name, rank? }[]` | No (GM) | Requires a learned ability/talent at `rank`. |
| `note` | `string` | No (GM) | Free-text fallback for anything not yet captured. |

---

## Migration table (145 entries)

### B2 — `"None"` → `{}`  (101 entries)
No restriction, no gate, no note.

### B3 — `"Any Discipline"` → `{ "note": "Any Discipline" }`  (2)
- Craft Poison, Incorporate Glyph.

### B4 — bare single-discipline → `{ "discipline": "<disc>" }`  (26)
The Spellcasting / forging knacks — the engine-enforced subset:
- **Nethermancer (7):** Astral Strain, Bleed, Craft Blood Charm, Pattern Stress,
  Push Against the Horror, Sprain, Unsettle
- **Elementalist (5):** Acid Splash, Burst of Speed, Fortify Armor, Grasping
  Vines, Soothe Venom
- **Wizard (5):** Arcane Accuracy, Arcane Edge, Astral Ward, Deflection, Fortify
  Pattern
- **Illusionist (5):** Befuddle, Courage, Doubt, Fluster, Stutter
- **Weaponsmith (4):** Efficient Armor Forging, Efficient Weapon Forging, Rapid
  Armor Forging, Rapid Weapon Forging

**Canonical form:** `{ "discipline": "Nethermancer" }` (bare string, normalizes to
`[{name}]`). To gate with a circle, use `{ "discipline": [{ "name": "Nethermancer",
  "circle": 4 }] }`.

### B5 — 16 free-form compounds → typed objects

**Multi-discipline OR-lists (engine-enforced on `discipline`):**
| Knack | Current | New |
|---|---|---|
| Craft Common Magic Item | Elementalist 4, Wizard | `discipline: [{name:"Elementalist", circle:4}, "Wizard"]` |
| Create Orichalcum | Elementalist 9, Weaponsmith | `discipline: [{name:"Elementalist", circle:9}, "Weaponsmith"]` |
| Handle Elements | Elementalist 4, Weaponsmith | `discipline: [{name:"Elementalist", circle:4}, "Weaponsmith"]` |
| Incorporate Bound Spirit | Elementalist 6, Nethermancer | `discipline: [{name:"Elementalist", circle:6}, "Nethermancer"]` |
| Augment Ally's Form | Beastmaster 5, Cavalryman | `discipline: [{name:"Beastmaster", circle:5}, "Cavalryman"]` |
| Mold Ally's Form | Beastmaster 9, Cavalryman | `discipline: [{name:"Beastmaster", circle:9}, "Cavalryman"]` |
| Sculpt Ally's Form | Beastmaster 13, Cavalryman | `discipline: [{name:"Beastmaster", circle:13}, "Cavalryman"]` |
| Tame Animal | Beastmaster 7, Cavalryman | `discipline: [{name:"Beastmaster", circle:7}, "Cavalryman"]` |
| Take the Hit | Warrior 5, Swordmaster 6, Scout | `{ "discipline": [ { "name":"Warrior", "circle":5 }, { "name":"Swordmaster", "circle":6 }, "Scout" ] }` |
| I'll Take That | Swordmaster 5, any Discipline | `{ "discipline": [ { "name":"Swordmaster", "circle":5 } ], "note":"any Discipline" }` |

**Circle-only (no discipline named):** `circle: 5` — applies to any discipline at Circle 5.

**Attribute + race (AND, GM-adjudicated):**
| Knack | Current | New |
|---|---|---|
| Strength of Bronze | STR 14, Dwarf | `{attribute:{name:"Strength",value:14}, race:["Dwarf"]}` |
| Strength of Iron | STR 16, Dwarf | `{attribute:{name:"Strength",value:16}, race:["Dwarf"]}` |
| Strength of Steel | STR 18, Dwarf | `{attribute:{name:"Strength",value:18}, race:["Dwarf"]}` |

**Single attribute / ability (GM-adjudicated):**
| Knack | Current | New |
|---|---|---|
| Overpower | Strength | `{attribute:{name:"Strength"}}` |
| Tail Weapon | Tail Combat | `{ability:[{name:"Tail Combat"}]}` |
| Arrow Cutting | Melee Weapons Rank 5, Unarmed Combat Rank | `{ability:[{name:"Melee Weapons",rank:5},{name:"Unarmed Combat"}]}` |

*Note:* during migration, re-open each of these 16 at its catalog line and
confirm exclusivity between the `Strength` *attribute* (`attributes.order`) and
any same-named ability before finalizing type assignment (Step A).

---

## Phases

### Phase A — Taxonomy doc + schema + migration (`rules/knacks.json`)

- [x] A1. Create `docs/RESTRICTION-TAXONOMY.md` (v1, "under review"): the
      vocabulary table above, engine-enforcement semantics (only `discipline`
      enforced in v1), extension path.
- [x] A2. `rules/knacks.json`: `schema` `ed-knacks/1` → `ed-knacks/2`; add
      `"restrictionTaxonomy": "docs/RESTRICTION-TAXONOMY.md (v1)"` (mirrors
      `effectTaxonomy`); update the top `notes` to describe the structured
      object.
- [x] A3. Migrate all 145 `restrictions` values per the tables above
      (B2 → `{}`, B3 → `{note}`, B4 → `{discipline}`, B5 → typed).
      Verify JSON parses; confirm exact B4 counts per discipline (Nethermancer 7,
      Elementalist 5, Wizard 5, Illusionist 5, Weaponsmith 4).
- [x] A4. Design decisions A, B, C confirmed in this session; proceed with
      migration per the updated vocabulary and tables.

**Status:** Done — doc created, schema bumped, all 145 migrated + validated.

### Phase B — Engine gate (`engine/knack-options.js`)

- [x] B1. `learnableKnacks(knackCatalog, ctx, costs)`: accept
      `ctx.characterDisciplines` (`{ name, circle }[]` or a name-set).
- [x] B2. Before the `if (!qualifies.length) continue;` filter, parse
      `entry.restrictions`; when it has a non-empty `discipline` entry:
      - a bare `string` normalizes to a single-entry array `[{name}]`;
      - an `array` whose entries are each either a bare `string` (→ `{name}`) or
        `{name, circle?}`; the knack is learnable iff some entry's `name` is in
        the character's discipline-name set **and** (when the entry carries `circle`)
        that discipline's circle ≥ it; if no matching discipline → `continue`
        (excluded entirely).
      - any other form is structurally invalid and treated as no gate.
- [x] B3. Leave `attribute`/`race`/`ability`/`note` out of the gate (not
      enforced → "GM adjudicates" downstream). Keep the engine pure/DOM-free and
      reading structured taxonomy only.
- [x] B4. Output `restriction` field becomes the structured object (pass-through
      of `entry.restrictions`) instead of the raw string.
- [x] B5. Confirm `scopeKnackOptions` still composes (gate is upstream of
      scoping).

**Status:** Done — gate implemented, gate inactive when omitted/empty.

### Phase C — Store wiring (`store.js` `deriveModel`)

- [x] C1. Build the character's discipline set from the character data
      (`disciplines[].name`, plus `circle` where stored) and pass it to
      `learnableKnacks` as `characterDisciplines`.
- [x] C2. Expose `model.disciplines` / the set to the view if the picker needs
      to reflect it. (Not required — the picker consumes `knackOptions` directly.)
- [x] C3. Confirm mixed characters (e.g. Chakka: Archer 4 + Nethermancer 3) only
      see their own disciplines' gated knacks (Nethermancer yes, Elementalist /
      Wizard / Illusionist no).

**Status:** Done — `characterDisciplines` built from `.map(d => ({name, circle}))`.

### Phase D — UI picker (`ui/ed-disciplines.js` ~1000–1080)

- [x] D1. Replace the flat `ⓘ ${o.restriction} (GM adjudicates)` render with
      structured handling:
      - `discipline` present → enforcement note ("Nethermancer only" /
        "Beastmaster 5, or Cavalryman" · enforced), not "GM adjudicates".
      - `attribute` / `race` / `ability` / `note` present → "ⓘ <text>
        (GM adjudicates)" (current placement).
      - `{}` → no restriction line.
- [x] D2. Keep Escape-closes/Enter-confirms, both themes, placeholder pills, tab
      structure intact (Tier-1 UI rules).

**Status:** Done — `restrictionRender` helper + header copy updated.

### Phase E — Docs & changelog

- [x] E1. `plans/PLAN-ADD-KNACKS.md`: note the structured `restrictions` reform
      (supersedes the "free-text, GM adjudicates" note; `hb-skill-knacks`
      unaffected).
- [x] E2. `docs/RULES-FAQ.md`: confirm/update Q004 (magic-knack ruling) so it
      reflects that Spellcasting-knack discipline restrictions are now
      engine-enforced. *(Implemented as **new Q005** — see Issues & learnings.)*
- [x] E3. `data/changelog.json`: complete the unreleased entry — skill-knack
      homebrew **plus** the restriction restructure + discipline gate.

**Status:** Done — Q005 added, changelog updated, PLAN-ADD-KNACKS noted.

### Phase F — Tests

- [x] F1. `engine/knack-options.test.js`: discipline-gate tests (bare single
      gates for matching discipline, hidden for non-matching; circle-qualified
      entry requires circle ≥; OR-list satisfied by second entry; non-discipline
      types (`attribute`/`race`/`ability`/`note`) do **not** gate).
- [x] F2. `store-knack.test.js`: `deriveModel` builds + passes
      `characterDisciplines`; mixed-char sees only own-discipline gated knacks;
      schema assertion updated to `ed-knacks/2`.
- [x] F3. Migration guard: catalog-integrity test asserting no `restrictions`
      value remains a bare string (all structured); every old bare-discipline
      string is now `{discipline: "<name>"}` (normalizes to `[{name}]`), or
      `{discipline: [{name:"X"}]}` for OR-lists, or
      `{discipline: [{name:"X", circle:N}, "Y"]}` for mixed OR-lists with circles.
- [x] F4. Back-compat: engine handles a legacy plain-string `restrictions`
      (shouldn't exist post-migration) gracefully — no throw.

**Status:** Done — engine 27, store-knack 16, knacks-catalog 3.

### Phase G — Verify + ship

- [ ] G1. Full suite (`npm test`) — expect 705 to grow; lint; import check.
- [ ] G2. Manual: Chakka sheet — Spells/knacks picker shows only Nethermancer-
      gated spell knacks; Elementalist/Wizard/Illusionist hidden. Both themes,
      modals still Escape/Enter.
- [ ] G3. Commit + push to `dev` (owner-sign-off already held for the Tier-1/2
      decisions; include the PR checklist from CLAUDE.md).

**Status:**

---

## Open items / decisions pending

| # | Item | Recommendation | Owner? |
|---|------|----------------|--------|
| A | `discipline` / `circle` keys vs `disciplines` array | Separate keys with Option 2 shape (confirmed in session) | Confirmed |
| B | `"None"` → `{}` sentinel | `{}` = empty = no restriction | Confirmed |
| C | `"Any Discipline"` semantics | Equivalent to no restriction; `{ "note": "Any Discipline" }` stays | Confirmed |
| — | Exact B4 per-discipline counts | Re-verify at Step A against catalog | Self |
| — | `Strength` attribute vs same-named ability exclusivity (3 knacks) | Re-verify at Step A | Self |

---

## Issues & learnings

| Date | Issue / learning | Resolution |
|------|------------------|------------|
| 2026-08-31 | Plan E2 said to "update Q004 (magic-knack ruling)". On review, Q004 is about parent-name normalisation, **not** restrictions — touching it would be wrong. | Added a **new Q005** to `docs/RULES-FAQ.md` documenting the restrictions reform + discipline enforcement; Q004 untouched. |
| 2026-08-31 | `rules/disciplines.json` ships only 4 disciplines (Archer, Nethermancer, Thief, Warrior), but knack restrictions reference the full 8 (Elementalist, Wizard, Illusionist, Beastmaster, …). | The catalog-discipline guard in `knacks-catalog.test.js` checks well-formedness only, not membership in the partial base file. |

---

## Progress log

| Date | Step | Note |
|------|------|------|
| 2026-08-31 | — | Plan created. Owner confirmed: fully structure all 16 compounds; new `docs/RESTRICTION-TAXONOMY.md` (v1); schema bump to `ed-knacks/2`. Baseline: dev @ 705/705, clean tree. |
| 2026-08-31 | Session | Design decisions A, B, C confirmed: separate `discipline`/`circle` keys (Option 2 shape for OR-lists), `{}` for "None", `Any Discipline` ≡ no restriction. Migration tables updated per Option 2. |
| 2026-08-31 | A | Canonical `discipline` shape agreed (bare string for single, `{name, circle?}[]` for OR-lists; bare-string array entries normalize to `{name}`; circles restored on Take the Hit / I'll Take That). `docs/RESTRICTION-TAXONOMY.md` (v1) created; `rules/knacks.json` → `ed-knacks/2` + `restrictionTaxonomy`; all 145 restrictions migrated (101 `{}`, 2 note, 26 single-discipline, 16 compounds), validated. |
| 2026-08-31 | B | `learnableKnacks` gains `characterDisciplines` + a `discipline` OR-list gate (bare-string/array normalization, per-entry circle ≥, AND across mixed types). `restriction` output is now the structured object. Engine tests: +8 (bare single, OR-list 2nd entry, circle ≥, Set input, non-discipline no-gate, omit/empty = no gate, pass-through, legacy string back-compat). |
| 2026-08-31 | C | Store `deriveModel` passes `characterDisciplines` (name+circle from `character.disciplines`) to `learnableKnacks`; always derived, never stored. +1 store test (Nethermancer sees own discipline's spell knacks, not Elementalist ones). |
| 2026-08-31 | D | UI learn-knack picker renders structured restrictions: `discipline` → enforcement note ("X · enforced"), `attribute`/`race`/`ability`/`note` → "GM adjudicates"; `{}` → none. Header copy + comments updated. |
| 2026-08-31 | E | Docs: new Q005 in `docs/RULES-FAQ.md`; `changelog.json` unreleased entry; `PLAN-ADD-KNACKS.md` §5-Q2 superseded note. Plan E2 deviation: Q005 instead of editing unrelated Q004. |
| 2026-08-31 | F | Tests: `store-knack.test.js` schema assertion → ed-knacks/2 + restrictions-shape guard (16 pass); `knacks-catalog.test.js` migration guard + discipline well-formedness (3 pass); engine gate tests (27 pass). |
| 2026-08-31 | G | Full suite + lint + import check (pending final run below). |
