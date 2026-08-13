# RULEBOOK-AUDIT — Curated extracts vs. Player's Guide

Tracking doc for the audit of the curated `rulebook extracts/` files against the
authoritative raw scan of the Earthdawn Player's Guide. A change that quotes the
rules should cite this document; a discrepancy that re-appears should be recorded
here before it is re-fixed.

## Scope & authority

- **Authority (source of truth):** `rulebook extracts/text-RB-players-guide.txt`
  (raw PG scan, OCR-hyphenated). Spell data cross-checked against
  `rulebook extracts/text-spell-table-all.txt`; discipline/talent source text
  against `text-discipline-players.txt` / `text-talents-players.txt`.
- **Audited (curated) files:**
  - `rulebook extracts/player-tables-narrative.txt`
  - `rulebook extracts/narative_spells_by_circle.txt`
  - `rulebook extracts/text-skill-players.txt`
  - `rulebook extracts/text-discipline-players.txt`
  - `rulebook extracts/text-talents-players.txt`
  - `rulebook extracts/text-race-players.txt` + `QAs_Races.txt`
- **Out of scope:** GM/companion/horror books (context only).
- Line references are to `text-RB-players-guide.txt` unless stated otherwise.
- `rulebook extracts/` is gitignored — extract fixes are **local-only**. The
  tracked, durable deliverables of this audit are the data fix in
  `rules/items.json` and this report.

## Summary

| File | Result |
|---|---|
| `player-tables-narrative.txt` | Clean after ~24 targeted fixes (see below) |
| `narative_spells_by_circle.txt` | **Exact match** — all 561 spell-list entries (5 disciplines × 15 circles) |
| `text-skill-players.txt` | Clean after 3 fixes (see below) |
| `text-discipline-players.txt` | **Matching** — all 15 disciplines |
| `text-talents-players.txt` | **Matching** — all 149 talents |
| `text-race-players.txt` / `QAs_Races.txt` | Clean after 3 fixes (see below) |
| `rules/items.json` | Armor/shield data corrected to PG; weapons & gear already correct |

## Verified clean (no action needed)

- Step/Action dice 1–40.
- Character tables: attributes, physical defense, carrying capacity,
  unconsciousness/death/wound/recovery, mystic armor.
- Navigation, Language, Research, Physician, Astral Sensing, Thread Items,
  Item History, True Pattern, Spell Learning, Spell Matrix, Dispelling, Sensing.
- Costs: attribute increase, talent, skill/circle training, legendary.
- Starting talents & starting equipment tables.
- All 561 spell-list entries, all 149 talents, all 15 disciplines, all 8 races' stats.

## Discrepancies found & fixed

### `player-tables-narrative.txt` (~24 edits)

| Curated line | Issue | PG fix |
|---|---|---|
| ~582 | Survival "mountains" cell blank | → **7** |
| 721–722 | "Swimming Talent" | → **Skill** |
| 836–846 | Raw Magic Mystic Armor wording | PG: **natural** Mystic Armor protects; "natural" on Warping test |
| 649 | `Hearten Laugh` | → **Heartening Laugh** |
| 700 | "Wardrobe **,** and Style" | → **Wardrobe and Style** (no comma) |
| 162 | "Optional rules" | → standard rule (not optional) |
| — | 8 armor-table rows | corrected to PG values |
| — | 6 common-item weights | corrected |
| — | Net STR 4–9 | → **4–8**, plus DEX-9 footnote |
| — | warbow DEX-15 / longbow DEX-13 / bola-net DEX-9 footnotes | corrected |
| — | Spear / Trispear / Windling Bows / Throwing Dagger / Windling Net availability | → everyday / unusual as PG |
| — | Strength Booster | → rare |
| — | 3× "negative weight" | → **negligible** |

### `text-skill-players.txt` (3 fixes)

| Issue | Fix |
|---|---|
| Acting entry missing chunks (words "are genuine. Though the Acting skill does not allow a character to physically alter his", "Acting test and compares the result against the Social Defense of each member of", "to be the type of person he is portraying. If the character pretends to a specific person…" dropped, text fused) | Rebuilt the paragraph verbatim from PG 7985–7999 |
| Disguise ending "…attempting to imper -Mimic Voice, to convince others…" (missing "sonate someone else, the character will likely need other abilities, such as Acting or") | Restored from PG 8210–8212 |
| Example Artisan Skills list missing "Acting" as first entry | "Acting" prepended (matches PG's 20-entry list) |

Known, deliberately retained: the Example Artisan Skills table is a sidebar
inside the **Artist** entry in the PG (not Artisan), and the Example Knowledge
Skills sidebar sits inside **Mapmaking** (not Knowledge). Content is identical;
positions were left as-is to avoid restructuring the extract.

### `text-race-players.txt` / `QAs_Races.txt` (3 fixes)

| Issue | Fix |
|---|---|
| Humans "Versatility" garbled text | Restored faithful PG wording |
| Windling abilities block missing | Appended Astral Sight, Flight, Increased Physical Defense (PG 2783–2806, incl. wet-wings, Toughness(5), Harried) |
| `QAs_Races.txt` windling abilities question absent | Added Q21 |

### `rules/items.json` (data fix — the tracked deliverable)

Verified first-hand against the PG armor table (lines 17549–17570) and shield
table (17577–17585):

| Item | Before | After |
|---|---|---|
| Padded Cloth | cost 10, Phys 1 | **cost 2, Phys 2** |
| Padded Leather | cost 30, Mystic 2, Init −1 | **cost 20**, Mystic/Init effects removed |
| Hardened Leather | Mystic 1, Init −2 | Mystic removed, **Init −1** |
| Ring Mail | cost 300 / 40 lb | **cost 110 / 30 lb** |
| Plate Armor | cost 2500 | **cost 3000** |
| Obsidiman Skin | 5 lb / average / Phys 2 / Mystic 2 | **20 lb / rare / Phys 3 / Mystic 1** |
| Ferndask Shield | Init −1 | **Init −2** (PG 17583) |

All 7 shields re-verified vs PG 17577–17585. Weapons, gear, and magic items
already matched the PG — no changes. JSON re-validated (fixed trailing comma);
`npm test` → **381/381 pass** (pretest runs `tools/check-imports.mjs`).

## Related, tracked elsewhere

Combat-rule discrepancies from the combat-plan review (Called Shot strain
0→1, PG 15486–15487; "Attacking to Stun" carrying the separate *Attacking to
Knockdown* description, PG 909; Blindsided/Partial Cover applying to
Physical+Mystic only with Social at GM discretion, PG 15611–15647) are
recorded in the combat plan work, not re-listed here.

## Post-fix verification

- [x] All curated extracts re-read after edits; no residual fusion/garble in the
      fixed regions.
- [x] `rules/items.json` re-validated (valid JSON, schema shape unchanged —
      Tier 1 invariant preserved).
- [x] `npm test` green (381/381).
- [ ] (reserved) Future extract re-imports should re-run this audit's spot-checks:
      Survival 7, net STR 4–8, Ring Mail 110/30, Plate 3000, Ferndask Init −2.
