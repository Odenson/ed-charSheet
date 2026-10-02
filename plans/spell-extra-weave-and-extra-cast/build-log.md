# Build log: spell-extra-weave-and-extra-cast

## Run 1 — 2026-10-02
- Alignment: PASS. All items Tier 3, no sign-off needed. Rules R1–R4 sourced; R2 APP-DIFFERS has owner Decision (keep app flow, qa-log 2026-10-02). Plan open question (chip wording at mult 1) resolved: plain label, `×N` only when N > 1.
- Tree: branch `dev`; `docs/RULES-FAQ.md` modified (Q016, written by rule-agent for this feature, committed with it); `plans/spell-extra-weave-and-extra-cast/` untracked (committed with feature).

## Build — 2026-10-02
- engine/spells.js: added appliedOptions, boostedDuration; otherCastOutcome uses them (success, boosted duration, text); buildActiveSpell gains options; buildSpellsContext gains castingRank.
- ui/ed-spells.js: success chip + boosted duration line in Target effects; options sub-line (.aeopts) on active row.
- data/changelog.json: unreleased fixed line.
- Gate: npm test green (791 pass). No disputes.

## Dev Lead review + doc sync — 2026-10-02
- Review: one finding (new regex `/rank/i` in `boostedDuration`, ARCHITECTURE §5.5 Tier-1 concern). Fixed in the one revision by reusing `durationRounds`; no new regex. Tests untouched (diff vs snapshot clean); gate 791/791.
- Doc sync (design-agent): applied D1 (plan frontmatter), D3 (superseded banner on spell-target-effect-outcome spec + code comment pointer). No Tier-1/2 doc edit needed after the D2 fix.
- Deferred (minor, UX): D4 — "Rank minutes" duration breakdown reads "50 rounds (Rank 5)" without the unit; tests assert current text, so left for the owner to decide.
