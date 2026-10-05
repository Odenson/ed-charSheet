# Build log: situational-chips-global

## Run 1 — 2026-10-05 (since 2026-10-05T03:54:39Z)
**Alignment:** PASS.
- Guardrails: I1 and I3 are Tier 1 with recorded sign-off (qa-log "B7 sign-off", 2026-10-05). I2/I4–I7 Tier 3. No Tier 2.
- Rules: R1–R9 all have sources; APP-DIFFERS items R2, R5, R9 carry owner decisions. R9 (Range Long on damage) follows the book; the owner saw it and did not veto.
- Open questions: only scope-string naming (`ranged`/`movement`) — default accepted, confirm at build time.
- Tree: dev branch; `docs/RULES-FAQ.md` modified (rule-agent Q027 edits for this feature — included in the feature commit) and `plans/situational-chips-global/` untracked (planning artifacts — included).

## Build run — 2026-10-05
Implemented per spec: `rules/combat.json` (Range Short removed, Surprised -3 Defence, scopes `ranged`/`movement`), `engine/combat.js` (`situationRollMods`, `UNSCOPED_EXEMPT_KINDS`, `ranged` admitted on damage, global-situation strip rules), new pure `engine/roll-mods.js` (+ `engine/roll-mods.test.js`: `rollTimeMods`, `resolveOptionalMods`), `store.js` (`session.situations` fold, `conditions.situations`, Active Effects), `ui/ed-app.js` (`_situations`, `ed-toggle-situation`, resets, roll config), `ui/ed-roll-modal.js` + `ui/ed-day-reset.js` (pre-ticked optional mods), `ui/ed-combat.js` + `ui/combat-mods-state.js` (chips dispatch globally), `ui/ed-overview.js` (clear x), docs and changelog line.

Gate: `npm test` 1031 pass / 1 fail.

### Dispute
NEEDS_TESTER: engine/combat.test.js::"Action-test mods hit the attack pool but not the damage (Effect) pool" (line 91) feeds the raw `Range — Long` effects to `damagePool` and expects damage Step unchanged (STR + WEAPON). That contradicts spec/T8/R9 and the tester's own engine/situations.test.js ("Range Long on: damage 10 to 8"): the spec requires `appliesToTest` to admit `scope:'ranged'` on damage pools, and Range Long now carries `scope:'ranged'`, so the raw effect must reduce the damage pool. The old test predates the data/scope change; it needs to use a non-ranged Action effect (e.g. Impaired Movement or a synthetic unscoped Action -2) or expect `STR + WEAPON - 2`.

**Build:** designer → tests-first (13 failing) → dev. One tester adjudication (TESTER_UPDATED: stale Range Long damage-pool assertion in `engine/combat.test.js` replaced with a non-ranged effect). Dev added `engine/roll-mods.js` + `engine/roll-mods.test.js`. Gate: `npm test` 1032/1032 green. Dev Lead review: clean, no revision needed.

**Doc sync (design-agent):** applied D1, D2, D3 (UI-GUIDELINES Overview/Combat/roll-affordance prose — covered by the "B7 sign-off" and the Active Effects × / per-roll toggle owner answers), D5, D6 (ARCHITECTURE), D8 (TAXONOMY-AUDIT T-036 note), D9 (summary text in rules/combat.json and engine/encumbrance.js), D10 (changelog), D11 (plan status), D12 (comment).
**Deferred for the owner (Tier-1/2 docs):**
- D4: `docs/UI-GUIDELINES.md` §7 — reword "Read-only modals … Enter is a no-op" example to cover the roll modal's optional checkboxes and its Enter-commit choosers (locked Tier-1 rule section; rule unchanged, example only).
- D7: `docs/EFFECT-TAXONOMY.md` §6 and `docs/THREAD-ITEMS.md` §7 — add one sentence: "Player-activated session conditions are the exception: a toggled global Situational chip's Defence mods and an activated blood charm's test mods fold while active (ARCHITECTURE §5.1)." (Tier-2-guarded doc; prose only, no version bump.)

## PR checklist (for the eventual release PR)
- [x] No Tier-1 invariant changed beyond the signed-off B7 retirement for Situational chips; data-down/dispatch-up kept (`ed-toggle-situation`), engine pure (`engine/roll-mods.js`), only inputs stored (session-only state, nothing persisted)
- [ ] Overview still fits desktop viewport with no vertical scroll — owner to verify (Active Effects strip scrolls internally)
- [x] Derived values unchanged as placeholder pills (no fabricated numbers)
- [ ] Light and dark mode; modals Escape/Enter — owner to verify
- [x] No taxonomy change (new `scope` strings are free text; `ranged`/`movement` noted in TAXONOMY-AUDIT T-036) — Tier 2 N/A
- [x] Paths relative; no new fetches
