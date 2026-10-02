---
status: implemented
shipped: unreleased
---
# Delivery Plan: Apply weave-success and cast-success spell options together (spell-extra-weave-and-extra-cast)

## Context & learnings
A cast has two option sources: Extra Thread options (one pick per successful extra weave) and the spell's Success Levels option (applied once per EXTRA success, levels - 1). The engine already folds both into value/duration for self-casts (`castBoosts`), but:
- Target effects (cast on Other) shows only the extra-thread picks and the unboosted duration text; the success-level option and the boosted duration are lost.
- The self-cast Active effects row folds the boosts invisibly; the user sees no list of applied options.

Owner decisions (qa-log): Target effects lists every pick plus the success-level option with xN, and a computed duration "Duration 7 rounds (Rank 5 + 2)", falling back to spell text when not round-countable. Active effects row gets sub-line chips for all applied options (picks + success option xN); countdown keeps boosted rounds. Keep the app's weave-then-pick flow (rules R2). No change to stored data, `rules/*.json`, taxonomy, roll mechanics, or the one-success-option data model. Engine composes, UI renders.

## Discoveries
- `engine/spells.js`: `otherCastOutcome(spell, cast, opts)` (line ~191) builds `picks` and `duration: {label: spell.duration}` only; it ignores `spell.successes[0]`. `buildActiveSpell(spell, rank, ctx)` (~289) calls `castBoosts` (private; uses `sumOptionBoosts`, `optionEffects`, `durationMeasureRounds`) and returns `{name, discipline, effects, effectLabel, roundsLeft, roundsTotal}` with no option list. `durationRounds(duration, rank)` returns null for non-round durations.
- `buildSpellsContext` (~549) locates the Spellcasting talent (`sc`) for the step but does not expose its rank. `ui/ed-app.js` `_spellcastingRank()` (~713) reads the same rank from the character for `_activateSpell` (~701).
- `ui/ed-spells.js`: `_targetEffects()` (~484) renders `out.picks` as `pickchip` and `Duration ${out.duration.label}`; `_activeRow(e)` (~~line 488) renders name/effectLabel/bar/rounds; `_otherCast` record is built at the `cast` step (~429) with `{seq,name,target,total,levels,extraPicks,effectTotal}`; `_pickSummary` and `_successBanner` already collapse picks / show the success option (`plan.successes[0].label`). `.pickchip` style exists (~177). Session snapshot save/restore copies `_otherCast` (~324, ~339).
- Active spells are session-only (`_activeSpells` in ed-app, `model.spells.active`), so an extra field on the entry needs no persistence/schema change.
- Tests: `engine/spells.test.js` (node:test). Changelog: `data/changelog.json` `unreleased.changes[]` (currently empty).
- Pain: duration "Rank rounds", success option "Increase Duration (+2 rounds)" with a `duration-modifier` effect; extra-thread option "Increase Effect (+1 Wound)".

## Guardrail classification
All items Tier 3: session-state bug fix and in-guideline content on existing Spells-tab sections (UI-GUIDELINES §4 already covers self-cast active effects and target effects). No Tier-1 surface touched: no schema/version tag, no stored data ("store only inputs" respected: the outcome is derived each render from raw inputs), engine stays pure/DOM-free, data-down/dispatch-up preserved. No Tier-2 taxonomy change. No sign-off needed. If implementation finds a need to add stored fields or change the taxonomy, stop and re-classify.

## Rules dependencies
- R1 (FAQ Q012, FAQ-HIT): success option applies per additional success (levels - 1).
- R2 (Q016, ANSWERED, APP-DIFFERS on flow): extra threads stack/combine; owner kept app flow.
- R3 (Q015, FAQ-HIT): "Rank" = Spellcasting rank; duration boosts are additive.
- R4 (Q016, inference; owner stated): both option sets apply to one cast; durations add.
No open NEEDS_RULES.

## Implementation items
### I1 — Engine: shared applied-options composer + boosted duration
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4
- **Tier:** 3
- **What:** Add a pure helper (e.g. `appliedOptions(spell, extraPicks, successLevels)` returning `{ picks: [{label,count}], success: {label, mult}|null, boosts }`) built from `spell.extraThreads` labels and `spell.successes[0]` with `mult = levels - 1` (null when mult is 0 or the spell has no success option). Add `boostedDuration(spell, rank, durationBoostRounds)` returning `{ rounds, base, boost, label (spell.duration), text }`; `rounds`/`base` are null when `durationRounds` is null, in which case text falls back to `spell.duration`. Text for a round-countable duration: `"7 rounds (Rank 5 + 2)"` style (omit "+ boost" when 0; omit the Rank breakdown when the base string has no "Rank"). Reuse `castBoosts`; no label parsing, read structured `effects[]`.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/engine/spells.js`; tests in `engine/spells.test.js`.
- **Approach:** Extract from `castBoosts` / `buildActiveSpell` so both consumers share one source of truth (no duplicated folding).
- **Dependencies:** none.
- **Acceptance criteria:** Pain, picks [Increase Effect (+1 Wound)], 2 successes, rank 5 -> picks as given, success "Increase Duration (+2 rounds)" mult 1, duration 7 rounds. 1 success -> success null, duration unboosted. 3 successes -> mult 2, +4 rounds. Multiple/repeated picks stack with counts. Non-round duration (e.g. months) -> rounds null, text falls back. Existing `buildActiveSpell`/`effectStepBonus` tests unchanged and green.
- **Risks / unknowns:** a pick label that is not in `extraThreads` (stale) contributes no boost but is still listed (decided). Acceptance addition (F4): node:test case with an unknown pick label -> appears in `picks` (count 1) and adds 0 boost (`castBoosts` already ignores unknown labels).

### I2 — Engine: expose caster rank and extend otherCastOutcome
- **Covers tickets:** T1, T2 (rank plumbing)
- **Rules:** R1, R3
- **Tier:** 3
- **What:** Add `castingRank` to `buildSpellsContext`'s returned ctx, read as `sc.rank` in the same loop that finds `sc`, using the same first-match discipline order as `ed-app._spellcastingRank()` (single source of rank semantics). Null/0 behaviour: no Spellcasting talent -> `null`; talent present with missing rank -> treat as null as well (ed-app's `?? 0` is only for activation boosts); a null or 0 rank means `rounds` is null and the duration text falls back to `spell.duration`, never "Rank 0" and document it in the header comment. Extend `otherCastOutcome(spell, cast, opts)` so `opts.rank` (UI passes `ctx.castingRank`) drives `out.success` (`{label, mult}` or null) and `out.duration` (`{label, rounds, base, boost, text}` replacing the bare `{label}`; `label` kept for compatibility), and so `out.text` (the plain-text summary) includes the success option and the computed duration. Miss yields no options (unchanged early return).
- **Where:** `engine/spells.js` (`buildSpellsContext`, `otherCastOutcome`); `engine/spells.test.js`.
- **Approach:** call I1 helpers. Update the stale comment pointing at `plans/spell-target-effect-outcome/spec.md` only if still accurate.
- **Dependencies:** I1.
- **Acceptance criteria:** `castingRank` equals `_spellcastingRank()` for a character with the talent; null without it; rank null/0 -> no "Rank 0" text. Pain example yields picks [Increase Effect (+1 Wound)], success "Increase Duration (+2 rounds)" x1, duration rounds = rank + 2. 1 success -> `success` null. Miss -> picks/success empty, duration null. No `opts.rank` -> rounds null with text fallback. Existing `otherCastOutcome` tests still pass (adjust only where `duration` shape is asserted). node:test coverage for each case.
- **Risks / unknowns:** existing tests assert `duration: {label}` exactly; keep `label` to limit churn.

### I3 — Engine: applied options on the active-spell record
- **Covers tickets:** T1
- **Rules:** R1, R2, R4
- **Tier:** 3
- **What:** `buildActiveSpell` additionally returns `options: { picks, success }` (from I1) alongside the existing fields. `roundsLeft`/`roundsTotal` remain boosted. Record stays session-only.
- **Where:** `engine/spells.js`; `engine/spells.test.js`.
- **Approach:** minimal additive field; no change to fold, `activeSpellEffects`, or `tickActiveSpells` (tick must preserve the field via existing object spread; verify).
- **Dependencies:** I1.
- **Acceptance criteria:** Self-cast Pain with a +1 Wound pick and 2 successes -> `options.picks`, `options.success` x1, `roundsTotal` = rank + 2; no extras -> empty picks, null success. Ticking preserves `options`.
- **Risks / unknowns:** a re-cast replaces the record (existing behaviour, filter-by-name) so options reflect the latest cast.

### I4 — UI: Target effects shows all options and computed duration
- **Covers tickets:** T2
- **Rules:** R1, R2
- **Tier:** 3
- **What:** In `_targetEffects()` pass `{ rank: this.ctx?.castingRank }` to `otherCastOutcome`; render `out.picks` chips, then a success-level chip (`out.success.label` with ` x${mult}` when mult > 1) as `pickchip`, and the duration line as `Duration ${out.duration.text}`. Extend `showLine2` to include `out.success`. Unrolled effect keeps the `tepend` placeholder.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/ui/ed-spells.js`.
- **Approach:** UI only lays out engine output (no folding in the component). Reuse existing classes; `var(--fs-*)` tokens only; no new layout that could cause desktop scroll regressions (UI-GUIDELINES desktop no-scroll rule).
- **Dependencies:** I2.
- **Acceptance criteria:** Owner's Pain example shows chips "Increase Effect (+1 Wound)" and "Increase Duration (+2 rounds)" and "Duration 7 rounds (Rank 5 + 2)". 1 success shows no success chip. Non-round duration shows spell text. Light and dark themes OK. The `_otherCast` record needs no new fields (rank comes from ctx, picks/levels already recorded), so snapshot save/restore is untouched. Render-time derivation of the rank is intentional (F2): "store only inputs" means the cast records only picks/levels, and the displayed duration is derived from the current Spellcasting rank. T2's wording that the record "carries the caster rank" is satisfied by this derived path, not a stored field; if the rank changes after the cast (rank-up or edit) the displayed duration shifts accordingly, which is accepted (session-only, rare).
- **Risks / unknowns:** long labels wrapping in the narrow card; `terow` presumably wraps, verify by reading CSS; owner verifies UI visually (do not open preview unless asked).

### I5 — UI: Active effects row shows sub-line chips for applied options
- **Covers tickets:** T2
- **Rules:** R1, R2, R4
- **Tier:** 3
- **What:** In `_activeRow(e)` add a sub-line under the name/bar (inside `.aemid`) rendering `e.options.picks` and `e.options.success` (xN) as `pickchip`s, only when any exist. Countdown/pct unchanged (already boosted).
- **Where:** `ui/ed-spells.js` (`_activeRow`, small CSS addition for the sub-line spacing using tokens).
- **Approach:** chips render from the engine-built record; rows without `options` (defensive) render as before.
- **Dependencies:** I3.
- **Acceptance criteria:** Pain self-cast with pick + 2 successes shows both chips on the row and `7 rds`-style boosted countdown. Plain cast shows no sub-line. Other callers of active rows (e.g. Overview active effects, if they share the model) are not visually altered. Light/dark OK; no desktop scroll regression.
- **Risks / unknowns:** Verified during revision (F3): `store.js` ~1603 sets `spellsCtx.active = session.activeSpells` whole, so `options` passes through to `ctx.active`, which `_activeRow` reads. The only other consumer is `ui/ed-combat.js` ~1101, which reads only `.effects`, so it ignores `options` and is unaffected. Add a store-level assertion (or test) that the model's `spells.active` entries retain `options`.

### I6 — Docs and changelog
- **Covers tickets:** T3
- **Rules:** none
- **Tier:** 3
- **What:** Add one user-facing line to `data/changelog.json` `unreleased.changes` (type `fixed`), and set `unreleased.summary` if empty-summary convention requires it. Touch UI-GUIDELINES §4 only if its Spells wording contradicts the new chips/duration line; update the `otherCastOutcome` doc comment and the buildSpellsContext header for `castingRank`. Check ARCHITECTURE.md for any description of the flow.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/data/changelog.json`, `docs/UI-GUIDELINES.md`, `engine/spells.js` comments.
- **Dependencies:** I1-I5.
- **Acceptance criteria:** One concise user-facing changelog line; docs and code agree.
- **Risks / unknowns:** none.

## Sequencing
I1 -> I2 -> I3 (engine first, pure and test-driven; I2 and I3 both depend only on I1) -> I4 -> I5 (UI consumes finished engine contracts) -> I6 (docs last, once behavior is final). Run `npm test` / node:test after each engine item.

## Review responses
- F1 (castingRank vs ed-app rank): fixed. I2 now reads `sc.rank` in the same first-match loop as ed-app, states null versus 0 behaviour, and forbids "Rank 0" with fallback to `spell.duration`.
- F2 (render-time rank vs T2): fixed. I4 states render-time derivation is intended (store only inputs), reconciles T2 wording, and notes the rank-change edge case.
- F3 (other consumers / pass-through): fixed. Confirmed ed-combat reads only `.effects`; `store.js` passes active records through whole; recorded in I5.
- F4 (stale pick test): fixed. Test case added to I1 acceptance.

## Open questions
- Wording of the success chip when mult = 1 (plain label, no xN) is assumed from the banner's existing convention (`x${extra}` only when > 1).
- None blocking; ed-combat is the only other `spells.active` reader and is unaffected (see I5).

## Q&A log reference
See `qa-log.md` for the full interrogation record.
