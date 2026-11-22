# Plan Review: Create new adept (create-new-adept)

## Summary
The plan is well grounded. The worker create path, the Tier-1 sign-off and the rules citations all check out. There are 7 findings: 0 blockers, 4 major and 3 minor. The majors are unresolved design gaps that the plan defers to the builder. All four are cheaper to settle now than mid-build.

## Findings
### F1 — I7 — Skill categories are not structured data in `rules/skills.json`
- **Severity:** major
- **Problem:** I verified that skill entries carry only `name, tier, strain, attribute, action, versus, summary, effects, presentation`. There is no `category` field.
  - I7 needs Knowledge, Artisan, Language and General categories as structured fields.
  - The only signal today is name parsing, for example "(Artisan)", "Speak Language (Elf)" and "Read/Write Language". Name parsing is forbidden by the Tier-1 "no display-string parsing" rule the plan itself quotes.
  - Discipline `artisanSkills` names ("Arrow Fletching") do not match the catalog names ("Arrow Fletching (Artisan)"). There is a join problem.
  - "Knowledge" appears to be a single generic entry, so it is unclear how the player records a specific Knowledge skill.
  - The plan leaves this as "if missing, add as Tier-3 data, or stop and ask".
- **Fix:** Decide in the plan. Either add a `category` field to `rules/skills.json` as an explicit item with a Tier call, or record a house decision on the shape. A new field on a rules file may count as a schema-shape change under GUARDRAILS, so classify it and get sign-off if needed. Define the artisan name mapping. Define how language and Knowledge picks are stored, and with what skill names.

### F2 — I8 — Attribute steppers do not exist, so this is new Overview UI
- **Severity:** major
- **Problem:** `ui/ed-overview.js` has no attribute editing. `increases` and `points` are not referenced there. The plan raises this only as a risk. Adding steppers to a Tier-1 constrained Overview (no vertical scroll on desktop, a compacted attribute grid at L940) is a real UI change, and the plan currently says "reuse the existing stepper markup".
- **Fix:** State plainly that attribute steppers are new. Specify where they sit in the existing attribute cell without adding a row. Mark the Overview fit and the light/dark check as manual owner verification. Consider whether the sign-off or a UI-GUIDELINES update is needed.

### F3 — I9/I1 — Karma "starts full" is undecided and conflicts with the ledger semantics
- **Severity:** major
- **Problem:** `resources.karma.converted` is documented in `store.js` as "lifetime gained", and `available = clamp(converted - spent)`. The plan proposes seeding `converted` "high enough to be clamped". That corrupts the ledger meaning, and the value changes once Max Karma changes at Finish. I1 and I9 both defer the decision, but I1's acceptance criteria and tests need it.
- **Fix:** Pick one mechanism before the build, for example seeding `converted` equal to the derived max at build time and again at Finish with the `karmaBonus`. Alternatively, record that this is a signed-off `creation` input. State it in I1 and I9. Check that it does not breach the signed-off block scope, because anything outside `creation` means re-asking the owner.

### F4 — I4/I9 — `creation.karmaBonus` stores a derived value and exceeds the sign-off wording
- **Severity:** major
- **Problem:** The leftover attribute points equal 25 minus the cost of `attributes[n].points`, so they are derivable at any time. Storing `karmaBonus` breaks "store only inputs". The sign-off covers "allotments spent, finished flag", not a bonus value. The plan itself flags this scope risk without resolving it.
- **Fix:** Drop `karmaBonus`. Derive the bonus in `deriveModel` as `25 - cost(points)` when `creation` exists and `open === false`. Alternatively, justify it explicitly and re-ask the owner (`NEEDS_HUMAN` below). Whichever route is chosen, also state whether `attributes[n].points` is locked after Finish.

### F5 — I6 — Silent overwrite on the first Save when the id is taken elsewhere
- **Severity:** minor
- **Problem:** `base: null` makes the worker skip the stale check, so the first Save can overwrite another device's character. The plan lists this only under open questions, but I6's acceptance criteria do not cover it.
- **Fix:** Make the recommended default (re-check the index and re-suffix before posting) a requirement, with an acceptance test in I6.

### F6 — I6 — Missing-index handling and the empty-store error removal need tests
- **Severity:** minor
- **Problem:** The plan says to tolerate a missing index and to remove the empty-store `_error`. It adds no acceptance criteria that check a real error (network or malformed index) still surfaces. It also lacks a test for the worker's create-only index row when `portrait` is absent. The Discoveries note about the "index row falls back to portrait absent" is left as a "must be checked" and is never assigned.
- **Fix:** Add acceptance criteria to I6: a real load failure still shows an error, and an index row without a portrait renders. Assign the portrait check to a test in `store-server` or `dev-server`.

### F7 — I10 — Rules-FAQ edit and house-ruling recording
- **Severity:** minor
- **Problem:** `docs/RULES-FAQ.md` is uncommitted and modified, and I10 says to update Q039. R7, R9, R10 and the cap, Talent Option and skill-cap rulings are house decisions, and the plan treats recording them as a final item. A build that stops early would leave them unrecorded, and they are the basis for the other items.
- **Fix:** Confirm the Q039 house rulings are already in the working-tree edit. If so, say so in I10 and limit the item to verification. If not, move the recording earlier in the sequence.

## Checked and fine
- **Worker create path:** `ed-character/1` and `/2` are accepted, and the id slug rule is as described.
- **Tier-1 sign-off:** the `creation` block sign-off is recorded in qa-log.
- **Rules grounding:** every rule traces to R1-R10. R3, R7, R8, R9 and R10 each carry an owner `Decision`.
- **Sequencing:** valid; no item depends on a later one.
- **Ticket coverage:** T1-T9 are all covered.

No `NEEDS_RULES`.

NEEDS_HUMAN: Should the leftover-attribute Karma bonus be stored as `creation.karmaBonus` (a derived value, outside the signed-off "allotments spent, finished flag" wording) or derived at read time from `attributes[n].points`? And is a new structured `category` field on `rules/skills.json` acceptable as Tier-3 data?

---

## Round 2 — owner-requested review (2026-11-21, main session)

A second pass at the owner's request, checked against the code. Owner decisions are in `qa-log.md` (round 2); responses are in `plan.md` "Review responses", Round 2. Counts: 4 blockers, 6 major, 5 minor.

### G1 — I1/I4/I9 — Starting Karma is charged as Legend under the active Karma-economy rule
- **Severity:** blocker
- **Problem:** `rules/homebrew.json` `hb-karma-economy` is `enabled: true`, so the audit prices `converted × karma.ritualCost` as Legend spent. Seeding `converted` to the creation Max Karma puts a new Ork at 35 Legend spent (5 × 7), and more after Finish. "Available 0" is unreachable, and the free-rank ledger does not cover Karma.
- **Fix (owner):** creation Karma is free, derived from the block's presence; the race cap applies to the total, bonus included.

### G2 — I1/I4 — "Legend 0/0" has no stored form
- **Severity:** major
- **Problem:** with no legacy `totalEarnt` and an empty `earned`, `deriveModel` (~L1416) and `_legendTotalEarnt` give null: a placeholder pill and a rank guard that refuses. With 0 Legend nothing is buyable either way, so the effect is the display and the plan's "Available 0" criteria (I8, I9).
- **Fix (owner):** derive 0 while the `creation` block exists.

### G3 — I1 — Durability missing for a new character
- **Severity:** blocker
- **Problem:** health ratings add Durability only from a stored `Durability` talent rank (`store.js` ~L1096). With `talents: []`, Unconsciousness and Death lose +3 to +7.
- **Fix (owner):** seed Durability and Karma Ritual at Rank 1, free.

### G4 — I1/I7/I8 — The Spells tab is unreachable for a new Nethermancer
- **Severity:** blocker
- **Problem:** `buildSpellsContext` is null when `known` and `matrices` are both empty; caster Disciplines need a Spellcasting talent; Learn spell needs Thread Weaving and runs a roll plus a silver fee.
- **Fix:** seed two empty Standard matrices. Owner: a free pick from `rules/spells.json` with no talent prerequisite, no roll, no silver.

### G5 — I2/I7/I8 — Skill picks have no data or UI path
- **Severity:** blocker
- **Problem:** the catalog has one generic Knowledge entry. Add skill offers catalog names once each and charges silver. Languages are per-language entries, while the plan's maths assumed one skill at rank 2. There is no classification source for 154 entries; the "(Artisan)" suffix is inconsistent; Bribery and Skinning are duplicated. The plan's "never parse names" contradicts the existing `Name (Spec)` lookup (`store.js` ~L1263).
- **Fix (owner):** Knowledge as free text `Knowledge (<text>)` through the existing lookup; one language per rank; the Artisan pick from the Discipline list only. Classification by a rule-agent batch; a `generic` flag on the templates.

### G6 — I4/I6 — The overlay does not cover a saved character still in creation; drafts autosave
- **Severity:** major
- **Problem:** there is no `attributes` overlay category, and `spells` is missing from `SAVED_CATEGORIES` (pre-existing). A save key entered earlier in the session makes a new draft autosave within seconds, so the first-Save id re-check would run inside a silent save.
- **Fix:** add the `attributes`, `creation` and `spells` categories; drafts skip autosave until the first manual Save.

### G7 — I4 — Step prices ignore free ranks
- **Severity:** major
- **Problem:** `deriveModel` promises step price = `audit(after) − audit(before)`, but the plan changes only the audit. There is no clamp for a free rank above the current rank. `_canAffordRank` omits the Karma and spell sinks (pre-existing).
- **Fix:** free-aware pricing, the clamp, and a guard that uses the same audit options.

### G8 — I8 — The creation steppers are new UI
- **Severity:** major
- **Problem:** the stepper floors at Rank 1, and `_editTalentRank` edits only stored talents.
- **Fix:** rows for all five Circle-1 Discipline Talents at 0..3, with their own handler.

### G9 — I3 — Draft write routing deferred to a later item
- **Severity:** minor
- **Fix:** a draft is a base envelope plus the ordinary overlay.

### G10 — I5/I6 — Draft-hostile controls
- **Severity:** major
- **Problem:** "Discard local changes" clears the dirty dot on a draft; `_initialId` ignores drafts; a Discard button would nest inside the picker row button.
- **Fix:** hide the control for drafts; accept draft ids; sibling buttons.

### G11 — I7/I9 — Budgets can go stale
- **Severity:** major
- **Problem:** lowering Perception after picking spells over-spends the spell budget, and no rule covers it.
- **Fix:** a `valid` flag, shown and never auto-corrected, that blocks Finish.

### G12 — I1 — Magician signal and attribute key
- **Severity:** minor
- **Problem:** every Discipline has `halfMagic`; the `rules/attributes.json` key is `order`, not `attributeOrder`.
- **Fix:** test for Spellcasting in the circle-1 talents; use `order`.

### G13 — I10 — Stale RULES-FAQ note
- **Severity:** minor
- **Problem:** the skill-cap and Grimoire decisions are already in the working-tree Q039/Q040.
- **Fix:** I10 verifies only; the round-2 Decisions are recorded by the rule-agent before the build, and RULES-FAQ is committed first.

### G14 — Sequencing — Incomplete dependency lists
- **Severity:** minor
- **Problem:** I7 needs I2; I8 needs I6; I3 depended on a decision deferred to I6.
- **Fix:** dependency lists and sequence updated.

### G15 — I6 — Half-built characters on the live branch
- **Severity:** minor
- **Fix:** exercise the create/save slice against `tools/dev-server.mjs` until I9 lands.
