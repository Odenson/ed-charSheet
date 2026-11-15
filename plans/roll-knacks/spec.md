# Tech Spec: Roll knacks (roll-knacks)

## Overview
Knack rows gain a roll button. `store.js` derives a per-knack `roll` object (step, dice, strain, karma, resultMods) through a new pure helper `knackRoll()` in `engine/derive.js`, reading a structured `attribute` field that `rules/knacks.json` gains on the 100 rollable knacks. The roll modal charges the roll's Strain to Health once when an ordinary (auto-rolled) talent or knack modal opens. The charged Strain is carried to the Roll Log entry and to the Discord plain and embed reports.

## Guardrail alignment
All Tier 3, per plan.md (no Tier-1 sign-off needed or recorded).
- `rules/knacks.json`: adds the existing `attribute` field on more entries and normalizes two `strain` strings. This is Tier 3 because the schema tag, taxonomy and shape are unchanged. A `notes` line documents the convention.
- `store.js`, `engine/derive.js`: derived values are computed in the model and are not stored. The engine stays pure and DOM-free and never parses the `step: "Rank+PER"` display string. It reads the structured `attribute`.
- `ui/*`: data goes down (`k.roll`, `t.rollStrain`) and events go up (`ed-roll`, `ed-strain`). The UI computes no game values.
- No step means `roll === null` and no button, so no fabricated number. The new button reuses `.roll`. The chip and hint use theme variables. Modal Escape/Enter is untouched. The Overview is untouched.
- No new Tier-1 item found.

## Design
### Data / types
- `rules/knacks.json` (`knacks` object keyed by name):
  - Add `attribute` (full name: Strength, Dexterity, Toughness, Perception, Willpower, Charisma) to every knack whose `step` matches `Rank+ABBR` or `ABBR+Rank`. That is 100 knacks, including Bribery (`CHA+Rank`). Anticipate Spell already has it and is skipped. Place the key next to `step`, and keep the 2-space format and key order.
  - Swinging Move `strain` changes from `"0+ (see text)"` to `"0"`. Take the Hit `strain` changes from `"2+ (Special)"` to `"2"`. Confirm both summaries already mention the extra Strain (the review verified they do).
  - Leave `step` strings unchanged. Leave N/A, `NA` and null-step knacks untouched.
  - Add one `notes` line: `attribute` is the rolled-step attribute on rollable knacks, and `strain` is a plain number on them.
  - The `schema` and `effectTaxonomy` fields are unchanged.
  - The one-time edit script lives in the scratchpad, not the repo.
- Model (derived, not stored):
  - `model.knacks[i].roll = { step, dice, strain, karma, resultMods } | null`.
  - `talent.rollStrain: number | null`, which is `cat.strain` when numeric.
- Roll log entry: optional `strain: number`, present only when > 0. `store-rolllog.js` has no field whitelist, so no schema change is needed.
- Report object (`_captureRollReport`): optional `strain: number`.

### Modules & functions
- `engine/derive.js`: add `export function knackRoll({ knack, parent, parentAttrStep, knackAttrStep, catalogStep, diceForStep })`.
  - Returns `null` when any of these holds: `knack.attribute` is falsy; `catalogStep` is null, `'N/A'` or `'NA'`; `parent` is missing; or `knackAttrStep` is not a finite number. `catalogStep` is the raw catalog step, used for the existence check only and never parsed.
  - Step derivation (pinned):
    - If `parentAttrStep` is a finite number, `step = parent.step - parentAttrStep + knackAttrStep`.
    - Otherwise, `step = talentStep(knackAttrStep, parent.rank) + sum(parent.rollMods where measure === 'step')`.
    - Floor at 1.
  - `dice = diceForStep(step)`.
  - `strain` is `Number(knack.detail.strain)` when it is a non-empty string or number and `isFinite`, else 0.
  - `karma = parent.karma ?? null`. A skill parent has no karma, so it gives null.
  - `resultMods = parent.resultMods ?? []`.
  - Returns `{ step, dice, strain, karma, resultMods }`.
- `store.js`:
  - Update the stale `resolveKnack` comment (~113-119) to say `attribute` is the rolled-step attribute for rollable knacks. Combat options stay gated on `combatOptions`/`arms`.
  - After `applyTestMods` is applied to talents and skills, and before the return (~1720), add a pass over the resolved knacks.
    - Find the parent. For `parent.type === 'talent'`, take the discipline talent of that name; if it appears in several disciplines, take the highest rank (as `parentTalents` ~1296 does). For `'skill'`, take the owned skill.
    - Gather `parentAttrStep = attrStepByName[parent.attribute]` and `knackAttrStep = attrStepByName[knack.attribute]`.
    - Call `knackRoll` and set `knack.roll`.
  - At the talent build (~925), set `rollStrain = Number.isFinite(cat.strain) ? cat.strain : null`.
  - Do not use `abilityTestMods` (a private closure). The parent's folded step already carries step mods and rank grants.
- `ui/ed-disciplines.js`:
  - Add a shared `_karmaCtx(karma)` helper that holds the construction `_talentRow` does today. `_talentRow` then calls it. No `rank` key is set, so the roll is never treated as set-dice.
  - `_rollDetail`, non-arms branch only: add `strain: t.rollStrain ?? 0`. Do NOT add it to the arms (Mystic Aim) branch.
  - `_knackRow(k)`: when `k.roll != null`, render a `.roll` button (`diceIcon`) that dispatches `ed-roll` with `{label: k.name, step: k.roll.step, karma: this._karmaCtx(k.roll.karma), mods: k.roll.resultMods, strain: k.roll.strain}`.
  - Add `.knrow` CSS with a `margin-left:auto` spacer so the button sits right-aligned. The "i" button and "knack" tag are unchanged. `_knackRow` is shared by the talent view (~1275) and the skills view (~466).
- `ui/ed-roll-modal.js`:
  - In `updated()`, in the final `else` branch, call `_roll()` and then dispatch `ed-strain` `{amount: this.strain}` once when `this.strain > 0`. `updated()` fires once per `stepRow` change, so Karma toggles and Step-mod re-rolls never re-charge.
  - Do not put the charge inside `_roll()`.
  - Add the hint "N Strain on roll." to the ordinary result view only when N > 0.
  - The set-dice and aim paths are unchanged.
- `ui/ed-app.js`:
  - `_rollConfig` already forwards `strain`.
  - The `ed-roll-logged` handler adds `...(strainCharged > 0 ? { strain: strainCharged } : {})` to the `saveRollLog` entry.
  - `strainCharged` is `cfg.strain`, but 0 when `cfg.aim` is set or `cfg.karma?.rank != null` (set-dice). Mystic Aim and True Shot get no Strain line.
  - `_captureRollReport` carries the same value.
  - Report back instead of widening scope if the exclusion proves materially hard.
- `ui/ed-notes.js`: add a "Strain N" chip beside the existing chips (~559), shown only when `entry.strain > 0`. Use theme-aware styling matching the neighbours.
- `engine/discord-roll.js`:
  - `formatRollForDiscord` pushes a `Strain N` body line when `report.strain > 0`. The fixed position is after the Mods line.
  - `formatRollEmbed` calls `push('Strain', String(n), true)` when `report.strain > 0`. Do not add it to the trim loop (a short numeric field needs no trimming).

### UI / behavior
- A knack row with `roll != null` shows a dice button, with aria-label "Roll <knack>" and title "Roll <knack>" plus " (Karma available)" when `k.roll.karma` is present. Rows with `roll == null` (for example Make Concession) show no button. The button also appears under skills when `knackParents` is on.
- Clicking opens the roll modal titled with the knack name only. The modal auto-rolls. Strain, if > 0, is charged to Health once as the modal opens. The hint reads "N Strain on roll." Karma is offered as for the parent.
- Strain is full unmodified damage via the existing `ed-strain` and `applyHealth` path. It never creates a Wound.
- The log and Discord show the knack name and a Strain line or chip, only when > 0.
- Both themes, and Escape/Enter on the modal, are unchanged. Check the knack rows at a mobile width.

### Rules
| Rule | Value / formula | rules.md id and source |
|---|---|---|
| Knack step | The knack's own `Rank+ATTR`. Rank is the governing talent's rank, or the skill's rank. The attribute may differ from the parent's. | R1, Q033, Companion pp.76-77 |
| Karma | Same as the parent talent (owner house ruling). | R2 |
| Strain | The knack's printed Strain replaces the parent's. | R3, Q033 |
| No roll | N/A, NA and null-step knacks (Special Maneuver, crafting) are not rolled. | R4 |
| Roll mods | The parent talent's roll mods carry to the knack (owner house ruling). | R5 |
| Strain cost | Per use. Full unmodified Health damage, no Wounds. Strain 0 costs nothing. | R6, Q034, PG p.123 |
| Karma Strain | Spending Karma costs no Strain. | R7 |
| Data | Rollable knacks carry a plain-number strain. Swinging Move is "0" and Take the Hit is "2". | R8 (owner ruling) |
| Granted talents | Granted and Versatility talents keep their printed Strain. | R9 |

### Edge cases & invariants
- A talent with no `strain` data (null) or Strain 0 charges nothing and shows no hint, log chip or Discord line.
- An unowned or unresolved parent, an unknown attribute step, or a non-rollable step gives `roll === null`, so there is no button.
- The step is at least 1 (`resolveOptionalMods` also floors it in `_rollConfig`).
- Mystic Aim is charged once, via `aim.strain` only. True Shot is charged once, at commit, as before. Neither gets a log or Discord Strain line.
- Combat-tab roll paths pass `strain` 0 for ordinary rolls, so they are unaffected.
- The Karma toggle and optional Step-mod toggles do not re-charge.
- The `upsert` by `rollId` keeps one log row per interaction.
- A knack name with markdown characters is escaped by the existing `escapeDiscord`.
- `knackOptions` and the combat knack options (Anticipate Spell) are unchanged.

## Testability notes
- `node:test`, pure:
  - `engine/derive.test.js` covers `knackRoll`.
    - Lip Reading (Awareness rank 4, PER) takes the `parent.step - parentAttrStep + knackAttrStep` branch.
    - A parent with a step-mod effect.
    - A rank-granted parent.
    - A parent with no attribute, which uses the fallback.
    - A different knack attribute from the parent's.
    - Null for N/A, NA and null steps.
    - A Strain-0 knack under a Strain-1 parent gives 0.
    - Non-numeric strain gives 0.
    - A Versatility parent (`karma` null) gives null karma.
    - A skill parent gives null karma.
    - A parent result mod appears in `resultMods`.
  - `store-knack.test.js`: model integration for Lip Reading and a skill-learned knack with the `knackParents` lever on. Existing tests must still pass.
  - `knacks-catalog.test.js`: for every knack with a rollable step, a full-name `attribute` that agrees with the step abbreviation (parsing the string is allowed in a test), and `strain` matching `^\d+$`. The N/A, NA and null-step knacks are unchanged.
  - `tools/rules-conformance.test.js`: must still pass.
  - `engine/discord-roll.test.js` and `engine/discord-embed.test.js`: Strain present and absent, a long-detail cap case, and a knack name with markdown characters.
  - Existing `store-combat` and combat tests must pass.
- Owner manual verification (Lit UI, no unit seam):
  - Lip Reading (Awareness) roll, and a skill-learned knack with `knackParents` on.
  - A Strain-1 talent, Swinging Move (0) and Take the Hit (2).
  - Strain is charged once on open. Neither a Karma toggle nor a Step-mod toggle re-charges.
  - Mystic Aim is charged once via aim, with no Strain log line. Set-dice is charged once as before, with no Strain log line. Strain 0 charges nothing.
  - Escape and Enter on the modal; light and dark mode; Overview fit; a mobile width; keyboard activation of the button.

## Changelog entry
{"type": "added", "text": "Knacks with a step can now be rolled from their row, and the log and Discord show the knack name. Rolling a talent or knack now charges its Strain to Health (Take the Hit always charges 2)."}

## Out of scope
- Combined knacks, Battle Rites Strain reduction, and Blood Magic damage Strain.
- Authoring `strain` for the roughly 400 talents without data.
- Combat-tab roll paths and the existing aim and set-dice Strain charge.
- Any schema, taxonomy or UI-guideline change.
