# Build log: update-shadow-meld

## Run 1 — 2026-10-05
- Since: 2026-10-05T06:11:06Z
- Alignment: PASS. All items Tier 3 (no sign-off needed, no Tier 1/2). rules.md R1–R6 sourced; APP-DIFFERS R1–R3 carry owner Decision (follow the book); no open questions in plan/review.
- Tree: branch dev. Unrelated uncommitted edits — `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js`, `docs/TAXONOMY-AUDIT.md` (pre-existing edits) — must NOT be staged. `docs/RULES-FAQ.md` (rule-agent Q028) belongs to this feature. TAXONOMY-AUDIT.md will get both pre-existing edits and ours: stage only if hunks can be separated (see ship step).

## Build — 2026-10-05
- Changed: rules/spells.json Shadow Meld (success level, two extra threads, always-on +4 base effect, default-skill note, description/summary); data/changelog.json unreleased line; docs/TAXONOMY-AUDIT.md T-052 (only those hunks staged; pre-existing audit edits left unstaged).
- Gate: `npm test` 1054 pass / 0 fail. No test disputes.
