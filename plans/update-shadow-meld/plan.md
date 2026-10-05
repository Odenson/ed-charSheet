---
status: building
---
# Delivery Plan: Update Shadow Meld (update-shadow-meld)

## Context & learnings
Shadow Meld (Nethermancer Circle 1, PG p. 321) is modelled in `rules/spells.json` only as an unconditional +4 Stealthy Stride step bonus. The book also gives: a success-level option (Increase Duration +2 minutes), two extra-thread options (Increase Duration +2 minutes; Increase Effect +2 bonus), a "while near shadows" condition on the bonus, and a default-skill grant for Stealthy Stride.

Owner decisions (qa-log): Extended Shadow Meld knack (DS p. 425) is out of scope; the default-skill grant is a `note` effect only and the taxonomy gap is logged in the audit doc for a later Tier-2 fix; no new taxonomy term or version bump. On "near shadows" the owner's final ruling is option 3 (supersedes the earlier "situational" answer): the +4 and Increase Effect +2 stay `condition: "always"` (rolled in), and "near shadows" appears in description/summary text only. No engine or UI change.

## Discoveries
- `rules/spells.json` ~526-558: Shadow Meld has `successes: []`, `extraThreads: []`, one unconditional `test-modifier` (Stealthy Stride, add 4, step, sustained).
- Template: Soul Armor (`rules/spells.json` ~559-625) has `successes` with a per-success `duration-modifier` (`condition: "on-success"`, `perSuccess: true`) and `extraThreads` with a `duration-modifier` and an Increase Effect effect. Reuse these shapes.
- `store.js` ~1606-1617 (`abilityTestMods`) folds test-modifiers into rolls when `autoApplies(e)` (`engine/characteristics.js:55`: condition absent/"always", not `gmDiscretion`). Keeping `condition: "always"` therefore makes +4 and +2 per Increase Effect thread reach the Stealthy Stride roll with no code change.
- Aspect of the Casual Murderer (`rules/spells.json` ~4080-4135) has a `note` effect with `gmDiscretion`; mirror its note shape.
- `docs/TAXONOMY-AUDIT.md`: last finding is T-051 (summary table row ~112; entries under "New findings (2026-10-04)"); next free id T-052. The file has uncommitted edits from other work and must be edited surgically.
- Working tree has unrelated uncommitted edits to `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js`, `docs/TAXONOMY-AUDIT.md`, `docs/RULES-FAQ.md`: do not touch or bundle (except the targeted T-052 insertion).

## Guardrail classification
- I1, I2 (data in `rules/spells.json`, new test file; fits schema/taxonomy, no new vocabulary): Tier 3.
- I3 (audit doc finding): Tier 3, docs only.
- No Tier-1/Tier-2 item; no sign-off required.

## Rules dependencies
- R1 Shadow Meld base text (PG p. 321) - ANSWERED, APP-DIFFERS; Decision recorded in rules.md (owner 2026-10-05, original request: follow the book): I1.
- R2 Success levels (+2 minutes per extra success) - ANSWERED, APP-DIFFERS; same owner Decision (follow the book): I1, I2.
- R3 Extra threads (Increase Duration +2 min; Increase Effect +2 bonus) - ANSWERED, APP-DIFFERS; same owner Decision (follow the book): I1, I2.
- R4 "Near shadows" condition - ANSWERED; owner option 3: text only, always-on: I1.
- R5 Extended Shadow Meld knack - ANSWERED; owner: out of scope (no item).
- R6 Default-skill grant - ANSWERED; owner: note effect only, gap logged: I1, I3.
No open NEEDS_RULES.

## Implementation items
### I1 — Complete the Shadow Meld spell entry
- **Covers tickets:** T1
- **Rules:** R1, R2, R3, R4, R6
- **Tier:** 3
- **What:** In `rules/spells.json` "Shadow Meld":
  (a) `successes`: one entry "Increase Duration (+2 minutes)" with a `duration-modifier` (add 2, minutes, source spell, `condition: "on-success"`, `perSuccess: true`), copied from Soul Armor.
  (b) `extraThreads`: "Increase Duration (+2 minutes)" (`duration-modifier`, as Soul Armor) and "Increase Effect (+2 Stealthy Stride)" (`test-modifier`, target `{domain:"test", name:"Stealthy Stride"}`, add 2, step, sustained, `condition: "always"`; summary mentions near shadows). The Increase Effect effect MUST use the identical target (`domain:"test", name:"Stealthy Stride"`), `measure:"step"` and `duration:"sustained"` as the base +4, otherwise the fold (`isStandaloneOptionEffect`/`sumOptionBoosts` in `engine/spells.js`) treats it as a separate standalone effect instead of boosting the base. The Increase Duration thread effect carries no `duration` field (as in Soul Armor).
  (c) Base +4 `test-modifier` stays `condition: "always"`; summary "+4 steps to Stealthy Stride tests while near shadows." No `scope` field (not a known token).
  (d) Add `{type: "note", source: "spell", summary: "May use Stealthy Stride as a default skill if not possessed."}` (add `gmDiscretion` only if conformance requires it; mirror Casual Murderer's note). A non-sustained `note` is not folded into the active record (`sustainedEffectsOf` keeps only `duration === "sustained"`), which is fine. `ui/ed-spells.js` appears to render only `description ?? summary` (lines ~966, ~1214), not the effects list, so the note is probably not displayed: the default-skill grant must therefore also appear in `description` (see (e)). The builder confirms by grep whether the note is rendered; if not, flag it for owner verification rather than editing the UI.
  (e) Align `description` and `summary` with the book: bonus applies while near shadows (player judges; always rolled in), light does not end the spell, target is near-invisible again on stepping back into shadow, default skill, success/thread options.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/rules/spells.json` (Shadow Meld block only).
- **Approach:** Data edit mirroring Soul Armor; run `npm test` (includes `tools/rules-conformance.test.js`). Check how `ui/ed-spells.js` renders `successes`/`extraThreads` and `note` effects; do not edit it. UI rendering cannot be covered by `node:test`: list it as an owner-verification step (user verifies UI themselves).
- **Dependencies:** none.
- **Acceptance criteria:** Entry validates; `npm test` green; Spells tab shows the success and the two thread options; selecting them updates the duration readout and (Increase Effect) the Stealthy Stride bonus; +4 remains an always-on roll modifier with the "near shadows" caveat in the text; default-skill grant visible to the player in the description text (and in the note if the UI renders it; otherwise flagged for owner verification); no regression to other spells.
- **Risks / unknowns:** Conformance rules for a `note` without `duration`/`target` unverified. Players must self-judge "near shadows" (accepted by owner).

### I2 — Test coverage for the changed entry
- **Covers tickets:** T1
- **Rules:** R2, R3
- **Tier:** 3
- **What:** Focused test that Shadow Meld's `successes`/`extraThreads` exist with the expected shapes, durations boost correctly, and the base +4 / Increase Effect effects are `always` test-modifiers on Stealthy Stride (so `autoApplies` is true).
- **Where:** new file `engine/shadow-meld.test.js` (do not disturb uncommitted `engine/spells.test.js`); imports `buildActiveSpell`, `boostedDuration`, `sustainedEffectsOf`, `appliedOptions` from `engine/spells.js` and `autoApplies` from `engine/characteristics.js`, read-only. (`buildCastPlan` does not exist; the real export is `castPlan(ctx, name, castType)`, which does not compute boosted duration. TAXONOMY-AUDIT T-050 uses the stale name; not our concern.)
- **Approach:** Load `rules/spells.json`, take Shadow Meld, and with a rank-1 caster assert via `buildActiveSpell(spell, 1, {extraPicks, successLevels})`:
  - `successLevels: 2` gives `roundsTotal` 10 + 20 (only `successLevels - 1` extra successes count, so +2 minutes = +20 rounds).
  - the Increase Duration thread pick gives +20 rounds.
  - one Increase Effect pick gives a Stealthy Stride effect of value 6 and no standalone duplicate effect (locks the F3 matching requirement).
  - `autoApplies` is true on the base and Increase Effect effects.
  Exact option-pick shape to be read from `appliedOptions`/`castBoosts` at build time; no store needed.
- **Dependencies:** I1.
- **Acceptance criteria:** New test passes; existing suite unchanged.
- **Risks / unknowns:** pick-object shape for `extraPicks` read from `engine/spells.js` at build time.

### I3 — Log the "grant default skill/talent" gap in the audit
- **Covers tickets:** T2
- **Rules:** R6
- **Tier:** 3 (docs only; future fix Tier 2)
- **What:** In `docs/TAXONOMY-AUDIT.md` add T-052: summary-table row after T-051, a finding entry after T-051's entry (before "Accepted / deliberate deviations"), update the exact count/prose locations listed below, and add a Log row dated 2026-10-05. Severity S3, Tier 3 (docs/log) with remedy Tier 2, Status open, Area taxonomy/data. Observed: no effect type/domain can grant a talent or skill as usable by default (Shadow Meld's Stealthy Stride, PG p. 321); modelled as a `note`, display-only. Remedy options: new effect type or operation (Tier 2: doc version bump, migrate rules, schema/`effectTaxonomy` refs), or a documented `note` convention.
- **Where:** `/Users/garyfebbrarino/Work/workspace/EDCharSheet/docs/TAXONOMY-AUDIT.md`. Lines to touch (re-locate by text, numbers drift): line ~9 status header ("51 findings" -> 52); line ~56 "Result at a glance" ("51 findings" -> 52; "the 4 findings added by the re-validation are T-048 to T-051" -> note T-052 added 2026-10-05 for the default-skill gap); line ~185 ("T-048 to T-051 were added in the 2026-10-04 re-validation" -> add that T-052 was added later); summary-table row after T-051 (~112); finding entry after T-051's (~817 block); Log row. Leave the dated re-validation section (~745) untouched. Do not alter the unrelated condition/effect counts in the appendix tables (e.g. ~971, where "51" is a count of conditions).
- **Approach:** Targeted Edit calls only; re-read the file immediately before editing since another session is modifying it.
- **Dependencies:** none (do after I1 so the example is accurate).
- **Acceptance criteria:** Entry follows existing format; row and finding present; prior uncommitted diff intact (verify with `git diff` that only additions are mine).
- **Risks / unknowns:** Concurrent edits to the same file.

## Sequencing
1. I1 (data) - the core change.
2. I2 (tests) - locks the shape.
3. I3 (audit doc) - independent; after I1 so the example is accurate.

## Open questions
- None blocking. Former I4 (engine/UI situational toggle) dropped per owner option 3.

## Review responses
- F1 (blocker): fixed. rules.md R1-R3 now carry the owner Decision (original request: follow the book, PG p. 321); cited in Rules dependencies. No NEEDS_HUMAN remains.
- F2 (major): fixed. I2 rewritten against `buildActiveSpell`/`boostedDuration` with the specific assertions; `buildCastPlan` removed; hedge dropped.
- F3 (minor): fixed. I1(b) states the exact-match requirement for Increase Effect and no `duration` on the Increase Duration thread effect; I2 asserts it.
- F4 (minor): fixed. I1(d) states the note is not folded, that the UI probably renders only description/summary (verified by grep at lines ~966/~1214), so the default-skill text goes in the description too; owner-verification step added.
- F5 (minor): fixed. I3 lists exact locations; re-validation section left untouched; surgical edits after re-reading the file.

## Q&A log reference
See `qa-log.md` for the full interrogation record.
