---
status: implemented
shipped: unreleased
---
# Delivery Plan: Unarmed Combat missing short effect (unarmed-short-effect)

## Context & learnings
Backlog B-001 (bug). On the Fighter Test (Troll) character the Warrior's
optional Circle-1 talent Unarmed Combat shows no short effect in the talent
table, unlike its siblings. Cause: the `rules/talents.json` "Unarmed Combat"
entry is a bare stub (`name`, `action`, `attribute` only).

Owner decisions (qa-log.md):
- 2026-11-26T21:57:23Z — fill the **full** entry to match Melee Weapon
  (shortEffect, strain, skillUse, tier, versus, summary, effects). The other
  Warrior Novice stubs (Shield Bash, Tactics, Fireblood) stay out of scope.
- 2026-11-26T21:57:50Z — shortEffect wording is exactly
  **"Unarmed close-combat attack"**.
- 2026-11-26T21:58:26Z — plan confirmed: entry + a data test, values verified by
  rule-agent (rules.md R1–R6). Nothing else.

Non-goals: engine, UI, taxonomy, or combat/damage behaviour changes.

## Discoveries
- `rules/talents.json:948-952` — the stub:
  `{ "name": "Unarmed Combat", "action": "Standard", "attribute": "Dexterity" }`.
- `rules/talents.json:656-679` — Melee Weapon, the template shape: `name`,
  `presentation.shortEffect`, `action`, `attribute`, `strain`, `skillUse
  { allowed, tier }`, `tier`, `versus`, `summary`, `effects[]` with one
  `note` / `on-success` / `source: "talent"` effect. Non-ASCII em dash is stored
  escaped as the six ASCII characters backslash-u-2-0-1-4 (`\u2014`) in this file (as Melee Weapon does; the file mixes styles, but use the escape). The I2 snippet below is written that way.
- `rules/skills.json:3268-3289` — the Unarmed Combat **skill** entry already
  carries the rules-consistent summary ("…damage uses your Strength Step only")
  and an on-success note; the talent wording should agree with it.
- `rules/talents.json` header: `schema: "ed-talents/1"`, `effectTaxonomy:
  "docs/EFFECT-TAXONOMY.md (v6)"`. `note` (§2), `on-success` (§6), `talent`
  (§9) are all existing vocabulary — no taxonomy change.
- Rendering (no code change needed):
  - `store.js:1238` — talent row `brief: cat.presentation?.shortEffect ?? null`
    (Disciplines tab Effect column). This is why the row is blank today.
  - `store.js:933-943` `talentDetail()` — info modal uses `summary`, `versus`,
    `strain`, `skillUse`, and `effects[].summary` as notes; `documented` flips to
    true once `summary` exists. Tier shown in the modal comes from the circle
    (`tierForCircle`), not `cat.tier`.
  - `store.js:1233` — `rollStrain` reads `cat.strain` (0 → no Strain charged,
    same as today's effective behaviour).
  - Also `store.js:1295`, `1760`, `2140`, `2146` — option-pool / candidate briefs
    read `presentation.shortEffect`, so the brief also appears in Warrior
    advancement/option pickers.
- Combat: `store.js:1785` lists Unarmed Combat in `COMBAT_ATTACK_TALENTS`
  (rank/step/karma only); `engine/combat.js:58` maps `unarmed` → Unarmed Combat.
  Talent `effects` are **not** folded into combat pools — `collectCombatEffects`
  (`engine/combat.js:521+`) folds only options/situations/charms/armed talents,
  and Unarmed Combat has no `combatOptions`/`arms`. So the on-success note is
  display-only; no combat behaviour changes.
- `data/characters/fighter-test.json:64` — Fighter Test has Unarmed Combat rank 2,
  circle 1 (the manual check target).
- Tests: `npm test` = `node --test` (pretest runs import/ui-kit lints).
  Single-talent data tests live beside the engine, e.g.
  `engine/taunt-data.test.js` (reads `../rules/talents.json` via
  `new URL(..., import.meta.url)`). `tools/rules-conformance.test.js` validates
  effect vocabulary across `rules/*.json`. `store-creation-model.test.js:150`
  asserts row `brief` equals the catalog shortEffect — still holds.
- `MAX_SHORT_EFFECT = 32` (`engine/validate-item.js:94`, applied to items);
  "Unarmed close-combat attack" is 27 chars, within it anyway.

## Guardrail classification
Whole plan **Tier 3** (docs/GUARDRAILS.md §Tier 3, line 41: "Adding data
within the shape is fine"). New data in the existing `ed-talents/1` shape using
EFFECT-TAXONOMY v6 vocabulary, plus a new test file. No schema tag, taxonomy,
engine, store, or UI change. No Tier-1 or Tier-2 items; no sign-off required.

## Rules dependencies
| Id | Status | Used for |
|---|---|---|
| R1 | FAQ-HIT (Q025) | action Standard, attribute Dexterity, strain 0 |
| R2 | FAQ-HIT (Q025) | `skillUse: { allowed: true, tier: "Novice" }` |
| R3 | ANSWERED (Q025, Q001) | `tier: "Novice"` (offered only as a Novice Talent Option) |
| R4 | FAQ-HIT (Q025) | `versus: "target's Physical Defense"` |
| R5 | FAQ-HIT (Q025, Q026) | summary + on-success note: hit → Damage test with Strength Step only unless noted otherwise |
| R6 | FAQ-HIT (Q025) | no `karma` field (default Karma-eligible per talents.json notes) |

No open NEEDS_RULES.

## Implementation items
### I1 — Data test guarding the Unarmed Combat talent entry
- **Covers tickets:** T2
- **Rules:** R1, R2, R3, R4, R5
- **Tier:** 3
- **What:** New test file asserting the talent entry is complete.
- **Where:** `engine/unarmed-combat-data.test.js` (new), modelled on
  `engine/taunt-data.test.js`.
- **Approach:** Load `rules/talents.json`; for `talents["Unarmed Combat"]` assert:
  `presentation.shortEffect === "Unarmed close-combat attack"`; `action ===
  "Standard"`; `attribute === "Dexterity"`; `strain === 0`; `skillUse` deep-equals
  `{ allowed: true, tier: "Novice" }`; `tier === "Novice"`; `versus` matches
  `/Physical Defense/`; `summary` is a non-empty string mentioning Strength Step;
  `effects` contains a `{ type: "note", condition: "on-success", source:
  "talent" }` effect with a non-empty summary; and no `karma` key. Header comment
  cites plans/unarmed-short-effect and R1–R5.
- **Dependencies:** none.
- **Acceptance criteria:** fails against the current stub; passes after I2;
  picked up by `npm test`.
- **Risks / unknowns:** over-asserting summary prose would make the test brittle
  — assert key facts only (regex), not full strings, except the owner-fixed
  shortEffect.

### I2 — Complete the Unarmed Combat talent entry
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4, R5, R6
- **Tier:** 3
- **What:** Replace the stub with a full entry in Melee Weapon's field order:
  ```json
  "Unarmed Combat": {
    "name": "Unarmed Combat",
    "presentation": { "shortEffect": "Unarmed close-combat attack" },
    "action": "Standard",
    "attribute": "Dexterity",
    "strain": 0,
    "skillUse": { "allowed": true, "tier": "Novice" },
    "tier": "Novice",
    "versus": "target's Physical Defense",
    "summary": "Close-combat attack with your hands, feet, or another body part vs the target's Physical Defense; on a hit, make a Damage test using your Strength Step only, unless noted otherwise.",
    "effects": [
      { "type": "note", "condition": "on-success", "source": "talent",
        "summary": "Hit \u2014 follow with an unarmed Damage test (Strength Step)." }
    ]
  }
  ```
  (Format multi-line to match the surrounding file.)
- **Where:** `rules/talents.json:948-952`.
- **Approach:** Data-only edit. Do not add `karma`, `combatOptions`, or `arms`.
  Leave the file header `notes` and `effectTaxonomy` untouched.
- **Dependencies:** I1 (written first so it is seen red).
- **Acceptance criteria:** I1 passes; full `npm test` passes (incl.
  `tools/rules-conformance.test.js`, `store-creation-model.test.js`); loading
  Fighter Test on the dev server shows "Unarmed close-combat attack" in the
  Disciplines tab Effect column for Unarmed Combat, and the info modal shows
  summary, versus, strain 0, skill use, and the hit note.
- **Risks / unknowns:** JSON validity (trailing commas) — run the tests. The
  Combat tab is unaffected (talent effects are not folded; see Discoveries).

## Sequencing
1. I1 — write the test, confirm it fails on the stub (red).
2. I2 — fill the entry, confirm I1 and the full suite pass (green), then the
   manual UI check on Fighter Test.

Test-first proves the guard actually catches the regression T2 targets.

## Open questions
None blocking. Out of scope and left for later backlog items: the other stub
talents (Shield Bash, Tactics, Fireblood, and ~385 entries without a
shortEffect); the talents.json `notes` line describing authoring coverage is not
updated by this feature.

## Review responses
- **F1 — I2 em dash style contradicts Discoveries (minor): fixed.** The draft
  meant to write the escape, but a literal em dash ended up in the file. The I2
  snippet (and brief.md) now spell the note as `"Hit — follow with an
  unarmed Damage test (Strength Step)."` with the ASCII escape. Discoveries now
  says outright to use the escape, even though the file mixes styles. I1 does not
  depend on this.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
