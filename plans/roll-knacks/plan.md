---
status: implemented
shipped: unreleased
---
# Delivery Plan: Roll knacks (roll-knacks)

## Context & learnings
Today a knack row on the Disciplines tab (and under skills when the `knackParents` homebrew lever is on) is info-only: `_knackRow` has an "i" button, a name and a "knack" tag, but no roll button. Only the parent talent rolls, so the Roll Log and Discord report can never name the knack.

Owner decisions (qa-log.md, rules.md):
- Only knacks with a real step get a roll button. N/A, `NA` and null-step knacks (Special Maneuver, crafting) get none (R4).
- The roll label is the knack name only, for example "Lip Reading".
- Step is the knack's own formula, `Rank+ATTR`. Rank is the governing talent's rank, or the skill's rank for a skill-learned knack. The attribute may differ from the parent's (R1).
- Karma eligibility and the parent talent's roll mods carry to the knack roll (R2 and R5, owner house rulings).
- Strain is charged to Health when a talent or knack is rolled. This is new for ordinary talent rolls, which never charged it. A knack's printed Strain replaces the parent's (R3). The charge is full unmodified damage with no Wound check (R6), and Karma costs no Strain (R7).
- Strain timing (owner-ratified, qa-log last entry): an ordinary auto-rolled talent or knack modal charges Strain when it opens, once per roll. Escape-costs-nothing holds only for the deferred aim and set-dice modals. T3 text is already corrected.
- Talents with no `strain` data (about 400 of 456) charge nothing. Authoring that data is out of scope.
- Strain is shown in the modal hint, the Roll Log entry and Discord (plain and embed), only when it is greater than 0. The log and Discord Strain line is limited to talent and knack rolls; Mystic Aim and True Shot (aim/set-dice) rolls do not get it.
- Data fix (R8): rollable knacks need plain-number Strain. Swinging Move "0+ (see text)" becomes "0" and Take the Hit "2+ (Special)" becomes "2".
- Out of scope: Combined knacks, Battle Rites Strain reduction, Blood Magic damage Strain, Combat-tab roll paths, and the existing aim/set-dice Strain charge (it must not double charge).

## Discoveries
- `ui/ed-disciplines.js`
  - `_knackRow(k)` (about line 556) is shared by the talent view (about line 1275) and the skills view (about line 466).
  - `_talentRow` (about line 292) renders the roll button (`.roll`, class at line 159, `diceIcon`) and builds the Karma context `karmaCtx` from `t.karma` plus `model.characteristics.karma`.
  - `_rollDetail(t, karmaCtx)` (line 308) returns `{label, step, karma, mods: t.resultMods}`. For arms talents (Mystic Aim) it returns `aim: {strain}` and `arms`, and that path already charges Strain.
  - The skill row roll (line 427) passes `karma: null` and `mods: s.resultMods`.
- `store.js`
  - `resolveKnack` (line 83) returns `attribute: ref?.attribute ?? null`, `detail.strain`, and `parent: {type, name}`.
  - The model's `knacks` array is built at line 1282 and returned at about line 1377.
  - Talents are built at about line 925. `step = talentStep(attrStep, rank)`, `karma = talentKarmaUse(...)`, and `detail.strain = cat.strain ?? null` (numeric).
  - Skills are built at about line 1246. Skill Karma is not offered on the Disciplines skill row (`karma: null`).
  - `abilityTestMods` / `applyTestMods` (about lines 1677-1720) fold live test-modifier effects onto talents and skills, which adds `stepBase`, `resultMods` and `rollMods`. A knack roll must pick these up from its parent.
  - Knack combat options already derive an arms step from `knack.attribute` plus the parent rank (about lines 1609-1640), and they are not parsed from the step string. This is the precedent to follow.
- **Gotcha: structured attribute.**
  - `rules/knacks.json` carries the attribute only inside the display string `step: "Rank+PER"`. Only 1 of 145 knacks (Anticipate Spell) has a structured `attribute` field ("Perception", a full attribute name).
  - Scan results across 145 knacks:

    | Step value | Count |
    |---|---|
    | `Rank+PER` | 44 |
    | `Rank+DEX` | 24 |
    | `Rank+CHA` | 17 |
    | `Rank+WIL` | 10 |
    | `Rank+STR` | 3 |
    | `Rank+TOU` | 1 |
    | `CHA+Rank` (Bribery) | 1 |
    | `N/A` | 21 |
    | `NA` (Improvised Pattern) | 1 |
    | null | 23 |

  - The Tier-1 rule forbids the engine from regex-parsing display strings (GUARDRAILS, ARCHITECTURE §5.5). T1 therefore needs structured `attribute` data on the 100 rollable knacks. The `attribute` field already exists in the knack shape, so this is a Tier-3 data addition. It is not in the tickets and is added here as I1.
  - The conformance test may cross-check `attribute` against the step string. A test is not the engine, so that is allowed.
- `ui/ed-app.js`
  - The `ed-roll` listener (line 255) calls `_rollConfig` (line 1582). `_rollConfig` already forwards `strain`, `mods`, `aim` and `arms`.
  - The `ed-strain` listener (line 277) applies `applyHealth(..., {damage})` through `_editHealth`.
  - `ed-roll-logged` writes the log entry with `saveRollLog` (line 302).
  - `_captureRollReport` (line 1700) builds the Discord report. It does not carry strain or `aim.strain` today.
- `ui/ed-roll-modal.js`
  - `updated()` runs on a new `stepRow`. Set-dice and aim rolls defer (chooser states). The `else` branch calls `_roll()` immediately, so an ordinary roll commits the moment the modal opens.
  - `_roll()` is also re-called on optional Step-mod toggles, so the Strain charge must NOT live in `_roll()`. It goes in the `updated()` else branch, which fires once per `stepRow`. Karma toggles call `_toggleKarma`/`_log` only, so there is no re-charge.
  - The existing hint "N Strain on roll." is only in the set-dice chooser (line 475) and the aim chooser (line 503). The ordinary result view (`render`, line 511 onward) has no hint yet.
  - Ordinary rolls use `this.strain === 0` today, so wiring a non-zero `strain` into them is safe. Aim rolls use `aim.strain` and a separate dispatch.
- `engine/discord-roll.js`: `formatRollForDiscord` pushes body lines (Dice, Karma, Bonus dice, Mods). `formatRollEmbed` pushes fields with a size-trim loop over `['Dice','Mods','Bonus dice','✦ Karma']`. `escapeDiscord` and `cap` exist. Tests are in `engine/discord-roll.test.js` and `engine/discord-embed.test.js`.
- `ui/ed-notes.js` renders log chips (for example `Bonus` at line 559). `store-rolllog.js` has no field whitelist for `bonusResult`, so a new `strain` field persists without a schema change.
- Existing tests to extend: `store-knack.test.js`, `engine/discord-roll.test.js`, `engine/discord-embed.test.js`, `knacks-catalog.test.js`, `tools/rules-conformance.test.js`. The modal and view are Lit components with no unit tests, so those items need manual verification.

## Guardrail classification
All items are Tier 3, matching tickets.md. No Tier-1 sign-off is needed, and none is recorded because none is required.
- I1: Tier 3. Adds the `attribute` field, which already exists in the knack shape (Anticipate Spell uses it). It changes no shape, schema tag or taxonomy. Strain normalization is also a data edit.
- I2: Tier 3. Model derivation in `store.js` only. It keeps "UI computes nothing" and the pure engine. It reads the structured `attribute` and never parses the step string.
- I3: Tier 3. A new roll button with the existing `.roll` style. Data goes down and dispatch goes up. The label and aria text work in light and dark, and the placeholder/no-step rule is kept (no step means no button).
- I4 and I5: Tier 3. They reuse the existing `ed-strain` and `ed-roll` paths. The modal keeps its Escape/Enter behavior.
- I6 and I7: Tier 3. Formatter, log and report fields are added within their current shapes.
- Tier-1 checks to repeat before finishing:
  - A knack with no step shows no button, so there is no invented number.
  - Both themes work.
  - Modal Escape/Enter still work.
  - The Overview is untouched.
  - `./` relative paths are unchanged.

## Rules dependencies
| Rule | Status | Used by |
|---|---|---|
| R1 knack step is its own `Rank+ATTR` using the parent's rank | ANSWERED | I2 |
| R2 Karma on a knack equals the parent's | NOT-COVERED, owner house ruling recorded | I2, I3 |
| R3 knack Strain replaces the parent's | ANSWERED | I2, I4 |
| R4 N/A and Special Maneuver knacks are not rolled | ANSWERED | I2, I3 |
| R5 parent roll mods carry to the knack | NOT-COVERED, owner house ruling recorded | I2, I3 |
| R6 Strain is per use, unmodified Health damage, no Wounds | ANSWERED (per-use is an inference) | I4 |
| R7 Karma costs no Strain | ANSWERED | I4 |
| R8 knack Strain is a plain number on rollable knacks | APP-DIFFERS, owner ruling recorded | I1, I2 |
| R9 granted/Versatility talents keep their printed Strain | ANSWERED (inference) | I4 |

No rule outside `rules.md` is relied on, so there is no open NEEDS_RULES.

## Implementation items

### I1 — Data: structured attribute and plain-number Strain on rollable knacks
- **Covers tickets:** T5, and the data prerequisite for T1
- **Rules:** R8, R1
- **Tier:** 3
- **What:**
  - Add an `attribute` field (full attribute name, as Anticipate Spell does: "Perception", "Dexterity", "Charisma", "Willpower", "Strength", "Toughness") to every knack whose step is a rollable `Rank+ATTR` or `ATTR+Rank` formula. That is 100 knacks, including Bribery with `CHA+Rank`.
  - Normalize Swinging Move strain to "0" and Take the Hit strain to "2".
  - Leave the `step` display strings as they are.
  - Leave N/A, `NA` and null-step knacks alone, with their strings untouched (never charged, no button).
- **Where:** `rules/knacks.json`. A throwaway script may generate the edit from the step string, but it must live outside the repo or in the scratchpad.
- **Approach:**
  - One-time script maps the attribute abbreviation (STR, DEX, TOU, PER, WIL, CHA) to the full name.
  - Skip Anticipate Spell, which already has the field.
  - Keep the 2-space formatting and key order (`attribute` next to `step`).
  - Do not alter the `schema` or `effectTaxonomy`. Add one `notes` line (mandatory) saying `attribute` is the rolled-step attribute for rollable knacks and `strain` is a plain number on them.
  - Extra-Strain text for Swinging Move and Take the Hit stays in the summary. Confirm both summaries already mention it, and if not, add the original-wording caveat.
- **Dependencies:** none.
- **Acceptance criteria:**
  - Every knack whose step matches a rollable formula has a full-name `attribute` that agrees with the abbreviation in its step string.
  - Every rollable knack's `strain` matches `^\d+$`.
  - No N/A, NA or null-step knack gained a roll-related change.
  - Add a catalog test to `knacks-catalog.test.js` covering these. It is a test file, so the step string may be parsed there.
  - `tools/rules-conformance.test.js` still passes.
- **Risks / unknowns:**
  - Bribery's `CHA+Rank` ordering is a typo-like variant and still means Rank+CHA.
  - The 100-knack data edit must not touch non-rollable entries.
  - `Improvised Pattern` has step `NA` and strain "1+ (see below)". It stays non-rollable.

### I2 — Model: derive each knack's roll (step, strain, Karma, mods)
- **Covers tickets:** T1 (and the model half of T3)
- **Rules:** R1, R2, R3, R4, R5, R8
- **Tier:** 3
- **What:**
  - For each resolved knack, derive a `roll` object, or null when the knack has no real step.
  - The object holds `step`, `dice`, `strain`, `karma` and `resultMods`.
  - `strain` is a plain number, 0 when absent or non-numeric.
  - Expose it through the model's `knacks` array.
  - Also expose the ordinary talent roll's Strain as a plain number on the talent object, for example `talent.rollStrain = cat.strain` when numeric and null otherwise.
- **Where:** `store.js`.
  - Add a pass after `applyTestMods` is applied to talents and skills, and before the return (about line 1720). The parent's folded mods are only available after that point.
  - Add a REQUIRED small pure helper `knackRoll({knack, parent, parentAttrStep, knackAttrStep})` (in `engine/derive.js` or `engine/knack-options.js`) holding the step, strain and karma logic, so it is covered by `node:test` without loading a character. `store.js` only gathers inputs and calls it.
  - Update the stale `resolveKnack` comment (store.js ~113-119), which says `attribute` is null for the vast majority of knacks. It must state that `attribute` is the rolled-step attribute for rollable knacks and that combat options remain gated on `combatOptions`/`arms`.
- **Approach:**
  - Rollable means `k.attribute` is set, the catalog step is not N/A, NA or null, and a governing parent resolved. Read `ref.step` only for the existence check.
  - Never parse the attribute out of the display string.
  - Find the parent:
    - If `parent.type` is talent, use the discipline talent with that name. If it appears in several disciplines, take the highest rank, as `parentTalents` does at line 1296.
    - If `parent.type` is skill, use the owned skill.
  - Knack attribute step: `knackAttrStep = attrStepByName[knack.attribute]` (the folded step, as for talents).
  - PINNED step derivation (one only): `step = parent.step - parentAttrStep + knackAttrStep`, using the parent's displayed (folded) step so rank grants and step mods carry automatically (R5). `parentAttrStep = attrStepByName[parent.attribute]`; `t.attribute` is on the talent object (store.js ~926), and the owned skill carries its attribute likewise.
  - Fallback only when the parent has no attribute: `step = talentStep(knackAttrStep, parentRank) + sum of the parent's rollMods whose measure is "step"`.
  - Do not use `abilityTestMods` (a private closure) and do not re-add a "step-measure bonus" separately; it is already inside `parent.step`.
  - `dice = diceForStep(step)`. `resultMods = parent.resultMods ?? []`.
  - `karma` is the parent talent's `t.karma` (R2). It is null for a skill parent, because skills have no Karma context on this tab. The UI turns it into the modal's Karma context exactly as `_talentRow` does.
  - `strain` is the knack's printed strain as a number (R3). Numeric strings convert with `Number()` after an `isFinite` check, and anything else (N/A, null) gives 0.
  - Null for an unowned or unresolved parent, an unknown attribute step, or N/A, NA or null step. The UI shows no button and invents no number.
  - A step must be at least 1 after bonuses (`resolveOptionalMods` also floors it in `_rollConfig`).
- **Dependencies:** I1 (the structured `attribute`).
- **Acceptance criteria** (tests in `store-knack.test.js` plus helper tests):
  - Lip Reading, parent Awareness at rank 4, PER 14 (step 7), unmodified parent: step is `talentStep(PER step, 4)` and dice match `diceForStep`.
  - Stepped parent: a parent step-mod effect appears in the knack step (`parent.step - parentAttrStep + knackAttrStep`).
  - Rank-granted parent: a talent with a rank grant gives the knack a step that includes the grant.
  - Parent with no attribute uses the fallback formula.
  - A knack with an attribute different from its parent's uses its own attribute.
  - A skill-learned knack (knackParents lever on) uses the skill's rank, and `karma` is null.
  - N/A, NA and null-step knacks give `roll === null`.
  - A knack's strain replaces the parent's: a Strain-1 parent with a Strain-0 knack gives 0.
  - A parent result mod appears in `resultMods`.
  - The parent's Karma grants carry over. A Versatility parent (`karma` null) gives the knack null Karma.
  - Existing knack model tests keep passing, and `knackOptions` and combat knack options are unchanged.
- **Risks / unknowns:**
  - Rank grants are included via the parent's displayed step (pinned above, owner direction). No implementer choice remains.
  - If the same talent appears under several disciplines, the highest rank governs.

### I3 — UI: roll button on knack rows
- **Covers tickets:** T2
- **Rules:** R2, R4, R5
- **Tier:** 3
- **What:**
  - `_knackRow(k)` gets a `.roll` button, rendered only when `k.roll != null`.
  - Click dispatches `ed-roll` with `{label: k.name, step: k.roll.step, karma: <ctx>, mods: k.roll.resultMods, strain: k.roll.strain}`.
  - Label is the knack name only. Aria label is "Roll <knack>". Title is "Roll <knack>" plus "(Karma available)" when `k.roll.karma` is present.
  - The `.roll` styling already exists in this component. The knack row currently shows a muted "knack" tag, so place the button right-aligned in a way that does not break the indented row layout (the `.knrow` flex with a `margin-left:auto` spacer).
- **Where:** `ui/ed-disciplines.js` (`_knackRow`, CSS near `.knrow` line 202, shared by the talent and skills views).
- **Approach:**
  - Build `karmaCtx` from `k.roll.karma`, mirroring `_talentRow`. A small shared `_karmaCtx(karma)` helper reuses what `_talentRow` does so there is one construction.
  - The UI forwards model values only. It computes nothing, and the Strain number comes from the model.
  - Leave the existing "i" button and "knack" tag unchanged.
  - Keep a non-colour cue, because the icon-only button has an aria label.
- **Dependencies:** I2 and I4 (the shared `_rollDetail`/pass-through edits in `ed-disciplines.js` may be built in one change with I4).
- **Acceptance criteria:**
  - The button appears only when the knack has a step. Make Concession shows none.
  - The roll modal title, Roll Log label and Discord (plain and embed) show "Lip Reading".
  - Karma is offered as it is for the parent talent, and parent roll mods are applied.
  - The button also appears under skills when `knackParents` is on, and not when it is off (the rows themselves are already hidden then).
  - Keyboard focus, Enter/Space activation and aria label work.
  - Light and dark mode both render the button, and the Overview still fits.
  - Check the knack rows on a mobile width.
- **Risks / unknowns:**
  - Dice-icon styling inside the 24px-indented row.
  - Modal focus-return uses `deepActiveElement`, so it should work unchanged.

### I4 — Auto-charge Strain on talent and knack roll commit
- **Covers tickets:** T3
- **Rules:** R3, R6, R7, R9
- **Tier:** 3
- **What:**
  - The Disciplines-tab ordinary talent roll passes `strain` from the model (`t.rollStrain ?? 0`), alongside the existing label, step, karma and mods.
  - Knack rolls pass `k.roll.strain` (I3).
  - The roll modal charges that Strain to Health once when an ordinary roll opens and auto-rolls, through the existing `ed-strain` event and `ed-app` handler.
  - The ordinary result view shows a hint "N Strain on roll." only when N is greater than 0.
- **Where:**
  - `ui/ed-disciplines.js`: `_rollDetail`, the non-arms branch only. Do NOT add `strain` to the arms (Mystic Aim) branch, which already carries `aim.strain`.
  - `ui/ed-roll-modal.js`: `updated()`, in the final `else` branch that calls `_roll()`, dispatch `ed-strain` once if `this.strain` is non-zero. Add the hint to the ordinary result view.
  - `ui/ed-app.js`: `_rollConfig` already forwards `strain`. No change is needed there beyond I6.
- **Approach:**
  - Owner-ratified (review F2): for ordinary modals the charge lands when the modal opens and the dice land, because the auto-roll is the only roll. "Escape costs nothing" applies to the deferred modals (set-dice and aim) only.
  - Do not charge inside `_roll()`, because `_roll()` is re-called on optional Step-mod toggles.
  - Charge once per `stepRow` change in `updated()`, so Karma toggles and Step-mod re-rolls never re-charge.
  - The `ed-app` handler already applies the Strain as full unmodified damage through `applyHealth`, with no Wound check (R6).
  - No `strain` data (null or 0) means no charge. Only the Disciplines-tab talent and knack paths pass `strain`.
  - Combat-tab roll paths and the aim/set-dice Strain are untouched. Mystic Aim is not double charged, because its branch does not pass `strain`.
  - Other talent roll surfaces, such as the half-magic and skill rolls, pass no strain.
- **Dependencies:** I2 only (its knack part consumes `k.roll.strain` from I2; the button itself is I3).
- **Acceptance criteria:**
  - Rolling a Strain-1 talent (for example a talent in the 47 with data) adds exactly 1 Health damage once.
  - Strain 0 or null charges nothing.
  - Toggling Karma, or ticking an optional Step mod (which re-rolls), does not re-charge.
  - Mystic Aim is charged once, via aim, as before.
  - Rolling a knack charges the knack's Strain and not the parent's.
  - The modal shows "N Strain on roll." only when N > 0.
  - Strain never creates a Wound.
  - Existing `store-combat` and combat tests still pass.
  - No double charge on set-dice and aim paths.
- **Risks / unknowns:**
  - No UI unit tests exist for the Lit modal. The pure `knackRoll()` helper (I2) is unit-tested; the charge cases (open once, Karma toggle, Step-mod toggle, aim, set-dice, Strain 0) are explicit owner manual-verification items in I7.
  - The apply-damage path may open a damage or Unconscious state (existing behavior). Confirm the damage lands through `_editHealth` exactly as the aim path does.

### I5 — Strain in roll log and report config
- **Covers tickets:** T4 (log half), and feeds I6
- **Rules:** R6
- **Tier:** 3
- **What:**
  - Record the charged Strain on the Roll Log entry, and show it as a chip in Notes → Log.
  - Carry it to the Discord report object.
- **Where:**
  - `ui/ed-app.js`: in the `ed-roll-logged` handler add `...(strainCharged > 0 ? { strain: strainCharged } : {})` to the `saveRollLog` entry.
  - `ui/ed-app.js` `_captureRollReport`: add the same value to the report.
  - `ui/ed-notes.js`: a "Strain N" chip beside the existing chips (line 559 area).
- **Approach:**
  - `strainCharged` is `cfg.strain` only for ordinary talent and knack rolls: 0 when `cfg.aim` is set or the Karma context is set-dice (`karma?.rank != null`, as `_isSetDice`). Mystic Aim and True Shot entries therefore get no Strain line. If this exclusion proves materially harder than a simple guard, report back rather than widening scope.
  - Logging only fires after commit, so the number is accurate.
  - It is absent when 0, so existing log entries and tests are unaffected.
  - Use theme-aware chip styling that matches the existing chips.
- **Dependencies:** I4.
- **Acceptance criteria:**
  - A Strain-charging roll logs `strain: N`.
  - A zero-Strain roll has no strain key, and no chip shows.
  - The upsert by `rollId` keeps one row per interaction (Karma toggles replace it).
  - A Mystic Aim or set-dice roll logs no `strain` key.
- **Risks / unknowns:**
  - Aim and set-dice rolls must stay free of the new Strain line (owner direction); their charging is unchanged.

### I6 — Strain in Discord plain and embed formatters
- **Covers tickets:** T4
- **Rules:** R6
- **Tier:** 3
- **What:** Add a Strain line to the plain report body and a Strain field to the embed. Both appear only when `report.strain > 0`.
- **Where:** `engine/discord-roll.js` (`formatRollForDiscord`, `formatRollEmbed`) and tests in `engine/discord-roll.test.js` and `engine/discord-embed.test.js`.
- **Approach:**
  - Plain: push a body line such as `Strain N` (number only, so no escaping risk). It goes before the Mods line or after, and the position must be fixed in the tests.
  - Embed: `push('Strain', String(n), true)`.
  - Add `'Strain'` to the size-trim loop only if the 6000-char guard needs it. A short numeric field never needs trimming, so adding it is optional.
  - The plain-content length cap trims body detail lines first and keeps the header and Total, so the existing cap logic already holds.
  - The label is already escaped, and the knack name goes through `escapeDiscord`, so check a knack name with markdown characters.
- **Dependencies:** I5.
- **Acceptance criteria:**
  - The Strain line shows only when N > 0, in both formats.
  - Existing discord tests pass unchanged.
  - New tests cover plain with and without strain, embed with and without strain, and length-cap behavior with a long detail.
- **Risks / unknowns:** none significant.

### I7 — Docs and wrap-up
- **Covers tickets:** all (traceability)
- **Rules:** none
- **Tier:** 3
- **What:**
  - Update the docs that describe knack rows or roll buttons, if any mention them (check `docs/UI-GUIDELINES.md` and `ARCHITECTURE.md` for knack and roll-button wording).
  - Note the new `attribute` convention in docs where knack data is described (the `knacks.json` `notes` line is done in I1).
  - Run the Tier-1 re-check list.
  - Add a changelog entry only if the repo convention requires one per feature (the release workflow writes the changelog, so likely not here).
- **Where:** `docs/`, `ARCHITECTURE.md` (only if they mention knack rows).
- **Dependencies:** I1 to I6.
- **Acceptance criteria:**
  - `npm test` passes.
  - A manual pass in the dev server covers Lip Reading (Awareness, PER), a skill-learned knack with `knackParents` on, a Strain-1 talent, Swinging Move (Strain 0) and Take the Hit (Strain 2).
  - Owner manual charge checks: Strain charged once on open; Karma toggle does not re-charge; Step-mod toggle does not re-charge; Mystic Aim charged once via aim with no Strain log line; set-dice charged once as before with no Strain log line; Strain 0 charges nothing.
  - Release notes mention: ordinary rolls charge Strain on open; Take the Hit always charges 2.
  - Light and dark mode, modal Escape and Enter, and the Overview viewport fit are all confirmed.
- **Risks / unknowns:** none.

## Sequencing
1. **I1** data first. Everything downstream needs the structured `attribute` and plain-number Strain.
2. **I2** model next. The UI forwards model values and must not compute them, and the tests pin the step math with no UI.
3. **I4** modal and talent-roll Strain wiring (depends on I2 only), then **I3** the knack button (depends on I2 and I4). I4 first means that once the button exists it charges correctly from day one. They may share one change since both edit `ed-disciplines.js`.
4. **I5** log and report config, then **I6** Discord formatters. I6 depends on the report field from I5.
5. **I7** docs and the full verification pass.

## Open questions
- None blocking. Resolved: Strain-on-open for ordinary rolls (owner-accepted), aim/set-dice excluded from the Strain log line, parent step derivation pinned.
- **Strain 0 hint.** No hint or log line is shown for 0, per T3 and T4.

## Review responses
- **F1 (major): fixed.** One derivation pinned in I2 (`parent.step - parentAttrStep + knackAttrStep`, with a fallback for attribute-less parents) and acceptance tests added for stepped and rank-granted parents.
- **F2 (major): fixed.** Owner accepted charge-on-open for ordinary rolls (qa-log); I4, Context and Open questions updated, T3 already corrected.
- **F3 (minor): fixed.** I4 now depends on I2 only; I3 depends on I2 and I4; shared edits noted.
- **F4 (minor): fixed.** `resolveKnack` comment update added to I2; I1 `notes` line is mandatory; combat option unchanged check kept.
- **F5 (minor): fixed.** `knackRoll()` helper required in I2; charge cases listed as manual checks in I7.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
