# Build log: update-shadow-meld

## Run 1 — 2026-10-05
- Since: 2026-10-05T06:11:06Z
- Alignment: PASS. All items Tier 3 (no sign-off needed, no Tier 1/2). rules.md R1–R6 sourced; APP-DIFFERS R1–R3 carry owner Decision (follow the book); no open questions in plan/review.
- Tree: branch dev. Unrelated uncommitted edits — `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js`, `docs/TAXONOMY-AUDIT.md` (pre-existing edits) — must NOT be staged. `docs/RULES-FAQ.md` (rule-agent Q028) belongs to this feature. TAXONOMY-AUDIT.md will get both pre-existing edits and ours: stage only if hunks can be separated (see ship step).

## Build — 2026-10-05
- Changed: rules/spells.json Shadow Meld (success level, two extra threads, always-on +4 base effect, default-skill note, description/summary); data/changelog.json unreleased line; docs/TAXONOMY-AUDIT.md T-052 (only those hunks staged; pre-existing audit edits left unstaged).
- Gate: `npm test` 1054 pass / 0 fail. No test disputes.

## Ship — 2026-10-05
- Dev Lead review: clean (spec, rules R1–R6, tests untouched vs snapshot). Gate: `npm test` 1054 pass / 0 fail. Local dev not behind origin/dev.
- Doc sync (design-agent): no design doc stale. Applied D1 (plan.md status: implemented, shipped: unreleased). D2 (optional audit note recording the "near shadows = always" ruling) deferred — TAXONOMY-AUDIT.md has unrelated uncommitted edits; owner may add.
- Deferred Tier-1/2 edits: none. Future fix for T-052 (default-skill grant) is Tier 2.
- Unrelated uncommitted, not staged: `docs/TAXONOMY-AUDIT.md` (pre-existing edits), `engine/spells.js`, `engine/spells.test.js`, `ui/ed-spells.js`.

### GUARDRAILS PR checklist
- Protected surface touched: rules/spells.json data only — Tier 3. PASS
- No Tier 1 change (UI, golden rule, stored inputs, schema shapes/tags): PASS
- No taxonomy vocabulary change; no version bump needed: PASS
- Data fits existing schema; conformance test green: PASS
- Tests added (engine/shadow-meld.test.js, 18); suite green: PASS

### Manual UI verification (owner)
1. Spells tab → Nethermancer → Shadow Meld: success-level option "Increase Duration (+2 minutes)" and thread options "Increase Duration" / "Increase Effect (+2 Stealthy Stride)" appear.
2. Cast with success levels / threads: duration readout grows by 2 min each; Increase Effect raises the Stealthy Stride bonus +4 → +6.
3. Roll Stealthy Stride with Shadow Meld active: +4 applied.
4. Description shows "near shadows" caveat and default-skill text. Check whether the `note` effect itself is displayed (likely only description is).
5. Light + dark mode, mobile fold, Overview fit: no UI code changed, quick glance only.
