# Tech Spec: Unarmed Combat missing short effect (unarmed-short-effect)

## Overview
The `rules/talents.json` entry `talents["Unarmed Combat"]` (lines 948-952) is a
stub with only `name`, `action` and `attribute`. Because of that,
`presentation.shortEffect` is missing, so the Disciplines tab Effect column is
blank and the info modal is undocumented. The fix is data only: replace the stub
with a full entry shaped like Melee Weapon (`rules/talents.json:656-679`), with
values verified in rules.md R1-R6. A new data test
(`engine/unarmed-combat-data.test.js`) guards the entry and is written first, so
we see it fail against the stub.

## Guardrail alignment
- **I2 (talents.json entry): Tier 3.** It adds data inside the existing `ed-talents/1`
  shape (GUARDRAILS §Tier 3, "Adding data within the shape is fine"). It uses only
  EFFECT-TAXONOMY v6 vocabulary: `type: "note"` (§2), `condition: "on-success"`
  (§6), `source: "talent"` (§9). The header `schema`, `notes` and `effectTaxonomy`
  stay as they are.
- **I1 (new test file): Tier 3.**
- No Tier-1 or Tier-2 items, so no sign-off is needed. I confirmed the plan's
  classification.
- Architecture holds. No engine, store or UI code changes. The store already
  derives `brief`/`detail` from the catalog (`store.js:1238`, `talentDetail`
  at `store.js:933-943`). Nothing derived is stored: the character file
  (`data/characters/fighter-test.json:64`) keeps only name/rank/circle. The
  effect is display-only, and `collectCombatEffects` (`engine/combat.js`) does
  not fold talent `effects` that have no `combatOptions`/`arms`.

## Design
### Data / types
Replace `rules/talents.json:948-952` with the following. Keep the field order,
use multi-line formatting like the surrounding entries, and write the em dash as
the ASCII escape `—`:

```json
"Unarmed Combat": {
  "name": "Unarmed Combat",
  "presentation": {
    "shortEffect": "Unarmed close-combat attack"
  },
  "action": "Standard",
  "attribute": "Dexterity",
  "strain": 0,
  "skillUse": {
    "allowed": true,
    "tier": "Novice"
  },
  "tier": "Novice",
  "versus": "target's Physical Defense",
  "summary": "Close-combat attack with your hands, feet, or another body part vs the target's Physical Defense; on a hit, make a Damage test using your Strength Step only, unless noted otherwise.",
  "effects": [
    {
      "type": "note",
      "condition": "on-success",
      "source": "talent",
      "summary": "Hit — follow with an unarmed Damage test (Strength Step)."
    }
  ]
}
```

Do **not** add `karma`, `combatOptions` or `arms`. No other talent and no schema
change.

### Modules & functions
| File | Change |
|---|---|
| `engine/unarmed-combat-data.test.js` | **New.** Modelled on `engine/taunt-data.test.js`: `node:test` + `node:assert/strict`, loading `JSON.parse(readFileSync(new URL('../rules/talents.json', import.meta.url)))`. The header comment cites `plans/unarmed-short-effect` and R1-R5. |
| `rules/talents.json` | Replace the stub at lines 948-952 (see above). |

Existing readers need no change:
- `store.js:1238`: row `brief = cat.presentation?.shortEffect ?? null`.
- `store.js:933-943` `talentDetail()`: summary, versus, strain, skillUse, notes from `effects[].summary`; `documented = !!cat.summary`.
- `store.js:1233`: `rollStrain` = 0.
- Option-pool and candidate briefs (`store.js` ~1295, 1760, 2140, 2146) also pick up the shortEffect.

### UI / behavior
No UI code change. User-visible result on Fighter Test (Troll, Unarmed Combat rank 2, circle 1):
- In the Disciplines tab, the Effect column for Unarmed Combat shows "Unarmed close-combat attack".
- The info modal becomes "documented". It shows the summary, versus "target's Physical Defense", Strain 0, Skill Use (Novice), and the note "Hit — follow with an unarmed Damage test (Strength Step)." The tier chip still comes from the circle (`tierForCircle`), not from `cat.tier`.
- The Warrior option pickers show the same brief.
- The Combat tab does not change.
- The modal and theme behaviour are the existing ones, and nothing new is styled.

### Rules
| Field | Value | Rule |
|---|---|---|
| `action` | `"Standard"` | R1 (Q025; talents p.177) |
| `attribute` | `"Dexterity"` (Step = Rank + DEX) | R1 |
| `strain` | `0` | R1 |
| `skillUse` | `{ allowed: true, tier: "Novice" }` | R2 (Q025) |
| `tier` | `"Novice"` (Novice Talent Option only; not a Warrior C1 Discipline Talent) | R3 (Q025, Q001) |
| `versus` | contains "Physical Defense" (exact: `"target's Physical Defense"`) | R4 (Q025; pp.391-392) |
| `summary` / on-success note | hit leads to a Damage test using **Strength Step** only, unless noted otherwise; no unarmed-specific bonus | R5 (Q025, Q026) |
| `karma` | absent (default eligibility) | R6 (Q025) |
| `presentation.shortEffect` | exactly `"Unarmed close-combat attack"` | owner decision 2026-11-26T21:57:50Z |

### Edge cases & invariants
- The file must stay valid JSON (no trailing commas). All other talents stay byte-identical.
- `effectTaxonomy` still matches `/\(v6\)/`.
- There is exactly one `effects` entry, and it is the on-success note.
- `store-creation-model.test.js:150` (row `brief` equals the catalog shortEffect) and `tools/rules-conformance.test.js` must stay green.
- The shortEffect is 27 characters, within the 32-character convention (`engine/validate-item.js:94`, which applies to items).

## Testability notes
In `engine/unarmed-combat-data.test.js`, with `t = talentsFile.talents['Unarmed Combat']`:
1. `t.presentation.shortEffect === 'Unarmed close-combat attack'` (exact).
2. `t.action === 'Standard'`, `t.attribute === 'Dexterity'`, `t.strain === 0`.
3. `assert.deepEqual(t.skillUse, { allowed: true, tier: 'Novice' })`; `t.tier === 'Novice'`.
4. `t.versus` matches `/Physical Defense/`.
5. `t.summary` is a non-empty string that matches `/Strength Step/` (and `/Physical Defense/`).
6. `t.effects` contains an entry with `type 'note'`, `condition 'on-success'`, `source 'talent'` and a non-empty `summary`.
7. `!('karma' in t)`; also no `combatOptions` and no `arms`.

Match prose with regex only (do not compare full summary strings). The test must fail on the current stub; tests 1-7 except 7 fail. Run the suite with `npm test`.

Manual check for the owner: on the dev server, open Fighter Test and check the Disciplines tab Effect column and the Unarmed Combat info modal, in light and dark themes.

## Changelog entry
`{"type": "fixed", "text": "Unarmed Combat now shows its short effect and full talent details (attack vs Physical Defense, Strength Step damage)."}`

## Out of scope
- The other stub talents (Shield Bash, Tactics, Fireblood, and the ~385 entries with no shortEffect).
- The talents.json header `notes` coverage line.
- Any change to engine, store, UI, taxonomy, or combat/damage folding, including making the on-success note affect the Combat tab.
