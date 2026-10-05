# Feature: Update Shadow Meld (update-shadow-meld)

## Summary
The Nethermancer Circle 1 spell Shadow Meld (Player's Guide p. 321) is modelled only as an unconditional +4 Stealthy Stride step bonus. The book also gives a success-level option, two extra-thread options, a "near shadows" condition on the bonus, and a default-skill grant. This feature brings the `rules/spells.json` entry in line with the book and logs the one gap the taxonomy cannot express.

## Goals / Non-goals
- Goal: Shadow Meld matches PG p. 321 using existing schema/taxonomy only.
- Goal: record the "grant a talent/skill as default" gap for a future fix.
- Non-goal: Extended Shadow Meld knack (DS p. 425) — owner: out of scope.
- Non-goal: any new taxonomy term or version bump.
- Non-goal: engine/UI changes, a situational roll toggle (owner: option 3).

## Guardrail alignment
Touches `rules/spells.json` (Tier 3, data within schema/taxonomy) and `docs/TAXONOMY-AUDIT.md` (docs). No Tier 1/Tier 2 items; no sign-off needed. Note: working tree already has uncommitted edits in `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js`, `docs/TAXONOMY-AUDIT.md` from other work — do not disturb or bundle them.

## Tickets
### T1 — Complete the Shadow Meld spell entry
- **What:** In `rules/spells.json` "Shadow Meld": (a) `successes`: Increase Duration (+2 minutes), per-success, same shape as Soul Armor; (b) `extraThreads`: Increase Duration (+2 minutes) and Increase Effect (+2 to Stealthy Stride tests); (c) base +4 Stealthy Stride `test-modifier` stays `condition: "always"` (owner ruling: option 3), Increase Effect likewise always; "while near shadows" is stated in description/summary text only; (d) add a `note` effect for "may use Stealthy Stride as a default skill if not possessed"; (e) align description/summary text with the book.
- **Why:** Spell is missing book effects (rules R1–R6).
- **Tier:** 3
- **Acceptance criteria:** Spell entry validates (`tools/rules-conformance.test.js`, `npm test`); Spells tab shows the success and thread options and picking them updates duration/bonus (Increase Effect folds +2 into the roll); +4 remains an always-on roll modifier, with the "near shadows" caveat in the text; default-skill note is displayed; no regression to other spells.
- **Open questions:** none. Owner chose option 3 (always-on); no engine/UI change (former I4 dropped).

### T2 — Log the "grant default skill/talent" taxonomy gap
- **What:** Add a finding to `docs/TAXONOMY-AUDIT.md` (next free T-number, summary table row + finding entry) describing that no effect vocabulary can grant a talent/skill as usable by default (e.g., Shadow Meld's Stealthy Stride), with Shadow Meld as the example and options for a future Tier-2 fix.
- **Why:** Owner wants the gap tracked for a later fix rather than solved now.
- **Tier:** 3 (docs only; the future fix would be Tier 2)
- **Acceptance criteria:** Finding follows the doc's existing format, severity/tier set, status open; existing uncommitted edits to that file are preserved.
- **Open questions:** none
