# Build log: custom-item-builder

## Run 1 — 2026-10-05 (since 2026-10-05T02:17:07Z)
**Alignment gate: PASS.**
- Guardrails: all 5 items (I1-I5) Tier 3; no Tier-1/2 sign-off needed.
- Rules: R1-R2 FAQ-HIT (Q025); R3-R4 NOT-COVERED (Q026) with owner decisions 2026-10-05 recorded in rules.md, qa-log.md and RULES-FAQ.md.
- Open questions: none blocking (negative Damage Step decided: rejected with inline error; strMin/size 0 stay dropped).
- Tree: `docs/RULES-FAQ.md` modified (rule-agent Q026) and `plans/custom-item-builder/` untracked; both belong to this feature and are committed by explicit path. No unrelated changes.

## Build run 1 — dispute
Implemented I1-I5 (builder helpers, cleanItemForm changes, form UI, docs, changelog). Gate: all pass except one tester case.
- Dispute: custom-item-builder-unarmed.test.js::'melee keeps its ranges' passes shortRange: 5 / longRange: 10 (numbers); engine/validate-item.js:173 requires shortRange/longRange to be strings ("ref.shortRange: must be a string"), and the spec says the validator is NOT modified. The test should use strings (e.g. '5', '10'). Raised as NEEDS_TESTER; not committed.
