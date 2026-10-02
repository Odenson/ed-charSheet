# Plan Review: Apply weave-success and cast-success spell options together (spell-extra-weave-and-extra-cast)

## Summary
The plan is sound. It is grounded in the real code, correctly Tier 3, and every rules claim traces to R1-R4. I found 4 minor findings and no blockers.

## Findings
### F1 — I2 / I4 — castingRank vs ed-app rank semantics
- **Severity:** minor
- **Problem:** `ed-app._spellcastingRank()` returns `t.rank ?? 0` and scans `character.disciplines`. The plan's new `ctx.castingRank` is "null if none" and is taken from the first caster discipline in `buildSpellsContext`. The two sources can differ. The plan says "same rank" but defines no single source.
- **Fix:** Read `sc.rank` in the same loop that finds `sc`, with the same first-match order as ed-app. State the null versus 0 behaviour. With a null rank, `rounds` must be null and the text must fall back to `spell.duration`. Never show "Rank 0".

### F2 — I4 / T2 — Rank is read at render time, not stored with the cast
- **Severity:** minor
- **Problem:** T2 says the Other-cast record must carry the caster rank. I4 instead reads `ctx.castingRank` at render time and leaves `_otherCast` unchanged. This is acceptable because rank is derived and "store only inputs" applies. But if the rank changes after the cast (a rank-up or an edit), the displayed duration shifts. T2 and the plan are also inconsistent.
- **Fix:** State explicitly that render-time derivation is intended and reconcile T2's wording. Add a note on the rank-change edge case.

### F3 — I5 — Other consumers of `model.spells.active`
- **Severity:** minor
- **Problem:** `ui/ed-combat.js:~1101` also reads `model.spells.active`. It only reads `.effects`, so the added `options` field is harmless. The plan leaves this as "confirm during build".
- **Fix:** Record in I5 that ed-combat ignores `options` and is unaffected. Also confirm that the engine model passes the `options` field through to `ctx.active`, because `_activeRow` reads `this.ctx.active`.

### F4 — I1 — Stale pick handling is under-specified
- **Severity:** minor
- **Problem:** The plan says a stale pick label is listed but contributes no boost. The acceptance criteria have no test for it. `castBoosts` already ignores unknown labels.
- **Fix:** Add a node:test case for an unknown pick label. It should appear in `picks` and add 0 boost.
