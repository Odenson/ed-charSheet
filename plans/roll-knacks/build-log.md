# Build log: roll-knacks

## Run 1 — 2026-11-15 (since 2026-11-15T11:43:44Z)

### Alignment (Phase 0)
- Guardrails: I1-I7 all Tier 3; no Tier-1/2 items, so no sign-off needed.
- Rules coverage: R1-R9 all have sources; R2, R5 (NOT-COVERED) and R8 (APP-DIFFERS) carry recorded owner decisions.
- Open questions: none (review F1-F5 addressed in plan; F2 ratified in qa-log).
- Working tree: unrelated uncommitted change `docs/RULES-FAQ.md` (rule-agent ledger) and untracked `plans/roll-knacks/`. Do not stage RULES-FAQ.md unless it belongs to this feature's rules work.
- Outcome: ALIGNED. plan.md status set to `building`.

## Build (I1-I7)
- I1 rules/knacks.json: `attribute` on 100 rollable knacks, Swinging Move "0", Take the Hit "2", notes line.
- I2 engine/derive.js `knackRoll`; store.js knack roll pass + `talent.rollStrain`; resolveKnack comment.
- I3/I4 ui/ed-disciplines.js (`_karmaCtx`, knack roll button, `.knsp`, talent `strain`); ui/ed-roll-modal.js (charge in updated(), hint).
- I5 ui/ed-app.js (`_strainCharged`, log + report), ui/ed-notes.js chip. I6 engine/discord-roll.js. Changelog line added.
- Gate: all pass except one tester test (dispute below). Not committed.

## Dispute
store-knack.test.js::"roll-knacks model: skill-learned knack uses the skill rank, no karma, with knackParents on" is unsatisfiable: its character (skillChar()) defines only Toughness, so Perception has no step in the model (Wilderness Survival step is null, model.attributes has no Perception). The test's own `attrStep(model,'Perception')` would throw, and spec says unknown attribute step => roll null. Fix: add `Perception: { base: 14 }` to the test character.

## Dispute resolution
Tester adjudicated (TESTER_UPDATED): the test character lacked Perception; test fixed (character now has `Perception: { base: 14 }`), assertions unchanged. Gate: 1300/1300.

## Dev Lead review
Clean. Diff matches spec; golden rule held (UI forwards model values, pure `knackRoll`, structured `attribute`, no string parsing); no double charge on aim/set-dice (`_strainCharged`, non-arms `_rollDetail` only).

## Doc sync
Applied: UI-GUIDELINES roll-affordance bullet (knacks, no-Step rule, Strain on roll); ARCHITECTURE §7.6 Strain line/field and §8 `knackRoll`; HOMEBREW-RULES §5.6 skill knack roll; TAXONOMY-AUDIT T-036 note.
Deferred for owner (touches Tier-1 tab table / modal conventions, descriptive only):
- UI-GUIDELINES §4 Disciplines row: add that knack rows are indented children with info button and, when a Step exists, a roll button.
- UI-GUIDELINES §7: "roll and ability modals are read-only with no primary action" is stale (roll modal has Apply; now charges Strain on open); reword and confirm whether Apply should take Enter.
- Optional: drop the redundant `catalogStep === 'N/A'/'NA'` equality check in `knackRoll` and gate on `attribute` alone.
