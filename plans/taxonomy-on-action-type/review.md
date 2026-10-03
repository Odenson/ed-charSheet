# Plan Review: Taxonomy on action type (taxonomy-on-action-type)

## Summary
The plan is well grounded. File references, line numbers and the fold path check out against the codebase. The Tier-2 ceremony is complete (I1-I4), and every rule traces to an entry in rules.md. There is 1 blocker (the I8 `*` marker contradicts the owner decision) and 3 minor findings.

## Findings
### F1 — I8 — `*` marker contradicts the owner's "colour only" decision
- **Severity:** blocker
- **Problem:** The owner said the Combat attack picker gets a colour change only, with no hover and no extra marker. qa-log: "colour change only (no hover)". T3 acceptance: "Combat picker colour-only". I8 step (3) appends a `*` suffix to the option text and says the carried marker is "the fallback only because colour alone is unreliable". That adds a marker the owner ruled out. The "Open questions" entry and the Risks line treat the marker as an optional preference. It is a contradiction of a recorded decision, not a preference. The I8 acceptance criterion "carries the marker everywhere" also fails the owner's ticket.
- **Fix:** Remove step (3) and the marker from I8's What, Acceptance and Risks. Remove the marker bullet from Open questions. Keep only (1), `option.chg` accent colour, and (2), the `chg` class on the `<select>` when the selected option is changed. State in Risks that macOS Safari native option menus ignore `option` colour, and that the owner accepts this. If the owner wants a cross-browser cue, ask them. Do not add one unilaterally.

### F2 — I8 / I6 — Skills in the picker will change colour although the ticket says "skills UI out of scope"
- **Severity:** minor
- **Problem:** I6 folds `action-modifier` onto skills. The Combat picker lists skills, so I8 would colour a skill option if an effect ever targeted a skill. That is acceptable, but it sits uneasily with the T1 non-goal "skills/knacks UI". The plan notes this only in an open question.
- **Fix:** Say explicitly in I8 that skill options colour via the same data flag. Keep the open question so the owner can confirm.

### F3 — I5 — "Override" semantics can slow a faster base
- **Severity:** minor
- **Problem:** R2 says an effect `set`s the action (override), and I5 returns a changed action even when the effect value is slower than the base. A Simple effect on a Free talent would show Free → Simple in accent. I5's test list has no case for this.
- **Fix:** Add a unit test that pins the behaviour for a slower-than-base value, whichever way the owner intends. Mention it in the I1 doc prose. The plan currently states "not 'must be faster than'", which supports override, so this only needs a pinned test.

### F4 — I4 — Drift-test dependency on I5 breaks the "I1-I4 land as one unit" sequencing
- **Severity:** minor
- **Problem:** I4's drift assertion imports `ACTION_SPEED` from I5, but I5 is sequenced after I1-I4. The plan hedges ("defer that single assertion to I5's test file").
- **Fix:** Decide now. Put the drift test in `engine/ability-actions.test.js` (I5) and drop the import from I4's scope, so I4 has no forward dependency.
