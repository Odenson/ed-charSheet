# Tech Spec: Apply weave-success and cast-success spell options together (spell-extra-weave-and-extra-cast)

## Overview
Add a pure engine composer that turns a cast's raw inputs (extra-thread pick labels, success levels, caster rank) into the applied options (picks with counts, success option with multiplier) and a boosted duration. `otherCastOutcome` and `buildActiveSpell` both use it. `ui/ed-spells.js` only renders the result: chips plus a computed duration line in Target effects, and a chip sub-line on the self-cast Active effects row. All data is derived per render or session-only; nothing new is stored.

## Guardrail alignment
- All changes are Tier 3 (session-state bug fix and in-guideline content on existing Spells-tab sections; UI-GUIDELINES §4 already covers both). No Tier-1 sign-off is needed.
- No schema or version tag, no `rules/*.json`, no taxonomy change (so no Tier 2).
- Data flows down through render and events up through `dispatch`. The engine stays pure and DOM-free, and reads the structured `effects[]` with no label parsing.
- Store only inputs: `_otherCast` is unchanged (picks and levels are already recorded). Rank is derived at render time from `ctx.castingRank`. `options` on the active record is session-only, like the rest of `_activeSpells`.
- The unrolled Effect keeps its `tepend` placeholder pill.
- If implementation needs a stored field or a taxonomy change, stop and re-classify.

## Design
### Data / types
No stored or schema changes. New derived shapes (engine output only):
- `AppliedOptions = { picks: {label, count}[], success: {label, mult} | null }`
  - `success` is null when `levels - 1 < 1` or the spell has no `successes[0]`.
  - `mult = levels - 1`.
- `BoostedDuration = { label, rounds, base, boost, text }`
  - `label` is `spell.duration`.
  - `rounds` and `base` are null when `durationRounds(spell.duration, rank)` is null. That covers non-round durations, null rank and rank 0. `text` then equals `spell.duration`.
- `otherCastOutcome` output gains `success`. `duration` becomes `BoostedDuration | null` (was `{label}`).
- `buildActiveSpell` output gains `options: AppliedOptions`.
- `buildSpellsContext` ctx gains `castingRank: number | null`.

### Modules & functions
`/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/spells.js`
- `appliedOptions(spell, extraPicks, successLevels)` -> `AppliedOptions`. Export it for tests.
  - `picks` is built from the label counts in first-seen order.
  - A stale (unknown) label is still listed with count 1 and adds 0 boost, because `castBoosts` ignores unknown labels.
- `boostedDuration(spell, rank, durationBoostRounds)` -> `BoostedDuration | null`. Returns null when `spell.duration` is falsy.
  - `base = durationRounds(spell.duration, rank)`.
  - `rounds = base + boost` when `base != null`.
  - `text` when `rounds != null`: `"<rounds> round(s) (<breakdown>)"`.
    - The breakdown is `Rank <rank>` when the duration string contains "Rank" (otherwise the base rounds), followed by ` + <boost>` only when boost > 0.
    - Omit the parentheses when there is nothing to break down (no "Rank" and boost 0).
    - Example: Pain, rank 5, boost 2 -> `"7 rounds (Rank 5 + 2)"`.
  - Reuse `castBoosts(...).durationRounds` for the boost. Do not duplicate the folding.
- `otherCastOutcome(spell, cast, opts)`: `opts.rank` is the caster's rank.
  - After picks, set `out.success` from `appliedOptions`.
  - Set `out.duration = boostedDuration(spell, opts?.rank, castBoosts(spell, cast.extraPicks, cast.levels).durationRounds)`.
  - `out.text` appends `Success option: <label>[ ×N]` (the `×N` suffix only when mult > 1) and `Duration <duration.text>`.
  - A miss keeps the early return. Its `picks` and `success` are empty/null and `duration` is null.
  - `out.success` defaults to null in the initial `out` object.
  - Update the doc comment (it still says `opts` is reserved).
- `buildActiveSpell`: add `options: appliedOptions(spell, ctx.extraPicks, ctx.successLevels)`. Reuse `boostedDuration` for rounds if convenient. `roundsLeft` and `roundsTotal` stay boosted and unchanged in value. `tickActiveSpells` already preserves the field via object spread.
- `buildSpellsContext`: in the existing first-match caster-discipline loop, set `castingRank = sc.rank ?? null`. Return it in ctx.
  - The first-match order matches `ed-app._spellcastingRank()`.
  - Rank 0 or null means `rounds` is null and the fallback text is used. Never emit "Rank 0".
  - Document this in the header comment.

`/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-spells.js`
- `_targetEffects()`:
  - Call `otherCastOutcome(spell, cast, { rank: this.ctx?.castingRank })`.
  - Render `out.picks` as `pickchip`, then the success chip as `pickchip`.
  - Success chip text: `out.success.label` when mult = 1 (**plain label, owner decision**); `${label} ×${mult}` only when mult > 1.
  - Duration line: `Duration ${out.duration.text}`.
  - `showLine2` also true when `out.success` is set.
- `_activeRow(e)`: inside `.aemid`, add a sub-line of `pickchip`s from `e.options?.picks` (with `×count` when count > 1) and `e.options?.success` (same plain/×N rule), rendered only when any exist.
  - A record without `options` renders as before.
  - Add a small CSS rule for the sub-line using existing tokens (`var(--fs-*)`, existing spacing/colours; no raw rem).
- The existing `_successBanner` and `_pickSummary` are untouched.

Other readers: `ui/ed-combat.js` (~1101) reads only `.effects` of `model.spells.active`, so it is unaffected. `store.js` (~1603) passes active records through whole, so `options` reaches `ctx.active`.

### UI / behavior
- Target effects (cast on Other, hit):
  - Pain example (rank 5, +1 Wound pick, 2 successes): chips "Increase Effect (+1 Wound)" and "Increase Duration (+2 rounds)" (no ×1), and the line "Duration 7 rounds (Rank 5 + 2)".
  - 1 success: no success chip, unboosted duration (`"5 rounds (Rank 5)"`).
  - 3 successes: chip "Increase Duration (+2 rounds) ×2", duration `"9 rounds (Rank 5 + 4)"`.
  - Non-round duration (e.g. months): the spell's text.
- Active effects row: the same chips on a sub-line under the name/bar. The countdown shows the boosted rounds. A plain cast shows no sub-line.
- Theme: chips reuse `.pickchip`, which is theme-aware (light and dark). No new colours.
- No modal is added, so Escape/Enter behaviour is unchanged. Layout must not add desktop scroll (UI-GUIDELINES no-scroll rule); chips must wrap within the narrow card.
- If the caster's rank changes after the cast, the displayed Target duration shifts. This is accepted (derived at render time).

### Rules
| Rule | Value / formula | rules.md id | Source |
|---|---|---|---|
| Success option per additional success | mult = levels − 1, one success = 0 extra; e.g. +2 rounds with two extra successes = +4 rounds | R1 | FAQ Q012; player-guide p.34, p.270 |
| Extra thread options combine | The same option may repeat and distinct options combine. The cap by Circle is not changed here; the app keeps its weave-then-pick flow | R2 | FAQ Q016; pp.256-257, 270-271 |
| "Rank" and additive duration | Rank = caster's Spellcasting rank; duration boosts from Success Levels and Extra Threads add to the base | R3 | FAQ Q015 |
| Both option sets apply to one cast | Durations from each add | R4 | FAQ Q016; p.270 |
| Round conversion (existing, `durationRounds`) | 1 minute = 10 rounds, 1 hour = 600 rounds | R3 | existing owner rule |

Pain data (for fixtures): duration "Rank rounds"; success option "Increase Duration (+2 rounds)" (`duration-modifier`, +2); extra-thread option "Increase Effect (+1 Wound)".

### Edge cases & invariants
- 1 success (levels = 1) -> `success` null and no boost. A miss -> no options and null duration.
- `levels` of 0 or null never yields negative mult.
- A spell with no `successes[0]` -> `success` null, no throw.
- An unknown pick label is listed (count 1) and adds 0 boost.
- Repeated picks stack with counts.
- No `opts.rank`, null rank or rank 0 -> `rounds` null and `text` = `spell.duration`.
- `appliedOptions` and `boostedDuration` are pure and have no side effects on their inputs.
- `roundsTotal`/`roundsLeft` for existing self-cast flows are unchanged in value; existing `buildActiveSpell` and `effectStepBonus` tests stay green.
- A re-cast replaces the active record (existing filter-by-name behaviour), so `options` reflect the latest cast.

## Testability notes
- node:test in `engine/spells.test.js`, with Pain-like fixtures:
  - `appliedOptions`: counts, repeats, stale label, levels 1/2/3, no success option.
  - `boostedDuration`: rank-based, fixed-rounds, minutes, non-round, rank null/0, boost 0, text format.
  - `otherCastOutcome`: Pain example, 1 success, 3 successes, miss, no `opts.rank`, `text` content. Adjust only the existing assertions that check the `duration` shape (`label` is kept).
  - `buildActiveSpell`: `options` present, boosted `roundsTotal`, plain cast gives empty picks and null success. `tickActiveSpells` preserves `options`.
  - `buildSpellsContext`: `castingRank` equals the Spellcasting talent rank, and is null without the talent.
  - If feasible, a store-level check that `model.spells.active` entries retain `options`.
- Manual verification by the owner (UI cannot be unit-tested): chip wrapping in the narrow card, light and dark themes, no desktop scroll regression, and the active-row sub-line. Do not open the preview unless asked.

## Changelog entry
`data/changelog.json` `unreleased.changes` (type `fixed`): "Spells: casting on another target now lists both the extra-thread and success-level options and the boosted duration, and active self-cast spells show the options that were applied."

## Out of scope
- Any change to stored character data, `rules/*.json`, the taxonomy or schema versions.
- Changing weave/cast roll mechanics, the up-front Circle-capped thread declaration (the book flow), or the one-success-option-per-spell data model.
- Persisting the outcome beyond the existing session state.
- Changing `ed-combat.js` or the Overview active-effects display.
