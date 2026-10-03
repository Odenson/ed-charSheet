# Build log: taxonomy-on-action-type

## Run 1 — 2026-10-03
- **Alignment:** passed. I1-I4 Tier 2 (all three steps: doc v5, migrate all rules/*.json refs, version stamps + conformance); I5-I10 Tier 3. No Tier-1 items. rules.md R1-R4 sourced; R2 NOT-COVERED carries owner Decision (fastest wins). Plan open questions: only the worker redeploy reminder (informational).
- **Working tree:** branch `dev`, level with origin/dev. `docs/RULES-FAQ.md` modified (Q018, from /new-feature) — belongs to this feature. `plans/taxonomy-on-action-type/` untracked.

## Build 1 — 2026-10-03
- Implemented I1-I10: taxonomy doc v5 (+ §5.1 prose, §10 example, version mentions in HOMEBREW-RULES/THREAD-ITEMS/GUARDRAILS), 11 rules refs to v5, worker.js and dev-server.mjs stamps, new engine/ability-actions.js, store fold (talents + skills), Disciplines (4 surfaces) and Combat picker accent UI, Death's Head action-modifier data, changelog line.
- Gate: `npm test` green (847 pass, 0 fail). No test disputes.
- Owner reminder: tools/worker/worker.js changed, so redeploy the Cloudflare worker at release.
- Not checked in a browser (owner verifies UI manually). Ed-overview Active Effects renders via e.source/summary; string-valued effect not browser-verified.

## Dev Lead (2026-10-03)
- Phase 4 review: clean, no revision. Tester's six test files byte-identical to snapshot. Gate 847 pass.
- Phase 5 doc sync (design-agent): applied D1 (plan status), D2 (THREAD-ITEMS v5 row), D3 + D4 (ARCHITECTURE layout + §5.1/§5.4), D5 + D6 (EFFECT-TAXONOMY prose; no vocabulary words added, covered by the T1 Tier-2 ceremony). UI-GUIDELINES needs no edit. Deferred: none. TAXONOMY-AUDIT left as dated snapshot.
- Accepted limits (owner, qa-log): Safari ignores `<option>` colour; hover desktop-only.
- Owner reminder: `tools/worker/worker.js` changed (v5 stamp) — redeploy the Cloudflare worker at release.

## Owner handoff

### GUARDRAILS PR checklist (results)
- [x] No Tier-1 invariant changed (engine pure/DOM-free; UI renders pre-resolved fields; nothing derived is stored)
- [ ] Overview fits desktop viewport — owner to confirm (Active Effects row shows the spell summary only)
- [x] Derived values: action is a real derived word; no fabricated numbers
- [ ] Light and dark both work — owner to confirm (`--accent` is theme-aware)
- [x] Tier 2: EFFECT-TAXONOMY bumped to v5 AND all 11 rules/*.json refs migrated AND version stamps/conformance updated
- [x] Asset/fetch paths unchanged (relative)

### Deferred Tier-1/2 doc edits
None.

### Manual UI checklist
See the final report ("UI test requirements").
