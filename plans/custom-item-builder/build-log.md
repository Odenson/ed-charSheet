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

## Build run 2 — resolved
Tester dispute resolved (one adjudication cycle): TESTER_UPDATED, 'melee keeps its ranges' now uses string ranges ('5', '10'); validator unchanged. I1-I5 committed together in 11c9329 (I2/I3 landing constraint met). Gate: 995 pass, 0 fail. Dev Lead review: clean, no revision needed. Note: dev switched all ref-grid number inputs (not only Damage Step) from `@change` to `@input` (Cost keeps `@change`); accepted, low risk.

## Doc sync (design-agent)
Applied: PLAN-CUSTOM-ITEMS §6.2/§6.6/§6.4 notes; TAXONOMY-AUDIT T-024 notes (audit was clean in git); ARCHITECTURE.md §8 layout label (pure helper, not a view; no rule change); plan.md status implemented. Deferred (Tier 1/2): none.
Observation (no sign-off needed): the builder persists both `ref.damageStep` and a generated `attack-modifier` effect, as catalog weapons already do (T-024 still open).

## Owner handoff — GUARDRAILS checklist
- Tier classification: all Tier 3 (builder UI within existing field and category tag; bug fix for Damage Step 0). Result: pass.
- Tier 1 UI contract: new read-only row uses existing tokens (`--fs-eyebrow`, `--fs-small`, `--muted`, `--fg`), no new font weights, modal Escape/Enter untouched, no fabricated derived numbers. Result: pass (owner verifies visually).
- Golden rule: builder writes item input only; engine/validator untouched, engine pure. Result: pass.
- Schema/taxonomy: no shape, vocabulary or version-tag change; `npm test` rules-conformance green. Result: pass.
- Gate: `npm test` 995 pass, 0 fail.
- Deferred Tier 1/2 doc edits: none.

## Manual UI verification (owner, on dev)
1. Equipment > custom items > New item, Kind Weapon: Category offers melee, missile, throwing, unarmed.
2. Choose unarmed: Short/Long range inputs disappear; switch back to melee: they return (empty).
3. Type 1 in Damage Step: a muted read-only row "from Damage Step / Adds +1 Damage step" appears per keystroke. Clear it: row goes. Type 0: row shows +0. Type -1 or 1.5: inline error, Save disabled.
4. Add a hand effect Attack-modifier / Damage / add / step: Save blocked with "use the Damage Step field".
5. Save a Gauntlet (unarmed, Damage Step 1), equip it, Combat tab: Weapon picker lists it after None and Unarmed as "dmg 1"; Unarmed Combat is the only talent; damage step is Strength step + 1.
6. Reopen an old weapon saved with only a Damage effect: field is seeded from it.
7. Light and dark mode on the form; mobile fold; Overview viewport fit unchanged.
